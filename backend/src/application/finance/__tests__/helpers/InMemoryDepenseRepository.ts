import { Depense } from '@domain/entities/Depense';
import type { DepenseRepository } from '@domain/ports/repositories/DepenseRepository';

export class InMemoryDepenseRepository implements DepenseRepository {
  private store = new Map<string, Depense>();

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findBySchool(schoolId: string) {
    return [...this.store.values()].filter(d => d.schoolId === schoolId);
  }
  async findByCategorie(schoolId: string, _cat: string) {
    return [...this.store.values()].filter(d => d.schoolId === schoolId);
  }
  async findByPeriode(_s: string, _d: Date, _f: Date) { return []; }
  async getTotalDepenses(_s: string) { return 0; }
  async save(d: Depense) { this.store.set(d.id, d); }
  async update(d: Depense) { this.store.set(d.id, d); }
  async delete(id: string) { this.store.delete(id); }
}
