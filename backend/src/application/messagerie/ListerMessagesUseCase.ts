import type { PrismaClient, ModerationStatus } from '@prisma/client';
import { verifierAppartenanceConversation } from './MessagerieAccessHelpers';

const TAILLE_PAGE = 30;
const TAILLE_RATTRAPAGE_MAX = 200;

export interface ListerMessagesCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  conversationId: string;
  page?: number;
  since?: Date;
}

export class ListerMessagesUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ListerMessagesCommande) {
    await verifierAppartenanceConversation(this.prisma, {
      conversationId: cmd.conversationId,
      schoolId: cmd.schoolId,
      userId: cmd.appelantId,
      role: cmd.appelantRole,
    });

    const role = cmd.appelantRole.toUpperCase();
    const estSupervision = role === 'ADMIN' || role === 'STAFF';

    // Modération : un message CLASS_CHANNEL/PARENT_CHANNEL en attente n'est visible que par son
    // auteur et par le personnel (qui doit pouvoir le modérer) — jamais par le reste du canal
    // tant qu'il n'est pas approuvé. Un message rejeté reste visible pour son seul auteur (avec
    // le motif, affiché côté frontend), invisible pour tout le monde d'autre.
    const filtreModeration = estSupervision
      ? {}
      : { OR: [{ moderationStatus: 'APPROVED' as ModerationStatus }, { senderId: cmd.appelantId }] };

    if (cmd.since) {
      const messages = await this.prisma.message.findMany({
        where: { conversationId: cmd.conversationId, createdAt: { gt: cmd.since }, ...filtreModeration },
        orderBy: { createdAt: 'asc' },
        take: TAILLE_RATTRAPAGE_MAX,
        include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
      });
      return { messages, mode: 'rattrapage' as const };
    }

    const page = Math.max(1, cmd.page ?? 1);
    const messagesDesc = await this.prisma.message.findMany({
      where: { conversationId: cmd.conversationId, ...filtreModeration },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * TAILLE_PAGE,
      take: TAILLE_PAGE,
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });

    return { messages: messagesDesc.reverse(), mode: 'page' as const, page };
  }
}
