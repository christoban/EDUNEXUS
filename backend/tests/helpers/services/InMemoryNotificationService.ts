import type { NotificationService, EnvoiNotificationOptions } from '@domain/ports/services/NotificationService';

export class InMemoryNotificationService implements NotificationService {
  appels: EnvoiNotificationOptions[] = [];

  async envoyer(options: EnvoiNotificationOptions): Promise<void> {
    this.appels.push(options);
  }

  async envoyerAuRole(_params: Parameters<NotificationService['envoyerAuRole']>[0]): Promise<void> {}

  async marquerLue(_notificationId: string): Promise<void> {}
}
