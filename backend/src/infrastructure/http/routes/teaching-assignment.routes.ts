import { Router } from 'express';
import type { TeachingAssignmentController } from '../controllers/TeachingAssignmentController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerTeachingAssignmentRoutes(controller: TeachingAssignmentController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.getByClass);
  router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.assign);

  return router;
}
