import { Router } from 'express';
import type { SubjectController } from '@infrastructure/http/controllers/SubjectController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerSubjectRoutes(controller: SubjectController): Router {
  const router = Router();

  router.post('/', requireAuth, requireRole('ADMIN'), controller.creerMatiere);
  router.put('/:id', requireAuth, requireRole('ADMIN'), controller.modifierMatiere);
  router.post('/teachers/:teacherId/assign', requireAuth, requireRole('ADMIN'), controller.assignerOuRetirer);
  router.post('/:id/coefficients', requireAuth, requireRole('ADMIN'), controller.definirCoefficients);
  router.delete('/:id', requireAuth, requireRole('ADMIN'), controller.supprimerMatiere);

  return router;
}
