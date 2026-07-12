/**
 * APPLICATION — Use case : Dashboard paiements consolidé pour toute l'école
 *
 * Extrait de PaiementMinesecController (qui accédait directement à Prisma) pour
 * respecter la séparation hexagonale — la logique métier n'appartient pas au controller.
 */
import type { PrismaClient } from '@prisma/client';

export interface SchoolPaymentOverview {
  anneeScolaire: string;
  totalEleves: number;
  minesec: { status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[];
  etablissement: { status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[];
}

export class GetSchoolPaymentOverviewUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(schoolId: string, anneeScolaire: string): Promise<SchoolPaymentOverview> {
    const totalEleves = await (this.prisma as any).enrollment.count({
      where: { schoolId, anneeScolaire, status: 'ACTIVE' },
    });

    const minesec = await (this.prisma as any).paiementMinesec.groupBy({
      by: ['status'],
      where: { schoolId, anneeScolaire },
      _count: { _all: true },
      _sum: { montantAttendu: true, montantPaye: true },
    });

    const etablissement = await (this.prisma as any).paiementEtablissement.groupBy({
      by: ['status'],
      where: { schoolId, anneeScolaire },
      _count: { _all: true },
      _sum: { montantAttendu: true, montantPaye: true },
    });

    return { anneeScolaire, totalEleves, minesec, etablissement };
  }
}
