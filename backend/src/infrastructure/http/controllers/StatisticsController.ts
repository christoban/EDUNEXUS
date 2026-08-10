import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { journaliserActionIA } from '@infrastructure/services/AIActionAuditLogger';

const GRADE_STATUSES_VALIDES = ['VALIDATED', 'LOCKED'] as const;

export class StatisticsController {
  constructor(private readonly prisma: PrismaClient) {}

  // GET /grades-evolution?classId=&subjectId=&studentId= — moyenne par séquence de l'année en cours
  gradesEvolution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, studentId } = req.query as {
        classId?: string; subjectId?: string; studentId?: string;
      };

      const annee = await this.prisma.academicYear.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
        select: { id: true },
      });
      if (!annee) {
        res.json({ success: true, data: [] });
        return;
      }

      const grades = await this.prisma.grade.findMany({
        where: {
          schoolId: user.schoolId,
          academicYearId: annee.id,
          validationStatus: { in: [...GRADE_STATUSES_VALIDES] },
          ...(classId ? { classId } : {}),
          ...(subjectId ? { subjectId } : {}),
          ...(studentId ? { studentId } : {}),
        },
        select: {
          sequenceAverage: true,
          sequence: {
            select: {
              id: true,
              name: true,
              orderIndex: true,
              academicPeriod: { select: { name: true } },
            },
          },
        },
      });

      const index = new Map<string, { name: string; orderIndex: number; periodName: string; values: number[] }>();
      for (const g of grades) {
        if (g.sequenceAverage === null) continue;
        const key = g.sequence.id;
        if (!index.has(key)) {
          index.set(key, {
            name: g.sequence.name,
            orderIndex: g.sequence.orderIndex,
            periodName: g.sequence.academicPeriod.name,
            values: [],
          });
        }
        index.get(key)!.values.push(g.sequenceAverage);
      }

      const data = Array.from(index.values())
        .map((s) => ({
          sequenceName: s.name,
          periodName: s.periodName,
          orderIndex: s.orderIndex,
          moyenne: Math.round((s.values.reduce((a, b) => a + b, 0) / s.values.length) * 100) / 100,
          nbNotes: s.values.length,
        }))
        .sort((a, b) => a.orderIndex - b.orderIndex);

      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'evolution_moyenne_generale', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { classId, subjectId, studentId },
      });
      res.json({ success: true, data });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'evolution_moyenne_generale', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.query,
      });
      next(error);
    }
  };

  // GET /classes-comparison?level= — moyenne générale par classe (année en cours)
  classesComparison = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { level } = req.query as { level?: string };

      const annee = await this.prisma.academicYear.findFirst({
        where: { schoolId: user.schoolId, isCurrent: true },
        select: { id: true },
      });
      if (!annee) {
        res.json({ success: true, data: [] });
        return;
      }

      const classes = await this.prisma.class.findMany({
        where: { schoolId: user.schoolId, ...(level ? { level } : {}) },
        select: { id: true, name: true, level: true },
        orderBy: { name: 'asc' },
      });
      if (classes.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }

      const grades = await this.prisma.grade.findMany({
        where: {
          schoolId: user.schoolId,
          academicYearId: annee.id,
          classId: { in: classes.map((c) => c.id) },
          validationStatus: { in: [...GRADE_STATUSES_VALIDES] },
        },
        select: { classId: true, studentId: true, sequenceAverage: true },
      });

      const index = new Map<string, { values: number[]; students: Set<string> }>();
      for (const g of grades) {
        if (!index.has(g.classId)) index.set(g.classId, { values: [], students: new Set() });
        const entry = index.get(g.classId)!;
        if (g.sequenceAverage !== null) entry.values.push(g.sequenceAverage);
        entry.students.add(g.studentId);
      }

      const data = classes.map((c) => {
        const entry = index.get(c.id);
        const moyenne = entry && entry.values.length > 0
          ? Math.round((entry.values.reduce((a, b) => a + b, 0) / entry.values.length) * 100) / 100
          : null;
        return {
          classId: c.id,
          className: c.name,
          level: c.level,
          moyenne,
          nbEleves: entry?.students.size ?? 0,
        };
      });

      journaliserActionIA(this.prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'classement_classes', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { level },
      });
      res.json({ success: true, data });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(this.prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'classement_classes', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.query,
      });
      next(error);
    }
  };

  // GET /students-distribution?criteria=gender|level|paymentStatus
  studentsDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const criteria = (req.query.criteria as string) || 'gender';

      if (criteria === 'gender') {
        const profiles = await this.prisma.studentProfile.findMany({
          where: { studentStatus: 'ACTIVE', user: { schoolId: user.schoolId } },
          select: { gender: true },
        });
        const counts = new Map<string, number>();
        for (const p of profiles) {
          const label = p.gender || 'Non renseigné';
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        res.json({ success: true, data: Array.from(counts, ([label, count]) => ({ label, count })) });
        return;
      }

      if (criteria === 'level') {
        const profiles = await this.prisma.studentProfile.findMany({
          where: { studentStatus: 'ACTIVE', user: { schoolId: user.schoolId } },
          select: { class: { select: { level: true } } },
        });
        const counts = new Map<string, number>();
        for (const p of profiles) {
          const label = p.class?.level || 'Non assigné';
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        res.json({ success: true, data: Array.from(counts, ([label, count]) => ({ label, count })) });
        return;
      }

      if (criteria === 'paymentStatus') {
        const invoices = await this.prisma.invoice.findMany({
          where: { schoolId: user.schoolId, status: { not: 'CANCELLED' } },
          select: { studentId: true, status: true },
        });

        const byStudent = new Map<string, Set<string>>();
        for (const inv of invoices) {
          if (!byStudent.has(inv.studentId)) byStudent.set(inv.studentId, new Set());
          byStudent.get(inv.studentId)!.add(inv.status);
        }

        const counts = new Map<string, number>();
        for (const statuses of byStudent.values()) {
          let label: string;
          if (statuses.has('OVERDUE')) label = 'En retard';
          else if (statuses.has('PENDING') || statuses.has('PARTIAL')) label = 'En attente';
          else label = 'À jour';
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        res.json({ success: true, data: Array.from(counts, ([label, count]) => ({ label, count })) });
        return;
      }

      res.status(400).json({ success: false, message: 'Critère invalide. Utilisez gender, level ou paymentStatus.' });
    } catch (error) {
      next(error);
    }
  };

  // GET /teacher-performance/:teacherId — généralisation de DepartmentController.performance par enseignant
  teacherPerformance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const teacherId = req.params.teacherId as string;

      const teacher = await this.prisma.user.findFirst({
        where: { id: teacherId, schoolId: user.schoolId, role: 'TEACHER' },
        select: { id: true, firstName: true, lastName: true },
      });
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Enseignant introuvable' });
        return;
      }

      const assignments = await this.prisma.teachingAssignment.findMany({
        where: { teacherId, schoolId: user.schoolId },
        select: {
          subjectId: true,
          classId: true,
          subject: { select: { name: true, hoursPerWeek: true } },
          class: { select: { name: true } },
        },
      });

      const heuresPrevuesParSemaine = assignments.reduce((sum, a) => sum + a.subject.hoursPerWeek, 0);
      const subjectIds = [...new Set(assignments.map((a) => a.subjectId))];
      const classIds = [...new Set(assignments.map((a) => a.classId))];

      const grades = subjectIds.length > 0
        ? await this.prisma.grade.findMany({
            where: {
              schoolId: user.schoolId,
              subjectId: { in: subjectIds },
              classId: { in: classIds },
              validationStatus: { in: [...GRADE_STATUSES_VALIDES] },
            },
            select: { subjectId: true, classId: true, sequenceAverage: true },
          })
        : [];

      const gradeIndex = new Map<string, number[]>();
      for (const g of grades) {
        const key = `${g.subjectId}__${g.classId}`;
        if (!gradeIndex.has(key)) gradeIndex.set(key, []);
        if (g.sequenceAverage !== null) gradeIndex.get(key)!.push(g.sequenceAverage);
      }

      const moyennesParClasse = assignments.map((a) => {
        const key = `${a.subjectId}__${a.classId}`;
        const avgs = gradeIndex.get(key) ?? [];
        const moyenne = avgs.length > 0 ? Math.round((avgs.reduce((s, v) => s + v, 0) / avgs.length) * 100) / 100 : null;
        return { subjectName: a.subject.name, className: a.class.name, moyenne, nbEleves: avgs.length };
      });

      const attendances = classIds.length > 0
        ? await this.prisma.attendance.findMany({
            where: { schoolId: user.schoolId, teacherId, classId: { in: classIds } },
            select: { status: true, date: true, classId: true, subjectId: true },
          })
        : [];

      const tauxPresence = attendances.length > 0
        ? Math.round((attendances.filter((a) => a.status === 'PRESENT').length / attendances.length) * 10000) / 100
        : null;

      const seancesEnregistrees = new Set(
        attendances.map((a) => `${a.date.toISOString().slice(0, 10)}__${a.classId}__${a.subjectId}`)
      ).size;

      res.json({
        success: true,
        data: {
          teacherName: `${teacher.firstName} ${teacher.lastName}`,
          heuresPrevuesParSemaine,
          seancesEnregistrees,
          tauxPresence,
          moyennesParClasse,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
