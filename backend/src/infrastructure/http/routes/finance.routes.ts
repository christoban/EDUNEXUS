import { Router } from 'express';
import type { FinanceController } from '@infrastructure/http/controllers/FinanceController';

export function creerFinanceRoutes(controller: FinanceController): Router {
  const router = Router();

  // Plans de frais
  router.post('/fee-plans', controller.creerPlan);

  // Factures
  router.post('/invoices', controller.creerFacture);
  router.post('/invoices/bulk', controller.creerFacturesEnMasse);

  // Paiements Mobile Money
  router.post('/payments/mobile', controller.initierPaiementMobile);
  router.post('/payments/caution/:id/rembourser', controller.rembourserCautionEleve);

  // Webhook Campay — pas d'auth middleware
  router.post('/payments/webhook/campay', controller.webhookCampay);

  // Dépenses
  router.post('/expenses', controller.creerDepense);

  return router;
}
