/**
 * APPLICATION LAYER — Use Case : Soumettre une note pour validation
 * DRAFT → SUBMITTED
 * Seul l'enseignant qui a saisi la note peut la soumettre.
 */
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';

export interface SoumettreNoteCommande {
  noteId: string;
  demandeurId: string; // Doit être l'enseignant qui a saisi
  /** École de l'utilisateur qui soumet, issue du token. Jamais du corps de la requête. */
  schoolId: string;
}

export class SoumettreNoteUseCase {
  constructor(private readonly noteRepository: NoteRepository) {}

  async execute(commande: SoumettreNoteCommande): Promise<void> {
    // 1. Charger la note
    const note = await this.noteRepository.findById(commande.noteId, commande.schoolId);
    if (!note) {
      throw new Error(`Note introuvable : ${commande.noteId}`);
    }

    // 2. Vérifier que c'est bien l'enseignant qui a saisi cette note
    const noteData = note.toObject();
    if (noteData.recordedById && noteData.recordedById !== commande.demandeurId) {
      throw new Error(
        'Permission refusée : seul l\'enseignant qui a saisi cette note peut la soumettre'
      );
    }

    // 3. Soumettre (la logique du workflow est dans l'entité)
    note.soumettrePourValidation();

    // 4. Sauvegarder
    await this.noteRepository.update(note);
  }
}