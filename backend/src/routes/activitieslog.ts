import express from "express";

import { protect, authorize } from "../middleware/auth.ts";
import { getAllActivities } from "../controllers/activitieslog.ts";

const LogsRouter = express.Router();

LogsRouter.get("/", protect, authorize(["admin", "teacher"]), getAllActivities);

export default LogsRouter;