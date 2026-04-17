import express from "express";
import {
  masterLogin,
  createSchool,
  listSchools,
  getSchool,
  updateSchool,
  setSchoolConfig,
  getSchoolConfig,
} from "../controllers/masterAdmin.ts";
import { protectMaster, authorizeMaster } from "../middleware/authMultiTenant.ts";

const router = express.Router();

/**
 * AUTH (publique)
 */
router.post("/auth/login", masterLogin);

/**
 * SCHOOLS (admin)
 */
router.post("/schools", protectMaster, authorizeMaster(["super_admin"]), createSchool);
router.get("/schools", protectMaster, authorizeMaster(["super_admin", "platform_admin"]), listSchools);
router.get("/schools/:schoolId", protectMaster, getSchool);
router.put("/schools/:schoolId", protectMaster, authorizeMaster(["super_admin"]), updateSchool);

/**
 * CONFIGS
 */
router.post("/schools/:schoolId/config", protectMaster, authorizeMaster(["super_admin", "school_manager"]), setSchoolConfig);
router.get("/schools/:schoolId/config", protectMaster, getSchoolConfig);

export default router;
