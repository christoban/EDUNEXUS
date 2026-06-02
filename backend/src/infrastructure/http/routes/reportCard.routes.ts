import { Router } from 'express';
import type { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { requireAuth, requireRole } from '../../../middleware/auth';
import { sensitiveWriteLimiter } from '../../../middleware/rateLimit';

export function creerReportCardRoutes(controller: ReportCardController): Router {
  const router = Router();

  // Vérification pré-génération
  router.get('/check/:classId', requireAuth, controller.verifierDisponibilite);

  // Génération via use case hexagonal (remplace l'ancien /generate/:classId + Inngest trigger)
  router.post('/generate', sensitiveWriteLimiter, requireAuth, requireRole('ADMIN', 'STAFF'), controller.genererBulletins);

  // Export ZIP en masse
  router.post('/export/:classId', sensitiveWriteLimiter, requireAuth, requireRole('ADMIN', 'STAFF'), controller.exporterZip);

  // Envoi aux parents via use case hexagonal
  router.post('/send', sensitiveWriteLimiter, requireAuth, requireRole('ADMIN', 'STAFF'), controller.envoyerBulletins);

  // Vue élève (avant GET / pour éviter que "my" soit traité comme un :id)
  router.get('/my', requireAuth, controller.mesBulletins);

  // Historique bulletins
  router.get('/', requireAuth, controller.lister);

  // Téléchargement PDF individuel
  router.get('/:id/pdf', requireAuth, controller.telechargerPdf);

  return router;
}
