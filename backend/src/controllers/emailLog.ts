import { type Request, type Response } from "express";
import EmailLog from "../models/emailLog.ts";

export const getEmailLogs = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 15;
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const eventType = String(req.query.eventType || "").trim();

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (eventType) {
      query.eventType = eventType;
    }

    if (search) {
      query.$or = [
        { recipientEmail: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      EmailLog.countDocuments(query),
      EmailLog.find(query)
        .populate("recipientUser", "name email role")
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit),
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
