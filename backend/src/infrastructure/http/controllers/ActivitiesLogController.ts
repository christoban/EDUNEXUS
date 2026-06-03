import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';

export class ActivitiesLogController {
  constructor(private readonly prisma: PrismaClient) {}

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
