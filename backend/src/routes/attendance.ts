import express from "express";
import {
  getAttendance,
  markAttendance,
  justifyAbsence,
  getAttendanceStats,
} from "../controllers/attendance.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import {
  attendanceQuerySchema,
  markAttendanceBodySchema,
} from "../validation/schemas.ts";

const attendanceRouter = express.Router();

attendanceRouter.get(
  "/stats",
  protect,
  authorize(["admin", "teacher", "staff", "student", "parent",
             "ADMIN", "TEACHER", "STAFF", "STUDENT", "PARENT"]),
  getAttendanceStats
);

attendanceRouter.post(
  "/mark",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "teacher", "ADMIN", "TEACHER"]),
  validate({ body: markAttendanceBodySchema }),
  markAttendance
);

attendanceRouter.get(
  "/",
  protect,
  authorize(["admin", "teacher", "student", "parent", "staff",
             "ADMIN", "TEACHER", "STUDENT", "PARENT", "STAFF"]),
  validate({ query: attendanceQuerySchema }),
  getAttendance
);

attendanceRouter.patch(
  "/:id/justify",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "staff", "ADMIN", "STAFF"]),
  justifyAbsence
);

export default attendanceRouter;