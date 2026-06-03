import type { PrismaClient } from '@prisma/client';
import type {
  ExamenRepository,
  ExamenProps,
  SoumissionProps,
} from '@domain/ports/repositories/ExamenRepository';

export class PrismaExamenRepository implements ExamenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<ExamenProps | null> {
    const data = await this.prisma.exam.findUnique({ where: { id } });
    if (!data) return null;
    return this.toProps(data);
  }

  async findByClasse(classId: string, academicYearId: string): Promise<ExamenProps[]> {
    const data = await this.prisma.exam.findMany({
      where: { classId, academicYearId },
    });
    return data.map(d => this.toProps(d));
  }

  async findByEnseignant(teacherId: string, schoolId: string): Promise<ExamenProps[]> {
    const teacherProfile = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
      include: { teacherSubjects: { select: { subjectId: true } } },
    });
    if (!teacherProfile) return [];

    const subjectIds = teacherProfile.teacherSubjects.map(ts => ts.subjectId);
    const data = await this.prisma.exam.findMany({
      where: { schoolId, subjectId: { in: subjectIds } },
    });
    return data.map(d => this.toProps(d));
  }

  async save(examen: ExamenProps): Promise<void> {
    await this.prisma.exam.create({
      data: {
        id: examen.id,
        schoolId: examen.schoolId,
        title: examen.title,
        subjectId: examen.subjectId,
        classId: examen.classId,
        academicYearId: examen.academicYearId,
        scheduledAt: examen.scheduledAt,
        duration: examen.duration,
        content: (examen.content ?? {}) as any,
        isAiGenerated: false,
        createdAt: examen.createdAt,
      },
    });
  }

  async update(examen: ExamenProps): Promise<void> {
    await this.prisma.exam.update({
      where: { id: examen.id },
      data: {
        title: examen.title,
        scheduledAt: examen.scheduledAt ?? null,
        duration: examen.duration ?? null,
        content: (examen.content ?? {}) as any,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.exam.delete({ where: { id } });
  }

  async findSoumission(examId: string, studentId: string): Promise<SoumissionProps | null> {
    const data = await this.prisma.submission.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
    if (!data) return null;
    return {
      id: data.id,
      examId: data.examId,
      studentId: data.studentId,
      schoolId: data.schoolId,
      answers: (data.answers as Record<string, unknown>) ?? undefined,
      score: data.score ?? undefined,
      submittedAt: data.submittedAt,
    };
  }

  async saveSoumission(soumission: SoumissionProps): Promise<void> {
    await this.prisma.submission.create({
      data: {
        id: soumission.id,
        examId: soumission.examId,
        studentId: soumission.studentId,
        schoolId: soumission.schoolId,
        answers: (soumission.answers ?? {}) as any,
        submittedAt: soumission.submittedAt,
      },
    });
  }

  async deleteSoumissions(examId: string): Promise<void> {
    await this.prisma.submission.deleteMany({ where: { examId } });
  }

  private toProps(data: any): ExamenProps {
    const content = data.content as any;
    const isPublished = content?.status === 'published' || false;
    return {
      id: data.id,
      schoolId: data.schoolId,
      title: data.title,
      subjectId: data.subjectId,
      classId: data.classId,
      academicYearId: data.academicYearId,
      scheduledAt: data.scheduledAt ?? undefined,
      duration: data.duration ?? undefined,
      content: (data.content as Record<string, unknown>) ?? undefined,
      isPublished,
      createdAt: data.createdAt,
    };
  }
}
