import { type Request, type Response } from "express";
import { logActivity } from "../utils/activitieslog.ts";
import Exam from "../models/exam.ts";
import ExamGeneration from "../models/examGeneration.ts";
import Class from "../models/class.ts";
import Subject from "../models/subject.ts";
import Submission from "../models/submission.ts";
import { inngest } from "../inngest/index.ts";

const getTeacherSubjectIds = (user: any) =>
  Array.isArray(user?.teacherSubject)
    ? user.teacherSubject.map((subjectId: any) => subjectId.toString())
    : [];

const canTeacherAccessSubject = (user: any, subjectId: any) => {
  if (user?.role === "admin") return true;
  const teacherSubjectIds = getTeacherSubjectIds(user);
  return teacherSubjectIds.includes(subjectId?.toString());
};

// @desc    Trigger AI Exam Generation
// @route   POST /api/exams/generate
export const triggerExamGeneration = async (req: Request, res: Response) => {
  try {
    const {
      title,
      subject,
      class: classId,
      duration,
      dueDate,
      topic,
      difficulty,
      count,
    } = req.body;
    const subjectDoc = await Subject.findById(subject);
    if (!subjectDoc)
      return res.status(404).json({ message: "Subject not found" });

    const user = (req as any).user;
    if (user.role === "teacher" && !canTeacherAccessSubject(user, subjectDoc._id)) {
      return res.status(403).json({
        message: "Not authorized to create exams for this subject",
      });
    }

    const teacherId = user._id;
    const draftExam = await Exam.create({
      title: title || `Auto-Generated: ${topic}`,
      subject,
      class: classId,
      teacher: teacherId,
      duration: duration || 60,
      dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
      isActive: false, // Draft mode
      questions: [], // Empty for now, Inngest will fill this
    });

    const userId = (req as any).user._id;
    await logActivity({
      userId,
      action: `User triggered exam generation: ${draftExam._id}`,
    });

    const generation = await ExamGeneration.create({
      exam: draftExam._id,
      status: "queued",
      message: "Exam generation queued",
    });

    await inngest.send({
      name: "exam/generate",
      data: {
        examId: draftExam._id,
        generationId: generation._id,
        topic,
        subjectName: subjectDoc.name,
        difficulty: difficulty || "Medium",
        count: count || 10,
      },
    });
    res.status(202).json({
      message: "Exam generation started.",
      examId: draftExam._id,
      generationId: generation._id,
      status: generation.status,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error });
  }
};

