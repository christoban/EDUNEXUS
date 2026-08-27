import type { PrismaClient } from '@prisma/client';
import type { StaffAttendanceRepository, StaffAttendanceData } from '@domain/ports/repositories/StaffAttendanceRepository';

export class PrismaStaffAttendanceRepository implements StaffAttendanceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(data: { userId: string; schoolId: string; date: Date; statut: string; note?: string }): Promise<StaffAttendanceData> {
    return this.prisma.staffAttendance.upsert({
      where: { userId_date: { userId: data.userId, date: data.date } },
      create: { userId: data.userId, schoolId: data.schoolId, date: data.date, statut: data.statut as any, note: data.note ?? null },
      update: { statut: data.statut as any, note: data.note ?? null },
    });
  }

  async findBySchool(schoolId: string, filters?: { userId?: string; debut?: Date; fin?: Date }): Promise<StaffAttendanceData[]> {
    return this.prisma.staffAttendance.findMany({
      where: { schoolId, ...(filters?.userId ? { userId: filters.userId } : {}), ...(filters?.debut || filters?.fin ? { date: { ...(filters.debut ? { gte: filters.debut } : {}), ...(filters.fin ? { lte: filters.fin } : {}) } } : {}) },
      orderBy: { date: 'desc' },
    });
  }
}
