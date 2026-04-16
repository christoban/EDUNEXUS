import { type Request, type Response } from "express";
import PDFDocument from "pdfkit";
import ReportCard from "../models/reportCard.ts";
import { inngest } from "../inngest/index.ts";
import Class from "../models/class.ts";
import User from "../models/user.ts";
import Subject from "../models/subject.ts";
import Exam from "../models/exam.ts";
import Grade from "../models/grade.ts";
import { getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { getLegalNotice, isOfficialBulletin, resolveUserLanguage } from "../utils/languageHelper.ts";

const getPeriodLabel = (
  period: string,
  calendarType: "trimester" | "semester",
  language: "fr" | "en"
) => {
  const labelsFrTrimester: Record<string, string> = {
    term1: "Trimestre 1",
    term2: "Trimestre 2",
    term3: "Trimestre 3",
    annual: "Annuel",
  };

  const labelsFrSemester: Record<string, string> = {
    term1: "Semestre 1",
    term2: "Semestre 2",
    term3: "Semestre 3",
    annual: "Annuel",
  };

  const labelsEnTrimester: Record<string, string> = {
    term1: "Term 1",
    term2: "Term 2",
    term3: "Term 3",
    annual: "Annual",
  };

  const labelsEnSemester: Record<string, string> = {
    term1: "Semester 1",
    term2: "Semester 2",
    term3: "Semester 3",
    annual: "Annual",
  };

  const isFr = language === "fr";
  const isSemester = calendarType === "semester";

  const labels = isFr
    ? isSemester
      ? labelsFrSemester
      : labelsFrTrimester
    : isSemester
      ? labelsEnSemester
      : labelsEnTrimester;

  return labels[period] || period;
};

const mentionFromAverage = (average: number) => {
  if (average >= 85) return "Excellent";
  if (average >= 70) return "Very Good";
  if (average >= 55) return "Good";
  if (average >= 40) return "Fair";
  return "Needs Improvement";
};

const formatXaf = (value: number) =>
  new Intl.NumberFormat("fr-CM", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(value || 0);

export const triggerReportCardGeneration = async (req: Request, res: Response) => {
  try {
    const { yearId, period, classId, studentId } = req.body;

    await inngest.send({
      name: "reportcard/generate",
      data: {
        yearId,
        period,
        classId: classId || null,
        studentId: studentId || null,
      },
    });

    return res.status(202).json({
      message: "Report card generation queued",
      yearId,
      period,
      classId: classId || null,
      studentId: studentId || null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

// Student view
export const getMyReportCards = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const yearId = req.query.yearId as string | undefined;
    const period = req.query.period as string | undefined;

    const query: any = { student: currentUser._id };
    if (yearId) query.year = yearId;
    if (period) query.period = period;

    const reportCards = await ReportCard.find(query)
      .populate("year", "name fromYear toYear")
      .populate({
        path: "grades",
        populate: [
          {
            path: "subject",
            select: "name code teacher coefficient",
            populate: { path: "teacher", select: "name" },
          },
          {
            path: "exam",
            select: "title dueDate teacher",
            populate: { path: "teacher", select: "name" },
          },
        ],
      })
      .sort({ createdAt: -1 });

    return res.json({ reportCards });
  } catch (error) {
    return res.status(500).json({ message: "Server Error", error });
  }
};

// Admin/Teacher summary view
export const getReportCards = async (req: Request, res: Response) => {
  try {
    const currentUser = (req as any).user;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const yearId = req.query.yearId as string | undefined;
    const period = req.query.period as string | undefined;
    const studentId = req.query.studentId as string | undefined;
    const search = String(req.query.search || "").trim();

    const query: any = {};
    if (yearId) query.year = yearId;
    if (period) query.period = period;
    if (studentId) query.student = studentId;

    // Teachers can only view report cards for students in their class scope
    if (currentUser.role === "teacher") {
      const teacherSubjectIds = Array.isArray(currentUser.teacherSubject)
        ? currentUser.teacherSubject.map((subjectId: any) => String(subjectId))
        : [];

      if (!teacherSubjectIds.length) {
        return res.json({
          reportCards: [],
          pagination: { total: 0, page, pages: 0, limit },
        });
      }

      const classIds = await Class.find({ subjects: { $in: teacherSubjectIds } })
        .select("_id")
        .lean();

      if (!classIds.length) {
        return res.json({
          reportCards: [],
          pagination: { total: 0, page, pages: 0, limit },
        });
      }

      const studentIds = await User.find({
        role: "student",
        studentClass: { $in: classIds.map((item) => String(item._id)) },
      })
        .select("_id")
        .lean();

      query.student = {
        $in: studentIds.map((student) => student._id),
      };
    }

    if (search) {
      query.$or = [
        { mention: { $regex: search, $options: "i" } },
        { period: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const baseQuery = ReportCard.find(query)
      .populate("year", "name")
      .populate("student", "name email studentClass")
      .populate({
        path: "grades",
        populate: [
          {
            path: "subject",
            select: "name code teacher coefficient",
            populate: { path: "teacher", select: "name" },
          },
          {
            path: "exam",
            select: "title dueDate teacher",
            populate: { path: "teacher", select: "name" },
          },
        ],
      })
      .sort({ createdAt: -1 });

    const [total, reportCards] = await Promise.all([
      ReportCard.countDocuments(query),
      baseQuery.skip(skip).limit(limit),
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
    const {
      schoolName,
      schoolMotto,
      schoolLogoUrl,
      academicCalendarType,
      preferredLanguage,
      schoolLanguageMode,
    } = await getEffectiveSchoolSettings();

    const reportCard = await ReportCard.findById(req.params.id)
      .populate("year", "name fromYear toYear")
      .populate("student", "name email studentClass parentId")
      .populate("grades")
      .lean();

    if (!reportCard) {
      return res.status(404).json({ message: "Report card not found" });
    }

    const currentUser = (req as any).user;
    const isOwnerStudent = currentUser.role === "student" && String(currentUser._id) === String((reportCard as any).student?._id);
    const isParentOwner =
      currentUser.role === "parent" &&
      String((reportCard as any).student?.parentId || "") === String(currentUser._id);

    if (!isOwnerStudent && !isParentOwner && currentUser.role !== "admin" && currentUser.role !== "teacher") {
      return res.status(403).json({ message: "Not authorized to access this report card" });
    }

    let bulletinLanguage = resolveUserLanguage({
      role: currentUser.role,
      schoolLanguageMode,
      schoolSection: currentUser.schoolSection,
      parentLanguagePreference: currentUser.parentLanguagePreference,
      uiLanguagePreference: currentUser.uiLanguagePreference,
      schoolPreferredLanguage: preferredLanguage,
    });
    let isOfficial = isOfficialBulletin(currentUser.role);

    if (currentUser.role === "parent") {
      isOfficial = false;
    } else if (currentUser.role === "student") {
      isOfficial = true;
    }

    const grades = await Grade.find({ _id: { $in: (reportCard as any).grades || [] } })
      .populate({
        path: "subject",
        select: "name code teacher coefficient appreciation",
        populate: { path: "teacher", select: "name" },
      })
      .populate({
        path: "exam",
        select: "title dueDate teacher",
        populate: { path: "teacher", select: "name" },
      })
      .lean();

    const subjectRows = grades.map((grade: any) => {
      const subject = grade.subject as any;
      const exam = grade.exam as any;
      const coefficient = Number(subject?.coefficient || 1);
      const weighted = Number(grade.percentage || 0) * coefficient;
      return {
        subjectName: subject?.name || "Subject",
        subjectCode: subject?.code || "-",
        coefficient,
        note: Number(grade.score || 0),
        maxScore: Number(grade.maxScore || 0),
        percentage: Number(grade.percentage || 0),
        weighted,
        appreciation: subject?.appreciation || "",
        teacherName: exam?.teacher?.name || subject?.teacher?.[0]?.name || "N/A",
      };
    });

    const totalCoef = subjectRows.reduce((sum, row) => sum + row.coefficient, 0) || 1;
    const totalWeighted = subjectRows.reduce((sum, row) => sum + row.weighted, 0);
    const average = Number((totalWeighted / totalCoef).toFixed(2));
    const mention = mentionFromAverage(average);

    const filename = `report-card-${(reportCard as any).student?.name || "student"}-${(reportCard as any).period}.pdf`
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);

    const doc = new PDFDocument({ size: "A4", margin: 36 });
    doc.pipe(res);

    if (schoolLogoUrl) {
      try {
        doc.image(schoolLogoUrl, 36, 28, { fit: [64, 64] });
      } catch {
        // Keep rendering if the logo cannot be loaded from the provided URL/path.
      }
    }

    doc.fontSize(20).fillColor("#0f172a").text(schoolName, 110, 34);
    doc.fontSize(10).fillColor("#475569").text(schoolMotto, 110, 58);
    doc.moveTo(36, 96).lineTo(559, 96).strokeColor("#0f766e").lineWidth(2).stroke();

    doc.moveDown(1.6);
    doc.fillColor("#0f172a").fontSize(18).text(
      bulletinLanguage === "fr" ? "Bulletin Scolaire" : "Report Card",
      { align: "center" }
    );
    doc.fontSize(10).fillColor("#64748b").text(`Periode: ${getPeriodLabel(String((reportCard as any).period || ""), academicCalendarType, bulletinLanguage)}`, {
      align: "center",
    });

    doc.moveDown(1.2);
    doc.fontSize(11).fillColor("#0f172a");
    doc.text(`Eleve: ${(reportCard as any).student?.name || "N/A"}`);
    doc.text(`Classe: ${(reportCard as any).student?.studentClass?.name || (reportCard as any).student?.studentClass || "N/A"}`);
    doc.text(`Annee academique: ${(reportCard as any).year?.name || "N/A"}`);
    doc.text(`Date d'edition: ${new Date().toLocaleDateString("fr-CM")}`);

    doc.moveDown(1);
    doc.fontSize(12).fillColor("#0f172a").text("Détail par matière", { underline: true });

    const startY = doc.y + 8;
    const tableX = 36;
    const widths = [150, 38, 52, 50, 70, 92, 90];
    const headers = ["Matiere", "Coef.", "Note", "Max", "%", "Enseignant", "Total"].map(String);

    let currentY = startY;
    doc.fontSize(9).fillColor("#ffffff");
    doc.rect(tableX, currentY, widths.reduce((a, b) => a + b, 0), 20).fill("#0f766e");
    doc.fillColor("#ffffff");
    let x = tableX + 6;
    headers.forEach((header, index) => {
      const columnWidth = widths[index]!;
      doc.text(header, x, currentY + 6, { width: columnWidth - 8, align: "left" });
      x += columnWidth;
    });

    currentY += 20;
    doc.fillColor("#0f172a");
    subjectRows.forEach((row, index) => {
      const rowHeight = 22;
      doc.rect(tableX, currentY, widths.reduce((a, b) => a + b, 0), rowHeight).strokeColor("#e2e8f0").stroke();
      if (index % 2 === 0) {
        doc.rect(tableX, currentY, widths.reduce((a, b) => a + b, 0), rowHeight).fillOpacity(0.03).fill("#0f766e").fillOpacity(1);
      }
      const values = [
        `${row.subjectName} (${row.subjectCode})`,
        String(row.coefficient),
        String(row.note),
        String(row.maxScore),
        `${row.percentage}%`,
        row.teacherName,
        formatXaf(row.weighted),
      ];
      let cellX = tableX + 6;
      doc.fillColor("#0f172a").fontSize(8.5);
      values.forEach((value, idx) => {
        const columnWidth = widths[idx]!;
        doc.text(value, cellX, currentY + 6, { width: columnWidth - 8, ellipsis: true });
        cellX += columnWidth;
      });
      currentY += rowHeight;
    });

    currentY += 14;
    doc.moveTo(tableX, currentY).lineTo(tableX + widths.reduce((a, b) => a + b, 0), currentY).strokeColor("#cbd5e1").stroke();

    currentY += 14;
    doc.fontSize(11).fillColor("#0f172a");
    doc.text(`Total coefficients: ${totalCoef}`, tableX, currentY);
    doc.text(`Somme ponderee: ${formatXaf(totalWeighted)}`, tableX + 180, currentY);
    doc.text(`Moyenne generale: ${average}%`, tableX + 340, currentY);

    currentY += 24;
    doc.fontSize(11).text(`Mention: ${mention}`, tableX, currentY);
    doc.text(`Total examens: ${subjectRows.length}`, tableX + 180, currentY);
    doc.text(`Decisions: ${reportCard.aggregates?.passedExams || 0} reussis / ${reportCard.aggregates?.failedExams || 0} echec`, tableX + 340, currentY);

    currentY += 28;
    doc.fontSize(11).fillColor("#0f172a").text("Appréciations par matière", tableX, currentY);
    currentY += 14;
    doc.fontSize(9.5).fillColor("#334155");
    const appreciations = subjectRows.filter((row) => row.appreciation).map((row) => `${row.subjectName}: ${row.appreciation}`);
    if (appreciations.length > 0) {
      appreciations.forEach((app) => {
        doc.text(`• ${app}`, tableX, currentY, { width: 520 });
        currentY += 12;
      });
    } else {
      doc.text("Aucune appréciation enregistrée pour cette période.", tableX, currentY);
      currentY += 12;
    }

    currentY += 8;
    doc.fontSize(11).fillColor("#0f172a").text("Observations", tableX, currentY);
    currentY += 14;
    doc.fontSize(10).fillColor("#334155").text(
      `Moyenne calculée à partir des notes disponibles. Le bulletin officiel peut être enrichi avec un coefficient personnalisé par matière si votre établissement le souhaite.`,
      tableX,
      currentY,
      { width: 520 }
    );

    // 🔑 Add legal notice for translated bulletins
    const legalNotice = getLegalNotice(isOfficial, bulletinLanguage);
    if (legalNotice) {
      currentY += 48;
      doc.fontSize(8).fillColor("#64748b").text(legalNotice, tableX, currentY, { width: 520, align: "center" });
      currentY += 16;
    } else {
      currentY += 48;
    }

    doc.text("Signature enseignant principal: ____________________", tableX, currentY);
    doc.text("Signature directeur: ____________________", tableX + 250, currentY);

    doc.end();
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};
