/**
 * APPLICATION LAYER — Use Case : Valider les bulletins d'une classe
 * L'admin ou un staff avec VALIDATE_GRADES valide la session de soumission.
 */
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinValidationRepository } from '@domain/ports/repositories/BulletinValidationRepository';

export interface ValiderBulletinsCommande {
  schoolId: string;
  sessionId: string;
  demandeurId: string;
  demandeurRole: string;
  demandeurPermissions?: string[];
}

export class ValiderBulletinsClasseUseCase {
  constructor(
    private readonly bulletinValidationRepository: BulletinValidationRepository,
    private readonly bulletinRepository: BulletinRepository,
  ) {}

  async execute(commande: ValiderBulletinsCommande) {
    const { schoolId, sessionId, demandeurId, demandeurRole, demandeurPermissions } = commande;

    // 1. Autorisation : ADMIN ou VALIDATE_GRADES
    const role = demandeurRole.toUpperCase();
    const hasPermission = (demandeurPermissions ?? []).includes('VALIDATE_GRADES');
    if (role !== 'ADMIN' && !hasPermission) {
      throw new Error('Permission VALIDATE_GRADES requise pour valider les bulletins');
    }

    // 2. Charger la session
    const session = await this.bulletinValidationRepository.obtenirSession(sessionId, schoolId);
    if (!session) {
      throw new Error('Session de validation introuvable');
    }

    // 3. Garde : statut SUBMITTED
    if (session.status !== 'SUBMITTED') {
      throw new Error(
        `Impossible de valider : statut actuel "${session.status}". La session doit être en SUBMITTED.`
      );
    }

    // 4. Valider la session et mettre à jour le workflow
    const updated = await this.bulletinValidationRepository.validerSession(sessionId, demandeurId);

    await this.bulletinRepository.majStatutWorkflowParClasse(
      session.classId,
      session.academicPeriodId,
      schoolId,
      'VALIDATED',
    );

    return { session: updated };
  }
}