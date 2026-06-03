import type {
  ExamenRepository,
  ExamenProps,
  SoumissionProps,
} from '@domain/ports/repositories/ExamenRepository';

export class InMemoryExamenRepository implements ExamenRepository {
  private examens = new Map<string, ExamenProps>();
  private soumissions = new Map<string, SoumissionProps>();

  ajouter(e: ExamenProps): void { this.examens.set(e.id, e); }

  async findById(id: string): Promise<ExamenProps | null> {
    return this.examens.get(id) ?? null;
  }

  async findByClasse(classId: string, yearId: string): Promise<ExamenProps[]> {
    return [...this.examens.values()].filter(
      e => e.classId === classId && e.academicYearId === yearId
    );
  }

  async findByEnseignant(_t: string, _s: string): Promise<ExamenProps[]> {
    return [];
  }

  async save(e: ExamenProps): Promise<void> { this.examens.set(e.id, e); }
  async update(e: ExamenProps): Promise<void> { this.examens.set(e.id, e); }
  async delete(id: string): Promise<void> { this.examens.delete(id); }

  async findSoumission(examId: string, studentId: string): Promise<SoumissionProps | null> {
    const key = `${examId}:${studentId}`;
    return this.soumissions.get(key) ?? null;
  }

  async saveSoumission(s: SoumissionProps): Promise<void> {
    this.soumissions.set(`${s.examId}:${s.studentId}`, s);
  }

  async deleteSoumissions(examId: string): Promise<void> {
    for (const key of [...this.soumissions.keys()]) {
      if (key.startsWith(`${examId}:`)) this.soumissions.delete(key);
    }
  }

  getSoumissions(): SoumissionProps[] { return [...this.soumissions.values()]; }
}
