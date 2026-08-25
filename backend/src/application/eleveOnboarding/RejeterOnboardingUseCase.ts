/**
 * APPLICATION — Use case : Rejeter un onboarding élève (doublon, erreur de saisie, etc.)
 */
import type { EleveOnboardingRepository } from '@domain/ports/repositories/EleveOnboardingRepository';
import { logActivity } from '../../infrastructure/services/audit/ActivityLogService';
import { peutTransitionnerDepuisPendingValidation } from './rules';
import type { RejeterOnboardingCommande, RejeterOnboardingResultat } from './types';

export class RejeterOnboardingUseCase {
  constructor(private readonly eleveOnboardingRepository: EleveOnboardingRepository) {}

  async execute(cmd: RejeterOnboardingCommande): Promise<RejeterOnboardingResultat> {
    if (!cmd.rejectionReason?.trim()) throw new Error('Un motif de rejet est requis');

    const onboarding = await this.eleveOnboardingRepository.findOnboardingById(cmd.onboardingId, cmd.schoolId);
    if (!onboarding) throw new Error('Dossier introuvable');
    if (!peutTransitionnerDepuisPendingValidation(onboarding.status)) {
      throw new Error(`Ce dossier ne peut pas être rejeté depuis son statut actuel (${onboarding.status}) — seul PENDING_VALIDATION peut être rejeté`);
    }

    const settings = await this.eleveOnboardingRepository.findSettings(cmd.schoolId);
    const responsableRole = settings?.responsableRole ?? 'ADMIN';
    if (cmd.validatorRole !== responsableRole) {
      throw new Error(`Seul un utilisateur avec le rôle ${responsableRole} peut rejeter ce dossier`);
    }

    await this.eleveOnboardingRepository.rejeterOnboarding(onboarding.id, {
      rejectionReason: cmd.rejectionReason,
      rejectedById: cmd.rejectedById,
      rejectedAt: new Date(),
    });

    // Rejet d'un dossier GROUPE_TRANSFERT : l'Admin cible avait déjà accepté la demande de
    // transfert (GroupTransferRequest.status=ACCEPTED), qui avait marqué l'ancien StudentProfile
    // TRANSFERRED côté école source. Si la famille échoue à compléter ce dossier (ou que l'Admin
    // le rejette), l'élève ne doit pas rester en limbe — on le réactive côté école source. Le
    // GroupTransferRequest reste ACCEPTED (fait historique : l'Admin a bien accepté le principe
    // du transfert), l'échec réel se lit sur le statut REJECTED du StudentOnboarding lui-même.
    if (onboarding.sourceType === 'GROUPE_TRANSFERT') {
      const demande = await this.eleveOnboardingRepository.findGroupTransferRequestByOnboarding(onboarding.id);
      if (demande) {
        await this.eleveOnboardingRepository.reactiverStudentProfilesTransferes(demande.sourceUserId);
      }
    }

    await logActivity({
      userId: cmd.rejectedById,
      schoolId: cmd.schoolId,
      action: 'ONBOARDING_REJECTED',
      details: `Dossier ${onboarding.id} rejeté : ${cmd.rejectionReason}`,
    });

    return { onboardingId: onboarding.id, status: 'REJECTED' };
  }
}
