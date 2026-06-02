import { Router } from 'express';
import type { ClassCouncilController } from '@infrastructure/http/controllers/ClassCouncilController';
import { requireAuth } from '../../../middleware/auth';
import { sensitiveWriteLimiter } from '../../../middleware/rateLimit';

export function creerClassCouncilRoutes(controller: ClassCouncilController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.listerSessions);
  router.post('/', sensitiveWriteLimiter, requireAuth, controller.creerSession);
  router.get('/:id', requireAuth, controller.obtenirSession);
  router.post('/:id/decisions', requireAuth, controller.ajouterDecision);
  router.post('/:id/decisions/bulk', requireAuth, controller.ajouterDecisionsEnBloc);
  router.post('/:id/lock', sensitiveWriteLimiter, requireAuth, controller.verrouiller);
  router.get('/:id/report', requireAuth, controller.genererRapport);

  return router;
}
