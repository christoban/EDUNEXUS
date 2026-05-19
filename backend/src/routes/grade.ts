import express from "express";
import {
  createGrade,
  updateGrade,
  submitGrade,
  validateGrade,
  rejectGrade,
  bulkValidateGrades,
  getGrades,
  getPendingGrades,
  getGradeStatusByClass,
  getStudentAverage,
} from "../controllers/grade.ts";
import { protect, requireRole } from "../middleware/auth.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";

const gradeRouter = express.Router();

// Routes de lecture
gradeRouter.get("/", protect, getGrades);
gradeRouter.get("/pending", protect, getPendingGrades);
gradeRouter.get("/status/:classId", protect, getGradeStatusByClass);
gradeRouter.get("/average/:studentId", protect, getStudentAverage);

// Saisie et modification (enseignant + admin)
gradeRouter.post("/", sensitiveWriteLimiter, protect, createGrade);
gradeRouter.put("/:id", sensitiveWriteLimiter, protect, updateGrade);

// Workflow de validation
gradeRouter.post("/:id/submit", protect, submitGrade);
gradeRouter.post("/:id/validate", sensitiveWriteLimiter, protect, validateGrade);
gradeRouter.post("/:id/reject", sensitiveWriteLimiter, protect, rejectGrade);
gradeRouter.post("/bulk-validate", sensitiveWriteLimiter, protect, bulkValidateGrades);

export default gradeRouter;
