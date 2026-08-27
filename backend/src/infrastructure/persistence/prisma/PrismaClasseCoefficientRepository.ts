import type { PrismaClient } from '@prisma/client';
import type {
  ClasseCoefficientRepository,
  ClassSubjectOverrideRecord,
  SubjectCoefficientRecord,
} from '@domain/ports/repositories/ClasseCoefficientRepository';

export class PrismaClasseCoefficientRepository implements ClasseCoefficientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOverride(classId: string, subjectId: string): Promise<ClassSubjectOverrideRecord | null> {
    const data = await this.prisma.classSubjectOverride.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
    });
    return data as ClassSubjectOverrideRecord | null;
  }

  async upsertOverride(params: {
    schoolId: string;
    classId: string;
    subjectId: string;
    coefficient: number;
  }): Promise<ClassSubjectOverrideRecord> {
    const data = await this.prisma.classSubjectOverride.upsert({
      where: { classId_subjectId: { classId: params.classId, subjectId: params.subjectId } },
      create: {
        schoolId: params.schoolId,
        classId: params.classId,
        subjectId: params.subjectId,
        coefficient: params.coefficient,
      },
      update: { coefficient: params.coefficient },
    });
    return data as ClassSubjectOverrideRecord;
  }

  async deleteOverride(classId: string, subjectId: string): Promise<void> {
    await this.prisma.classSubjectOverride.delete({
      where: { classId_subjectId: { classId, subjectId } },
    });
  }

  async upsertCoefficient(params: {
    schoolId: string;
    subjectId: string;
    classLevel: string;
    serieCode: string | null;
    coefficient: number;
  }): Promise<SubjectCoefficientRecord> {
    const data = await this.prisma.subjectCoefficient.upsert({
      where: {
        schoolId_subjectId_classLevel_serieCode: {
          schoolId: params.schoolId,
          subjectId: params.subjectId,
          classLevel: params.classLevel ?? '',
          serieCode: params.serieCode ?? '',
        },
      },
      create: {
        schoolId: params.schoolId,
        subjectId: params.subjectId,
        classLevel: params.classLevel ?? '',
        serieCode: params.serieCode,
        coefficient: params.coefficient,
      },
      update: { coefficient: params.coefficient },
    });
    return data as unknown as SubjectCoefficientRecord;
  }

  async deleteCoefficientsForSubject(params: {
    schoolId: string;
    subjectId: string;
    classLevel: string;
    serieCode: string | null;
  }): Promise<number> {
    const result = await this.prisma.subjectCoefficient.deleteMany({
      where: {
        schoolId: params.schoolId,
        subjectId: params.subjectId,
        classLevel: params.classLevel ?? undefined,
        ...(params.serieCode !== null ? { serieCode: params.serieCode } : { serieCode: null }),
      },
    });
    return result.count;
  }
}
