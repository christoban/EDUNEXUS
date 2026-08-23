import { Router } from 'express';
import type { ActiverEtablissementUseCase } from '@application/school/ActiverEtablissementUseCase';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerSchoolConfigRoutes(activateUseCase: ActiverEtablissementUseCase): Router {
  const router = Router();

  // POST /api/v2/schools/:id/activate — Active l'établissement après configuration
  router.post('/schools/:id/activate', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params.id as string;

      // requireRole('ADMIN') répond à « cette personne a-t-elle le droit d'activer ? », jamais à
      // « quelle école ? ». Sans cette comparaison, un admin de l'école A peut déclencher
      // l'activation de l'école B (création de classes, matières, structure).
      // Le use case fait légitimement confiance au schoolId reçu : la vérification appartient ici.
      if (schoolId !== req.user!.schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const result = await activateUseCase.execute({ schoolId });
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('introuvable')) {
          res.status(404).json({ success: false, message: error.message });
          return;
        }
        if (error.message.includes('doit être approuvé')) {
          res.status(422).json({ success: false, message: error.message });
          return;
        }
      }
      next(error);
    }
  });

  return router;
}
