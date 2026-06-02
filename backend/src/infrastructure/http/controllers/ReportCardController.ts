import type { Request, Response, NextFunction } from 'express';
import type { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import type { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import { BulletinBloqueError } from '@domain/errors/BulletinBloqueError';
import type { BulletinTemplate } from '@domain/types/enums';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { generateBulletinPdf } from '../../../utils/reportCards/index';
import { getMentionFr } from '../../../utils/reportCards/helpers';
import { getEffectiveSchoolSettings } from '../../../utils/schoolSettings';

export class ReportCardController {
  constructor(
    private readonly generer: GenererBulletinUseCase,
    private readonly envoyer: EnvoyerBulletinsUseCase,
  ) {}

  // POST /api/v2/report-cards/generate
  genererBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { classId, academicPeriodId, academicYearId, template, nomEtablissement, logoUrl } = req.body;

      if (!classId || !academicPeriodId || !academicYearId || !template || !nomEtablissement) {
        res.status(400).json({
          success: false,
          message: 'classId, academicPeriodId, academicYearId, template et nomEtablissement requis',
        });
        return;
      }

      const resultat = await this.generer.execute({
        schoolId: user.schoolId,
        classId,
        academicPeriodId,
        academicYearId,
        template: template as BulletinTemplate,
        nomEtablissement,
        logoUrl,
        demandeurId: user.userId,
      });

      res.json({ success: true, data: resultat });
    } catch (error) {
      if (error instanceof BulletinBloqueError) {
        res.status(422).json({ success: false, message: error.message, notesBloquantes: error.notesBloquantes });
        return;
      }
      next(error);
    }
  };

  // POST /api/v2/report-cards/send
  envoyerBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { classId, academicPeriodId, nomEtablissement, nomPeriode } = req.body;

      if (!classId || !academicPeriodId || !nomEtablissement || !nomPeriode) {
        res.status(400).json({
          success: false,
          message: 'classId, academicPeriodId, nomEtablissement et nomPeriode requis',
        });
        return;
      }

      const resultat = await this.envoyer.execute({ schoolId: user.schoolId, classId, academicPeriodId, nomEtablissement, nomPeriode });
      res.json({ success: true, data: resultat });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/report-cards/check/:classId
  verifierDisponibilite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const classId = req.params.classId as string;
      const sequenceId = req.query.sequenceId as string | undefined;
      const periodId = req.query.periodId as string | undefined;

      if (!sequenceId && !periodId) {
        res.status(400).json({ success: false, message: 'sequenceId ou periodId requis' });
        return;
      }

      const grades = await prisma.grade.findMany({
        where: {
          schoolId: user.schoolId,
          classId,
          ...(sequenceId ? { sequenceId } : {}),
        },
        include: {
          subject: { select: { name: true } },
          student: { select: { firstName: true, lastName: true } },
        },
      }) as any[];

      const notValidated = grades.filter(
        (g) => g.validationStatus !== 'VALIDATED' && g.validationStatus !== 'LOCKED',
      );

      res.json({
        canGenerate: notValidated.length === 0 && grades.length > 0,
        totalGrades: grades.length,
        notValidatedCount: notValidated.length,
        notValidated: notValidated.map((g) => ({
          gradeId: g.id,
          studentName: `${g.student.firstName} ${g.student.lastName}`,
          subjectName: g.subject.name,
          status: g.validationStatus,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  // POST /api/v2/report-cards/export/:classId
  exporterZip = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const { classId } = req.params;
      const { academicPeriodId } = req.body;

      if (!academicPeriodId) {
        res.status(400).json({ success: false, message: 'academicPeriodId requis' });
        return;
      }

      const reportCards = await prisma.reportCard.findMany({
        where: { schoolId: user.schoolId, academicPeriodId },
        include: {
          academicYear: true,
          academicPeriod: true,
          student: { select: { id: true, firstName: true, lastName: true } },
          subjectLines: { orderBy: { subjectName: 'asc' } },
          school: { include: { schoolConfig: true } },
        },
      });

      if (!reportCards.length) {
        res.status(404).json({ success: false, message: 'Aucun bulletin trouvé pour cette classe et cette période' });
        return;
      }

      const settings = await getEffectiveSchoolSettings(user.schoolId);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="bulletins-${classId}-${academicPeriodId}.zip"`);

      // CommonJS interop — archiver ne dispose pas d'exports ESM
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const archiver = require('archiver');
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.pipe(res);

      for (const reportCard of reportCards) {
        const studentName = `${reportCard.student.firstName} ${reportCard.student.lastName}`.trim();
        const template = (reportCard.template ?? 'FR_SECONDARY') as BulletinTemplate;

        const pdfBuffer = generateBulletinPdf(template, {
          schoolName: settings.schoolName ?? 'École',
          schoolMotto: settings.schoolMotto ?? '',
          logoUrl: settings.schoolLogoUrl ?? undefined,
          studentName,
          className: (reportCard as any).class?.name ?? '—',
          periodName: reportCard.academicPeriod?.name ?? '—',
          yearName: reportCard.academicYear?.name ?? '—',
          generalAverage: reportCard.generalAverage ?? 0,
          rank: reportCard.rank,
          totalStudents: reportCard.totalStudents,
          absenceCount: reportCard.absenceCount,
          mention: reportCard.mention ?? getMentionFr(reportCard.generalAverage ?? 0),
          classMasterComment: reportCard.classMasterComment,
          subjectLines: reportCard.subjectLines.map((line) => ({
            subjectName: line.subjectName,
            coefficient: line.coefficient,
            seq1Score: line.seq1Score,
            seq2Score: line.seq2Score,
            compositionScore: line.compositionScore,
            seq3Score: line.seq3Score,
            seq4Score: line.seq4Score,
            seq5Score: line.seq5Score,
            seq6Score: line.seq6Score,
            classTestScore: line.classTestScore,
            terminalExamScore: line.terminalExamScore,
            theoreticalScore: line.theoreticalScore,
            practicalScore: line.practicalScore,
            professionalAttitude: line.professionalAttitude,
            oralScore: line.oralScore,
            selfDevelopmentScore: line.selfDevelopmentScore,
            subjectAverage: line.subjectAverage,
            teacherComment: line.teacherComment,
            competenceLabel: line.competenceLabel,
          })),
          isOfficial: true,
        });

        archive.append(pdfBuffer, { name: `bulletin-${studentName.replace(/\s+/g, '-')}.pdf` });
      }

      await archive.finalize();
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/report-cards/my
  mesBulletins = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const yearId = req.query.yearId as string | undefined;

      const reportCards = await prisma.reportCard.findMany({
        where: {
          schoolId: user.schoolId,
          studentId: user.userId,
          ...(yearId ? { academicYearId: yearId } : {}),
        },
        include: { academicYear: true, academicPeriod: true },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ reportCards });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/report-cards
  lister = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const role: string = (user.role as string).toUpperCase();
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
      const yearId = req.query.yearId as string | undefined;
      const periodId = req.query.periodId as string | undefined;
      const studentId = req.query.studentId as string | undefined;

      const where: any = { schoolId: user.schoolId };
      if (yearId) where.academicYearId = yearId;
      if (periodId) where.academicPeriodId = periodId;

      if (role === 'STUDENT') {
        where.studentId = user.userId;
      } else if (role === 'PARENT') {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId: user.userId },
          include: { children: { include: { studentProfile: true } } },
        });
        const childIds = (parentProfile?.children ?? [])
          .map((c) => c.studentProfile?.userId)
          .filter((id): id is string => Boolean(id));
        where.studentId = studentId && childIds.includes(studentId) ? studentId : { in: childIds };
      } else if (studentId) {
        where.studentId = studentId;
      }

      const [total, reportCards] = await Promise.all([
        prisma.reportCard.count({ where }),
        prisma.reportCard.findMany({
          where,
          include: {
            academicYear: true,
            academicPeriod: true,
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      res.json({ reportCards, pagination: { total, page, pages: Math.ceil(total / limit), limit } });
    } catch (error) {
      next(error);
    }
  };

  // GET /api/v2/report-cards/:id/pdf
  telechargerPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const role: string = (user.role as string).toUpperCase();

      const reportCard = await prisma.reportCard.findFirst({
        where: { id: req.params.id as string, schoolId: user.schoolId },
        include: {
          academicYear: true,
          academicPeriod: true,
          student: { select: { id: true, firstName: true, lastName: true } },
          subjectLines: { orderBy: { subjectName: 'asc' } },
          school: { include: { schoolConfig: true, schoolSettings: true } },
        },
      }) as any;

      if (!reportCard) {
        res.status(404).json({ success: false, message: 'Bulletin introuvable' });
        return;
      }

      if (role === 'STUDENT' && reportCard.studentId !== user.userId) {
        res.status(403).json({ success: false, message: 'Non autorisé' });
        return;
      }
      if (role === 'PARENT') {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId: user.userId },
          include: { children: { include: { studentProfile: true } } },
        });
        const isParent = parentProfile?.children.some((c) => c.studentProfile?.userId === reportCard.studentId);
        if (!isParent) {
          res.status(403).json({ success: false, message: 'Non autorisé' });
          return;
        }
      }

      const settings = await getEffectiveSchoolSettings(user.schoolId);
      const studentName = `${reportCard.student.firstName} ${reportCard.student.lastName}`.trim();
      const periodName = reportCard.academicPeriod?.name ?? '—';
      const template = (reportCard.template ?? 'FR_SECONDARY') as BulletinTemplate;

      const pdfBuffer = generateBulletinPdf(template, {
        schoolName: settings.schoolName ?? reportCard.school?.name ?? 'École',
        schoolMotto: settings.schoolMotto ?? '',
        logoUrl: settings.schoolLogoUrl ?? undefined,
        studentName,
        className: (reportCard as any).class?.name ?? '—',
        periodName,
        yearName: reportCard.academicYear?.name ?? '—',
        generalAverage: reportCard.generalAverage ?? 0,
        rank: reportCard.rank,
        totalStudents: reportCard.totalStudents,
        absenceCount: reportCard.absenceCount,
        mention: reportCard.mention ?? getMentionFr(reportCard.generalAverage ?? 0),
        classMasterComment: reportCard.classMasterComment,
        subjectLines: reportCard.subjectLines.map((line) => ({
          subjectName: line.subjectName,
          coefficient: line.coefficient,
          seq1Score: line.seq1Score,
          seq2Score: line.seq2Score,
          compositionScore: line.compositionScore,
          seq3Score: line.seq3Score,
          seq4Score: line.seq4Score,
          seq5Score: line.seq5Score,
          seq6Score: line.seq6Score,
          classTestScore: line.classTestScore,
          terminalExamScore: line.terminalExamScore,
          theoreticalScore: line.theoreticalScore,
          practicalScore: line.practicalScore,
          professionalAttitude: line.professionalAttitude,
          oralScore: line.oralScore,
          selfDevelopmentScore: line.selfDevelopmentScore,
          subjectAverage: line.subjectAverage,
          teacherComment: line.teacherComment,
          competenceLabel: line.competenceLabel,
        })),
        isOfficial: role !== 'PARENT',
      });

      const filename = `bulletin-${studentName.replace(/\s+/g, '-')}-${periodName.replace(/\s+/g, '-')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  };
}
