import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { sendContactRequestEmail } from '../../../services/emailService';

export class PublicController {
  constructor(private readonly prisma: PrismaClient) {}

  // GET /api/v2/public/schools — liste publique des écoles ACTIVE + SUSPENDED
  listSchools = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schools = await this.prisma.school.findMany({
        where: { status: { in: ['ACTIVE', 'SUSPENDED'] } },
        select: { id: true, name: true, subdomain: true, status: true, city: true, region: true, logoUrl: true },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: schools });
    } catch (error) {
      next(error);
    }
  };

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
