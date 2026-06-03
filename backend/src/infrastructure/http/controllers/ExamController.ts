import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { inngest } from '../../../inngest/index';
import { logActivity } from '../../../utils/activitieslog';

const getTeacherSubjectIds = async (prisma: PrismaClient, userId: string): Promise<string[]> => {
  const profile = await prisma.teacherProfile.findUnique({ where: { userId }, include: { teacherSubjects: true } });
  return (profile?.teacherSubjects || []).map((ts) => ts.subjectId);
};

const canTeacherAccess = async (prisma: PrismaClient, user: any, subjectId: string): Promise<boolean> => {
  if (user.role === 'ADMIN') return true;
  const ids = await getTeacherSubjectIds(prisma, user.userId);
  return ids.includes(subjectId);
};

export class ExamController {
  constructor(private readonly prisma: PrismaClient) {}

  triggerGeneration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { title, subject, class: classId, academicYearId, duration, dueDate, topic, difficulty, count } = req.body;

      const subjectDoc = await this.prisma.subject.findFirst({ where: { id: subject, ...(user.schoolId ? { schoolId: user.schoolId } : {}) } });
      if (!subjectDoc) { res.status(404).json({ message: 'Subject not found' }); return; }
      if (user.role === 'TEACHER' && !(await canTeacherAccess(this.prisma, user, subjectDoc.id))) { res.status(403).json({ message: 'Non autorisé pour ce sujet' }); return; }

      const exam = await this.prisma.exam.create({
        data: { schoolId: user.schoolId, title: title || `Auto: ${topic}`, subjectId: subjectDoc.id, classId, academicYearId, scheduledAt: dueDate ? new Date(dueDate) : null, isAiGenerated: true, content: { status: 'draft', topic, difficulty: difficulty || 'Medium', count: count || 10, duration: duration || 60 } },
        include: { subject: true, class: true },
      });

      await logActivity({ userId: user.userId, schoolId: user.schoolId, action: `Génération examen déclenchée : ${exam.id}` });
      await inngest.send({ name: 'exam/generate', data: { examId: exam.id, topic, subjectName: subjectDoc.name, difficulty: difficulty || 'Medium', count: count || 10 } });

      res.status(202).json({ message: 'Génération démarrée.', examId: exam.id, status: (exam.content as any)?.status });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const where: any = { ...(user.schoolId ? { schoolId: user.schoolId } : {}) };

      if (user.role === 'STUDENT') {
        const profile = await this.prisma.studentProfile.findFirst({ where: { userId: user.userId } });
        where.classId = profile?.classId || '__no_match__';
      } else if (user.role === 'TEACHER') {
        const ids = await getTeacherSubjectIds(this.prisma, user.userId);
        where.subjectId = ids.length ? { in: ids } : { in: ['__no_match__'] };
      }

      const exams = await this.prisma.exam.findMany({ where, include: { subject: true, class: true, academicYear: true }, orderBy: { createdAt: 'desc' } });

      if (user.role === 'STUDENT') {
        const published = exams.filter((e) => (e.content as any)?.status !== 'draft');
        const submitted = await this.prisma.submission.findMany({ where: { studentId: user.userId }, select: { examId: true } });
        const submittedSet = new Set(submitted.map((s) => s.examId));
        res.json(published.map((e) => ({ ...e, hasSubmitted: submittedSet.has(e.id) })));
      } else {
        res.json(exams);
      }
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const exam = await this.prisma.exam.findFirst({ where: { id: (req.params.id as string), ...(user.schoolId ? { schoolId: user.schoolId } : {}) }, include: { subject: true, class: true, academicYear: true } });
      if (!exam) { res.status(404).json({ message: 'Exam not found' }); return; }

      if (user.role === 'STUDENT') {
        const profile = await this.prisma.studentProfile.findFirst({ where: { userId: user.userId } });
        if (profile?.classId !== exam.classId) { res.status(403).json({ message: 'Non autorisé' }); return; }
      }
      if (user.role === 'TEACHER' && !(await canTeacherAccess(this.prisma, user, exam.subjectId))) { res.status(403).json({ message: 'Non autorisé' }); return; }

      res.json(exam);
    } catch (error) {
      next(error);
    }
  };

  getGeneration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const exam = await this.prisma.exam.findFirst({ where: { id: (req.params.id as string), ...(user.schoolId ? { schoolId: user.schoolId } : {}) }, include: { subject: true, class: true, academicYear: true, submissions: true } });
      if (!exam) { res.status(404).json({ message: 'Generation not found' }); return; }
      res.json({ generation: exam });
    } catch (error) {
      next(error);
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const { answers } = req.body;
      await inngest.send({ name: 'exam/submit', data: { examId: (req.params.id as string), studentId: user.userId, answers } });
      await logActivity({ userId: user.userId, schoolId: user.schoolId, action: 'Examen soumis' });
      res.status(201).json({ message: 'Soumission reçue et en cours de traitement.' });
    } catch (error) {
      next(error);
    }
  };

  toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const exam = await this.prisma.exam.findFirst({ where: { id: (req.params.id as string), ...(user.schoolId ? { schoolId: user.schoolId } : {}) } });
      if (!exam) { res.status(404).json({ message: 'Exam not found' }); return; }
      if (user.role === 'TEACHER' && !(await canTeacherAccess(this.prisma, user, exam.subjectId))) { res.status(403).json({ message: 'Non autorisé' }); return; }

      const current = String((exam.content as any)?.status || 'published');
      const next = current === 'draft' ? 'published' : 'draft';
      const updated = await this.prisma.exam.update({ where: { id: exam.id }, data: { content: { ...(exam.content as any), status: next } } });
      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  getResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const submission = await this.prisma.submission.findFirst({ where: { examId: (req.params.id as string), studentId: user.userId }, include: { exam: { include: { subject: true, class: true, academicYear: true } } } });
      if (!submission) { res.status(404).json({ message: 'Aucune soumission trouvée' }); return; }
      res.json(submission);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const exam = await this.prisma.exam.findFirst({ where: { id: (req.params.id as string), ...(user.schoolId ? { schoolId: user.schoolId } : {}) } });
      if (!exam) { res.status(404).json({ message: 'Exam not found' }); return; }
      if (user.role === 'TEACHER' && !(await canTeacherAccess(this.prisma, user, exam.subjectId))) { res.status(403).json({ message: 'Non autorisé' }); return; }

      await this.prisma.submission.deleteMany({ where: { examId: exam.id } });
      await this.prisma.exam.delete({ where: { id: exam.id } });
      await logActivity({ userId: user.userId, schoolId: user.schoolId, action: `Examen supprimé : ${exam.title}` });
      res.json({ message: 'Examen supprimé.' });
    } catch (error) {
      next(error);
    }
  };
}
