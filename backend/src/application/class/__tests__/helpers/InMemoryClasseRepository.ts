import { Classe } from '@domain/entities/Classe';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export class InMemoryClasseRepository implements ClasseRepository {
  private store = new Map<string, Classe>();
  supprimerAppels: string[] = [];

  ajouter(c: Classe): void { this.store.set(c.id, c); }
  vider(): void { this.store.clear(); }

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findBySchool(schoolId: string) {
    return [...this.store.values()].filter(c => c.schoolId === schoolId);
  }
  async findBySection(sectionId: string) {
    return [...this.store.values()].filter(c => c.sectionId === sectionId);
  }
  async findByLevel(schoolId: string, level: string) {
    return [...this.store.values()].filter(c => c.schoolId === schoolId && c.level === level);
  }
  async countEleves(_classeId: string) { return 0; }
  async existsByName(schoolId: string, name: string, excludeId?: string) {
    return [...this.store.values()].some(
      c => c.schoolId === schoolId && c.name === name && c.id !== excludeId
    );
  }
  async save(c: Classe) { this.store.set(c.id, c); }
  async update(c: Classe) { this.store.set(c.id, c); }
  async delete(id: string) { this.store.delete(id); }
  async supprimerAvecCascade(classeId: string) {
    this.supprimerAppels.push(classeId);
    this.store.delete(classeId);
  }
  async restaurer(_classeId: string) {}
  async findClasseDeProfPrincipal(_teacherUserId: string) { return null; }
}
