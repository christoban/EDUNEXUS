import { Router } from 'express';
import type { StaffAttendanceController } from '../controllers/StaffAttendanceController';
import { requireAuth, requireRole } from '../middlewares/auth';

export function creerStaffAttendanceRoutes(ctrl: StaffAttendanceController): Router {
  const router = Router();

  // L'enseignant pointe sa présence (QR / GPS / manuel) — tout rôle connecté de l'école peut pointer
  router.post('/pointer', requireAuth, ctrl.pointer);
  // L'enseignant récupère le QR de sa salle courante
  router.get('/scan-info', requireAuth, ctrl.scanInfo);
  // RH : lister et requalifier les pointages A_VERIFIER
  router.get('/a-verifier', requireAuth, requireRole('ADMIN', 'STAFF'), ctrl.listerAVerifier);
  router.patch('/:id/requalifier', requireAuth, requireRole('ADMIN', 'STAFF'), ctrl.requalifier);

  return router;
}