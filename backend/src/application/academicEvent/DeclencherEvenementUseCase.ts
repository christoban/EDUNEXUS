/**
 * APPLICATION LAYER — Déclenchement manuel d'un événement MANUAL_TRIGGER (Type 2).
 * Jamais automatique par construction : seul un administrateur (humain) déclenche, au moment
 * réel où le fait externe imprévisible se produit (ex. publication des résultats d'un examen).
 * Notifie immédiatement les rôles cibles à l'ouverture.
 */
import type { PrismaClient } from '@prisma/client';
import { notifierEvenementAcademique } from '../../utils/academicEventNotifier';

export interface DeclencherEvenementCommande {
  eventId: string;
  schoolId: string;
  declencheParId: string;
}

export class DeclencherEvenementUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: DeclencherEvenementCommande): Promise<{ id: string }> {
    const evenement = await (this.prisma as any).academicEvent.findFirst({
      where: { id: cmd.eventId, schoolId: cmd.schoolId },
    });
    if (!evenement) throw new Error('Événement introuvable');
    if (evenement.category !== 'MANUAL_TRIGGER') {
      throw new Error('Seuls les événements à déclenchement manuel peuvent être ouverts de cette façon.');
    }
    if (evenement.status !== 'UPCOMING') {
      throw new Error('Cet événement est déjà ouvert ou clôturé.');
    }

    const maintenant = new Date();
    await (this.prisma as any).academicEvent.update({
      where: { id: cmd.eventId },
      data: {
        status: 'ACTIVE',
        openDate: maintenant,
        triggeredById: cmd.declencheParId,
        triggeredAt: maintenant,
      },
    });

    await notifierEvenementAcademique(
      this.prisma,
      cmd.schoolId,
      evenement.targetRoles,
      evenement.title,
      evenement.description ?? `« ${evenement.title} » est désormais ouvert.`,
    );

    return { id: cmd.eventId };
  }
}
