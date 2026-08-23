import { Router } from 'express';
import type { SchoolSettingsController } from '@infrastructure/http/controllers/SchoolSettingsController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerSchoolSettingsRoutes(controller: SchoolSettingsController): Router {
  const router = Router();
  router.get('/', requireAuth, controller.getSettings);
  router.put('/', requireAuth, requireRole('ADMIN'), controller.updateSettings);
  return router;
}
