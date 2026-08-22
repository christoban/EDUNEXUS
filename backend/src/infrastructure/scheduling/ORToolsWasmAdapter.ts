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
import type { LinearExprLike } from 'or-tools-wasm/cp-sat';
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
  IndisponibiliteEnseignant,
} from '@domain/ports/services/SchedulingSolverPort';
import { modeliserContraintesDouces } from '@infrastructure/scheduling/contraintesDouces';
import type { Placement } from '@infrastructure/scheduling/contraintesDouces';
import { NOMS_JOURS } from '@domain/types/joursSemaine';

/** Poids de la seule contrainte souple de cette tranche (préférence salle habituelle). */
const POIDS_SALLE_HABITUELLE = 10;

/** Nombre de workers CP-SAT — 1 suffit très largement à cette taille de problème (cf. spike). */
const NB_WORKERS = 1;

export class ORToolsWasmAdapter implements SchedulingSolverPort {
  async proposer(input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps> {
    const { exigences, grille, sallesDisponibles, occupationExistante, salleHabituelleId, indisponibilitesEnseignants = [], contraintes } = input;

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
          suggestions: [`Créez ou libérez une salle spécialisée (laboratoire, atelier, salle informatique…) pour la matière ${exigence.subjectName ?? exigence.subjectId}.`],
        };
      }

      let placementsPourCetteExigence = 0;
      for (let c = 0; c < grille.length; c++) {
        const caseGrille = grille[c]!;
        if (estOccupe(occupationExistante, caseGrille, { teacherId: exigence.teacherId })) continue;
        if (estIndisponible(indisponibilitesEnseignants, caseGrille, exigence.teacherId)) continue;

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
          suggestions: [`La matière ${exigence.subjectName ?? exigence.subjectId} (enseignant ${exigence.teacherName ?? exigence.teacherId}) n'a aucun créneau libre — vérifiez les indisponibilités de l'enseignant ou l'occupation des salles compatibles.`],
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

    // --- Objectif (SOUPLE) : salle habituelle + contraintes douces V2.5, en UN SEUL maximize ---
    const termes: { terme: LinearExprLike; coeff: number }[] = [];
    if (salleHabituelleId) {
      for (let i = 0; i < placements.length; i++) {
        if (sallesDisponibles[placements[i]!.salleIdx]!.roomId === salleHabituelleId) {
          termes.push({ terme: variables[i]!, coeff: POIDS_SALLE_HABITUELLE });
        }
      }
    }
    // Contraintes douces V2.5 (pénalités) + blocs de 2 h (DUR, §4) — un seul appel, qui gère
    // aussi le cas options = undefined (blocs actifs par défaut, aucune pénalité).
    termes.push(...modeliserContraintesDouces({ model, placements, variables, exigences, grille, options: contraintes }));
    let objectifExpr: LinearExprLike | null = null;
    if (termes.length > 0) {
      objectifExpr = weightedSum(termes.map(t => t.terme), termes.map(t => t.coeff));
      model.maximize(objectifExpr);
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
        suggestions: ['Libérez des créneaux (occupation existante), ajoutez une salle compatible, ou réduisez le nombre de séances à placer.'],
      };
    }

    // --- Extraire les séances retenues + score (réutilisé pour les alternatives) ---
    const extraire = (): { seances: SeanceProposee[]; score: number } => {
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
      return { seances, score: termes.length > 0 ? solver.objectiveValue() : 0 };
    };

    const { seances, score } = extraire();

    // --- Explain My Timetable (V2.5 §7) : une ligne par séance retenue ---
    let explicatifs: string[] | undefined;
    if (contraintes?.explicatifs) {
      explicatifs = seances.map(s => {
        const exigence = exigences.find(e => e.subjectId === s.subjectId);
        const salle = sallesDisponibles.find(r => r.roomId === s.roomId);
        const jour = NOMS_JOURS[s.dayOfWeek] ?? String(s.dayOfWeek);
        const raison = s.roomId === salleHabituelleId
          ? 'salle habituelle de la classe'
          : exigence?.subjectType === 'PRACTICAL'
            ? 'salle spécialisée exigée'
            : 'première salle compatible libre';
        return `${jour} ${s.startTime}-${s.endTime} · ${exigence?.subjectName ?? s.subjectId} (${exigence?.teacherName ?? s.teacherId}) · ${salle?.roomName ?? s.roomId} — ${raison}`;
      });
    }

    // --- Solutions multiples scorées (no-good re-solve, V2.5 §6) ---
    const solutionsAlternatives: { score: number; seances: SeanceProposee[] }[] = [];
    const sm = input.solutionsMultiples;
    if (sm) {
      const nombre = Math.max(1, Math.min(sm.nombre ?? 3, 5));
      const marge = sm.margeScore ?? 0;
      const gardeFou = debut + 5000;
      for (let k = 1; k < nombre; k++) {
        if (performance.now() > gardeFou) break;
        // no-good : au moins une variable retenue de la solution courante doit basculer.
        const retenues = placements
          .map((_, i) => (solver.value(variables[i]!) === 1 ? variables[i]! : null))
          .filter((v): v is NonNullable<typeof v> => v !== null);
        if (retenues.length === 0) break;
        model.addBoolOr(retenues.map(v => v.not()));
        // Borne d'objectif : ne garder que les alternatives à ≤ marge du score optimal.
        if (marge > 0 && objectifExpr) {
          model.addLinearConstraint(objectifExpr, score - marge, 1e9);
        }
        const statusK = await solver.solve(model, { numSearchWorkers: NB_WORKERS });
        const nomK = solver.statusName(statusK);
        if (nomK !== 'OPTIMAL' && nomK !== 'FEASIBLE') break;
        solutionsAlternatives.push(extraire());
      }
    }

    return {
      statut: statusName,
      seances,
      scoreObjectif: score,
      dureeResolutionMs,
      ...(solutionsAlternatives.length > 0 ? { solutionsAlternatives } : {}),
      ...(explicatifs ? { explicatifs } : {}),
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

/**
 * Contrainte DURE V2.4 — un enseignant indisponible sur une plage ne peut recevoir aucune séance
 * qui la chevauche. Même arithmétique de chevauchement que CreneauHoraire (une seule source).
 */
function estIndisponible(
  indisponibilites: IndisponibiliteEnseignant[],
  caseGrille: CaseGrille,
  teacherId: string,
): boolean {
  if (indisponibilites.length === 0) return false;
  const debut = CreneauHoraire.heureEnMinutes(caseGrille.startTime);
  const fin = CreneauHoraire.heureEnMinutes(caseGrille.endTime);

  return indisponibilites.some(indispo => {
    if (indispo.teacherId !== teacherId) return false;
    if (indispo.dayOfWeek !== caseGrille.dayOfWeek) return false;
    const indispoDebut = CreneauHoraire.heureEnMinutes(indispo.startTime);
    const indispoFin = CreneauHoraire.heureEnMinutes(indispo.endTime);
    return debut < indispoFin && fin > indispoDebut;
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
