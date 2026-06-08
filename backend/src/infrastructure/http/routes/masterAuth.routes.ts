import { Router } from 'express';
import type { MasterAuthController } from '../controllers/MasterAuthController';
import { protectMaster } from '../../../middleware/authMultiTenant';
import { restrictMasterLoginByIp } from '../../../middleware/masterAuthSecurity';
import { masterAuthLimiter, masterEmailOtpLimiter, masterMfaLimiter } from '../../../middleware/rateLimit';
import { requireMasterSensitiveAuth } from '../../../middleware/masterSensitiveAuth';

export function creerMasterAuthRoutes(controller: MasterAuthController): Router {
  const router = Router();

  router.post('/login',      masterAuthLimiter,      restrictMasterLoginByIp, controller.login);
  router.post('/verify-otp', masterEmailOtpLimiter,                              controller.verifyOtp);
  router.post('/verify-mfa', masterMfaLimiter,                                   controller.verifyMfa);
  router.post('/resend-otp', masterEmailOtpLimiter,                              controller.resendOtp);
  router.post('/change-password', protectMaster, requireMasterSensitiveAuth,      controller.changePassword);
  router.get('/me',          protectMaster,                                       controller.me);
  router.get('/mfa-status',  protectMaster,                                       controller.mfaStatus);
  router.post('/logout',     protectMaster,                                       controller.logout);

  return router;
}
