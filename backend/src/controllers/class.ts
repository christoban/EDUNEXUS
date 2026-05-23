import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";

// @desc    Create a new Class
// @route   POST /api/classes
// @access  Private/Admin
export const createClass = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
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
            studentProfile: { classId: schoolClass.id },
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
    const classId = String(req.params.id);
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
    const schoolId = currentUser?.schoolId;

    const classId = String(req.params.id);

    const deletedClass = await prisma.$transaction(async (tx) => {
      await tx.attendance.deleteMany({
        where: {
          schoolId,
          classId,
        },
      });

      await tx.grade.deleteMany({
        where: {
          schoolId,
          classId,
        },
      });

      const exams = await tx.exam.findMany({
        where: {
          schoolId,
          classId,
        },
        select: { id: true },
      });

      if (exams.length > 0) {
        await tx.submission.deleteMany({
          where: {
            examId: { in: exams.map((exam) => exam.id) },
          },
        });

        await tx.exam.deleteMany({
          where: {
            id: { in: exams.map((exam) => exam.id) },
          },
        });
      }

      await tx.classCouncilSession.deleteMany({
        where: {
          schoolId,
          classId,
        },
      });

      await tx.timetable.deleteMany({
        where: {
          schoolId,
          classId,
        },
      });

      await tx.classPromotion.deleteMany({
        where: {
          schoolId,
          OR: [{ fromClassId: classId }, { toClassId: classId }],
        },
      });

      await tx.studentPromotion.deleteMany({
        where: {
          schoolId,
          OR: [{ fromClassId: classId }, { toClassId: classId }],
        },
      });

      await tx.studentProfile.updateMany({
        where: {
          classId,
          user: { schoolId },
        },
        data: { classId: null },
      });

      return tx.class.delete({ where: { id: classId } });
    });

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

// @desc    Set Professor Principal for a Class
// @route   PATCH /api/classes/:id/professor-principal
// @access  Private/Admin
export const setProfessorPrincipal = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can set professor principal" });
    }

    const schoolId = currentUser?.schoolId;
    const classId = String(req.params.id);
    const { teacherId } = req.body;

    if (!teacherId) return res.status(400).json({ message: "teacherId est requis" });

    const [existingClass, teacher] = await Promise.all([
      prisma.class.findFirst({ where: { id: classId, schoolId } }),
      prisma.user.findFirst({
        where: { id: teacherId, schoolId, role: "TEACHER" },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);

    if (!existingClass) return res.status(404).json({ message: "Classe introuvable" });
    if (!teacher) return res.status(404).json({ message: "Enseignant introuvable" });

    await prisma.class.update({
      where: { id: classId },
      data: { professorPrincipalId: teacherId },
    });

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Professeur principal de ${existingClass.name}: ${teacher.firstName} ${teacher.lastName}`,
    });

    return res.status(200).json({ classId, teacher });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all students in a class
// @route   GET /api/classes/:id/students
// @access  Private
export const getClassStudents = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;
    const classId = String(req.params.id);

    const existingClass = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!existingClass) return res.status(404).json({ message: "Classe introuvable" });

    const students = await prisma.user.findMany({
      where: { schoolId, role: "STUDENT", studentProfile: { classId } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        isActive: true,
        studentProfile: {
          select: {
            id: true,
            matricule: true,
            dateOfBirth: true,
            gender: true,
            studentStatus: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });

    return res.json({ classId, total: students.length, students });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get sub-groups of a class
// @route   GET /api/classes/:id/subgroups
// @access  Private
export const getSubGroups = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;
    const classId = String(req.params.id);

    const existingClass = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!existingClass) return res.status(404).json({ message: "Classe introuvable" });

    const subGroups = await prisma.classSubGroup.findMany({
      where: { classId },
      include: {
        studentAssignments: {
          include: {
            studentProfile: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    return res.json({ classId, subGroups });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Create a sub-group in a class
// @route   POST /api/classes/:id/subgroups
// @access  Private/Admin
export const createSubGroup = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can create sub-groups" });
    }

    const schoolId = currentUser?.schoolId;
    const classId = String(req.params.id);
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "Le nom du sous-groupe est requis" });

    const existingClass = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!existingClass) return res.status(404).json({ message: "Classe introuvable" });

    const subGroup = await prisma.classSubGroup.create({ data: { classId, name } });

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Sous-groupe créé: ${name} dans ${existingClass.name}`,
    });

    return res.status(201).json(subGroup);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Un sous-groupe avec ce nom existe déjà dans cette classe" });
    }
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Assign students to a sub-group
// @route   POST /api/classes/subgroups/:subGroupId/students
// @access  Private/Admin
export const assignStudentsToSubGroup = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can assign students to sub-groups" });
    }

    const schoolId = currentUser?.schoolId;
    const subGroupId = String(req.params.subGroupId);
    const { studentProfileIds } = req.body;

    if (!Array.isArray(studentProfileIds) || !studentProfileIds.length) {
      return res.status(400).json({ message: "studentProfileIds (tableau) est requis" });
    }

    const subGroup = await prisma.classSubGroup.findUnique({
      where: { id: subGroupId },
      include: { class: { select: { schoolId: true, name: true } } },
    });

    if (!subGroup || subGroup.class.schoolId !== schoolId) {
      return res.status(404).json({ message: "Sous-groupe introuvable" });
    }

    await prisma.studentSubGroupAssignment.createMany({
      data: (studentProfileIds as string[]).map((studentProfileId) => ({
        studentProfileId,
        subGroupId,
      })),
      skipDuplicates: true,
    });

    return res.json({ message: "Élèves assignés au sous-groupe", subGroupId, count: studentProfileIds.length });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};