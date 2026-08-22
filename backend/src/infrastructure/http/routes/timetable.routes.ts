import { Router } from 'express';
import type { TimetableController } from '@infrastructure/http/controllers/TimetableController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerTimetableRoutes(controller: TimetableController): Router {
  const router = Router();

  router.post('/manual', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creerManuel);
  router.post('/catchup-requests', requireAuth, requireRole('TEACHER'), controller.demanderCours);
  router.post('/:id/slots', requireAuth, requireRole('ADMIN', 'STAFF'), controller.ajouterSlot);
  router.put('/:id/slots/:slotId', requireAuth, requireRole('ADMIN', 'STAFF'), controller.modifierSlot);
  router.post('/:id/generate-group-sessions', requireAuth, requireRole('ADMIN', 'STAFF'), controller.genererSeancesGroupe);
  // Scheduling Engine V2.5 — le solveur propose, l'admin confirme, puis on écrit (tout ou rien).
  router.post('/:id/propose-schedule', requireAuth, requireRole('ADMIN', 'STAFF'), controller.proposerEDT);
  router.post('/:id/apply-schedule', requireAuth, requireRole('ADMIN', 'STAFF'), controller.appliquerPropositionEDT);
  // What-if (V2.5) — simule sans écrire.
  router.post('/:id/what-if', requireAuth, requireRole('ADMIN', 'STAFF'), controller.simulerEDT);
  router.put('/:id/publish', requireAuth, requireRole('ADMIN'), controller.publierEDT);

  return router;
}
