import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";

/**
 * Verify that studentId belongs to current parent
 */
const verifyParentChildRelation = async (
  parentUserId: string,
  studentId: string,
  schoolId?: string
) => {
  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: parentUserId },
    include: { children: { include: { studentProfile: true } },
  });

  const childEntry = (parentProfile?.children || []).find(
    (child) => child.studentProfile?.userId === studentId
  );

  if (!childEntry) {
    throw new Error("Not authorized to view this student");
  }
  return childEntry.studentProfile;
};

/**
 * Get all children of the current parent user
 * @route GET /api/parent/children
 */
export const getMyChildren = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: currentUser.userId },
      include: {
        children: {
          include: {
            studentProfile: {
              include: {
                class: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const childProfiles = (parentProfile?.children || [])
      .map((child) => child.studentProfile)
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));

    const enrichedChildren = await Promise.all(
      childProfiles.map(async (studentProfile) => {
        const studentId = studentProfile.userId;

        // Attendance rate
        const [presentRecords, totalRecords] = await Promise.all([
          prisma.attendance.count({
            where: {
              ...(schoolId ? { schoolId } : {}),
              studentId,
              status: { in: ["PRESENT", "LATE"] },
            },
          }),
          prisma.attendance.count({
            where: {
              ...(schoolId ? { schoolId } : {}),
              studentId,
            },
          }),
        ]);

        const attendanceRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

        // Latest report card
        const latestReportCard = await prisma.reportCard.findFirst({
          where: {
            ...(schoolId ? { schoolId } : {}),
            studentId,
          },
          orderBy: { createdAt: "desc" },
          select: { mention: true },
        });

        return {
          id: studentProfile.userId,
          name: `${studentProfile.user?.firstName || ""} ${studentProfile.user?.lastName || ""}`.trim(),
          email: studentProfile.user?.email || "",
          class: studentProfile.class
            ? { id: studentProfile.class.id, name: studentProfile.class.name }
            : null,
          schoolSection: currentUser.schoolSection,
          attendanceRate,
          latestGrade: latestReportCard?.mention || "N/A",
        };
      })
    );

    const userId = currentUser.userId;
    await logActivity({
      userId,
      schoolId,
      action: `Viewed children list (${enrichedChildren.length} children)`,
    });

    res.json({
      children: enrichedChildren,
      total: enrichedChildren.length,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get exams for a specific child
 * @route GET /api/parent/children/:studentId/exams
 */
export const getChildExams = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const currentUser = (req as any).user;

    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ message: "studentId is required" });
    }

    // Verify parentship
    const studentProfile = await verifyParentChildRelation(
      currentUser.userId,
      studentId
    );

    // Get exams for student's class
    const exams = await prisma.exam.findMany({
      where: {
        ...(currentUser?.schoolId ? { schoolId: currentUser.schoolId } : {}),
        classId: studentProfile.classId!,
        isAiGenerated: false,
      },
      include: {
        subject: { select: { id: true, name: true, code: true } },
      },
      orderBy: { scheduledAt: "desc" },
    });

    // Fetch grades for this student
    const grades = await prisma.grade.findMany({
      where: {
        ...(currentUser?.schoolId ? { schoolId: currentUser.schoolId } : {}),
        studentId,
      },
      select: { examId: true, value: true, maxValue: true },
    });

    const gradeMap = new Map(
      grades.map((g) => [g.examId, { score: g.value, maxScore: g.maxValue }])
    );

    // Enrich exams with grade info
    const enrichedExams = exams.map((exam) => {
      const grade = gradeMap.get(exam.id);
      return {
        ...exam,
        grade: grade || null,
      };
    });

    const userId = currentUser.userId;
    await logActivity({
      userId,
      schoolId: currentUser?.schoolId,
      action: `Viewed child exams for student ${studentId}`,
    });

    res.json({
      exams: enrichedExams,
      total: enrichedExams.length,
    });
  } catch (error: any) {
    const status = error.message.includes("Not authorized") ? 403 : 500;
    res.status(status).json({ message: error.message });
  }
};

