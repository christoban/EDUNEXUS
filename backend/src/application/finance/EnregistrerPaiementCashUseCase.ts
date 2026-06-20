/**
 * APPLICATION LAYER — Use Case : Enregistrer un paiement en espèces (guichet)
 * Contourne Campay — crée directement un paiement SUCCESS.
 * Réservé à ADMIN et STAFF (Intendant, Censeur…).
 */
import { Paiement } from '@domain/entities/Paiement';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';

export interface EnregistrerPaiementCashCommande {
  schoolId: string;
  factureId: string;
  studentId: string;
  /** Montant effectivement encaissé. Peut être inférieur au total (paiement partiel). */
  montant: number;
  enregistreurId: string;
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
    if (commande.montant > facture.amount) {
      throw new Error(`Le montant encaissé (${commande.montant}) dépasse le total de la facture (${facture.amount})`);
    }

    // 2. Créer le paiement cash directement en SUCCESS
    const paiement = Paiement.creerCash({
      schoolId: commande.schoolId,
      invoiceId: commande.factureId,
      studentId: commande.studentId,
      amount: commande.montant,
      enregistreurId: commande.enregistreurId,
    });

    await this.paiementRepository.save(paiement);

    // 3. Recalculer le statut de la facture
    const totalPaye = await this.factureRepository.calculerTotalPayeAvecSucces(commande.factureId);
    facture.mettreAJourStatut(totalPaye);
    await this.factureRepository.update(facture);

    return {
      paiementId: paiement.id,
      nouveauStatutFacture: facture.status,
      totalPaye,
      resteARegler: Math.max(0, facture.amount - totalPaye),
    };
  }
}
