import type { Request, Response, NextFunction } from 'express';
import type { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import type { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';
import { BulletinBloqueError } from '@domain/errors/BulletinBloqueError';
import type { BulletinTemplate } from '@domain/types/enums';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { notifyBulletinSms } from '@infrastructure/services/SmsNotificationService';
import { generateBulletinPdf } from '../../../utils/reportCards/index';
import { getMention } from '../../../utils/reportCards/helpers';
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
      let { classId, academicPeriodId, academicYearId, template, nomEtablissement, logoUrl } = req.body;

      if (!classId) {
        res.status(400).json({ success: false, message: 'classId requis' });
        return;
      }

      // Auto-détection des paramètres manquants
      if (!academicPeriodId || !academicYearId) {
        const currentYear = await prisma.academicYear.findFirst({
          where: { schoolId: user.schoolId, isCurrent: true },
          include: { periods: { orderBy: { id: 'asc' }, take: 1 } },
        });
        if (!currentYear) {
          res.status(400).json({ success: false, message: 'Aucune année académique courante trouvée' });
          return;
        }
        academicYearId = academicYearId || currentYear.id;
        academicPeriodId = academicPeriodId || currentYear.periods?.[0]?.id;
        if (!academicPeriodId) {
          res.status(400).json({ success: false, message: 'Aucune période académique trouvée' });
          return;
        }
      }
      if (!template) {
        const settings = await getEffectiveSchoolSettings(user.schoolId);
        template = (settings as any)?.bulletinTemplate ?? 'FR_SECONDARY';
      }
      if (!nomEtablissement) {
        const school = await prisma.school.findUnique({ where: { id: user.schoolId }, select: { name: true } });
        nomEtablissement = school?.name ?? 'Établissement';
      }

      // Horodatage capturé AVANT la génération pour filtrer uniquement les nouveaux bulletins
      const generationStartedAt = new Date()

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

      // Fire-and-forget SMS bulletin disponible — hors du try principal
      if (resultat.bulletinsGeneres > 0) {
        const schoolId = user.schoolId as string
        void (async () => {
          try {
            const period = await prisma.academicPeriod.findUnique({
              where: { id: academicPeriodId },
              select: { name: true },
            })
            const periodName = period?.name ?? 'Période'
            const bulletins = await prisma.reportCard.findMany({
              where: { schoolId, academicPeriodId, createdAt: { gte: generationStartedAt } },
              include: { student: { select: { id: true, firstName: true, lastName: true } } },
            })
            await Promise.all(
              bulletins.map((b) =>
                notifyBulletinSms({
                  schoolId,
                  studentId: b.studentId,
                  studentName: `${b.student.firstName ?? ''} ${b.student.lastName ?? ''}`.trim(),
                  periodName,
                }),
              ),
            )
          } catch (err) {
            console.error('[SMS Bulletin fire-and-forget]', err)
          }
        })()
      }
    } catch (error) {
      if (error instanceof BulletinBloqueError) {
        res.status(422).json({ success: false, code: 'NOTES_NON_VALIDEES', message: error.message, notesBloquantes: error.notesBloquantes });
        return;
      }
      if (error instanceof Error && error.message.includes('Conseil de Classe')) {
        res.status(422).json({ success: false, code: 'CONSEIL_REQUIS', message: error.message });
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
      let periodId = req.query.periodId as string | undefined;

      // Auto-détection de la période courante si non fournie
      if (!periodId) {
        const currentYear = await prisma.academicYear.findFirst({
          where: { schoolId: user.schoolId, isCurrent: true },
          include: { periods: { orderBy: { id: 'asc' }, take: 1 } },
        });
        periodId = currentYear?.periods?.[0]?.id;
      }

      if (!periodId) {
        res.status(400).json({ success: false, message: 'Aucune période académique trouvée' });
        return;
      }

      // Séquences rattachées à cette période
      const sequences = await prisma.academicSequence.findMany({
        where: { academicPeriodId: periodId },
        select: { id: true },
      });
      const sequenceIds = sequences.map((s) => s.id);

      const grades = await prisma.grade.findMany({
        where: {
          schoolId: user.schoolId,
          classId,
          ...(sequenceIds.length > 0 ? { sequenceId: { in: sequenceIds } } : {}),
        },
        select: { validationStatus: true },
      });

      const stats = { total: grades.length, VALIDATED: 0, LOCKED: 0, SUBMITTED: 0, DRAFT: 0, REJECTED: 0 };
      for (const g of grades) {
        const s = g.validationStatus as keyof typeof stats;
        if (s in stats) (stats[s] as number)++;
      }

      // Vérifier conseil de classe verrouillé
      const conseilLocked = await prisma.classCouncilSession.findFirst({
        where: { classId, academicPeriodId: periodId, status: 'LOCKED' },
        select: { id: true },
      });

      const allValidated = stats.total > 0 && stats.DRAFT === 0 && stats.SUBMITTED === 0 && stats.REJECTED === 0;
      const canGenerateReportCard = allValidated && !!conseilLocked;

      res.json({
        canGenerateReportCard,
        periodId,
        stats,
        conseilLocked: !!conseilLocked,
        reason: !allValidated
          ? 'Notes non entièrement validées'
          : !conseilLocked
          ? 'Conseil de classe non verrouillé'
          : null,
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

        const pdfBuffer = await generateBulletinPdf(template, {
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
          mention: reportCard.mention ?? getMention(reportCard.generalAverage ?? 0, template),
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

  // PATCH /api/v2/report-cards/:id/comment
  // Réservé au Professeur Principal de la classe du bulletin.
  // Un Admin peut aussi corriger un commentaire.
  ajouterCommentaire = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const role: string = (user.role as string).toUpperCase();
      const { classMasterComment } = req.body;

      if (typeof classMasterComment !== 'string' || !classMasterComment.trim()) {
        res.status(400).json({ success: false, message: 'classMasterComment (string non vide) requis' });
        return;
      }

      const reportCard = await prisma.reportCard.findFirst({
        where: { id: req.params.id as string, schoolId: user.schoolId },
        include: {
          student: { include: { studentProfile: { include: { class: { select: { professorPrincipalId: true } } } } } },
        },
      }) as any;

      if (!reportCard) {
        res.status(404).json({ success: false, message: 'Bulletin introuvable' });
        return;
      }

      // Seul le Professeur Principal de la classe ou un Admin peut écrire le commentaire
      const professorPrincipalId = reportCard.student?.studentProfile?.class?.professorPrincipalId;
      const isPP = professorPrincipalId === user.userId;
      if (role !== 'ADMIN' && !isPP) {
        res.status(403).json({
          success: false,
          message: "Seul le Professeur Principal de cette classe ou un Admin peut écrire ce commentaire",
        });
        return;
      }

      await prisma.reportCard.update({
        where: { id: req.params.id as string },
        data: { classMasterComment: classMasterComment.trim() },
      });

      res.json({ success: true, message: 'Commentaire enregistré' });
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
      const classId = req.query.classId as string | undefined;

      const where: any = { schoolId: user.schoolId };
      if (yearId) where.academicYearId = yearId;
      if (periodId) where.academicPeriodId = periodId;
      if (classId) where.student = { studentProfile: { classId } };

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
          student: { select: { id: true, firstName: true, lastName: true, studentProfile: { select: { class: { select: { name: true } } } } } },
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

      const pdfBuffer = await generateBulletinPdf(template, {
        schoolName: settings.schoolName ?? reportCard.school?.name ?? 'École',
        schoolMotto: settings.schoolMotto ?? '',
        logoUrl: settings.schoolLogoUrl ?? undefined,
        studentName,
        className: reportCard.student?.studentProfile?.class?.name ?? '—',
        periodName,
        yearName: reportCard.academicYear?.name ?? '—',
        generalAverage: reportCard.generalAverage ?? 0,
        rank: reportCard.rank,
        totalStudents: reportCard.totalStudents,
        absenceCount: reportCard.absenceCount,
        mention: reportCard.mention ?? getMention(reportCard.generalAverage ?? 0, template),
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
