import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";

const startOfDayUtc = (dateString: string) => {
  const parts = dateString.split("-");
  const year = Number(parts[0] || 0);
  const month = Number(parts[1] || 1);
  const day = Number(parts[2] || 1);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

const endOfDayUtc = (dateString: string) => {
  const parts = dateString.split("-");
  const year = Number(parts[0] || 0);
  const month = Number(parts[1] || 1);
  const day = Number(parts[2] || 1);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
};

const teacherCanAccessClass = async (_teacherId: string, classId: string, schoolId?: string) => {
  const schoolClass = await prisma.class.findFirst({
    where: {
      id: classId,
      ...(schoolId ? { schoolId } : {}),
    },
    select: { id: true },
  });

  return !!schoolClass;
};

export const markAttendance = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { classId, date, records } = req.body;
    const schoolId = currentUser?.schoolId;

    if (!["admin", "teacher"].includes(currentUser?.role)) {
      return res.status(403).json({ message: "Not authorized to mark attendance" });
    }

    if (currentUser.role === "teacher") {
      const allowed = await teacherCanAccessClass(
        String(currentUser.userId),
        String(classId),
        schoolId
      );
      if (!allowed) {
        return res.status(403).json({
          message: "Teacher can only mark attendance for assigned classes",
        });
      }
    }

    const classExists = await prisma.class.findFirst({
      where: {
        id: classId,
        ...(schoolId ? { schoolId } : {}),
      },
      select: { id: true },
    });
    if (!classExists) {
      return res.status(404).json({ message: "Class not found" });
    }

    const studentIds = records.map((record: any) => record.studentId);
    const students = await prisma.user.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        id: { in: studentIds },
        role: "STUDENT",
        studentProfile: {
          is: {
            classId,
          },
        },
      },
      select: { id: true },
    });

    const validStudentIds = new Set(students.map((student) => String(student.id)));
    const invalidRecords = records.filter(
      (record: any) => !validStudentIds.has(String(record.studentId))
    );

    if (invalidRecords.length) {
      return res.status(400).json({
        message: "Some students are not assigned to this class",
      });
    }

    const normalizedDate = startOfDayUtc(date);

    for (const record of records) {
      const existing = await prisma.attendance.findFirst({
        where: {
          ...(schoolId ? { schoolId } : {}),
          studentId: String(record.studentId),
          classId: String(classId),
          date: normalizedDate,
        },
      });

      if (existing) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: record.status,
            recordedById: currentUser.userId,
          },
        });
      } else {
        await prisma.attendance.create({
          data: {
            schoolId,
            studentId: String(record.studentId),
            classId: String(classId),
            date: normalizedDate,
            status: record.status,
            recordedById: currentUser.userId,
          },
        });
      }
    }

    await logActivity({
      userId: String(currentUser.userId),
      schoolId,
      action: "Marked attendance",
      details: `Class ${classId} on ${date} (${records.length} records)`,
    });

    return res.status(200).json({
      message: "Attendance saved successfully",
      updatedCount: records.length,
      classId,
      date,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

export const getAttendance = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const schoolId = currentUser?.schoolId;

    const where: any = {
      ...(schoolId ? { schoolId } : {}),
    };
    const classId = req.query.classId as string | undefined;
    const studentId = req.query.studentId as string | undefined;
    const date = req.query.date as string | undefined;

    if (classId) {
      where.classId = classId;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    if (date) {
      where.date = {
        gte: startOfDayUtc(date),
        lte: endOfDayUtc(date),
      };
    }

    if (currentUser?.role === "teacher") {
      const allowedClass = where.classId
        ? await prisma.class.findFirst({
            where: {
              id: where.classId,
              ...(schoolId ? { schoolId } : {}),
            },
            select: { id: true },
          })
        : null;

      if (where.classId && !allowedClass) {
        return res.json({
          records: [],
          pagination: { total: 0, page, pages: 0, limit },
        });
      }
    }

    if (currentUser?.role === "student") {
      where.studentId = currentUser.userId;
    } else if (currentUser?.role === "parent") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: currentUser.userId },
        include: { children: { include: { studentProfile: true } } },
      });

      const childIds = (parentProfile?.children || [])
        .map((child) => child.studentProfile?.userId)
        .filter((value): value is string => Boolean(value));

      if (childIds.length === 0) {
        return res.json({
          records: [],
          pagination: { total: 0, page, pages: 0, limit },
        });
      }
      where.studentId = { in: childIds };
    }

    const [total, records] = await Promise.all([
      prisma.attendance.count({ where }),
      prisma.attendance.findMany({
        where,
        include: { class: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const studentIds = Array.from(new Set(records.map((record) => record.studentId)));
    const recorderIds = Array.from(new Set(records.map((record) => record.recordedById).filter(Boolean) as string[]));

    const [students, recorders] = await Promise.all([
      prisma.user.findMany({
        where: { ...(schoolId ? { schoolId } : {}), id: { in: studentIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      recorderIds.length
        ? prisma.user.findMany({
            where: { ...(schoolId ? { schoolId } : {}), id: { in: recorderIds } },
            select: { id: true, firstName: true, lastName: true, role: true },
          })
        : Promise.resolve([]),
    ]);

    const studentMap = new Map(students.map((student) => [student.id, student]));
    const recorderMap = new Map(recorders.map((user) => [user.id, user]));

    return res.json({
      records: records.map((record) => ({
        ...record,
        student: studentMap.get(record.studentId) || null,
        markedBy: record.recordedById ? recorderMap.get(record.recordedById) || null : null,
      })),
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};
