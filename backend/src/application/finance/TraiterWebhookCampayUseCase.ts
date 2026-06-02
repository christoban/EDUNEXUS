/**
 * APPLICATION LAYER — Use Case : Traiter le webhook Campay
 * Confirme ou rejette un paiement Mobile Money.
 * Met à jour le statut de la facture (correction bug : filtre SUCCESS).
 */
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { DonneeWebhook } from '@domain/ports/services/PaiementService';

export class TraiterWebhookCampayUseCase {
  constructor(
    private readonly paiementRepository: PaiementRepository,
    private readonly factureRepository: FactureRepository,
  ) {}

  async execute(donnees: DonneeWebhook): Promise<void> {
    // 1. Retrouver le paiement via la référence Campay
    const paiement = await this.paiementRepository.findByCampayRef(donnees.campayRef);
    if (!paiement) {
      throw new Error(`Paiement introuvable pour la référence Campay : ${donnees.campayRef}`);
    }

    if (donnees.statut === 'SUCCESS') {
      // 2a. Confirmer le paiement (entité vérifie la transition)
      paiement.confirmer(donnees.campayRef, donnees.operateurRef);
      await this.paiementRepository.update(paiement);

      // 3. Recalculer le statut de la facture
      // Correction du bug : calculerTotalPayeAvecSucces filtre uniquement SUCCESS
      if (paiement.invoiceId) {
        const facture = await this.factureRepository.findById(paiement.invoiceId);
        if (facture) {
          const totalPaye = await this.factureRepository.calculerTotalPayeAvecSucces(
            paiement.invoiceId
          );
          facture.mettreAJourStatut(totalPaye);
          await this.factureRepository.update(facture);
        }
      }
    } else {
      // 2b. Marquer le paiement comme échoué
      paiement.marquerEchoue();
      await this.paiementRepository.update(paiement);
    }
  }
}
