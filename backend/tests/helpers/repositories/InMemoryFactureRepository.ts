import { Facture } from '@domain/entities/Facture';
import type { FactureRepository, FactureEnRetard } from '@domain/ports/repositories/FactureRepository';
import type { InvoiceStatus } from '@domain/types/enums';

export class InMemoryFactureRepository implements FactureRepository {
  private store = new Map<string, Facture>();
  private totauxPaies = new Map<string, number>();
  private classesParEleve = new Map<string, string>();

  ajouter(facture: Facture): void {
    this.store.set(facture.id, facture);
  }

  definirTotalPaye(factureId: string, montant: number): void {
    this.totauxPaies.set(factureId, montant);
  }

  definirClasseEleve(studentId: string, classId: string): void {
    this.classesParEleve.set(studentId, classId);
  }

  async findById(id: string): Promise<Facture | null> {
    return this.store.get(id) ?? null;
  }

  async findByEleve(studentId: string): Promise<Facture[]> {
    return [...this.store.values()].filter(f => f.studentId === studentId);
  }

  async findBySchool(schoolId: string): Promise<Facture[]> {
    return [...this.store.values()].filter(f => f.schoolId === schoolId);
  }

  async findByStatut(schoolId: string, statut: InvoiceStatus): Promise<Facture[]> {
    return [...this.store.values()].filter(f => f.schoolId === schoolId && f.status === statut);
  }

  async findByClasse(classId: string): Promise<Facture[]> {
    const studentIds = [...this.classesParEleve.entries()]
      .filter(([, classeId]) => classeId === classId)
      .map(([studentId]) => studentId);

    return [...this.store.values()].filter(facture =>
      studentIds.includes(facture.studentId)
    );
  }

  async findByPlanFrais(feePlanId: string): Promise<Facture[]> {
    return [...this.store.values()].filter(f => f.feePlanId === feePlanId);
  }

  async calculerTotalPayeAvecSucces(factureId: string): Promise<number> {
    return this.totauxPaies.get(factureId) ?? 0;
  }

  async getElevesEnRetard(schoolId: string): Promise<FactureEnRetard[]> {
    const factures = [...this.store.values()].filter(facture => {
      const dueDate = facture.toObject().dueDate;
      return (
        facture.schoolId === schoolId &&
        (facture.status === 'PENDING' ||
          facture.status === 'PARTIAL' ||
          facture.status === 'OVERDUE') &&
        dueDate !== undefined &&
        dueDate < new Date()
      );
    });

    const parEleve = new Map<string, FactureEnRetard>();

    for (const facture of factures) {
      const totalPaye = this.totauxPaies.get(facture.id) ?? 0;
      const existant = parEleve.get(facture.studentId);

      if (existant) {
        existant.totalDu += facture.amount;
        existant.totalPaye += totalPaye;
        existant.solde += facture.amount - totalPaye;
        existant.nombreFacturesEnRetard += 1;
      } else {
        parEleve.set(facture.studentId, {
          studentId: facture.studentId,
          studentNom: facture.studentId,
          totalDu: facture.amount,
          totalPaye,
          solde: facture.amount - totalPaye,
          nombreFacturesEnRetard: 1,
        });
      }
    }

    return [...parEleve.values()];
  }

  async aFactureImpayeeBloquante(studentId: string): Promise<boolean> {
    return [...this.store.values()].some(
      facture =>
        facture.studentId === studentId &&
        (facture.status === 'PENDING' ||
          facture.status === 'PARTIAL' ||
          facture.status === 'OVERDUE')
    );
  }

  async save(facture: Facture): Promise<void> {
    this.store.set(facture.id, facture);
  }

  async update(facture: Facture): Promise<void> {
    this.store.set(facture.id, facture);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
