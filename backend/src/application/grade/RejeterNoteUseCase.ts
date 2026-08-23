/**
 * APPLICATION LAYER — Use Case : Rejeter une note
 * SUBMITTED → DRAFT (avec motif obligatoire)
 * Réservé au Censeur (VALIDATE_GRADES) ou à l'Admin.
 */
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { Language } from '../../domain/policies/LanguagePolicy';

export interface RejeterNoteCommande {
  noteId: string;
  validateurId: string;
  motif: string;
  lang?: Language;
  /** École de l'utilisateur qui rejette, issue du token. Jamais du corps de la requête. */
  schoolId: string;
}

export class RejeterNoteUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(commande: RejeterNoteCommande): Promise<void> {
    // 1. Vérifier permission
    const validateur = await this.userRepository.findById(commande.validateurId);
    if (!validateur || !validateur.aPermission('VALIDATE_GRADES')) {
      throw new Error('Permission VALIDATE_GRADES requise pour rejeter une note');
    }

    // 2. Charger et rejeter la note
    const note = await this.noteRepository.findById(commande.noteId, commande.schoolId);
    if (!note) {
      throw new Error(`Note introuvable : ${commande.noteId}`);
    }

    // 3. Rejeter (workflow dans l'entité — motif obligatoire vérifié là)
    note.rejeter(commande.motif);
    await this.noteRepository.update(note);

    // 4. Notifier l'enseignant qui avait soumis la note
    const noteData = note.toObject();
    if (noteData.recordedById) {
      const lang = commande.lang ?? 'fr';
      await this.notificationService.envoyer({
        schoolId: note.schoolId,
        userId: noteData.recordedById,
        type: 'SYSTEM',
        titre: lang === 'en' ? 'Grade rejected' : 'Note rejetée',
        corps: lang === 'en'
          ? `Your grade has been rejected. Reason: ${commande.motif}. Please correct and resubmit.`
          : `Votre note a été rejetée. Motif : ${commande.motif}. Veuillez la corriger et resoumettre.`,
        canal: 'IN_APP',
        metadata: { noteId: note.id, motif: commande.motif },
      });
    }
  }
}