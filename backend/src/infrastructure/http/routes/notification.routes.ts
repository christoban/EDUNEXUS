import { Router } from 'express';
import type { NotificationController } from '@infrastructure/http/controllers/NotificationController';
import { requireAuth } from '../../../middleware/auth';

export function creerNotificationRoutes(controller: NotificationController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.list);
  router.post('/:id/read', requireAuth, controller.markAsRead);
  router.post('/read-all', requireAuth, controller.markAllAsRead);

  return router;
}
