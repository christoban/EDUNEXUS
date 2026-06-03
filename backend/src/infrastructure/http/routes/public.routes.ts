import { Router } from 'express';
import type { PublicController } from '@infrastructure/http/controllers/PublicController';

export function creerPublicRoutes(controller: PublicController): Router {
  const router = Router();
  router.post('/contact-request', controller.contactRequest);
  return router;
}
