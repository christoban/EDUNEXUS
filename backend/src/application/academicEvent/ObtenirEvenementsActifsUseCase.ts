/**
 * APPLICATION LAYER — Centre d'événements : événements ACTIVE ou UPCOMING (à venir sous 14
 * jours) dont le rôle de l'appelant fait partie des `targetRoles` — jamais les événements déjà
 * clôturés, qui restent consultables uniquement via ListerEvenementsUseCase (vue de gestion
 * Admin), en historique/archive.
 */
import type { PrismaClient } from '@prisma/client';

const FENETRE_A_VENIR_JOURS = 14;

export class ObtenirEvenementsActifsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(schoolId: string, role: string) {
    const dansQuatorzeJours = new Date(Date.now() + FENETRE_A_VENIR_JOURS * 24 * 60 * 60 * 1000);

    const evenements = await this.prisma.academicEvent.findMany({
      where: {
        schoolId,
        targetRoles: { has: role },
        OR: [
          { status: 'ACTIVE' },
          { status: 'UPCOMING', category: { in: ['FIXED_DATE', 'SLIDING_WINDOW'] }, openDate: { lte: dansQuatorzeJours } },
        ],
      },
      orderBy: { openDate: 'asc' },
      select: {
        id: true, type: true, category: true, title: true, description: true,
        openDate: true, closeDate: true, status: true,
      },
    });
    return evenements;
  }
}
