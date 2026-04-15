import { type Request, type Response } from "express";
import Attendance from "../models/attendance.ts";
import Class from "../models/class.ts";
import User from "../models/user.ts";
import { logActivity } from "../utils/activitieslog.ts";

const startOfDayUtc = (dateString: string) => {
  const parts = dateString.split("-");
  const year = Number(parts[0] || 0);
  const month = Number(parts[1] || 1);
  const day = Number(parts[2] || 1);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

const endOfDayUtc = (dateString: string) => {
  const parts = dateString.split("-");
  const year = Number(parts[0] || 0);
  const month = Number(parts[1] || 1);
  const day = Number(parts[2] || 1);
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
};

const teacherCanAccessClass = async (teacherId: string, classId: string) => {
  const teacher = await User.findById(teacherId).select("teacherSubject").lean();
  const teacherSubjectIds = Array.isArray(teacher?.teacherSubject)
    ? teacher!.teacherSubject.map((subjectId: any) => String(subjectId))
    : [];

  if (!teacherSubjectIds.length) {
    return false;
  }

  const schoolClass = await Class.findOne({
    _id: classId,
    subjects: { $in: teacherSubjectIds },
  })
    .select("_id")
    .lean();

  return !!schoolClass;
};

export const markAttendance = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { classId, date, records } = req.body;

    if (!["admin", "teacher"].includes(currentUser?.role)) {
      return res.status(403).json({ message: "Not authorized to mark attendance" });
    }

    if (currentUser.role === "teacher") {
      const allowed = await teacherCanAccessClass(
        String(currentUser._id),
        String(classId)
      );
      if (!allowed) {
        return res.status(403).json({
          message: "Teacher can only mark attendance for assigned classes",
        });
      }
    }

    const classExists = await Class.findById(classId).select("_id").lean();
    if (!classExists) {
      return res.status(404).json({ message: "Class not found" });
    }

    const studentIds = records.map((record: any) => record.studentId);
    const students = await User.find({
      _id: { $in: studentIds },
      role: "student",
      studentClass: classId,
    })
      .select("_id")
      .lean();

    const validStudentIds = new Set(students.map((student) => String(student._id)));
    const invalidRecords = records.filter(
      (record: any) => !validStudentIds.has(String(record.studentId))
    );

    if (invalidRecords.length) {
      return res.status(400).json({
        message: "Some students are not assigned to this class",
      });
    }

    const normalizedDate = startOfDayUtc(date);

    const operations = records.map((record: any) => ({
      updateOne: {
        filter: {
          student: record.studentId,
          class: classId,
          date: normalizedDate,
        },
        update: {
          $set: {
            status: record.status,
            markedBy: currentUser._id,
          },
          $setOnInsert: {
            student: record.studentId,
            class: classId,
            date: normalizedDate,
          },
        },
        upsert: true,
      },
    }));

    if (operations.length) {
      await Attendance.bulkWrite(operations);
    }

    await logActivity({
      userId: String(currentUser._id),
      action: "Marked attendance",
      details: `Class ${classId} on ${date} (${records.length} records)`,
    });

    return res.status(200).json({
      message: "Attendance saved successfully",
      updatedCount: records.length,
      classId,
      date,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

export const getAttendance = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const query: any = {};
    const classId = req.query.classId as string | undefined;
    const studentId = req.query.studentId as string | undefined;
    const date = req.query.date as string | undefined;

    if (classId) {
      query.class = classId;
    }

    if (studentId) {
      query.student = studentId;
    }

    if (date) {
      query.date = {
        $gte: startOfDayUtc(date),
        $lte: endOfDayUtc(date),
      };
    }

    if (currentUser?.role === "teacher") {
      const teacher = await User.findById(currentUser._id)
        .select("teacherSubject")
        .lean();
      const teacherSubjectIds = Array.isArray(teacher?.teacherSubject)
        ? teacher!.teacherSubject.map((subjectId: any) => String(subjectId))
        : [];

      if (!teacherSubjectIds.length) {
        return res.json({
          records: [],
          pagination: { total: 0, page, pages: 0, limit },
        });
      }

      const allowedClasses = await Class.find({
        subjects: { $in: teacherSubjectIds },
      })
        .select("_id")
        .lean();

      const allowedClassIds = allowedClasses.map((schoolClass) => schoolClass._id);
      query.class = query.class
        ? { $in: allowedClassIds.filter((id) => String(id) === String(query.class)) }
        : { $in: allowedClassIds };
    }

    if (currentUser?.role === "student") {
      query.student = currentUser._id;
    } else if (currentUser?.role === "parent") {
      // Parents can only see attendance of their children
      const parentChildren = await User.find({
        role: "student",
        parentId: currentUser._id,
      }).select("_id");

      const childIds = parentChildren.map((child) => child._id);
      if (childIds.length === 0) {
        return res.json({
          records: [],
          pagination: { total: 0, page, pages: 0, limit },
        });
      }
      query.student = { $in: childIds };
    }

    const [total, records] = await Promise.all([
      Attendance.countDocuments(query),
      Attendance.find(query)
        .populate("student", "name email studentClass")
        .populate("class", "name")
        .populate("markedBy", "name role")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    return res.json({
      records,
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
