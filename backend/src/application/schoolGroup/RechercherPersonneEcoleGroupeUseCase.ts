/**
 * APPLICATION LAYER — Recherche d'un élève/enseignant dans UNE école du groupe, pour permettre
 * au Fondateur de Groupe de sélectionner qui transférer (Section 5 du plan). Exception délibérée
 * au principe "jamais d'enregistrement individuel" de la Section 4 : ce n'est pas le dashboard
 * agrégé, c'est un formulaire de sélection ciblé, limité à nom+id+rôle — rien de plus (pas de
 * notes, pas de finances, pas de présence).
 */
import type { PrismaClient } from '@prisma/client';

export interface RechercherPersonneEcoleGroupeCommande {
  groupId: string;
  schoolId: string;
  role: 'STUDENT' | 'TEACHER';
  recherche: string;
}

export class RechercherPersonneEcoleGroupeUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: RechercherPersonneEcoleGroupeCommande) {
    const school = await this.prisma.school.findFirst({ where: { id: cmd.schoolId, groupId: cmd.groupId } });
    if (!school) throw new Error("Cette école n'appartient pas à votre groupe");

    if (cmd.recherche.trim().length < 2) return [];

    const users = await this.prisma.user.findMany({
      where: {
        schoolId: cmd.schoolId,
        role: cmd.role,
        OR: [
          { firstName: { contains: cmd.recherche, mode: 'insensitive' } },
          { lastName: { contains: cmd.recherche, mode: 'insensitive' } },
        ],
      },
      select: { id: true, firstName: true, lastName: true },
      take: 20,
    });

    return users.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}` }));
  }
}
