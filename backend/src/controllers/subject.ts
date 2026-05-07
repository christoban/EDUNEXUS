import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";

const toIdStrings = (value: unknown) =>
  Array.isArray(value) ? value.filter(Boolean).map((item) => String(item)) : [];

const syncSubjectTeachers = async (
  subjectId: string,
  previousTeacherIds: string[],
  nextTeacherIds: string[]
) => {
  await prisma.teacherSubject.deleteMany({ where: { subjectId } });

  if (!nextTeacherIds.length) {
    return;
  }

  const teacherProfiles = await prisma.teacherProfile.findMany({
    where: {
      userId: { in: nextTeacherIds },
    },
    select: { id: true, userId: true },
  });

  await prisma.teacherSubject.createMany({
    data: teacherProfiles.map((teacherProfile) => ({
      teacherProfileId: teacherProfile.id,
      subjectId,
    })),
    skipDuplicates: true,
  });
};

// @desc    Create a new Subject
// @route   POST /api/subjects
// @access  Private/Admin
export const createSubject = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create subjects" });
    }

    const schoolId = currentUser?.schoolId;
    if (!schoolId) {
      return res.status(403).json({ message: "Aucun établissement associé" });
    }

    const { name, code, teacher, coefficient } = req.body;
    const subjectExists = await prisma.subject.findFirst({
      where: {
        schoolId,
        ...(code ? { code } : {}),
      },
    });
    if (subjectExists) {
      return res.status(400).json({ message: "Subject code already exists" });
    }
    const newSubject = await prisma.subject.create({
      data: {
        schoolId,
        name,
        code: code || null,
        coefficient: Number(coefficient) || 1,
        hoursPerWeek: Number(req.body?.hoursPerWeek) || 2,
      },
    });

    await syncSubjectTeachers(newSubject.id, [], toIdStrings(teacher));

    if (newSubject) {
      await logActivity({
        userId: currentUser.userId,
        schoolId,
        action: `Created subject: ${newSubject.name}`,
      });
      res.status(201).json(newSubject);
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all Subjects
// @route   GET /api/subjects
// @access  Private
export const getAllSubjects = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;

    const query: any = {};
    if (schoolId) {
      query.schoolId = schoolId;
    }

    if (currentUser?.role === "teacher") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: currentUser.userId },
        include: { teacherSubjects: true },
      });

      const teacherSubjectIds = (teacherProfile?.teacherSubjects || []).map((item) => item.subjectId);
      if (!teacherSubjectIds.length) {
        return res.json({
          subjects: [],
          pagination: {
            total: 0,
            page,
            pages: 0,
          },
        });
      }
      query.id = { in: teacherSubjectIds };
    }

    if (search) {
      query.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, subjects] = await Promise.all([
      prisma.subject.count({ where: query }),
      prisma.subject.findMany({
        where: query,
        include: {
          teacherSubjects: {
            include: {
              teacherProfile: {
                include: {
                  user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const teacherCountRows = await prisma.teacherSubject.groupBy({
      by: ["subjectId"],
      _count: { subjectId: true },
      where: { subjectId: { in: subjects.map((item) => item.id) } },
    });

    const teacherCountMap = new Map(
      teacherCountRows.map((row) => [row.subjectId, row._count.subjectId])
    );

    res.json({
      subjects: subjects.map((item) => ({
        ...item,
        teachers: item.teacherSubjects.map((relation) => relation.teacherProfile.user),
        teacherCount: teacherCountMap.get(item.id) ?? 0,
      })),
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update Subject
// @route   PUT /api/subjects/:id
// @access  Private/Admin
export const updateSubject = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update subjects" });
    }

    const schoolId = currentUser?.schoolId;
    const { name, code, teacher, coefficient } = req.body;

    const existingSubject = await prisma.subject.findFirst({
      where: {
        id: req.params.id,
        ...(schoolId ? { schoolId } : {}),
      },
      include: {
        teacherSubjects: true,
      },
    });
    if (!existingSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const nextTeacherIds = Array.isArray(teacher) ? toIdStrings(teacher) : [];

    const updatedSubject = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code: code || null } : {}),
        ...(coefficient !== undefined ? { coefficient: Number(coefficient) || 1 } : {}),
        ...(req.body.hoursPerWeek !== undefined ? { hoursPerWeek: Number(req.body.hoursPerWeek) || 2 } : {}),
      },
    });

    await syncSubjectTeachers(
      updatedSubject.id,
      existingSubject.teacherSubjects.map((relation) => relation.teacherProfileId),
      nextTeacherIds
    );

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Updated subject: ${updatedSubject?.name}`,
    });

    res.json(updatedSubject);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete Subject
// @route   DELETE /api/subjects/:id
// @access  Private/Admin
export const deleteSubject = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can delete subjects" });
    }

    const schoolId = currentUser?.schoolId;
    const deletedSubject = await prisma.subject.delete({ where: { id: req.params.id } });
    if (!deletedSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    await prisma.teacherSubject.deleteMany({ where: { subjectId: deletedSubject.id } });

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Updated subject: ${deletedSubject?.name}`,
    });
    res.json({ message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};