import type { PrismaClient } from '@prisma/client';
import { classIdsPertinents } from './MessagerieAccessHelpers';

export interface ListerConversationsCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
}

export class ListerConversationsUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ListerConversationsCommande) {
    const role = cmd.appelantRole.toUpperCase();
    const estSupervision = role === 'ADMIN' || role === 'STAFF';

    const classIds = estSupervision ? [] : await classIdsPertinents(this.prisma, cmd.appelantId, role);

    const where: Record<string, unknown> = {
      schoolId: cmd.schoolId,
      OR: [
        { type: 'PRIVATE', participants: { some: { userId: cmd.appelantId } } },
        estSupervision
          ? { type: { in: ['CLASS_CHANNEL', 'PARENT_CHANNEL'] } }
          : {
              OR: [
                ...(classIds.length && (role === 'TEACHER' || role === 'STUDENT') ? [{ type: 'CLASS_CHANNEL', classId: { in: classIds } }] : []),
                ...(classIds.length && (role === 'TEACHER' || role === 'PARENT') ? [{ type: 'PARENT_CHANNEL', classId: { in: classIds } }] : []),
              ],
            },
      ],
    };

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        participants: { include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, content: true, createdAt: true, senderId: true } },
      },
    });

    // Pas de relation Prisma directe Conversation→Class (classId est un identifiant "faible",
    // même convention que le reste du schéma pour ce champ) — un seul findMany groupé plutôt
    // qu'un aller-retour par conversation.
    const classIdsAAfficher = Array.from(new Set(conversations.map((c: any) => c.classId).filter(Boolean))) as string[];
    const classes = classIdsAAfficher.length
      ? await this.prisma.class.findMany({ where: { id: { in: classIdsAAfficher } }, select: { id: true, name: true } })
      : [];
    const nomParClasseId = new Map(classes.map((c: any) => [c.id, c.name]));

    const avecMeta = await Promise.all(
      conversations.map(async (conversation: any) => {
        const nonLus = await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: cmd.appelantId },
            moderationStatus: 'APPROVED',
            readStatuses: { none: { userId: cmd.appelantId } },
          },
        });

        return {
          id: conversation.id,
          type: conversation.type,
          name: conversation.name ?? (conversation.classId ? nomParClasseId.get(conversation.classId) : null) ?? null,
          classId: conversation.classId,
          participants: conversation.participants.map((p: any) => p.user),
          lastMessage: conversation.messages[0] ?? null,
          unreadCount: nonLus,
        };
      }),
    );

    return avecMeta.sort((a, b) => {
      const dateA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const dateB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }
}
