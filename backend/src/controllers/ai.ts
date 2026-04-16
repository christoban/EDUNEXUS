import { type Request, type Response } from "express";
import User from "../models/user.ts";
import Class from "../models/class.ts";
import Attendance from "../models/attendance.ts";
import Grade from "../models/grade.ts";
import Subject from "../models/subject.ts";

// Helper: Get top classes by attendance issues
const getAttendanceInsights = async () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get attendance data for last 7 days with proper population
  const attendanceData = await Attendance.find({
    createdAt: { $gte: sevenDaysAgo },
  })
    .populate("student", "name")
    .populate("class", "name");

  // Calculate attendance rates by class
  const classAttendance: {
    [key: string]: { present: number; absent: number; total: number };
  } = {};

  for (const record of attendanceData) {
    const className = (record.class as any)?.name || "Unknown";

    if (!classAttendance[className]) {
      classAttendance[className] = { present: 0, absent: 0, total: 0 };
    }

    classAttendance[className].total++;
    if (record.status === "present" || record.status === "late") {
      classAttendance[className].present++;
    } else {
      classAttendance[className].absent++;
    }
  }

  // Find classes with low attendance
  const issues = Object.entries(classAttendance)
    .map(([className, data]) => ({
      className,
      attendanceRate: ((data.present / data.total) * 100).toFixed(1),
      absences: data.absent,
    }))
    .sort((a, b) => parseFloat(a.attendanceRate) - parseFloat(b.attendanceRate))
    .slice(0, 3); // Top 3 worst classes

  return issues;
};

// Helper: Get grade performance insights
const getAcademicInsights = async () => {
  const recentGrades = await Grade.find({
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
  })
    .populate("student", "name")
    .populate("subject", "name")
    .lean();

  // Calculate average scores by subject
  const subjectScores: {
    [key: string]: { total: number; count: number; scores: number[] };
  } = {};

  for (const grade of recentGrades) {
    const subject = (grade.subject as any)?.name || "Unknown";
    const score = grade.score || 0;

    if (!subjectScores[subject]) {
      subjectScores[subject] = { total: 0, count: 0, scores: [] };
    }

    subjectScores[subject].total += score;
    subjectScores[subject].count++;
    subjectScores[subject].scores.push(score);
  }

  // Identify top performers and struggling subjects
  const performanceData = Object.entries(subjectScores)
    .map(([subject, data]) => ({
      subject,
      average: (data.total / data.count).toFixed(1),
      status: data.total / data.count >= 70 ? "strong" : "weak",
    }))
    .sort((a, b) => parseFloat(b.average) - parseFloat(a.average));

  return performanceData;
};

// Helper: Get student-specific insights
const getStudentSpecificInsights = async (userId: string) => {
  const student = await User.findById(userId)
    .populate("studentClass", "name")
    .lean();

  if (!student) return null;

  // Get student's recent grades
  const recentGrades = await Grade.find({
    student: userId,
    createdAt: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }, // Last 60 days
  })
    .populate("subject", "name")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  // Identify weak subjects
  const weakSubjects = recentGrades
    .filter((g) => g.score < 50)
    .map((g) => (g.subject as any)?.name);

  const avgScore =
    recentGrades.length > 0
      ? (
          recentGrades.reduce((sum, g) => sum + g.score, 0) /
          recentGrades.length
        ).toFixed(1)
      : "N/A";

  return {
    className: (student.studentClass as any)?.name || "Unknown",
    averageScore: avgScore,
    weakSubjects: [...new Set(weakSubjects)],
  };
};

