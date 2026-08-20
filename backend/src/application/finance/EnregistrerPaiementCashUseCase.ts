/**
 * APPLICATION LAYER — Use Case : Enregistrer un paiement en espèces (guichet)
 * Contourne Campay — crée directement un paiement SUCCESS.
 * Réservé à ADMIN et STAFF (Intendant, Censeur…).
 *
 * V3.2 « Stratégie de conflits » :
 * - Le client envoie baseUpdatedAt (version de la facture qu'il affiche).
 * - Si la facture a changé entre-temps → ConflitVersionPaiementError (409).
 * - L'encaissement est ATOMIQUE (transaction) : deux encaissements simultanés
 *   ne peuvent pas dépasser le solde.
 * - Jamais de résolution automatique silencieuse : l'humain arbitre.
 */
import { Paiement } from '@domain/entities/Paiement';
import { ConflitVersionPaiementError } from '@domain/errors/ConflitVersionPaiementError';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';

export interface EnregistrerPaiementCashCommande {
  schoolId: string;
  factureId: string;
  studentId: string;
  /** Montant effectivement encaissé. Peut être inférieur au total (paiement partiel). */
  montant: number;
  enregistreurId: string;
  /** Version de la facture telle que lue par le client. Optionnel (compat. rétro). */
  baseUpdatedAt?: Date;
}

export interface EnregistrerPaiementCashResultat {
  paiementId: string;
  nouveauStatutFacture: string;
  totalPaye: number;
  resteARegler: number;
}

export class EnregistrerPaiementCashUseCase {
  constructor(
    private readonly factureRepository: FactureRepository,
    private readonly paiementRepository: PaiementRepository,
  ) {}

  async execute(commande: EnregistrerPaiementCashCommande): Promise<EnregistrerPaiementCashResultat> {
    // 1. Vérifier la facture
    const facture = await this.factureRepository.findById(commande.factureId);
    if (!facture) throw new Error(`Facture introuvable : ${commande.factureId}`);
    if (facture.schoolId !== commande.schoolId) {
      throw new Error("Cette facture n'appartient pas à votre établissement");
    }
    if (!facture.peutEtrePayee()) {
      throw new Error('Cette facture ne peut plus être payée (annulée ou déjà payée)');
    }
    if (commande.montant <= 0) {
      throw new Error('Le montant encaissé doit être supérieur à 0');
    }

    // 1b. Détection de conflit de version — jamais de résolution silencieuse.
    if (commande.baseUpdatedAt && facture.updatedAt) {
      const totalPayeActuel = await this.factureRepository.calculerTotalPayeAvecSucces(commande.factureId);
      if (facture.updatedAt.getTime() !== commande.baseUpdatedAt.getTime()) {
        throw new ConflitVersionPaiementError({
          factureId: commande.factureId,
          versionServeur: facture.updatedAt,
          versionLocale: commande.baseUpdatedAt,
          montantSaisi: commande.montant,
          totalPaye: totalPayeActuel,
          resteARegler: Math.max(0, facture.amount - totalPayeActuel),
        });
      }
    }

    // 2. Créer le paiement cash directement en SUCCESS
    const paiement = Paiement.creerCash({
      schoolId: commande.schoolId,
      invoiceId: commande.factureId,
      studentId: commande.studentId,
      amount: commande.montant,
      enregistreurId: commande.enregistreurId,
    });

    // 3. Encaissement ATOMIQUE : re-vérifie le solde en transaction, met à jour la facture.
    const totalPaye = await this.paiementRepository.encaisserCash(paiement, facture);

    return {
      paiementId: paiement.id,
      nouveauStatutFacture: facture.status,
      totalPaye,
      resteARegler: Math.max(0, facture.amount - totalPaye),
    };
  }
}
