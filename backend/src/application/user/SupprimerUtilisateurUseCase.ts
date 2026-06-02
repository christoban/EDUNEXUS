/**
 * APPLICATION LAYER — Use Case : Supprimer un utilisateur
 * Logique extraite de controllers/user.ts → deleteUser handler
 * Suppression complète en transaction (9 opérations selon l'analyse).
 */
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export class SupprimerUtilisateurUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(params: {
    userId: string;
    schoolId: string;
    demandeurRole: string;
  }): Promise<void> {
    if (params.demandeurRole !== 'ADMIN') {
      throw new Error('Seul un Admin peut supprimer un utilisateur');
    }

    const user = await this.userRepository.findById(params.userId);
    if (!user) throw new Error('Utilisateur introuvable');

    if (user.schoolId !== params.schoolId) {
      throw new Error('Accès refusé : utilisateur hors de votre établissement');
    }

    // La suppression en cascade (attendance, grades, etc.)
    // est gérée dans l'adapter Prisma via une transaction
    await this.userRepository.supprimerAvecCascade(params.userId);
  }
}
