/**
 * APPLICATION LAYER — Liste des écoles membres d'un groupe, infos publiques uniquement.
 */
import type { PrismaClient } from '@prisma/client';

export class ListerEcolesGroupeUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(groupId: string) {
    const schools = await this.prisma.school.findMany({
      where: { groupId },
      select: {
        id: true,
        name: true,
        city: true,
        region: true,
        type: true,
        plan: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });
    return schools;
  }
}
