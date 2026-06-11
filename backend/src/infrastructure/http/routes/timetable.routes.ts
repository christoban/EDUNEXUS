import { Router } from 'express';
import type { TimetableController } from '@infrastructure/http/controllers/TimetableController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerTimetableRoutes(controller: TimetableController): Router {
  const router = Router();

  router.post('/manual', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerManuel);
  router.post('/catchup-requests', requireAuth, requireRole('TEACHER'), controller.demanderCours);
  router.post('/:id/slots', requireAuth, requireRole('ADMIN', 'STAFF'), controller.ajouterSlot);
  router.put('/:id/slots/:slotId', requireAuth, requireRole('ADMIN', 'STAFF'), controller.modifierSlot);
  router.put('/:id/publish', requireAuth, requireRole('ADMIN', 'STAFF'), controller.publierEDT);

  return router;
}
