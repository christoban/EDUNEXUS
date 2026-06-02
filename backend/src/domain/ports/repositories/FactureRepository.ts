/**
 * DOMAIN LAYER — Port Repository Facture (Invoice)
 */
import type { Facture } from '@domain/entities/Facture';
import type { InvoiceStatus } from '@domain/types/enums';

export interface FactureEnRetard {
  studentId: string;
  studentNom: string;
  totalDu: number;
  totalPaye: number;
  solde: number;
  nombreFacturesEnRetard: number;
}

export interface FactureRepository {
  findById(id: string): Promise<Facture | null>;
  findByEleve(studentId: string): Promise<Facture[]>;
  findBySchool(schoolId: string): Promise<Facture[]>;
  findByStatut(schoolId: string, statut: InvoiceStatus): Promise<Facture[]>;
  findByClasse(classId: string): Promise<Facture[]>;
  findByPlanFrais(feePlanId: string): Promise<Facture[]>;

  /**
   * Somme UNIQUEMENT les paiements SUCCESS pour une facture.
   * Correction du bug loadInvoiceTotals() qui comptait tous les statuts.
   */
  calculerTotalPayeAvecSucces(factureId: string): Promise<number>;

  /**
   * Retourne les élèves avec factures en retard et leur solde.
   * Utilisé pour le dashboard Intendant.
   */
  getElevesEnRetard(schoolId: string): Promise<FactureEnRetard[]>;

  /**
   * Vérifie si un élève a une facture impayée bloquante
   * (pour blocage inscription examen, FENASCO, etc.)
   */
  aFactureImpayeeBloquante(studentId: string): Promise<boolean>;

  save(facture: Facture): Promise<void>;
  update(facture: Facture): Promise<void>;
  delete(id: string): Promise<void>;
}
