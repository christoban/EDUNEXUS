import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';

export interface VerrouillerCommande {
  sessionId: string;
  schoolId: string;
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
    return { session: updated, message: 'Session verrouillée' };
  }
}
