import type { ParentRepository, EnfantAvecStats } from '@domain/ports/repositories/ParentRepository';

export class InMemoryParentRepository implements ParentRepository {
  private relations = new Map<string, Set<string>>(); // parentId → Set<studentId>
  private statsEleves = new Map<string, EnfantAvecStats>();

  definirRelation(parentId: string, studentIds: string[]): void {
    this.relations.set(parentId, new Set(studentIds));
  }

  definirStats(studentId: string, stats: EnfantAvecStats): void {
    this.statsEleves.set(studentId, stats);
  }

  async verifierRelationEnfant(parentUserId: string, studentId: string): Promise<void> {
    const enfants = this.relations.get(parentUserId);
    if (!enfants?.has(studentId)) {
      throw new Error('Accès non autorisé : cet élève ne fait pas partie de vos enfants');
    }
  }

  async aAccesEleve(parentUserId: string, studentId: string): Promise<boolean> {
    return this.relations.get(parentUserId)?.has(studentId) ?? false;
  }

  async findEnfantsAvecStats(parentUserId: string, _schoolId: string): Promise<EnfantAvecStats[]> {
    const enfantIds = [...(this.relations.get(parentUserId) ?? [])];
    return enfantIds
      .map(id => this.statsEleves.get(id))
      .filter((s): s is EnfantAvecStats => s !== undefined);
  }
}
