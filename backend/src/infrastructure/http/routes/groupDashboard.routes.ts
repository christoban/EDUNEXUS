import { Router } from 'express';
import type { GroupDashboardController } from '../controllers/GroupDashboardController';
import { protectGroupOwner } from '../../../middleware/authMultiTenant';

export function creerGroupDashboardRoutes(controller: GroupDashboardController): Router {
  const router = Router();

  router.use(protectGroupOwner);

  router.get('/kpis', controller.obtenirKpis);
  router.get('/schools', controller.listerEcoles);
  router.get('/schools/:schoolId', controller.obtenirDetailEcole);

  return router;
}
