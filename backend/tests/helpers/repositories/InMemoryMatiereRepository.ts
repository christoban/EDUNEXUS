import type {
  MatiereRepository,
  MatiereProps,
  CoefficientMatiere,
} from '@domain/ports/repositories/MatiereRepository';

export class InMemoryMatiereRepository implements MatiereRepository {
  private store = new Map<string, MatiereProps>();
  private assignments = new Set<string>();
  private coefficients: CoefficientMatiere[] = [];
  syncAppels: { subjectId: string; teacherUserIds: string[] }[] = [];

  ajouter(matiere: MatiereProps): void {
    this.store.set(matiere.id, matiere);
  }

  async findById(id: string): Promise<MatiereProps | null> {
    return this.store.get(id) ?? null;
  }

  async findBySchool(schoolId: string): Promise<MatiereProps[]> {
    return [...this.store.values()].filter(m => m.schoolId === schoolId);
  }

  async findByEnseignant(teacherProfileId: string): Promise<MatiereProps[]> {
    const subjectIds = [...this.assignments]
      .filter(key => key.startsWith(`${teacherProfileId}:`))
      .map(key => key.split(':')[1]);

    return [...this.store.values()].filter(m => subjectIds.includes(m.id));
  }

  async getCoefficientPourClasse(
    subjectId: string,
    _classLevel: string,
    _serieCode?: string
  ): Promise<number> {
    return this.store.get(subjectId)?.coefficient ?? 1;
  }

  async getCoefficientsBACParSerie(
    _serieCode: string
  ): Promise<{ subjectName: string; coefficient: number }[]> {
    return [];
  }

  async estEnseignantAssigne(
    teacherProfileId: string,
    subjectId: string
  ): Promise<boolean> {
    return this.assignments.has(`${teacherProfileId}:${subjectId}`);
  }

  async existsByCode(
    schoolId: string,
    code: string,
    excludeId?: string
  ): Promise<boolean> {
    return [...this.store.values()].some(
      m => m.schoolId === schoolId && m.code === code && m.id !== excludeId
    );
  }

  async getCoefficients(
    _schoolId: string,
    subjectId: string
  ): Promise<CoefficientMatiere[]> {
    return this.coefficients.filter(c => c.subjectId === subjectId);
  }

  async upsertCoefficients(
    _schoolId: string,
    coefficients: CoefficientMatiere[]
  ): Promise<void> {
    for (const coefficient of coefficients) {
      const index = this.coefficients.findIndex(
        existing =>
          existing.subjectId === coefficient.subjectId &&
          existing.classLevel === coefficient.classLevel &&
          existing.serieCode === coefficient.serieCode
      );

      if (index >= 0) {
        this.coefficients[index] = coefficient;
      } else {
        this.coefficients.push(coefficient);
      }
    }
  }

  async retirerEnseignant(
    teacherProfileId: string,
    subjectId: string
  ): Promise<void> {
    this.assignments.delete(`${teacherProfileId}:${subjectId}`);
  }

  async syncEnseignants(
    subjectId: string,
    teacherUserIds: string[]
  ): Promise<void> {
    this.syncAppels.push({ subjectId, teacherUserIds });

    for (const key of [...this.assignments]) {
      if (key.endsWith(`:${subjectId}`)) {
        this.assignments.delete(key);
      }
    }

    for (const userId of teacherUserIds) {
      this.assignments.add(`${userId}:${subjectId}`);
    }
  }

  async save(matiere: MatiereProps): Promise<void> {
    this.store.set(matiere.id, matiere);
  }

  async update(matiere: MatiereProps): Promise<void> {
    this.store.set(matiere.id, matiere);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async restaurer(_id: string): Promise<void> {}

  async assignerEnseignant(
    teacherProfileId: string,
    subjectId: string
  ): Promise<void> {
    this.assignments.add(`${teacherProfileId}:${subjectId}`);
  }
}
