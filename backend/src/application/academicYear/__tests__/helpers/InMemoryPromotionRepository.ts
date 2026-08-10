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
  async creerMappingsPromotion(mappings: (ClassPromotionMapping & { schoolId: string; academicYearId: string })[]) {
    this.mappings.push(...mappings.map(m => ({ fromClassId: m.fromClassId, toClassId: m.toClassId })));
  }
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

  classesCibleOrientation = new Map<string, string>();
  definirClasseCibleOrientation(studentId: string, classId: string): void { this.classesCibleOrientation.set(studentId, classId); }
  async findClasseCibleOrientation(_schoolId: string, studentId: string, _yearId: string) {
    return this.classesCibleOrientation.get(studentId) ?? null;
  }

  async supprimerMappingsVersClasses(toClassIds: string[]) {
    this.mappings = this.mappings.filter(m => !toClassIds.includes(m.toClassId));
  }
}
