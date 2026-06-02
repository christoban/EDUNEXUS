import { Router } from 'express';
import type { GradeController } from '@infrastructure/http/controllers/GradeController';
import { requireAuth } from '../../../middleware/auth';
import { sensitiveWriteLimiter } from '../../../middleware/rateLimit';

export function creerGradeRoutes(controller: GradeController): Router {
  const router = Router();

  // Lecture
  router.get('/', requireAuth, controller.lister);
  router.get('/pending', requireAuth, controller.listerEnAttente);
  router.get('/status/:classId', requireAuth, controller.statutParClasse);
  router.get('/average/:studentId', requireAuth, controller.moyenneEleve);

  // Saisie et modification
  router.post('/', sensitiveWriteLimiter, requireAuth, controller.saisir);
  router.put('/:id', sensitiveWriteLimiter, requireAuth, controller.modifier);

  // Workflow de validation
  router.patch('/:id/submit', requireAuth, controller.soumettre);
  router.patch('/:id/validate', sensitiveWriteLimiter, requireAuth, controller.valider);
  router.patch('/:id/reject', sensitiveWriteLimiter, requireAuth, controller.rejeter);
  router.post('/bulk-validate', sensitiveWriteLimiter, requireAuth, controller.validerTout);

  return router;
}
