import { Router } from 'express';
import type { MasterAdminHexController } from '@infrastructure/http/controllers/MasterAdminHexController';
import { protectMaster, authorizeMaster } from '../../../middleware/authMultiTenant';
import { requireMasterSensitiveAuth } from '../../../middleware/masterSensitiveAuth';

export function creerMasterAdminHexRoutes(controller: MasterAdminHexController): Router {
  const router = Router();

  router.use(protectMaster);
  router.use(authorizeMaster(['super_admin', 'platform_admin']));

  router.get('/schools', controller.listerEcoles);
  router.get('/schools/:id', controller.detailEcole);
  router.post('/schools/invite', requireMasterSensitiveAuth, controller.inviterEcole);
  router.post('/schools/:id/suspend', controller.suspendreEcole);
  router.post('/schools/:id/reactivate', controller.reactiverEcole);
  router.post('/schools/:id/reject',    controller.rejeterEcole);
  router.post('/schools/:id/reexamine',     controller.reexaminerEcole);
  router.post('/schools/:id/resend-invite', controller.renvoyerInvitation);
  router.patch('/schools/:id/plan', controller.changerPlanEcole);
  router.delete('/schools/:id', controller.supprimerEcole);
  router.get('/auth/logs', controller.listerLogs);

  return router;
}
