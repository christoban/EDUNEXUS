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

const examRouter = express.Router();

// so the issue was only from my end. I had to restart the computer, after
examRouter.post(
  "/generate",
  protect,
  authorize(["teacher", "admin"]),
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
  protect,
  authorize(["student", "admin"]),
  submitExam
);

// teacher and admin routes
examRouter.patch(
  "/:id/status",
  protect,
  authorize(["teacher", "admin"]),
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
  getExamGeneration
);

examRouter.get(
  "/:id",
  protect,
  authorize(["teacher", "student", "admin"]),
  getExamById
);

examRouter.delete(
  "/:id",
  protect,
  authorize(["teacher", "admin"]),
  deleteExam
);

export default examRouter;