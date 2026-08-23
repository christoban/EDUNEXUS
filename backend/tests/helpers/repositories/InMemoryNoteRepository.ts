import { Note } from '@domain/entities/Note';
import type { NoteRepository, NoteNonValideeInfo } from '@domain/ports/repositories/NoteRepository';
import type { GradeValidationStatus } from '@domain/types/enums';

export class InMemoryNoteRepository implements NoteRepository {
  private store = new Map<string, Note>();
  private nonValidees: NoteNonValideeInfo[] = [];
  private nonValideesSet = false;
  private sequencePeriods = new Map<string, string>();

  ajouter(note: Note): void {
    this.store.set(note.id, note);
  }

  setNonValidees(notes: NoteNonValideeInfo[]): void {
    this.nonValidees = notes;
    this.nonValideesSet = true;
  }

  setSequenceAcademicPeriod(sequenceId: string, academicPeriodId: string): void {
    this.sequencePeriods.set(sequenceId, academicPeriodId);
  }

  async findById(id: string, schoolId: string): Promise<Note | null> {
    const note = this.store.get(id);
    return note && note.schoolId === schoolId ? note : null;
  }

  async findByEleve(studentId: string, academicYearId: string): Promise<Note[]> {
    return [...this.store.values()].filter(
      n => n.toObject().studentId === studentId && n.toObject().academicYearId === academicYearId
    );
  }

  async findByClasse(classId: string, sequenceId: string): Promise<Note[]> {
    return [...this.store.values()].filter(
      n => n.toObject().classId === classId && n.toObject().sequenceId === sequenceId
    );
  }

  async findByEnseignant(teacherId: string, sequenceId: string): Promise<Note[]> {
    return [...this.store.values()].filter(
      n => n.toObject().recordedById === teacherId && n.toObject().sequenceId === sequenceId
    );
  }

  async findByEleveEtMatiere(
    studentId: string,
    subjectId: string,
    sequenceId: string
  ): Promise<Note | null> {
    return (
      [...this.store.values()].find(
        n =>
          n.toObject().studentId === studentId &&
          n.toObject().subjectId === subjectId &&
          n.toObject().sequenceId === sequenceId
      ) ?? null
    );
  }

  async findByStatut(
    classId: string,
    sequenceId: string,
    statut: GradeValidationStatus
  ): Promise<Note[]> {
    return [...this.store.values()].filter(
      n =>
        n.toObject().classId === classId &&
        n.toObject().sequenceId === sequenceId &&
        n.validationStatus === statut
    );
  }

  async findNotesNonValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<NoteNonValideeInfo[]> {
    if (this.nonValideesSet) {
      return this.nonValidees;
    }

    return [...this.store.values()]
      .filter(
        note =>
          note.toObject().classId === classId &&
          this.sequencePeriods.get(note.toObject().sequenceId) === academicPeriodId &&
          (note.validationStatus === 'DRAFT' || note.validationStatus === 'SUBMITTED')
      )
      .map(note => ({
        matiereNom: note.toObject().subjectId,
        enseignantNom: note.toObject().recordedById ?? '',
        statut: note.validationStatus,
      }));
  }

  async toutesNotesValideesParClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<boolean> {
    if (this.nonValideesSet) {
      return this.nonValidees.length === 0;
    }

    const nonValidees = await this.findNotesNonValideesParClasse(classId, academicPeriodId);
    return nonValidees.length === 0;
  }

  async save(note: Note): Promise<void> {
    this.store.set(note.id, note);
  }

  async update(note: Note): Promise<void> {
    this.store.set(note.id, note);
  }

  async updateStatut(
    noteId: string,
    statut: GradeValidationStatus,
    validateurId?: string,
    _motif?: string
  ): Promise<void> {
    const note = this.store.get(noteId);
    if (!note) return;

    const props = note.toObject();
    this.store.set(
      noteId,
      Note.reconstituer({
        ...props,
        validationStatus: statut,
        validatedById: validateurId,
      })
    );
  }

  async findNotesEnAttenteDepuis(heures: number): Promise<Note[]> {
    const depuis = new Date(Date.now() - heures * 60 * 60 * 1000);

    return [...this.store.values()].filter(
      note =>
        note.validationStatus === 'SUBMITTED' && note.toObject().createdAt <= depuis
    );
  }

  async verrouillerNotesValidees(
    studentId: string,
    classId: string,
    academicPeriodId: string
  ): Promise<void> {
    for (const note of this.store.values()) {
      const data = note.toObject();
      if (
        data.studentId === studentId &&
        data.classId === classId &&
        this.sequencePeriods.get(data.sequenceId) === academicPeriodId &&
        data.validationStatus === 'VALIDATED'
      ) {
        note.verrouiller();
      }
    }
  }

  compter(): number {
    return this.store.size;
  }
}
