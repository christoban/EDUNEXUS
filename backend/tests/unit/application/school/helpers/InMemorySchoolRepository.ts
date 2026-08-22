import { School } from '@domain/entities/School';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { SchoolStatus } from '@domain/types/enums';

export class InMemorySchoolRepository implements SchoolRepository {
  private store = new Map<string, School>();

  ajouter(s: School): void { this.store.set(s.id, s); }

  async findById(id: string): Promise<School | null> { return this.store.get(id) ?? null; }

  async findBySubdomain(subdomain: string): Promise<School | null> {
    return [...this.store.values()].find(s => s.subdomain === subdomain) ?? null;
  }

  async findAll(): Promise<School[]> { return [...this.store.values()]; }

  async findByStatus(status: SchoolStatus): Promise<School[]> {
    return [...this.store.values()].filter(s => s.status === status);
  }

  async existsBySubdomain(subdomain: string): Promise<boolean> {
    return [...this.store.values()].some(s => s.subdomain === subdomain);
  }

  async save(s: School): Promise<void> { this.store.set(s.id, s); }
  async update(s: School): Promise<void> { this.store.set(s.id, s); }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async countByStatus(_status: SchoolStatus): Promise<number> { return 0; }
  async countEleves(_schoolId: string): Promise<number> { return 0; }
}
