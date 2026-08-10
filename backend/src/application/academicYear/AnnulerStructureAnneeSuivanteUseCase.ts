/**
 * APPLICATION LAYER — Use Case : Annuler la structure proposée pour l'année suivante
 *
 * Symétrique de ProposerStructureAnneeSuivanteUseCase — la sortie de secours promise par son
 * message d'idempotence ("Validez-la ou annulez-la avant d'en proposer une nouvelle"). Supprime
 * définitivement les classes DRAFT d'une année (et leurs mappings ClassPromotion), pour que
 * l'admin puisse reproposer une structure après une erreur sans supprimer les classes une par
 * une via l'endpoint classes existant. Suppression dure (pas la corbeille) assumée : une
 * proposition jamais validée n'a par construction aucun élève ni note rattachés.
 */
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';
import type { PromotionRepository } from '@domain/ports/repositories/PromotionRepository';

export interface AnnulerStructureCommande {
  schoolId: string;
  anneeSuivanteId: string;
}

export interface AnnulerStructureResultat {
  classesSupprimees: number;
}

export class AnnulerStructureAnneeSuivanteUseCase {
  constructor(
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly promotionRepository: PromotionRepository,
  ) {}

  async execute(commande: AnnulerStructureCommande): Promise<AnnulerStructureResultat> {
    const annee = await this.anneeRepository.findById(commande.anneeSuivanteId);
    if (!annee) throw new Error(`Année académique introuvable : ${commande.anneeSuivanteId}`);
    if (annee.schoolId !== commande.schoolId) throw new Error('Accès refusé');

    const classes = await this.classeRepository.findBySchoolAndYear(commande.schoolId, commande.anneeSuivanteId);
    const classesDraft = classes.filter(c => c.status === 'DRAFT');
    if (classesDraft.length === 0) {
      const classesActives = classes.filter(c => c.status === 'ACTIVE');
      if (classesActives.length > 0) {
        throw new Error(
          "Annulation impossible : cette structure a déjà été validée (classes ACTIVE, plus aucune DRAFT à annuler)."
        );
      }
      throw new Error('Annulation impossible : aucune structure proposée (classe DRAFT) pour cette année.');
    }

    // Purge les mappings AVANT les classes : ClassPromotion.toClassId référence Class en
    // RESTRICT, la suppression des classes échouerait sinon.
    const draftIds = classesDraft.map(c => c.id);
    await this.promotionRepository.supprimerMappingsVersClasses(draftIds);
    const idsSupprimes = await this.classeRepository.supprimerToutesDraft(commande.schoolId, commande.anneeSuivanteId);

    return { classesSupprimees: idsSupprimes.length };
  }
}
