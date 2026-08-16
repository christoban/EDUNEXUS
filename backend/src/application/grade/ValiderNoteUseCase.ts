/**
 * APPLICATION LAYER — Use Case : Valider une note
 * SUBMITTED → VALIDATED
 * Réservé au Censeur (VALIDATE_GRADES) ou à l'Admin.
 */
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface ValiderNoteCommande {
  noteId: string;
  validateurId: string;
  /** École de l'utilisateur qui valide, issue du token. Jamais du corps de la requête. */
  schoolId: string;
}

export interface ValiderNoteResultat {
  noteId: string;
  statut: string;
  validateurNom: string;
  valideeA: Date;
}

export class ValiderNoteUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: ValiderNoteCommande): Promise<ValiderNoteResultat> {
    // 1. Vérifier que le validateur a la permission
    const validateur = await this.userRepository.findById(commande.validateurId);
    if (!validateur) {
      throw new Error('Validateur introuvable');
    }
    if (!validateur.aPermission('VALIDATE_GRADES')) {
      throw new Error(
        `Permission refusée : "${validateur.nomComplet}" n'a pas la permission VALIDATE_GRADES`
      );
    }

    // 2. Charger la note
    const note = await this.noteRepository.findById(commande.noteId, commande.schoolId);
    if (!note) {
      throw new Error(`Note introuvable : ${commande.noteId}`);
    }

    // 3. Valider (workflow dans l'entité)
    note.valider(commande.validateurId);

    // 4. Sauvegarder
    await this.noteRepository.update(note);

    return {
      noteId: note.id,
      statut: note.validationStatus,
      validateurNom: validateur.nomComplet,
      valideeA: new Date(),
    };
  }
}