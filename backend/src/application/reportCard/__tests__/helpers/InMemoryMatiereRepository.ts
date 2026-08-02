import type { MatiereRepository, MatiereProps } from '@domain/ports/repositories/MatiereRepository';

export class InMemoryMatiereRepository implements MatiereRepository {
  private store = new Map<string, MatiereProps>();
  private assignments = new Set<string>();

  ajouter(matiere: MatiereProps): void { this.store.set(matiere.id, matiere); }

  async findById(id: string): Promise<MatiereProps | null> { return this.store.get(id) ?? null; }

  async findBySchool(schoolId: string): Promise<MatiereProps[]> {
    return [...this.store.values()].filter(m => m.schoolId === schoolId);
  }

  async findByEnseignant(teacherProfileId: string): Promise<MatiereProps[]> {
    const subjectIds = [...this.assignments]
      .filter(k => k.startsWith(`${teacherProfileId}:`))
      .map(k => k.split(':')[1]);
    return [...this.store.values()].filter(m => subjectIds.includes(m.id));
  }

  async getCoefficientPourClasse(subjectId: string, _classLevel: string, _serieCode?: string): Promise<number> {
    return this.store.get(subjectId)?.coefficient ?? 1;
  }

  async getCoefficientsBACParSerie(_serieCode: string): Promise<{ subjectName: string; coefficient: number }[]> {
    return [];
  }

  async estEnseignantAssigne(teacherProfileId: string, subjectId: string): Promise<boolean> {
    return this.assignments.has(`${teacherProfileId}:${subjectId}`);
  }

  async existsByCode(_schoolId: string, _code: string, _excludeId?: string): Promise<boolean> { return false; }
  async getCoefficients(_schoolId: string, _subjectId: string) { return []; }
  async upsertCoefficients(_schoolId: string, _coefficients: any[]): Promise<void> {}
  async retirerEnseignant(teacherProfileId: string, subjectId: string): Promise<void> {
    this.assignments.delete(`${teacherProfileId}:${subjectId}`);
  }
  async syncEnseignants(subjectId: string, teacherUserIds: string[]): Promise<void> {
    for (const key of [...this.assignments]) {
      if (key.endsWith(`:${subjectId}`)) this.assignments.delete(key);
    }
    for (const userId of teacherUserIds) {
      this.assignments.add(`${userId}:${subjectId}`);
    }
  }
  async save(matiere: MatiereProps): Promise<void> { this.store.set(matiere.id, matiere); }
  async update(matiere: MatiereProps): Promise<void> { this.store.set(matiere.id, matiere); }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async restaurer(_id: string): Promise<void> {}
  async assignerEnseignant(teacherProfileId: string, subjectId: string): Promise<void> {
    this.assignments.add(`${teacherProfileId}:${subjectId}`);
  }
}
