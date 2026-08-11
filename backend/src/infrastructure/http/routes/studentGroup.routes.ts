import { Router } from 'express';
import type { StudentGroupController } from '@infrastructure/http/controllers/StudentGroupController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerStudentGroupRoutes(controller: StudentGroupController): Router {
  const router = Router();

  router.post('/', requireAuth, requireRole('ADMIN'), controller.creerStudentGroupSet);
  router.put('/:id', requireAuth, requireRole('ADMIN'), controller.modifierStudentGroupSet);
  router.delete('/:id', requireAuth, requireRole('ADMIN'), controller.supprimerStudentGroupSet);

  router.post('/:groupSetId/groups', requireAuth, requireRole('ADMIN'), controller.creerStudentGroup);
  router.put('/groups/:id', requireAuth, requireRole('ADMIN'), controller.modifierStudentGroup);
  router.delete('/groups/:id', requireAuth, requireRole('ADMIN'), controller.supprimerStudentGroup);

  return router;
}
