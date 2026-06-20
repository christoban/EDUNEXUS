import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getPermissionsPourTitre } from '@domain/rules/StaffPermissionRules';

export class DepartmentController {
  constructor(private readonly prisma: PrismaClient) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const departments = await this.prisma.department.findMany({
        where: { schoolId: user.schoolId },
        include: {
          head: { select: { id: true, firstName: true, lastName: true } },
          subjects: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
        },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: departments });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { name, color } = req.body as { name?: string; color?: string };
      if (!name?.trim()) {
        res.status(400).json({ success: false, message: 'Le nom du département est requis' });
        return;
      }

      const existing = await this.prisma.department.findUnique({
        where: { schoolId_name: { schoolId: user.schoolId, name: name.trim() } },
      });
      if (existing) {
        res.status(409).json({ success: false, message: `Le département '${name}' existe déjà` });
        return;
      }

      const department = await this.prisma.department.create({
        data: { schoolId: user.schoolId, name: name.trim(), color: color ?? '#6b7280' },
      });
      res.status(201).json({ success: true, data: department });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const departmentId = req.params.id as string;
      const { name, color, headId, subjectIds } = req.body as {
        name?: string; color?: string; headId?: string | null; subjectIds?: string[];
      };

      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, schoolId: user.schoolId },
        select: { id: true, headId: true },
      });
      if (!department) {
        res.status(404).json({ success: false, message: 'Département introuvable' });
        return;
      }

      const data: any = {};
      if (name?.trim()) data.name = name.trim();
      if (color) data.color = color;

      if (headId !== undefined) {
        const newHeadId = headId || null;

        if (newHeadId !== department.headId) {
          // Retirer les permissions AP de l'ancien head
          if (department.headId) {
            const oldStaffProfile = await this.prisma.staffProfile.findUnique({
              where: { userId: department.headId },
              select: { id: true },
            });
            if (oldStaffProfile) {
              await this.prisma.staffPermission.deleteMany({
                where: {
                  staffProfileId: oldStaffProfile.id,
                  permission: 'SUPERVISE_DEPARTMENT_TEACHERS',
                },
              });
            }
          }

          // Ajouter les permissions AP au nouveau head
          if (newHeadId) {
            const apPermissions = getPermissionsPourTitre('Animateur Pédagogique');
            let staffProfile = await this.prisma.staffProfile.findUnique({
              where: { userId: newHeadId },
              select: { id: true },
            });
            if (!staffProfile) {
              staffProfile = await this.prisma.staffProfile.create({
                data: { schoolId: user.schoolId, userId: newHeadId, title: 'Animateur Pédagogique' },
              });
            }
            await this.prisma.staffPermission.createMany({
              data: apPermissions.map(p => ({ staffProfileId: staffProfile.id, permission: p })),
              skipDuplicates: true,
            });
          }
        }

        data.headId = newHeadId;
      }

      if (Array.isArray(subjectIds)) {
        // Retirer tous les sujets du département
        await this.prisma.subject.updateMany({
          where: { departmentId },
          data: { departmentId: null },
        });
        // Rattacher les nouveaux sujets
        if (subjectIds.length > 0) {
          await this.prisma.subject.updateMany({
            where: { id: { in: subjectIds }, schoolId: user.schoolId },
            data: { departmentId },
          });
        }
      }

      const updated = await this.prisma.department.update({
        where: { id: departmentId },
        data,
        include: {
          head: { select: { id: true, firstName: true, lastName: true } },
          subjects: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
        },
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const departmentId = req.params.id as string;

      const department = await this.prisma.department.findFirst({
        where: { id: departmentId, schoolId: user.schoolId },
        include: { subjects: { select: { id: true }, take: 1 } },
      });
      if (!department) {
        res.status(404).json({ success: false, message: 'Département introuvable' });
        return;
      }
      if (department.subjects.length > 0) {
        res.status(400).json({ success: false, message: 'Supprimez d\'abord les matières de ce département' });
        return;
      }

      await this.prisma.department.delete({ where: { id: departmentId } });
      res.json({ success: true, message: 'Département supprimé' });
    } catch (error) {
      this.gererErreur(error, res, next);
    }
  };

  private gererErreur(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof Error) {
      if (error.message.includes('existe déjà')) {
        res.status(409).json({ success: false, message: error.message });
        return;
      }
    }
    next(error);
  }
}
