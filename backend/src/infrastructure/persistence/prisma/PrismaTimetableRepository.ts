import type { PrismaClient } from '@prisma/client';
import { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type {
  TimetableRepository,
  CreneauConflitInfo,
} from '@domain/ports/repositories/TimetableRepository';
import type { SeanceProposee, CreneauOccupe } from '@domain/ports/services/SchedulingSolverPort';
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
   * Tout ou rien : une seule transaction enveloppe la re-vérification des conflits ET l'écriture
   * de toutes les séances. Les relectures d'occupation se font VIA `tx`, donc chaque séance voit
   * celles déjà insérées plus tôt dans le même appel (une proposition ne peut pas se contredire
   * elle-même). Toute erreur de conflit sort du callback → Prisma annule l'intégralité.
   */
  async appliquerPropositionAtomique(
    timetableId: string,
    schoolId: string,
    seances: SeanceProposee[]
  ): Promise<{ creneauxCrees: number }> {
    return this.prisma.$transaction(async (tx) => {
      for (const seance of seances) {
        const creneau = CreneauHoraire.create({
          timetableId,
          subjectId: seance.subjectId,
          teacherId: seance.teacherId,
          teacherNom: await this.nomEnseignant(tx, seance.teacherId),
          dayOfWeek: seance.dayOfWeek,
          startTime: seance.startTime,
          endTime: seance.endTime,
          roomId: seance.roomId,
          roomNom: await this.nomSalle(tx, seance.roomId),
          kind: 'CLASS',
        });

        creneau.verifierConflitEnseignant(
          await this.conflitsEnseignant(tx, seance.teacherId, seance.dayOfWeek, schoolId)
        );
        creneau.verifierConflitSalle(
          await this.conflitsSalle(tx, seance.roomId, seance.dayOfWeek, schoolId)
        );

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

      return { creneauxCrees: seances.length };
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
