import { Router } from 'express';
import type { ParentController } from '@infrastructure/http/controllers/ParentController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerParentRoutes(controller: ParentController): Router {
  const router = Router();
  router.get('/children', requireAuth, requireRole('PARENT'), controller.getEnfants);
  return router;
}
