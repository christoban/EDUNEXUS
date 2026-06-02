import { Router } from 'express';
import type { MasterAdminHexController } from '@infrastructure/http/controllers/MasterAdminHexController';

export function creerMasterAdminHexRoutes(controller: MasterAdminHexController): Router {
  const router = Router();

  router.post('/schools/invite', controller.inviterEcole);
  router.post('/schools/:id/suspend', controller.suspendreEcole);
  router.post('/schools/:id/reactivate', controller.reactiverEcole);
  router.post('/schools/:id/reject', controller.rejeterEcole);
  router.patch('/schools/:id/plan', controller.changerPlanEcole);

  return router;
}
