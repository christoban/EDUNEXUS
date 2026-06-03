import type { Request, Response, NextFunction } from 'express';
import { sendContactRequestEmail } from '../../../services/emailService';

export class PublicController {
  contactRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { school, email, phone, message } = req.body;
      if (!school?.trim() || !email?.trim()) {
        res.status(400).json({ message: "Le nom de l'établissement et l'email sont requis." });
        return;
      }

      try {
        await sendContactRequestEmail({
          to: 'christoban2005@gmail.com',
          schoolName: school,
          responsibleEmail: email,
          phone: phone || 'Non fourni',
          message: message || 'Aucun message',
        });
      } catch (emailError) {
        console.error('[CONTACT] Email error (non-bloquant):', emailError);
      }

      res.json({ message: "Demande envoyée avec succès ! L'administrateur vous contactera bientôt." });
    } catch (error) {
      next(error);
    }
  };
}
