/**
 * APPLICATION — Use case : Rejeter un onboarding élève (doublon, erreur de saisie, etc.)
 */
import type { PrismaClient } from '@prisma/client';
import { logActivity } from '../../utils/activitieslog';
import { peutTransitionnerDepuisPendingValidation } from './rules';
import type { RejeterOnboardingCommande, RejeterOnboardingResultat } from './types';

export class RejeterOnboardingUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: RejeterOnboardingCommande): Promise<RejeterOnboardingResultat> {
    if (!cmd.rejectionReason?.trim()) throw new Error('Un motif de rejet est requis');

    const onboarding = await (this.prisma as any).studentOnboarding.findFirst({
      where: { id: cmd.onboardingId, schoolId: cmd.schoolId },
    });
    if (!onboarding) throw new Error('Dossier introuvable');
    if (!peutTransitionnerDepuisPendingValidation(onboarding.status)) {
      throw new Error(`Ce dossier ne peut pas être rejeté depuis son statut actuel (${onboarding.status}) — seul PENDING_VALIDATION peut être rejeté`);
    }

    const settings = await (this.prisma as any).schoolOnboardingSettings.findUnique({ where: { schoolId: cmd.schoolId } });
    const responsableRole = settings?.responsableRole ?? 'ADMIN';
    if (cmd.validatorRole !== responsableRole) {
      throw new Error(`Seul un utilisateur avec le rôle ${responsableRole} peut rejeter ce dossier`);
    }

    await (this.prisma as any).studentOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: 'REJECTED',
        rejectionReason: cmd.rejectionReason,
        validatedById: cmd.rejectedById,
        validatedAt: new Date(),
      },
    });

    await logActivity({
      userId: cmd.rejectedById,
      schoolId: cmd.schoolId,
      action: 'ONBOARDING_REJECTED',
      details: `Dossier ${onboarding.id} rejeté : ${cmd.rejectionReason}`,
    });

    return { onboardingId: onboarding.id, status: 'REJECTED' };
  }
}
