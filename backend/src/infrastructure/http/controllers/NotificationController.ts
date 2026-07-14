import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import type { SocketNotificationService } from '@infrastructure/services/SocketNotificationService';

/**
 * Préfixe /api/v2/notifications — alimente la cloche IN_APP (voir SocketNotificationService,
 * qui persiste désormais dans la table Notification en plus de l'émission Socket.io live).
 */
export class NotificationController {
  constructor(private readonly notificationService: SocketNotificationService) {}

  // GET /api/v2/notifications?limit=30
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const limit = Math.min(Number(req.query['limit']) || 30, 100);

      const notifications = await (prisma as any).notification.findMany({
        where: { userId, schoolId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      const unreadCount = await (prisma as any).notification.count({ where: { userId, schoolId, isRead: false } });

      res.json({ success: true, data: { notifications, unreadCount } });
    } catch (err) { next(err); }
  };

  // POST /api/v2/notifications/:id/read
  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = String(req.params['id']);

      // Vérifie l'appartenance avant mutation (défense multi-tenant, voir CONVENTIONS.md §4.4)
      const notif = await (prisma as any).notification.findUnique({ where: { id } });
      if (!notif || notif.userId !== userId) {
        res.status(404).json({ success: false, message: 'Notification introuvable' });
        return;
      }

      await this.notificationService.marquerLue(id);
      res.json({ success: true });
    } catch (err) { next(err); }
  };

  // POST /api/v2/notifications/read-all
  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      await (prisma as any).notification.updateMany({
        where: { userId, schoolId, isRead: false },
        data: { isRead: true },
      });
      res.json({ success: true });
    } catch (err) { next(err); }
  };
}
