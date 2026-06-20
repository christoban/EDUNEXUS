/**
 * DOMAIN LAYER — Entité Note (Grade)
 * Porte le workflow de validation MINESEC :
 * DRAFT → SUBMITTED → VALIDATED → LOCKED
 *                  ↘ REJECTED → DRAFT
 *
 * Loi 6 : une note VALIDATED ou LOCKED ne peut jamais être modifiée
 * lors d'une synchronisation hors ligne.
 */
import type { GradeValidationStatus } from '@domain/types/enums';
import { NoteValideeSyncError } from '@domain/errors/NoteValideeSyncError';

export interface NoteProps {
  id: string;
  schoolId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  sequenceId: string;
  recordedById?: string;

  // Scores selon le type d'établissement
  sequenceScore?: number;         // Secondaire FR — note DS/Compo
  classTestScore?: number;        // Secondaire EN — Class Test
  terminalExamScore?: number;     // Secondaire EN — Terminal Exam
  theoreticalScore?: number;      // Technique — note théorie
  practicalScore?: number;        // Technique — note pratique
  professionalAttitude?: number;  // Technique — attitude en atelier /20
  oralScore?: number;             // Primaire APC — composante Oral
  selfDevelopmentScore?: number;  // Primaire APC — Savoir-être

  coefficient: number;
  maxValue: number;               // 20 ou 100
  sequenceAverage?: number;       // Calculé par le GradingEngine

  validationStatus: GradeValidationStatus;
  validatedById?: string;
  validatedAt?: Date;
  rejectionReason?: string;

  isOfflineSync: boolean;
  syncedAt?: Date;
  createdAt: Date;
}

export interface CreerNoteProps {
  schoolId: string;
  studentId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
  sequenceId: string;
  recordedById: string;
  coefficient?: number;
  maxValue?: number;
  sequenceScore?: number;
  classTestScore?: number;
  terminalExamScore?: number;
  theoreticalScore?: number;
  practicalScore?: number;
  professionalAttitude?: number;
  oralScore?: number;
  selfDevelopmentScore?: number;
}

export class Note {
  private constructor(private readonly props: NoteProps) {}

  // --- Factories ---

  static create(props: CreerNoteProps): Note {
    Note.validerScores(props);

    return new Note({
      ...props,
      id: crypto.randomUUID(),
      coefficient: props.coefficient ?? 1,
      maxValue: props.maxValue ?? 20,
      validationStatus: 'DRAFT',
      isOfflineSync: false,
      createdAt: new Date(),
    });
  }

