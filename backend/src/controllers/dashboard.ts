import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";

const formatPercent = (numerator: number, denominator: number) => {
  if (!denominator) {
    return "0%";
  }
  return `${Math.round((numerator / denominator) * 100)}%`;
};

// Helper to get day name (e.g., "Monday")
const getTodayName = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long" });

// @desc    Get Dashboard Statistics (Role Based)
// @route   GET /api/dashboard/stats
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const schoolId = user?.schoolId;
    const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
    const cycle = typeof req.query.cycle === "string" ? req.query.cycle : undefined;

    // Build class filter based on section/cycle
    let filteredClassIds: string[] = [];
    if (sectionId || cycle) {
      const classWhere: any = { ...(schoolId ? { schoolId } : {}) };
      if (sectionId) classWhere.id = sectionId;
      const classes = await prisma.class.findMany({
        where: classWhere,
        select: { id: true },
      });
      // If cycle filter, need to join with section? Not in schema. We'll ignore cycle filter for now.
      filteredClassIds = classes.map((c) => c.id);
      if (filteredClassIds.length === 0) {
        return res.json({ stats: getEmptyStats(user.role) });
      }
    }

    // Get recent activities
    const recentActivities = await prisma.activitiesLog.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        ...(user.role !== "admin" ? { userId: user.userId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { firstName: true, lastName: true } },
    });

    const formattedActivity = recentActivities.map(
      (log) =>
        `${log.user?.firstName || "User"} ${log.user?.lastName || ""}: ${log.action} (${new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
    );

    let stats: any = {};

    if (user.role === "admin") {
      const [totalStudents, totalTeachers, activeExams, presentAttendance, totalAttendance] = await Promise.all([
        prisma.user.count({
          where: { ...(schoolId ? { schoolId } : {}), role: "STUDENT" },
        }),
        prisma.user.count({
          where: { ...(schoolId ? { schoolId } : {}), role: "TEACHER" },
        }),
        prisma.exam.count({
          where: { ...(schoolId ? { schoolId } : {}), content: { path: ["status"], equals: "published" } },
        }),
        prisma.attendance.count({
          where: {
            ...(schoolId ? { schoolId } : {}),
            status: { in: ["PRESENT", "LATE"] },
          },
        }),
        prisma.attendance.count({
          where: { ...(schoolId ? { schoolId } : {}),
        }),
      ]);

      stats = {
        totalStudents,
        totalTeachers,
        activeExams,
        avgAttendance: formatPercent(presentAttendance, totalAttendance),
        recentActivity: formattedActivity,
      };
    } else if (user.role === "teacher") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: user.userId },
        include: { teacherSubjects: true },
      });

      const teacherSubjectIds = (teacherProfile?.teacherSubjects || []).map((ts) => ts.subjectId);
      const myClasses = await prisma.class.findMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          subjects: { some: { subjectId: { in: teacherSubjectIds } } },
        },
        select: { id: true, name: true },
      });

      const myClassIds = myClasses.map((c) => c.id);
      const myExams = await prisma.exam.findMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          subjectId: { in: teacherSubjectIds },
        },
        select: { id: true },
      });
      const myExamIds = myExams.map((e) => e.id);
      const pendingGrading = await prisma.submission.count({
        where: { examId: { in: myExamIds } },
      });

      // Next class today
      const todayIndex = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(getTodayName());
      let nextClass = "No scheduled class";
      let nextClassTime = "Enjoy your day!";
      if (todayIndex >= 0) {
        const todaySlots = await prisma.timetableSlot.findMany({
          where: {
            dayOfWeek: todayIndex,
            teacherId: user.userId,
          },
          include: {
            timetable: { include: { class: true } },
            subject: true,
          },
          orderBy: { startTime: "asc" },
        });
        if (todaySlots.length > 0) {
          const slot = todaySlots[0];
          nextClass = `${slot.subject?.name || "Subject"} - ${slot.timetable?.class?.name || "Class"}`;
          nextClassTime = `${slot.startTime} - ${slot.endTime}`;
        }
      }

      stats = {
        myClassesCount: myClasses.length,
        myClassNames: myClasses.map((c) => c.name),
        pendingGrading,
        nextClass,
        nextClassTime,
        recentActivity: formattedActivity,
      };
    } else if (user.role === "student") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: user.userId },
        include: { class: true },
      });
      const classId = studentProfile?.classId;
      const studentClassName = studentProfile?.class?.name || "No class assigned";

      const nextExam = classId
        ? await prisma.exam.findFirst({
            where: {
              ...(schoolId ? { schoolId } : {}),
              classId,
              scheduledAt: { gte: new Date() },
            },
            orderBy: { scheduledAt: "asc" },
          })
        : null;

      const [presentAttendance, totalAttendance] = await Promise.all([
        prisma.attendance.count({
          where: {
            ...(schoolId ? { schoolId } : {}),
            studentId: user.userId,
            status: { in: ["PRESENT", "LATE"] },
          },
        }),
        prisma.attendance.count({
          where: {
            ...(schoolId ? { schoolId } : {}),
            studentId: user.userId,
          },
        }),
      ]);

      const pendingAssignments = classId
        ? await prisma.exam.count({
            where: {
              ...(schoolId ? { schoolId } : {}),
              classId,
              scheduledAt: { gte: new Date() },
            },
          })
        : 0;

      stats = {
        myAttendance: formatPercent(presentAttendance, totalAttendance),
        studentClassName,
        pendingAssignments,
        nextExam: nextExam?.title || "No upcoming exams",
        nextExamDate: nextExam?.scheduledAt ? new Date(nextExam.scheduledAt).toLocaleDateString() : "",
        recentActivity: formattedActivity,
      };
    } else if (user.role === "parent") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: user.userId },
        include: { children: { include: { studentProfile: true } } },
      });

      const childUserIds = (parentProfile?.children || [])
        .map((child) => child.studentProfile?.userId)
        .filter((id): id is string => Boolean(id));

      const childClassIds = (parentProfile?.children || [])
        .map((child) => child.studentProfile?.classId)
        .filter((id): id is string => Boolean(id));

      const upcomingExams = childClassIds.length
        ? await prisma.exam.findMany({
            where: {
              ...(schoolId ? { schoolId } : {}),
              classId: { in: childClassIds },
              scheduledAt: { gte: new Date() },
            },
            orderBy: { scheduledAt: "asc" },
            take: 3,
          })
        : [];

      const [childrenPresentAttendance, childrenTotalAttendance] = await Promise.all([
        prisma.attendance.count({
          where: {
            ...(schoolId ? { schoolId } : {}),
            studentId: { in: childUserIds },
            status: { in: ["PRESENT", "LATE"] },
          },
        }),
        prisma.attendance.count({
          where: {
            ...(schoolId ? { schoolId } : {}),
            studentId: { in: childUserIds },
          },
        }),
      ]);

      stats = {
        childrenCount: childUserIds.length,
        childrenAvgAttendance: formatPercent(childrenPresentAttendance, childrenTotalAttendance),
        upcomingExams: upcomingExams.map((e) => ({
          title: e.title,
          dueDate: e.scheduledAt ? new Date(e.scheduledAt).toLocaleDateString() : "",
        })),
        recentActivity: formattedActivity,
      };
    }

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ message: "Server Error", error });
  }
};

const getEmptyStats = (role: string) => {
  switch (role) {
    case "admin":
      return { totalStudents: 0, totalTeachers: 0, activeExams: 0, avgAttendance: "0%", recentActivity: [] };
    case "teacher":
      return { myClassesCount: 0, myClassNames: [], pendingGrading: 0, nextClass: "", nextClassTime: "", recentActivity: [] };
    case "student":
      return { myAttendance: "0%", studentClassName: "", pendingAssignments: 0, nextExam: "", nextExamDate: "", recentActivity: [] };
    case "parent":
      return { childrenCount: 0, childrenAvgAttendance: "0%", upcomingExams: [], recentActivity: [] };
    default:
      return {};
  }
};
