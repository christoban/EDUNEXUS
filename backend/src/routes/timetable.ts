import express from "express";
import {
	generateTimetable,
	getTimetable,
	getTimetableGeneration,
} from "../controllers/timetable.ts";
import { protect, authorize } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import { classIdParamSchema, generateTimetableBodySchema, generationIdParamSchema } from "../validation/schemas.ts";

const timeRouter = express.Router();

// Generate: Admin only (costs money/resources)
timeRouter.post(
	"/generate",
	sensitiveWriteLimiter,
	protect,
	authorize(["admin"]),
	validate({ body: generateTimetableBodySchema }),
	generateTimetable
);

timeRouter.get(
	"/generation/:id",
	protect,
	authorize(["admin"]),
	validate({ params: generationIdParamSchema }),
	getTimetableGeneration
);

// View: Everyone (Students need to see their schedule)
timeRouter.get("/:classId", protect, validate({ params: classIdParamSchema }), getTimetable);

export default timeRouter;