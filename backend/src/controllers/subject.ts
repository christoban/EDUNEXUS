import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { Prisma, type SubjectType } from "@prisma/client";
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
    const currentRole = String(currentUser?.role || "").toLowerCase();
    if (currentRole !== "admin") {
      return res.status(403).json({ message: "Only admins can create subjects" });
    }

    const schoolId = currentUser?.schoolId;
    if (!schoolId) {
      return res.status(403).json({ message: "Aucun établissement associé" });
    }

    const { name, code, teacher, coefficient } = req.body;
    const subjectType = String(req.body?.subjectType || "THEORETICAL").toUpperCase() as SubjectType;
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
        subjectType,
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
        { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { code: { contains: search, mode: Prisma.QueryMode.insensitive } },
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
    const currentRole = String(currentUser?.role || "").toLowerCase();
    if (currentRole !== "admin") {
      return res.status(403).json({ message: "Only admins can update subjects" });
    }

    const schoolId = currentUser?.schoolId;
    const { name, code, teacher, coefficient } = req.body;
    const subjectType = req.body?.subjectType ? String(req.body.subjectType).toUpperCase() as SubjectType : undefined;

    const existingSubject = await prisma.subject.findFirst({
      where: {
        id: String(req.params.id),
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
      where: { id: String(req.params.id) },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(code !== undefined ? { code: code || null } : {}),
        ...(coefficient !== undefined ? { coefficient: Number(coefficient) || 1 } : {}),
        ...(req.body.hoursPerWeek !== undefined ? { hoursPerWeek: Number(req.body.hoursPerWeek) || 2 } : {}),
        ...(subjectType ? { subjectType } : {}),
      },
    });

    await syncSubjectTeachers(
      updatedSubject.id,
      (existingSubject.teacherSubjects || []).map((relation: any) => relation.teacherProfileId),
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
    const currentRole = String(currentUser?.role || "").toLowerCase();
    if (currentRole !== "admin") {
      return res.status(403).json({ message: "Only admins can delete subjects" });
    }

    const schoolId = currentUser?.schoolId;
    const existing = await prisma.subject.findFirst({ where: { id: String(req.params.id), schoolId } });
    if (!existing) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const deletedSubject = await prisma.subject.delete({ where: { id: existing.id } });

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

// @desc    Get subject coefficients by class level / serie
// @route   GET /api/subjects/:id/coefficients
// @access  Private
export const getSubjectCoefficients = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;
    const subjectId = String(req.params.id);

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
    if (!subject) return res.status(404).json({ message: "Matière introuvable" });

    const coefficients = await prisma.subjectCoefficient.findMany({
      where: { schoolId, subjectId },
      orderBy: [{ classLevel: "asc" }, { serieCode: "asc" }],
    });

    return res.json({ subjectId, coefficients });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Upsert subject coefficients (batch)
// @route   POST /api/subjects/:id/coefficients
// @access  Private/Admin
export const upsertSubjectCoefficients = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can set coefficients" });
    }

    const schoolId = currentUser?.schoolId;
    const subjectId = String(req.params.id);

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId } });
    if (!subject) return res.status(404).json({ message: "Matière introuvable" });

    const entries: Array<{ classLevel: string; serieCode?: string | null; coefficient: number }> =
      req.body.coefficients;

    if (!Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ message: "Un tableau de coefficients est requis" });
    }

    const results = await Promise.all(
      entries.map(async (entry) => {
        const existing = await prisma.subjectCoefficient.findFirst({
          where: {
            schoolId,
            subjectId,
            classLevel: entry.classLevel,
            serieCode: entry.serieCode ?? null,
          },
        });

        if (existing) {
          return prisma.subjectCoefficient.update({
            where: { id: existing.id },
            data: { coefficient: entry.coefficient },
          });
        }

        return prisma.subjectCoefficient.create({
          data: {
            schoolId,
            subjectId,
            classLevel: entry.classLevel,
            serieCode: entry.serieCode ?? null,
            coefficient: entry.coefficient,
          },
        });
      })
    );

    return res.json({ message: "Coefficients mis à jour", coefficients: results });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Assign a subject to a teacher
// @route   POST /api/subjects/teachers/:teacherId/subjects
// @access  Private/Admin
export const assignSubjectToTeacher = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can assign subjects to teachers" });
    }

    const schoolId = currentUser?.schoolId;
    const teacherUserId = String(req.params.teacherId);
    const { subjectId } = req.body;

    if (!subjectId) return res.status(400).json({ message: "subjectId est requis" });

    const [teacherProfile, subject] = await Promise.all([
      prisma.teacherProfile.findFirst({ where: { userId: teacherUserId, user: { schoolId } } }),
      prisma.subject.findFirst({ where: { id: subjectId, schoolId } }),
    ]);

    if (!teacherProfile) return res.status(404).json({ message: "Enseignant introuvable" });
    if (!subject) return res.status(404).json({ message: "Matière introuvable" });

    await prisma.teacherSubject.create({
      data: { teacherProfileId: teacherProfile.id, subjectId },
    });

    return res.status(201).json({ message: "Matière assignée à l'enseignant", teacherProfileId: teacherProfile.id, subjectId });
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(400).json({ message: "Cette matière est déjà assignée à cet enseignant" });
    }
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Remove a subject from a teacher
// @route   DELETE /api/subjects/teachers/:teacherId/subjects/:subjectId
// @access  Private/Admin
export const removeSubjectFromTeacher = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    if (currentUser?.role !== "ADMIN") {
      return res.status(403).json({ message: "Only admins can remove subjects from teachers" });
    }

    const schoolId = currentUser?.schoolId;
    const teacherUserId = String(req.params.teacherId);
    const subjectId = String(req.params.subjectId);

    const teacherProfile = await prisma.teacherProfile.findFirst({
      where: { userId: teacherUserId, user: { schoolId } },
    });

    if (!teacherProfile) return res.status(404).json({ message: "Enseignant introuvable" });

    await prisma.teacherSubject.deleteMany({
      where: { teacherProfileId: teacherProfile.id, subjectId },
    });

    return res.json({ message: "Matière retirée de l'enseignant" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};