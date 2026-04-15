import { type Request, type Response } from "express";
import ReportCard from "../models/reportCard.ts";
import { inngest } from "../inngest/index.ts";
import Class from "../models/class.ts";
import User from "../models/user.ts";

export const triggerReportCardGeneration = async (req: Request, res: Response) => {
  try {
    const { yearId, period, classId, studentId } = req.body;

    await inngest.send({
      name: "reportcard/generate",
      data: {
        yearId,
        period,
        classId: classId || null,
        studentId: studentId || null,
      },
    });

    return res.status(202).json({
      message: "Report card generation queued",
      yearId,
      period,
      classId: classId || null,
      studentId: studentId || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

// Student view
export const getMyReportCards = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const yearId = req.query.yearId as string | undefined;
    const period = req.query.period as string | undefined;

    const query: any = { student: currentUser._id };
    if (yearId) query.year = yearId;
    if (period) query.period = period;

    const reportCards = await ReportCard.find(query)
      .populate("year", "name fromYear toYear")
      .populate("grades")
      .sort({ createdAt: -1 });

    return res.json({ reportCards });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

// Admin/Teacher summary view
export const getReportCards = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const yearId = req.query.yearId as string | undefined;
    const period = req.query.period as string | undefined;
    const studentId = req.query.studentId as string | undefined;
    const search = String(req.query.search || "").trim();

    const query: any = {};
    if (yearId) query.year = yearId;
    if (period) query.period = period;
    if (studentId) query.student = studentId;

    // Teachers can only view report cards for students in their class scope
    if (currentUser.role === "teacher") {
      const teacherSubjectIds = Array.isArray(currentUser.teacherSubject)
        ? currentUser.teacherSubject.map((subjectId: any) => String(subjectId))
        : [];

      if (!teacherSubjectIds.length) {
        return res.json({
          reportCards: [],
          pagination: { total: 0, page, pages: 0, limit },
        });
      }

      const classIds = await Class.find({ subjects: { $in: teacherSubjectIds } })
        .select("_id")
        .lean();

      if (!classIds.length) {
        return res.json({
          reportCards: [],
          pagination: { total: 0, page, pages: 0, limit },
        });
      }

      const studentIds = await User.find({
        role: "student",
        studentClass: { $in: classIds.map((item) => String(item._id)) },
      })
        .select("_id")
        .lean();

      query.student = {
        $in: studentIds.map((student) => student._id),
      };
    }

    if (search) {
      query.$or = [
        { mention: { $regex: search, $options: "i" } },
        { period: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const baseQuery = ReportCard.find(query)
      .populate("year", "name")
      .populate("student", "name email studentClass")
      .populate("grades")
      .sort({ createdAt: -1 });

    const [total, reportCards] = await Promise.all([
      ReportCard.countDocuments(query),
      baseQuery.skip(skip).limit(limit),
    ]);

    return res.json({
      reportCards,
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
