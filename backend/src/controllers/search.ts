import { type Request, type Response } from "express";
import User from "../models/user.ts";
import Class from "../models/class.ts";
import Subject from "../models/subject.ts";
import Exam from "../models/exam.ts";
import ActivityLog from "../models/activitieslog.ts";

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type SearchResultItem = {
  id: string;
  type: "user" | "class" | "subject" | "exam" | "activity";
  title: string;
  subtitle?: string;
  createdAt?: Date;
};

// @desc    Global search across core entities (admin only)
// @route   GET /api/search/global
// @access  Private/Admin
export const globalSearch = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const q = String(req.query.q || "").trim();

    if (!q) {
      return res.json({
        query: q,
        results: [],
        pagination: {
          total: 0,
          page,
          pages: 0,
          limit,
        },
        totalsByType: {
          users: 0,
          classes: 0,
          subjects: 0,
          exams: 0,
          activities: 0,
        },
      });
    }

    const regex = new RegExp(escapeRegex(q), "i");

    const [users, classes, subjects, exams, activities] = await Promise.all([
      User.find({
        $or: [{ name: regex }, { email: regex }, { role: regex }],
      })
        .select("name email role createdAt")
        .limit(100)
        .lean(),
      Class.find({ name: regex })
        .select("name createdAt")
        .limit(100)
        .lean(),
      Subject.find({
        $or: [{ name: regex }, { code: regex }],
      })
        .select("name code createdAt")
        .limit(100)
        .lean(),
      Exam.find({ title: regex })
        .select("title dueDate createdAt")
        .populate("subject", "name code")
        .populate("class", "name")
        .limit(100)
        .lean(),
      ActivityLog.find({
        $or: [{ action: regex }, { details: regex }],
      })
        .select("action details createdAt")
        .populate("user", "name email role")
        .limit(100)
        .lean(),
    ]);

    const merged: SearchResultItem[] = [
      ...users.map((u: any) => ({
        id: String(u._id),
        type: "user" as const,
        title: u.name,
        subtitle: `${u.email} (${u.role})`,
        createdAt: u.createdAt,
      })),
      ...classes.map((c: any) => ({
        id: String(c._id),
        type: "class" as const,
        title: c.name,
        subtitle: "Class",
        createdAt: c.createdAt,
      })),
      ...subjects.map((s: any) => ({
        id: String(s._id),
        type: "subject" as const,
        title: s.name,
        subtitle: s.code,
        createdAt: s.createdAt,
      })),
      ...exams.map((e: any) => ({
        id: String(e._id),
        type: "exam" as const,
        title: e.title,
        subtitle: `${e.subject?.name || "Subject"} - ${e.class?.name || "Class"}`,
        createdAt: e.createdAt,
      })),
      ...activities.map((a: any) => ({
        id: String(a._id),
        type: "activity" as const,
        title: a.action,
        subtitle: `${a.user?.name || "User"}${a.details ? ` - ${a.details}` : ""}`,
        createdAt: a.createdAt,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );

    const total = merged.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedResults = merged.slice(start, start + limit);

    return res.json({
      query: q,
      results: paginatedResults,
      pagination: {
        total,
        page,
        pages,
        limit,
      },
      totalsByType: {
        users: users.length,
        classes: classes.length,
        subjects: subjects.length,
        exams: exams.length,
        activities: activities.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};
