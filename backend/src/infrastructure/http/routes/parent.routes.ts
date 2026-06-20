import { Router } from 'express';
import type { ParentController } from '@infrastructure/http/controllers/ParentController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerParentRoutes(controller: ParentController): Router {
  const router = Router();
  router.get('/children', requireAuth, requireRole('PARENT'), controller.getEnfants);

  // Le parent initie lui-même son paiement Mobile Money (MTN MoMo ou Orange Money)
  router.post('/payments/mobile', requireAuth, requireRole('PARENT'), controller.initierPaiementMobile);

  return router;
}
