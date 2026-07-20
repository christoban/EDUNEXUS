/**
 * APPLICATION LAYER — Use Case : Valider toutes les notes d'une classe en bloc
 * Valide d'un coup toutes les notes SUBMITTED d'une classe/séquence.
 * Réservé au Censeur ou Admin.
 */
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface ValiderEnBlocCommande {
  classId: string;
  sequenceId: string;
  validateurId: string;
}

export interface ValiderEnBlocResultat {
  notesValidees: number;
  notesIgnorees: number; // Déjà validées ou pas en SUBMITTED
  message: string;
  // Notes réellement validées PAR CET APPEL (pas l'état global classe/séquence) — permet à
  // l'appelant (controller) de déclencher des effets de bord uniquement pour ce qui vient de
  // changer, sans re-notifier des notes déjà validées lors d'un appel précédent.
  gradesValidees: Array<{ id: string; studentId: string; subjectId: string; schoolId: string; sequenceId: string }>;
}

export class ValiderEnBlocUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: ValiderEnBlocCommande): Promise<ValiderEnBlocResultat> {
    // 1. Vérifier permission
    const validateur = await this.userRepository.findById(commande.validateurId);
    if (!validateur || !validateur.aPermission('VALIDATE_GRADES')) {
      throw new Error('Permission VALIDATE_GRADES requise');
    }

    // 2. Récupérer toutes les notes SUBMITTED de la classe
    const notesAValider = await this.noteRepository.findByStatut(
      commande.classId,
      commande.sequenceId,
      'SUBMITTED'
    );

    if (notesAValider.length === 0) {
      return {
        notesValidees: 0,
        notesIgnorees: 0,
        message: 'Aucune note en attente de validation pour cette classe',
        gradesValidees: [],
      };
    }

    // 3. Valider chaque note
    let validees = 0;
    const gradesValidees: ValiderEnBlocResultat['gradesValidees'] = [];
    for (const note of notesAValider) {
      note.valider(commande.validateurId);
      await this.noteRepository.update(note);
      validees++;
      gradesValidees.push({
        id: note.id, studentId: note.studentId, subjectId: note.subjectId,
        schoolId: note.schoolId, sequenceId: note.sequenceId,
      });
    }

    return {
      notesValidees: validees,
      notesIgnorees: 0,
      message: `${validees} note(s) validée(s) avec succès`,
      gradesValidees,
    };
  }
}