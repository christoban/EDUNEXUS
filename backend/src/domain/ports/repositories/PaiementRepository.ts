/**
 * DOMAIN LAYER — Port Repository Paiement (Payment)
 */
import type { Paiement } from '@domain/entities/Paiement';
import type { PaymentMethod } from '@domain/types/enums';

export interface RevenusParPeriode {
  total: number;
  nombrePaiements: number;
  parMethode: Record<string, number>;
}

export interface PaiementRepository {
  findById(id: string): Promise<Paiement | null>;
  findByFacture(factureId: string): Promise<Paiement[]>;
  findByEleve(studentId: string): Promise<Paiement[]>;
  findByCampayRef(campayRef: string): Promise<Paiement | null>;

  /**
   * Vérifie s'il existe déjà un paiement PENDING pour cette facture.
   * Évite les doublons de tentatives Mobile Money.
   */
  existePaiementEnAttente(factureId: string): Promise<boolean>;

  /**
   * Retourne les cautions actives (HELD) d'une école.
   * Utilisé pour le dashboard cautions de l'Intendant.
   */
  findCautionsActives(schoolId: string): Promise<Paiement[]>;

  /**
   * Calcule les revenus sur une période pour le reporting.
   */
  getRevenusParPeriode(
    schoolId: string,
    debut: Date,
    fin: Date
  ): Promise<RevenusParPeriode>;

  save(paiement: Paiement): Promise<void>;
  update(paiement: Paiement): Promise<void>;
}
