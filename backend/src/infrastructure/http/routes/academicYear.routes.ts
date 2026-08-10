import { Router } from 'express';
import type { AcademicYearController } from '@infrastructure/http/controllers/AcademicYearController';
import { requireAuth, requireRole, requireRoleOrPermission } from '../../../middleware/auth';

export function creerAcademicYearRoutes(controller: AcademicYearController): Router {
  const router = Router();

  router.post('/', requireAuth, requireRole('ADMIN'), controller.creerAnnee);
  router.patch('/periods/:id/set-current', requireAuth, requireRole('ADMIN'), controller.definirPeriodeCourante);
  router.patch('/sequences/:id/set-current', requireAuth, requireRole('ADMIN'), controller.definirSequenceCourante);
  router.post('/:id/pre-close-check', requireAuth, requireRole('ADMIN'), controller.verifierAvantCloture);
  // Admin ou Censeur (titre STAFF porteur de VALIDATE_GRADES) — même règle que la présidence
  // de Conseil de Classe (TenirConseilClasseUseCase). La validation reste Admin seul, sans
  // exception : c'est elle qui verrouille la structure avant clôture réelle des élèves.
  router.post('/:id/propose-next-structure', requireAuth, requireRoleOrPermission(['ADMIN'], 'VALIDATE_GRADES'), controller.proposerStructureAnneeSuivante);
  router.post('/:id/validate-structure', requireAuth, requireRole('ADMIN'), controller.validerStructureAnneeSuivante);
  // Symétrique de propose (même autorité : annuler sa propre proposition avant validation).
  router.post('/:id/cancel-proposed-structure', requireAuth, requireRoleOrPermission(['ADMIN'], 'VALIDATE_GRADES'), controller.annulerStructureAnneeSuivante);
  router.post('/:id/close', requireAuth, requireRole('ADMIN'), controller.cloturerAnnee);
  router.put('/:id/calendar', requireAuth, requireRole('ADMIN'), controller.mettreAJourCalendrierScolaire);

  return router;
}
