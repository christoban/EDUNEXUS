import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { DEFAULT_SUBSYSTEMS, ensureDefaultSubSystems } from "../utils/coreDomainDefaults.ts";

export const upsertDefaultSubSystems = async (req: Request, res: Response) => {
  try {
    await ensureDefaultSubSystems();
    await logActivity({
      userId: (req as any).user.userId,
      schoolId: (req as any).user.schoolId,
      action: "Upserted default SubSystems",
    });
    return res.json({ message: "Default SubSystems synchronized", total: DEFAULT_SUBSYSTEMS.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getSubSystems = async (_req: Request, res: Response) => {
  return res.json({ subsystems: [...DEFAULT_SUBSYSTEMS], total: DEFAULT_SUBSYSTEMS.length });
};

export const updateSubSystem = async (_req: Request, res: Response) => {
  return res.status(501).json({ message: "SubSystem management is not supported by the current Prisma schema" });
};

export const createSection = async (_req: Request, res: Response) => {
  return res.status(501).json({ message: "Section management is not supported by the current Prisma schema" });
};

export const getSections = async (_req: Request, res: Response) => {
  return res.status(501).json({ message: "Section management is not supported by the current Prisma schema" });
};

export const updateSection = async (_req: Request, res: Response) => {
  return res.status(501).json({ message: "Section management is not supported by the current Prisma schema" });
};

export const createAcademicPeriod = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as any).user.schoolId as string;
    const academicYearId = String(req.body.academicYearId || "").trim();
    if (!academicYearId) return res.status(400).json({ message: "academicYearId is required" });

    const academicYear = await prisma.academicYear.findFirst({ where: { id: academicYearId, schoolId } });
    if (!academicYear) return res.status(404).json({ message: "Academic year not found" });

    const period = await prisma.academicPeriod.create({
      data: {
        academicYearId,
        name: String(req.body.name || "").trim(),
        type: req.body.type || "TRIMESTER",
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        isCurrent: Boolean(req.body.isCurrent),
      },
    });

    await logActivity({
      userId: (req as any).user.userId,
      schoolId,
      action: `Created academic period ${period.name}`,
    });

    return res.status(201).json(period);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getAcademicPeriods = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as any).user.schoolId as string;
    const query = ((req as any).validatedQuery || req.query) as any;

    const periods = await prisma.academicPeriod.findMany({
      where: {
        ...(query.academicYearId ? { academicYearId: String(query.academicYearId) } : {}),
        ...(query.type ? { type: query.type } : {}),
        academicYear: { schoolId },
      },
      include: { academicYear: true },
      orderBy: { startDate: "asc" },
    });

    return res.json({ periods, total: periods.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const updateAcademicPeriod = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as any).user.schoolId as string;
    const id = String(req.params.id);

    const period = await prisma.academicPeriod.findFirst({
      where: {
        id,
        academicYear: { schoolId },
      },
    });
    if (!period) return res.status(404).json({ message: "Academic period not found" });

    const updatedPeriod = await prisma.academicPeriod.update({
      where: { id: period.id },
      data: {
        ...req.body,
        ...(req.body.startDate ? { startDate: new Date(req.body.startDate) } : {}),
        ...(req.body.endDate ? { endDate: new Date(req.body.endDate) } : {}),
      },
    });

    await logActivity({
      userId: (req as any).user.userId,
      schoolId,
      action: `Updated academic period ${updatedPeriod.name}`,
    });

    return res.json(updatedPeriod);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};