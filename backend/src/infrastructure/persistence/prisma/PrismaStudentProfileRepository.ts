import type { PrismaClient } from '@prisma/client';
import type {
  StudentBulletinOptions,
  StudentProfileRepository,
} from '@domain/ports/repositories/StudentProfileRepository';

export class PrismaStudentProfileRepository implements StudentProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBulletinOptionsByStudentIds(
    studentIds: string[],
  ): Promise<StudentBulletinOptions[]> {
    if (studentIds.length === 0) return [];

    const profiles = await this.prisma.studentProfile.findMany({
      where: {
        userId: { in: studentIds },
      },
      select: {
        userId: true,
        lv2SubjectId: true,
        alevelSubjects: {
          select: {
            subjectId: true,
          },
        },
      },
    });

    return profiles.map((profile) => ({
      studentId: profile.userId,
      lv2SubjectId: profile.lv2SubjectId,
      alevelSubjectIds: profile.alevelSubjects.map(
        (subject) => subject.subjectId,
      ),
    }));
  }
}