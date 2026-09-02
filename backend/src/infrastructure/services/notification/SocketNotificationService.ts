import type { NotificationService, EnvoiNotificationOptions } from '@domain/ports/services/NotificationService';
import type { NotificationType as DomainNotificationType } from '@domain/types/enums';
import type { EventPublisher } from '@domain/ports/services/EventPublisher';
import type { NotificationType as PrismaNotificationType, UserRole, Prisma } from '@prisma/client';
import { getIO } from '../../socket/SocketServer.ts';
import { notifierUtilisateurPush, notifierUtilisateurPushAvecResultat } from './PushNotificationService.ts';
import { getParentContacts } from '../sms/SmsNotificationService.ts';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { PrismaPushSubscriptionRepository } from '@infrastructure/persistence/prisma/PrismaPushSubscriptionRepository';
import { resoudreCanal } from '@domain/policies/NotificationRoutingPolicy';

/**
 * Le `NotificationType` du domaine (port NotificationService, ex. ABSENCE_ALERT,
 * GRADE_AVAILABLE) et l'enum Prisma `NotificationType` (ACADEMIC, ATTENDANCE, FINANCIAL...)
 * sont deux vocabulaires distincts qui partagent seulement le nom — vérifié en lisant les deux
 * définitions, seule la valeur SYSTEM coïncide. Toute écriture directe de `options.type` dans
 * `prisma.notification.create` échouerait silencieusement (valeur d'enum invalide) pour tout
 * le reste — cette table fait la conversion.
 */
const DOMAIN_TO_PRISMA_NOTIFICATION_TYPE: Record<DomainNotificationType, PrismaNotificationType> = {
  ABSENCE_ALERT: 'ATTENDANCE',
  GRADE_AVAILABLE: 'ACADEMIC',
  BULLETIN_AVAILABLE: 'ACADEMIC',
  PAYMENT_REMINDER: 'FINANCIAL',
  PAYMENT_CONFIRMED: 'FINANCIAL',
  PAYMENT_FAILED: 'FINANCIAL',
  COUNCIL_DECISION: 'ACADEMIC',
  LIBRARY_OVERDUE: 'SYSTEM',
  DISCIPLINE_SANCTION: 'COMMUNICATION',
  COMMUNICATION: 'COMMUNICATION',
  STUDENT_RISK_ALERT: 'ACADEMIC',
  FEE_PLAN_CREATED: 'FINANCIAL',
  ACADEMIC_EVENT: 'ACADEMIC',
  SYSTEM: 'SYSTEM',
};

const pushSubscriptionRepo = new PrismaPushSubscriptionRepository(prisma);

export class SocketNotificationService implements NotificationService {
  constructor(private readonly eventPublisher?: EventPublisher) {}

