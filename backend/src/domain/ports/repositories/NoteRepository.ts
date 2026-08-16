/**
 * DOMAIN LAYER — Port Repository Note (Grade)
 * Porte les requêtes nécessaires au workflow de validation MINESEC.
 */
import type { Note } from '@domain/entities/Note';
import type { GradeValidationStatus } from '@domain/types/enums';

// Ce que retourne la vérification des prérequis bulletin/conseil
export interface NoteNonValideeInfo {
  matiereNom: string;
  enseignantNom: string;
  statut: GradeValidationStatus;
}

export interface NoteRepository {
  // Lecture
  /**
   * Charge une note. Le `schoolId` est OBLIGATOIRE : une note d'une autre école doit être
   * introuvable, pas seulement interdite. Paramètre requis (et non optionnel) pour que le
   * compilateur empêche tout appelant futur de l'omettre.
   */
  findById(id: string, schoolId: string): Promise<Note | null>;
  findByEleve(studentId: string, academicYearId: string): Promise<Note[]>;
  findByClasse(classId: string, sequenceId: string): Promise<Note[]>;
  findByEnseignant(teacherId: string, sequenceId: string): Promise<Note[]>;
  findByEleveEtMatiere(studentId: string, subjectId: string, sequenceId: string): Promise<Note | null>;

  // Workflow validation
  findByStatut(classId: string, sequenceId: string, statut: GradeValidationStatus): Promise<Note[]>;

  /**
   * Retourne les notes non encore VALIDATED pour une classe sur une période.
   * Utilisé pour Loi 4 (bulletin) et Loi 5 (conseil de classe).
   */
  findNotesNonValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<NoteNonValideeInfo[]>;

  /**
   * Vérifie si toutes les notes d'une classe sont VALIDATED pour une période.
   * Retourne true si la génération de bulletin est autorisée.
   */
  toutesNotesValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<boolean>;

  // Écriture
  save(note: Note): Promise<void>;
  update(note: Note): Promise<void>;
  updateStatut(noteId: string, statut: GradeValidationStatus, validateurId?: string, motif?: string): Promise<void>;

  // Bulk operations
  findNotesEnAttenteDepuis(heures: number): Promise<Note[]>; // Pour les alertes Inngest

  /**
   * Verrouille toutes les notes VALIDATED d'un élève pour une classe/période.
   * Appelé après la génération du bulletin — Loi 6.
   */
  verrouillerNotesValidees(studentId: string, classId: string, academicPeriodId: string): Promise<void>;
}
