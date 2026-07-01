import { Router } from 'express';
import multer from 'multer';
import type { GradeController } from '@infrastructure/http/controllers/GradeController';
import { requireAuth } from '../../../middleware/auth';
import { sensitiveWriteLimiter } from '../../../middleware/rateLimit';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function creerGradeRoutes(controller: GradeController): Router {
  const router = Router();

  // Lecture
  router.get('/', requireAuth, controller.lister);
  router.get('/pending', requireAuth, controller.listerEnAttente);
  router.get('/status/:classId', requireAuth, controller.statutParClasse);
  router.get('/average/:studentId', requireAuth, controller.moyenneEleve);

  // Import Excel (template + upload)
  router.get('/template', requireAuth, controller.genererTemplate);
  router.post('/import', sensitiveWriteLimiter, requireAuth, upload.single('file'), controller.importerDepuisExcel);

  // Saisie et modification
  router.post('/', sensitiveWriteLimiter, requireAuth, controller.saisir);
  router.post('/draft', sensitiveWriteLimiter, requireAuth, controller.draftEnMasse);
  router.post('/submit', sensitiveWriteLimiter, requireAuth, controller.soumettreEnMasse);
  router.put('/:id', sensitiveWriteLimiter, requireAuth, controller.modifier);

  // Workflow de validation
  router.patch('/:id/submit', requireAuth, controller.soumettre);
  router.patch('/:id/validate', sensitiveWriteLimiter, requireAuth, controller.valider);
  router.patch('/:id/reject', sensitiveWriteLimiter, requireAuth, controller.rejeter);
  router.post('/bulk-validate', sensitiveWriteLimiter, requireAuth, controller.validerTout);

  return router;
}
