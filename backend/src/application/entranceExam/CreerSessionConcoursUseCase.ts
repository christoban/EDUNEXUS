import type { PrismaClient } from '@prisma/client';
import type { CreerSessionConcoursCommande } from './types';
import { notifierEvenementAcademique } from '../../utils/academicEventNotifier';

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

    // Le statut réel de la session (pas un AcademicEvent séparé) pilote la visibilité du menu
    // « Concours d'entrée » — voir gating côté frontend. La notification accompagne ce
    // changement de visibilité, elle ne le remplace pas.
    void notifierEvenementAcademique(
      this.prisma, cmd.schoolId, ['ADMIN', 'STAFF'],
      'Concours d\'entrée en 6e ouvert',
      `La session « ${cmd.name} » est créée — le menu Concours d'entrée est maintenant accessible.`,
    ).catch((err) => console.error('[EntranceExam] notification ouverture:', err?.message));

    return { sessionId: session.id };
  }
}
