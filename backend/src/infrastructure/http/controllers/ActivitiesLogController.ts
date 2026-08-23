import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';

export class ActivitiesLogController {
  constructor(private readonly prisma: PrismaClient) {}

  getTimeline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const limit = Math.min(Number(req.query.limit) || 20, 50);
      const schoolId = user.schoolId;
      const whereActivity = schoolId ? { schoolId } : {};
      const whereAI = schoolId ? { schoolId } : {};
      const whereEmail = schoolId ? { schoolId } : {};
      const [activities, aiActions, emails] = await Promise.all([
        this.prisma.activitiesLog.findMany({ where: whereActivity, orderBy: { createdAt: 'desc' }, take: limit }),
        this.prisma.aIActionAuditLog.findMany({ where: whereAI, orderBy: { timestamp: 'desc' }, take: limit }),
        this.prisma.emailLog.findMany({ where: whereEmail, orderBy: { createdAt: 'desc' }, take: limit }),
      ]);
      const timeline = [
        ...activities.map(a => ({ id: a.id, type: 'ACTIVITY' as const, timestamp: a.createdAt, title: a.action, details: a.description, raw: a })),
        ...aiActions.map(a => ({ id: a.id, type: 'AI_ACTION' as const, timestamp: a.timestamp, title: a.actionName, details: a.refusalReason ?? a.outcome, raw: a })),
        ...emails.map(e => ({ id: e.id, type: 'EMAIL' as const, timestamp: e.createdAt, title: e.subject, details: `${e.to} — ${e.status}`, raw: e })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
      res.json({ timeline, total: timeline.length });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = String(req.query.search || '').trim();
      const skip = (page - 1) * limit;

      const where: any = {
        ...(user.schoolId ? { schoolId: user.schoolId } : {}),
        ...(user.role === 'TEACHER' ? { userId: user.userId } : {}),
        ...(search ? {
          OR: [
            { action: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      };

      const [count, logs] = await Promise.all([
        this.prisma.activitiesLog.count({ where }),
        this.prisma.activitiesLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
      ]);

      res.json({ logs, page, pages: Math.ceil(count / limit), total: count });
    } catch (error) {
      next(error);
    }
  };
}
