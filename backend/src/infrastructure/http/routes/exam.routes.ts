import { Router } from 'express';
import type { ExamController } from '@infrastructure/http/controllers/ExamController';
import { requireAuth, requireRole } from '../../../middleware/auth';
import { sensitiveWriteLimiter } from '../../../middleware/rateLimit';

export function creerExamRoutes(controller: ExamController): Router {
  const router = Router();

  router.post('/generate', sensitiveWriteLimiter, requireAuth, requireRole('TEACHER', 'ADMIN'), controller.triggerGeneration);
  router.get('/', requireAuth, requireRole('TEACHER', 'STUDENT', 'ADMIN'), controller.getAll);
  router.get('/generation/:id', requireAuth, requireRole('TEACHER', 'ADMIN'), controller.getGeneration);
  router.get('/:id/result', requireAuth, requireRole('STUDENT', 'ADMIN'), controller.getResult);
  router.get('/:id', requireAuth, requireRole('TEACHER', 'STUDENT', 'ADMIN'), controller.getById);
  router.post('/:id/submit', sensitiveWriteLimiter, requireAuth, requireRole('STUDENT', 'ADMIN'), controller.submit);
  router.patch('/:id/status', sensitiveWriteLimiter, requireAuth, requireRole('TEACHER', 'ADMIN'), controller.toggleStatus);
  router.delete('/:id', sensitiveWriteLimiter, requireAuth, requireRole('TEACHER', 'ADMIN'), controller.delete);

  return router;
}
