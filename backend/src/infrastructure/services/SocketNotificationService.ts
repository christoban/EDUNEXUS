import type { NotificationService, EnvoiNotificationOptions } from '@domain/ports/services/NotificationService';
import { getIO } from '../../socket/io';

export class SocketNotificationService implements NotificationService {
  async envoyer(options: EnvoiNotificationOptions): Promise<void> {
    if (options.canal !== 'IN_APP') {
      // EMAIL/SMS/PUSH gérés séparément via EmailService ou SmsService
      console.log(`[Notification] ${options.canal} → ${options.userId} : ${options.titre}`);
      return;
    }

    const io = getIO();
    if (!io) {
      console.warn(`[Notification] Socket non initialisé — notification perdue pour ${options.userId}`);
      return;
    }

    // Le client doit rejoindre la room "user:{userId}" à la connexion
    io.to(`user:${options.userId}`).emit('notification', {
      type: options.type,
      titre: options.titre,
      corps: options.corps,
      metadata: options.metadata ?? {},
      lu: false,
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

    const io = getIO();
    if (!io) {
      console.warn(`[Notification] Socket non initialisé — broadcast rôle ignoré`);
      return;
    }

    // Le client doit rejoindre "school:{schoolId}:role:{role}" à la connexion
    io.to(`school:${params.schoolId}:role:${params.role}`).emit('notification', {
      type: params.type,
      titre: params.titre,
      corps: params.corps,
      lu: false,
      createdAt: new Date().toISOString(),
    });
  }

  async marquerLue(_notificationId: string): Promise<void> {
    // Module notifications persistantes non encore implémenté — sera complété à l'étape notifications
  }
}
