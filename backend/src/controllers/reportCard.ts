import { type Request, type Response } from "express";
const archiver = require("archiver");
import { prisma } from "../config/prisma.ts";
import { inngest } from "../inngest/index.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { generateBulletinPdf } from "../utils/reportCards/index.ts";
import { getMentionFr } from "../utils/reportCards/helpers.ts";

const getSchoolId = (req: Request): string => (req as any).user?.schoolId as string;
const getUserId = (req: Request): string => (req as any).user?.userId as string;
const getRole = (req: Request): string => (req as any).user?.role as string;

// ─── VÉRIFICATION PRÉ-GÉNÉRATION ─────────────────────────────

// @route   GET /api/report-cards/check/:classId
// @access  Private (Admin, STAFF)
export const checkReportCardReadiness = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const classId = String(req.params.classId);
    const { sequenceId, periodId } = req.query as { sequenceId?: string; periodId?: string };

    if (!sequenceId && !periodId) {
      return res.status(400).json({ message: "sequenceId ou periodId requis" });
    }

    const grades = await prisma.grade.findMany({
      where: {
        schoolId,
        classId,
        ...(sequenceId ? { sequenceId } : {}),
      },
      select: {
        id: true,
        subjectId: true,
        studentId: true,
        validationStatus: true,
        subject: { select: { name: true } },
        student: { select: { firstName: true, lastName: true } },
      },
    });

    const notValidated = grades.filter(
      (g) => g.validationStatus !== "VALIDATED" && g.validationStatus !== "LOCKED"
    );

    const canGenerate = notValidated.length === 0 && grades.length > 0;

    return res.json({
      canGenerate,
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
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── GÉNÉRER LES BULLETINS D'UNE CLASSE ──────────────────────

// @route   POST /api/report-cards/generate/:classId
// @access  Private (Admin)
export const generateReportCardsForClass = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const classId = String(req.params.classId);
    const { academicYearId, academicPeriodId } = req.body;

    if (!academicYearId || !academicPeriodId) {
      return res.status(400).json({ message: "academicYearId et academicPeriodId requis" });
    }

    const sequences = await prisma.academicSequence.findMany({
      where: { academicPeriodId, schoolId },
      orderBy: { orderIndex: "asc" },
    });

    if (!sequences.length) {
      return res.status(404).json({ message: "Aucune séquence trouvée pour cette période" });
    }

    const sequenceIds = sequences.map((s) => s.id);

    const unvalidated = await prisma.grade.count({
      where: {
        schoolId,
        classId,
        sequenceId: { in: sequenceIds },
        validationStatus: { notIn: ["VALIDATED", "LOCKED"] },
      },
    });

    if (unvalidated > 0) {
      return res.status(409).json({
        message: `${unvalidated} note(s) non validée(s). Validez toutes les notes avant de générer les bulletins.`,
        unvalidatedCount: unvalidated,
      });
    }

    const students = await prisma.studentProfile.findMany({
      where: { classId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, schoolId: true } },
      },
    });

    if (!students.length) {
      return res.status(404).json({ message: "Aucun élève dans cette classe" });
    }

    const schoolClass = await prisma.class.findUnique({
      where: { id: classId },
      include: { school: { include: { schoolConfig: true } } },
    });

    const template = schoolClass?.school?.schoolConfig?.bulletinTemplate ?? "FR_SECONDARY";

    const generated: string[] = [];

    for (const studentProfile of students) {
      const studentId = studentProfile.userId;

      const grades = await prisma.grade.findMany({
        where: {
          schoolId,
          studentId,
          classId,
          academicYearId,
          sequenceId: { in: sequenceIds },
          validationStatus: { in: ["VALIDATED", "LOCKED"] },
        },
        include: { subject: { select: { id: true, name: true, coefficient: true } } },
      });

      if (!grades.length) continue;

      const totalWeighted = grades.reduce((sum, g) => {
        const avg = g.sequenceAverage ?? g.sequenceScore ?? 0;
        return sum + avg * (g.coefficient ?? g.subject.coefficient ?? 1);
      }, 0);
      const totalCoeff = grades.reduce((sum, g) => sum + (g.coefficient ?? g.subject.coefficient ?? 1), 0);
      const generalAverage = totalCoeff > 0 ? Math.round((totalWeighted / totalCoeff) * 100) / 100 : 0;

      const allAverages = await prisma.grade.groupBy({
        by: ["studentId"],
        where: { schoolId, classId, academicYearId, sequenceId: { in: sequenceIds }, validationStatus: { in: ["VALIDATED", "LOCKED"] } },
        _avg: { sequenceAverage: true },
        orderBy: { _avg: { sequenceAverage: "desc" } },
      });
      const rank = allAverages.findIndex((a) => a.studentId === studentId) + 1;
      const totalStudents = allAverages.length;

      const absenceCount = await prisma.attendance.count({
        where: { schoolId, studentId, academicPeriodId, status: { in: ["ABSENT", "LATE"] } },
      });

      const subjectLinesData = grades.map((g) => ({
        subjectId: g.subjectId,
        subjectName: g.subject.name,
        coefficient: g.coefficient ?? g.subject.coefficient ?? 1,
        seq1Score: g.sequenceScore,
        seq2Score: sequences[1] ? (grades.find((g2) => g2.subjectId === g.subjectId && g2.sequenceId === sequences[1]?.id)?.sequenceScore ?? null) : null,
        compositionScore: null,
        theoreticalScore: g.theoreticalScore,
        practicalScore: g.practicalScore,
        professionalAttitude: g.professionalAttitude,
        oralScore: g.oralScore,
        selfDevelopmentScore: g.selfDevelopmentScore,
        subjectAverage: g.sequenceAverage ?? g.sequenceScore ?? 0,
      }));

      const mention = getMentionFr(generalAverage);

      const reportCard = await prisma.reportCard.upsert({
        where: { studentId_academicPeriodId: { studentId, academicPeriodId } },
        create: {
          schoolId,
          studentId,
          academicYearId,
          academicPeriodId,
          generalAverage,
          rank,
          totalStudents,
          mention,
          absenceCount,
          template,
          isGenerated: true,
          validationStatus: "GENERATED",
        },
        update: {
          generalAverage,
          rank,
          totalStudents,
          mention,
          absenceCount,
          isGenerated: true,
          validationStatus: "GENERATED",
        },
      });

      for (const line of subjectLinesData) {
        await prisma.reportCardSubjectLine.upsert({
          where: { reportCardId_subjectId: { reportCardId: reportCard.id, subjectId: line.subjectId } },
          create: { reportCardId: reportCard.id, ...line },
          update: { ...line },
        });
      }

      generated.push(studentId);
    }

    await logActivity({
      userId,
      schoolId,
      action: "Report cards generated",
      details: `Classe ${classId} — période ${academicPeriodId} — ${generated.length} bulletins`,
    });

    return res.json({
      message: `${generated.length} bulletin(s) généré(s)`,
      generated: generated.length,
      classId,
    });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── TÉLÉCHARGER UN BULLETIN PDF ─────────────────────────────

