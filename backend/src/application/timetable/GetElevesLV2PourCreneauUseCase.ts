import type { PrismaClient } from '@prisma/client';

export interface EleveLV2 {
  id: string;
  firstName: string;
  lastName: string;
  lv2SubjectId: string | null;
}

export interface GetElevesLV2ResultatSlot {
  isLV2Slot: boolean;
  subjectId: string | null;
  classId: string | null;
  eleves: EleveLV2[];
  totalClasse: number;
}

export class GetElevesLV2PourCreneauUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(timetableSlotId: string, schoolId: string): Promise<GetElevesLV2ResultatSlot> {
    const slot = await this.prisma.timetableSlot.findUnique({
      where: { id: timetableSlotId },
      include: { timetable: { select: { schoolId: true, classId: true } } },
    });

    if (!slot) throw new Error('Créneau introuvable');
    if (slot.timetable.schoolId !== schoolId) throw new Error('Accès refusé');

    const classId = slot.timetable.classId;

    const tousLesEleves: EleveLV2[] = await this.prisma.user.findMany({
      where: {
        schoolId,
        role: 'STUDENT',
        isActive: true,
        studentProfile: { classId },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentProfile: { select: { lv2SubjectId: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }).then((users: any[]) => users.map((u: any) => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      lv2SubjectId: u.studentProfile?.lv2SubjectId ?? null,
    })));

    const isLV2 = slot.isLV2Slot ?? false;

    // Si slot LV2 : ne retourner que les élèves dont lv2SubjectId = slot.subjectId
    const eleves = isLV2 && slot.subjectId
      ? tousLesEleves.filter(e => e.lv2SubjectId === slot.subjectId)
      : tousLesEleves;

    return {
      isLV2Slot: isLV2,
      subjectId: slot.subjectId ?? null,
      classId,
      eleves,
      totalClasse: tousLesEleves.length,
    };
  }
}
