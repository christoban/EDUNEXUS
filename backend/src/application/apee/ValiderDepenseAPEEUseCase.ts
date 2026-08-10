/**
 * APPLICATION — Use case : valider une dépense APEE. Refuse toute validation tant qu'aucun
 * justificatif n'a été joint (règle du Module 11 de la carte : "chaque dépense APEE exige un
 * justificatif joint avant validation") — protège contre une dépense fantôme ou non tracée.
 */
import type { PrismaClient } from '@prisma/client';

export interface ValiderDepenseAPEECommande {
  schoolId: string;
  transactionId: string;
  valideParId: string;
}

export class ValiderDepenseAPEEUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ValiderDepenseAPEECommande) {
    const transaction = await this.prisma.aPEETransaction.findFirst({
      where: { id: cmd.transactionId, schoolId: cmd.schoolId },
    });

    if (!transaction) {
      throw new Error('Transaction APEE introuvable.');
    }
    if (transaction.type !== 'DEPENSE') {
      throw new Error('Seule une dépense a besoin d\'être validée — une collecte est déjà valide dès sa saisie.');
    }
    if (transaction.valide) {
      throw new Error('Cette dépense est déjà validée.');
    }
    if (!transaction.justificatifUrl) {
      throw new Error('Impossible de valider : aucun justificatif joint à cette dépense.');
    }

    return this.prisma.aPEETransaction.update({
      where: { id: cmd.transactionId },
      data: { valide: true, valideParId: cmd.valideParId, valideAt: new Date() },
    });
  }
}
