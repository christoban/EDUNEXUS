import express from "express";
import {
  createCouncilSession,
  addDecision,
  addDecisionsBulk,
  getCouncilSession,
  getCouncilSessions,
  lockCouncilSession,
  generateCouncilReport,
} from "../controllers/classCouncil.ts";
import { protect } from "../middleware/auth.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";

const classCouncilRouter = express.Router();

classCouncilRouter.get("/", protect, getCouncilSessions);
classCouncilRouter.post("/", sensitiveWriteLimiter, protect, createCouncilSession);
classCouncilRouter.get("/:id", protect, getCouncilSession);
classCouncilRouter.post("/:id/decisions", protect, addDecision);
classCouncilRouter.post("/:id/decisions/bulk", protect, addDecisionsBulk);
classCouncilRouter.post("/:id/lock", sensitiveWriteLimiter, protect, lockCouncilSession);
classCouncilRouter.get("/:id/report", protect, generateCouncilReport);

export default classCouncilRouter;