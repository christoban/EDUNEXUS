import express from "express";
import {
  triggerExamGeneration,
  getExams,
  submitExam,
  getExamById,
  toggleExamStatus,
  getExamResult,
  deleteExam,
  getExamGeneration,
} from "../controllers/exam.ts";
import { protect, authorize } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import { idParamSchema, submitExamBodySchema, triggerExamGenerationBodySchema } from "../validation/schemas.ts";

const examRouter = express.Router();

// so the issue was only from my end. I had to restart the computer, after
examRouter.post(
  "/generate",
  sensitiveWriteLimiter,
  protect,
  authorize(["teacher", "admin"]),
  validate({ body: triggerExamGenerationBodySchema }),
  triggerExamGeneration
);

examRouter.get(
  "/",
  protect,
  authorize(["teacher", "student", "admin"]),
  getExams
);

// we try on the fronten
// Student Routes
examRouter.post(
  "/:id/submit",
  sensitiveWriteLimiter,
  protect,
  authorize(["student", "admin"]),
  validate({ params: idParamSchema, body: submitExamBodySchema }),
  submitExam
);

// teacher and admin routes
examRouter.patch(
  "/:id/status",
  sensitiveWriteLimiter,
  protect,
  authorize(["teacher", "admin"]),
  validate({ params: idParamSchema }),
  toggleExamStatus
);

examRouter.get(
  "/:id/result",
  protect,
  authorize(["student", "admin"]),
  getExamResult
);

examRouter.get(
  "/generation/:id",
  protect,
  authorize(["teacher", "admin"]),
  validate({ params: idParamSchema }),
  getExamGeneration
);

examRouter.get(
  "/:id",
  protect,
  authorize(["teacher", "student", "admin"]),
  validate({ params: idParamSchema }),
  getExamById
);

examRouter.delete(
  "/:id",
  sensitiveWriteLimiter,
  protect,
  authorize(["teacher", "admin"]),
  validate({ params: idParamSchema }),
  deleteExam
);

export default examRouter;