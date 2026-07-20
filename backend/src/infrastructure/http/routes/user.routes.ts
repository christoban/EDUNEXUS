import { Router } from 'express';
import multer from 'multer';
import type { UserController } from '@infrastructure/http/controllers/UserController';
import { requireAuth, requireRole } from '../../../middleware/auth';
import { authLimiter, userEmailOtpLimiter, userMfaLimiter } from '../../../middleware/rateLimit';
import { requireUserSensitiveAuth } from '../../../middleware/requireUserSensitiveAuth';

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

  // Auth — pas de middleware (routes publiques), rate-limitées
  router.post('/auth/login',             authLimiter,          controller.login);
  router.post('/auth/verify-login-otp',  userEmailOtpLimiter,  controller.verifyLoginOtp);
  router.post('/auth/resend-login-otp',  userEmailOtpLimiter,  controller.resendLoginOtp);
  router.post('/auth/verify-login-mfa',  userMfaLimiter,       controller.verifyLoginMfa);
  router.post('/auth/mfa/first-setup',   userMfaLimiter,       controller.firstMfaSetup);
  router.post('/auth/mfa/first-enable',  userMfaLimiter,       controller.firstMfaEnable);
  router.post('/auth/logout', controller.logout);
  router.post('/auth/refresh', controller.refresh);

  // MFA — gestion depuis le dashboard (authentifié)
  router.get('/mfa/status',              requireAuth,                                controller.mfaStatus);
  router.post('/mfa/reconfigure/start',  requireAuth, requireUserSensitiveAuth,       controller.mfaReconfigureStart);
  router.post('/mfa/reconfigure/confirm',requireAuth,                                controller.mfaReconfigureConfirm);
  router.post('/mfa/regen-codes',        requireAuth, requireUserSensitiveAuth,       controller.mfaRegenCodes);

  // Récupération de mot de passe — publique
  router.post('/auth/forgot-password', controller.forgotPassword);
  router.post('/auth/reset-password', controller.resetPassword);

  // Changement de mot de passe — authentifié
  router.post('/auth/change-password', requireAuth, controller.changePassword);

  // Invitation utilisateur — publique (pas de session)
  router.get('/auth/invite/validate', controller.validateInvite);
  router.post('/auth/invite/complete', controller.completeInvite);

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
