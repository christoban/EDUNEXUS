import type { Request, Response, NextFunction } from 'express';
import type { EnregistrerPresenceUseCase } from '@application/attendance/EnregistrerPresenceUseCase';
import type { AttendancePeriod, AttendanceStatus } from '@domain/types/enums';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { notifyAbsenceSms } from '@infrastructure/services/sms/SmsNotificationService';
import { notifierParentsPushDabord } from '@infrastructure/services/notification/PushFirstNotifier';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';

const startOfDayUtc = (dateString: string) => {
  const [y = 0, m = 1, d = 1] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
};

const endOfDayUtc = (dateString: string) => {
  const [y = 0, m = 1, d = 1] = dateString.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
};

export class AttendanceController {
  constructor(
    private readonly enregistrerPresence: EnregistrerPresenceUseCase,
  ) {}

  // POST /api/v2/attendance
  enregistrer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;
    const { classId, academicPeriodId, subjectId, date, period, presences, isOfflineSync } = req.body;

    if (!classId || !date || !period || !presences?.length) {
      res.status(400).json({ success: false, message: 'classId, date, period et presences sont requis' });
      return;
    }

    let resultat: { enregistrees: number; absents: string[]; retards: string[] };
    try {
      // Mapper EXCUSED → ABSENT_JUSTIFIED (le frontend enseignant peut envoyer EXCUSED)
      const normalizeStatus = (s: string): AttendanceStatus => {
        if (s === 'EXCUSED') return 'ABSENT_JUSTIFIED';
        return s as AttendanceStatus;
      };

      resultat = await this.enregistrerPresence.execute({
        schoolId: user.schoolId,
        classId,
        academicPeriodId,
        subjectId,
        teacherId: user.userId,
        recordedById: user.userId,
        date: new Date(date),
        period: period as AttendancePeriod,
        presences: presences.map((p: any) => ({
          studentId: p.studentId,
          statut: normalizeStatus(p.statut),
        })),
        isOfflineSync: isOfflineSync ?? false,
      });
    } catch (error) {
      journaliserActionIA(prisma, {
        // Route bulk (toute une classe en un appel) — pas un miroir exact de l'action copilot
        // `marquer_absence_eleve` (un seul élève), donc son propre actionName, pas partagé.
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'enregistrer_presences_classe', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      if (error instanceof Error) {
        if (error.message.includes('déjà été enregistrées')) {
          res.status(409).json({ success: false, message: error.message });
          return;
        }
        if (error.message.includes('future')) {
          res.status(400).json({ success: false, message: error.message });
          return;
        }
      }
      next(error);
      return;
    }
    journaliserActionIA(prisma, {
      actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
      actionName: 'enregistrer_presences_classe', targetType: 'Class', targetId: classId,
      origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId, date, period, count: presences.length },
    });

    res.status(201).json({ success: true, data: resultat });

    // Fire-and-forget SMS — proprement hors du try/catch, réponse déjà envoyée
    if (resultat.absents.length > 0) {
      const schoolId = user.schoolId as string
      const dateObj = new Date(date)
      const absentIds = resultat.absents
      void (async () => {
        try {
          const students = await prisma.user.findMany({
            where: { id: { in: absentIds } },
            select: { id: true, firstName: true, lastName: true },
          })
          const subjectName = subjectId
            ? (await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } }))?.name
            : undefined
          await Promise.all(
            students.map(async (s) => {
              const studentName = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()
              const dateStr = dateObj.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              const { phonesSansPush } = await notifierParentsPushDabord({
                schoolId, studentId: s.id, type: 'ABSENCE_ALERT',
                titre: 'Absence signalée',
                corps: `${studentName} a été marqué(e) absent(e) le ${dateStr}${subjectName ? ` en ${subjectName}` : ''}.`,
              })
              return notifyAbsenceSms({
                schoolId,
                studentId: s.id,
                studentName,
                date: dateObj,
                subjectName,
                phones: phonesSansPush,
              })
            }),
          )
        } catch (err) {
          console.error('[SMS Attendance fire-and-forget]', err)
        }
      })()
    }
  };

  // GET /api/v2/attendance
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const schoolId: string = user.schoolId;
      const role: string = (user.role as string).toUpperCase();
      const userId: string = user.userId;

      const page = Math.max(1, Number(req.query.page || 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
      const classId = req.query.classId as string | undefined;
      const studentId = req.query.studentId as string | undefined;
      const date = req.query.date as string | undefined;

      const where: any = { schoolId };
      if (classId) where.classId = classId;
      if (date) where.date = { gte: startOfDayUtc(date), lte: endOfDayUtc(date) };

      if (role === 'STUDENT') {
        where.studentId = userId;
      } else if (role === 'PARENT') {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId },
          include: { children: { include: { studentProfile: true } } },
        });
        const childIds = (parentProfile?.children ?? [])
          .map((c) => c.studentProfile?.userId)
          .filter((id): id is string => Boolean(id));
        if (childIds.length === 0) {
          res.json({ records: [], pagination: { total: 0, page, pages: 0, limit } });
          return;
        }
        where.studentId = studentId && childIds.includes(studentId) ? studentId : { in: childIds };
      } else if (studentId) {
        where.studentId = studentId;
      }

      const [total, records] = await Promise.all([
        prisma.attendance.count({ where }),
        prisma.attendance.findMany({
          where,
          include: { class: true },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const studentIds = [...new Set(records.map((r) => r.studentId))];
      const recorderIds = [...new Set(records.map((r) => r.recordedById).filter((id): id is string => Boolean(id)))];

      const [students, recorders] = await Promise.all([
        prisma.user.findMany({
          where: { schoolId, id: { in: studentIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        }),
        recorderIds.length
          ? prisma.user.findMany({
              where: { schoolId, id: { in: recorderIds } },
              select: { id: true, firstName: true, lastName: true, role: true },
            })
          : Promise.resolve([]),
      ]);

      const studentMap = new Map(students.map((s) => [s.id, { ...s, name: `${s.firstName} ${s.lastName}`.trim() }]));
      const recorderMap = new Map(recorders.map((u) => [u.id, { ...u, name: `${u.firstName} ${u.lastName}`.trim() }]));

      res.json({
        records: records.map((r) => ({
          ...r,
          student: studentMap.get(r.studentId) ?? null,
          markedBy: r.recordedById ? (recorderMap.get(r.recordedById) ?? null) : null,
        })),
        pagination: { total, page, pages: Math.ceil(total / limit), limit },
      });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v2/attendance/:id/justify
  justifierAbsence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const role: string = (user.role as string).toUpperCase();
      const schoolId: string = user.schoolId;
      const attendanceId = req.params.id as string;
      const { justification } = req.body;

      if (role !== 'ADMIN' && role !== 'STAFF') {
        res.status(403).json({ success: false, message: 'Seuls les administrateurs et le personnel peuvent justifier une absence' });
        return;
      }

      const record = await prisma.attendance.findFirst({ where: { id: attendanceId, schoolId } });
      if (!record) {
        res.status(404).json({ success: false, message: 'Enregistrement introuvable' });
        return;
      }
      if (record.status !== 'ABSENT') {
        res.status(400).json({ success: false, message: 'Seules les absences peuvent être justifiées' });
        return;
      }

      const updated = await prisma.attendance.update({
        where: { id: attendanceId },
        data: {
          status: 'ABSENT_JUSTIFIED',
          justification,
          justifiedById: user.userId,
          justifiedAt: new Date(),
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          class: { select: { id: true, name: true } },
        },
      });

      journaliserActionIA(prisma, {
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'justifier_absence', targetType: 'Attendance', targetId: attendanceId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { attendanceId, justification },
      });
      res.json({ success: true, message: 'Absence justifiée', record: updated });
    } catch (error) {
      const user = req.user;
      journaliserActionIA(prisma, {
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'justifier_absence', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      next(error);
    }
  };

  // GET /api/v2/attendance/stats
  statistiques = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const schoolId: string = user.schoolId;
      const role: string = (user.role as string).toUpperCase();
      const userId: string = user.userId;

      const classId = req.query.classId as string | undefined;
      const studentId = req.query.studentId as string | undefined;
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      const where: any = {
        schoolId,
        ...(classId ? { classId } : {}),
        ...(studentId ? { studentId } : {}),
      };

      if (from || to) {
        where.date = {
          ...(from ? { gte: startOfDayUtc(from) } : {}),
          ...(to ? { lte: endOfDayUtc(to) } : {}),
        };
      }

      if (role === 'STUDENT') {
        where.studentId = userId;
      } else if (role === 'PARENT') {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId },
          include: { children: { include: { studentProfile: true } } },
        });
        const childIds = (parentProfile?.children ?? [])
          .map((c) => c.studentProfile?.userId)
          .filter((id): id is string => Boolean(id));
        if (childIds.length === 0) {
          res.json({ stats: { total: 0, present: 0, absent: 0, late: 0, attendanceRate: '0%' } });
          return;
        }
        where.studentId = { in: childIds };
      }

      const [total, present, absent, late] = await Promise.all([
        prisma.attendance.count({ where }),
        prisma.attendance.count({ where: { ...where, status: 'PRESENT' } }),
        prisma.attendance.count({ where: { ...where, status: 'ABSENT' } }),
        prisma.attendance.count({ where: { ...where, status: 'LATE' } }),
      ]);

      res.json({
        stats: {
          total,
          present,
          absent,
          late,
          attendanceRate: total ? `${Math.round(((present + late) / total) * 100)}%` : '0%',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
