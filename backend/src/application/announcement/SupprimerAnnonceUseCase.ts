import type { PrismaClient } from '@prisma/client';

export interface SupprimerAnnonceCommande {
  schoolId: string;
  announcementId: string;
  userId: string;
  role: string;
}

export class SupprimerAnnonceUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: SupprimerAnnonceCommande) {
    const annonce = await this.prisma.announcement.findFirst({
      where: { id: cmd.announcementId, schoolId: cmd.schoolId },
      select: { id: true, authorId: true },
    });

    if (!annonce) {
      throw new Error('Annonce introuvable.');
    }

    const estAuteur = annonce.authorId === cmd.userId;
    const estAdmin = cmd.role.toUpperCase() === 'ADMIN';

    if (!estAuteur && !estAdmin) {
      throw new Error('Seul l\'auteur ou l\'Admin peut supprimer une annonce.');
    }

    return this.prisma.announcement.delete({
      where: { id: annonce.id },
    });
  }
}