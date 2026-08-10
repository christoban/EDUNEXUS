import type { PrismaClient, UserRole } from '@prisma/client';

export interface CreerAnnonceCommande {
  schoolId: string;
  authorId: string;
  role: string;
  title: string;
  content: string;
  targetRoles: UserRole[];
  isPinned?: boolean;
  expiresAt?: Date | null;
}

export class CreerAnnonceUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: CreerAnnonceCommande) {
    if (!['ADMIN', 'STAFF'].includes(cmd.role.toUpperCase())) {
      throw new Error('Seuls l\'Admin et le Staff peuvent publier sur le babillard.');
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

    return this.prisma.announcement.create({
      data: {
        schoolId: cmd.schoolId,
        authorId: cmd.authorId,
        title,
        content,
        targetRoles: cmd.targetRoles,
        isPinned: cmd.isPinned ?? false,
        expiresAt: cmd.expiresAt ?? null,
      },
    });
  }
}