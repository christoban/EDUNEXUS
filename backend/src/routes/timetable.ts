import express from "express";
import {
  generateTimetable,
  getTimetable,
  getTimetableGeneration,
  createManualTimetable,
  addSlot,
  updateSlot,
  deleteSlot,
  publishTimetable,
  getTimetableFull,
  createCatchupRequest,
} from "../controllers/timetable.ts";
import { protect, authorize } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import { classIdParamSchema, generateTimetableBodySchema, generationIdParamSchema } from "../validation/schemas.ts";

const timeRouter = express.Router();

// ─── ROUTES EXISTANTES (IA) ───────────────────────────────────
timeRouter.post(
  "/generate",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "ADMIN"]),
  generateTimetable
);

timeRouter.get(
  "/generation/:id",
  protect,
  authorize(["admin", "ADMIN"]),
  validate({ params: generationIdParamSchema }),
  getTimetableGeneration
);

// ─── NOUVELLES ROUTES (mode manuel) ──────────────────────────

// Créer un EDT manuel (avant /:classId pour éviter les conflits)
timeRouter.post(
  "/manual",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "ADMIN", "staff", "STAFF"]),
  createManualTimetable
);

// Demande de rattrapage
timeRouter.post(
  "/catchup-requests",
  protect,
  authorize(["admin", "ADMIN", "teacher", "TEACHER"]),
  createCatchupRequest
);

// EDT complet avec créneaux
timeRouter.get("/:classId/full", protect, getTimetableFull);

// Créneaux
timeRouter.post(
  "/:id/slots",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "ADMIN", "staff", "STAFF"]),
  addSlot
);

timeRouter.put(
  "/:id/slots/:slotId",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "ADMIN", "staff", "STAFF"]),
  updateSlot
);

timeRouter.delete(
  "/:id/slots/:slotId",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "ADMIN", "staff", "STAFF"]),
  deleteSlot
);

// Publier un EDT
timeRouter.put(
  "/:id/publish",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "ADMIN", "staff", "STAFF"]),
  publishTimetable
);

// Vue EDT existante (lecture)
timeRouter.get("/:classId", protect, validate({ params: classIdParamSchema }), getTimetable);

export default timeRouter;