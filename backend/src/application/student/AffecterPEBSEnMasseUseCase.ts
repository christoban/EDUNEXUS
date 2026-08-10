import type { PrismaClient } from '@prisma/client';

export interface AffecterPEBSEnMasseCommande {
  studentUserIds: string[];
  schoolId: string;
  pebsFiliere: string | null;
}

export interface AffecterPEBSEnMasseResultat {
  modifies: number;
}

export class AffecterPEBSEnMasseUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: AffecterPEBSEnMasseCommande): Promise<AffecterPEBSEnMasseResultat> {
    if (cmd.studentUserIds.length === 0) return { modifies: 0 };

    if (cmd.pebsFiliere !== null && !['FR_PEBS', 'EN_PEBS'].includes(cmd.pebsFiliere)) {
      throw new Error('Valeur pebsFiliere invalide. Utilisez FR_PEBS, EN_PEBS ou null');
    }

    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        userId: { in: cmd.studentUserIds },
        user: { schoolId: cmd.schoolId },
      },
      select: { id: true },
    });

    if (profiles.length === 0) return { modifies: 0 };

    const profileIds = profiles.map((p: any) => p.id);
    const result = await this.prisma.studentProfile.updateMany({
      where: { id: { in: profileIds } },
      data: { pebsFiliere: cmd.pebsFiliere },
    });

    return { modifies: result.count };
  }
}
