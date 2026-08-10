/**
 * APPLICATION — Use case : enregistrer une transaction APEE (collecte ou dépense).
 * Une COLLECTE est considérée valide dès sa saisie (montant reçu par l'intendant, rien à
 * justifier). Une DEPENSE démarre toujours non validée — voir ValiderDepenseAPEEUseCase, qui
 * exige un justificatif joint avant de pouvoir la valider (règle du Module 11 de la carte).
 */
import type { PrismaClient } from '@prisma/client';

export interface CreerTransactionAPEECommande {
  schoolId: string;
  creeParId: string;
  type: 'COLLECTE' | 'DEPENSE';
  montant: number;
  categorie?: string;
  description?: string;
  date?: Date;
}

export class CreerTransactionAPEEUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerTransactionAPEECommande) {
    if (cmd.montant <= 0) {
      throw new Error('Le montant doit être strictement positif.');
    }

    return this.prisma.aPEETransaction.create({
      data: {
        schoolId: cmd.schoolId,
        creeParId: cmd.creeParId,
        type: cmd.type,
        montant: cmd.montant,
        categorie: cmd.categorie?.trim() || null,
        description: cmd.description?.trim() || null,
        date: cmd.date ?? new Date(),
        // Une collecte n'a rien à justifier — considérée valide dès la saisie.
        valide: cmd.type === 'COLLECTE',
      },
    });
  }
}
