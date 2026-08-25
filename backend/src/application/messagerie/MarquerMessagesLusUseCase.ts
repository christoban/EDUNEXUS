import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';

export interface MarquerMessagesLusCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  conversationId: string;
  jusquAMessageId?: string;
}

export class MarquerMessagesLusUseCase {
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: MarquerMessagesLusCommande): Promise<{ count: number }> {
    await this.messagerieRepository.verifierAppartenanceConversation({
      conversationId: cmd.conversationId,
      schoolId: cmd.schoolId,
      userId: cmd.appelantId,
      role: cmd.appelantRole,
    });

    let seuilDate: Date;
    if (cmd.jusquAMessageId) {
      const message = await this.messagerieRepository.trouverMessage(cmd.jusquAMessageId);
      if (!message || message.conversationId !== cmd.conversationId) {
        throw new Error('Message de référence introuvable dans cette conversation.');
      }
      seuilDate = message.createdAt;
    } else {
      seuilDate = new Date();
    }

    const nonLus = await this.messagerieRepository.trouverMessagesNonLus(
      cmd.conversationId,
      seuilDate,
      cmd.appelantId,
    );

    if (nonLus.length === 0) return { count: 0 };

    const count = await this.messagerieRepository.marquerMessagesLus(
      nonLus.map((m) => m.id),
      cmd.appelantId,
    );

    return { count };
  }
}
