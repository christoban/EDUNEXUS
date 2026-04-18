import express from "express";
import {
  masterLogin,
  masterVerifyEmailCode,
  masterVerifyMfa,
  getMasterMfaStatus,
  regenerateMasterRecoveryCodes,
  disableMasterMfa,
  beginMasterMfaEnable,
  confirmMasterMfaEnable,
  startMasterPasswordChange,
  confirmMasterPasswordChange,
  masterMe,
  masterLogout,
  createSchool,
  listSchools,
  getSchool,
  updateSchool,
  suspendSchool,
  reactivateSchool,
  regenerateSchoolInvite,
  resendSchoolInviteEmail,
  getSchoolActivityLogs,
  getSchoolInviteEmailStatus,
  getMasterEmailLogs,
  getMasterAuthAuditLogs,
  setSchoolConfig,
  getSchoolConfig,
} from "../controllers/masterAdmin.ts";
import { protectMaster, authorizeMaster } from "../middleware/authMultiTenant.ts";
import { masterAuthLimiter, masterMfaLimiter, masterEmailOtpLimiter } from "../middleware/rateLimit.ts";
import { restrictMasterLoginByIp } from "../middleware/masterAuthSecurity.ts";
import { requireMasterSensitiveAuth } from "../middleware/masterSensitiveAuth.ts";

const router = express.Router();

/**
 * AUTH (publique)
 */
router.post("/auth/login", masterAuthLimiter, restrictMasterLoginByIp, masterLogin);
router.post("/auth/verify-email-code", masterEmailOtpLimiter, restrictMasterLoginByIp, masterVerifyEmailCode);
router.post("/auth/verify-mfa", masterMfaLimiter, restrictMasterLoginByIp, masterVerifyMfa);
router.get("/auth/me", protectMaster, masterMe);
router.get("/auth/mfa-status", protectMaster, getMasterMfaStatus);
router.post("/auth/mfa/recovery-codes/regenerate", protectMaster, masterMfaLimiter, requireMasterSensitiveAuth, regenerateMasterRecoveryCodes);
router.post("/auth/mfa/disable", protectMaster, masterMfaLimiter, requireMasterSensitiveAuth, disableMasterMfa);
router.post("/auth/mfa/enable/start", protectMaster, masterMfaLimiter, beginMasterMfaEnable);
router.post("/auth/mfa/enable/confirm", protectMaster, masterMfaLimiter, confirmMasterMfaEnable);
router.post("/auth/password/change/start", protectMaster, masterMfaLimiter, requireMasterSensitiveAuth, startMasterPasswordChange);
router.post("/auth/password/change/confirm", protectMaster, masterMfaLimiter, confirmMasterPasswordChange);
router.post("/auth/logout", protectMaster, masterLogout);
router.get("/email-logs", protectMaster, getMasterEmailLogs);
router.get("/security/auth-audits", protectMaster, authorizeMaster(["super_admin"]), getMasterAuthAuditLogs);

/**
 * SCHOOLS (admin)
 */
router.post("/schools", protectMaster, authorizeMaster(["super_admin"]), masterMfaLimiter, requireMasterSensitiveAuth, createSchool);
router.get("/schools", protectMaster, authorizeMaster(["super_admin"]), listSchools);
router.get("/schools/:schoolId", protectMaster, authorizeMaster(["super_admin"]), getSchool);
router.put("/schools/:schoolId", protectMaster, authorizeMaster(["super_admin"]), masterMfaLimiter, requireMasterSensitiveAuth, updateSchool);
router.post("/schools/:schoolId/suspend", protectMaster, authorizeMaster(["super_admin"]), masterMfaLimiter, requireMasterSensitiveAuth, suspendSchool);
router.post("/schools/:schoolId/reactivate", protectMaster, authorizeMaster(["super_admin"]), masterMfaLimiter, requireMasterSensitiveAuth, reactivateSchool);
router.post("/schools/:schoolId/invite/regenerate", protectMaster, authorizeMaster(["super_admin"]), masterMfaLimiter, requireMasterSensitiveAuth, regenerateSchoolInvite);
router.post("/schools/:schoolId/invite/resend", protectMaster, authorizeMaster(["super_admin"]), masterMfaLimiter, requireMasterSensitiveAuth, resendSchoolInviteEmail);
router.get("/schools/:schoolId/invite/email-status", protectMaster, authorizeMaster(["super_admin"]), getSchoolInviteEmailStatus);
router.get("/schools/:schoolId/activity-logs", protectMaster, authorizeMaster(["super_admin"]), getSchoolActivityLogs);

/**
 * CONFIGS
 */
router.post("/schools/:schoolId/config", protectMaster, authorizeMaster(["super_admin"]), masterMfaLimiter, requireMasterSensitiveAuth, setSchoolConfig);
router.get("/schools/:schoolId/config", protectMaster, authorizeMaster(["super_admin"]), getSchoolConfig);

export default router;
