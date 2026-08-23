import type { PrismaClient } from '@prisma/client';
import type { CreerSessionPebsCommande } from './types';
import { notifierEvenementAcademique } from '@infrastructure/services/notification/AcademicEventNotificationService';

export class CreerSessionPebsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerSessionPebsCommande): Promise<{ sessionId: string }> {
    // Vérifier que la classe cible existe et appartient à l'école
    const targetClass = await this.prisma.class.findFirst({
      where: { id: cmd.targetClassId, schoolId: cmd.schoolId },
    });
    if (!targetClass) throw new Error('Classe cible introuvable');

    const session = await this.prisma.pebsExamSession.create({
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

    void notifierEvenementAcademique(
      this.prisma, cmd.schoolId, ['ADMIN', 'STAFF'],
      'Sélection PEBS ouverte',
      `La session « ${cmd.name} » (niveau ${cmd.level}) est créée — le menu Sélection PEBS est maintenant accessible.`,
    ).catch((err) => console.error('[PebsExam] notification ouverture:', err?.message));

    return { sessionId: session.id };
  }
}
