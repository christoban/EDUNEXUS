import type {
  SousGroupeRepository,
  SousGroupeProps,
} from '@domain/ports/repositories/SousGroupeRepository';

export class InMemorySousGroupeRepository implements SousGroupeRepository {
  private store = new Map<string, SousGroupeProps>();
  private assignations = new Map<string, Set<string>>();

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByClasse(classId: string) {
    return [...this.store.values()].filter(s => s.classId === classId);
  }
  async existsByName(classId: string, name: string) {
    return [...this.store.values()].some(s => s.classId === classId && s.name === name);
  }
  async save(s: SousGroupeProps) { this.store.set(s.id, s); }
  async delete(id: string) { this.store.delete(id); }
  async assignerEleves(subGroupId: string, studentProfileIds: string[], _schoolId: string) {
    const existing = this.assignations.get(subGroupId) ?? new Set<string>();
    studentProfileIds.forEach(id => existing.add(id));
    this.assignations.set(subGroupId, existing);
  }
  async getElevesAssignes(subGroupId: string) {
    return [...(this.assignations.get(subGroupId) ?? [])];
  }
}
