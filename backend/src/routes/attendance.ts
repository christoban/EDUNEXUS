import express from "express";
import { getAttendance, markAttendance } from "../controllers/attendance.ts";
import { authorize, protect } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import {
  attendanceQuerySchema,
  markAttendanceBodySchema,
} from "../validation/schemas.ts";

const attendanceRouter = express.Router();

attendanceRouter.post(
  "/mark",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "teacher"]),
  validate({ body: markAttendanceBodySchema }),
  markAttendance
);

attendanceRouter.get(
  "/",
  protect,
  authorize(["admin", "teacher", "student", "parent"]),
  validate({ query: attendanceQuerySchema }),
  getAttendance
);

export default attendanceRouter;
