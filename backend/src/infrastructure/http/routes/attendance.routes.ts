import { Router } from 'express';
import type { AttendanceController } from '@infrastructure/http/controllers/AttendanceController';
import { requireAuth } from '../../../middleware/auth';

export function creerAttendanceRoutes(controller: AttendanceController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.lister);
  router.get('/stats', requireAuth, controller.statistiques);
  router.post('/', requireAuth, controller.enregistrer);
  router.patch('/:id/justify', requireAuth, controller.justifierAbsence);

  return router;
}
