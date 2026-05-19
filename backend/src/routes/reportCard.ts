import express from "express";
import { protect, requireRole } from "../middleware/auth.ts";
import { sensitiveWriteLimiter } from "../middleware/rateLimit.ts";
import {
  checkReportCardReadiness,
  generateReportCardsForClass,
  downloadReportCardPdf,
  exportReportCardsZip,
  sendReportCardsToParents,
  getReportCards,
  getMyReportCards,
  triggerReportCardGeneration,
} from "../controllers/reportCard.ts";

const reportCardRouter = express.Router();

// Vérification pré-génération
reportCardRouter.get("/check/:classId", protect, checkReportCardReadiness);

// Génération synchrone par classe
reportCardRouter.post("/generate/:classId", sensitiveWriteLimiter, protect, generateReportCardsForClass);

// Export ZIP masse
reportCardRouter.post("/export/:classId", sensitiveWriteLimiter, protect, exportReportCardsZip);

// Envoi emails parents
reportCardRouter.post("/send/:classId", sensitiveWriteLimiter, protect, sendReportCardsToParents);

// Trigger Inngest (async)
reportCardRouter.post("/generate", sensitiveWriteLimiter, protect, triggerReportCardGeneration);

// Historique bulletins
reportCardRouter.get("/my", protect, getMyReportCards);
reportCardRouter.get("/", protect, getReportCards);

// Téléchargement PDF individuel
reportCardRouter.get("/:id/pdf", protect, downloadReportCardPdf);

export default reportCardRouter;
