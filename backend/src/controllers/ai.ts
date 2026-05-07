import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";

const getAttendanceInsights = async (schoolId?: string) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const attendanceData = await prisma.attendance.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      createdAt: { gte: sevenDaysAgo },
    },
    include: { class: true },
  });

  const classAttendance: Record<string, { present: number; absent: number; total: number }> = {};
  for (const record of attendanceData) {
    const className = record.class?.name || "Unknown";
    if (!classAttendance[className]) {
      classAttendance[className] = { present: 0, absent: 0, total: 0 };
    }

    classAttendance[className].total += 1;
    if (record.status === "PRESENT" || record.status === "LATE") {
      classAttendance[className].present += 1;
    } else {
      classAttendance[className].absent += 1;
    }
  }

  return Object.entries(classAttendance)
    .map(([className, data]) => ({
      className,
      attendanceRate: data.total > 0 ? ((data.present / data.total) * 100).toFixed(1) : "0.0",
      absences: data.absent,
    }))
    .sort((a, b) => parseFloat(a.attendanceRate) - parseFloat(b.attendanceRate))
    .slice(0, 3);
};

const getAcademicInsights = async (schoolId?: string) => {
  const recentGrades = await prisma.grade.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: { subject: true },
  });

  const subjectScores: Record<string, { total: number; count: number }> = {};
  for (const grade of recentGrades) {
    const subject = grade.subject?.name || "Unknown";
    if (!subjectScores[subject]) {
      subjectScores[subject] = { total: 0, count: 0 };
    }
    subjectScores[subject].total += Number(grade.value || 0);
    subjectScores[subject].count += 1;
  }

  return Object.entries(subjectScores)
    .map(([subject, data]) => ({
      subject,
      average: data.count > 0 ? (data.total / data.count).toFixed(1) : "0.0",
      status: data.count > 0 && data.total / data.count >= 70 ? "strong" : "weak",
    }))
    .sort((a, b) => parseFloat(b.average) - parseFloat(a.average));
};

const getStudentSpecificInsights = async (userId: string, schoolId?: string) => {
  const student = await prisma.user.findFirst({
    where: {
      id: userId,
      ...(schoolId ? { schoolId } : {}),
    },
    include: {
      studentProfile: { include: { class: true } },
    },
  });

  if (!student) return null;

  const recentGrades = await prisma.grade.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      studentId: userId,
      createdAt: { gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    },
    include: { subject: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const weakSubjects = recentGrades.filter((grade) => Number(grade.value || 0) < 50).map((grade) => grade.subject.name);
  const averageScore = recentGrades.length
    ? (recentGrades.reduce((sum, grade) => sum + Number(grade.value || 0), 0) / recentGrades.length).toFixed(1)
    : "N/A";

  return {
    className: student.studentProfile?.class?.name || "Unknown",
    averageScore,
    weakSubjects: [...new Set(weakSubjects)],
  };
};

const getTeacherInsights = async (userId: string, schoolId?: string) => {
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId },
    include: { teacherSubjects: true },
  });

  if (!teacherProfile || !teacherProfile.teacherSubjects.length) return null;

  const subjectIds = teacherProfile.teacherSubjects.map((entry) => entry.subjectId);
  const recentGrades = await prisma.grade.findMany({
    where: {
      ...(schoolId ? { schoolId } : {}),
      subjectId: { in: subjectIds },
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    include: { subject: true },
  });

  const subjectPerformance: Record<string, number[]> = {};
  for (const grade of recentGrades) {
    const subject = grade.subject?.name || "Unknown";
    if (!subjectPerformance[subject]) {
      subjectPerformance[subject] = [];
    }
    subjectPerformance[subject].push(Number(grade.value || 0));
  }

  return Object.entries(subjectPerformance)
    .map(([subject, scores]) => ({
      subject,
      average: scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "0.0",
      studentsAbove70: scores.filter((score) => score >= 70).length,
      studentsBelow50: scores.filter((score) => score < 50).length,
    }))
    .sort((a, b) => parseFloat(b.average) - parseFloat(a.average));
};

export const generateAIInsight = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const schoolId = user?.schoolId;

    let insight = "";

    if (user.role === "admin") {
      const attendanceIssues = await getAttendanceInsights(schoolId);
      const academicPerformance = await getAcademicInsights(schoolId);

      if (attendanceIssues.length > 0) {
        const worst = attendanceIssues[0];
        if (worst) {
          insight = `Attendance alert: ${worst.className} has the lowest attendance at ${worst.attendanceRate}% with ${worst.absences} absences in the last week. `;
        }
      }

      const weakSubject = academicPerformance.find((item) => item.status === "weak");
      if (weakSubject) {
        insight += `${weakSubject.subject} is weak with an average of ${weakSubject.average}%.`;
      }

      if (!insight) {
        insight = "All indicators are stable. No major issue detected.";
      }
    } else if (user.role === "teacher") {
      const teacherStats = await getTeacherInsights(user.userId, schoolId);

      if (teacherStats && teacherStats.length > 0) {
        const best = teacherStats[0];
        const worst = teacherStats[teacherStats.length - 1];
        insight = `Your best subject is ${best.subject} with average ${best.average}%.`;

        if (worst && worst.studentsBelow50 > 0) {
          insight += ` ${worst.studentsBelow50} students are below 50% in ${worst.subject}.`;
        }
      } else {
        insight = "No recent grade data available for your classes.";
      }
    } else if (user.role === "student") {
      const studentData = await getStudentSpecificInsights(user.userId, schoolId);
      if (!studentData) {
        insight = "No grade data available yet.";
      } else if (studentData.weakSubjects.length > 0) {
        insight = `Your average is ${studentData.averageScore}%. Focus on: ${studentData.weakSubjects.join(", ")}.`;
      } else {
        insight = `Great progress. Your average is ${studentData.averageScore}%.`;
      }
    } else {
      insight = "Insights are not available for this role.";
    }

    return res.json({
      success: true,
      insight,
      timestamp: new Date(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to generate insight",
      error: error?.message || "Unknown error",
    });
  }
};