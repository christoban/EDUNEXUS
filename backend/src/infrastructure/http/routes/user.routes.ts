import { Router } from 'express';
import multer from 'multer';
import type { UserController } from '@infrastructure/http/controllers/UserController';
import { requireAuth, requireRole } from '../../../middleware/auth';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Utilisez .xlsx ou .xls'));
    }
  },
});

export function creerUserRoutes(controller: UserController): Router {
  const router = Router();

  // Auth — pas de middleware (routes publiques)
  router.post('/auth/login', controller.login);
  router.post('/auth/logout', controller.logout);
  router.post('/auth/refresh', controller.refresh);

  // Gestion utilisateurs
  router.post('/', requireAuth, requireRole('ADMIN'), controller.register);
  router.put('/:id', requireAuth, controller.update);
  router.delete('/:id', requireAuth, requireRole('ADMIN'), controller.delete);

  // Import Excel
  router.post('/import', requireAuth, requireRole('ADMIN'), upload.single('file'), controller.importUsers);

  // Transfert élève
  router.post('/students/:id/transfer', requireAuth, requireRole('ADMIN'), controller.transfer);

  // Désignation AP (Animateur Pédagogique / HOD)
  router.patch('/:id/ap-designation', requireAuth, requireRole('ADMIN'), controller.apDesignation);

  return router;
}
