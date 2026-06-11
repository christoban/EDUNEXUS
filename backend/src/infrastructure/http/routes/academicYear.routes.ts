import { Router } from 'express';
import type { AcademicYearController } from '@infrastructure/http/controllers/AcademicYearController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerAcademicYearRoutes(controller: AcademicYearController): Router {
  const router = Router();

  router.post('/', requireAuth, requireRole('ADMIN'), controller.creerAnnee);
  router.patch('/periods/:id/set-current', requireAuth, requireRole('ADMIN'), controller.definirPeriodeCourante);
  router.patch('/sequences/:id/set-current', requireAuth, requireRole('ADMIN'), controller.definirSequenceCourante);
  router.post('/:id/pre-close-check', requireAuth, requireRole('ADMIN'), controller.verifierAvantCloture);
  router.post('/:id/close', requireAuth, requireRole('ADMIN'), controller.cloturerAnnee);
  router.put('/:id/calendar', requireAuth, requireRole('ADMIN'), controller.mettreAJourCalendrierScolaire);

  return router;
}
