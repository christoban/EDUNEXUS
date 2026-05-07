import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";

// @desc    Create a new Class
// @route   POST /api/classes
// @access  Private/Admin
export const createClass = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create classes" });
    }

    const schoolId = currentUser?.schoolId;
    if (!schoolId) {
      return res.status(403).json({ message: "Aucun établissement associé" });
    }

    const { name, level, capacity } = req.body;

    const existingClass = await prisma.class.findFirst({
      where: {
        schoolId,
        name,
      },
    });

    if (existingClass) {
      return res.status(400).json({
        message: "Class with this name already exists.",
      });
    }

    const newClass = await prisma.class.create({
      data: {
        schoolId,
        name,
        level: level || null,
        capacity: Number(capacity) || 40,
      },
    });
    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Created new class: ${newClass.name}`,
    });
    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get All Classes
// @route   GET /api/classes
// @access  Private
export const getAllClasses = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const schoolId = (req as any).user?.schoolId;

    const where: any = {
      ...(schoolId ? { schoolId } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    const currentUser = (req as any).user;
    if (currentUser?.role === "parent") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: currentUser.userId },
        include: {
          children: {
            include: { studentProfile: true },
          },
        },
      });

      const classIds = Array.from(
        new Set(
          (parentProfile?.children || [])
            .map((child) => child.studentProfile?.classId)
            .filter((classId): classId is string => Boolean(classId))
        )
      );

      if (!classIds.length) {
        return res.json({
          classes: [],
          pagination: { total: 0, page, pages: 0 },
        });
      }

      where.id = { in: classIds };
    }

    const [total, classes] = await Promise.all([
      prisma.class.count({ where }),
      prisma.class.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const studentCounts = await Promise.all(
      classes.map(async (schoolClass) => ({
        classId: schoolClass.id,
        count: await prisma.user.count({
          where: {
            ...(schoolId ? { schoolId } : {}),
            role: "STUDENT",
            studentProfile: { is: { classId: schoolClass.id } },
          },
        }),
      }))
    );

    const studentCountMap = new Map(studentCounts.map((entry) => [entry.classId, entry.count]));

    res.json({
      classes: classes.map((cls) => ({
        ...cls,
        studentCount: studentCountMap.get(cls.id) ?? 0,
      })),
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

// @desc    Update Class
// @route   PUT /api/classes/:id
// @access  Private/Admin
export const updateClass = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update classes" });
    }

    const classId = req.params.id;
    const schoolId = currentUser?.schoolId;
    const { name, level, capacity } = req.body;

    if (name) {
      const existingClass = await prisma.class.findFirst({
        where: {
          ...(schoolId ? { schoolId } : {}),
          name,
          id: { not: classId },
        },
      });

      if (existingClass) {
        return res.status(400).json({
          message: "Class with this name already exists.",
        });
      }
    }

    const updatedClass = await prisma.class.update({
      where: { id: classId },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(level !== undefined ? { level: level || null } : {}),
        ...(capacity !== undefined ? { capacity: Number(capacity) || 40 } : {}),
      },
    });

    if (!updatedClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Updated class: ${updatedClass.name}`,
    });

    return res.status(200).json(updatedClass);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete Class
// @route   DELETE /api/classes/:id
// @access  Private/Admin
export const deleteClass = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can delete classes" });
    }

    const schoolId = currentUser?.schoolId;
    const deletedClass = await prisma.class.delete({ where: { id: req.params.id } });
    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Deleted class: ${deletedClass?.name}`,
    });
    if (!deletedClass) {
      return res.status(404).json({ message: "Class not found" });
    }
    res.json({ message: "Class removed" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};