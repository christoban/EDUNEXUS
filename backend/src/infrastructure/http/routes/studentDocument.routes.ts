import { Router } from 'express';
import { requireAuth, requireRole } from '../../../middleware/auth';
import type { StudentDocumentController } from '@infrastructure/http/controllers/StudentDocumentController';

export function creerStudentDocumentRoutes(controller: StudentDocumentController): Router {
  const router = Router();

  // Documents individuels — ADMIN ou STAFF
  router.get(
    '/students/:id/certificat',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    controller.getCertificat
  );

  router.get(
    '/students/:id/carte',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    controller.getCarte
  );

  router.get(
    '/students/:id/lettre-transfert',
    requireAuth,
    requireRole('ADMIN', 'STAFF'),
    controller.getLettreTransfert
  );

  // Vérification publique — sans auth
  router.get('/verify/:documentId', controller.verifyDocument);

  return router;
}
