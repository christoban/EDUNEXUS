/**
 * APPLICATION LAYER — Use Case : Générer les factures pour toute une classe
 */
import { Facture } from '@domain/entities/Facture';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface GenererFacturesEnMasseCommande {
  schoolId: string;
  feePlanId: string;
  classId?: string;
  studentIds?: string[];
}

export interface GenererFacturesEnMasseResultat {
  crees: number;
  ignores: number;
  erreurs: { studentId: string; message: string }[];
}

export class GenererFacturesEnMasseUseCase {
  constructor(
    private readonly factureRepository: FactureRepository,
    private readonly planFraisRepository: PlanFraisRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(
    commande: GenererFacturesEnMasseCommande
  ): Promise<GenererFacturesEnMasseResultat> {
    // 1. Charger le plan
    const plan = await this.planFraisRepository.findById(commande.feePlanId);
    if (!plan) throw new Error(`Plan introuvable : ${commande.feePlanId}`);

    // 2. Loi 3
    if (plan.estScolarite()) {
      const seuil = await this.planFraisRepository.getSeuilLegalTuition(
        commande.schoolId, 'SECOND'
      );
      plan.verifierSeuilLegal(seuil);
    }

    // 3. Identifier les élèves cibles
    let studentIds: string[] = commande.studentIds ?? [];

    if (studentIds.length === 0 && commande.classId) {
      const eleves = await this.userRepository.findByRole(commande.schoolId, 'STUDENT');
      studentIds = eleves
        .filter(e => e.isActive)
        .map(e => e.id);
    }

    if (studentIds.length === 0) {
      throw new Error('Aucun élève cible trouvé');
    }

    // 4. Vérifier les factures existantes pour ce plan
    const facturesExistantes = await this.factureRepository.findByPlanFrais(commande.feePlanId);
    const dejaBilledIds = new Set(facturesExistantes.map(f => f.studentId));

    // 5. Créer les factures manquantes
    let crees = 0;
    let ignores = 0;
    const erreurs: { studentId: string; message: string }[] = [];

    for (const studentId of studentIds) {
      if (dejaBilledIds.has(studentId)) {
        ignores++;
        continue;
      }

      try {
        const facture = Facture.create({
          schoolId: commande.schoolId,
          studentId,
          feePlanId: commande.feePlanId,
          amount: plan.amount,
          currency: plan.currency,
          dueDate: plan.dueDate,
          description: plan.name,
        });

        await this.factureRepository.save(facture);
        crees++;
      } catch (error) {
        erreurs.push({
          studentId,
          message: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }

    return { crees, ignores, erreurs };
  }
}
