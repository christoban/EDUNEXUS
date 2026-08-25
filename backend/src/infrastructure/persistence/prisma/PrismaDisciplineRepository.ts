import type { PrismaClient, Prisma, DisciplineType } from '@prisma/client';
import type { DisciplineRepository, DisciplineSessionData, DisciplineRecordData } from '@domain/ports/repositories/DisciplineRepository';

export class PrismaDisciplineRepository implements DisciplineRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async verifierEleve(studentId: string, schoolId: string): Promise<boolean> {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, schoolId, role: 'STUDENT' },
      select: { id: true },
    });
    return !!student;
  }

  async creerSession(data: {
    schoolId: string;
    studentId: string;
    presidedById: string;
    motif: string;
    composition: unknown;
    parentNotifiedAt: Date;
    scheduledAt: Date;
  }): Promise<DisciplineSessionData> {
    return this.prisma.disciplineCouncilSession.create({
      data: {
        schoolId: data.schoolId,
        studentId: data.studentId,
        presidedById: data.presidedById,
        motif: data.motif,
        composition: data.composition as Prisma.InputJsonValue,
        parentNotifiedAt: data.parentNotifiedAt,
        scheduledAt: data.scheduledAt,
      },
    });
  }

  async trouverSession(id: string, schoolId: string): Promise<DisciplineSessionData | null> {
    return this.prisma.disciplineCouncilSession.findFirst({
      where: { id, schoolId },
    });
  }

  async creerRecord(data: {
    schoolId: string;
    studentId: string;
    type: string;
    reason: string;
    decidedById: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<DisciplineRecordData> {
    return this.prisma.disciplineRecord.create({
      data: {
        schoolId: data.schoolId,
        studentId: data.studentId,
        type: data.type as DisciplineType,
        reason: data.reason,
        decidedById: data.decidedById,
        ...(data.startDate ? { startDate: data.startDate } : {}),
        ...(data.endDate ? { endDate: data.endDate } : {}),
      },
    });
  }

  async mettreAJourSession(id: string, data: {
    heldAt: Date;
    decision: string;
    pv: string;
    status: string;
    disciplineRecordId: string;
  }): Promise<DisciplineSessionData & { disciplineRecord: DisciplineRecordData | null }> {
    return this.prisma.disciplineCouncilSession.update({
      where: { id },
      data: data as any,
      include: { disciplineRecord: true },
    }) as any;
  }
}
