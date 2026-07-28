import type { StudentFollowUpRepository, FollowUpActionDetail } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { AppelantSuivi } from './CreerActionSuiviEleveUseCase';

/**
 * "Mes actions de suivi" (B.5.2) — étend volontairement B.4 au-delà de "Censeur, Conseiller
 * pédagogique" : un Professeur principal ou un enseignant de matière qui crée une action
 * s'assigne lui-même par défaut (voir CreerActionSuiviEleveUseCase) et doit pouvoir la retrouver
 * pour la clôturer, sinon elle reste indéfiniment invisible malgré B.5.2 ("assignées à
 * l'utilisateur connecté", sans restriction de rôle). Seul le Censeur (VALIDATE_GRADES) garde la
 * portée "tout l'établissement" explicitement décrite dans le tableau de B.4 — les autres rôles
 * ne voient que les leurs.
 */
export class ListerActionsEnCoursUseCase {
  constructor(private readonly repo: StudentFollowUpRepository) {}

  async execute(appelant: AppelantSuivi): Promise<FollowUpActionDetail[]> {
    const role = appelant.role.toUpperCase();
    const perms = appelant.permissions ?? [];

    if (role === 'STAFF' && perms.includes('VALIDATE_GRADES')) {
      return this.repo.listOpen(appelant.schoolId, {}); // Censeur — vue établissement
    }

    if (role === 'TEACHER' || (role === 'STAFF' && (perms.includes('MANAGE_ORIENTATION') || perms.includes('MANAGE_PEDAGOGICAL_BRIEF')))) {
      return this.repo.listOpen(appelant.schoolId, { assignedToId: appelant.userId });
    }

    throw new Error('Vous n\'avez pas accès aux actions de suivi');
  }
}
