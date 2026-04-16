import { type Request, type Response } from "express";
import { logActivity } from "../utils/activitieslog.ts";
import subject from "../models/subject.ts";
import User from "../models/user.ts";

const toIdStrings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(Boolean).map((item) => String(item))
    : [];

const syncSubjectTeachers = async (
  subjectId: string,
  previousTeacherIds: string[],
  nextTeacherIds: string[]
) => {
  const previousSet = new Set(previousTeacherIds);
  const nextSet = new Set(nextTeacherIds);

  const teacherIdsToAdd = nextTeacherIds.filter((id) => !previousSet.has(id));
  const teacherIdsToRemove = previousTeacherIds.filter((id) => !nextSet.has(id));

  await Promise.all([
    teacherIdsToAdd.length
      ? User.updateMany(
          { _id: { $in: teacherIdsToAdd } },
          { $addToSet: { teacherSubject: subjectId } }
        )
      : Promise.resolve(),
    teacherIdsToRemove.length
      ? User.updateMany(
          { _id: { $in: teacherIdsToRemove } },
          { $pull: { teacherSubject: subjectId } }
        )
      : Promise.resolve(),
  ]);
};

// @desc    Create a new Subject
// @route   POST /api/subjects
// @access  Private/Admin
export const createSubject = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can create subjects" });
    }

    const { name, code, teacher, coefficient, appreciation, isActive } = req.body; // Expecting teacher to be ["ID1", "ID2"]
    const subjectExists = await subject.findOne({ code });
    if (subjectExists) {
      return res.status(400).json({ message: "Subject code already exists" });
    }
    const newSubject = await subject.create({
      name,
      code,
      isActive,
      coefficient,
      appreciation,
      teacher: Array.isArray(teacher) ? teacher : [],
    });

    await syncSubjectTeachers(
      newSubject._id.toString(),
      [],
      toIdStrings(newSubject.teacher)
    );

    if (newSubject) {
      const userId = (req as any).user._id;
      await logActivity({
        userId,
        action: `Created subject: ${newSubject.name}`,
      });
      res.status(201).json(newSubject);
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Get all Subjects
// @route   GET /api/subjects
// @access  Private
export const getAllSubjects = async (req: Request, res: Response) => {
  try {
    // 1. Parse Query Parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;

    // 2. Build Search Query (Search by Name OR Code)
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    const currentUser = (req as any).user;
    if (currentUser?.role === "teacher") {
      const teacherSubjectIds = toIdStrings(currentUser.teacherSubject);
      if (!teacherSubjectIds.length) {
        return res.json({
          subjects: [],
          pagination: {
            total: 0,
            page,
            pages: 0,
          },
        });
      }
      query._id = { $in: teacherSubjectIds };
    }
    // 3. Execute Query (Count & Find)
    const [total, subjects] = await Promise.all([
      subject.countDocuments(query),
      subject
        .find(query)
        .populate("teacher", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    const subjectIds = subjects.map((item) => item._id);
    const teacherCountRows = await User.aggregate([
      {
        $match: {
          role: "teacher",
          teacherSubject: { $in: subjectIds },
        },
      },
      {
        $unwind: "$teacherSubject",
      },
      {
        $match: {
          teacherSubject: { $in: subjectIds },
        },
      },
      {
        $group: {
          _id: "$teacherSubject",
          count: { $sum: 1 },
        },
      },
    ]);

    const teacherCountMap = new Map<string, number>();
    for (const row of teacherCountRows) {
      teacherCountMap.set(String(row._id), row.count);
    }
    // 4. Return Data + Pagination Meta
    res.json({
      subjects: subjects.map((item) => ({
        ...item.toObject(),
        teacherCount: teacherCountMap.get(String(item._id)) ?? 0,
      })),
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Update Subject
// @route   PUT /api/subjects/:id
// @access  Private/Admin
export const updateSubject = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can update subjects" });
    }

    const { name, code, teacher, coefficient, appreciation, isActive } = req.body;

    const existingSubject = await subject.findById(req.params.id);
    if (!existingSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    const previousTeacherIds = toIdStrings(existingSubject.teacher);
    const nextTeacherIds = Array.isArray(teacher)
      ? toIdStrings(teacher)
      : [];

    const updatePayload: any = {};
    if (name !== undefined) updatePayload.name = name;
    if (code !== undefined) updatePayload.code = code;
    if (isActive !== undefined) updatePayload.isActive = isActive;
    if (coefficient !== undefined) updatePayload.coefficient = coefficient;
    if (appreciation !== undefined) updatePayload.appreciation = appreciation;
    if (Array.isArray(teacher)) updatePayload.teacher = teacher;

    const updatedSubject = await subject.findByIdAndUpdate(
      req.params.id,
      updatePayload,
      { new: true, runValidators: true }
    );

    await syncSubjectTeachers(
      updatedSubject!._id.toString(),
      previousTeacherIds,
      nextTeacherIds
    );

    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Updated subject: ${updatedSubject?.name}`,
    });

    res.json(updatedSubject);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

// @desc    Delete Subject
// @route   DELETE /api/subjects/:id
// @access  Private/Admin
export const deleteSubject = async (req: Request, res: Response) => {
  try {
    if ((req as any).user?.role !== "admin") {
      return res.status(403).json({ message: "Only admins can delete subjects" });
    }

    const deletedSubject = await subject.findByIdAndDelete(req.params.id);
    if (!deletedSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    await User.updateMany(
      { teacherSubject: { $in: [deletedSubject._id.toString()] } },
      { $pull: { teacherSubject: deletedSubject._id.toString() } }
    );

    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `Updated subject: ${deletedSubject?.name}`,
    });
    res.json({ message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};