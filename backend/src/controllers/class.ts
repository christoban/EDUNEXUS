import { type Request, type Response } from "express";
import Class from "../models/class.ts";
import User from "../models/user.ts";
import { logActivity } from "../utils/activitieslog.ts";

// @desc    Create a new Class
// @route   POST /api/classes
// @access  Private/Admin
export const createClass = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create classes" });
    }

    const { name, academicYear, classTeacher, capacity, subjects } = req.body;

    const existingClass = await Class.findOne({ name, academicYear });
    if (existingClass) {
      return res.status(400).json({
        message:
          "Class with this name already exists for the specified academic year.",
      });
    }

    const newClass = await Class.create({
      name,
      academicYear,
      classTeacher,
      capacity,
      subjects: Array.isArray(subjects) ? subjects : [],
    });
    await logActivity({
      userId: (req as any).user.id,
      action: `Created new class: ${newClass.name}`,
    });
    res.status(201).json(newClass);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get All Classes
// @route   GET /api/classes
// @access  Private
export const getAllClasses = async (req: Request, res: Response) => {
  try {
    // 1. Parse Query Parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    // 2. Build Search Query (Case-insensitive regex on Name)
    const query: any = {};
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const currentUser = (req as any).user;
    if (currentUser?.role === "teacher") {
      const teacherSubjectIds = Array.isArray(currentUser.teacherSubject)
        ? currentUser.teacherSubject.map((subjectId: any) => subjectId.toString())
        : [];

      if (!teacherSubjectIds.length) {
        return res.json({
          classes: [],
          pagination: {
            total: 0,
            page,
            pages: 0,
          },
        });
      }

      query.subjects = { $in: teacherSubjectIds };
    } else if (currentUser?.role === "parent") {
      // Parents can only see classes of their children (students with parentId === currentUser._id)
      const parentStudents = await User.find({
        role: "student",
        parentId: currentUser._id,
      });

      const studentClassIds = parentStudents
        .map((student: any) => student.studentClass)
        .filter(Boolean);

      if (!studentClassIds.length) {
        return res.json({
          classes: [],
          pagination: {
            total: 0,
            page,
            pages: 0,
          },
        });
      }

      query._id = { $in: studentClassIds };
    }

    // 3. Execute Query (Count & Find)
    const [total, classes] = await Promise.all([
      Class.countDocuments(query),
      Class.find(query)
        .populate("academicYear", "name")
        .populate("classTeacher", "name email")
        .populate("subjects", "name code")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    const classIds = classes.map((cls) => cls._id);
    const studentCountRows = await User.aggregate([
      {
        $match: {
          role: "student",
          studentClass: { $in: classIds },
        },
      },
      {
        $group: {
          _id: "$studentClass",
          count: { $sum: 1 },
        },
      },
    ]);

    const studentCountMap = new Map<string, number>();
    for (const row of studentCountRows) {
      studentCountMap.set(String(row._id), row.count);
    }

    // 4. Return Data + Pagination Meta
    res.json({
      classes: classes.map((cls) => ({
        ...cls.toObject(),
        studentCount: studentCountMap.get(String(cls._id)) ?? 0,
      })),
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

// @desc    Update Class
// @route   PUT /api/classes/:id
// @access  Private/Admin
export const updateClass = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update classes" });
    }

    const classId = req.params.id;
    const { name, academicYear } = req.body;

    // Prevent duplicate class names for the same academic year on update.
    if (name && academicYear) {
      const existingClass = await Class.findOne({
        name,
        academicYear,
        _id: { $ne: classId },
      });

      if (existingClass) {
        return res.status(400).json({
          message:
            "Class with this name already exists for the specified academic year.",
        });
      }
    }

    const updatedClass = await Class.findByIdAndUpdate(classId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedClass) {
      return res.status(404).json({ message: "Class not found" });
    }

    await logActivity({
      userId: (req as any).user.id,
      action: `Updated class: ${updatedClass.name}`,
    });

    return res.status(200).json(updatedClass);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete Class
// @route   DELETE /api/classes/:id
// @access  Private/Admin
export const deleteClass = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can delete classes" });
    }

    const deletedClass = await Class.findByIdAndDelete(req.params.id);
    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Deleted class: ${deletedClass?.name}`,
    });
    if (!deletedClass) {
      return res.status(404).json({ message: "Class not found" });
    }
    res.json({ message: "Class removed" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};