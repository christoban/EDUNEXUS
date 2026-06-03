import { Router } from 'express';
import type { SchoolSettingsController } from '@infrastructure/http/controllers/SchoolSettingsController';

export function creerSchoolSettingsRoutes(controller: SchoolSettingsController): Router {
  const router = Router();
  router.get('/', controller.getSettings);
  router.put('/', controller.updateSettings);
  return router;
}
