import { type Request, type Response } from "express";
import PDFDocument from "pdfkit";
import { prisma } from "../config/prisma.ts";
import { inngest } from "../inngest/index.ts";
import { getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { getLegalNotice, isOfficialBulletin, resolveUserLanguage } from "../utils/languageHelper.ts";
import { getTemplateLabels } from "../utils/reportCardTemplates.ts";
import { logActivity } from "../utils/activitieslog.ts";

type GradeRow = {
  value: number;
  maxValue: number;
  coefficient: number;
  comment?: string | null;
  subject: { name: string; code: string | null; coefficient: number };
};

const getPeriodLabel = (period: string, calendarType: "trimester" | "semester", language: "fr" | "en") => {
  const labels = {
    fr: {
      trimester: { term1: "Trimestre 1", term2: "Trimestre 2", term3: "Trimestre 3", annual: "Annuel" },
      semester: { term1: "Semestre 1", term2: "Semestre 2", term3: "Semestre 3", annual: "Annuel" },
    },
    en: {
      trimester: { term1: "Term 1", term2: "Term 2", term3: "Term 3", annual: "Annual" },
      semester: { term1: "Semester 1", term2: "Semester 2", term3: "Semester 3", annual: "Annual" },
    },
  } as const;

  return labels[language][calendarType][period as keyof typeof labels.fr.trimester] || period;
};

const mentionFromAverage = (average: number) => {
  if (average >= 85) return "Excellent";
  if (average >= 70) return "Very Good";
  if (average >= 55) return "Good";
  if (average >= 40) return "Fair";
  return "Needs Improvement";
};

const computeAverage = (grades: GradeRow[]) => {
  if (!grades.length) return 0;
  const weightedTotal = grades.reduce((sum: number, grade: GradeRow) => {
    const scoreOn20 = grade.maxValue > 0 ? (Number(grade.value) / Number(grade.maxValue)) * 20 : 0;
    return sum + scoreOn20 * Number(grade.coefficient || grade.subject.coefficient || 1);
  }, 0);
  const coefficientTotal = grades.reduce((sum: number, grade: GradeRow) => sum + Number(grade.coefficient || grade.subject.coefficient || 1), 0) || 1;
  return Number(((weightedTotal / coefficientTotal) * 5).toFixed(2));
};

export const triggerReportCardGeneration = async (req: Request, res: Response) => {
  try {
    const { yearId, period, periodId, classId, studentId } = req.body;

    await inngest.send({
      name: "reportcard/generate",
      data: {
        yearId,
        period: period || null,
        periodId: periodId || null,
        classId: classId || null,
        studentId: studentId || null,
      },
    });

    return res.status(202).json({
      message: "Report card generation queued",
      yearId,
      period: period || null,
      periodId: periodId || null,
      classId: classId || null,
      studentId: studentId || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

export const getMyReportCards = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;
    const yearId = req.query.yearId as string | undefined;
    const period = req.query.period as string | undefined;

    const reportCards = await prisma.reportCard.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        studentId: currentUser.userId,
        ...(yearId ? { academicYearId: yearId } : {}),
        ...(period ? { periodName: { contains: period, mode: "insensitive" } } : {}),
      },
      include: { academicYear: true },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ reportCards });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

export const getReportCards = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const yearId = req.query.yearId as string | undefined;
    const period = req.query.period as string | undefined;
    const studentId = req.query.studentId as string | undefined;
    const search = String(req.query.search || "").trim();

    const where: any = {
      ...(schoolId ? { schoolId } : {}),
      ...(yearId ? { academicYearId: yearId } : {}),
      ...(studentId ? { studentId } : {}),
      ...(period ? { periodName: { contains: period, mode: "insensitive" } } : {}),
      ...(search ? { OR: [{ periodName: { contains: search, mode: "insensitive" } }, { mention: { contains: search, mode: "insensitive" } }] } : {}),
    };

    const [total, reportCards] = await Promise.all([
      prisma.reportCard.count({ where }),
      prisma.reportCard.findMany({
        where,
        include: { academicYear: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return res.json({
      reportCards,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

export const downloadReportCardPdf = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const schoolId = currentUser?.schoolId;
    const { schoolName, schoolMotto, schoolLogoUrl, academicCalendarType, preferredLanguage, schoolLanguageMode } =
      await getEffectiveSchoolSettings(schoolId);

    const reportCard = await prisma.reportCard.findFirst({
      where: {
        id: String(req.params.id),
        ...(schoolId ? { schoolId } : {}),
      },
      include: { academicYear: true },
    });

    if (!reportCard) {
      return res.status(404).json({ message: "Report card not found" });
    }

    const parentProfile =
      currentUser.role === "parent"
        ? await prisma.parentProfile.findUnique({
            where: { userId: currentUser.userId },
            include: { children: { include: { studentProfile: true } } },
          })
        : null;

    const isOwnerStudent = currentUser.role === "student" && String(currentUser.userId) === String(reportCard.studentId);
    const isParentOwner = Boolean(parentProfile?.children.some((entry) => entry.studentProfile?.userId === reportCard.studentId));
    if (!isOwnerStudent && !isParentOwner && currentUser.role !== "admin" && currentUser.role !== "teacher") {
      return res.status(403).json({ message: "Not authorized to access this report card" });
    }

    const bulletinLanguage = resolveUserLanguage({
      role: currentUser.role,
      schoolLanguageMode,
      schoolSection: currentUser.schoolSection,
      parentLanguagePreference: currentUser.parentLanguagePreference,
      uiLanguagePreference: currentUser.uiLanguagePreference,
      schoolPreferredLanguage: preferredLanguage,
    });

    const isOfficial = currentUser.role !== "parent" && isOfficialBulletin(currentUser.role);

    const grades = await prisma.grade.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        studentId: reportCard.studentId,
        ...(reportCard.academicYearId ? { academicYearId: reportCard.academicYearId } : {}),
      },
      include: { subject: true },
    });

    const subjectRows = grades.map((grade) => {
      const coefficient = Number(grade.coefficient || grade.subject.coefficient || 1);
      const scoreOn20 = grade.maxValue > 0 ? (Number(grade.value) / Number(grade.maxValue)) * 20 : 0;

      return {
        subjectName: grade.subject.name,
        subjectCode: grade.subject.code || "-",
        coefficient,
        note: Number(grade.value),
        maxScore: Number(grade.maxValue),
        scoreOn20,
        percentage: grade.maxValue > 0 ? Number(((Number(grade.value) / Number(grade.maxValue)) * 100).toFixed(2)) : 0,
        displayGrade: `${Number(grade.value)}/${Number(grade.maxValue)}`,
        weighted: scoreOn20 * coefficient,
        appreciation: grade.comment || "",
      };
    });

    const averagePercentage = computeAverage(grades as GradeRow[]);
    const templateLabels = getTemplateLabels((reportCard as any).templateType || "FR", bulletinLanguage);
    const periodText = String(reportCard.periodName || "").trim() || getPeriodLabel(String((reportCard as any).period || ""), academicCalendarType, bulletinLanguage);
    const filename = `report-card-${reportCard.studentId}-${reportCard.periodName}.pdf`.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const doc = new PDFDocument({ size: "A4", margin: 36 });
    doc.pipe(res);

    if (schoolLogoUrl) {
      try {
        doc.image(schoolLogoUrl, 36, 28, { fit: [64, 64] });
      } catch {
        // Ignore logo rendering failures.
      }
    }

    doc.fontSize(18).text(schoolName, { align: "center" });
    doc.fontSize(10).text(schoolMotto, { align: "center" });
    doc.moveDown();

    doc.fontSize(14).text(templateLabels.title);
    doc.fontSize(11).text(`Student: ${reportCard.studentId}`);
    doc.fontSize(11).text(`Period: ${periodText}`);
    doc.fontSize(11).text(`Average: ${reportCard.generalAverage ?? averagePercentage}%`);
    doc.fontSize(11).text(`Mention: ${reportCard.mention || mentionFromAverage(averagePercentage)}`);
    doc.fontSize(11).text(`Official: ${isOfficial ? "Yes" : "No"}`);
    doc.moveDown();

    doc.fontSize(12).text(templateLabels.detailTitle);
    subjectRows.forEach((row) => {
      doc.fontSize(10).text(`${row.subjectName} (${row.subjectCode}) - ${row.displayGrade}`);
    });

    const legalNotice = getLegalNotice(isOfficial, bulletinLanguage);
    doc.moveDown();
    doc.fontSize(9).text(legalNotice || "", { align: "left" });
    doc.end();

    await logActivity({
      userId: currentUser.userId,
      schoolId,
      action: `Downloaded report card ${reportCard.id}`,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};