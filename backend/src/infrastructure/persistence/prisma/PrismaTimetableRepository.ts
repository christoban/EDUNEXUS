import type { PrismaClient } from '@prisma/client';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type {
  TimetableRepository,
  CreneauConflitInfo,
  CreneauALoter,
  GridConfig,
  SlotContexte,
  EleveClasseAvecProfil,
  AffectationSolver,
  NomEnseignant,
} from '@domain/ports/repositories/TimetableRepository';
import type { CreneauOccupe } from '@domain/ports/services/SchedulingSolverPort';
import type { TimetableStatus, SlotKind } from '@domain/types/enums';

export class PrismaTimetableRepository implements TimetableRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // --- EmploiDuTemps ---

  async findById(id: string): Promise<EmploiDuTemps | null> {
    const data = await this.prisma.timetable.findUnique({ where: { id } });
    if (!data) return null;
    return EmploiDuTemps.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      classId: data.classId,
      academicYearId: data.academicYearId,
      status: data.status as TimetableStatus,
      generatedByAI: data.generatedByAI,
      createdAt: data.createdAt,
    });
  }

  async findByClasse(classId: string, academicYearId: string): Promise<EmploiDuTemps | null> {
    const data = await this.prisma.timetable.findFirst({
      where: { classId, academicYearId },
    });
    if (!data) return null;
    return EmploiDuTemps.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      classId: data.classId,
      academicYearId: data.academicYearId,
      status: data.status as TimetableStatus,
      generatedByAI: data.generatedByAI,
      createdAt: data.createdAt,
    });
  }

  async save(emploiDuTemps: EmploiDuTemps): Promise<void> {
    const data = emploiDuTemps.toObject();
    await this.prisma.timetable.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        classId: data.classId,
        academicYearId: data.academicYearId,
        status: data.status,
        generatedByAI: data.generatedByAI,
        createdAt: data.createdAt,
      },
    });
  }

  async update(emploiDuTemps: EmploiDuTemps): Promise<void> {
    await this.prisma.timetable.update({
      where: { id: emploiDuTemps.id },
      data: { status: emploiDuTemps.status },
    });
  }

  async countCreneaux(timetableId: string): Promise<number> {
    return this.prisma.timetableSlot.count({ where: { timetableId } });
  }

  // --- Créneaux ---

  async findCreneauById(id: string): Promise<CreneauHoraire | null> {
    const data = await this.prisma.timetableSlot.findUnique({ where: { id } });
    if (!data) return null;
    return this.creneauToDomain(data);
  }

  async findCreneauxByTimetable(timetableId: string): Promise<CreneauHoraire[]> {
    const data = await this.prisma.timetableSlot.findMany({
      where: { timetableId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return data.map(d => this.creneauToDomain(d));
  }

  async saveCreneaux(creneau: CreneauHoraire): Promise<void> {
    const data = creneau.toObject();
    await this.prisma.timetableSlot.create({
      data: {
        id: data.id,
        timetableId: data.timetableId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        roomId: data.roomId,
        kind: data.kind,
        subGroupId: data.subGroupId,
        groupId: data.groupId,
        isLV2Slot: data.isLV2Slot ?? false,
        isElectiveSlot: data.isElectiveSlot ?? false,
      },
    });
  }

  async updateCreneau(creneau: CreneauHoraire): Promise<void> {
    const data = creneau.toObject();
    await this.prisma.timetableSlot.update({
      where: { id: data.id },
      data: {
        subjectId: data.subjectId ?? null,
        teacherId: data.teacherId ?? null,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        roomId: data.roomId ?? null,
        kind: data.kind,
        subGroupId: data.subGroupId ?? null,
        groupId: data.groupId ?? null,
        isLV2Slot: data.isLV2Slot ?? false,
        isElectiveSlot: data.isElectiveSlot ?? false,
      },
    });
  }

  async deleteCreneau(id: string, timetableId: string): Promise<void> {
    await this.prisma.timetableSlot.deleteMany({ where: { id, timetableId } });
  }

  // --- Détection de conflits (filtre schoolId — correction bug) ---

  async findCreneauxEnseignantParJour(
    teacherId: string,
    dayOfWeek: number,
    schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]> {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        teacherId,
        dayOfWeek,
        kind: 'CLASS',
        timetable: { schoolId },
        ...(excludeId && { id: { not: excludeId } }),
      },
      include: {
        timetable: { include: { class: { select: { name: true } } } },
      },
    });

    return slots.map(s => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      classeNom: s.timetable.class.name,
    }));
  }

  async findCreneauxSalleParJour(
    roomId: string,
    dayOfWeek: number,
    schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]> {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        roomId,
        dayOfWeek,
        kind: 'CLASS',
        timetable: { schoolId },
        ...(excludeId && { id: { not: excludeId } }),
      },
      include: {
        timetable: { include: { class: { select: { name: true } } } },
      },
    });

    return slots.map(s => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      classeNom: s.timetable.class.name,
    }));
  }

  // --- Volume horaire AP ---

  async calculerVolumeHoraireHebdo(
    teacherId: string,
    schoolId: string,
    excludeId?: string
  ): Promise<number> {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        teacherId,
        kind: 'CLASS',
        timetable: { schoolId },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { startTime: true, endTime: true },
    });

    const totalMinutes = slots.reduce((sum, slot) => {
      const debut = CreneauHoraire.heureEnMinutes(slot.startTime);
      const fin = CreneauHoraire.heureEnMinutes(slot.endTime);
      return sum + (fin - debut);
    }, 0);

    return totalMinutes / 60;
  }

  // --- Infos enseignant ---

  async getInfosEnseignant(
    teacherId: string
  ): Promise<{ nom: string; estAP: boolean } | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: teacherId },
      include: {
        staffProfile: { include: { permissions: true } },
      },
    });

    if (!user) return null;

    const nom = `${user.firstName} ${user.lastName}`;
    const permissions = user.staffProfile?.permissions.map(p => p.permission) ?? [];
    const estAP =
      permissions.includes('SUPERVISE_TEACHERS') ||
      permissions.includes('SUPERVISE_DEPARTMENT_TEACHERS');

    return { nom, estAP };
  }

  // --- Infos salle ---

  async getInfosSalle(roomId: string): Promise<{ nom: string } | null> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: { name: true } });
    if (!room) return null;
    return { nom: room.name };
  }

  // --- Validation sous-groupe ---

  async sousGroupeAppartientAClasse(subGroupId: string, classId: string): Promise<boolean> {
    const count = await this.prisma.classSubGroup.count({
      where: { id: subGroupId, classId },
    });
    return count > 0;
  }

  // --- Scheduling Engine (V2.5) ---

  async findOccupationEcole(
    schoolId: string,
    academicYearId: string,
    excludeTimetableId?: string
  ): Promise<CreneauOccupe[]> {
    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        kind: 'CLASS',
        timetable: {
          schoolId,
          academicYearId,
          ...(excludeTimetableId && { id: { not: excludeTimetableId } }),
        },
      },
      select: { teacherId: true, roomId: true, dayOfWeek: true, startTime: true, endTime: true },
    });

    return slots.map(s => ({
      teacherId: s.teacherId ?? undefined,
      roomId: s.roomId ?? undefined,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
  }

  /**
   * Tout ou rien : une seule transaction enveloppe la validation ET l'écriture de tous les
   * créneaux. Quand les conflits sont vérifiés, les relectures se font VIA `tx`, donc chaque
   * créneau voit ceux déjà insérés plus tôt dans le même lot (un lot ne peut pas se contredire
   * lui-même). Toute erreur sort du callback → Prisma annule l'intégralité.
   */
  async creerCreneauxEnLot(
    timetableId: string,
    schoolId: string,
    creneaux: CreneauALoter[],
    options?: { verifierConflits?: boolean }
  ): Promise<{ creneauxCrees: number }> {
    const verifierConflits = options?.verifierConflits ?? true;

    return this.prisma.$transaction(async (tx) => {
      for (const seance of creneaux) {
        // CreneauHoraire.create() valide TOUJOURS le format (heures, début < fin, jour 0-5),
        // même sans vérification de conflit — c'est ce qui manquait aux chemins direct-Prisma.
        const creneau = CreneauHoraire.create({
          timetableId,
          subjectId: seance.subjectId,
          teacherId: seance.teacherId,
          teacherNom: verifierConflits && seance.teacherId
            ? await this.nomEnseignant(tx, seance.teacherId) : undefined,
          dayOfWeek: seance.dayOfWeek,
          startTime: seance.startTime,
          endTime: seance.endTime,
          roomId: seance.roomId,
          roomNom: verifierConflits && seance.roomId
            ? await this.nomSalle(tx, seance.roomId) : undefined,
          kind: 'CLASS',
        });

        if (verifierConflits) {
          if (seance.teacherId) {
            creneau.verifierConflitEnseignant(
              await this.conflitsEnseignant(tx, seance.teacherId, seance.dayOfWeek, schoolId)
            );
          }
          if (seance.roomId) {
            creneau.verifierConflitSalle(
              await this.conflitsSalle(tx, seance.roomId, seance.dayOfWeek, schoolId)
            );
          }
        }

        const data = creneau.toObject();
        await tx.timetableSlot.create({
          data: {
            id: data.id,
            timetableId: data.timetableId,
            subjectId: data.subjectId,
            teacherId: data.teacherId,
            dayOfWeek: data.dayOfWeek,
            startTime: data.startTime,
            endTime: data.endTime,
            roomId: data.roomId,
            kind: data.kind,
          },
        });
      }

      return { creneauxCrees: creneaux.length };
    });
  }

  // Variantes transactionnelles des lectures de conflit — même forme que les méthodes publiques
  // équivalentes, mais liées au client de transaction pour rester cohérentes intra-transaction.
  private async conflitsEnseignant(
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    teacherId: string,
    dayOfWeek: number,
    schoolId: string
  ): Promise<CreneauConflitInfo[]> {
    const slots = await tx.timetableSlot.findMany({
      where: { teacherId, dayOfWeek, kind: 'CLASS', timetable: { schoolId } },
      include: { timetable: { include: { class: { select: { name: true } } } } },
    });
    return slots.map(s => ({
      id: s.id, startTime: s.startTime, endTime: s.endTime, classeNom: s.timetable.class.name,
    }));
  }

  private async conflitsSalle(
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    roomId: string,
    dayOfWeek: number,
    schoolId: string
  ): Promise<CreneauConflitInfo[]> {
    const slots = await tx.timetableSlot.findMany({
      where: { roomId, dayOfWeek, kind: 'CLASS', timetable: { schoolId } },
      include: { timetable: { include: { class: { select: { name: true } } } } },
    });
    return slots.map(s => ({
      id: s.id, startTime: s.startTime, endTime: s.endTime, classeNom: s.timetable.class.name,
    }));
  }

  private async nomEnseignant(
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    teacherId: string
  ): Promise<string | undefined> {
    const user = await tx.user.findUnique({
      where: { id: teacherId }, select: { firstName: true, lastName: true },
    });
    return user ? `${user.firstName} ${user.lastName}` : undefined;
  }

  private async nomSalle(
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    roomId: string
  ): Promise<string | undefined> {
    const room = await tx.room.findUnique({ where: { id: roomId }, select: { name: true } });
    return room?.name;
  }
  // --- Scheduling Engine (V2.5) — lectures solveur ---

  async getGridConfig(schoolId: string): Promise<GridConfig | null> {
    const config = await this.prisma.timetableGridConfig.findUnique({ where: { schoolId } });
    return config;
  }

  async classeAppartientAEcole(classId: string, schoolId: string): Promise<boolean> {
    const classe = await this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true },
    });
    return !!classe;
  }

  async findSlotAvecContexte(slotId: string): Promise<SlotContexte | null> {
    const slot = await this.prisma.timetableSlot.findUnique({
      where: { id: slotId },
      include: {
        timetable: { select: { schoolId: true, classId: true, academicYearId: true } },
        subject: { select: { name: true, restrictedToGroupId: true } },
      },
    });
    if (!slot) return null;
    return {
      schoolId: slot.timetable.schoolId,
      classId: slot.timetable.classId,
      academicYearId: slot.timetable.academicYearId,
      subjectId: slot.subjectId,
      groupId: slot.groupId,
      isLV2Slot: slot.isLV2Slot,
      isElectiveSlot: slot.isElectiveSlot,
      subjectName: slot.subject?.name ?? null,
      restrictedToGroupId: slot.subject?.restrictedToGroupId ?? null,
    };
  }

  async findElevesClasseAvecProfils(schoolId: string, classId: string): Promise<EleveClasseAvecProfil[]> {
    const eleves = await this.prisma.user.findMany({
      where: {
        schoolId,
        role: 'STUDENT',
        isActive: true,
        studentProfile: {
          enrollmentsYearScoped: {
            some: {
              classId,
              status: 'ACTIVE',
              academicYear: { isCurrent: true },
            },
          },
        },
      },
      select: {
        id: true, firstName: true, lastName: true,
        studentProfile: { select: { id: true, lv2SubjectId: true, alevelSubjects: { select: { subjectId: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return eleves.map(e => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      studentProfileId: e.studentProfile?.id ?? null,
      lv2SubjectId: e.studentProfile?.lv2SubjectId ?? null,
      alevelSubjectIds: e.studentProfile?.alevelSubjects.map(a => a.subjectId) ?? [],
    }));
  }

  async findAffectationsSolver(classId: string, schoolId: string): Promise<AffectationSolver[]> {
    const affectations = await this.prisma.teachingAssignment.findMany({
      where: {
        classId,
        schoolId,
        subject: {
          restrictedToGroupId: null,
          studentGroups: { none: {} },
        },
      },
      select: {
        teacherId: true,
        subjectId: true,
        subject: {
          select: {
            subjectType: true,
            hoursPerWeek: true,
            name: true,
            blocDureeCases: true,
          },
        },
      },
    });
    return affectations.map(a => ({
      teacherId: a.teacherId,
      subjectId: a.subjectId,
      subjectType: a.subject.subjectType,
      hoursPerWeek: a.subject.hoursPerWeek,
      name: a.subject.name,
      blocDureeCases: a.subject.blocDureeCases,
    }));
  }

  async findNomsEnseignants(teacherIds: string[]): Promise<NomEnseignant[]> {
    const enseignants = await this.prisma.user.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    return enseignants.map(u => ({ id: u.id, nomComplet: `${u.firstName} ${u.lastName}` }));
  }

  async compterEnseignants(ids: string[], schoolId: string): Promise<number> {
    return this.prisma.user.count({ where: { id: { in: ids }, schoolId } });
  }

  async compterSalles(ids: string[], schoolId: string): Promise<number> {
    return this.prisma.room.count({ where: { id: { in: ids }, schoolId } });
  }

  async compterMatieres(ids: string[], schoolId: string): Promise<number> {
    return this.prisma.subject.count({ where: { id: { in: ids }, schoolId } });
  }

  async findClassIdsAvecEdtPublie(schoolId: string, academicYearId: string): Promise<string[]> {
    const timetables = await this.prisma.timetable.findMany({
      where: { schoolId, academicYearId, status: 'PUBLISHED' },
      select: { classId: true },
    });
    return timetables.map((t) => t.classId);
  }

  // --- Conversion ---

  private creneauToDomain(data: any): CreneauHoraire {
    return CreneauHoraire.reconstituer({
      id: data.id,
      timetableId: data.timetableId,
      subjectId: data.subjectId ?? undefined,
      teacherId: data.teacherId ?? undefined,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      roomId: data.roomId ?? undefined,
      kind: data.kind as SlotKind,
      subGroupId: data.subGroupId ?? undefined,
      groupId: data.groupId ?? undefined,
      isLV2Slot: data.isLV2Slot ?? false,
      isElectiveSlot: data.isElectiveSlot ?? false,
    });
  }
}
