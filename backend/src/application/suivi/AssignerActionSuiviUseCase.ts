import type { StudentFollowUpRepository, FollowUpActionDetail } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { AppelantSuivi } from './CreerActionSuiviEleveUseCase';

export interface AssignerActionSuiviCommande {
  appelant: AppelantSuivi;
  actionId: string;
  nouvelAssigneId: string;
}

/** Rôle autorisé (B.4) : Censeur uniquement — cas secondaire de réattribution. */
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
