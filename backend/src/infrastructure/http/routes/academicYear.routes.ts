import { Router } from 'express';
import type { AcademicYearController } from '@infrastructure/http/controllers/AcademicYearController';

export function creerAcademicYearRoutes(controller: AcademicYearController): Router {
  const router = Router();

  router.post('/', controller.creerAnnee);
  router.patch('/periods/:id/set-current', controller.definirPeriodeCourante);
  router.patch('/sequences/:id/set-current', controller.definirSequenceCourante);
  router.post('/:id/pre-close-check', controller.verifierAvantCloture);
  router.post('/:id/close', controller.cloturerAnnee);
  router.put('/:id/calendar', controller.mettreAJourCalendrierScolaire);

  return router;
}
