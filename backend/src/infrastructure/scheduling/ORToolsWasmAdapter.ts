/**
 * INFRASTRUCTURE — Adaptateur OR-Tools (CP-SAT via WebAssembly) du SchedulingSolverPort.
 *
 * Choix technique validé par un spike dédié (or-tools-wasm 0.9.1 sous Bun 1.3.14) : le package
 * expose une condition d'export "bun" maintenue et testée en CI par l'amont, l'API TypeScript
 * fonctionne telle que documentée, ~554ms à froid (chargement WASM) puis ~60ms à chaud.
 *
 * Modèle CP-SAT — une variable booléenne x[exigence][case][salle] = "cette séance a lieu à cette
 * case, dans cette salle". Les variables IMPOSSIBLES ne sont jamais créées (mauvais type de
 * salle, enseignant ou salle déjà pris par une autre classe) : c'est plus efficace et plus lisible
 * qu'ajouter des contraintes pour les interdire après coup.
 *
 * Contraintes DURES :
 *   1. Chaque séance est placée exactement une fois.
 *   2. La classe ne peut pas suivre deux séances à la même case (conflit classe).
 *   3. Un enseignant ne peut pas être sur deux séances à la même case (conflit enseignant) —
 *      même règle que CreneauHoraire.verifierConflitEnseignant(), portée dans le solveur.
 *   4. Une salle ne peut pas accueillir deux séances à la même case (conflit salle) —
 *      même règle que CreneauHoraire.verifierConflitSalle().
 *   5. Type de salle : une matière PRACTICAL exige une salle spécialisée (jamais NORMAL).
 *
 * Contrainte SOUPLE (objectif maximisé) : préférer la salle habituelle de la classe
 * (ClassRoomAssignment) — un cours dans sa salle habituelle vaut POIDS_SALLE_HABITUELLE points.
 */
