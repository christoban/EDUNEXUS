import type { PrismaClient, APEETransactionType } from '@prisma/client';
import type { ApeeRepository, ApeeTransactionData } from '@domain/ports/repositories/ApeeRepository';

export class PrismaApeeRepository implements ApeeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async creer(data: {
    schoolId: string;
    creeParId: string;
    type: string;
    montant: number;
    categorie?: string;
    description?: string;
    date: Date;
    valide: boolean;
  }): Promise<ApeeTransactionData> {
    return this.prisma.aPEETransaction.create({
      data: {
        schoolId: data.schoolId,
        creeParId: data.creeParId,
        type: data.type as APEETransactionType,
        montant: data.montant,
        categorie: data.categorie?.trim() || null,
        description: data.description?.trim() || null,
        date: data.date,
        valide: data.valide,
      },
    });
  }

  async trouverParId(id: string, schoolId: string): Promise<ApeeTransactionData | null> {
    return this.prisma.aPEETransaction.findFirst({
      where: { id, schoolId },
    });
  }

  async valider(id: string, valideParId: string): Promise<ApeeTransactionData> {
    return this.prisma.aPEETransaction.update({
      where: { id },
      data: { valide: true, valideParId, valideAt: new Date() },
    });
  }
}
