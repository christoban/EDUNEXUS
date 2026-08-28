import type { PrismaClient, EntranceExamStatus as EntranceExamStatusPrisma, AdmissionStatus, CepResult } from '@prisma/client';
import type {
  EntranceExamRepository,
  EntranceSessionData,
  EntranceCandidateData,
  EntranceExamStatus,
  EntranceAdmissionStatus,
  EntranceCepResult,
} from '@domain/ports/repositories/EntranceExamRepository';

export class PrismaEntranceExamRepository implements EntranceExamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listerSessions(schoolId: string): Promise<EntranceSessionData[]> {
    return this.prisma.entranceExamSession.findMany({
      where: { schoolId },
      orderBy: { createdAt: 'desc' },
    }) as Promise<EntranceSessionData[]>;
  }

  async trouverSession(sessionId: string): Promise<EntranceSessionData | null> {
    return this.prisma.entranceExamSession.findUnique({ where: { id: sessionId } }) as Promise<EntranceSessionData | null>;
  }

  async creerSession(data: {
    schoolId: string;
    name: string;
    examDate: Date;
    academicYearId: string;
    admissionThreshold?: number | null;
    availableSeats?: number | null;
  }): Promise<EntranceSessionData> {
    return this.prisma.entranceExamSession.create({
      data: {
        schoolId: data.schoolId,
        name: data.name,
        examDate: data.examDate,
        academicYearId: data.academicYearId,
        admissionThreshold: data.admissionThreshold ?? null,
        availableSeats: data.availableSeats ?? null,
        status: 'DRAFT',
      },
    }) as Promise<EntranceSessionData>;
  }

  async mettreAJourStatutSession(sessionId: string, status: EntranceExamStatus): Promise<void> {
    await this.prisma.entranceExamSession.update({
      where: { id: sessionId },
      data: { status: status as EntranceExamStatusPrisma },
    });
  }

  async compterCandidatsEnAttente(sessionId: string): Promise<number> {
    return this.prisma.entranceExamCandidate.count({
      where: { sessionId, admissionStatus: { in: ['PENDING', 'ADMIS_PROVISOIRE'] } },
    });
  }

  async creerCandidat(data: {
    sessionId: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: Date | null;
    originSchool?: string | null;
    examScore?: number | null;
    parentPhone?: string | null;
  }): Promise<{ id: string }> {
    return this.prisma.entranceExamCandidate.create({
      data: {
        sessionId: data.sessionId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ?? null,
        originSchool: data.originSchool ?? null,
        examScore: data.examScore ?? null,
        parentPhone: data.parentPhone ?? null,
        admissionStatus: 'PENDING',
        cepResult: 'NON_PASSE',
      },
      select: { id: true },
    });
  }

  async listerCandidats(sessionId: string, options?: { avecNote?: boolean; orderBy?: 'score' | 'nom' }): Promise<EntranceCandidateData[]> {
    return this.prisma.entranceExamCandidate.findMany({
      where: {
        sessionId,
        ...(options?.avecNote ? { examScore: { not: null } } : {}),
      },
      orderBy: options?.orderBy === 'score'
        ? { examScore: 'desc' }
        : { lastName: 'asc' },
    }) as Promise<EntranceCandidateData[]>;
  }

  async trouverCandidatAvecSession(candidateId: string): Promise<EntranceCandidateData | null> {
    return this.prisma.entranceExamCandidate.findUnique({
      where: { id: candidateId },
      include: { session: true },
    }) as Promise<EntranceCandidateData | null>;
  }

  async mettreAJourResultatCEP(candidateId: string, data: { cepResult: EntranceCepResult; admissionStatus: EntranceAdmissionStatus }): Promise<void> {
    await this.prisma.entranceExamCandidate.update({
      where: { id: candidateId },
      data: {
        cepResult: data.cepResult as CepResult,
        cepResultDate: new Date(),
        admissionStatus: data.admissionStatus as AdmissionStatus,
      },
    });
  }

  async mettreAJourStatutAdmission(candidateId: string, admissionStatus: EntranceAdmissionStatus): Promise<void> {
    await this.prisma.entranceExamCandidate.update({
      where: { id: candidateId },
      data: { admissionStatus: admissionStatus as AdmissionStatus },
    });
  }

  async trouverClasseNiveau(schoolId: string, niveau: string): Promise<{ id: string } | null> {
    const classes = await this.prisma.class.findMany({
      where: { schoolId, level: { contains: niveau } },
      orderBy: { name: 'asc' },
      take: 1,
    });
    return classes[0] ? { id: classes[0].id } : null;
  }
}