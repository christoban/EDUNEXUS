import type { PrismaClient, CouncilDecision } from '@prisma/client';
import type { ClassCouncilRepository, ClassCouncilSessionData, ClassCouncilDecisionData } from '@domain/ports/repositories/ClassCouncilRepository';

export class PrismaClassCouncilRepository implements ClassCouncilRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async sessionVerrouilleeExiste(classId: string, academicPeriodId: string): Promise<boolean> {
    const count = await this.prisma.classCouncilSession.count({
      where: { classId, academicPeriodId, status: 'LOCKED' },
    });
    return count > 0;
  }

  async listerSessions(schoolId: string, filters?: { classId?: string; academicPeriodId?: string }): Promise<ClassCouncilSessionData[]> {
    return this.prisma.classCouncilSession.findMany({
      where: {
        schoolId,
        ...(filters?.classId ? { classId: filters.classId } : {}),
        ...(filters?.academicPeriodId ? { academicPeriodId: filters.academicPeriodId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        academicPeriod: { select: { id: true, name: true } },
        _count: { select: { decisions: true } },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ClassCouncilSessionData[]>;
  }

  async obtenirSession(sessionId: string, schoolId: string): Promise<ClassCouncilSessionData | null> {
    return this.prisma.classCouncilSession.findFirst({
      where: { id: sessionId, schoolId },
      include: {
        class: { select: { id: true, name: true, level: true } },
        academicPeriod: { select: { id: true, name: true, orderIndex: true, academicYear: { select: { name: true } } } },
        presidedBy: { select: { id: true, firstName: true, lastName: true } },
        decisions: {
          include: { student: { select: { id: true, firstName: true, lastName: true, studentProfile: { select: { healthScore: true } } } } },
          orderBy: { student: { lastName: 'asc' } },
        },
        school: { select: { name: true, city: true, phone: true } },
      },
    }) as Promise<ClassCouncilSessionData | null>;
  }

  async obtenirConfigAlertes(schoolId: string): Promise<{ aiRiskThreshold: number; aiRiskThresholdCritical: number } | null> {
    return this.prisma.schoolConfig
      .findUnique({ where: { schoolId }, select: { aiRiskThreshold: true, aiRiskThresholdCritical: true } })
      .catch(() => null);
  }

  async obtenirEnfantsParent(userId: string): Promise<string[]> {
    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId },
      include: { children: { include: { studentProfile: true } } },
    });
    return (parentProfile?.children ?? [])
      .map(c => c.studentProfile?.userId)
      .filter((id): id is string => Boolean(id));
  }

  async creerSession(data: { schoolId: string; classId: string; academicPeriodId: string; presidedById: string }): Promise<ClassCouncilSessionData> {
    return this.prisma.classCouncilSession.create({
      data: { ...data, status: 'OPEN' },
      include: {
        class: { select: { id: true, name: true } },
        academicPeriod: { select: { id: true, name: true } },
        presidedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    }) as Promise<ClassCouncilSessionData>;
  }

  async preRemplirDecisions(sessionId: string, studentIds: string[]): Promise<void> {
    if (studentIds.length === 0) return;
    await this.prisma.classCouncilDecision.createMany({
      data: studentIds.map(studentId => ({
        sessionId,
        studentId,
        decision: 'DELIBERATION' as CouncilDecision,
        observations: null,
      })),
      skipDuplicates: true,
    });
  }

  async upsertDecision(sessionId: string, studentId: string, decision: CouncilDecision, observations?: string | null): Promise<ClassCouncilDecisionData> {
    return this.prisma.classCouncilDecision.upsert({
      where: { sessionId_studentId: { sessionId, studentId } },
      create: { sessionId, studentId, decision, observations: observations ?? null },
      update: { decision, observations: observations ?? null },
      include: { student: { select: { id: true, firstName: true, lastName: true } } },
    }) as Promise<ClassCouncilDecisionData>;
  }

  async upsertDecisionsEnBloc(sessionId: string, decisions: { studentId: string; decision: CouncilDecision; observations?: string | null }[]): Promise<number> {
    const results = await Promise.all(
      decisions.map(d =>
        this.prisma.classCouncilDecision.upsert({
          where: { sessionId_studentId: { sessionId, studentId: d.studentId } },
          create: { sessionId, studentId: d.studentId, decision: d.decision, observations: d.observations ?? null },
          update: { decision: d.decision, observations: d.observations ?? null },
        })
      )
    );
    return results.length;
  }

  async verrouillerSession(sessionId: string): Promise<ClassCouncilSessionData> {
    return this.prisma.classCouncilSession.update({
      where: { id: sessionId },
      data: { status: 'LOCKED', validatedAt: new Date() },
    }) as Promise<ClassCouncilSessionData>;
  }

  async publierBulletins(_sessionId: string, classId: string, schoolId: string, academicPeriodId: string): Promise<{ id: string; studentId: string; student: { firstName: string; lastName: string } }[]> {
    const bulletins = await this.prisma.reportCard.findMany({
      where: {
        schoolId,
        academicPeriodId,
        validationStatus: 'GENERATED',
        student: {
          studentProfile: {
            enrollmentsYearScoped: {
              some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
            },
          },
        },
      },
      select: { id: true, studentId: true, student: { select: { firstName: true, lastName: true } } },
    });

    if (bulletins.length > 0) {
      await this.prisma.reportCard.updateMany({
        where: { id: { in: bulletins.map(b => b.id) } },
        data: { validationStatus: 'SENT' },
      });
    }

    return bulletins;
  }

  async compterNotesNonValidees(schoolId: string, classId: string, academicPeriodId: string): Promise<number> {
    return this.prisma.grade.count({
      where: {
        schoolId,
        classId,
        sequence: { academicPeriodId },
        validationStatus: { notIn: ['VALIDATED', 'LOCKED'] },
      },
    });
  }

  async classeExiste(classId: string, schoolId: string): Promise<{ id: string; name: string } | null> {
    return this.prisma.class.findFirst({
      where: { id: classId, schoolId },
      select: { id: true, name: true },
    });
  }

  async sessionExistente(classId: string, academicPeriodId: string): Promise<ClassCouncilSessionData | null> {
    return this.prisma.classCouncilSession.findFirst({
      where: { classId, academicPeriodId },
    }) as Promise<ClassCouncilSessionData | null>;
  }

  async compterDecisions(sessionId: string): Promise<number> {
    return this.prisma.classCouncilDecision.count({ where: { sessionId } });
  }

  async eleveDansClasse(studentId: string, classId: string): Promise<boolean> {
    const count = await this.prisma.studentProfile.count({
      where: {
        userId: studentId,
        enrollmentsYearScoped: {
          some: { classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
        },
      },
    });
    return count > 0;
  }
}
