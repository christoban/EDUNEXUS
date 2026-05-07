import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";

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
    const schoolId = (req as any).user?.schoolId;

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

    const userWhere = {
      ...(schoolId ? { schoolId } : {}),
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    };

    const [users, classes, subjects, activities] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true },
        take: 100,
      }),
      prisma.class.findMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          name: { contains: q, mode: "insensitive" },
        },
        select: { id: true, name: true, createdAt: true },
        take: 100,
      }),
      prisma.subject.findMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, code: true, createdAt: true },
        take: 100,
      }),
      prisma.activitiesLog.findMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          OR: [
            { action: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, action: true, description: true, createdAt: true },
        take: 100,
      }),
    ]);

    const merged: SearchResultItem[] = [
      ...users.map((u: any) => ({
        id: String(u.id),
        type: "user" as const,
        title: `${u.firstName} ${u.lastName}`.trim(),
        subtitle: `${u.email} (${u.role})`,
        createdAt: u.createdAt,
      })),
      ...classes.map((c: any) => ({
        id: String(c.id),
        type: "class" as const,
        title: c.name,
        subtitle: "Class",
        createdAt: c.createdAt,
      })),
      ...subjects.map((s: any) => ({
        id: String(s.id),
        type: "subject" as const,
        title: s.name,
        subtitle: s.code,
        createdAt: s.createdAt,
      })),
      ...activities.map((a: any) => ({
        id: String(a.id),
        type: "activity" as const,
        title: a.action,
        subtitle: a.description || undefined,
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
        exams: 0,
        activities: activities.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};
