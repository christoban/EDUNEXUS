import type { PrismaClient } from '@prisma/client';
import type {
  PromotionRepository,
  ClassPromotionMapping,
  DecisionConseil,
  PromotionEleveParams,
} from '@domain/ports/repositories/PromotionRepository';

export class PrismaPromotionRepository implements PromotionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findMappingsPromotion(
    schoolId: string,
    academicYearId: string
  ): Promise<ClassPromotionMapping[]> {
    const data = await this.prisma.classPromotion.findMany({
      where: { schoolId, academicYearId },
      select: { fromClassId: true, toClassId: true },
    });
    return data;
  }

  async findDecisionsEleves(
    schoolId: string,
    academicYearId: string
  ): Promise<DecisionConseil[]> {
    const periodes = await this.prisma.academicPeriod.findMany({
      where: { academicYearId },
      select: { id: true },
    });
    const periodeIds = periodes.map(p => p.id);

    const sessions = await this.prisma.classCouncilSession.findMany({
      where: { schoolId, academicPeriodId: { in: periodeIds } },
      select: { id: true, classId: true },
    });
    const sessionIds = sessions.map(s => s.id);
    const sessionClassMap = new Map(sessions.map(s => [s.id, s.classId]));

    const decisions = await this.prisma.classCouncilDecision.findMany({
      where: { sessionId: { in: sessionIds } },
      select: { studentId: true, sessionId: true, decision: true },
    });

    return decisions.map(d => ({
      studentId: d.studentId,
      fromClassId: sessionClassMap.get(d.sessionId) ?? '',
      decision: d.decision as 'PASS' | 'REPEAT' | 'DELIBERATION',
    }));
  }

  async promouvoirEleve(params: PromotionEleveParams): Promise<void> {
    await this.prisma.studentPromotion.upsert({
      where: {
        studentId_academicYearId: {
          studentId: params.studentId,
          academicYearId: params.academicYearId,
        },
      },
      create: {
        id: crypto.randomUUID(),
        schoolId: params.schoolId,
        studentId: params.studentId,
        fromClassId: params.fromClassId,
        toClassId: params.toClassId,
        academicYearId: params.academicYearId,
        promotedById: params.promotedById,
        promotedAt: new Date(),
      },
      update: {
        toClassId: params.toClassId,
        promotedById: params.promotedById,
        promotedAt: new Date(),
      },
    });
  }

  async mettreAJourClasseEleve(studentId: string, newClassId: string): Promise<void> {
    await this.prisma.studentProfile.update({
      where: { userId: studentId },
      data: { classId: newClassId },
    });
  }

  async countPromotions(
    schoolId: string,
    academicYearId: string
  ): Promise<{ promus: number; redoublants: number }> {
    const promotions = await this.prisma.studentPromotion.findMany({
      where: { schoolId, academicYearId },
      select: { fromClassId: true, toClassId: true },
    });
    const promus = promotions.filter(p => p.fromClassId !== p.toClassId).length;
    const redoublants = promotions.filter(p => p.fromClassId === p.toClassId).length;
    return { promus, redoublants };
  }
}
