import type { PrismaClient } from '@prisma/client';
import { Presence } from '@domain/entities/Presence';
import type { PresenceRepository, StatistiquesPresence } from '@domain/ports/repositories/PresenceRepository';
import type { AttendanceStatus, AttendancePeriod } from '@domain/types/enums';

export class PrismaPresenceRepository implements PresenceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Presence | null> {
    const data = await this.prisma.attendance.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByEleve(studentId: string, academicPeriodId: string): Promise<Presence[]> {
    const data = await this.prisma.attendance.findMany({
      where: { studentId, academicPeriodId },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByClasse(
    classId: string,
    date: Date,
    period: AttendancePeriod
  ): Promise<Presence[]> {
    const debut = new Date(date);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(date);
    fin.setHours(23, 59, 59, 999);

    const data = await this.prisma.attendance.findMany({
      where: {
        classId,
        period,
        date: { gte: debut, lte: fin },
      },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByClasseEtPeriode(
    classId: string,
    academicPeriodId: string
  ): Promise<Presence[]> {
    const data = await this.prisma.attendance.findMany({
      where: { classId, academicPeriodId },
    });
    return data.map(d => this.toDomain(d));
  }

  async countAbsencesNonJustifiees(
    studentId: string,
    academicPeriodId: string
  ): Promise<number> {
    return this.prisma.attendance.count({
      where: { studentId, academicPeriodId, status: 'ABSENT' },
    });
  }

  async countAbsencesConsecutives(studentId: string): Promise<number> {
    const dernieres = await this.prisma.attendance.findMany({
      where: { studentId },
      orderBy: { date: 'desc' },
      take: 10,
    });

    let consecutives = 0;
    for (const p of dernieres) {
      if (p.status === 'ABSENT') {
        consecutives++;
      } else {
        break;
      }
    }
    return consecutives;
  }

  async getStatistiquesEleve(
    studentId: string,
    academicPeriodId: string
  ): Promise<StatistiquesPresence> {
    const toutes = await this.prisma.attendance.findMany({
      where: { studentId, academicPeriodId },
    });

    const total = toutes.length;
    const presents = toutes.filter(p => p.status === 'PRESENT').length;
    const absents = toutes.filter(p => p.status === 'ABSENT').length;
    const retards = toutes.filter(p => p.status === 'LATE').length;

    return {
      totalJours: total,
      joursPresent: presents,
      joursAbsent: absents,
      joursRetard: retards,
      tauxPresence: total > 0 ? Math.round((presents / total) * 100) : 100,
    };
  }

  async existeDeja(
    studentId: string,
    date: Date,
    period: AttendancePeriod
  ): Promise<boolean> {
    const debut = new Date(date);
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(date);
    fin.setHours(23, 59, 59, 999);

    const count = await this.prisma.attendance.count({
      where: {
        studentId,
        period,
        date: { gte: debut, lte: fin },
      },
    });
    return count > 0;
  }

  async save(presence: Presence): Promise<void> {
    const data = presence.toObject();
    await this.prisma.attendance.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        studentId: data.studentId,
        classId: data.classId,
        academicPeriodId: data.academicPeriodId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        recordedById: data.recordedById,
        date: data.date,
        status: data.status,
        period: data.period,
        isOfflineSync: data.isOfflineSync,
        createdAt: data.createdAt,
      },
    });
  }

  async saveMany(presences: Presence[]): Promise<void> {
    const data = presences.map(p => {
      const obj = p.toObject();
      return {
        id: obj.id,
        schoolId: obj.schoolId,
        studentId: obj.studentId,
        classId: obj.classId,
        academicPeriodId: obj.academicPeriodId ?? null,
        subjectId: obj.subjectId ?? null,
        teacherId: obj.teacherId ?? null,
        recordedById: obj.recordedById ?? null,
        date: obj.date,
        status: obj.status,
        period: obj.period,
        isOfflineSync: obj.isOfflineSync,
        createdAt: obj.createdAt,
      };
    });
    await this.prisma.attendance.createMany({ data });
  }

  async update(presence: Presence): Promise<void> {
    const data = presence.toObject();
    await this.prisma.attendance.update({
      where: { id: data.id },
      data: {
        status: data.status,
        isOfflineSync: data.isOfflineSync,
        syncedAt: data.syncedAt ?? null,
      },
    });
  }

  async findPresencesHorsLigneEnAttente(userId: string): Promise<Presence[]> {
    const data = await this.prisma.attendance.findMany({
      where: { recordedById: userId, isOfflineSync: true },
    });
    return data.map(d => this.toDomain(d));
  }

  private toDomain(data: any): Presence {
    return Presence.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      studentId: data.studentId,
      classId: data.classId,
      academicPeriodId: data.academicPeriodId ?? undefined,
      subjectId: data.subjectId ?? undefined,
      teacherId: data.teacherId ?? undefined,
      recordedById: data.recordedById ?? undefined,
      date: data.date,
      status: data.status as AttendanceStatus,
      period: data.period as AttendancePeriod,
      isOfflineSync: data.isOfflineSync,
      syncedAt: data.syncedAt ?? undefined,
      createdAt: data.createdAt,
    });
  }
}
