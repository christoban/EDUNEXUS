/**
 * DevController — Routes de génération de données de test.
 * UNIQUEMENT disponible en développement (NODE_ENV !== 'production').
 */
import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import { SlotKind, GradeValidationStatus } from '@prisma/client';
import { CYCLE1_ORDER } from '@application/school/SubjectAssignmentHelper';

// Retourne le serieCode effectif d'une classe (pour matcher SubjectCoefficient)
function effectiveSerieCode(cls: { serie?: string | null; filiere?: string | null; level?: string | null }): string | null {
  if (cls.serie) return cls.serie;
  if (cls.filiere) return cls.filiere;
  if (cls.level && (CYCLE1_ORDER as string[]).includes(cls.level)) return 'FR_GENERAL';
  return null;
}

// Convertit une config de grille horaire en liste de créneaux { start, end }
function computeSlotsFromGrid(cfg: {
  heureDebut: string; dureePeriode: number;
  periodesAvantP1: number; dureePetitePause: number;
  periodesAvantP2: number; dureeGrandePause: number;
  periodesApresP2: number;
}): { start: string; end: string }[] {
  const toMin = (h: string) => { const [hh, mm] = h.split(':').map(Number); return hh * 60 + mm; };
  const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const slots: { start: string; end: string }[] = [];
  let cur = toMin(cfg.heureDebut);
  const addPeriods = (n: number) => {
    for (let i = 0; i < n; i++) {
      slots.push({ start: toStr(cur), end: toStr(cur + cfg.dureePeriode) });
      cur += cfg.dureePeriode;
    }
  };
  addPeriods(cfg.periodesAvantP1);
  cur += cfg.dureePetitePause;
  addPeriods(cfg.periodesAvantP2);
  cur += cfg.dureeGrandePause;
  addPeriods(cfg.periodesApresP2);
  return slots;
}

export class DevController {
  constructor(private readonly prisma: PrismaClient) {}

