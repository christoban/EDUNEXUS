import { Router } from 'express';
import type { ParentController } from '@infrastructure/http/controllers/ParentController';

export function creerParentRoutes(controller: ParentController): Router {
  const router = Router();
  router.get('/children', controller.getEnfants);
  return router;
}
