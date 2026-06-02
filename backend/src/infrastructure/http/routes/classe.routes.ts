import { Router } from 'express';
import type { ClasseController } from '@infrastructure/http/controllers/ClasseController';

export function creerClasseRoutes(controller: ClasseController): Router {
  const router = Router();

  router.post('/', controller.creerClasse);
  router.put('/:id', controller.modifierClasse);
  router.delete('/:id', controller.supprimerClasse);
  router.patch('/:id/professor-principal', controller.assignerProfesseurPrincipal);
  router.post('/:id/subgroups', controller.creerSousGroupeTP);
  router.post('/subgroups/:subGroupId/students', controller.assignerElevesAuSousGroupe);

  return router;
}
