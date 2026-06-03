import { Router } from 'express';
import type { TimetableController } from '@infrastructure/http/controllers/TimetableController';

export function creerTimetableRoutes(controller: TimetableController): Router {
  const router = Router();

  router.post('/manual', controller.creerManuel);
  router.post('/catchup-requests', controller.demanderCours);
  router.post('/:id/slots', controller.ajouterSlot);
  router.put('/:id/slots/:slotId', controller.modifierSlot);
  router.put('/:id/publish', controller.publierEDT);

  return router;
}
