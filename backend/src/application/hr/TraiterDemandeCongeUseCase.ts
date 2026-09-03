import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { TraiterCongeServicePort } from '@domain/ports/services/TraiterCongeServicePort';

export interface TraiterDemandeCongeCommande {
  schoolId: string;
  demandeurId: string;
  demandeurRole?: string;
  leaveRequestId: string;
  statut: 'APPROVED' | 'REJECTED';
}

export class TraiterDemandeCongeUseCase {
  constructor(
    private readonly traiterCongeService: TraiterCongeServicePort,
    private readonly audit: AIActionAuditPort,
  ) {}

  async execute(commande: TraiterDemandeCongeCommande): Promise<{ leaveRequest: { id: string; statut: string } }> {
    if (!commande.statut || !['APPROVED', 'REJECTED'].includes(commande.statut)) {
      throw new Error('statut doit être APPROVED ou REJECTED');
    }

    let updated;
    try {
      updated = await this.traiterCongeService.traiterDemandeConge(
        commande.schoolId,
        commande.leaveRequestId,
        commande.statut,
        commande.demandeurId,
      );
    } catch (err) {
      this.audit.journaliser({
        actorUserId: commande.demandeurId,
        actorRole: commande.demandeurRole,
        schoolId: commande.schoolId,
        actionName: 'traiter_demande_conge',
        targetType: 'LeaveRequest',
        targetId: commande.leaveRequestId,
        origin: 'UI_DIRECT',
        outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
        parametersSummary: { statut: commande.statut },
      });
      throw err;
    }

    this.audit.journaliser({
      actorUserId: commande.demandeurId,
      actorRole: commande.demandeurRole,
      schoolId: commande.schoolId,
      actionName: 'traiter_demande_conge',
      targetType: 'LeaveRequest',
      targetId: commande.leaveRequestId,
      origin: 'UI_DIRECT',
      outcome: 'SUCCES',
      parametersSummary: { statut: commande.statut },
    });

    return { leaveRequest: updated };
  }
}
