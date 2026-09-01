import type { NotificationUrgency } from '@prisma/client';
import type { NotificationChannel } from '@domain/types/enums';

/**
 * Matrice urgence → canal de notification.
 *
 * LOW    : IN_APP uniquement (info, pas de push/SMS)
 * NORMAL : PUSH + IN_APP si push actif, sinon IN_APP seul
 * HIGH   : idem NORMAL mais push prioritaire (même résultat que NORMAL, signal d'intention)
 * URGENT : PUSH + IN_APP si push actif ; SMS + IN_APP si pas de push actif.
 *          L'escalade SMS différé (si pas de deliveredAt après X minutes) est gérée
 *          par un job Inngest séparé (notification/escalade-urgent), pas par cette
 *          fonction pure synchrone.
 */
export function resoudreCanal(
  urgency: NotificationUrgency,
  hasActivePushToken: boolean,
): NotificationChannel[] {
  switch (urgency) {
    case 'LOW':
      return ['IN_APP'];
    case 'NORMAL':
      return hasActivePushToken ? ['PUSH', 'IN_APP'] : ['IN_APP'];
    case 'HIGH':
      return hasActivePushToken ? ['PUSH', 'IN_APP'] : ['IN_APP'];
    case 'URGENT':
      return hasActivePushToken
        ? ['PUSH', 'IN_APP']
        : ['SMS', 'IN_APP'];
  }
}
