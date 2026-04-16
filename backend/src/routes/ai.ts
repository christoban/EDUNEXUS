import express from "express";
import { generateAIInsight } from "../controllers/ai.ts";
import { protect } from "../middleware/auth.ts";

const router = express.Router();

// All AI routes require authentication
router.post("/generate-insight", protect, generateAIInsight);

export default router;
