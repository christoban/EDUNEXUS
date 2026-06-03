import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';

export class EmailLogController {
  constructor(private readonly prisma: PrismaClient) {}

  getLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 15;
      const search = String(req.query.search || '').trim();
      const status = String(req.query.status || '').trim();
      const schoolId = req.user!.schoolId;

      const where: any = { ...(schoolId ? { schoolId } : {}) };
      if (status) where.status = status;
      if (search) where.OR = [
        { to: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];

      const [total, logs] = await Promise.all([
        this.prisma.emailLog.count({ where }),
        this.prisma.emailLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      ]);

      res.json({ logs, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
    } catch (error) {
      next(error);
    }
  };
}
