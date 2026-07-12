import { Router } from 'express';
import { requireAuth, requireRole } from '../../../middleware/auth';
import { authLimiter } from '../../../middleware/rateLimit';
import type { EleveOnboardingController } from '../controllers/EleveOnboardingController';

export function creerEleveOnboardingRoutes(controller: EleveOnboardingController): Router {
  const router = Router();

  // Création / gestion — établissement authentifié
  router.post('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.creer);
  router.get('/', requireAuth, requireRole('ADMIN', 'STAFF'), controller.lister);
  router.get('/settings', requireAuth, requireRole('ADMIN', 'STAFF'), controller.getSettings);
  router.patch('/settings', requireAuth, requireRole('ADMIN'), controller.updateSettings);
  router.post('/:id/validate', requireAuth, requireRole('ADMIN', 'STAFF'), controller.valider);
  router.post('/:id/reject', requireAuth, requireRole('ADMIN', 'STAFF'), controller.rejeter);
  router.post('/:id/resend-link', requireAuth, requireRole('ADMIN', 'STAFF'), controller.renvoyerLien);

  // Formulaire élève/parent — public, protégé par le token lui-même (rate-limité contre le brute-force)
  router.get('/token/:token', authLimiter, controller.getByToken);
  router.post('/token/:token/submit', authLimiter, controller.soumettre);

  return router;
}
