import type { PrismaClient } from '@prisma/client';
import { verifierAppartenanceConversation } from './MessagerieAccessHelpers';

export interface MarquerMessagesLusCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  conversationId: string;
  jusquAMessageId?: string;
}

export class MarquerMessagesLusUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: MarquerMessagesLusCommande): Promise<{ count: number }> {
    await verifierAppartenanceConversation(this.prisma, {
      conversationId: cmd.conversationId,
      schoolId: cmd.schoolId,
      userId: cmd.appelantId,
      role: cmd.appelantRole,
    });

    let seuilDate: Date;
    if (cmd.jusquAMessageId) {
      const message = await this.prisma.message.findUnique({
        where: { id: cmd.jusquAMessageId },
        select: { createdAt: true, conversationId: true },
      });
      if (!message || message.conversationId !== cmd.conversationId) {
        throw new Error('Message de référence introuvable dans cette conversation.');
      }
      seuilDate = message.createdAt;
    } else {
      seuilDate = new Date();
    }

    const nonLus = await this.prisma.message.findMany({
      where: {
        conversationId: cmd.conversationId,
        createdAt: { lte: seuilDate },
        senderId: { not: cmd.appelantId },
        readStatuses: { none: { userId: cmd.appelantId } },
      },
      select: { id: true },
    });

    if (nonLus.length === 0) return { count: 0 };

    const resultat = await this.prisma.messageReadStatus.createMany({
      data: nonLus.map((m: { id: string }) => ({ messageId: m.id, userId: cmd.appelantId })),
      skipDuplicates: true,
    });

    return { count: resultat.count };
  }
}
