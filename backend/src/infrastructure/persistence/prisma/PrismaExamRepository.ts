import type { PrismaClient } from '@prisma/client';
import type { ExamRepository, ExamUpcoming } from '@domain/ports/repositories/ExamRepository';

export class PrismaExamRepository implements ExamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUpcomingBySubjects(schoolId: string, subjectIds: string[]): Promise<ExamUpcoming[]> {
    if (subjectIds.length === 0) return [];
    const exams = await this.prisma.exam.findMany({
      where: { schoolId, subjectId: { in: subjectIds }, scheduledAt: { gte: new Date() } },
      select: { id: true, subjectId: true, classId: true },
    });
    return exams as ExamUpcoming[];
  }

  async findBySchool(schoolId: string): Promise<ExamUpcoming[]> {
    const exams = await this.prisma.exam.findMany({
      where: { schoolId },
      select: { id: true, subjectId: true, classId: true },
    });
    return exams as ExamUpcoming[];
  }
}
