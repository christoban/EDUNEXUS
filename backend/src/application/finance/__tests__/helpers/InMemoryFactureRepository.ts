import { Facture } from '@domain/entities/Facture';
import type { FactureRepository, FactureEnRetard } from '@domain/ports/repositories/FactureRepository';
import type { InvoiceStatus } from '@domain/types/enums';

export class InMemoryFactureRepository implements FactureRepository {
  private store = new Map<string, Facture>();
  private totauxPaies = new Map<string, number>();

  ajouter(facture: Facture): void { this.store.set(facture.id, facture); }
  definirTotalPaye(factureId: string, montant: number): void {
    this.totauxPaies.set(factureId, montant);
  }

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByEleve(studentId: string) {
    return [...this.store.values()].filter(f => f.studentId === studentId);
  }
  async findBySchool(schoolId: string) {
    return [...this.store.values()].filter(f => f.schoolId === schoolId);
  }
  async findByStatut(schoolId: string, statut: InvoiceStatus) {
    return [...this.store.values()].filter(f => f.schoolId === schoolId && f.status === statut);
  }
  async findByClasse(_classId: string) { return []; }
  async findByPlanFrais(feePlanId: string) {
    return [...this.store.values()].filter(f => f.feePlanId === feePlanId);
  }
  async calculerTotalPayeAvecSucces(factureId: string) {
    return this.totauxPaies.get(factureId) ?? 0;
  }
  async getElevesEnRetard(_schoolId: string): Promise<FactureEnRetard[]> { return []; }
  async aFactureImpayeeBloquante(_studentId: string) { return false; }
  async save(facture: Facture) { this.store.set(facture.id, facture); }
  async update(facture: Facture) { this.store.set(facture.id, facture); }
  async delete(id: string) { this.store.delete(id); }
}
