import express from "express";
import { prisma } from "../config/prisma.ts";
import { processSMSAttendance } from "../services/smsService.ts";

const smsRouter = express.Router();

smsRouter.get("/incoming", async (req, res) => {
  try {
    const { from, text } = req.query as { from?: string; text?: string; to?: string };

    if (!from || !text) {
      return res.status(400).json({ message: "Paramètres manquants" });
    }

    const school = await prisma.school.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    if (!school) {
      return res.status(404).json({ message: "École introuvable" });
    }

    const result = await processSMSAttendance(text, from, school.id, prisma);
    console.log(`SMS from ${from}: ${text} → ${result.message}`);

    return res.json(result);
  } catch (error) {
    console.error("SMS webhook error:", error);
    return res.status(500).json({ message: "Erreur traitement SMS" });
  }
});

export default smsRouter;