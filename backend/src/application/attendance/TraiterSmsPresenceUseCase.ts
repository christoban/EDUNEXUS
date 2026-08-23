import type { PrismaClient } from '@prisma/client';

/**
 * Use case — Traite un SMS de présence entrant (format PRES#CLASSE#1,0,1,...) envoyé par un
 * enseignant : localise la classe, mappe les présences/absences et crée/maj les enregistrements
 * d'assiduité du jour. Logique métier extraite de l'ancien `services/smsService.ts` (point 7 de
 * l'audit : un service technique ne doit pas contenir d'opérations métier).
 */
export type ParsedAttendance = {
  className: string;
  phoneNumber: string;
  records: { index: number; status: 'PRESENT' | 'ABSENT' }[];
  rawMessage: string;
};

export function parseSMSAttendance(message: string, senderPhone: string): ParsedAttendance | null {
  try {
    const parts = message.trim().toUpperCase().split('#');
    if (parts.length < 3 || parts[0] !== 'PRES') return null;

    const className = parts[1];
    const statusList = parts[2].split(',');

    const records = statusList.map((status, index) => ({
      index,
      status: status.trim() === '1' ? 'PRESENT' as const : 'ABSENT' as const,
    }));

    return {
      className,
      phoneNumber: senderPhone,
      records,
      rawMessage: message,
    };
  } catch {
    return null;
  }
}

export class TraiterSmsPresenceUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(
    message: string,
    senderPhone: string,
    schoolId: string
  ): Promise<{ success: boolean; message: string }> {
    const parsed = parseSMSAttendance(message, senderPhone);

    if (!parsed) {
      return { success: false, message: 'Format SMS invalide. Utilisez: PRES#CLASSE#1,0,1,...' };
    }

    const cls = await this.prisma.class.findFirst({
      where: {
        schoolId,
        name: { contains: parsed.className, mode: 'insensitive' },
      },
      select: { id: true, name: true },
    });

    if (!cls) {
      return { success: false, message: `Classe "${parsed.className}" introuvable` };
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        classId: cls.id,
        status: 'ACTIVE',
        academicYear: { isCurrent: true },
      },
      include: { student: { include: { user: true } } },
      orderBy: { student: { user: { lastName: 'asc' } } },
    });

    const students = enrollments.map((e) => e.student);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const teacher = await this.prisma.user.findFirst({
      where: { schoolId, phone: { contains: senderPhone.replace('237', '') } },
    });

    const attendanceRecords = parsed.records
      .filter((record) => record.index < students.length)
      .map((record) => ({
        schoolId,
        studentId: students[record.index].userId,
        classId: cls.id,
        date: today,
        status: record.status,
        period: 'MORNING' as const,
        recordedById: teacher?.id,
        isOfflineSync: false,
      }));

    for (const record of attendanceRecords) {
      const existing = await this.prisma.attendance.findFirst({
        where: {
          schoolId,
          studentId: record.studentId,
          classId: record.classId,
          date: today,
          period: record.period,
        },
      });

      if (existing) {
        await this.prisma.attendance.update({
          where: { id: existing.id },
          data: {
            status: record.status,
            recordedById: record.recordedById,
            teacherId: teacher?.id ?? null,
          },
        });
      } else {
        await this.prisma.attendance.create({
          data: {
            ...record,
            academicPeriodId: null,
            subjectId: null,
            teacherId: teacher?.id ?? null,
            syncedAt: new Date(),
          },
        });
      }
    }

    return {
      success: true,
      message: `✅ ${attendanceRecords.length} présences enregistrées pour ${cls.name}`,
    };
  }
}