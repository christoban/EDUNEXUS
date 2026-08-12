import type { EmploiDuTemps } from '@domain/entities/EmploiDuTemps';
import type { CreneauHoraire } from '@domain/entities/CreneauHoraire';
import type { SeanceProposee, CreneauOccupe } from '@domain/ports/services/SchedulingSolverPort';

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
   * Écrit une proposition d'emploi du temps en TOUT OU RIEN — une transaction unique enveloppe
   * la re-vérification des conflits ET l'insertion de toutes les séances. Si une seule séance
   * entre en conflit (état changé entre la proposition et son application), rien n'est écrit :
   * jamais d'emploi du temps à moitié appliqué.
   *
   * Lève ConflitHoraireError / ConflitSalleError avec le détail de la séance fautive.
   */
  appliquerPropositionAtomique(
    timetableId: string,
    schoolId: string,
    seances: SeanceProposee[]
  ): Promise<{ creneauxCrees: number }>;
}
