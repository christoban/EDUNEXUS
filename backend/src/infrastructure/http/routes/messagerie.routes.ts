import { Router } from 'express';
import type { MessagerieController } from '@infrastructure/http/controllers/MessagerieController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerMessagerieRoutes(controller: MessagerieController): Router {
  const router = Router();

  router.get('/conversations', requireAuth, controller.lister);
  router.get('/contacts', requireAuth, controller.contacts);
  router.get('/non-lus', requireAuth, controller.compterNonLus);
  router.get('/conversations/:id/messages', requireAuth, controller.listerMessagesConversation);
  router.post('/conversations/:id/lu', requireAuth, controller.marquerCommeLus);
  router.post('/messages', requireAuth, controller.envoyer);
  router.patch('/messages/:id/moderation', requireAuth, requireRole('ADMIN', 'STAFF'), controller.moderer);
  router.get('/moderation', requireAuth, requireRole('ADMIN', 'STAFF'), controller.listerModeration);

  return router;
}
