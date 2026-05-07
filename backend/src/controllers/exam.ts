import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { inngest } from "../inngest/index.ts";

const getTeacherSubjectIds = async (userId: string) => {
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId },
    include: { teacherSubjects: true },
  });

  return (teacherProfile?.teacherSubjects || []).map((item) => item.subjectId);
};

const canTeacherAccessSubject = async (user: any, subjectId: string) => {
  if (user?.role === "admin") return true;
  const teacherSubjectIds = await getTeacherSubjectIds(user?.userId || "");
  return teacherSubjectIds.includes(subjectId);
};

const isPublished = (exam: any) => Boolean(exam?.content?.status !== "draft");

export const triggerExamGeneration = async (req: Request, res: Response) => {
  try {
    const { title, subject, class: classId, academicYearId, duration, dueDate, topic, difficulty, count } = req.body;
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;

    const subjectDoc = await prisma.subject.findFirst({
      where: {
        id: subject,
        ...(schoolId ? { schoolId } : {}),
      },
    });

    if (!subjectDoc) {
      return res.status(404).json({ message: "Subject not found" });
    }

    if (currentUser.role === "teacher" && !(await canTeacherAccessSubject(currentUser, subjectDoc.id))) {
      return res.status(403).json({ message: "Not authorized to create exams for this subject" });
    }

    const draftExam = await prisma.exam.create({
      data: {
        schoolId,
        title: title || `Auto-Generated: ${topic}`,
        subjectId: subjectDoc.id,
        classId,
        academicYearId,
        scheduledAt: dueDate ? new Date(dueDate) : null,
        isAiGenerated: true,
        content: {
          status: "draft",
          topic,
          difficulty: difficulty || "Medium",
          count: count || 10,
          duration: duration || 60,
        },
      },
      include: { subject: true, class: true },
    });

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `User triggered exam generation: ${draftExam.id}`,
    });

    await inngest.send({
      name: "exam/generate",
      data: {
        examId: draftExam.id,
        topic,
        subjectName: subjectDoc.name,
        difficulty: difficulty || "Medium",
        count: count || 10,
      },
    });

    return res.status(202).json({
      message: "Exam generation started.",
      examId: draftExam.id,
      status: (draftExam.content as any)?.status || "draft",
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const getExamGeneration = async (req: Request, res: Response) => {
  try {
    const exam = await prisma.exam.findFirst({
      where: { id: req.params.id },
      include: {
        subject: true,
        class: true,
        academicYear: true,
        submissions: true,
      },
    });

    if (!exam) {
      return res.status(404).json({ message: "Generation not found" });
    }

    return res.json({ generation: exam });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const createExam = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;

    if (currentUser.role === "teacher" && req.body.subject) {
      if (!(await canTeacherAccessSubject(currentUser, req.body.subject))) {
        return res.status(403).json({ message: "Not authorized to create exams for this subject" });
      }
    }

    const exam = await prisma.exam.create({
      data: {
        schoolId,
        title: req.body.title,
        subjectId: req.body.subject,
        classId: req.body.class,
        academicYearId: req.body.academicYearId,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : null,
        isAiGenerated: Boolean(req.body.isAiGenerated),
        content: {
          ...(typeof req.body.content === "object" ? req.body.content : {}),
          status: req.body.status || "published",
        },
      },
    });

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: "User created a new exam",
    });

    return res.status(201).json(exam);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getExams = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;

    const where: any = {
      ...(schoolId ? { schoolId } : {}),
    };

    if (currentUser.role === "student") {
      const studentProfile = await prisma.studentProfile.findFirst({ where: { userId: currentUser.userId } });
      where.classId = studentProfile?.classId || "__no_match__";
    } else if (currentUser.role === "teacher") {
      const teacherSubjectIds = await getTeacherSubjectIds(currentUser.userId);
      where.subjectId = teacherSubjectIds.length ? { in: teacherSubjectIds } : { in: ["__no_match__"] };
    }

    const exams = await prisma.exam.findMany({
      where,
      include: {
        subject: true,
        class: true,
        academicYear: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (currentUser.role === "student") {
      const publishedExams = exams.filter(isPublished);
      const submittedExamIds = await prisma.submission.findMany({
        where: { studentId: currentUser.userId },
        select: { examId: true },
      });
      const submittedSet = new Set(submittedExamIds.map((item) => item.examId));

      return res.json(
        publishedExams.map((exam) => ({
          ...exam,
          hasSubmitted: submittedSet.has(exam.id),
        }))
      );
    }

    return res.json(exams);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getExamById = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const exam = await prisma.exam.findFirst({
      where: { id: req.params.id, ...(currentUser?.schoolId ? { schoolId: currentUser.schoolId } : {}) },
      include: {
        subject: true,
        class: true,
        academicYear: true,
      },
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (currentUser.role === "student") {
      const studentProfile = await prisma.studentProfile.findFirst({ where: { userId: currentUser.userId } });
      if (studentProfile?.classId !== exam.classId) {
        return res.status(403).json({ message: "You are not authorized to view this exam." });
      }
    }

    if (currentUser.role === "teacher") {
      const allowed = await canTeacherAccessSubject(currentUser, exam.subjectId);
      if (!allowed) {
        return res.status(403).json({ message: "You are not authorized to view this exam." });
      }
    }

    return res.json(exam);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Internal server error" });
  }
};

export const toggleExamStatus = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const exam = await prisma.exam.findFirst({
      where: { id: req.params.id, ...(currentUser?.schoolId ? { schoolId: currentUser.schoolId } : {}) },
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (currentUser.role === "teacher" && !(await canTeacherAccessSubject(currentUser, exam.subjectId))) {
      return res.status(403).json({ message: "Not authorized to modify this exam" });
    }

    const currentStatus = String((exam.content as any)?.status || "published");
    const nextStatus = currentStatus === "draft" ? "published" : "draft";

    const updatedExam = await prisma.exam.update({
      where: { id: exam.id },
      data: {
        content: {
          ...(typeof exam.content === "object" && exam.content ? (exam.content as any) : {}),
          status: nextStatus,
        },
      },
    });

    await logActivity({
      userId: currentUser.userId,
      schoolId: currentUser?.schoolId,
      action: "User toggled exam status",
    });

    return res.json({
      message: `Exam is now ${nextStatus === "published" ? "Active" : "Inactive"}`,
      id: updatedExam.id,
      isActive: nextStatus === "published",
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const submitExam = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const { answers } = req.body;
    const examId = req.params.id;

    await inngest.send({
      name: "exam/submit",
      data: {
        examId,
        studentId: currentUser.userId,
        answers,
      },
    });

    await logActivity({
      userId: currentUser.userId,
      schoolId: currentUser?.schoolId,
      action: "User submitted an exam",
    });

    return res.status(201).json({
      message: "Exam submission received and is being processed.",
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const getExamResult = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const submission = await prisma.submission.findFirst({
      where: {
        examId: req.params.id,
        studentId: currentUser.userId,
      },
      include: {
        exam: {
          include: { subject: true, class: true, academicYear: true },
        },
      },
    });

    if (!submission) {
      return res.status(404).json({ message: "No submission found" });
    }

    return res.json(submission);
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};

export const deleteExam = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const exam = await prisma.exam.findFirst({
      where: { id: req.params.id, ...(currentUser?.schoolId ? { schoolId: currentUser.schoolId } : {}) },
    });

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    if (currentUser.role === "teacher" && !(await canTeacherAccessSubject(currentUser, exam.subjectId))) {
      return res.status(403).json({ message: "Not authorized to delete this exam" });
    }

    await prisma.submission.deleteMany({ where: { examId: exam.id } });
    await prisma.exam.delete({ where: { id: exam.id } });

    await logActivity({
      userId: currentUser.userId,
      schoolId: currentUser?.schoolId,
      action: `Deleted exam: ${exam.title}`,
    });

    return res.json({ message: "Exam deleted successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
};