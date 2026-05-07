import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";

// @desc    Create a new Academic Year
// @route   POST /api/academic-years
// @access  Private/Admin
export const createAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, fromYear, toYear, isCurrent } = req.body;
    const schoolId = (req as any).user?.schoolId;

    if (!schoolId) {
      res.status(403).json({ message: "Aucun établissement associé" });
      return;
    }

    const existingYear = await prisma.academicYear.findFirst({
      where: { schoolId, name },
    });
    if (existingYear) {
      res.status(400).json({ message: "Academic Year already exists" });
      return;
    }
    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: { schoolId },
        data: { isCurrent: false },
      });
    }
    const academicYear = await prisma.academicYear.create({
      data: {
        schoolId,
        name,
        startDate: new Date(fromYear),
        endDate: new Date(toYear),
        isCurrent: Boolean(isCurrent),
      },
    });
    await logActivity({
      userId: (req as any).user.userId,
      schoolId,
      action: `Created academic year ${name}`,
    });
    res.status(201).json(academicYear);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all Academic Years (Paginated & Searchable)
// @route   GET /api/academic-years
// @access  Private/Admin
export const getAllAcademicYears = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const schoolId = (req as any).user?.schoolId;

    const where: any = {
      ...(schoolId ? { schoolId } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [total, years] = await Promise.all([
      prisma.academicYear.count({ where }),
      prisma.academicYear.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      years,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get the current active Academic Year
// @route   GET /api/academic-years/current
// @access  Public or Protected
export const getCurrentAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const schoolId = (req as any).user?.schoolId;
    const currentYear = await prisma.academicYear.findFirst({
      where: {
        ...(schoolId ? { schoolId } : {}),
        isCurrent: true,
      },
    });
    if (!currentYear) {
      res.status(404).json({ message: "No current academic year found" });
      return;
    } else {
      res.status(200).json(currentYear);
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update Academic Year
// @route   PUT /api/academic-years/:id
// @access  Private/Admin
export const updateAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { isCurrent } = req.body;
    const schoolId = (req as any).user?.schoolId;
    const academicYearId = String(req.params.id);
    if (isCurrent) {
      await prisma.academicYear.updateMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          id: { not: academicYearId },
        },
        data: { isCurrent: false },
      });
    }
    const updatedYear = await prisma.academicYear.update({
      where: { id: academicYearId },
      data: {
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.fromYear !== undefined ? { startDate: new Date(req.body.fromYear) } : {}),
        ...(req.body.toYear !== undefined ? { endDate: new Date(req.body.toYear) } : {}),
        ...(isCurrent !== undefined ? { isCurrent: Boolean(isCurrent) } : {}),
      },
    });
    if (!updatedYear) {
      res.status(404).json({ message: "Academic Year not found" });
      return;
    }
    await logActivity({
      userId: (req as any).user.userId,
      schoolId,
      action: `Created academic year ${updatedYear?.name}`,
    });
    res.status(200).json(updatedYear);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete Academic Year
// @route   DELETE /api/academic-years/:id
// @access  Private/Admin
export const deleteAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const schoolId = (req as any).user?.schoolId;
    const academicYearId = String(req.params.id);
    const year = await prisma.academicYear.findFirst({
      where: {
        id: academicYearId,
        ...(schoolId ? { schoolId } : {}),
      },
    });
    if (!year) {
      res.status(404).json({ message: "Academic Year not found" });
      return;
    }
    if (year) {
      // Prevent deletion if it's the current academic year to avoid system breakage
      if (year.isCurrent) {
        res
          .status(400)
          .json({ message: "Cannot delete the current academic year" });
        return;
      }
    }
    await prisma.academicYear.delete({ where: { id: year.id } });

    await logActivity({
      userId: (req as any).user.userId,
      schoolId,
      action: `Deleted academic year ${year.name}`,
    });
    res.status(200).json({ message: "Academic Year deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};