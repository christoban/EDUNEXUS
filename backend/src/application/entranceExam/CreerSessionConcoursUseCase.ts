import type { PrismaClient } from '@prisma/client';
import type { CreerSessionConcoursCommande } from './types';

export class CreerSessionConcoursUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerSessionConcoursCommande): Promise<{ sessionId: string }> {
    const session = await (this.prisma as any).entranceExamSession.create({
      data: {
        schoolId: cmd.schoolId,
        name: cmd.name,
        examDate: cmd.examDate,
        academicYearId: cmd.academicYearId,
        admissionThreshold: cmd.admissionThreshold ?? null,
        availableSeats: cmd.availableSeats ?? null,
        status: 'DRAFT',
      },
    });
    return { sessionId: session.id };
  }
}
