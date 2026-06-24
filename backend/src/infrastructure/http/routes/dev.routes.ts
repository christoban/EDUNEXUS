import { Router } from 'express';
import { requireAuth, requireRole } from '../../../middleware/auth';
import type { DevController } from '../controllers/DevController';

export function creerDevRoutes(controller: DevController): Router {
  const router = Router();

  const adminOrStaff = requireRole('ADMIN', 'STAFF');

  router.get('/diagnostic',            requireAuth, adminOrStaff,           controller.diagnostic);
  router.get('/audit-integrity',       requireAuth, adminOrStaff,           controller.auditIntegrity);
  router.post('/generate-assignments', requireAuth, adminOrStaff,           controller.generateAssignments);
  router.post('/generate-timetables',  requireAuth, adminOrStaff,           controller.generateTimetables);
  router.post('/generate-attendance',  requireAuth, adminOrStaff,           controller.generateAttendance);
  router.post('/generate-grades',      requireAuth, adminOrStaff,           controller.generateGrades);
  router.post('/assign-class',         requireAuth, adminOrStaff,           controller.assignClass);
  router.post('/delete-students',      requireAuth, requireRole('ADMIN'),   controller.deleteStudents);
  router.post('/delete-teachers',      requireAuth, requireRole('ADMIN'),   controller.deleteTeachers);
  router.post('/reset',                requireAuth, requireRole('ADMIN'),   controller.reset);

  return router;
}