/**
 * Get report card(s) for a specific child
 * @route GET /api/parent/children/:studentId/report-card
 */
export const getChildReportCard = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const currentUser = (req as any).user;

    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ message: "studentId is required" });
    }

    // Verify parentship
    await verifyParentChildRelation(currentUser.userId, studentId);

    // Fetch all report cards for this student
    const reportCards = await prisma.reportCard.findMany({
      where: {
        ...(currentUser?.schoolId ? { schoolId: currentUser.schoolId } : {}),
        studentId,
      },
      include: {
        academicYear: true,
        grades: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (reportCards.length === 0) {
      return res.json({
        reportCards: [],
        message: "No report cards available yet",
      });
    }

    const userId = currentUser.userId;
    await logActivity({
      userId,
      schoolId: currentUser?.schoolId,
      action: `Viewed child report card(s) for student ${studentId}`,
    });

    res.json({
      reportCards,
      total: reportCards.length,
    });
  } catch (error: any) {
    const status = error.message.includes("Not authorized") ? 403 : 500;
    res.status(status).json({ message: error.message });
  }
};

/**
 * Get attendance records for a specific child
 * @route GET /api/parent/children/:studentId/attendance
 */
export const getChildAttendance = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const currentUser = (req as any).user;

    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ message: "studentId is required" });
    }

    // Verify parentship
    await verifyParentChildRelation(currentUser.userId, studentId);

    const { year, month } = req.query;
    const filter: any = {
      ...(currentUser?.schoolId ? { schoolId: currentUser.schoolId } : {}),
      studentId,
    };

    if (year) {
      const yearStart = new Date(`${year}-01-01`);
      const yearEnd = new Date(`${year}-12-31`);
      filter.date = { gte: yearStart, lte: yearEnd };
    } else if (month) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), parseInt(month as string) - 1, 1);
      const monthEnd = new Date(now.getFullYear(), parseInt(month as string), 0);
      filter.date = { gte: monthStart, lte: monthEnd };
    }

    const records = await prisma.attendance.findMany({
      where: filter,
      include: {
        class: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });

    // Calculate summary stats
    const stats = {
      total: records.length,
      present: records.filter((r) => r.status === "PRESENT").length,
      absent: records.filter((r) => r.status === "ABSENT").length,
      late: records.filter((r) => r.status === "LATE").length,
      excused: records.filter((r) => r.status === "EXCUSED").length,
    };

    const userId = currentUser.userId;
    await logActivity({
      userId,
      schoolId: currentUser?.schoolId,
      action: `Viewed child attendance for student ${studentId}`,
    });

    res.json({
      records,
      stats,
      total: records.length,
    });
  } catch (error: any) {
    const status = error.message.includes("Not authorized") ? 403 : 500;
    res.status(status).json({ message: error.message });
  }
};

/**
 * Get timetable for a specific child's class
 * @route GET /api/parent/children/:studentId/timetable
 */
export const getChildTimetable = async (req: Request, res: Response) => {
  try {
    const { studentId } = req.params;
    const currentUser = (req as any).user;

    if (!studentId || typeof studentId !== "string") {
      return res.status(400).json({ message: "studentId is required" });
    }

    // Verify parentship
    const studentProfile = await verifyParentChildRelation(
      currentUser.userId,
      studentId
    );

    if (!studentProfile.classId) {
      return res.status(404).json({ message: "Student class not found" });
    }

    // Fetch timetable for that class
    const timetable = await prisma.timetable.findFirst({
      where: {
        ...(currentUser?.schoolId ? { schoolId: currentUser.schoolId } : {}),
        classId: studentProfile.classId,
      },
      include: {
        slots: {
          include: {
            subject: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    const userId = currentUser.userId;
    await logActivity({
      userId,
      schoolId: currentUser?.schoolId,
      action: `Viewed child timetable for student ${studentId}`,
    });

    res.json(timetable);
  } catch (error: any) {
    const status = error.message.includes("Not authorized") ? 403 : 500;
    res.status(status).json({ message: error.message });
  }
};