// Helper: Get teacher-specific insights (their classes performance)
const getTeacherInsights = async (userId: string) => {
  const teacher = await User.findById(userId)
    .populate("teacherSubject", "name")
    .lean();

  if (!teacher || !Array.isArray(teacher.teacherSubject)) return null;

  const subjectIds = (teacher.teacherSubject as any[]).map((s: any) => s._id);

  // Get all grades for teacher's subjects in last 30 days
  const recentGrades = await Grade.find({
    subject: { $in: subjectIds },
    createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
  })
    .populate("subject", "name")
    .populate("student", "name")
    .lean();

  const subjectPerformance: { [key: string]: number[] } = {};

  for (const grade of recentGrades) {
    const subject = (grade.subject as any)?.name || "Unknown";
    if (!subjectPerformance[subject]) {
      subjectPerformance[subject] = [];
    }
    subjectPerformance[subject].push(grade.score);
  }

  const subjectStats = Object.entries(subjectPerformance)
    .map(([subject, scores]) => ({
      subject,
      average: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1),
      studentsAbove70: scores.filter((s) => s >= 70).length,
      studentsBelow50: scores.filter((s) => s < 50).length,
    }))
    .sort((a, b) => parseFloat(b.average) - parseFloat(a.average));

  return subjectStats;
};

// Main endpoint: Generate AI Insights
export const generateAIInsight = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    console.log(`🤖 AI Insight requested by: ${user?.name || user?._id} (${user?.role})`);
    
    let insight = "";

    if (user.role === "admin") {
      console.log("📊 Generating admin insights...");
      // Admin: Show system-wide insights
      const attendanceIssues = await getAttendanceInsights();
      console.log("📈 Attendance issues found:", attendanceIssues.length);
      
      const academicPerformance = await getAcademicInsights();
      console.log("📚 Academic performance analyzed:", academicPerformance.length);

      if (attendanceIssues.length > 0) {
        const worst = attendanceIssues[0];
        if (worst) {
          insight = `⚠️ Attendance Alert: ${worst.className} has the lowest attendance rate at ${worst.attendanceRate}% with ${worst.absences} absences in the past week. Consider follow-up with parents. `;
        }
      }

      if (academicPerformance.length > 0) {
        const weakSubject = academicPerformance.find(
          (p) => p.status === "weak"
        );
        if (weakSubject) {
          insight += `📚 ${weakSubject.subject} is showing weakness with an average score of ${weakSubject.average}%. Additional tutoring might help.`;
        }
      }

      if (!insight) {
        insight =
          "✅ All systems running smoothly! No critical issues detected. Great job!";
      }
    } else if (user.role === "teacher") {
      console.log("👨‍🏫 Generating teacher insights...");
      // Teacher: Show their classes' performance
      const teacherStats = await getTeacherInsights(user._id);
      console.log("📊 Teacher stats retrieved:", teacherStats?.length || 0);

      if (teacherStats && teacherStats.length > 0) {
        const best = teacherStats[0];
        const worst = teacherStats[teacherStats.length - 1];

        if (best) {
          insight = `📊 Your ${best.subject} class is performing well with an average of ${best.average}%. However, ${best.studentsBelow50} students scored below 50. `;
        }

        if (worst && worst.studentsBelow50 > 0) {
          insight += `Consider focusing on ${worst.subject} - ${worst.studentsBelow50} students need support.`;
        }
      } else {
        insight = "No recent grading data available for your classes.";
      }
    } else if (user.role === "student") {
      console.log("👨‍🎓 Generating student insights...");
      // Student: Personalized study advice
      const studentData = await getStudentSpecificInsights(user._id);
      console.log("📊 Student data retrieved:", !!studentData);

      if (studentData) {
        if (studentData.weakSubjects.length > 0) {
          insight = `💡 Study Focus: Your average score is ${studentData.averageScore}%. Consider dedicating more time to: ${studentData.weakSubjects.join(", ")}. `;
          insight += `These subjects need improvement to boost your overall performance.`;
        } else {
          insight = `🌟 Excellent! Your average score is ${studentData.averageScore}%. Keep up the great work and maintain your current study routine!`;
        }
      } else {
        insight = "No grade data available yet. Continue with your studies!";
      }
    } else {
      insight = "System insights not available for your role.";
    }

    console.log("✅ Insight generated successfully");
    res.json({
      success: true,
      insight: insight || "Unable to generate insights at this time.",
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("❌ AI Insight Error:", error);
    console.error("Stack:", (error as Error)?.stack);
    
    res.status(500).json({
      success: false,
      message: "Failed to generate insight",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
