import type { PrismaClient } from '@prisma/client';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';

/**
 * Généralise l'ancienne logique inline de GET /timetable-slots/:id/students (LV2 uniquement) et
 * GetElevesLV2PourCreneauUseCase aux StudentGroup, pour tout créneau, quelle que soit la
 * dimension. Priorité de résolution (la plus spécifique d'abord) :
 * 1. Créneau électif A-Level (isElectiveSlot + subjectId) → élèves ayant cette matière dans leur
 *    sélection A-Level — mécanisme préexistant, inchangé.
 * 2. Le créneau porte un groupId (fan-out par StudentGroupSet, ex. LV2 généré via
 *    GenererSeancesGroupeUseCase) → membres de ce Group.
 * 3. Sinon, la matière cible un Group précis (subject.restrictedToGroupId, ex. English
 *    Literature → Bilingue) → membres de ce Group.
 * 4. Sinon, créneau LV2 legacy (isLV2Slot + subjectId, jamais migré vers groupId) →
 *    lv2SubjectId = subjectId — mécanisme préexistant, inchangé.
 * 5. Sinon → toute la classe.
 */
export interface EleveParticipant {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ResoudreParticipantsResultat {
  classId: string | null;
  subjectId: string | null;
  groupId: string | null;
  isLV2Slot: boolean;
  isElectiveSlot: boolean;
  label: string | null;
  eleves: EleveParticipant[];
  totalClasse: number;
}

export class ResoudreParticipantsSeanceUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(timetableSlotId: string, schoolId: string): Promise<ResoudreParticipantsResultat> {
    const slot = await this.prisma.timetableSlot.findUnique({
      where: { id: timetableSlotId },
      include: {
        timetable: { select: { schoolId: true, classId: true, academicYearId: true } },
        subject: { select: { id: true, name: true, restrictedToGroupId: true } },
      },
    });

    if (!slot) throw new Error('Créneau introuvable');
    if (slot.timetable.schoolId !== schoolId) throw new Error('Accès refusé');

    const classId = slot.timetable.classId;
    const academicYearId = slot.timetable.academicYearId;
    const isElective = slot.isElectiveSlot ?? false;
    const isLV2 = slot.isLV2Slot ?? false;

    const tousLesEleves = await this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', isActive: true, ...(classId ? whereElevesParClasse(classId) : {}) },
      select: {
        id: true, firstName: true, lastName: true,
        studentProfile: { select: { id: true, lv2SubjectId: true, alevelSubjects: { select: { subjectId: true } } } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    let eleves = tousLesEleves;
    let label: string | null = null;

    if (isElective && slot.subjectId) {
      eleves = tousLesEleves.filter(e =>
        (e.studentProfile?.alevelSubjects ?? []).some(a => a.subjectId === slot.subjectId)
      );
      label = slot.subject
        ? `A-Level — ${slot.subject.name} (${eleves.length} élèves sur ${tousLesEleves.length})`
        : null;
    } else {
      const groupeCible = slot.groupId ?? slot.subject?.restrictedToGroupId ?? null;
      if (groupeCible) {
        const membres = await this.prisma.studentGroupMembership.findMany({
          where: { groupId: groupeCible, academicYearId },
          select: { studentProfileId: true },
        });
        const profilIdsMembres = new Set(membres.map(m => m.studentProfileId));
        eleves = tousLesEleves.filter(e => e.studentProfile && profilIdsMembres.has(e.studentProfile.id));
      } else if (isLV2 && slot.subjectId) {
        eleves = tousLesEleves.filter(e => e.studentProfile?.lv2SubjectId === slot.subjectId);
        label = slot.subject
          ? `Cours LV2 — ${slot.subject.name} (${eleves.length} élèves sur ${tousLesEleves.length})`
          : null;
      }
    }

    return {
      classId,
      subjectId: slot.subjectId ?? null,
      groupId: slot.groupId ?? null,
      isLV2Slot: isLV2,
      isElectiveSlot: isElective,
      label,
      eleves: eleves.map(e => ({ id: e.id, firstName: e.firstName, lastName: e.lastName })),
      totalClasse: tousLesEleves.length,
    };
  }
}