import { CpModel, CpSolver, weightedSum } from 'or-tools-wasm/cp-sat';
import { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type {
  SchedulingSolverPort,
  ProposerEmploiDuTempsInput,
  PropositionEmploiDuTemps,
  SeanceProposee,
  ExigenceSeance,
  CaseGrille,
  SalleDisponible,
  CreneauOccupe,
} from '@domain/ports/services/SchedulingSolverPort';

/** Poids de la seule contrainte souple de cette tranche (préférence salle habituelle). */
const POIDS_SALLE_HABITUELLE = 10;

/** Nombre de workers CP-SAT — 1 suffit très largement à cette taille de problème (cf. spike). */
const NB_WORKERS = 1;

export class ORToolsWasmAdapter implements SchedulingSolverPort {
  async proposer(input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> {
    const { exigences, grille, sallesDisponibles, occupationExistante, salleHabituelleId } = input;

    if (exigences.length === 0) {
      return { statut: 'OPTIMAL', seances: [], scoreObjectif: 0, dureeResolutionMs: 0 };
    }
    if (grille.length === 0) {
      return {
        statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs: 0,
        raisonInfaisabilite: "La grille horaire de l'établissement ne contient aucun créneau — configurez-la avant de proposer un emploi du temps.",
      };
    }

    const model = new CpModel();

    // --- Variables : uniquement les placements RÉELLEMENT possibles ---
    type Placement = { exigenceIdx: number; caseIdx: number; salleIdx: number };
    const placements: Placement[] = [];
    const variables: ReturnType<CpModel['newBoolVar']>[] = [];

    for (let e = 0; e < exigences.length; e++) {
      const exigence = exigences[e]!;
      const sallesCompatibles = sallesDisponibles
        .map((salle, idx) => ({ salle, idx }))
        .filter(({ salle }) => salleAccepteMatiere(salle, exigence));

      if (sallesCompatibles.length === 0) {
        return {
          statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs: 0,
          raisonInfaisabilite: `Aucune salle compatible pour une matière ${exigence.subjectType} (matière ${exigence.subjectId}) — une matière pratique exige une salle spécialisée (laboratoire, atelier, salle informatique ou terrain).`,
        };
      }

      let placementsPourCetteExigence = 0;
      for (let c = 0; c < grille.length; c++) {
        const caseGrille = grille[c]!;
        if (estOccupe(occupationExistante, caseGrille, { teacherId: exigence.teacherId })) continue;

        for (const { salle, idx: s } of sallesCompatibles) {
          if (estOccupe(occupationExistante, caseGrille, { roomId: salle.roomId })) continue;

          placements.push({ exigenceIdx: e, caseIdx: c, salleIdx: s });
          variables.push(model.newBoolVar(`x_${e}_${c}_${s}`));
          placementsPourCetteExigence++;
        }
      }

      if (placementsPourCetteExigence === 0) {
        return {
          statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs: 0,
          raisonInfaisabilite: `Aucun créneau libre pour la matière ${exigence.subjectId} : l'enseignant ou toutes les salles compatibles sont déjà occupés sur l'ensemble de la grille horaire.`,
        };
      }
    }

    // --- Contrainte 1 (DURE) : chaque séance placée exactement une fois ---
    for (let e = 0; e < exigences.length; e++) {
      model.addExactlyOne(variablesOu(placements, variables, p => p.exigenceIdx === e));
    }

    // --- Contrainte 2 (DURE) : la classe ne suit qu'une séance à la fois ---
    for (let c = 0; c < grille.length; c++) {
      const vars = variablesOu(placements, variables, p => p.caseIdx === c);
      if (vars.length > 1) model.addAtMostOne(vars);
    }

    // --- Contrainte 3 (DURE) : conflit enseignant ---
    const enseignants = [...new Set(exigences.map(e => e.teacherId))];
    for (const teacherId of enseignants) {
      for (let c = 0; c < grille.length; c++) {
        const vars = variablesOu(
          placements, variables,
          p => p.caseIdx === c && exigences[p.exigenceIdx]!.teacherId === teacherId,
        );
        if (vars.length > 1) model.addAtMostOne(vars);
      }
    }

    // --- Contrainte 4 (DURE) : conflit salle ---
    for (let s = 0; s < sallesDisponibles.length; s++) {
      for (let c = 0; c < grille.length; c++) {
        const vars = variablesOu(placements, variables, p => p.caseIdx === c && p.salleIdx === s);
        if (vars.length > 1) model.addAtMostOne(vars);
      }
    }

    // --- Objectif (SOUPLE) : préférer la salle habituelle de la classe ---
    if (salleHabituelleId) {
      const poids = placements.map(p =>
        sallesDisponibles[p.salleIdx]!.roomId === salleHabituelleId ? POIDS_SALLE_HABITUELLE : 0,
      );
      model.maximize(weightedSum(variables, poids));
    }

    // --- Résolution ---
    const solver = new CpSolver();
    const debut = performance.now();
    const status = await solver.solve(model, { numSearchWorkers: NB_WORKERS });
    const dureeResolutionMs = performance.now() - debut;

    const statusName = solver.statusName(status);
    if (statusName !== 'OPTIMAL' && statusName !== 'FEASIBLE') {
      return {
        statut: 'INFAISABLE', seances: [], scoreObjectif: 0, dureeResolutionMs,
        raisonInfaisabilite: `Aucune combinaison ne satisfait toutes les contraintes (statut solveur : ${statusName}). Libérez des créneaux, ajoutez une salle compatible, ou réduisez le nombre de séances à placer.`,
      };
    }

    const seances: SeanceProposee[] = [];
    for (let i = 0; i < placements.length; i++) {
      if (solver.value(variables[i]!) !== 1) continue;
      const { exigenceIdx, caseIdx, salleIdx } = placements[i]!;
      const exigence = exigences[exigenceIdx]!;
      const caseGrille = grille[caseIdx]!;
      seances.push({
        subjectId: exigence.subjectId,
        teacherId: exigence.teacherId,
        roomId: sallesDisponibles[salleIdx]!.roomId,
        dayOfWeek: caseGrille.dayOfWeek,
        startTime: caseGrille.startTime,
        endTime: caseGrille.endTime,
      });
    }

    return {
      statut: statusName,
      seances,
      scoreObjectif: salleHabituelleId ? solver.objectiveValue() : 0,
      dureeResolutionMs,
    };
  }
}

/**
 * Contrainte dure n°5 — une matière PRACTICAL exige une salle spécialisée. THEORETICAL et MIXED
 * s'accommodent de n'importe quelle salle (une salle normale convient pour un cours magistral,
 * et un labo peut accueillir un cours théorique sans que ce soit une erreur).
 */
function salleAccepteMatiere(salle: SalleDisponible, exigence: ExigenceSeance): boolean {
  if (exigence.subjectType !== 'PRACTICAL') return true;
  return salle.type !== 'NORMAL';
}

/**
 * Chevauchement horaire avec un créneau déjà occupé ailleurs dans l'école. Réutilise la même
 * arithmétique que CreneauHoraire (debut < finExistant && fin > debutExistant) — la règle de
 * chevauchement n'existe qu'à un seul endroit dans le code.
 */
function estOccupe(
  occupation: CreneauOccupe[],
  caseGrille: CaseGrille,
  cible: { teacherId?: string; roomId?: string },
): boolean {
  const debut = CreneauHoraire.heureEnMinutes(caseGrille.startTime);
  const fin = CreneauHoraire.heureEnMinutes(caseGrille.endTime);

  return occupation.some(occupe => {
    if (occupe.dayOfWeek !== caseGrille.dayOfWeek) return false;
    const memeCible =
      (cible.teacherId !== undefined && occupe.teacherId === cible.teacherId) ||
      (cible.roomId !== undefined && occupe.roomId === cible.roomId);
    if (!memeCible) return false;

    const occupeDebut = CreneauHoraire.heureEnMinutes(occupe.startTime);
    const occupeFin = CreneauHoraire.heureEnMinutes(occupe.endTime);
    return debut < occupeFin && fin > occupeDebut;
  });
}

function variablesOu(
  placements: { exigenceIdx: number; caseIdx: number; salleIdx: number }[],
  variables: ReturnType<CpModel['newBoolVar']>[],
  predicat: (p: { exigenceIdx: number; caseIdx: number; salleIdx: number }) => boolean,
): ReturnType<CpModel['newBoolVar']>[] {
  const resultat: ReturnType<CpModel['newBoolVar']>[] = [];
  for (let i = 0; i < placements.length; i++) {
    if (predicat(placements[i]!)) resultat.push(variables[i]!);
  }
  return resultat;
}
