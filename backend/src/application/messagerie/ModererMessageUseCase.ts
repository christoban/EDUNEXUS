import type { PrismaClient } from '@prisma/client';
import { SocketNotificationService } from '@infrastructure/services/SocketNotificationService';

export interface ModererMessageCommande {
  schoolId: string;
  moderateurId: string;
  moderateurRole: string;
  messageId: string;
  decision: 'APPROVED' | 'REJECTED';
  motif?: string;
}

const notificationService = new SocketNotificationService();

export class ModererMessageUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: ModererMessageCommande) {
    if (!['ADMIN', 'STAFF'].includes(cmd.moderateurRole.toUpperCase())) {
      throw new Error('Seuls Admin et Staff peuvent modérer un message.');
    }

    const message = await this.prisma.message.findFirst({
      where: { id: cmd.messageId, conversation: { schoolId: cmd.schoolId } },
      select: { id: true, senderId: true, moderationStatus: true, conversationId: true },
    });
    if (!message) throw new Error('Message introuvable.');
    if (message.moderationStatus !== 'PENDING') {
      throw new Error('Ce message a déjà été modéré.');
    }

    const misAJour = await this.prisma.message.update({
      where: { id: cmd.messageId },
      data: {
        moderationStatus: cmd.decision,
        moderatedById: cmd.moderateurId,
        moderationReason: cmd.decision === 'REJECTED' ? (cmd.motif ?? null) : null,
      },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });

    if (cmd.decision === 'REJECTED') {
      await notificationService
        .envoyer({
          schoolId: cmd.schoolId,
          userId: message.senderId,
          type: 'COMMUNICATION',
          titre: 'Message non publié',
          corps: cmd.motif ? `Votre message a été refusé : ${cmd.motif}` : 'Votre message a été refusé par la modération.',
          canal: 'IN_APP',
          metadata: { conversationId: message.conversationId },
        })
        .catch(() => {});
    }

    return misAJour;
  }
}
