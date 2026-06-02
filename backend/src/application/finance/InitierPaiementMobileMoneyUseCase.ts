/**
 * APPLICATION LAYER — Use Case : Initier un paiement Mobile Money
 * Appelle Campay via PaiementService.
 * Empêche les doublons de tentatives PENDING.
 */
import { Paiement } from '@domain/entities/Paiement';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PaiementRepository } from '@domain/ports/repositories/PaiementRepository';
import type { PaiementService } from '@domain/ports/services/PaiementService';
import type { PaymentMethod } from '@domain/types/enums';

export interface InitierPaiementCommande {
  schoolId: string;
  factureId: string;
  studentId: string;
  phoneNumber: string;
  method: PaymentMethod;
}

export interface InitierPaiementResultat {
  paiementId: string;
  campayRef: string;
  statut: string;
}

export class InitierPaiementMobileMoneyUseCase {
  constructor(
    private readonly factureRepository: FactureRepository,
    private readonly paiementRepository: PaiementRepository,
    private readonly paiementService: PaiementService,
  ) {}

  async execute(commande: InitierPaiementCommande): Promise<InitierPaiementResultat> {
    // 1. Vérifier la facture
    const facture = await this.factureRepository.findById(commande.factureId);
    if (!facture) throw new Error(`Facture introuvable : ${commande.factureId}`);
    if (!facture.peutEtrePayee()) {
      throw new Error('Cette facture ne peut plus être payée (annulée ou déjà payée)');
    }

    // 2. Éviter les doublons — pas deux PENDING pour la même facture
    const dejaEnAttente = await this.paiementRepository.existePaiementEnAttente(
      commande.factureId
    );
    if (dejaEnAttente) {
      throw new Error(
        'Un paiement est déjà en cours pour cette facture. Attendez la confirmation.'
      );
    }

    // 3. Initier via Campay
    const resultatCampay = await this.paiementService.initierPaiement({
      montant: facture.amount,
      devise: 'XAF',
      telephone: commande.phoneNumber,
      methode: commande.method,
      description: `Paiement facture ${commande.factureId}`,
      referenceInterne: commande.factureId,
      schoolId: commande.schoolId,
    });

    // 4. Créer le paiement en PENDING
    const paiement = Paiement.create({
      schoolId: commande.schoolId,
      invoiceId: commande.factureId,
      studentId: commande.studentId,
      amount: facture.amount,
      method: commande.method,
      feeType: 'TUITION',
      campayRef: resultatCampay.reference,
      phoneNumber: commande.phoneNumber,
    });

    await this.paiementRepository.save(paiement);

    return {
      paiementId: paiement.id,
      campayRef: resultatCampay.reference,
      statut: resultatCampay.statut,
    };
  }
}
