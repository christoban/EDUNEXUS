import { Router } from 'express';
import type { AnnouncementController } from '@infrastructure/http/controllers/AnnouncementController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerAnnouncementRoutes(controller: AnnouncementController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.lister);
  router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creer);
  router.patch('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), controller.modifier);
  router.delete('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), controller.supprimer);

  return router;
}
