import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { processSMSAttendance } from '../../../services/smsService';

export class SMSController {
  constructor(private readonly prisma: PrismaClient) {}

  incoming = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { from, text } = req.query as { from?: string; text?: string };
      if (!from || !text) { res.status(400).json({ message: 'Paramètres manquants' }); return; }

      const school = await this.prisma.school.findFirst({ where: { status: 'ACTIVE' }, select: { id: true } });
      if (!school) { res.status(404).json({ message: 'École introuvable' }); return; }

      const result = await processSMSAttendance(text, from, school.id, this.prisma);
      console.log(`SMS from ${from}: ${text} → ${result.message}`);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
