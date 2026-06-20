import { Note } from '@domain/entities/Note';
import type { NoteRepository, NoteNonValideeInfo } from '@domain/ports/repositories/NoteRepository';
import type { GradeValidationStatus } from '@domain/types/enums';

export class InMemoryNoteRepository implements NoteRepository {
  private nonValidees: NoteNonValideeInfo[] = [];

  setNonValidees(notes: NoteNonValideeInfo[]): void { this.nonValidees = notes; }

  async findById(_id: string): Promise<Note | null> { return null; }
  async findByEleve(_studentId: string, _academicYearId: string): Promise<Note[]> { return []; }
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

  async save(_note: Note): Promise<void> {}
  async update(_note: Note): Promise<void> {}
  async updateStatut(_noteId: string, _statut: GradeValidationStatus, _validateurId?: string, _motif?: string): Promise<void> {}
  async findNotesEnAttenteDepuis(_heures: number): Promise<Note[]> { return []; }
  async verrouillerNotesValidees(_studentId: string, _classId: string, _academicPeriodId: string): Promise<void> {}
}
