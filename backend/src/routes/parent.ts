import express from "express";
import { protect, authorize } from "../middleware/auth.ts";
import {
  getMyChildren,
  getChildExams,
  getChildReportCard,
  getChildAttendance,
  getChildTimetable,
} from "../controllers/parent.ts";
import { validate } from "../middleware/validate.ts";
import { idParamSchema } from "../validation/schemas.ts";

const parentRouter = express.Router();

// All parent routes require auth and parent role
parentRouter.use(protect, authorize(["parent"]));

/**
 * GET /api/parent/children
 * Get all children of the current parent
 */
parentRouter.get("/children", getMyChildren);

/**
 * GET /api/parent/children/:studentId/exams
 * Get exams for a specific child
 */
parentRouter.get(
  "/children/:studentId/exams",
  validate({ params: idParamSchema }),
  getChildExams
);

/**
 * GET /api/parent/children/:studentId/report-card
 * Get report card(s) for a specific child
 */
parentRouter.get(
  "/children/:studentId/report-card",
  validate({ params: idParamSchema }),
  getChildReportCard
);

/**
 * GET /api/parent/children/:studentId/attendance
 * Get attendance records for a specific child
 * Query params: ?year=2026&month=4
 */
parentRouter.get(
  "/children/:studentId/attendance",
  validate({ params: idParamSchema }),
  getChildAttendance
);

/**
 * GET /api/parent/children/:studentId/timetable
 * Get timetable for a specific child's class
 */
parentRouter.get(
  "/children/:studentId/timetable",
  validate({ params: idParamSchema }),
  getChildTimetable
);

export default parentRouter;
