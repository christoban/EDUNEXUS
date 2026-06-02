import { PlanFrais } from '@domain/entities/PlanFrais';
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { FeeType } from '@domain/types/enums';

export class InMemoryPlanFraisRepository implements PlanFraisRepository {
  private store = new Map<string, PlanFrais>();
  private seuilPremierCycle = 7500;
  private seuilSecondCycle = 10000;

  ajouter(plan: PlanFrais): void { this.store.set(plan.id, plan); }
  definirSeuils(premier: number, second: number): void {
    this.seuilPremierCycle = premier;
    this.seuilSecondCycle = second;
  }

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findBySchool(schoolId: string) {
    return [...this.store.values()].filter(p => p.schoolId === schoolId);
  }
  async findByType(schoolId: string, feeType: FeeType) {
    return [...this.store.values()].filter(p => p.schoolId === schoolId && p.feeType === feeType);
  }
  async findByLevel(schoolId: string, level: string) {
    return [...this.store.values()].filter(p => p.schoolId === schoolId && p.level === level);
  }
  async getSeuilLegalTuition(_schoolId: string, cycle: 'FIRST' | 'SECOND') {
    return cycle === 'FIRST' ? this.seuilPremierCycle : this.seuilSecondCycle;
  }
  async save(plan: PlanFrais) { this.store.set(plan.id, plan); }
  async update(plan: PlanFrais) { this.store.set(plan.id, plan); }
  async delete(id: string) { this.store.delete(id); }
}
