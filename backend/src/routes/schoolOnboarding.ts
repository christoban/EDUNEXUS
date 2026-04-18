import express from "express";
import {
  acceptSchoolOnboardingInvite,
  createSchoolOnboardingRequest,
  getActiveSchoolsForLogin,
  getSchoolOnboardingInvite,
  getSchoolOnboardingRequests,
  getSchoolOnboardingTemplates,
  approveSchoolOnboardingRequest,
  rejectSchoolOnboardingRequest,
} from "../controllers/schoolOnboarding.ts";
import { protectMaster, authorizeMaster } from "../middleware/authMultiTenant.ts";
import { masterMfaLimiter } from "../middleware/rateLimit.ts";
import { requireMasterSensitiveAuth } from "../middleware/masterSensitiveAuth.ts";

const router = express.Router();

router.get("/templates", getSchoolOnboardingTemplates);
router.get("/schools/active", getActiveSchoolsForLogin);
router.post("/requests", createSchoolOnboardingRequest);
router.get("/invites/:token", getSchoolOnboardingInvite);
router.post("/invites/:token/accept", acceptSchoolOnboardingInvite);

router.get("/requests", protectMaster, authorizeMaster(["super_admin", "platform_admin"]), getSchoolOnboardingRequests);
router.post("/requests/:schoolId/approve", protectMaster, authorizeMaster(["super_admin", "platform_admin"]), masterMfaLimiter, requireMasterSensitiveAuth, approveSchoolOnboardingRequest);
router.post("/requests/:schoolId/reject", protectMaster, authorizeMaster(["super_admin", "platform_admin"]), masterMfaLimiter, requireMasterSensitiveAuth, rejectSchoolOnboardingRequest);

export default router;