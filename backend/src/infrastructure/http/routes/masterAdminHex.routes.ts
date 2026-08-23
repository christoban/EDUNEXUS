import { Router } from 'express';
import type { MasterAdminHexController } from '@infrastructure/http/controllers/MasterAdminHexController';
import { protectMaster, authorizeMaster } from '../middlewares/authMultiTenant.ts';
import { requireMasterSensitiveAuth } from '../middlewares/masterSensitiveAuth.ts';

export function creerMasterAdminHexRoutes(controller: MasterAdminHexController): Router {
  const router = Router();

  router.use(protectMaster);
  router.use(authorizeMaster(['super_admin', 'platform_admin']));

  router.get('/schools',      controller.listerEcoles);
  router.get('/schools/:id',  controller.detailEcole);
  router.get('/auth/logs',    controller.listerLogs);
  router.get('/email-logs',   controller.listerEmailLogs);
  router.get('/backup/list',  controller.listerSauvegardes);
  router.get('/security-audit-log', controller.listerJournalSecuriteIA);
  router.patch('/schools/:id/plan', controller.changerPlanEcole);

  // ── Actions décisives — vérification identité obligatoire ──────────────
  router.post('/schools/invite',            requireMasterSensitiveAuth, controller.inviterEcole);
  router.post('/schools/:id/reject',        requireMasterSensitiveAuth, controller.rejeterEcole);
  router.post('/schools/:id/suspend',       requireMasterSensitiveAuth, controller.suspendreEcole);
  router.post('/schools/:id/reactivate',    requireMasterSensitiveAuth, controller.reactiverEcole);
  router.post('/schools/:id/cancel-approval', requireMasterSensitiveAuth, controller.annulerApprobationEcole);
  router.post('/schools/:id/reexamine',       requireMasterSensitiveAuth, controller.reexaminerEcole);
  router.post('/schools/:id/sync-subjects',   controller.syncSubjects);
  router.post('/schools/:id/resend-invite', requireMasterSensitiveAuth, controller.renvoyerInvitation);
  router.post('/backup/trigger', requireMasterSensitiveAuth, controller.declencherSauvegarde);
  router.post('/users/mfa-reset', requireMasterSensitiveAuth, controller.reinitialiserMfaUtilisateur);
  router.delete('/schools/:id',             requireMasterSensitiveAuth, controller.supprimerEcole);

  return router;
}
