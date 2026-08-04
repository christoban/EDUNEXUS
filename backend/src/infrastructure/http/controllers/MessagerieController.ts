import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { EnvoyerMessageUseCase } from '@application/messagerie/EnvoyerMessageUseCase';
import { ListerConversationsUseCase } from '@application/messagerie/ListerConversationsUseCase';
import { ListerMessagesUseCase } from '@application/messagerie/ListerMessagesUseCase';
import { MarquerMessagesLusUseCase } from '@application/messagerie/MarquerMessagesLusUseCase';
import { ModererMessageUseCase } from '@application/messagerie/ModererMessageUseCase';
import { ListerMessagesEnAttenteModerationUseCase } from '@application/messagerie/ListerMessagesEnAttenteModerationUseCase';
import { ListerContactsMessagerieUseCase } from '@application/messagerie/ListerContactsMessagerieUseCase';
import { CompterMessagesNonLusUseCase } from '@application/messagerie/CompterMessagesNonLusUseCase';

export class MessagerieController {
  private readonly envoyerMessage: EnvoyerMessageUseCase;
  private readonly listerConversations: ListerConversationsUseCase;
  private readonly listerMessages: ListerMessagesUseCase;
  private readonly marquerLus: MarquerMessagesLusUseCase;
  private readonly modererMessage: ModererMessageUseCase;
  private readonly listerEnAttenteModeration: ListerMessagesEnAttenteModerationUseCase;
  private readonly listerContacts: ListerContactsMessagerieUseCase;
  private readonly compterMessagesNonLus: CompterMessagesNonLusUseCase;

  constructor(private readonly prisma: PrismaClient) {
    this.envoyerMessage = new EnvoyerMessageUseCase(prisma);
    this.listerConversations = new ListerConversationsUseCase(prisma);
    this.listerMessages = new ListerMessagesUseCase(prisma);
    this.marquerLus = new MarquerMessagesLusUseCase(prisma);
    this.modererMessage = new ModererMessageUseCase(prisma);
    this.listerEnAttenteModeration = new ListerMessagesEnAttenteModerationUseCase(prisma);
    this.listerContacts = new ListerContactsMessagerieUseCase(prisma);
    this.compterMessagesNonLus = new CompterMessagesNonLusUseCase(prisma);
  }

  envoyer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { content, conversationId, destinataireId, clientMessageId } = req.body as {
        content?: string;
        conversationId?: string;
        destinataireId?: string;
        clientMessageId?: string;
      };

      const message = await this.envoyerMessage.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
        content: content ?? '',
        conversationId,
        destinataireId,
        clientMessageId: clientMessageId ?? '',
      });

      res.status(201).json({ success: true, data: message });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const conversations = await this.listerConversations.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
      });
      res.json({ success: true, data: conversations });
    } catch (error) {
      next(error);
    }
  };

  listerMessagesConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { page, since } = req.query as { page?: string; since?: string };

      const resultat = await this.listerMessages.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
        conversationId: String(req.params['id']),
        page: page ? Number(page) : undefined,
        since: since ? new Date(since) : undefined,
      });

      res.json({ success: true, data: resultat.messages, meta: { mode: resultat.mode } });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  marquerCommeLus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { jusquAMessageId } = req.body as { jusquAMessageId?: string };

      const resultat = await this.marquerLus.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
        conversationId: String(req.params['id']),
        jusquAMessageId,
      });

      res.json({ success: true, data: resultat });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  moderer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { decision, motif } = req.body as { decision?: 'APPROVED' | 'REJECTED'; motif?: string };

      if (decision !== 'APPROVED' && decision !== 'REJECTED') {
        res.status(400).json({ success: false, message: 'Décision de modération invalide.' });
        return;
      }

      const message = await this.modererMessage.execute({
        schoolId: user.schoolId,
        moderateurId: user.userId,
        moderateurRole: user.role,
        messageId: String(req.params['id']),
        decision,
        motif,
      });

      res.json({ success: true, data: message });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  listerModeration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const messages = await this.listerEnAttenteModeration.execute({
        schoolId: user.schoolId,
        appelantRole: user.role,
      });
      res.json({ success: true, data: messages });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ success: false, message: error.message });
        return;
      }
      next(error);
    }
  };

  contacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const contacts = await this.listerContacts.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
      });
      res.json({ success: true, data: contacts });
    } catch (error) {
      next(error);
    }
  };

  compterNonLus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const resultat = await this.compterMessagesNonLus.execute({
        schoolId: user.schoolId,
        appelantId: user.userId,
        appelantRole: user.role,
      });
      res.json({ success: true, data: resultat });
    } catch (error) {
      next(error);
    }
  };
}
