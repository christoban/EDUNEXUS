/**
 * APPLICATION LAYER — Liste tous les événements académiques d'un établissement (vue de gestion
 * Admin), tous statuts confondus — à l'inverse d'ObtenirEvenementsActifsUseCase qui alimente le
 * centre d'événements (actifs/à venir uniquement, filtré par rôle de l'appelant).
 */
import type { PrismaClient } from '@prisma/client';

export class ListerEvenementsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(schoolId: string) {
    return this.prisma.academicEvent.findMany({
      where: { schoolId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        triggeredBy: { select: { firstName: true, lastName: true } },
      },
    });
  }
}
