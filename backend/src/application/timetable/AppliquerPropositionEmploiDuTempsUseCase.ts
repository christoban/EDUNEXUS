import type { TimetableRepository } from '@domain/ports/repositories/TimetableRepository';
import type { SeanceProposee } from '@domain/ports/services/SchedulingSolverPort';

export interface AppliquerPropositionCommande {
  timetableId: string;
  schoolId: string;
  seances: SeanceProposee[];
}

export interface AppliquerPropositionResultat {
  creneauxCrees: number;
}

/**
 * Écrit réellement une proposition d'emploi du temps, après revue et confirmation de l'admin —
 * le solveur ne persiste jamais rien lui-même (jamais de génération silencieuse, même principe
 * que ProposerStructureAnneeSuivanteUseCase / ValiderStructureAnneeSuivanteUseCase).
 *
 * L'écriture est déléguée telle quelle à appliquerPropositionAtomique() : TOUT OU RIEN dans une
 * transaction unique. Si l'état a changé entre la proposition et son application (un créneau
 * ajouté à la main entre-temps), la séance fautive lève ConflitHoraireError/ConflitSalleError et
 * AUCUNE séance de la proposition n'est écrite — jamais d'emploi du temps à moitié appliqué.
 */
export class AppliquerPropositionEmploiDuTempsUseCase {
  constructor(private readonly timetableRepository: TimetableRepository) {}

  async execute(commande: AppliquerPropositionCommande): Promise<AppliquerPropositionResultat> {
    if (commande.seances.length === 0) {
      throw new Error('Proposition vide : aucune séance à appliquer');
    }

    const emploiDuTemps = await this.timetableRepository.findById(commande.timetableId);
    if (!emploiDuTemps) throw new Error(`EDT introuvable : ${commande.timetableId}`);
    if (emploiDuTemps.schoolId !== commande.schoolId) {
      throw new Error('Accès refusé : EDT hors de votre établissement');
    }
    if (emploiDuTemps.estPublie()) {
      throw new Error("Impossible d'appliquer une proposition à un EDT déjà publié");
    }

    // verifierConflits laissé à son défaut (true) : l'état a pu changer entre la proposition et
    // sa confirmation par l'admin, c'est précisément le cas que la re-vérification couvre.
    return this.timetableRepository.creerCreneauxEnLot(
      commande.timetableId,
      commande.schoolId,
      commande.seances,
    );
  }
}
