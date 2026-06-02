import { Paiement } from '@domain/entities/Paiement';
import type { PaiementRepository, RevenusParPeriode } from '@domain/ports/repositories/PaiementRepository';

export class InMemoryPaiementRepository implements PaiementRepository {
  private store = new Map<string, Paiement>();

  ajouter(p: Paiement): void { this.store.set(p.id, p); }
  parRef(ref: string): Paiement | undefined {
    return [...this.store.values()].find(p => p.campayRef === ref);
  }

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findByFacture(factureId: string) {
    return [...this.store.values()].filter(p => p.invoiceId === factureId);
  }
  async findByEleve(studentId: string) {
    return [...this.store.values()].filter(p => p.studentId === studentId);
  }
  async findByCampayRef(ref: string) {
    return [...this.store.values()].find(p => p.campayRef === ref) ?? null;
  }
  async existePaiementEnAttente(factureId: string) {
    return [...this.store.values()]
      .some(p => p.invoiceId === factureId && p.estEnAttente());
  }
  async findCautionsActives(schoolId: string) {
    return [...this.store.values()]
      .filter(p => p.schoolId === schoolId && p.estCaution() && p.cautionStatus === 'HELD');
  }
  async getRevenusParPeriode(_schoolId: string, _d: Date, _f: Date): Promise<RevenusParPeriode> {
    return { total: 0, nombrePaiements: 0, parMethode: {} };
  }
  async save(p: Paiement) { this.store.set(p.id, p); }
  async update(p: Paiement) { this.store.set(p.id, p); }
}
