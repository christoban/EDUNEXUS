/**
 * DevController — Routes de génération de données de test.
 * UNIQUEMENT disponible en développement (NODE_ENV !== 'production').
 */
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { SlotKind, GradeValidationStatus } from '@prisma/client';

export class DevController {
  constructor(private readonly prisma: PrismaClient) {}

  // POST /api/v2/dev/generate-assignments
  generateAssignments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const [teachers, allClasses] = await Promise.all([
        this.prisma.user.findMany({
          where: { schoolId, role: 'TEACHER', isActive: true },
          select: { id: true },
        }),
        this.prisma.class.findMany({
          where: { schoolId },
          select: { id: true, level: true },
        }),
      ]);

      if (teachers.length === 0) {
        res.status(422).json({ success: false, message: 'Aucun enseignant dans l\'école.' });
        return;
      }
      if (allClasses.length === 0) {
        res.status(422).json({ success: false, message: 'Aucune classe dans l\'école.' });
        return;
      }

      // Pairs (classLevel, subjectId) depuis SubjectCoefficient
      const coeffs = await this.prisma.subjectCoefficient.findMany({
        where: { schoolId },
        select: { classLevel: true, subjectId: true },
        distinct: ['classLevel', 'subjectId'],
      });

      if (coeffs.length === 0) {
        res.status(422).json({ success: false, message: 'Aucune matière assignée aux classes. Activez d\'abord l\'établissement.' });
        return;
      }

      // Map level → classIds
      const classByLevel = new Map<string, string[]>();
      for (const cls of allClasses) {
        if (!cls.level) continue;
        if (!classByLevel.has(cls.level)) classByLevel.set(cls.level, []);
        classByLevel.get(cls.level)!.push(cls.id);
      }

      // Supprimer les affectations existantes
      await this.prisma.teachingAssignment.deleteMany({ where: { schoolId } });

      const toCreate: { classId: string; subjectId: string; teacherId: string; schoolId: string }[] = [];
      let tIdx = 0;

      for (const { classLevel, subjectId } of coeffs) {
        const classIds = classByLevel.get(classLevel) ?? [];
        for (const classId of classIds) {
          toCreate.push({
            classId,
            subjectId,
            teacherId: teachers[tIdx % teachers.length].id,
            schoolId,
          });
          tIdx++;
        }
      }

      await this.prisma.teachingAssignment.createMany({ data: toCreate, skipDuplicates: true });