export const getExamGeneration = async (req: Request, res: Response) => {
  try {
    const generation = await ExamGeneration.findById(req.params.id).populate(
      "exam",
      "_id title isActive questions"
    );

    if (!generation) {
      return res.status(404).json({ message: "Generation not found" });
    }

    return res.json({ generation });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Create/Publish Exam we won't use it
// @route   POST /api/exams
export const createExam = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (user.role === "teacher") {
      if (!req.body.subject || !canTeacherAccessSubject(user, req.body.subject)) {
        return res.status(403).json({
          message: "Not authorized to create exams for this subject",
        });
      }
    }

    const exam = await Exam.create({
      ...req.body,
      teacher: user._id, // From Auth Middleware
    });
    const userId = user._id;
    await logActivity({ userId, action: "User created a new exam" });
    res.status(201).json(exam);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Exams (Student sees available, Teacher sees created)
// @route   GET /api/exams
export const getExams = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    let query: any = {};

    if (user.role === "student") {
      // Students see exams for their class only
      query = { class: user.studentClass, isActive: true };
    } else if (user.role === "teacher") {
      const teacherSubjectIds = getTeacherSubjectIds(user);

      // Teachers can see only exams belonging to subjects they teach.
      query = teacherSubjectIds.length
        ? { subject: { $in: teacherSubjectIds } }
        : { _id: { $exists: false } };
    }

    const exams = await Exam.find(query)
      .populate("subject", "name")
      .populate("class", "name section")
      .select("-questions.correctAnswer"); // Hide answers!

    if (user.role === "student") {
      const submittedExamIds = await Submission.find({ student: user._id })
        .select("exam")
        .lean();
      const submittedSet = new Set(
        submittedExamIds.map((submission) => submission.exam.toString())
      );

      return res.json(
        exams.map((exam) => ({
          ...exam.toObject(),
          hasSubmitted: submittedSet.has(exam._id.toString()),
        }))
      );
    }

    res.json(exams);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get exam by id
// @route   POST /api/exams/:id
export const getExamById = async (req: Request, res: Response) => {
  try {
    const examId = req.params.id;
    const user = (req as any).user; // Assumes authMiddleware attaches user

    // 1. Initialize the query
    let query = Exam.findById(examId)
      .populate("subject", "name code")
      .populate("class", "name section")
      .populate("teacher", "name email");

    // 2. Conditional Logic: Reveal answers for Teachers/Admins
    // The '+' syntax forces selection of fields marked as { select: false } in Schema
    if (user.role === "teacher" || user.role === "admin") {
      // @ts-ignore
      query = query.select("+questions.correctAnswer");
    }

    // 3. Execute Query
    const exam = await query;

    // 4. Handle Not Found
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // 5. Security Check (Optional but recommended)
    // Ensure student belongs to the class this exam is assigned to
    if (user.role === "student") {
      // Assuming user.studentClass is a string or ObjectId
      // We compare it with the exam.class._id (which might be populated or an ID)
      const examClassId = exam.class._id
        ? exam.class._id.toString()
        : exam.class.toString();
      const userClassId = user.studentClass ? user.studentClass.toString() : "";

      if (examClassId !== userClassId) {
        return res
          .status(403)
          .json({ message: "You are not authorized to view this exam." });
      }
    } else if (user.role === "teacher") {
      const teacherSubjectIds = getTeacherSubjectIds(user);
      const examSubjectId = exam.subject._id
        ? exam.subject._id.toString()
        : exam.subject.toString();

      const canViewExam = teacherSubjectIds.includes(examSubjectId);

      if (!canViewExam) {
        return res
          .status(403)
          .json({ message: "You are not authorized to view this exam." });
      }
    }

    res.json(exam);
  } catch (error: any) {
    console.error(error);

    // Handle Invalid ID format (CastError)
    if (error.name === "CastError") {
      return res.status(400).json({ message: "Invalid exam ID" });
    }

    // Handle other errors
    return res.status(500).json({ message: "Internal server error" });
  }
};

// @desc    Toggle Exam Status (Active/Inactive)
// @route   PATCH /api/exams/:id/status
// @access  Private (Teacher/Admin)
export const toggleExamStatus = async (req: Request, res: Response) => {
  try {
    const examId = req.params.id;
    const user = (req as any).user;

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Security Check: Teacher can modify only exams in subjects they teach.
    if (user.role === "teacher") {
      const canModifyExam = canTeacherAccessSubject(user, exam.subject);
      if (!canModifyExam) {
        return res
          .status(403)
          .json({ message: "Not authorized to modify this exam" });
      }
    } else if (user.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Not authorized to modify this exam" });
    }

    // Toggle the status
    exam.isActive = !exam.isActive;
    await exam.save();
    const userId = (req as any).user._id;
    await logActivity({ userId, action: "User toggled exam status" });
    res.json({
      message: `Exam is now ${exam.isActive ? "Active" : "Inactive"}`,
      _id: exam._id,
      isActive: exam.isActive,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit & Auto-Grade Exam let these happen inside inngest
// @route   POST /api/exams/:id/submit
export const submitExam = async (req: Request, res: Response) => {
  try {
    const { answers } = req.body;
    const studentId = (req as any).user._id;
    const examId = req.params.id;

    // Trigger Inngest function to handle submission
    await inngest.send({
      name: "exam/submit",
      data: {
        examId,
        studentId,
        answers,
      },
    });

    const userId = (req as any).user._id;
    await logActivity({ userId, action: "User submitted an exam" });

    res.status(201).json({
      message: "Exam submission received and is being processed.",
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Exam Results (For Student)
// @route   GET /api/exams/:id/result
export const getExamResult = async (req: Request, res: Response) => {
  try {
    const studentId = (req as any).user._id;
    const examId = req.params.id;

    const submission = await Submission.findOne({
      exam: examId,
      student: studentId,
    }).populate({
      path: "exam",
      select: "title questions._id questions.correctAnswer", // <--- FORCE SELECT correct answers
    });
    if (!submission) {
      return res.status(404).json({ message: "No submission found" });
    }

    res.json(submission);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete exam
// @route   DELETE /api/exams/:id
// @access  Private (Teacher/Admin)
export const deleteExam = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const exam = await Exam.findById(req.params.id);

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Non-admin users can delete only exams of their own subjects.
    if (user.role === "teacher") {
      const canDeleteExam = canTeacherAccessSubject(user, exam.subject);
      if (!canDeleteExam) {
        return res.status(403).json({ message: "Not authorized to delete this exam" });
      }
    } else if (user.role !== "admin") {
      return res.status(403).json({ message: "Not authorized to delete this exam" });
    }

    await Submission.deleteMany({ exam: exam._id });
    await exam.deleteOne();

    await logActivity({
      userId: user._id,
      action: `Deleted exam: ${exam.title}`,
    });

    return res.json({ message: "Exam deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};