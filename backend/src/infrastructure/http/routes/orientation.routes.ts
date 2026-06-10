import { Router } from 'express';
import type { OrientationController } from '@infrastructure/http/controllers/OrientationController';
import { requireAuth } from '../../../middleware/auth';

export function creerOrientationRoutes(controller: OrientationController): Router {
  const router = Router();

  // Stats
  router.get('/stats', requireAuth, controller.obtenirStats);

  // Fiches
  router.get('/fiches',     requireAuth, controller.lister);
  router.post('/fiches',    requireAuth, controller.creer);
  router.get('/fiches/:id', requireAuth, controller.detail);

  // Entretiens
  router.post('/fiches/:id/entretiens',  requireAuth, controller.ajouterEntretienHandler);
  router.patch('/entretiens/:id',         requireAuth, controller.modifierEntretien);

  // Tests d'aptitude
  router.post('/fiches/:id/tests', requireAuth, controller.ajouterTestHandler);

  // Recommandation série
  router.post('/fiches/:id/recommandation-serie',      requireAuth, controller.creerRecommandationHandler);
  router.patch('/recommandations/:id/valider',          requireAuth, controller.validerRecommandation);

  // Suivis
  router.post('/fiches/:id/suivis', requireAuth, controller.ajouterSuiviHandler);

  return router;
}
