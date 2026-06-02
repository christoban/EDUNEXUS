/**
 * APPLICATION LAYER — Use Case : Saisir une note
 * Un enseignant saisit une note pour un élève. Statut initial : DRAFT.
 * Vérifie que l'enseignant est bien assigné à la matière.
 */
import { Note } from '@domain/entities/Note';
import type { NoteRepository } from '@domain/ports/repositories/NoteRepository';
import type { MatiereRepository } from '@domain/ports/repositories/MatiereRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface SaisirNoteCommande {
  schoolId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  sequenceId: string;
  recordedById: string; // enseignant qui saisit

  // Scores — selon le type d'établissement
  sequenceScore?: number;
  classTestScore?: number;
  terminalExamScore?: number;
  theoreticalScore?: number;
  practicalScore?: number;
  professionalAttitude?: number;
  oralScore?: number;
  selfDevelopmentScore?: number;

  coefficient?: number;
  maxValue?: number;
}

export interface SaisirNoteResultat {
  noteId: string;
  statut: string;
  message: string;
}

export class SaisirNoteUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: SaisirNoteCommande): Promise<SaisirNoteResultat> {
    // 1. Vérifier que l'enseignant existe et est actif
    const enseignant = await this.userRepository.findById(commande.recordedById);
    if (!enseignant || !enseignant.isActive) {
      throw new Error('Enseignant introuvable ou inactif');
    }

    // 2. Vérifier que l'enseignant est assigné à cette matière
    const estAssigne = await this.matiereRepository.estEnseignantAssigne(
      commande.recordedById,
      commande.subjectId
    );
    if (!estAssigne && !enseignant.estAdmin()) {
      throw new Error(
        `L'enseignant "${enseignant.nomComplet}" n'est pas assigné à cette matière`
      );
    }

    // 3. Vérifier qu'une note n'existe pas déjà pour cet élève/matière/séquence
    const noteExistante = await this.noteRepository.findByEleveEtMatiere(
      commande.studentId,
      commande.subjectId,
      commande.sequenceId
    );
    if (noteExistante) {
      throw new Error(
        'Une note existe déjà pour cet élève sur cette matière et cette séquence. ' +
        'Utilisez la modification à la place.'
      );
    }

    // 4. Créer la note (la validation des bornes est dans l'entité)
    const note = Note.create({
      schoolId: commande.schoolId,
      studentId: commande.studentId,
      subjectId: commande.subjectId,
      classId: commande.classId,
      academicYearId: commande.academicYearId,
      sequenceId: commande.sequenceId,
      recordedById: commande.recordedById,
      sequenceScore: commande.sequenceScore,
      classTestScore: commande.classTestScore,
      terminalExamScore: commande.terminalExamScore,
      theoreticalScore: commande.theoreticalScore,
      practicalScore: commande.practicalScore,
      professionalAttitude: commande.professionalAttitude,
      oralScore: commande.oralScore,
      selfDevelopmentScore: commande.selfDevelopmentScore,
      coefficient: commande.coefficient,
      maxValue: commande.maxValue,
    });

    // 5. Sauvegarder
    await this.noteRepository.save(note);

    return {
      noteId: note.id,
      statut: note.validationStatus,
      message: 'Note saisie avec succès — statut : DRAFT',
    };
  }
}