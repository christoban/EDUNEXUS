import type { PrismaClient } from '@prisma/client';

const DELAI_GRACE_JOURS = 7;

export class PurgerAnnoncesExpireesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(): Promise<{ count: number }> {
    const seuil = new Date(Date.now() - DELAI_GRACE_JOURS * 24 * 60 * 60 * 1000);

    return this.prisma.announcement.deleteMany({
      where: { expiresAt: { lt: seuil } },
    });
  }
}