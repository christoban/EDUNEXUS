import express from "express";
import {
	generateTimetable,
	getTimetable,
	getTimetableGeneration,
} from "../controllers/timetable.ts";
import { protect, authorize } from "../middleware/auth.ts";

const timeRouter = express.Router();

// Generate: Admin only (costs money/resources)
timeRouter.post("/generate", protect, authorize(["admin"]), generateTimetable);

timeRouter.get("/generation/:id", protect, authorize(["admin"]), getTimetableGeneration);

// View: Everyone (Students need to see their schedule)
timeRouter.get("/:classId", protect, getTimetable);

export default timeRouter;