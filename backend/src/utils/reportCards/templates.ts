import PDFDocument from "pdfkit";
import { drawBulletinHeader, drawBulletinFooter, getMentionFr, getMentionEn } from "./helpers.ts";

type SubjectLine = {
  subjectName: string;
  coefficient: number;
  seq1Score?: number | null;
  seq2Score?: number | null;
  compositionScore?: number | null;
  seq3Score?: number | null;
  seq4Score?: number | null;
  seq5Score?: number | null;
  seq6Score?: number | null;
  classTestScore?: number | null;
  terminalExamScore?: number | null;
  theoreticalScore?: number | null;
  practicalScore?: number | null;
  professionalAttitude?: number | null;
  oralScore?: number | null;
  selfDevelopmentScore?: number | null;
  subjectAverage?: number | null;
  teacherComment?: string | null;
  competenceLabel?: string | null;
};

type BulletinData = {
  schoolName: string;
  schoolMotto?: string;
  logoUrl?: string;
  studentName: string;
  className: string;
  periodName: string;
  yearName: string;
  generalAverage: number;
  rank?: number | null;
  totalStudents?: number | null;
  absenceCount?: number;
  mention: string;
  classMasterComment?: string | null;
  subjectLines: SubjectLine[];
  isOfficial?: boolean;
};

// ─── Helper : finalise un PDFDocument et retourne le Buffer ──────
function finalizePdf(
  doc: InstanceType<typeof PDFDocument>,
  build: (doc: InstanceType<typeof PDFDocument>) => void
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
    build(doc);
    doc.end();
  });
}

// ─── COLONNES MATIÈRES (tableau) ─────────────────────────────
const drawSubjectTable = (
  doc: InstanceType<typeof PDFDocument>,
  subjectLines: SubjectLine[],
  columns: { label: string; key: keyof SubjectLine | "average"; width: number }[],
  language: "fr" | "en" = "fr"
) => {
  const colX: number[] = [];
  let x = 36;
  columns.forEach((col) => { colX.push(x); x += col.width; });

  const headerY = doc.y;
  doc.rect(36, headerY, 524, 16).fill("#1e293b");
  columns.forEach((col, i) => {
    doc.fontSize(7).font("Helvetica-Bold").fillColor("white")
      .text(col.label, colX[i] ?? 36, headerY + 4, { width: col.width, align: "center" });
  });
  doc.fillColor("black");
  doc.y = headerY + 18;

  subjectLines.forEach((line, rowIndex) => {
    const rowY = doc.y;
    if (rowIndex % 2 === 0) {
      doc.rect(36, rowY, 524, 15).fill("#f8fafc").stroke("#e2e8f0");
    } else {
      doc.rect(36, rowY, 524, 15).stroke("#e2e8f0");
    }
    doc.fillColor("black");

    columns.forEach((col, i) => {
      const colXi = colX[i] ?? 36;
      if (col.key === "subjectName") {
        doc.fontSize(8).font("Helvetica").text(line.subjectName, colXi + 2, rowY + 3, { width: col.width - 4, ellipsis: true });
      } else if (col.key === "coefficient") {
        doc.fontSize(8).font("Helvetica").text(String(line.coefficient), colXi, rowY + 3, { width: col.width, align: "center" });
      } else if (col.key === "average" || col.key === "subjectAverage") {
        const avg = line.subjectAverage ?? 0;
        const color = avg >= 14 ? "#16a34a" : avg >= 10 ? "#d97706" : "#dc2626";
        doc.fontSize(8).font("Helvetica-Bold").fillColor(color)
          .text(avg > 0 ? avg.toFixed(2) : "—", colXi, rowY + 3, { width: col.width, align: "center" });
        doc.fillColor("black");
      } else {
        const val = line[col.key as keyof SubjectLine];
        const display = (val !== null && val !== undefined && val !== "") ? String(Number(val).toFixed(2)) : "—";
        doc.fontSize(8).font("Helvetica").text(display, colXi, rowY + 3, { width: col.width, align: "center" });
      }
    });
    doc.y = rowY + 16;
  });
};

// ─── TEMPLATE 1 : FR_SECONDARY ───────────────────────────────
export const generateFrSecondaryBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "FR_SECONDARY" });
    drawSubjectTable(d, data.subjectLines, [
      { label: "MATIÈRE", key: "subjectName", width: 150 },
      { label: "COEFF",   key: "coefficient", width: 40  },
      { label: "DS 1",    key: "seq1Score",   width: 50  },
      { label: "DS 2",    key: "seq2Score",   width: 50  },
      { label: "COMPO",   key: "compositionScore", width: 50 },
      { label: "MOY /20", key: "average",     width: 60  },
      { label: "APPRÉCIATION", key: "teacherComment", width: 124 },
    ], "fr");
    drawBulletinFooter(d, {
      generalAverage: data.generalAverage,
      mention: data.mention || getMentionFr(data.generalAverage),
      classMasterComment: data.classMasterComment,
      isOfficial: data.isOfficial,
      language: "fr",
    });
  });
};

// ─── TEMPLATE 2 : EN_SECONDARY ───────────────────────────────
export const generateEnSecondaryBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "EN_SECONDARY" });
    drawSubjectTable(d, data.subjectLines, [
      { label: "SUBJECT",          key: "subjectName",      width: 160 },
      { label: "COEFF",            key: "coefficient",      width: 40  },
      { label: "CLASS TEST",       key: "classTestScore",   width: 65  },
      { label: "EXAM",             key: "terminalExamScore",width: 65  },
      { label: "AVG /20",          key: "average",          width: 60  },
      { label: "TEACHER COMMENT",  key: "teacherComment",   width: 134 },
    ], "en");
    drawBulletinFooter(d, {
      generalAverage: data.generalAverage,
      mention: data.mention || getMentionEn(data.generalAverage),
      classMasterComment: data.classMasterComment,
      isOfficial: data.isOfficial,
      language: "en",
    });
  });
};

