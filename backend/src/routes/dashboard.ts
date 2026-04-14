import express from "express";
import { getDashboardStats } from "../controllers/dashboard.ts";
// import { generateDashboardInsight } from "../controllers/aiController";
import { protect } from "../middleware/auth.ts";

const dashboardRouter = express.Router();

// Get Stats (Role is determined by token)
dashboardRouter.get("/stats", protect, getDashboardStats);

// Get AI Insight
// router.post("/insight", protect, generateDashboardInsight);

export default dashboardRouter;