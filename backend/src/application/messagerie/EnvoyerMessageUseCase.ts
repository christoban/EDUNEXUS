import type { PrismaClient } from '@prisma/client';
import { verifierAppartenanceConversation, destinatairesAutorises } from './MessagerieAccessHelpers';
import { SocketNotificationService } from '@infrastructure/services/SocketNotificationService';
import { getIO } from '../../socket/io';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';

export interface EnvoyerMessageCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  clientMessageId: string;
  content: string;
  conversationId?: string;
  destinataireId?: string;
}

const notificationService = new SocketNotificationService();

export class EnvoyerMessageUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(cmd: EnvoyerMessageCommande) {
    const content = cmd.content.trim();
    if (!content) throw new Error('Le message ne peut pas être vide.');
    if (!cmd.clientMessageId) throw new Error('Identifiant client du message requis.');

    // Défense en profondeur en plus de l'idempotence HTTP générique (Idempotency-Key) déjà en
    // place — un retry ou un bug frontend qui rejoue le même clientMessageId ne doit jamais créer
    // de doublon : on renvoie simplement le message déjà persisté.
    const existant = await this.prisma.message.findUnique({
      where: { id: cmd.clientMessageId },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
    if (existant) return existant;

    const conversation = cmd.conversationId
      ? await verifierAppartenanceConversation(this.prisma, {
          conversationId: cmd.conversationId,
          schoolId: cmd.schoolId,
          userId: cmd.appelantId,
          role: cmd.appelantRole,
        })
      : await this.trouverOuCreerConversationPrivee(cmd);

    let moderationStatus: 'APPROVED' | 'PENDING' = 'APPROVED';
    if (conversation.type === 'CLASS_CHANNEL' || conversation.type === 'PARENT_CHANNEL') {
      const config = await this.prisma.schoolConfig.findUnique({
        where: { schoolId: cmd.schoolId },
        select: { messageModeration: true },
      });
      if (config?.messageModeration) moderationStatus = 'PENDING';
    }

    const message = await this.prisma.message.create({
      data: {
        id: cmd.clientMessageId,
        conversationId: conversation.id,
        senderId: cmd.appelantId,
        content,
        moderationStatus,
      },
      include: { sender: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });

    getIO()?.to(`conversation:${conversation.id}`).emit('message:new', message);

    if (moderationStatus === 'APPROVED') {
      await this.notifierParticipants(conversation, cmd.appelantId, cmd.schoolId, message.content);
    }

    return message;
  }

  private async trouverOuCreerConversationPrivee(cmd: EnvoyerMessageCommande) {
    if (!cmd.destinataireId) {
      throw new Error('Indiquez une conversation existante ou un destinataire.');
    }
    if (cmd.destinataireId === cmd.appelantId) {
      throw new Error('Vous ne pouvez pas vous écrire à vous-même.');
    }

    const autorises = await destinatairesAutorises(this.prisma, cmd.schoolId, cmd.appelantId, cmd.appelantRole);
    if (autorises && !autorises.has(cmd.destinataireId)) {
      throw new Error("Vous ne pouvez pas écrire à ce destinataire.");
    }

    const destinataire = await this.prisma.user.findFirst({
      where: { id: cmd.destinataireId, schoolId: cmd.schoolId, isActive: true },
      select: { id: true },
    });
    if (!destinataire) throw new Error('Destinataire introuvable.');

    const existante = await this.prisma.conversation.findFirst({
      where: {
        schoolId: cmd.schoolId,
        type: 'PRIVATE',
        AND: [
          { participants: { some: { userId: cmd.appelantId } } },
          { participants: { some: { userId: cmd.destinataireId } } },
        ],
      },
      select: { id: true, type: true, classId: true, schoolId: true },
    });
    if (existante) return existante;

    return this.prisma.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          schoolId: cmd.schoolId,
          type: 'PRIVATE',
          participants: {
            create: [{ userId: cmd.appelantId }, { userId: cmd.destinataireId! }],
          },
        },
        select: { id: true, type: true, classId: true, schoolId: true },
      });
      return conversation;
    });
  }

  /** Notifie (push + cloche) les autres participants d'une conversation qu'un message est arrivé. */
  private async notifierParticipants(
    conversation: { id: string; type: string; classId: string | null },
    expediteurId: string,
    schoolId: string,
    contenu: string,
  ) {
    let destinataireIds: string[] = [];

    if (conversation.type === 'PRIVATE') {
      const participants = await this.prisma.conversationParticipant.findMany({
        where: { conversationId: conversation.id, userId: { not: expediteurId } },
        select: { userId: true },
      });
      destinataireIds = participants.map((p: any) => p.userId);
    } else if (conversation.classId) {
      const [assignments, classe, students, parentsLinks] = await Promise.all([
        this.prisma.teachingAssignment.findMany({ where: { classId: conversation.classId }, select: { teacherId: true } }),
        this.prisma.class.findUnique({ where: { id: conversation.classId }, select: { professorPrincipalId: true } }),
        conversation.type === 'CLASS_CHANNEL'
          ? this.prisma.studentProfile.findMany({
              where: { ...whereProfilesParClasse(conversation.classId) },
              select: { userId: true },
            })
          : Promise.resolve([]),
        conversation.type === 'PARENT_CHANNEL'
          ? this.prisma.parentStudent.findMany({
              where: { studentProfile: whereProfilesParClasse(conversation.classId) },
              select: { parentProfile: { select: { userId: true } } },
            })
          : Promise.resolve([]),
      ]);

      destinataireIds = [
        ...assignments.map((a: any) => a.teacherId),
        ...(classe?.professorPrincipalId ? [classe.professorPrincipalId] : []),
        ...students.map((s: any) => s.userId),
        ...parentsLinks.map((p: any) => p.parentProfile.userId),
      ].filter((id) => id !== expediteurId);
      destinataireIds = Array.from(new Set(destinataireIds));
    }

    const apercu = contenu.length > 80 ? `${contenu.slice(0, 80)}…` : contenu;

    await Promise.allSettled(
      destinataireIds.map((userId) =>
        notificationService.envoyer({
          schoolId,
          userId,
          type: 'COMMUNICATION',
          titre: 'Nouveau message',
          corps: apercu,
          canal: 'PUSH',
          metadata: { conversationId: conversation.id },
        }),
      ),
    );
  }
}
