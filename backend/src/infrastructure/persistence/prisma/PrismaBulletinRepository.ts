import type { PrismaClient } from '@prisma/client';
import { Bulletin } from '@domain/entities/Bulletin';
import type { BulletinRepository } from '@domain/ports/repositories/BulletinRepository';
import type { BulletinTemplate, ReportCardStatus } from '@domain/types/enums';

export class PrismaBulletinRepository implements BulletinRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Bulletin | null> {
    const data = await this.prisma.reportCard.findUnique({
      where: { id },
      include: { subjectLines: true },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByEleve(studentId: string, academicYearId: string): Promise<Bulletin[]> {
    const data = await this.prisma.reportCard.findMany({
      where: { studentId, academicYearId },
      include: { subjectLines: true },
    });
    return data.map(d => this.toDomain(d));
  }

  async findByEleveEtPeriode(
    studentId: string,
    academicPeriodId: string
  ): Promise<Bulletin | null> {
    const data = await this.prisma.reportCard.findUnique({
      where: { studentId_academicPeriodId: { studentId, academicPeriodId } },
      include: { subjectLines: true },
    });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByClasse(classId: string, academicPeriodId: string): Promise<Bulletin[]> {
    const eleves = await this.prisma.studentProfile.findMany({
      where: { classId },
      select: { userId: true },
    });
    const studentIds = eleves.map(e => e.userId);

    const data = await this.prisma.reportCard.findMany({
      where: { studentId: { in: studentIds }, academicPeriodId },
      include: { subjectLines: true },
    });
    return data.map(d => this.toDomain(d));
  }

  async findBySchool(schoolId: string, academicYearId: string): Promise<Bulletin[]> {
    const data = await this.prisma.reportCard.findMany({
      where: { schoolId, academicYearId },
      include: { subjectLines: true },
    });
    return data.map(d => this.toDomain(d));
  }

  async getMoyennesClasse(
    classId: string,
    academicPeriodId: string
  ): Promise<{ studentId: string; generalAverage: number }[]> {
    const eleves = await this.prisma.studentProfile.findMany({
      where: { classId },
      select: { userId: true },
    });
    const studentIds = eleves.map(e => e.userId);

    const bulletins = await this.prisma.reportCard.findMany({
      where: { studentId: { in: studentIds }, academicPeriodId },
      select: { studentId: true, generalAverage: true },
    });

    return bulletins
      .filter(b => b.generalAverage !== null)
      .map(b => ({ studentId: b.studentId, generalAverage: b.generalAverage! }));
  }

  async save(bulletin: Bulletin): Promise<void> {
    const data = bulletin.toObject();
    await this.prisma.reportCard.create({
      data: {
        id: data.id,
        schoolId: data.schoolId,
        studentId: data.studentId,
        academicYearId: data.academicYearId,
        academicPeriodId: data.academicPeriodId,
        sectionId: data.sectionId,
        template: data.template,
        validationStatus: data.validationStatus,
        generalAverage: data.generalAverage,
        rank: data.rank,
        rankTrimestre1: data.rankTrimestre1,
        rankTrimestre2: data.rankTrimestre2,
        rankTrimestre3: data.rankTrimestre3,
        totalStudents: data.totalStudents,
        mention: data.mention,
        absenceCount: data.absenceCount,
        classMasterComment: data.classMasterComment,
        conductGrade: data.conductGrade,
        aiComment: data.aiComment,
        isGenerated: data.isGenerated,
        pdfUrl: data.pdfUrl,
        createdAt: data.createdAt,
        subjectLines: {
          create: data.lignesMatiere.map(l => ({
            id: l.id,
            subjectId: l.subjectId,
            subjectName: l.subjectName,
            coefficient: l.coefficient,
            seq1Score: l.seq1Score,
            seq2Score: l.seq2Score,
            compositionScore: l.compositionScore,
            classTestScore: l.classTestScore,
            terminalExamScore: l.terminalExamScore,
            theoreticalScore: l.theoreticalScore,
            practicalScore: l.practicalScore,
            professionalAttitude: l.professionalAttitude,
            oralScore: l.oralScore,
            selfDevelopmentScore: l.selfDevelopmentScore,
            subjectAverage: l.subjectAverage,
            weightedScore: l.weightedScore,
            subjectRank: l.subjectRank,
            teacherComment: l.teacherComment,
            competenceLabel: l.competenceLabel,
          })),
        },
      },
    });
  }

  async update(bulletin: Bulletin): Promise<void> {
    const data = bulletin.toObject();
    await this.prisma.reportCard.update({
      where: { id: data.id },
      data: {
        validationStatus: data.validationStatus,
        generalAverage: data.generalAverage,
        rank: data.rank,
        mention: data.mention,
        absenceCount: data.absenceCount,
        classMasterComment: data.classMasterComment,
        conductGrade: data.conductGrade,
        aiComment: data.aiComment,
        isGenerated: data.isGenerated,
        pdfUrl: data.pdfUrl,
      },
    });
  }

  async updatePdfUrl(bulletinId: string, pdfUrl: string): Promise<void> {
    await this.prisma.reportCard.update({
      where: { id: bulletinId },
      data: { pdfUrl, isGenerated: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.reportCard.delete({ where: { id } });
  }

  private toDomain(data: any): Bulletin {
    return Bulletin.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      studentId: data.studentId,
      academicYearId: data.academicYearId,
      academicPeriodId: data.academicPeriodId,
      sectionId: data.sectionId ?? undefined,
      template: data.template as BulletinTemplate,
      validationStatus: data.validationStatus as ReportCardStatus,
      generalAverage: data.generalAverage ?? undefined,
      rank: data.rank ?? undefined,
      rankTrimestre1: data.rankTrimestre1 ?? undefined,
      rankTrimestre2: data.rankTrimestre2 ?? undefined,
      rankTrimestre3: data.rankTrimestre3 ?? undefined,
      totalStudents: data.totalStudents ?? undefined,
      mention: data.mention ?? undefined,
      absenceCount: data.absenceCount,
      classMasterComment: data.classMasterComment ?? undefined,
      conductGrade: data.conductGrade ?? undefined,
      aiComment: data.aiComment ?? undefined,
      isGenerated: data.isGenerated,
      pdfUrl: data.pdfUrl ?? undefined,
      createdAt: data.createdAt,
      lignesMatiere: (data.subjectLines ?? []).map((l: any) => ({
        id: l.id,
        subjectId: l.subjectId,
        subjectName: l.subjectName,
        coefficient: l.coefficient,
        seq1Score: l.seq1Score ?? undefined,
        seq2Score: l.seq2Score ?? undefined,
        compositionScore: l.compositionScore ?? undefined,
        seq3Score: l.seq3Score ?? undefined,
        seq4Score: l.seq4Score ?? undefined,
        seq5Score: l.seq5Score ?? undefined,
        seq6Score: l.seq6Score ?? undefined,
        classTestScore: l.classTestScore ?? undefined,
        terminalExamScore: l.terminalExamScore ?? undefined,
        theoreticalScore: l.theoreticalScore ?? undefined,
        practicalScore: l.practicalScore ?? undefined,
        professionalAttitude: l.professionalAttitude ?? undefined,
        oralScore: l.oralScore ?? undefined,
        selfDevelopmentScore: l.selfDevelopmentScore ?? undefined,
        subjectAverage: l.subjectAverage ?? undefined,
        weightedScore: l.weightedScore ?? undefined,
        subjectRank: l.subjectRank ?? undefined,
        teacherComment: l.teacherComment ?? undefined,
        competenceLabel: l.competenceLabel ?? undefined,
      })),
    });
  }
}
