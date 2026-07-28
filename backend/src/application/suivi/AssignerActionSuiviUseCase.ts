import type { StudentFollowUpRepository, FollowUpActionDetail } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { AppelantSuivi } from './CreerActionSuiviEleveUseCase';

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
  constructor(private readonly repo: StudentFollowUpRepository) {}

  async execute(cmd: AssignerActionSuiviCommande): Promise<FollowUpActionDetail> {
    const role = cmd.appelant.role.toUpperCase();
    const estCenseur = role === 'STAFF' && (cmd.appelant.permissions ?? []).includes('VALIDATE_GRADES');
    if (!estCenseur) {
      throw new Error('Seul le censeur peut réassigner une action de suivi');
    }

    const action = await this.repo.findById(cmd.actionId, cmd.appelant.schoolId);
    if (!action) throw new Error('Action de suivi introuvable');
    if (action.status === 'CLOS') throw new Error('Impossible de réassigner une action déjà clôturée');

    return this.repo.reassign(cmd.actionId, cmd.nouvelAssigneId);
  }
}
