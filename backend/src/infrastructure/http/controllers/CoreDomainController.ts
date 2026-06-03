import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { PeriodType } from '@prisma/client';
import { DEFAULT_SUBSYSTEMS, ensureDefaultSubSystems } from '../../../utils/coreDomainDefaults';
import { logActivity } from '../../../utils/activitieslog';

export class CoreDomainController {
  constructor(private readonly prisma: PrismaClient) {}

  getSubSystems = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ subsystems: [...DEFAULT_SUBSYSTEMS], total: DEFAULT_SUBSYSTEMS.length });
    } catch (error) {
      next(error);
    }
  };

  upsertDefaults = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await ensureDefaultSubSystems();
      await logActivity({ userId: req.user!.userId, schoolId: req.user!.schoolId, action: 'Upserted default SubSystems' });
      res.json({ message: 'Sous-systèmes synchronisés', total: DEFAULT_SUBSYSTEMS.length });
    } catch (error) {
      next(error);
    }
  };

  createPeriod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { academicYearId, name, type, startDate, endDate, isCurrent } = req.body;

      if (!academicYearId) { res.status(400).json({ message: 'academicYearId requis' }); return; }

      const year = await this.prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } });
      if (!year) { res.status(404).json({ message: 'Année académique introuvable' }); return; }

      const period = await this.prisma.academicPeriod.create({
        data: {
          academicYearId,
          name: String(name || '').trim(),
          type: (type as PeriodType) || PeriodType.TRIMESTER,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          isCurrent: Boolean(isCurrent),
        } as any,
      });

      await logActivity({ userId: req.user!.userId, schoolId, action: `Période créée : ${period.name}` });
      res.status(201).json(period);
    } catch (error) {
      next(error);
    }
  };

  getPeriods = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { academicYearId, type } = req.query as { academicYearId?: string; type?: string };

      const periods = await this.prisma.academicPeriod.findMany({
        where: {
          ...(academicYearId ? { academicYearId } : {}),
          ...(type ? { type: type as PeriodType } : {}),
          academicYear: { schoolId },
        },
        include: { academicYear: true },
        orderBy: { startDate: 'asc' },
      });

      res.json({ periods, total: periods.length });
    } catch (error) {
      next(error);
    }
  };

  updatePeriod = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const period = await this.prisma.academicPeriod.findFirst({ where: { id: req.params.id as string, academicYear: { schoolId } } });
      if (!period) { res.status(404).json({ message: 'Période introuvable' }); return; }

      const updated = await this.prisma.academicPeriod.update({
        where: { id: period.id },
        data: { ...req.body, ...(req.body.startDate ? { startDate: new Date(req.body.startDate) } : {}), ...(req.body.endDate ? { endDate: new Date(req.body.endDate) } : {}) },
      });

      await logActivity({ userId: req.user!.userId, schoolId, action: `Période mise à jour : ${updated.name}` });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  };
}
