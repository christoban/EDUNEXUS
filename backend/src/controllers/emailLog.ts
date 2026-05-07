import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";

export const getEmailLogs = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 15;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const schoolId = (req as any).user?.schoolId;

    const where: any = {
      ...(schoolId ? { schoolId } : {}),
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { to: { contains: search, mode: "insensitive" } },
        { subject: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return res.json({
      logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};
