import express from "express";
import { protect } from "../middleware/auth.ts";
import {
  generateAIInsight,
  getStudentsHealthDashboard,
  generateBulletinComment,
  aiChat,
  detectStudentRisk,
} from "../controllers/ai.ts";

const router = express.Router();

router.use(protect);

router.post("/generate-insight", generateAIInsight);
router.get("/students-health", getStudentsHealthDashboard);
router.post("/bulletin-comment", generateBulletinComment);
router.post("/chat", aiChat);
router.get("/risk-detection/:studentId", detectStudentRisk);

export default router;