  static reconstituer(props: NoteProps): Note {
    return new Note(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get studentId(): string { return this.props.studentId; }
  get subjectId(): string { return this.props.subjectId; }
  get classId(): string { return this.props.classId; }
  get sequenceId(): string { return this.props.sequenceId; }
  get validationStatus(): GradeValidationStatus { return this.props.validationStatus; }
  get sequenceAverage(): number | undefined { return this.props.sequenceAverage; }
  get coefficient(): number { return this.props.coefficient; }
  get maxValue(): number { return this.props.maxValue; }
  get rejectionReason(): string | undefined { return this.props.rejectionReason; }
  get isOfflineSync(): boolean { return this.props.isOfflineSync; }

  // --- Workflow de validation ---

  // Étape 1 : Enseignant soumet pour validation (DRAFT ou REJECTED → SUBMITTED)
  soumettrePourValidation(): void {
    if (this.props.validationStatus !== 'DRAFT' && this.props.validationStatus !== 'REJECTED') {
      throw new Error(
        `Impossible de soumettre : statut actuel "${this.props.validationStatus}". ` +
        `Seules les notes en DRAFT ou REJECTED peuvent être soumises.`
      );
    }
    if (!this.aAuMoinsUnScore()) {
      throw new Error('Impossible de soumettre une note sans aucun score saisi');
    }
    this.props.validationStatus = 'SUBMITTED';
  }

  // Étape 2a : Censeur/VP valide (SUBMITTED → VALIDATED)
  valider(validateurId: string): void {
    if (this.props.validationStatus !== 'SUBMITTED') {
      throw new Error(
        `Impossible de valider : statut actuel "${this.props.validationStatus}". ` +
        `Seules les notes SUBMITTED peuvent être validées.`
      );
    }
    this.props.validationStatus = 'VALIDATED';
    this.props.validatedById = validateurId;
    this.props.validatedAt = new Date();
    this.props.rejectionReason = undefined;
  }

  // Étape 2b : Censeur/VP rejette (SUBMITTED → REJECTED)
  rejeter(motif: string): void {
    if (this.props.validationStatus !== 'SUBMITTED') {
      throw new Error(
        `Impossible de rejeter : statut actuel "${this.props.validationStatus}". ` +
        `Seules les notes SUBMITTED peuvent être rejetées.`
      );
    }
    if (!motif?.trim()) {
      throw new Error('Un motif de rejet est obligatoire');
    }
    this.props.validationStatus = 'REJECTED';
    this.props.rejectionReason = motif;
    this.props.validatedById = undefined;
    this.props.validatedAt = undefined;
  }

  // Étape 3 : Verrouillage lors de la génération du bulletin (VALIDATED → LOCKED)
  verrouiller(): void {
    if (this.props.validationStatus !== 'VALIDATED') {
      throw new Error(
        `Impossible de verrouiller : la note doit être VALIDATED avant d'être verrouillée.`
      );
    }
    this.props.validationStatus = 'LOCKED';
  }

  // --- Loi 6 : protection sync hors ligne ---

  /**
   * Vérifie si cette note peut être modifiée lors d'une synchronisation hors ligne.
   * Lance NoteValideeSyncError si la note est VALIDATED ou LOCKED.
   */
  verifierModificationHorsLigneAutorisee(matiereNom: string): void {
    if (
      this.props.validationStatus === 'VALIDATED' ||
      this.props.validationStatus === 'LOCKED'
    ) {
      throw new NoteValideeSyncError(this.props.id, matiereNom);
    }
  }

  peutEtreModifiee(): boolean {
    return this.props.validationStatus === 'DRAFT' || this.props.validationStatus === 'REJECTED';
  }

  estValidee(): boolean {
    return this.props.validationStatus === 'VALIDATED';
  }

  estRejetee(): boolean {
    return this.props.validationStatus === 'REJECTED';
  }

  estVerrouillee(): boolean {
    return this.props.validationStatus === 'LOCKED';
  }

  // --- Méthodes de calcul ---

  definirMoyenne(moyenne: number): void {
    if (moyenne < 0 || moyenne > this.props.maxValue) {
      throw new Error(
        `La moyenne ${moyenne} est hors limites (0 - ${this.props.maxValue})`
      );
    }
    this.props.sequenceAverage = moyenne;
  }

  // --- Helpers privés ---

  private aAuMoinsUnScore(): boolean {
    return [
      this.props.sequenceScore,
      this.props.classTestScore,
      this.props.terminalExamScore,
      this.props.theoreticalScore,
      this.props.practicalScore,
      this.props.oralScore,
    ].some(s => s !== undefined && s !== null);
  }

  private static validerScores(props: CreerNoteProps): void {
    const maxVal = props.maxValue ?? 20;
    const scores: { valeur?: number; nom: string }[] = [
      { valeur: props.sequenceScore, nom: 'sequenceScore' },
      { valeur: props.classTestScore, nom: 'classTestScore' },
      { valeur: props.terminalExamScore, nom: 'terminalExamScore' },
      { valeur: props.theoreticalScore, nom: 'theoreticalScore' },
      { valeur: props.practicalScore, nom: 'practicalScore' },
      { valeur: props.professionalAttitude, nom: 'professionalAttitude' },
      { valeur: props.oralScore, nom: 'oralScore' },
      { valeur: props.selfDevelopmentScore, nom: 'selfDevelopmentScore' },
    ];
    for (const { valeur, nom } of scores) {
      if (valeur !== undefined && (valeur < 0 || valeur > maxVal)) {
        throw new Error(`Score invalide pour "${nom}" : ${valeur} (doit être entre 0 et ${maxVal})`);
      }
    }
  }

  // --- Sérialisation ---

  toObject(): NoteProps {
    return { ...this.props };
  }
}
