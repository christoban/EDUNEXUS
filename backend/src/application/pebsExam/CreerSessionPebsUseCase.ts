import type { PrismaClient } from '@prisma/client';
import type { CreerSessionPebsCommande } from './types';

export class CreerSessionPebsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerSessionPebsCommande): Promise<{ sessionId: string }> {
    // Vérifier que la classe cible existe et appartient à l'école
    const targetClass = await this.prisma.class.findFirst({
      where: { id: cmd.targetClassId, schoolId: cmd.schoolId },
    });
    if (!targetClass) throw new Error('Classe cible introuvable');

    const session = await (this.prisma as any).pebsExamSession.create({
      data: {
        schoolId: cmd.schoolId,
        name: cmd.name,
        examDate: cmd.examDate,
        level: cmd.level,
        academicYearId: cmd.academicYearId,
        selectionThreshold: cmd.selectionThreshold ?? null,
        availableSeats: cmd.availableSeats ?? null,
        targetClassId: cmd.targetClassId,
        status: 'DRAFT',
      },
    });
    return { sessionId: session.id };
  }
}
