import { Router } from 'express';
import { requireAuth, requireRole } from '../../../middleware/auth';
import type { PaiementMinesecController } from '../controllers/PaiementMinesecController';

export function creerPaiementMinesecRoutes(controller: PaiementMinesecController): Router {
  const router = Router();

  // Génération des frais attendus (crée l'Enrollment si besoin — voir GenererPaiementsMinesecUseCase)
  router.post('/generate/:studentProfileId', requireAuth, requireRole('ADMIN'), controller.generer);
  router.post('/generate-school', requireAuth, requireRole('ADMIN'), controller.genererEcole);

  // Alertes retards de paiement
  router.get('/payment-alerts', requireAuth, requireRole('ADMIN', 'STAFF'), controller.paymentAlerts);

  // Liste paiements MINESEC d'un élève
  router.get('/:studentId/:anneeScolaire', requireAuth, requireRole('ADMIN', 'STAFF', 'PARENT'), controller.lister);

  // Dashboard consolidé élève
  router.get('/dashboard/student/:studentId', requireAuth, requireRole('ADMIN', 'STAFF', 'PARENT'), controller.dashboard);

  // Dashboard global école
  router.get('/dashboard/school', requireAuth, requireRole('ADMIN', 'STAFF'), controller.dashboardEcole);

  return router;
}
