/**
 * APPLICATION LAYER — Use Case : Changer le statut d'un plan de frais
 * Workflow V1.11 : DRAFT → PENDING_VALIDATION → APPROVED → PUBLISHED.
 */
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { FeePlanStatus } from '@domain/types/enums';

export interface ChangerStatutPlanFraisCommande {
  schoolId: string;
  feePlanId: string;
  statutCible: FeePlanStatus;
}

export interface ChangerStatutPlanFraisResultat {
  planId: string;
  status: FeePlanStatus;
}

export class ChangerStatutPlanFraisUseCase {
  constructor(private readonly planFraisRepository: PlanFraisRepository) {}

  async execute(
    commande: ChangerStatutPlanFraisCommande
  ): Promise<ChangerStatutPlanFraisResultat> {
    const plan = await this.planFraisRepository.findById(commande.feePlanId);
    if (!plan) throw new Error(`Plan de frais introuvable : ${commande.feePlanId}`);
    if (plan.schoolId !== commande.schoolId) {
      throw new Error("Ce plan n'appartient pas à votre établissement");
    }

    // Transition validée par l'entité (lance TransitionStatutPlanFraisError si invalide)
    plan.changerStatut(commande.statutCible);

    await this.planFraisRepository.updateStatus(plan.id, plan.status);

    return { planId: plan.id, status: plan.status };
  }
}