  // POST /api/v2/dev/generate-assignments
  generateAssignments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const [teachers, allClasses, coeffs, classOverrides] = await Promise.all([
        this.prisma.user.findMany({
          where: { schoolId, role: 'TEACHER', isActive: true },
          select: { id: true },
        }),
        this.prisma.class.findMany({
          where: { schoolId },
          select: { id: true, level: true, serie: true, filiere: true, academicYearId: true },
        }),
        this.prisma.subjectCoefficient.findMany({
          where: { schoolId },
          select: { classLevel: true, serieCode: true, subjectId: true },
        }),
        this.prisma.classSubjectOverride.findMany({
          where: { schoolId },
          select: { classId: true, subjectId: true },
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
      if (coeffs.length === 0 && classOverrides.length === 0) {
        res.status(422).json({ success: false, message: 'Aucune matière assignée aux classes. Activez d\'abord l\'établissement.' });
        return;
      }

      // Map "(classLevel||serieCode)" → Set<subjectId>
      // Chaque classe est ainsi associée uniquement à SES matières (pas celles des autres séries)
      const levelSerieSubjects = new Map<string, Set<string>>();
      for (const c of coeffs) {
        const key = `${c.classLevel}||${c.serieCode ?? '__NULL__'}`;
        if (!levelSerieSubjects.has(key)) levelSerieSubjects.set(key, new Set());
        levelSerieSubjects.get(key)!.add(c.subjectId);
      }

      // Set de subjectIds en override par classe (à exclure des SubjectCoefficients pour éviter doublons)
      const overrideByClass = new Map<string, Set<string>>();
      for (const o of classOverrides) {
        if (!overrideByClass.has(o.classId)) overrideByClass.set(o.classId, new Set());
        overrideByClass.get(o.classId)!.add(o.subjectId);
      }

      // Supprimer les affectations existantes
      await this.prisma.teachingAssignment.deleteMany({ where: { schoolId } });

      const toCreate: { classId: string; subjectId: string; teacherId: string; schoolId: string; academicYearId: string }[] = [];
      let tIdx = 0;

      for (const cls of allClasses) {
        if (!cls.level) continue;
        const serie = effectiveSerieCode(cls);
        const key = `${cls.level}||${serie ?? '__NULL__'}`;
        const subjectIds = levelSerieSubjects.get(key) ?? new Set<string>();
        const overrides = overrideByClass.get(cls.id) ?? new Set<string>();

        // Matières du niveau+série (en excluant celles déjà en override)
        for (const subjectId of subjectIds) {
          if (overrides.has(subjectId)) continue;
          toCreate.push({ classId: cls.id, subjectId, teacherId: teachers[tIdx % teachers.length].id, schoolId, academicYearId: cls.academicYearId });
          tIdx++;
        }

        // Matières spécifiques à cette classe (ClassSubjectOverride)
        for (const subjectId of overrides) {
          toCreate.push({ classId: cls.id, subjectId, teacherId: teachers[tIdx % teachers.length].id, schoolId, academicYearId: cls.academicYearId });
          tIdx++;
        }
      }

      await this.prisma.teachingAssignment.createMany({ data: toCreate, skipDuplicates: true });

      const byClass = new Map<string, number>();
      for (const a of toCreate) byClass.set(a.classId, (byClass.get(a.classId) ?? 0) + 1);
      const avgPerClass = byClass.size > 0 ? Math.round(toCreate.length / byClass.size) : 0;

      res.json({
        success: true,
        data: {
          count: toCreate.length,
          classes: byClass.size,
          avgPerClass,
          message: `${toCreate.length} affectations créées (${byClass.size} classes, ~${avgPerClass} matières/classe)`,
        },
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

      const [assignments, classes, gridConfig] = await Promise.all([
        this.prisma.teachingAssignment.findMany({
          where: { schoolId },
          select: { classId: true, subjectId: true, teacherId: true },
        }),
        this.prisma.class.findMany({ where: { schoolId }, select: { id: true } }),
        this.prisma.timetableGridConfig.findFirst({ where: { schoolId } }),
      ]);

      if (assignments.length === 0) {
        res.status(422).json({ success: false, message: 'Générez d\'abord les affectations.' });
        return;
      }

      // Calcul des créneaux depuis la grille horaire de l'école (ou valeurs par défaut)
      const SLOTS_PER_DAY = gridConfig
        ? computeSlotsFromGrid(gridConfig)
        : [
            { start: '07:30', end: '08:30' },
            { start: '08:30', end: '09:30' },
            { start: '09:30', end: '10:30' },
            { start: '10:45', end: '11:45' },
          ];

      let timetableCount = 0;
      let slotCount = 0;
      let conflictCount = 0;

      const assignmentsByClass = new Map<string, typeof assignments>();
      for (const a of assignments) {
        if (!assignmentsByClass.has(a.classId)) assignmentsByClass.set(a.classId, []);
        assignmentsByClass.get(a.classId)!.push(a);
      }

      // Suivi global des disponibilités : teacherId → Set<"day-slotIdx">
      const teacherBusy = new Map<string, Set<string>>();

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
          for (let s = 0; s < SLOTS_PER_DAY.length; s++) {
            const slotKey = `${day}-${s}`;

            // Cherche la première affectation dont l'enseignant est libre à ce créneau
            let chosen = -1;
            for (let i = 0; i < classAssignments.length; i++) {
              const candidate = classAssignments[(aIdx + i) % classAssignments.length];
              const busy = candidate.teacherId ? (teacherBusy.get(candidate.teacherId) ?? new Set()) : new Set();
              if (!busy.has(slotKey)) {
                chosen = (aIdx + i) % classAssignments.length;
                aIdx = (chosen + 1) % classAssignments.length;
                break;
              }
            }

            // Fallback si tous les enseignants sont occupés à ce créneau
            if (chosen === -1) {
              chosen = aIdx % classAssignments.length;
              aIdx = (aIdx + 1) % classAssignments.length;
              conflictCount++;
            }

            const assignment = classAssignments[chosen];

            // Marquer l'enseignant comme occupé
            if (assignment.teacherId) {
              if (!teacherBusy.has(assignment.teacherId)) teacherBusy.set(assignment.teacherId, new Set());
              teacherBusy.get(assignment.teacherId)!.add(slotKey);
            }

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

      const conflictMsg = conflictCount === 0
        ? '✅ Aucun conflit d\'horaire'
        : `⚠️ ${conflictCount} créneau(x) avec conflit résiduel (tous les enseignants étaient occupés)`;

      res.json({
        success: true,
        data: {
          timetables: timetableCount,
          slots: slotCount,
          conflicts: conflictCount,
          message: `${timetableCount} EDT générés (${slotCount} créneaux) — ${conflictMsg}`,
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

  // GET /api/v2/dev/diagnostic
  diagnostic = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      const [classes, totalStudents, totalTeachers, totalAssignments, timetables] = await Promise.all([
        this.prisma.class.findMany({
          where: { schoolId },
          select: {
            id: true,
            name: true,
            level: true,
            serie: true,
            professorPrincipalId: true,
            professorPrincipal: { select: { firstName: true, lastName: true } },
            _count: { select: { students: true, teachingAssignments: true } },
            timetables: { select: { id: true, _count: { select: { slots: true } } }, take: 1 },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.studentProfile.count({ where: { class: { schoolId } } }),
        this.prisma.user.count({ where: { schoolId, role: 'TEACHER', isActive: true } }),
        this.prisma.teachingAssignment.count({ where: { schoolId } }),
        this.prisma.timetable.count({ where: { schoolId } }),
      ]);

      const classesInfo = classes.map(c => ({
        id: c.id,
        name: c.name,
        level: c.level,
        serie: c.serie,
        students: c._count.students,
        professorPrincipal: c.professorPrincipal
          ? `${c.professorPrincipal.firstName} ${c.professorPrincipal.lastName}`
          : null,
        assignedSubjects: c._count.teachingAssignments,
        hasTimetable: c.timetables.length > 0,
        timetableSlots: c.timetables[0]?._count?.slots ?? 0,
      }));

      res.json({
        success: true,
        data: {
          classes: classesInfo,
          stats: {
            totalClasses: classes.length,
            totalStudents,
            totalTeachers,
            totalAssignments,
            totalTimetables: timetables,
            classesWithProfPrincipal: classes.filter(c => c.professorPrincipalId).length,
            classesWithoutProfPrincipal: classes.filter(c => !c.professorPrincipalId).length,
            classesWithTimetable: classes.filter(c => c.timetables.length > 0).length,
            classesWithoutTimetable: classes.filter(c => c.timetables.length === 0).length,
            classesWithAssignments: classes.filter(c => c._count.teachingAssignments > 0).length,
            classesWithoutAssignments: classes.filter(c => c._count.teachingAssignments === 0).length,
          },
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/dev/reset
  // POST /api/v2/dev/assign-class
  // Assigne une classe à tous les élèves de l'école qui n'en ont pas.
  // body: { className: "Tle A4-Allemand" } ou { classId: "xxx" }
  assignClass = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId, className } = req.body as { classId?: string; className?: string };

      if (!classId && !className) {
        res.status(400).json({ success: false, message: 'classId ou className requis' });
        return;
      }

      const targetClass = classId
        ? await this.prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } })
        : await this.prisma.class.findFirst({ where: { name: className, schoolId }, select: { id: true, name: true } });

      if (!targetClass) {
        res.status(404).json({ success: false, message: `Classe introuvable : ${className ?? classId}` });
        return;
      }

      // Élèves de cette école sans classe assignée
      const students = await this.prisma.studentProfile.findMany({
        where: { classId: null, user: { schoolId } },
        select: { id: true },
      });

      if (students.length === 0) {
        res.json({ success: true, data: { message: 'Aucun élève sans classe trouvé.', count: 0 } });
        return;
      }

      const result = await this.prisma.studentProfile.updateMany({
        where: { id: { in: students.map(s => s.id) } },
        data: { classId: targetClass.id },
      });

      res.json({
        success: true,
        data: {
          message: `${result.count} élève(s) assigné(s) à la classe "${targetClass.name}"`,
          count: result.count,
          className: targetClass.name,
        },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/dev/delete-students
  // Supprime tous les élèves de l'école dans le bon ordre de dépendances.
  deleteStudents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { confirm } = req.body as { confirm?: boolean };
      if (confirm !== true) {
        res.status(400).json({ success: false, message: 'Envoyez { confirm: true } pour confirmer.' });
        return;
      }

      const studentUsers = await this.prisma.user.findMany({
        where: { schoolId, role: 'STUDENT' },
        select: { id: true },
      });
      const userIds = studentUsers.map(u => u.id);
      if (userIds.length === 0) {
        res.json({ success: true, data: { message: 'Aucun élève à supprimer.', count: 0 } });
        return;
      }

      const profileIds = (await this.prisma.studentProfile.findMany({
        where: { userId: { in: userIds } }, select: { id: true },
      })).map(p => p.id);

      await this.prisma.$transaction(async (tx) => {
        // Dépendances de StudentProfile
        await tx.studentSubGroupAssignment.deleteMany({ where: { studentProfileId: { in: profileIds } } });
        await tx.parentStudent.deleteMany({ where: { studentProfileId: { in: profileIds } } });
        // Dépendances de User (RESTRICT → supprimer avant User)
        await tx.grade.deleteMany({ where: { studentId: { in: userIds } } });
        await tx.attendance.deleteMany({ where: { studentId: { in: userIds } } });
        await tx.reportCard.deleteMany({ where: { studentId: { in: userIds } } });
        await tx.invoice.deleteMany({ where: { studentId: { in: userIds } } });
        await tx.payment.deleteMany({ where: { studentId: { in: userIds } } });
        await tx.studentPromotion.deleteMany({ where: { studentId: { in: userIds } } });
        // User → cascade supprime StudentProfile
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      });

      res.json({
        success: true,
        data: { message: `${userIds.length} élève(s) supprimé(s) avec toutes leurs données.`, count: userIds.length },
      });
    } catch (err) { next(err); }
  };

  // POST /api/v2/dev/delete-teachers
  // Supprime tous les enseignants de l'école dans le bon ordre de dépendances.
  deleteTeachers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { confirm } = req.body as { confirm?: boolean };
      if (confirm !== true) {
        res.status(400).json({ success: false, message: 'Envoyez { confirm: true } pour confirmer.' });
        return;
      }

      const teacherUsers = await this.prisma.user.findMany({
        where: { schoolId, role: 'TEACHER' },
        select: { id: true },
      });
      const userIds = teacherUsers.map(u => u.id);
      if (userIds.length === 0) {
        res.json({ success: true, data: { message: 'Aucun enseignant à supprimer.', count: 0 } });
        return;
      }

      const profileIds = (await this.prisma.teacherProfile.findMany({
        where: { userId: { in: userIds } }, select: { id: true },
      })).map(p => p.id);

      await this.prisma.$transaction(async (tx) => {
        // Retirer le professeur principal des classes
        await tx.class.updateMany({
          where: { professorPrincipalId: { in: userIds } },
          data: { professorPrincipalId: null },
        });
        // TeacherSubject (RESTRICT sur TeacherProfile → supprimer en premier)
        await tx.teacherSubject.deleteMany({ where: { teacherProfileId: { in: profileIds } } });
        // TeachingAssignment
        await tx.teachingAssignment.deleteMany({ where: { teacherId: { in: userIds } } });
        // TimetableSlot : désassigner l'enseignant sans supprimer le créneau
        await tx.timetableSlot.updateMany({
          where: { teacherId: { in: userIds } },
          data: { teacherId: null },
        });
        // Présences enregistrées par ces enseignants → SET NULL (déjà géré par FK si nullable)
        await tx.attendance.updateMany({
          where: { teacherId: { in: userIds } },
          data: { teacherId: null },
        });
        // User → cascade supprime TeacherProfile
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
      });

      res.json({
        success: true,
        data: { message: `${userIds.length} enseignant(s) supprimé(s) avec toutes leurs dépendances.`, count: userIds.length },
      });
    } catch (err) { next(err); }
  };

  auditIntegrity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;

      // 1. Créneaux EDT avec un enseignant qui n'a pas de TeachingAssignment pour (classe, matière)
      const slots = await this.prisma.timetableSlot.findMany({
        where: { teacherId: { not: null }, subjectId: { not: null }, timetable: { schoolId } },
        include: {
          timetable: { select: { classId: true, class: { select: { name: true } } } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          subject: { select: { id: true, name: true } },
        },
      });

      const badSlots: any[] = [];
      for (const slot of slots) {
        const assignment = await this.prisma.teachingAssignment.findUnique({
          where: { classId_subjectId: { classId: slot.timetable.classId, subjectId: slot.subjectId! } },
        });
        if (!assignment || assignment.teacherId !== slot.teacherId) {
          badSlots.push({
            slotId: slot.id,
            classe: slot.timetable.class.name,
            matiere: slot.subject?.name,
            enseignant: `${slot.teacher?.firstName} ${slot.teacher?.lastName}`,
            probleme: !assignment ? 'Aucune affectation (classe, matière)' : `Affecté à un autre enseignant`,
          });
        }
      }

      // 2. Professeurs Principaux sans TeachingAssignment dans leur classe
      const classes = await this.prisma.class.findMany({
        where: { schoolId, professorPrincipalId: { not: null } },
        select: { id: true, name: true, professorPrincipalId: true, professorPrincipal: { select: { firstName: true, lastName: true } } },
      });

      const badPP: any[] = [];
      for (const cls of classes) {
        const ppAssignment = await this.prisma.teachingAssignment.findFirst({
          where: { classId: cls.id, teacherId: cls.professorPrincipalId!, schoolId },
        });
        if (!ppAssignment) {
          badPP.push({
            classe: cls.name,
            pp: `${cls.professorPrincipal?.firstName} ${cls.professorPrincipal?.lastName}`,
            probleme: 'PP sans aucune matière assignée dans cette classe',
          });
        }
      }

      // 3. Volume horaire des AP
      const departments = await this.prisma.department.findMany({
        where: { schoolId, headId: { not: null } },
        select: { name: true, headId: true, head: { select: { firstName: true, lastName: true } } },
      });
      const gridConfig = await this.prisma.timetableGridConfig.findUnique({ where: { schoolId }, select: { dureePeriode: true } });
      const dureePeriode = gridConfig?.dureePeriode ?? 55;

      const apVolumes: any[] = [];
      for (const dept of departments) {
        const slotCount = await this.prisma.timetableSlot.count({
          where: { teacherId: dept.headId!, timetable: { schoolId } },
        });
        const heures = slotCount * dureePeriode / 60;
        apVolumes.push({
          departement: dept.name,
          ap: `${dept.head?.firstName} ${dept.head?.lastName}`,
          creneaux: slotCount,
          heuresParSemaine: Math.round(heures * 10) / 10,
          conforme: heures <= 14,
        });
      }

      const hasViolations = badSlots.length > 0 || badPP.length > 0 || apVolumes.some(a => !a.conforme);
      res.json({
        success: true,
        data: {
          conforme: !hasViolations,
          creneauxInvalides: { count: badSlots.length, detail: badSlots },
          ppSansMatiere: { count: badPP.length, detail: badPP },
          volumeAP: apVolumes,
        },
      });
    } catch (err) { next(err); }
  };

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
