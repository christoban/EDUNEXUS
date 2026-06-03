import { Router } from 'express';
import type { AIController } from '@infrastructure/http/controllers/AIController';
import { requireAuth } from '../../../middleware/auth';
import { sensitiveWriteLimiter } from '../../../middleware/rateLimit';

export function creerAIRoutes(controller: AIController): Router {
  const router = Router();
  router.use(requireAuth);
  router.post('/generate-insight', sensitiveWriteLimiter, controller.generateInsight);
  router.get('/students-health', controller.getStudentsHealth);
  router.post('/bulletin-comment', sensitiveWriteLimiter, controller.generateBulletinComment);
  router.post('/chat', sensitiveWriteLimiter, controller.chat);
  router.get('/risk-detection/:studentId', controller.detectRisk);
  return router;
}
