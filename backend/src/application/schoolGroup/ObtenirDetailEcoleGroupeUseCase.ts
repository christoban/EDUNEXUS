/**
 * APPLICATION LAYER — Détail agrégé d'UNE école du groupe.
 * Toujours des agrégats, jamais une liste d'élèves nominative (Section 4 du plan).
 * L'appartenance de schoolId au groupe doit être vérifiée par l'appelant (contrôleur) via
 * req.groupOwner.schoolIds — ce use case ne refait pas cette vérification, il fait confiance
 * à la frontière déjà posée par protectGroupOwner + le contrôleur.
 */
import type { PrismaClient } from '@prisma/client';
import { calculerKpisEcole } from './calculerKpisEcole';

export class ObtenirDetailEcoleGroupeUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, city: true, region: true, type: true, plan: true, status: true },
    });
    if (!school) {
      throw new Error('École introuvable');
    }

    const kpis = await calculerKpisEcole(this.prisma, schoolId);

    return { ...school, ...kpis };
  }
}
