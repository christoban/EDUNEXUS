import { Router } from 'express';
import type { RoomController } from '@infrastructure/http/controllers/RoomController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerRoomRoutes(controller: RoomController): Router {
  const router = Router();

  router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerSalle);
  router.put('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), controller.modifierSalle);
  router.delete('/:id', requireAuth, requireRole('ADMIN', 'STAFF'), controller.supprimerSalle);

  return router;
}
