import type { PrismaClient } from '@prisma/client';
import type { StudentFollowUpRepository, FollowUpActionDetail } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { AppelantSuivi } from './CreerActionSuiviEleveUseCase';
import { PERMISSIONS_CONSEILLER } from './CreerActionSuiviEleveUseCase';

export interface AssignerActionSuiviCommande {
  appelant: AppelantSuivi;
  actionId: string;
  nouvelAssigneId: string;
}

/**
 * Rôle autorisé (B.4) : Censeur uniquement — cas secondaire de réattribution.
 * Revérifié contre la spec exacte et définitive (relecture juillet 2026) qui retire au Censeur
 * toute capacité de CRÉATION d'action (observation/entretien/convocation/signalement, voir
 * CreerActionSuiviEleveUseCase) : réassigner n'est pas créer une nouvelle action, c'est une
 * capacité administrative de dispatch cohérente avec son rôle de supervision d'ensemble
 * ("notifié seulement... aucune action déclenchable" concerne les 4 types d'action de suivi, pas
 * la réattribution d'un cas déjà signalé par le PP vers un autre conseiller). Volontairement pas
 * changé.
 */
export class AssignerActionSuiviUseCase {
  constructor(
    private readonly repo: StudentFollowUpRepository,
    private readonly prisma: PrismaClient,
  ) {}

  async execute(cmd: AssignerActionSuiviCommande): Promise<FollowUpActionDetail> {
    const role = cmd.appelant.role.toUpperCase();
    const estCenseur = role === 'STAFF' && (cmd.appelant.permissions ?? []).includes('VALIDATE_GRADES');
    if (!estCenseur) {
      throw new Error('Seul le censeur peut réassigner une action de suivi');
    }

    const action = await this.repo.findById(cmd.actionId, cmd.appelant.schoolId);
    if (!action) throw new Error('Action de suivi introuvable');
    if (action.status === 'CLOS') throw new Error('Impossible de réassigner une action déjà clôturée');

    // nouvelAssigneId vient du corps de la requête — jamais fait confiance sans vérification :
    // même contrôle que CreerActionSuiviEleveUseCase (SIGNALEMENT_CONSEILLER) pour éviter de
    // réattribuer un cas à un utilisateur non-conseiller ou d'une autre école, qui hériterait
    // alors de la capacité "conseiller escaladé" et recevrait une notification exposant le nom de
    // l'élève (trouvé en revue de code — même classe de vulnérabilité que la création).
    const destinataireValide = await this.prisma.staffProfile.findFirst({
      where: {
        userId: cmd.nouvelAssigneId,
        schoolId: cmd.appelant.schoolId,
        permissions: { some: { permission: { in: [...PERMISSIONS_CONSEILLER] } } },
      },
      select: { id: true },
    });
    if (!destinataireValide) {
      throw new Error('Le nouveau destinataire n\'est pas un conseiller pédagogique valide de votre établissement');
    }

    return this.repo.reassign(cmd.actionId, cmd.nouvelAssigneId);
  }
}
