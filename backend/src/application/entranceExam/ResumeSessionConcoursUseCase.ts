import type { PrismaClient } from '@prisma/client';
import type { SessionSummary } from './types';

export class ResumeSessionConcoursUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(schoolId: string, sessionId: string): Promise<SessionSummary> {
    const session = await (this.prisma as any).entranceExamSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new Error('Session de concours introuvable');
    if (session.schoolId !== schoolId) throw new Error('Accès refusé');

    const candidates: any[] = await (this.prisma as any).entranceExamCandidate.findMany({
      where: { sessionId },
      orderBy: { lastName: 'asc' },
    });

    const pending = candidates.filter(c => c.admissionStatus === 'PENDING').length;
    const admisProvisoire = candidates.filter(c => c.admissionStatus === 'ADMIS_PROVISOIRE').length;
    const confirms = candidates.filter(c => c.admissionStatus === 'CONFIRME').length;
    const annules = candidates.filter(c => c.admissionStatus === 'ANNULE').length;
    const cepPending = candidates.filter(c => c.admissionStatus === 'ADMIS_PROVISOIRE' && (c.cepResult === 'NON_PASSE' || c.cepResult === null)).length;

    return {
      session: {
        id: session.id,
        name: session.name,
        status: session.status,
        examDate: session.examDate,
        admissionThreshold: session.admissionThreshold,
        availableSeats: session.availableSeats,
      },
      total: candidates.length,
      pending,
      admisProvisoire,
      confirms,
      annules,
      cepPending,
      candidates: candidates.map(c => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        examScore: c.examScore,
        admissionStatus: c.admissionStatus,
        cepResult: c.cepResult,
        cepResultDate: c.cepResultDate,
        studentProfileId: c.studentProfileId,
      })),
    };
  }
}