// ─── TEMPLATE 3 : TECHNICAL_FR ───────────────────────────────
export const generateTechnicalBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "TECHNICAL_FR" });
    drawSubjectTable(d, data.subjectLines, [
      { label: "MATIÈRE",      key: "subjectName",       width: 150 },
      { label: "COEFF",        key: "coefficient",       width: 35  },
      { label: "EVAL 1",       key: "seq1Score",         width: 45  },
      { label: "EVAL 2",       key: "seq2Score",         width: 45  },
      { label: "THÉORIE",      key: "theoreticalScore",  width: 50  },
      { label: "PRATIQUE",     key: "practicalScore",    width: 50  },
      { label: "MOY /20",      key: "average",           width: 55  },
      { label: "APPRÉCIATION", key: "teacherComment",    width: 94  },
    ], "fr");
    const attitudeLine = data.subjectLines.find((l) => l.professionalAttitude !== null && l.professionalAttitude !== undefined);
    if (attitudeLine?.professionalAttitude !== undefined && attitudeLine.professionalAttitude !== null) {
      d.moveDown(0.3);
      d.fontSize(9).font("Helvetica-Bold")
        .text(`Attitude professionnelle en atelier : ${attitudeLine.professionalAttitude}/20`);
    }
    drawBulletinFooter(d, {
      generalAverage: data.generalAverage,
      mention: data.mention || getMentionFr(data.generalAverage),
      classMasterComment: data.classMasterComment,
      isOfficial: data.isOfficial,
      language: "fr",
    });
  });
};

// ─── TEMPLATE 4 : PRIMARY ────────────────────────────────────
export const generatePrimaryBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "PRIMARY" });
    drawSubjectTable(d, data.subjectLines, [
      { label: "MATIÈRE / COMPÉTENCE", key: "subjectName",          width: 180 },
      { label: "ORAL",                 key: "oralScore",             width: 50  },
      { label: "ÉCRIT",                key: "seq1Score",             width: 50  },
      { label: "SAVOIR-FAIRE",         key: "seq2Score",             width: 65  },
      { label: "SAVOIR-ÊTRE",          key: "selfDevelopmentScore",  width: 65  },
      { label: "TOTAL",                key: "average",               width: 60  },
      { label: "COTE",                 key: "competenceLabel",       width: 54  },
    ], "fr");
    drawBulletinFooter(d, {
      generalAverage: data.generalAverage,
      mention: data.mention || getMentionFr(data.generalAverage),
      classMasterComment: data.classMasterComment,
      isOfficial: data.isOfficial,
      language: "fr",
    });
  });
};

// ─── TEMPLATE 5 : ANNUAL ─────────────────────────────────────
export const generateAnnualBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36, layout: "landscape" });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "ANNUAL" });
    drawSubjectTable(d, data.subjectLines, [
      { label: "MATIÈRE", key: "subjectName",      width: 120 },
      { label: "COEFF",   key: "coefficient",      width: 35  },
      { label: "DS1",     key: "seq1Score",         width: 40  },
      { label: "DS2",     key: "seq2Score",         width: 40  },
      { label: "T1",      key: "compositionScore",  width: 40  },
      { label: "DS3",     key: "seq3Score",         width: 40  },
      { label: "DS4",     key: "seq4Score",         width: 40  },
      { label: "T2",      key: "classTestScore",    width: 40  },
      { label: "DS5",     key: "seq5Score",         width: 40  },
      { label: "DS6",     key: "seq6Score",         width: 40  },
      { label: "T3",      key: "terminalExamScore", width: 40  },
      { label: "MOY AN",  key: "average",           width: 55  },
    ], "fr");
    drawBulletinFooter(d, {
      generalAverage: data.generalAverage,
      mention: data.mention || getMentionFr(data.generalAverage),
      classMasterComment: data.classMasterComment,
      isOfficial: data.isOfficial,
      language: "fr",
    });
  });
};

// ─── TEMPLATE 6 : MONTHLY ────────────────────────────────────
export const generateMonthlyBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "MONTHLY" });
    drawSubjectTable(d, data.subjectLines, [
      { label: "SUBJECT",      key: "subjectName",   width: 180 },
      { label: "TOTAL MARKS",  key: "seq1Score",     width: 80  },
      { label: "OUT OF",       key: "seq2Score",     width: 70  },
      { label: "AVERAGE",      key: "average",       width: 70  },
      { label: "GRADE",        key: "competenceLabel",width: 60 },
      { label: "COMMENT",      key: "teacherComment",width: 64  },
    ], "en");
    drawBulletinFooter(d, {
      generalAverage: data.generalAverage,
      mention: data.mention || getMentionEn(data.generalAverage),
      classMasterComment: data.classMasterComment,
      isOfficial: data.isOfficial,
      language: "en",
    });
  });
};

// ─── DISPATCHER ──────────────────────────────────────────────
export const generateBulletinPdf = (
  template: string,
  data: BulletinData
): Promise<Buffer> => {
  switch (template) {
    case "EN_SECONDARY": return generateEnSecondaryBulletin(data);
    case "TECHNICAL_FR": return generateTechnicalBulletin(data);
    case "PRIMARY":      return generatePrimaryBulletin(data);
    case "ANNUAL":       return generateAnnualBulletin(data);
    case "MONTHLY":      return generateMonthlyBulletin(data);
    default:             return generateFrSecondaryBulletin(data);
  }
};
