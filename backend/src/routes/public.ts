import express, { Request, Response } from "express";
import { sendContactRequestEmail } from "../services/emailService.ts";

const router = express.Router();

router.post("/contact-request", async (req: Request, res: Response) => {
  const { school, email, phone, message } = req.body;

  if (!school?.trim() || !email?.trim()) {
    return res.status(400).json({ message: "Le nom de l'établissement et l'email sont requis." });
  }

  const adminEmail = "christoban2005@gmail.com";

  try {
    await sendContactRequestEmail({
      to: adminEmail,
      schoolName: school,
      responsibleEmail: email,
      phone: phone || "Non fourni",
      message: message || "Aucun message",
    });
  } catch (emailError) {
    console.error("[CONTACT] Email error (non-bloquant):", emailError);
  }

  return res.json({ message: "Demande envoyée avec succès! L'administrateur vous contactera bientôt." });
});

export default router;