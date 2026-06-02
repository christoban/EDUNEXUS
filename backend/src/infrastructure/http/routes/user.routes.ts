import { Router } from 'express';
import type { UserController } from '@infrastructure/http/controllers/UserController';

export function creerUserRoutes(controller: UserController): Router {
  const router = Router();

  // Auth
  router.post('/auth/login', controller.login);
  router.post('/auth/logout', controller.logout);
  router.post('/auth/refresh', controller.refresh);

  // Gestion utilisateurs
  router.post('/', controller.register);
  router.put('/:id', controller.update);
  router.delete('/:id', controller.delete);

  // Transfert élève
  router.post('/students/:id/transfer', controller.transfer);

  return router;
}
