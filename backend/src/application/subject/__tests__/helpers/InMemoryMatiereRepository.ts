import type {
  MatiereRepository,
  MatiereProps,
  CoefficientMatiere,
} from '@domain/ports/repositories/MatiereRepository';

export class InMemoryMatiereRepository implements MatiereRepository {
  private store = new Map<string, MatiereProps>();
  private coefficients: CoefficientMatiere[] = [];
  private assignations = new Set<string>(); // "teacherId:subjectId"
  syncAppels: { subjectId: string; teacherUserIds: string[] }[] = [];

  ajouter(m: MatiereProps): void { this.store.set(m.id, m); }

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findBySchool(schoolId: string) {
    return [...this.store.values()].filter(m => m.schoolId === schoolId);
  }
  async findByEnseignant(_id: string) { return []; }
  async existsByCode(schoolId: string, code: string, excludeId?: string) {
    return [...this.store.values()].some(
      m => m.schoolId === schoolId && m.code === code && m.id !== excludeId
    );
  }
  async getCoefficientPourClasse(_s: string, _l: string) { return 1; }
  async getCoefficientsBACParSerie(_s: string) { return []; }
  async getCoefficients(_schoolId: string, subjectId: string) {
    return this.coefficients.filter(c => c.subjectId === subjectId);
  }
  async upsertCoefficients(_schoolId: string, coefficients: CoefficientMatiere[]) {
    for (const c of coefficients) {
      const idx = this.coefficients.findIndex(
        x => x.subjectId === c.subjectId &&
             x.classLevel === c.classLevel &&
             x.serieCode === c.serieCode
      );
      if (idx >= 0) this.coefficients[idx] = c;
      else this.coefficients.push(c);
    }
  }
  async estEnseignantAssigne(teacherId: string, subjectId: string) {
    return this.assignations.has(`${teacherId}:${subjectId}`);
  }
  async assignerEnseignant(teacherId: string, subjectId: string) {
    this.assignations.add(`${teacherId}:${subjectId}`);
  }
  async retirerEnseignant(teacherId: string, subjectId: string) {
    this.assignations.delete(`${teacherId}:${subjectId}`);
  }
  async syncEnseignants(subjectId: string, teacherUserIds: string[]) {
    this.syncAppels.push({ subjectId, teacherUserIds });
    for (const key of [...this.assignations]) {
      if (key.endsWith(`:${subjectId}`)) this.assignations.delete(key);
    }
    for (const id of teacherUserIds) this.assignations.add(`${id}:${subjectId}`);
  }
  async save(m: MatiereProps) { this.store.set(m.id, m); }
  async update(m: MatiereProps) { this.store.set(m.id, m); }
  async delete(id: string) { this.store.delete(id); }
}
