import { type Request, type Response } from "express";
import AcademicYear from "../models/academicYear.ts";
import { logActivity } from "../utils/activitieslog.ts";

// @desc    Create a new Academic Year
// @route   POST /api/academic-years
// @access  Private/Admin
export const createAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, fromYear, toYear, isCurrent } = req.body;

    const existingYear = await AcademicYear.findOne({ fromYear, toYear });
    if (existingYear) {
      res.status(400).json({ message: "Academic Year already exists" });
      return;
    }
    // If isCurrent is true, set all other academic years to false
    if (isCurrent) {
      // the issue is here
      await AcademicYear.updateMany(
        { _id: { $ne: null } },
        { isCurrent: false }
      );
      // we should no use return since we want the function to continue
    }
    const academicYear = await AcademicYear.create({
      name,
      fromYear,
      toYear,
      isCurrent: isCurrent || false,
    });
    await logActivity({
      userId: (req as any).user._id,
      action: `Created academic year ${name}`,
    });
    res.status(201).json(academicYear);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all Academic Years (Paginated & Searchable)
// @route   GET /api/academic-years
// @access  Private/Admin
export const getAllAcademicYears = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    // Build Search Query (Search by Name)
    const query: any = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    const [total, years] = await Promise.all([
      AcademicYear.countDocuments(query),
      AcademicYear.find(query)
        .sort({ createdAt: -1 }) // Newest first
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.json({
      years,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get the current active Academic Year
// @route   GET /api/academic-years/current
// @access  Public or Protected
export const getCurrentAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const currentYear = await AcademicYear.findOne({ isCurrent: true });
    if (!currentYear) {
      res.status(404).json({ message: "No current academic year found" });
      return;
    } else {
      res.status(200).json(currentYear);
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update Academic Year
// @route   PUT /api/academic-years/:id
// @access  Private/Admin
export const updateAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { isCurrent } = req.body;
    if (isCurrent) {
      await AcademicYear.updateMany(
        { _id: { $ne: req.params.id } },
        { isCurrent: false }
      );
    }
    const updatedYear = await AcademicYear.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true } // Return the updated version
    );
    if (!updatedYear) {
      res.status(404).json({ message: "Academic Year not found" });
    }
    await logActivity({
      userId: (req as any).user._id,
      action: `Created academic year ${updatedYear?.name}`,
    });
    res.status(200).json(updatedYear);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete Academic Year
// @route   DELETE /api/academic-years/:id
// @access  Private/Admin
export const deleteAcademicYear = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const year = await AcademicYear.findById(req.params.id);
    if (!year) {
      res.status(404).json({ message: "Academic Year not found" });
      return;
    }
    if (year) {
      // Prevent deletion if it's the current academic year to avoid system breakage
      if (year.isCurrent) {
        res
          .status(400)
          .json({ message: "Cannot delete the current academic year" });
        return;
      }
    }
    await year.deleteOne();

    await logActivity({
      userId: (req as any).user._id,
      action: `Deleted academic year ${year.name}`,
    });
    res.status(200).json({ message: "Academic Year deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};