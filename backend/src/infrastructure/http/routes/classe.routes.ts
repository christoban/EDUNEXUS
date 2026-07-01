import { Router } from 'express';
import type { ClasseController } from '@infrastructure/http/controllers/ClasseController';
import { requireAuth, requireRole } from '../../../middleware/auth';

export function creerClasseRoutes(controller: ClasseController): Router {
  const router = Router();

  router.post('/', requireAuth, requireRole('ADMIN'), controller.creerClasse);
  router.put('/:id', requireAuth, requireRole('ADMIN'), controller.modifierClasse);
  router.delete('/:id', requireAuth, requireRole('ADMIN'), controller.supprimerClasse);
  router.patch('/:id/professor-principal', requireAuth, requireRole('ADMIN'), controller.assignerProfesseurPrincipal);
  router.get('/:id/students', requireAuth, controller.getStudents);
  router.get('/:id/tableau-honneur', requireAuth, controller.tableauHonneur);
  router.get('/:id/tableau-honneur-annuel', requireAuth, controller.tableauHonneurAnnuel);
  router.post('/:id/subgroups', requireAuth, requireRole('ADMIN'), controller.creerSousGroupeTP);
  router.post('/subgroups/:subGroupId/students', requireAuth, requireRole('ADMIN'), controller.assignerElevesAuSousGroupe);
  router.post('/:classId/subjects', requireAuth, requireRole('ADMIN'), controller.ajouterMatiereClasse);
  router.delete('/:classId/subjects/:subjectId', requireAuth, requireRole('ADMIN'), controller.supprimerMatiereClasse);

  return router;
}
