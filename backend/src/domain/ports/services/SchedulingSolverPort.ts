/**
 * DOMAIN — Port : solveur d'emploi du temps (V2.5 Scheduling Engine)
 *
 * Le domaine décrit le PROBLÈME (exigences, grille, salles, occupation existante) et reçoit une
 * PROPOSITION — il ne connaît ni CP-SAT, ni OR-Tools, ni WebAssembly. L'implémentation retenue
 * (ORToolsWasmAdapter) est interchangeable, conformément à la roadmap :
 *   SchedulingEngine → SchedulingSolverPort → ORToolsWasmAdapter (aujourd'hui) / autre demain.
 *
 * Le solveur ne PERSISTE jamais rien : il propose, l'admin valide, puis
 * AppliquerPropositionEmploiDuTempsUseCase écrit réellement (jamais de génération silencieuse).
 */
import type { RoomType, SubjectType } from '@domain/types/enums';

/** Une séance à placer : une matière enseignée par un enseignant donné, pour la classe visée. */
export interface ExigenceSeance {
  subjectId: string;
  subjectType: SubjectType;
  teacherId: string;
  durationMinutes: number;
}

/**
 * Créneau déjà occupé ailleurs dans l'école (autre classe déjà planifiée) — sert à poser les
 * contraintes dures "enseignant déjà pris" / "salle déjà prise" dans le modèle.
 */
export interface CreneauOccupe {
  teacherId?: string;
  roomId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Indisponibilité d'un enseignant (V2.4) — plage hebdomadaire où il ne peut pas recevoir de
 * séance. Contrainte DURE pour le solveur : aucun placement sur un créneau chevauchant.
 */
export interface IndisponibiliteEnseignant {
  teacherId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface SalleDisponible {
  roomId: string;
  type: RoomType;
  capacity: number;
}

/** Une case de la grille horaire (issue de TimetableGridConfig, jamais codée en dur). */
export interface CaseGrille {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ProposerEmploiDuTempsInput {
  classId: string;
  /** Salle habituelle de la classe (ClassRoomAssignment) — contrainte SOUPLE : bonus si retenue. */
  salleHabituelleId?: string;
  exigences: ExigenceSeance[];
  grille: CaseGrille[];
  sallesDisponibles: SalleDisponible[];
  occupationExistante: CreneauOccupe[];
  /** Plages où un enseignant est indisponible (V2.4) — contrainte DURE. Vide par défaut. */
  indisponibilitesEnseignants?: IndisponibiliteEnseignant[];
}

export interface SeanceProposee {
  subjectId: string;
  teacherId: string;
  roomId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface PropositionEmploiDuTemps {
  statut: 'OPTIMAL' | 'FEASIBLE' | 'INFAISABLE';
  seances: SeanceProposee[];
  /** Score de l'objectif souple (préférence salle habituelle) — 0 si INFAISABLE. */
  scoreObjectif: number;
  /** Temps de résolution mesuré, remonté pour observabilité (le solveur WASM a un coût à froid). */
  dureeResolutionMs: number;
  /**
   * Renseigné uniquement si INFAISABLE — explique CE QUI bloque (ex. "aucune salle de type
   * LABORATORY disponible pour la matière X"), pour que l'admin sache quoi corriger plutôt que
   * de recevoir un échec opaque.
   */
  raisonInfaisabilite?: string;
}

export interface SchedulingSolverPort {
  proposer(input: ProposerEmploiDuTempsInput): Promise<PropositionEmploiDuTemps>;
}
