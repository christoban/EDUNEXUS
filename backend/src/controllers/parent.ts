import { type Request, type Response } from "express";
import User from "../models/user.ts";
import Exam from "../models/exam.ts";
import ReportCard from "../models/reportCard.ts";
import AttendanceRecord from "../models/attendance.ts";
import Timetable from "../models/timetable.ts";
import Class from "../models/class.ts";
import Subject from "../models/subject.ts";
import Grade from "../models/grade.ts";
import { logActivity } from "../utils/activitieslog.ts";

/**
 * Get all children of the current parent user
 * @route GET /api/parent/children
 */
export const getMyChildren = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const sectionId = typeof req.query.sectionId === "string" ? req.query.sectionId : undefined;
    const cycle = typeof req.query.cycle === "string" ? req.query.cycle : undefined;

    // Fetch all students where parentId = currentUser._id and role = "student"
    const childrenQuery: any = {
      parentId: currentUser._id,
      role: "student",
      isActive: true,
    };

    const children = await User.find(childrenQuery, "name email studentClass isActive schoolSection")
      .populate({
        path: "studentClass",
        select: "name section",
        populate: {
          path: "section",
          select: "name language cycle subSystem",
          populate: { path: "subSystem", select: "code name" },
        },
      })
      .lean();

    // Enrich with basic stats for each child
    const enrichedChildren = await Promise.all(
      children.map(async (child) => {
        // Attendance rate
        const attendanceStats = await AttendanceRecord.aggregate([
          {
            $match: {
              student: child._id,
            },
          },
          {
            $group: {
              _id: null,
              totalDays: { $sum: 1 },
              presentDays: {
                $sum: {
                  $cond: [
                    {
                      $in: ["$status", ["present", "late"]],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]);

        const attendanceRate =
          attendanceStats.length > 0 && attendanceStats[0].totalDays > 0
            ? Math.round(
                (attendanceStats[0].presentDays / attendanceStats[0].totalDays) *
                  100
              )
            : 0;

        // Latest report card
        const latestReportCard = await ReportCard.findOne(
          { student: child._id },
          "year period aggregates mention"
        )
          .sort({ createdAt: -1 })
          .lean();

        return {
          _id: child._id,
          name: child.name,
          email: child.email,
          class: child.studentClass,
          schoolSection: child.schoolSection,
          section: (child.studentClass as any)?.section || null,
          attendanceRate,
          latestGrade: latestReportCard?.mention || "N/A",
        };
      })
    );

    const userId = (req as any).user._id;
    await logActivity({
      userId,
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
 * Verify that studentId belongs to current parent
 * Returns studentId if valid, otherwise throws error
 */
const verifyParentChildRelation = async (
  parentId: string,
  studentId: string
) => {
  const student = await User.findById(studentId).select("parentId role");
  if (
    !student ||
    student.role !== "student" ||
    student.parentId?.toString() !== parentId
  ) {
    throw new Error("Not authorized to view this student");
  }
  return student;
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
    const student = await verifyParentChildRelation(
      currentUser._id.toString(),
      studentId
    );

    // Fetch student's class
    const studentUser = await User.findById(studentId).select("studentClass");
    if (!studentUser?.studentClass) {
      return res.status(404).json({ message: "Student class not found" });
    }

    // Get exams for student's class
    const exams = await Exam.find({
      class: studentUser.studentClass,
      isActive: true,
    })
      .populate("subject", "name code")
      .populate("teacher", "name")
      .select("title subject teacher duration dueDate isActive createdAt")
      .sort({ dueDate: -1 })
      .lean();

    // Fetch grades for this student (if any submitted)
    const grades = await Grade.find({
      student: studentId,
    }).lean();

    const gradeMap = new Map();
    grades.forEach((g) => {
      gradeMap.set(g.exam.toString(), {
        score: g.score,
        maxScore: g.maxScore,
        percentage: g.percentage,
      });
    });

    // Enrich exams with grade info
    const enrichedExams = exams.map((exam) => {
      const grade = gradeMap.get(exam._id.toString());
      return {
        ...exam,
        grade: grade || null,
      };
    });

    const userId = (req as any).user._id;
    await logActivity({
      userId,
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
    await verifyParentChildRelation(
      currentUser._id.toString(),
      studentId
    );

    // Fetch all report cards for this student
    const reportCards = await ReportCard.find({
      student: studentId,
    })
      .populate("year", "name")
      .populate("period")
      .populate("grades", "score maxScore percentage subject", Grade)
      .sort({ createdAt: -1 })
      .lean();

    // If no report cards, return empty
    if (reportCards.length === 0) {
      return res.json({
        reportCards: [],
        message: "No report cards available yet",
      });
    }

    const userId = (req as any).user._id;
    await logActivity({
      userId,
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
    const student = await verifyParentChildRelation(
      currentUser._id.toString(),
      studentId
    );

    const { year, month } = req.query;
    const filter: any = {
      student: studentId,
    };

    if (year) {
      const yearStart = new Date(`${year}-01-01`);
      const yearEnd = new Date(`${year}-12-31`);
      filter.date = { $gte: yearStart, $lte: yearEnd };
    } else if (month) {
      // Current month if no year specified
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), parseInt(month as string) - 1, 1);
      const monthEnd = new Date(now.getFullYear(), parseInt(month as string), 0);
      filter.date = { $gte: monthStart, $lte: monthEnd };
    }

    const records = await AttendanceRecord.find(filter)
      .populate("student", "name")
      .populate("class", "name")
      .sort({ date: -1 })
      .lean();

    // Calculate summary stats
    const stats = {
      total: records.length,
      present: records.filter((r) => r.status === "present").length,
      absent: records.filter((r) => r.status === "absent").length,
      late: records.filter((r) => r.status === "late").length,
      excused: records.filter((r) => r.status === "excused").length,
    };

    const userId = (req as any).user._id;
    await logActivity({
      userId,
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
    const student = await verifyParentChildRelation(
      currentUser._id.toString(),
      studentId
    );

    // Get student's class
    const studentUser = await User.findById(studentId).select(
      "studentClass"
    );
    if (!studentUser?.studentClass) {
      return res.status(404).json({ message: "Student class not found" });
    }

    // Fetch timetable for that class
    const timetable = await Timetable.findOne({
      class: studentUser.studentClass,
    })
      .populate("schedule.periods.subject", "name code")
      .populate("schedule.periods.teacher", "name email")
      .lean();

    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Viewed child timetable for student ${studentId}`,
    });

    res.json(timetable);
  } catch (error: any) {
    const status = error.message.includes("Not authorized") ? 403 : 500;
    res.status(status).json({ message: error.message });
  }
};
