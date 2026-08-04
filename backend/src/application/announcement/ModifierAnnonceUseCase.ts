import type { PrismaClient, UserRole } from '@prisma/client';

export interface ModifierAnnonceCommande {
  schoolId: string;
  announcementId: string;
  userId: string;
  role: string;
  title: string;
  content: string;
  targetRoles: UserRole[];
  isPinned?: boolean;
  expiresAt?: Date | null;
}

export class ModifierAnnonceUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ModifierAnnonceCommande) {
    const annonce = await (this.prisma as any).announcement.findFirst({
      where: { id: cmd.announcementId, schoolId: cmd.schoolId },
      select: { id: true, authorId: true },
    });

    if (!annonce) {
      throw new Error('Annonce introuvable.');
    }

    const estAuteur = annonce.authorId === cmd.userId;
    const estAdmin = cmd.role.toUpperCase() === 'ADMIN';

    if (!estAuteur && !estAdmin) {
      throw new Error('Seul l\'auteur ou l\'Admin peut modifier une annonce.');
    }

    const title = cmd.title.trim();
    const content = cmd.content.trim();

    if (!title) {
      throw new Error('Le titre de l\'annonce est requis.');
    }
    if (!content) {
      throw new Error('Le contenu de l\'annonce est requis.');
    }
    if (!cmd.targetRoles?.length) {
      throw new Error('Sélectionnez au moins un rôle ciblé.');
    }
    if (cmd.expiresAt && cmd.expiresAt.getTime() <= Date.now()) {
      throw new Error('La date d\'expiration doit être future ou absente.');
    }

    return (this.prisma as any).announcement.update({
      where: { id: annonce.id },
      data: {
        title,
        content,
        targetRoles: cmd.targetRoles,
        isPinned: cmd.isPinned ?? false,
        expiresAt: cmd.expiresAt ?? null,
      },
    });
  }
}