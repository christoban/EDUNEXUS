import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';
import { logActivity } from '../../infrastructure/services/audit/ActivityLogService';

export interface VerrouillerCommande {
  sessionId: string;
  schoolId: string;
  userId: string;
}

export class VerrouillerConseilClasseUseCase {
  constructor(private readonly repo: ClassCouncilRepository) {}

  async execute(commande: VerrouillerCommande) {
    const session = await this.repo.obtenirSession(commande.sessionId, commande.schoolId);
    if (!session) throw new Error('Session introuvable');
    if (session.status === 'LOCKED') throw new Error('Session déjà verrouillée');

    const decisionCount = await this.repo.compterDecisions(commande.sessionId);
    if (decisionCount === 0) throw new Error('Impossible de verrouiller une session sans décisions');

    const updated = await this.repo.verrouillerSession(commande.sessionId);

    logActivity({
      userId: commande.userId,
      schoolId: commande.schoolId,
      action: 'Class council session locked',
      details: `Session ${commande.sessionId}`,
    }).catch(() => {});

    return { session: updated, message: 'Session verrouillée' };
  }
}
