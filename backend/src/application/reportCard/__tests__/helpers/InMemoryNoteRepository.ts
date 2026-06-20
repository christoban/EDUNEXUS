import { Note } from '@domain/entities/Note';
import type { NoteRepository, NoteNonValideeInfo } from '@domain/ports/repositories/NoteRepository';
import type { GradeValidationStatus } from '@domain/types/enums';

export class InMemoryNoteRepository implements NoteRepository {
  private store = new Map<string, Note>();
  private nonValidees: NoteNonValideeInfo[] = [];

  ajouter(note: Note): void { this.store.set(note.id, note); }
  setNonValidees(notes: NoteNonValideeInfo[]): void { this.nonValidees = notes; }

  async findById(id: string): Promise<Note | null> { return this.store.get(id) ?? null; }

  async findByEleve(studentId: string, academicYearId: string): Promise<Note[]> {
    return [...this.store.values()].filter(
      n => n.toObject().studentId === studentId && n.toObject().academicYearId === academicYearId
    );
  }

  async findByClasse(_classId: string, _sequenceId: string): Promise<Note[]> { return []; }
  async findByEnseignant(_teacherId: string, _sequenceId: string): Promise<Note[]> { return []; }
  async findByEleveEtMatiere(_studentId: string, _subjectId: string, _sequenceId: string): Promise<Note | null> { return null; }
  async findByStatut(_classId: string, _sequenceId: string, _statut: GradeValidationStatus): Promise<Note[]> { return []; }

  async findNotesNonValideesParClasse(_classId: string, _academicPeriodId: string): Promise<NoteNonValideeInfo[]> {
    return this.nonValidees;
  }

  async toutesNotesValideesParClasse(_classId: string, _academicPeriodId: string): Promise<boolean> {
    return this.nonValidees.length === 0;
  }

  async save(note: Note): Promise<void> { this.store.set(note.id, note); }
  async update(note: Note): Promise<void> { this.store.set(note.id, note); }
  async updateStatut(_noteId: string, _statut: GradeValidationStatus, _validateurId?: string, _motif?: string): Promise<void> {}
  async findNotesEnAttenteDepuis(_heures: number): Promise<Note[]> { return []; }
  async verrouillerNotesValidees(_studentId: string, _classId: string, _academicPeriodId: string): Promise<void> {}
}
