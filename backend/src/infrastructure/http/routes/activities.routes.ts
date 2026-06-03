import { Router } from 'express';
import type { ActivitiesLogController } from '@infrastructure/http/controllers/ActivitiesLogController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerActivitiesRoutes(controller: ActivitiesLogController): Router {
  const router = Router();
  router.get('/', requireAuth, requireRole('ADMIN', 'TEACHER'), controller.getAll);
  return router;
}
