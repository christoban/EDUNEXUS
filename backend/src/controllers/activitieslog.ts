import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";

// @desc    Get System Activity Logs(including pagination)
// @route   GET /api/activity
// @access  Private/Admin
export const getAllActivities = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const currentUser = (req as any).user;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = String(req.query.search || "").trim();
    const skip = (page - 1) * limit;

    const schoolId = currentUser?.schoolId;
    const where: any = {
      ...(schoolId ? { schoolId } : {}),
      ...(currentUser?.role === "teacher" ? { userId: currentUser.userId } : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: "insensitive" } },
              { description: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [count, logs] = await Promise.all([
      prisma.activitiesLog.count({ where }),
      prisma.activitiesLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      logs,
      page,
      pages: Math.ceil(count / limit),
      total: count,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};