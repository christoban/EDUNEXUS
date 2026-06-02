import type {
  PromotionRepository,
  ClassPromotionMapping,
  DecisionConseil,
  PromotionEleveParams,
} from '@domain/ports/repositories/PromotionRepository';

export class InMemoryPromotionRepository implements PromotionRepository {
  private mappings: ClassPromotionMapping[] = [];
  private decisions: DecisionConseil[] = [];
  promotionsEnregistrees: PromotionEleveParams[] = [];
  classesEleves = new Map<string, string>();

  definirMappings(m: ClassPromotionMapping[]): void { this.mappings = m; }
  definirDecisions(d: DecisionConseil[]): void { this.decisions = d; }

  async findMappingsPromotion(_schoolId: string, _yearId: string) { return this.mappings; }
  async findDecisionsEleves(_schoolId: string, _yearId: string) { return this.decisions; }
  async promouvoirEleve(params: PromotionEleveParams) {
    this.promotionsEnregistrees.push(params);
  }
  async mettreAJourClasseEleve(studentId: string, classId: string) {
    this.classesEleves.set(studentId, classId);
  }
  async countPromotions(_schoolId: string, _yearId: string) {
    const promus = this.promotionsEnregistrees.filter(p => p.fromClassId !== p.toClassId).length;
    const redoublants = this.promotionsEnregistrees.filter(p => p.fromClassId === p.toClassId).length;
    return { promus, redoublants };
  }
}
