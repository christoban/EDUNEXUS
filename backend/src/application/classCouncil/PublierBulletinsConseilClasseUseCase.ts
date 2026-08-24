import type { ClassCouncilRepository } from '@domain/ports/repositories/ClassCouncilRepository';

export interface PublierBulletinsCommande {
  sessionId: string;
  schoolId: string;
}

export class PublierBulletinsConseilClasseUseCase {
  constructor(private readonly repo: ClassCouncilRepository) {}

  async execute(commande: PublierBulletinsCommande) {
    const session = await this.repo.obtenirSession(commande.sessionId, commande.schoolId);
    if (!session) throw new Error('Session introuvable');
    if (session.status !== 'LOCKED') {
      throw new Error('Le conseil doit être verrouillé avant de publier les bulletins');
    }

    const bulletins = await this.repo.publierBulletins(
      commande.sessionId,
      session.classId,
      commande.schoolId,
      session.academicPeriodId,
    );

    return {
      count: bulletins.length,
      message: `${bulletins.length} bulletin${bulletins.length !== 1 ? 's' : ''} publié${bulletins.length !== 1 ? 's' : ''}`,
      bulletins,
      periodName: session.academicPeriod?.name ?? 'cette période',
    };
  }
}
