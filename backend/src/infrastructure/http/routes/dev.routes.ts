import { Router } from 'express';
import { requireAuth, requireRole } from '../../../middleware/auth';
import type { DevController } from '../controllers/DevController';

export function creerDevRoutes(controller: DevController): Router {
  const router = Router();

  router.post('/generate-assignments', requireAuth, requireRole('ADMIN'), controller.generateAssignments);
  router.post('/generate-timetables',  requireAuth, requireRole('ADMIN'), controller.generateTimetables);
  router.post('/generate-attendance',  requireAuth, requireRole('ADMIN'), controller.generateAttendance);
  router.post('/generate-grades',      requireAuth, requireRole('ADMIN'), controller.generateGrades);
  router.post('/reset',                requireAuth, requireRole('ADMIN'), controller.reset);

  return router;
}