// @route   GET /api/report-cards/:id/pdf
// @access  Private
export const downloadReportCardPdf = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const role = getRole(req);

    const reportCard = await prisma.reportCard.findFirst({
      where: { id: String(req.params.id), schoolId },
      include: {
        academicYear: true,
        academicPeriod: true,
        student: { select: { id: true, firstName: true, lastName: true } },
        subjectLines: {
          include: { subject: { select: { name: true } } },
          orderBy: { subjectName: "asc" },
        },
        school: { include: { schoolConfig: true, schoolSettings: true } },
      },
    });

    if (!reportCard) {
      return res.status(404).json({ message: "Bulletin introuvable" });
    }

    if (role === "student" && reportCard.studentId !== userId) {
      return res.status(403).json({ message: "Non autorisé" });
    }
    if (role === "parent") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId },
        include: { children: { include: { studentProfile: true } } },
      });
      const isParent = parentProfile?.children.some((c) => c.studentProfile?.userId === reportCard.studentId);
      if (!isParent) return res.status(403).json({ message: "Non autorisé" });
    }

    const settings = await getEffectiveSchoolSettings(schoolId);
    const studentName = `${reportCard.student.firstName} ${reportCard.student.lastName}`.trim();
    const className = (reportCard as any).class?.name ?? "—";
    const periodName = reportCard.academicPeriod?.name ?? "—";
    const yearName = reportCard.academicYear?.name ?? "—";
    const template = reportCard.template ?? "FR_SECONDARY";

    const pdfBuffer = generateBulletinPdf(template, {
      schoolName: settings.schoolName ?? reportCard.school?.name ?? "École",
      schoolMotto: settings.schoolMotto ?? "",
      logoUrl: settings.schoolLogoUrl ?? undefined,
      studentName,
      className,
      periodName,
      yearName,
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
      isOfficial: role !== "parent",
    });

    const filename = `bulletin-${studentName.replace(/\s+/g, "-")}-${periodName.replace(/\s+/g, "-")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdfBuffer.length);

    await logActivity({ userId, schoolId, action: `Downloaded report card ${reportCard.id}` });

    return res.end(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── EXPORT PDF EN MASSE (ZIP) ────────────────────────────────

// @route   POST /api/report-cards/export/:classId
// @access  Private (Admin)
export const exportReportCardsZip = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const classId = String(req.params.classId);
    const { academicPeriodId } = req.body;

    if (!academicPeriodId) {
      return res.status(400).json({ message: "academicPeriodId requis" });
    }

    const reportCards = await prisma.reportCard.findMany({
      where: { schoolId, academicPeriodId },
      include: {
        academicYear: true,
        academicPeriod: true,
        student: { select: { id: true, firstName: true, lastName: true } },
        subjectLines: { orderBy: { subjectName: "asc" } },
        school: { include: { schoolConfig: true } },
      },
    });

    if (!reportCards.length) {
      return res.status(404).json({ message: "Aucun bulletin trouvé pour cette classe et cette période" });
    }

    const settings = await getEffectiveSchoolSettings(schoolId);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="bulletins-classe-${academicPeriodId}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res);

    for (const reportCard of reportCards) {
      const studentName = `${reportCard.student.firstName} ${reportCard.student.lastName}`.trim();
      const template = reportCard.template ?? "FR_SECONDARY";

      const pdfBuffer = generateBulletinPdf(template, {
        schoolName: settings.schoolName ?? "École",
        schoolMotto: settings.schoolMotto ?? "",
        logoUrl: settings.schoolLogoUrl ?? undefined,
        studentName,
        className: (reportCard as any).class?.name ?? "—",
        periodName: reportCard.academicPeriod?.name ?? "—",
        yearName: reportCard.academicYear?.name ?? "—",
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

      const filename = `bulletin-${studentName.replace(/\s+/g, "-")}.pdf`;
      archive.append(pdfBuffer, { name: filename });
    }

    await archive.finalize();
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── ENVOYER LES BULLETINS AUX PARENTS ───────────────────────

// @route   POST /api/report-cards/send/:classId
// @access  Private (Admin)
export const sendReportCardsToParents = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const classId = String(req.params.classId);
    const { academicPeriodId } = req.body;

    if (!academicPeriodId) {
      return res.status(400).json({ message: "academicPeriodId requis" });
    }

    const reportCards = await prisma.reportCard.findMany({
      where: { schoolId, academicPeriodId },
      include: {
        academicYear: true,
        academicPeriod: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            studentProfile: {
              include: {
                parents: {
                  include: { parentProfile: { include: { user: { select: { id: true, email: true } } } } },
                },
              },
            },
          },
        },
        subjectLines: { orderBy: { subjectName: "asc" } },
        school: { include: { schoolConfig: true } },
      },
    });

    const settings = await getEffectiveSchoolSettings(schoolId);
    let sent = 0;
    let failed = 0;

    for (const reportCard of reportCards) {
      const studentName = `${reportCard.student.firstName} ${reportCard.student.lastName}`.trim();
      const template = reportCard.template ?? "FR_SECONDARY";

      const pdfBuffer = generateBulletinPdf(template, {
        schoolName: settings.schoolName ?? "École",
        schoolMotto: settings.schoolMotto ?? "",
        studentName,
        className: (reportCard as any).class?.name ?? "—",
        periodName: reportCard.academicPeriod?.name ?? "—",
        yearName: reportCard.academicYear?.name ?? "—",
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
          theoreticalScore: line.theoreticalScore,
          practicalScore: line.practicalScore,
          subjectAverage: line.subjectAverage,
          teacherComment: line.teacherComment,
        })),
        isOfficial: false,
      });

      const parentEmails = reportCard.student.studentProfile?.parents
        .map((p) => p.parentProfile?.user?.email)
        .filter((e): e is string => Boolean(e)) ?? [];

      for (const email of parentEmails) {
        try {
          await sendTransactionalEmail({
            recipientEmail: email,
            subject: `Bulletin de ${studentName} — ${reportCard.academicPeriod?.name}`,
            html: `<p>Bonjour,<br><br>Veuillez trouver ci-joint le bulletin de <b>${studentName}</b> pour la période <b>${reportCard.academicPeriod?.name}</b>.<br><br>Cordialement,<br>${settings.schoolName}</p>`,
            text: `Bulletin de ${studentName} — ${reportCard.academicPeriod?.name}`,
            template: "report_card_available",
            eventType: "report_card_sent",
            attachments: [{ filename: `bulletin-${studentName.replace(/\s+/g, "-")}.pdf`, content: pdfBuffer, contentType: "application/pdf" }],
          });
          sent++;
        } catch {
          failed++;
        }
      }
    }

    await logActivity({
      userId,
      schoolId,
      action: "Report cards sent to parents",
      details: `Classe ${classId} — ${sent} emails envoyés, ${failed} échecs`,
    });

    return res.json({ message: "Bulletins envoyés", sent, failed });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── HISTORIQUE BULLETINS ─────────────────────────────────────

// @route   GET /api/report-cards
// @access  Private
export const getReportCards = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const role = getRole(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Number(req.query.limit) || 10);
    const yearId = req.query.yearId as string | undefined;
    const periodId = req.query.periodId as string | undefined;
    const studentId = req.query.studentId as string | undefined;

    const where: any = { schoolId };
    if (yearId) where.academicYearId = yearId;
    if (periodId) where.academicPeriodId = periodId;

    if (role === "student") {
      where.studentId = userId;
    } else if (role === "parent") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId },
        include: { children: { include: { studentProfile: true } } },
      });
      const childIds = parentProfile?.children.map((c) => c.studentProfile?.userId).filter(Boolean) as string[] ?? [];
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
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      reportCards,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── VUE ÉLÈVE ────────────────────────────────────────────────

// @route   GET /api/report-cards/my
// @access  Private (Student)
export const getMyReportCards = async (req: Request, res: Response) => {
  try {
    const schoolId = getSchoolId(req);
    const userId = getUserId(req);
    const yearId = req.query.yearId as string | undefined;

    const reportCards = await prisma.reportCard.findMany({
      where: {
        schoolId,
        studentId: userId,
        ...(yearId ? { academicYearId: yearId } : {}),
      },
      include: {
        academicYear: true,
        academicPeriod: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ reportCards });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};

// ─── TRIGGER INNGEST ─────────────────────────────────────────

// @route   POST /api/report-cards/generate (via Inngest — async)
// @access  Private (Admin)
export const triggerReportCardGeneration = async (req: Request, res: Response) => {
  try {
    const { yearId, periodId, classId, studentId } = req.body;

    await inngest.send({
      name: "reportcard/generate",
      data: { yearId, periodId: periodId || null, classId: classId || null, studentId: studentId || null },
    });

    return res.status(202).json({ message: "Génération en file d'attente", yearId, periodId, classId });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur", error });
  }
};
