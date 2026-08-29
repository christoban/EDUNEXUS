/**
 * APPLICATION LAYER — Use Case : Verrouiller une note individuelle
 * DRAFT → LOCKED
 * Seul l'enseignant assigné à la matière peut verrouiller sa propre note.
 */
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';

export interface VerrouillerNoteCommande {
  noteId: string;
  demandeurId: string;
  /** École de l'utilisateur, issue du token. */
  schoolId: string;
}

export interface VerrouillerNoteResultat {
  noteId: string;
  statut: string;
  message: string;
}

export class VerrouillerNoteUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly matiereRepository: MatiereRepository,
  ) {}

  async execute(commande: VerrouillerNoteCommande): Promise<VerrouillerNoteResultat> {
    // 1. Charger la note
    const note = await this.noteRepository.findById(commande.noteId, commande.schoolId);
    if (!note) {
      throw new Error(`Note introuvable : ${commande.noteId}`);
    }

    // 2. Vérifier que la note est bien DRAFT
    if (!note.peutEtreModifiee()) {
      throw new Error(
        `Impossible de verrouiller une note en statut "${note.validationStatus}". ` +
        `Seules les notes DRAFT peuvent être verrouillées.`
      );
    }

    // 3. Vérifier que l'enseignant est assigné à la matière (même règle que ModifierNoteUseCase)
    const estAssigne = await this.matiereRepository.estEnseignantAssigne(
      commande.demandeurId,
      note.subjectId,
    );
    if (!estAssigne) {
      throw new Error('Vous n\'êtes pas assigné à cette matière');
    }

    // 4. Verrouiller (workflow dans l'entité)
    note.verrouiller();

    // 5. Sauvegarder
    await this.noteRepository.update(note);

    return {
      noteId: note.id,
      statut: note.validationStatus,
      message: 'Note verrouillée avec succès',
    };
  }
}
