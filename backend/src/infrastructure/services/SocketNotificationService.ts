import type { NotificationService, EnvoiNotificationOptions } from '@domain/ports/services/NotificationService';
import type { NotificationType as DomainNotificationType } from '@domain/types/enums';
import { getIO } from '../../socket/io';
import { notifierUtilisateurPush } from './PushNotificationService';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';

/**
 * Le `NotificationType` du domaine (port NotificationService, ex. ABSENCE_ALERT,
 * GRADE_AVAILABLE) et l'enum Prisma `NotificationType` (ACADEMIC, ATTENDANCE, FINANCIAL...)
 * sont deux vocabulaires distincts qui partagent seulement le nom — vérifié en lisant les deux
 * définitions, seule la valeur SYSTEM coïncide. Toute écriture directe de `options.type` dans
 * `prisma.notification.create` échouerait silencieusement (valeur d'enum invalide) pour tout
 * le reste — cette table fait la conversion.
 */
const DOMAIN_TO_PRISMA_NOTIFICATION_TYPE: Record<DomainNotificationType, string> = {
  ABSENCE_ALERT: 'ATTENDANCE',
  GRADE_AVAILABLE: 'ACADEMIC',
  BULLETIN_AVAILABLE: 'ACADEMIC',
  PAYMENT_REMINDER: 'FINANCIAL',
  PAYMENT_CONFIRMED: 'FINANCIAL',
  PAYMENT_FAILED: 'FINANCIAL',
  COUNCIL_DECISION: 'ACADEMIC',
  LIBRARY_OVERDUE: 'SYSTEM',
  DISCIPLINE_SANCTION: 'COMMUNICATION',
  SYSTEM: 'SYSTEM',
};

export class SocketNotificationService implements NotificationService {
  async envoyer(options: EnvoiNotificationOptions): Promise<void> {
    if (options.canal === 'PUSH') {
      await notifierUtilisateurPush({ userId: options.userId, title: options.titre, body: options.corps, data: options.metadata });
      return;
    }

    if (options.canal !== 'IN_APP') {
      // EMAIL/SMS gérés séparément via EmailService ou SmsService
      console.log(`[Notification] ${options.canal} → ${options.userId} : ${options.titre}`);
      return;
    }

    // Persisté (table Notification) avant l'émission live — sans ça, la cloche est vide à
    // chaque rechargement de page et pour tout utilisateur non connecté au moment de l'envoi
    // (même pattern que relanceProfilRH, voir inngest/hrSelfServiceJobs.ts).
    let notificationId: string | null = null;
    try {
      const created = await (prisma as any).notification.create({
        data: {
          schoolId: options.schoolId,
          userId: options.userId,
          type: DOMAIN_TO_PRISMA_NOTIFICATION_TYPE[options.type],
          title: options.titre,
          body: options.corps,
          metadata: options.metadata ?? {},
          channel: 'IN_APP',
        },
      });
      notificationId = created.id;
    } catch (err) {
      console.error('[Notification] Échec de persistance:', err);
    }

    const io = getIO();
    if (!io) {
      console.warn(`[Notification] Socket non initialisé — notification perdue pour ${options.userId} (persistée en base si succès ci-dessus)`);
      return;
    }

    // Même forme que GET /api/v2/notifications (title/body/isRead) — un seul vocabulaire
    // côté frontend entre le chargement initial (REST) et le flux live (Socket.io).
    io.to(`user:${options.userId}`).emit('notification', {
      id: notificationId,
      type: DOMAIN_TO_PRISMA_NOTIFICATION_TYPE[options.type],
      title: options.titre,
      body: options.corps,
      metadata: options.metadata ?? {},
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }

  async envoyerAuRole(
    params: Parameters<NotificationService['envoyerAuRole']>[0]
  ): Promise<void> {
    if (params.canal !== 'IN_APP') {
      console.log(`[Notification] ${params.canal} → rôle ${params.role}@${params.schoolId} : ${params.titre}`);
      return;
    }

    try {
      const destinataires = await (prisma as any).user.findMany({
        where: { schoolId: params.schoolId, role: params.role, isActive: true },
        select: { id: true },
      });
      if (destinataires.length > 0) {
        await (prisma as any).notification.createMany({
          data: destinataires.map((u: { id: string }) => ({
            schoolId: params.schoolId,
            userId: u.id,
            type: DOMAIN_TO_PRISMA_NOTIFICATION_TYPE[params.type],
            title: params.titre,
            body: params.corps,
            channel: 'IN_APP' as const,
          })),
        });
      }
    } catch (err) {
      console.error('[Notification] Échec de persistance (broadcast rôle):', err);
    }

    const io = getIO();
    if (!io) {
      console.warn(`[Notification] Socket non initialisé — broadcast rôle ignoré`);
      return;
    }

    io.to(`school:${params.schoolId}:role:${params.role}`).emit('notification', {
      type: DOMAIN_TO_PRISMA_NOTIFICATION_TYPE[params.type],
      title: params.titre,
      body: params.corps,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }

  async marquerLue(notificationId: string): Promise<void> {
    try {
      await (prisma as any).notification.update({ where: { id: notificationId }, data: { isRead: true } });
    } catch (err) {
      console.error('[Notification] Échec marquerLue:', err);
    }
  }
}
