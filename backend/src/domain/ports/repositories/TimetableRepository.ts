import type { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import type { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type { CreneauOccupe } from '@domain/ports/services/SchedulingSolverPort';

export interface CreneauConflitInfo {
  id: string;
  startTime: string;
  endTime: string;
  classeNom: string;
}

export interface TimetableRepository {
  // --- EmploiDuTemps ---
  findById(id: string): Promise<EmploiDuTemps | null>;
  findByClasse(classId: string, academicYearId: string): Promise<EmploiDuTemps | null>;
  save(emploiDuTemps: EmploiDuTemps): Promise<void>;
  update(emploiDuTemps: EmploiDuTemps): Promise<void>;
  countCreneaux(timetableId: string): Promise<number>;

  // --- Créneaux ---
  findCreneauById(id: string): Promise<CreneauHoraire | null>;
  findCreneauxByTimetable(timetableId: string): Promise<CreneauHoraire[]>;
  saveCreneaux(creneau: CreneauHoraire): Promise<void>;
  updateCreneau(creneau: CreneauHoraire): Promise<void>;
  deleteCreneau(id: string, timetableId: string): Promise<void>;

  /**
   * Retourne les créneaux existants d'un enseignant pour un jour donné.
   * Filtre par schoolId pour éviter les faux conflits inter-écoles.
   */
  findCreneauxEnseignantParJour(
    teacherId: string,
    dayOfWeek: number,
    schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]>;

  /**
   * Calcule le volume horaire hebdomadaire d'un enseignant (créneaux CLASS uniquement).
   * Utilisé pour la vérification Loi 7 (AP ≤ 14h). Filtre par schoolId.
   */
  calculerVolumeHoraireHebdo(
    teacherId: string,
    schoolId: string,
    excludeId?: string
  ): Promise<number>;

  /**
   * Vérifie si un enseignant a la permission AP/HOD.
   * Retourne le nom de l'enseignant pour les messages d'erreur.
   */
  getInfosEnseignant(
    teacherId: string
  ): Promise<{ nom: string; estAP: boolean } | null>;

  /**
   * Retourne le nom d'une salle pour les messages d'erreur de conflit — même raisonnement que
   * getInfosEnseignant : le TimetableRepository résout un nom d'affichage plutôt que d'imposer
   * une dépendance RoomRepository aux use cases Ajouter/ModifierCreneauUseCase.
   */
  getInfosSalle(roomId: string): Promise<{ nom: string } | null>;

  /**
   * Retourne les créneaux existants d'une salle pour un jour donné — même contrat que
   * findCreneauxEnseignantParJour. C'est la requête que le futur Scheduling Engine (V2.5)
   * consommera comme hard constraint "conflit de salle".
   */
  findCreneauxSalleParJour(
    roomId: string,
    dayOfWeek: number,
    schoolId: string,
    excludeId?: string
  ): Promise<CreneauConflitInfo[]>;

  /**
   * Vérifie qu'un sous-groupe appartient bien à la classe de l'EDT.
   */
  sousGroupeAppartientAClasse(
    subGroupId: string,
    classId: string
  ): Promise<boolean>;

  /**
   * Occupation enseignant/salle de TOUTE l'école pour une année — alimente les contraintes dures
   * "déjà pris" du SchedulingSolverPort (V2.5). Exclut l'EDT en cours de proposition
   * (excludeTimetableId) : ses propres créneaux ne doivent pas être vus comme des conflits, on
   * est justement en train de les (re)calculer.
   */
  findOccupationEcole(
    schoolId: string,
    academicYearId: string,
    excludeTimetableId?: string
  ): Promise<CreneauOccupe[]>;

  /**
   * Écrit un lot de créneaux en TOUT OU RIEN — une transaction unique enveloppe la validation ET
   * l'insertion. Si un seul créneau échoue, rien n'est écrit : jamais d'emploi du temps à moitié
   * appliqué. Chaque créneau est construit via CreneauHoraire.create(), donc le format (heures,
   * jour 0-5) est toujours validé par le domaine, quel que soit l'appelant.
   *
   * `verifierConflits` (défaut true) :
   *  - true  → re-vérifie conflit enseignant + conflit salle, les relectures passant par la
   *            transaction pour que chaque créneau voie ceux déjà insérés dans le même lot.
   *            Lève ConflitHoraireError / ConflitSalleError avec le détail du créneau fautif.
   *  - false → validation de format uniquement, aucune requête de conflit. Réservé aux appelants
   *            pour qui la notion n'a pas de sens — aujourd'hui le seul cas est le squelette de
   *            grille (`GenererSqueletteEmploiDuTempsUseCase`), dont les créneaux n'ont ni
   *            enseignant ni salle : les vérifications seraient des no-ops coûteuses.
   *            Rend explicite et localisé ce qui était auparavant un contournement invisible.
   */
  creerCreneauxEnLot(
    timetableId: string,
    schoolId: string,
    creneaux: CreneauALoter[],
    options?: { verifierConflits?: boolean }
  ): Promise<{ creneauxCrees: number }>;
}

/**
 * Un créneau à insérer en lot. Surensemble de SeanceProposee : le solveur produit toujours
 * matière/enseignant/salle, alors qu'un squelette de grille n'a que le jour et l'horaire.
 */
export interface CreneauALoter {
  subjectId?: string;
  teacherId?: string;
  roomId?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}
