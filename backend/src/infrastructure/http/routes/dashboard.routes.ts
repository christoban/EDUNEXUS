import { Router } from 'express';
import type { DashboardController } from '@infrastructure/http/controllers/DashboardController';
import { requireAuth } from '../../../middleware/auth';

export function creerDashboardRoutes(controller: DashboardController): Router {
  const router = Router();
  router.get('/stats', requireAuth, controller.getStats);
  return router;
}