      res.json({
        success: true,
        data: { count: toCreate.length, message: `${toCreate.length} affectations créées` },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/dev/generate-timetables
  generateTimetables = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const academicYear = await this.prisma.academicYear.findFirst({
        where: { schoolId },
        orderBy: [{ isCurrent: 'desc' }, { createdAt: 'desc' }],
      });
      if (!academicYear) {
        res.status(422).json({ success: false, message: 'Aucune année scolaire trouvée.' });
        return;
      }

      const [assignments, classes] = await Promise.all([
        this.prisma.teachingAssignment.findMany({
          where: { schoolId },
          select: { classId: true, subjectId: true, teacherId: true },
        }),
        this.prisma.class.findMany({ where: { schoolId }, select: { id: true } }),
      ]);

      if (assignments.length === 0) {
        res.status(422).json({ success: false, message: 'Générez d\'abord les affectations.' });
        return;
      }

      // Horaires par défaut : 4 créneaux par jour (Mon-Fri)
      const SLOTS_PER_DAY = [
        { start: '07:30', end: '09:10' },
        { start: '09:10', end: '10:50' },
        { start: '11:00', end: '12:40' },
        { start: '13:30', end: '15:10' },
      ];

      let timetableCount = 0;
      let slotCount = 0;

      const assignmentsByClass = new Map<string, typeof assignments>();
      for (const a of assignments) {
        if (!assignmentsByClass.has(a.classId)) assignmentsByClass.set(a.classId, []);
        assignmentsByClass.get(a.classId)!.push(a);
      }

      for (const cls of classes) {
        const classAssignments = assignmentsByClass.get(cls.id) ?? [];
        if (classAssignments.length === 0) continue;

        const timetable = await this.prisma.timetable.upsert({
          where: { schoolId_classId_academicYearId: { schoolId, classId: cls.id, academicYearId: academicYear.id } },
          update: { status: 'PUBLISHED', generatedByAI: true },
          create: { schoolId, classId: cls.id, academicYearId: academicYear.id, status: 'PUBLISHED', generatedByAI: true },
        });
        timetableCount++;

        await this.prisma.timetableSlot.deleteMany({ where: { timetableId: timetable.id } });

        const slotsToCreate: {
          timetableId: string; subjectId: string; teacherId: string;
          dayOfWeek: number; startTime: string; endTime: string; kind: SlotKind;
        }[] = [];

        let aIdx = 0;
        for (let day = 1; day <= 5; day++) {
          const slotsThisDay = Math.min(SLOTS_PER_DAY.length, classAssignments.length);
          for (let s = 0; s < slotsThisDay; s++) {
            const assignment = classAssignments[aIdx % classAssignments.length];
            aIdx++;
            slotsToCreate.push({
              timetableId: timetable.id,
              subjectId: assignment.subjectId,
              teacherId: assignment.teacherId,
              dayOfWeek: day,
              startTime: SLOTS_PER_DAY[s].start,
              endTime: SLOTS_PER_DAY[s].end,
              kind: SlotKind.CLASS,
            });
          }
        }

        await this.prisma.timetableSlot.createMany({ data: slotsToCreate });
        slotCount += slotsToCreate.length;
      }

      res.json({
        success: true,
        data: {
          timetables: timetableCount,
          slots: slotCount,
          message: `${timetableCount} EDT générés (${slotCount} créneaux)`,
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/dev/generate-attendance
  generateAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const days = Math.min(90, Math.max(1, parseInt(String(req.body.days ?? 30))));

      const studentProfiles = await this.prisma.studentProfile.findMany({
        where: { user: { schoolId }, classId: { not: null } },
        select: { userId: true, classId: true },
      });

      if (studentProfiles.length === 0) {
        res.status(422).json({ success: false, message: 'Aucun élève avec classe assignée.' });
        return;
      }

      // Supprimer les présences existantes de la période
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      await this.prisma.attendance.deleteMany({
        where: { schoolId, date: { gte: cutoff } },
      });

      const records: {
        schoolId: string; studentId: string; classId: string;
        date: Date; status: 'PRESENT' | 'ABSENT' | 'LATE'; period: 'MORNING';
      }[] = [];

      for (let i = 1; i <= days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(7, 30, 0, 0);
        const dow = date.getDay();
        if (dow === 0 || dow === 6) continue; // skip weekends

        for (const sp of studentProfiles) {
          const r = Math.random();
          const status: 'PRESENT' | 'ABSENT' | 'LATE' = r < 0.88 ? 'PRESENT' : r < 0.96 ? 'ABSENT' : 'LATE';
          records.push({
            schoolId,
            studentId: sp.userId,
            classId: sp.classId!,
            date: new Date(date),
            status,
            period: 'MORNING',
          });
        }
      }

      const BATCH = 500;
      for (let i = 0; i < records.length; i += BATCH) {
        await this.prisma.attendance.createMany({ data: records.slice(i, i + BATCH) });
      }

      const presentCount = records.filter(r => r.status === 'PRESENT').length;
      const rate = records.length > 0 ? Math.round((presentCount / records.length) * 1000) / 10 : 0;

      res.json({
        success: true,
        data: {
          count: records.length,
          days,
          presenceRate: rate,
          message: `${records.length} présences créées sur ${days} jours (taux : ${rate}%)`,
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/dev/generate-grades
  generateGrades = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { sequenceId = 'all' } = req.body as { sequenceId?: string };

      const academicYear = await this.prisma.academicYear.findFirst({
        where: { schoolId },
        orderBy: [{ isCurrent: 'desc' }, { createdAt: 'desc' }],
        include: {
          periods: {
            include: { sequences: { orderBy: { orderIndex: 'asc' } } },
          },
        },
      });

      if (!academicYear) {
        res.status(422).json({ success: false, message: 'Aucune année scolaire trouvée.' });
        return;
      }

      const allSequences = academicYear.periods.flatMap(p => p.sequences);
      if (allSequences.length === 0) {
        res.status(422).json({ success: false, message: 'Aucune séquence dans l\'année scolaire.' });
        return;
      }

      const sequences = sequenceId === 'all'
        ? allSequences
        : allSequences.filter(s => s.id === sequenceId);

      if (sequences.length === 0) {
        res.status(404).json({ success: false, message: 'Séquence introuvable.' });
        return;
      }

      const [studentProfiles, assignments] = await Promise.all([
        this.prisma.studentProfile.findMany({
          where: { user: { schoolId }, classId: { not: null } },
          select: { userId: true, classId: true },
        }),
        this.prisma.teachingAssignment.findMany({
          where: { schoolId },
          select: { classId: true, subjectId: true },
        }),
      ]);

      if (studentProfiles.length === 0) {
        res.status(422).json({ success: false, message: 'Aucun élève avec classe assignée.' });
        return;
      }
      if (assignments.length === 0) {
        res.status(422).json({ success: false, message: 'Générez d\'abord les affectations.' });
        return;
      }

      // Supprimer les notes existantes des séquences concernées
      await this.prisma.grade.deleteMany({
        where: { schoolId, sequenceId: { in: sequences.map(s => s.id) } },
      });

      const assignmentsByClass = new Map<string, typeof assignments>();
      for (const a of assignments) {
        if (!assignmentsByClass.has(a.classId)) assignmentsByClass.set(a.classId, []);
        assignmentsByClass.get(a.classId)!.push(a);
      }

      const grades: {
        schoolId: string; studentId: string; subjectId: string; classId: string;
        academicYearId: string; sequenceId: string; sequenceScore: number;
        coefficient: number; maxValue: number; validationStatus: GradeValidationStatus;
      }[] = [];

      for (const seq of sequences) {
        for (const sp of studentProfiles) {
          const classAssignments = assignmentsByClass.get(sp.classId!) ?? [];
          for (const assignment of classAssignments) {
            // Score réaliste : distribution normale approchée entre 3 et 20
            const base = 8 + Math.random() * 11; // 8-19
            const noise = (Math.random() - 0.5) * 3;
            const score = Math.max(0, Math.min(20, Math.round((base + noise) * 10) / 10));
            grades.push({
              schoolId,
              studentId: sp.userId,
              subjectId: assignment.subjectId,
              classId: sp.classId!,
              academicYearId: academicYear.id,
              sequenceId: seq.id,
              sequenceScore: score,
              coefficient: 1,
              maxValue: 20,
              validationStatus: GradeValidationStatus.VALIDATED,
            });
          }
        }
      }

      const BATCH = 500;
      for (let i = 0; i < grades.length; i += BATCH) {
        await this.prisma.grade.createMany({ data: grades.slice(i, i + BATCH) });
      }

      res.json({
        success: true,
        data: {
          count: grades.length,
          sequences: sequences.length,
          message: `${grades.length} notes créées (${sequences.length} séquence${sequences.length > 1 ? 's' : ''})`,
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/dev/reset
  reset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { confirm } = req.body as { confirm?: boolean };

      if (confirm !== true) {
        res.status(400).json({ success: false, message: 'Envoyez { confirm: true } pour confirmer la suppression.' });
        return;
      }

      const [grades, attendances, assignments] = await Promise.all([
        this.prisma.grade.deleteMany({ where: { schoolId } }),
        this.prisma.attendance.deleteMany({ where: { schoolId } }),
        this.prisma.teachingAssignment.deleteMany({ where: { schoolId } }),
      ]);

      // Supprimer les timetables (cascade supprime les slots)
      const timetables = await this.prisma.timetable.deleteMany({ where: { schoolId } });

      res.json({
        success: true,
        data: {
          grades: grades.count,
          attendances: attendances.count,
          assignments: assignments.count,
          timetables: timetables.count,
          message: `Réinitialisé : ${grades.count} notes, ${attendances.count} présences, ${assignments.count} affectations, ${timetables.count} EDT supprimés`,
        },
      });
    } catch (err) { next(err); }
  };
}
