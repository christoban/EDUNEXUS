import express from "express";
import { authorize, protect } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { getSchoolSettings, upsertSchoolSettings } from "../controllers/schoolSettings.ts";
import { upsertSchoolSettingsBodySchema } from "../validation/schemas.ts";

const schoolSettingsRouter = express.Router();

schoolSettingsRouter.get("/", protect, authorize(["admin", "teacher", "student", "parent"]), getSchoolSettings);
schoolSettingsRouter.post(
	"/",
	protect,
	authorize(["admin"]),
	validate({ body: upsertSchoolSettingsBodySchema }),
	upsertSchoolSettings
);
schoolSettingsRouter.put(
	"/",
	protect,
	authorize(["admin"]),
	validate({ body: upsertSchoolSettingsBodySchema }),
	upsertSchoolSettings
);

export default schoolSettingsRouter;
