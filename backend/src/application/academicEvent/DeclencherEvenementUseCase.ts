/**
 * APPLICATION LAYER — Déclenchement manuel d'un événement MANUAL_TRIGGER (Type 2).
 * Jamais automatique par construction : seul un administrateur (humain) déclenche, au moment
 * réel où le fait externe imprévisible se produit (ex. publication des résultats d'un examen).
 * Notifie immédiatement les rôles cibles à l'ouverture.
 */
import type { PrismaClient } from '@prisma/client';
import { notifierEvenementAcademique } from '../../utils/academicEventNotifier';
import { activerRessourceLieeSiApplicable } from './activerRessourceLiee';

export interface DeclencherEvenementCommande {
  eventId: string;
  schoolId: string;
  declencheParId: string;
  // Date de clôture au moment du déclenchement — la date d'ouverture d'un MANUAL_TRIGGER n'est
  // jamais connue à l'avance (voir Type 2), donc la clôture ne peut être fixée qu'ici, pas à la
  // création. Requis si le type d'événement ouvre une ressource liée (ex. CHOIX_LV2).
  closeDate?: Date;
}

export class DeclencherEvenementUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: DeclencherEvenementCommande): Promise<{ id: string }> {
    const evenement = await this.prisma.academicEvent.findFirst({
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
    const closeDate = cmd.closeDate ?? evenement.closeDate ?? null;

    // Ouvre la ressource réelle AVANT de faire passer l'événement à ACTIVE — si ça échoue,
    // l'événement reste UPCOMING plutôt que de mentir sur son propre statut.
    const linkedResourceId = await activerRessourceLieeSiApplicable(this.prisma, {
      id: evenement.id, schoolId: cmd.schoolId, type: evenement.type,
      level: evenement.level, openDate: maintenant, closeDate,
    });

    await this.prisma.academicEvent.update({
      where: { id: cmd.eventId },
      data: {
        status: 'ACTIVE',
        openDate: maintenant,
        closeDate,
        triggeredById: cmd.declencheParId,
        triggeredAt: maintenant,
        linkedResourceId,
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
