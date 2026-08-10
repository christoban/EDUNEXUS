import { Classe } from '@domain/entities/Classe';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export class InMemoryClasseRepository implements ClasseRepository {
  private store = new Map<string, Classe>();

  ajouter(c: Classe): void { this.store.set(c.id, c); }

  async findById(id: string): Promise<Classe | null> { return this.store.get(id) ?? null; }

  async findBySchool(schoolId: string): Promise<Classe[]> {
    return [...this.store.values()].filter(c => c.schoolId === schoolId);
  }

  async findBySection(sectionId: string): Promise<Classe[]> {
    return [...this.store.values()].filter(c => c.sectionId === sectionId);
  }

  async findByLevel(schoolId: string, level: string): Promise<Classe[]> {
    return [...this.store.values()].filter(c => c.schoolId === schoolId && c.level === level);
  }

  async findBySchoolAndYear(schoolId: string, academicYearId: string): Promise<Classe[]> {
    return [...this.store.values()].filter(c => c.schoolId === schoolId && c.academicYearId === academicYearId);
  }

  async annulerPropositionAnnee(schoolId: string, academicYearId: string): Promise<string[]> {
    const draftClasses = [...this.store.values()].filter(
      c => c.schoolId === schoolId && c.academicYearId === academicYearId && c.status === 'DRAFT'
    );
    const ids = draftClasses.map(c => c.id);
    for (const id of ids) this.store.delete(id);
    return ids;
  }

  async activerToutesDraft(schoolId: string, academicYearId: string): Promise<number> {
    const draftClasses = [...this.store.values()].filter(
      c => c.schoolId === schoolId && c.academicYearId === academicYearId && c.status === 'DRAFT'
    );
    for (const c of draftClasses) c.activer();
    return draftClasses.length;
  }

  async countEleves(_classeId: string): Promise<number> { return 0; }
  async existsByName(_schoolId: string, _name: string, _excludeId?: string): Promise<boolean> { return false; }
  async save(c: Classe): Promise<void> { this.store.set(c.id, c); }
  async update(c: Classe): Promise<void> { this.store.set(c.id, c); }
  async delete(id: string): Promise<void> { this.store.delete(id); }
  async supprimerAvecCascade(id: string): Promise<void> { this.store.delete(id); }
  async restaurer(_id: string): Promise<void> {}
  async findClasseDeProfPrincipal(_teacherUserId: string): Promise<Classe | null> { return null; }
}
