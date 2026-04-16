import express from "express";
import { authorize, protect } from "../middleware/auth.ts";
import { getSchoolSettings, upsertSchoolSettings } from "../controllers/schoolSettings.ts";

const schoolSettingsRouter = express.Router();

schoolSettingsRouter.get("/", protect, authorize(["admin", "teacher", "student", "parent"]), getSchoolSettings);
schoolSettingsRouter.put("/", protect, authorize(["admin"]), upsertSchoolSettings);

export default schoolSettingsRouter;
