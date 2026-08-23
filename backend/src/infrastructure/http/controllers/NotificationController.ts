import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import type { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';

/**
 * Préfixe /api/v2/notifications — alimente la cloche IN_APP (voir SocketNotificationService,
 * qui persiste désormais dans la table Notification en plus de l'émission Socket.io live).
 */
export class NotificationController {
  constructor(private readonly notificationService: SocketNotificationService) {}

  // GET /api/v2/notifications?limit=30&page=1&type=ACADEMIC&isRead=false
  // Sans page/type/isRead : comportement identique à avant (30 dernières, tous types) — la
  // cloche (NotificationBell.tsx) continue de fonctionner sans changement. page/type/isRead
  // sont utilisés par le centre de notifications complet (NotificationCenter.tsx).
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const limit = Math.min(Number(req.query['limit']) || 30, 100);
      const page = Math.max(1, Number(req.query['page']) || 1);
      const type = req.query['type'] as string | undefined;
      const isReadParam = req.query['isRead'] as string | undefined;

      const where: Record<string, unknown> = { userId, schoolId };
      if (type) where.type = type;
      if (isReadParam === 'true') where.isRead = true;
      else if (isReadParam === 'false') where.isRead = false;

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, schoolId, isRead: false } }),
      ]);

      res.json({
        success: true,
        data: {
          notifications,
          unreadCount,
          pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/notifications/:id/read
  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const id = String(req.params['id']);

      // Vérifie l'appartenance avant mutation (défense multi-tenant, voir CONVENTIONS.md §4.4)
      const notif = await prisma.notification.findUnique({ where: { id } });
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
      await prisma.notification.updateMany({
        where: { userId, schoolId, isRead: false },
        data: { isRead: true },
      });
      res.json({ success: true });
    } catch (err) { next(err); }
  };
}
