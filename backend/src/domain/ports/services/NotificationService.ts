/**
 * DOMAIN LAYER — Port Service Notification
 * Push (FCM), SMS, Email, In-App — selon les préférences utilisateur et l'urgence.
 */
import type { NotificationType, NotificationChannel } from '@domain/types/enums';
import type { NotificationUrgency } from '@prisma/client';

export interface EnvoiNotificationOptions {
  schoolId: string;
  userId: string;
  type: NotificationType;
  titre: string;
  corps: string;
  canal: NotificationChannel;
  urgency?: NotificationUrgency;
  metadata?: Record<string, unknown>;
}

export interface NotificationService {
  envoyer(options: EnvoiNotificationOptions): Promise<void>;
  envoyerAuRole(params: {
    schoolId: string;
    role: string;
    type: NotificationType;
    titre: string;
    corps: string;
    canal: NotificationChannel;
  }): Promise<void>;
  marquerLue(notificationId: string): Promise<void>;
  notifierParents?(opts: {
    schoolId: string;
    studentId: string;
    type: NotificationType;
    titre: string;
    corps: string;
  }): Promise<void>;
}
