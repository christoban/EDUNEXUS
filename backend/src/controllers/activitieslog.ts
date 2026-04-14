import { type Request, type Response } from "express";
import ActivityLog from "../models/activitieslog.ts";

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

    const query: any = {};

    if (currentUser?.role === "teacher") {
      query.user = currentUser._id;
    }

    if (search) {
      query.$or = [{ action: { $regex: search, $options: "i" } }, { details: { $regex: search, $options: "i" } }];
    }

    const count = await ActivityLog.countDocuments(query);

    const logs = await ActivityLog.find(query)
      .populate("user", "name email role") // populate user details
      .sort({ createdAt: -1 }) // latest first
      .skip(skip)
      .limit(limit);

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