  async envoyer(options: EnvoiNotificationOptions): Promise<void> {
    // Rétrocompat : si canal est fourni mais urgency aussi, on log un warning
    if (options.urgency && options.canal && options.canal !== 'IN_APP') {
      console.warn(
        `[Notification] ⚠️ canal '${options.canal}' et urgency '${options.urgency}' fournis simultanément — urgency prioritaire. ` +
        `Miguer les appelants pour ne plus passer canal. userId=${options.userId}`,
      );
    }

    // Déterminer les canaux via la matrice urgence si urgency fourni
    let canaux: string[];
    if (options.urgency) {
      const hasActivePush = await pushSubscriptionRepo.hasActiveToken(options.userId);
      canaux = resoudreCanal(options.urgency, hasActivePush);
    } else {
      // Rétrocompat : ancien comportement avec canal fourni
      canaux = options.canal ? [options.canal] : ['IN_APP'];
    }

    // Canaux EMAIL/SMS sont gérés séparément — on log et on retourne
    const hasInApp = canaux.includes('IN_APP');
    const hasPush = canaux.includes('PUSH');
    const hasSms = canaux.includes('SMS');

    if (!hasInApp && !hasPush) {
      console.log(`[Notification] ${canaux.join(',')} → ${options.userId} : ${options.titre}`);
      return;
    }

    // Push fire-and-forget si le canal inclut PUSH
    if (hasPush) {
      void notifierUtilisateurPush({ userId: options.userId, title: options.titre, body: options.corps, data: options.metadata });
    }

    // SMS fire-and-forget si le canal inclut SMS
    if (hasSms) {
      const contacts = await getParentContacts(options.userId);
      for (const contact of contacts) {
        if (contact.phone) {
          const { sendSMS } = await import('../sms/SmsService.ts');
          await sendSMS(contact.phone, `${options.titre} — ${options.corps}`).catch(() => {});
        }
      }
    }

    // Persisté (table Notification) avant l'émission live
    let notificationId: string | null = null;
    try {
      const created = await prisma.notification.create({
        data: {
          schoolId: options.schoolId,
          userId: options.userId,
          type: DOMAIN_TO_PRISMA_NOTIFICATION_TYPE[options.type],
          urgency: options.urgency ?? 'NORMAL',
          title: options.titre,
          body: options.corps,
          metadata: (options.metadata ?? {}) as Prisma.InputJsonValue,
          channel: (hasPush ? 'PUSH' : 'IN_APP') as any,
        },
      });
      notificationId = created.id;
    } catch (err) {
      console.error('[Notification] Échec de persistance:', err);
    }

    // Émission Socket.io si IN_APP
    if (hasInApp) {
      const io = getIO();
      if (io) {
        io.to(`user:${options.userId}`).emit('notification', {
          id: notificationId,
          type: DOMAIN_TO_PRISMA_NOTIFICATION_TYPE[options.type],
          title: options.titre,
          body: options.corps,
          metadata: options.metadata ?? {},
          readAt: null,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Escalade SMS différée pour URGENT sans push actif
    if (options.urgency === 'URGENT' && !hasPush && notificationId) {
      try {
        await this.eventPublisher?.emit('notification/escalade-urgent', {
          notificationId,
          userId: options.userId,
          schoolId: options.schoolId,
        } as unknown as Record<string, unknown>);
      } catch (err) {
        console.error('[Notification] Échec envoi job escalade SMS:', err);
      }
    }
  }

  async envoyerAuRole(
    params: Parameters<NotificationService['envoyerAuRole']>[0]
  ): Promise<void> {
    if (params.canal !== 'IN_APP') {
      console.log(`[Notification] ${params.canal} → rôle ${params.role}@${params.schoolId} : ${params.titre}`);
      return;
    }

    try {
      const destinataires = await prisma.user.findMany({
        where: { schoolId: params.schoolId, role: params.role as UserRole, isActive: true },
        select: { id: true },
      });
      if (destinataires.length > 0) {
        await prisma.notification.createMany({
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
      readAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  async marquerLue(notificationId: string): Promise<void> {
    try {
      await prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
    } catch (err) {
      console.error('[Notification] Échec marquerLue:', err);
    }
  }

  async notifierParents(opts: {
    schoolId: string;
    studentId: string;
    type: DomainNotificationType;
    titre: string;
    corps: string;
  }): Promise<void> {
    try {
      const parents = await getParentContacts(opts.studentId);
      for (const parent of parents) {
        // notifierParents utilise resoudreCanal via envoyer (urgency = HIGH pour alertes parents)
        await this.envoyer({ schoolId: opts.schoolId, userId: parent.userId, type: opts.type, titre: opts.titre, corps: opts.corps, canal: 'IN_APP', urgency: 'HIGH' }).catch((err) => console.error('[PushFirst] parent:', (err as any)?.message));
        await notifierUtilisateurPushAvecResultat({ userId: parent.userId, title: opts.titre, body: opts.corps }).catch(() => ({ delivered: false }));
      }
    } catch (err) {
      console.error('[Notification] notifierParents error:', err);
    }
  }
}
