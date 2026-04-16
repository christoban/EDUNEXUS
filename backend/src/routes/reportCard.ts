import express from "express";
import { protect, authorize } from "../middleware/auth.ts";
import { validate } from "../middleware/validate.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import {
  generateReportCardsBodySchema,
  reportCardsQuerySchema,
} from "../validation/schemas.ts";
import {
  triggerReportCardGeneration,
  getMyReportCards,
  getReportCards,
  downloadReportCardPdf,
} from "../controllers/reportCard.ts";

const reportCardRouter = express.Router();

reportCardRouter.post(
  "/generate",
  sensitiveWriteLimiter,
  protect,
  authorize(["admin", "teacher"]),
  validate({ body: generateReportCardsBodySchema }),
  triggerReportCardGeneration
);

reportCardRouter.get(
  "/my",
  protect,
  authorize(["student"]),
  validate({ query: reportCardsQuerySchema }),
  getMyReportCards
);

reportCardRouter.get(
  "/",
  protect,
  authorize(["admin", "teacher"]),
  validate({ query: reportCardsQuerySchema }),
  getReportCards
);

reportCardRouter.get(
  "/:id/pdf",
  protect,
  authorize(["admin", "teacher", "student", "parent"]),
  downloadReportCardPdf
);

export default reportCardRouter;
