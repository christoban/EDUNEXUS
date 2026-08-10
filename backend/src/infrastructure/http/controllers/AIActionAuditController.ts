/**
 * INFRASTRUCTURE LAYER — Vue "Journal d'établissement" (chantier Sécurité de l'assistant IA).
 *
 * Filtrée STRICTEMENT sur schoolId de l'appelant (jamais un schoolId passé en paramètre) — un
 * admin d'établissement ne doit jamais pouvoir consulter le journal d'un autre établissement,
 * même en falsifiant la requête. La vue transversale (tous établissements) est une surface
 * séparée, réservée à l'opérateur plateforme : voir MasterAdminHexController.listerJournalSecuriteIA.
 */
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';

export class AIActionAuditController {
  constructor(private readonly prisma: PrismaClient) {}

  // GET /api/v2/security/audit-log
  journalEtablissement = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { outcome, origin, actorRole, actionName, page = '1', limit = '50' } = req.query as Record<string, string>;
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const take = parseInt(limit, 10);

      const where: any = { schoolId: user.schoolId };
      if (outcome) where.outcome = outcome;
      if (origin) where.origin = origin;
      if (actorRole) where.actorRole = actorRole;
      if (actionName) where.actionName = actionName;

      const [entries, total] = await Promise.all([
        this.prisma.aIActionAuditLog.findMany({ where, skip, take, orderBy: { timestamp: 'desc' } }),
        this.prisma.aIActionAuditLog.count({ where }),
      ]);

      res.json({
        success: true,
        data: entries,
        pagination: { page: parseInt(page, 10), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      next(error);
    }
  };
}
