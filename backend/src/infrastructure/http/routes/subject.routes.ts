import { Router } from 'express';
import type { SubjectController } from '@infrastructure/http/controllers/SubjectController';

export function creerSubjectRoutes(controller: SubjectController): Router {
  const router = Router();

  router.post('/', controller.creerMatiere);
  router.put('/:id', controller.modifierMatiere);
  router.post('/teachers/:teacherId/assign', controller.assignerOuRetirer);
  router.post('/:id/coefficients', controller.definirCoefficients);

  return router;
}
