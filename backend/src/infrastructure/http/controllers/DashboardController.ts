import type { PrismaClient } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import { getClasseActuelleEleve } from '@application/shared/studentEnrollment';

const formatPercent = (n: number, d: number) =>
  d ? `${Math.round((n / d) * 100)}%` : '0%';

const getTodayIndex = () => new Date().getDay();

export class DashboardController {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const schoolId = user.schoolId;

      const recentActivities = await this.prisma.activitiesLog.findMany({
        where: {
          ...(schoolId ? { schoolId } : {}),
          ...(user.role !== 'ADMIN' ? { userId: user.userId } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

      const formattedActivity = recentActivities.map(
        (log) => `${log.action} (${new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
      );

      let stats: any = {};

      if (user.role === 'ADMIN') {
        const [totalStudents, totalTeachers, presentAttendance, totalAttendance] =
          await Promise.all([
            this.prisma.user.count({ where: { ...(schoolId ? { schoolId } : {}), role: 'STUDENT' } }),
            this.prisma.user.count({ where: { ...(schoolId ? { schoolId } : {}), role: 'TEACHER' } }),
            this.prisma.attendance.count({ where: { ...(schoolId ? { schoolId } : {}), status: { in: ['PRESENT', 'LATE'] } } }),
            this.prisma.attendance.count({ where: { ...(schoolId ? { schoolId } : {}) } }),
          ]);
        stats = { totalStudents, totalTeachers, avgAttendance: formatPercent(presentAttendance, totalAttendance), recentActivity: formattedActivity };

      } else if (user.role === 'TEACHER') {
        const teacherProfile = await this.prisma.teacherProfile.findUnique({
          where: { userId: user.userId },
          include: { teacherSubjects: true },
        });
        const subjectIds = (teacherProfile?.teacherSubjects || []).map((ts) => ts.subjectId);
        const myClasses = await this.prisma.class.findMany({
          where: { ...(schoolId ? { schoolId } : {}) },
          select: { id: true, name: true },
        });
        const todaySlots = await this.prisma.timetableSlot.findMany({
          where: { dayOfWeek: getTodayIndex(), teacherId: user.userId },
          include: { timetable: { include: { class: true } }, subject: true },
          orderBy: { startTime: 'asc' },
        });
        const nextClass = todaySlots[0]
          ? `${todaySlots[0].subject?.name} - ${todaySlots[0].timetable?.class?.name}`
          : 'Aucun cours aujourd\'hui';

        stats = { myClassesCount: myClasses.length, myClassNames: myClasses.map((c) => c.name), nextClass, recentActivity: formattedActivity };

      } else if (user.role === 'STUDENT') {
        const classeActuelle = await getClasseActuelleEleve(this.enrollmentRepository, user.userId);
        const [presenceCount, totalPresence, grades] = await Promise.all([
          this.prisma.attendance.count({ where: { studentId: user.userId, status: { in: ['PRESENT', 'LATE'] } } }),
          this.prisma.attendance.count({ where: { studentId: user.userId } }),
          this.prisma.grade.findMany({
            where: { studentId: user.userId, validationStatus: { in: ['VALIDATED', 'LOCKED'] } },
            select: { sequenceAverage: true },
            take: 10,
          }),
        ]);
        const avgGrade = grades.length ? (grades.reduce((s, g) => s + (g.sequenceAverage ?? 0), 0) / grades.length).toFixed(1) : 'N/A';
        stats = { className: classeActuelle?.className || 'Non assigné', avgAttendance: formatPercent(presenceCount, totalPresence), avgGrade, recentActivity: formattedActivity };

      } else if (user.role === 'PARENT') {
        stats = { recentActivity: formattedActivity };
      }

      res.json({ stats });
    } catch (error) {
      next(error);
    }
  };

  getAdminBadges = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { schoolId } = req.user!;
      const [users, classes, pendingGrades, pendingInvoices] = await Promise.all([
        this.prisma.user.count({ where: { schoolId } }),
        this.prisma.class.count({ where: { schoolId } }),
        this.prisma.grade.count({ where: { schoolId, validationStatus: 'SUBMITTED' } }),
        this.prisma.invoice.count({ where: { schoolId, status: { in: ['PENDING', 'OVERDUE'] } } }),
      ]);
      res.json({ success: true, data: { users, classes, pendingGrades, pendingInvoices } });
    } catch (error) {
      next(error);
    }
  };
}
