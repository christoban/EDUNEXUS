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

  // En-têtes colonnes
  const headerY = doc.y;
  doc.rect(36, headerY, 524, 16).fill("#1e293b");
  columns.forEach((col, i) => {
    doc.fontSize(7).font("Helvetica-Bold").fillColor("white")
      .text(col.label, colX[i] ?? 36, headerY + 4, { width: col.width, align: "center" });
  });
  doc.fillColor("black");
  doc.y = headerY + 18;

  // Lignes matières
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
export const generateFrSecondaryBulletin = (data: BulletinData): Buffer => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  drawBulletinHeader(doc, { ...data, template: "FR_SECONDARY" });

  const columns = [
    { label: "MATIÈRE", key: "subjectName" as keyof SubjectLine, width: 150 },
    { label: "COEFF", key: "coefficient" as keyof SubjectLine, width: 40 },
    { label: "DS 1", key: "seq1Score" as keyof SubjectLine, width: 50 },
    { label: "DS 2", key: "seq2Score" as keyof SubjectLine, width: 50 },
    { label: "COMPO", key: "compositionScore" as keyof SubjectLine, width: 50 },
    { label: "MOY /20", key: "average" as keyof SubjectLine, width: 60 },
    { label: "APPRÉCIATION", key: "teacherComment" as keyof SubjectLine, width: 124 },
  ];

  drawSubjectTable(doc, data.subjectLines, columns, "fr");

  drawBulletinFooter(doc, {
    generalAverage: data.generalAverage,
    mention: data.mention || getMentionFr(data.generalAverage),
    classMasterComment: data.classMasterComment,
    isOfficial: data.isOfficial,
    language: "fr",
  });

  doc.end();
  return Buffer.concat(buffers);
};

// ─── TEMPLATE 2 : EN_SECONDARY ───────────────────────────────
export const generateEnSecondaryBulletin = (data: BulletinData): Buffer => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  drawBulletinHeader(doc, { ...data, template: "EN_SECONDARY" });

  const columns = [
    { label: "SUBJECT", key: "subjectName" as keyof SubjectLine, width: 160 },
    { label: "COEFF", key: "coefficient" as keyof SubjectLine, width: 40 },
    { label: "CLASS TEST", key: "classTestScore" as keyof SubjectLine, width: 65 },
    { label: "EXAM", key: "terminalExamScore" as keyof SubjectLine, width: 65 },
    { label: "AVG /20", key: "average" as keyof SubjectLine, width: 60 },
    { label: "TEACHER COMMENT", key: "teacherComment" as keyof SubjectLine, width: 134 },
  ];

  drawSubjectTable(doc, data.subjectLines, columns, "en");

  drawBulletinFooter(doc, {
    generalAverage: data.generalAverage,
    mention: data.mention || getMentionEn(data.generalAverage),
    classMasterComment: data.classMasterComment,
    isOfficial: data.isOfficial,
    language: "en",
  });

  doc.end();
  return Buffer.concat(buffers);
};

// ─── TEMPLATE 3 : TECHNICAL_FR ───────────────────────────────
export const generateTechnicalBulletin = (data: BulletinData): Buffer => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  drawBulletinHeader(doc, { ...data, template: "TECHNICAL_FR" });

  const columns = [
    { label: "MATIÈRE", key: "subjectName" as keyof SubjectLine, width: 150 },
    { label: "COEFF", key: "coefficient" as keyof SubjectLine, width: 35 },
    { label: "EVAL 1", key: "seq1Score" as keyof SubjectLine, width: 45 },
    { label: "EVAL 2", key: "seq2Score" as keyof SubjectLine, width: 45 },
    { label: "THÉORIE", key: "theoreticalScore" as keyof SubjectLine, width: 50 },
    { label: "PRATIQUE", key: "practicalScore" as keyof SubjectLine, width: 50 },
    { label: "MOY /20", key: "average" as keyof SubjectLine, width: 55 },
    { label: "APPRÉCIATION", key: "teacherComment" as keyof SubjectLine, width: 94 },
  ];

  drawSubjectTable(doc, data.subjectLines, columns, "fr");

  // Attitude professionnelle
  const attitudeLine = data.subjectLines.find((l) => l.professionalAttitude !== null && l.professionalAttitude !== undefined);
  if (attitudeLine?.professionalAttitude !== undefined && attitudeLine.professionalAttitude !== null) {
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica-Bold")
      .text(`Attitude professionnelle en atelier : ${attitudeLine.professionalAttitude}/20`);
  }

  drawBulletinFooter(doc, {
    generalAverage: data.generalAverage,
    mention: data.mention || getMentionFr(data.generalAverage),
    classMasterComment: data.classMasterComment,
    isOfficial: data.isOfficial,
    language: "fr",
  });

  doc.end();
  return Buffer.concat(buffers);
};

// ─── TEMPLATE 4 : PRIMARY ────────────────────────────────────
export const generatePrimaryBulletin = (data: BulletinData): Buffer => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  drawBulletinHeader(doc, { ...data, template: "PRIMARY" });

  const columns = [
    { label: "MATIÈRE / COMPÉTENCE", key: "subjectName" as keyof SubjectLine, width: 180 },
    { label: "ORAL", key: "oralScore" as keyof SubjectLine, width: 50 },
    { label: "ÉCRIT", key: "seq1Score" as keyof SubjectLine, width: 50 },
    { label: "SAVOIR-FAIRE", key: "seq2Score" as keyof SubjectLine, width: 65 },
    { label: "SAVOIR-ÊTRE", key: "selfDevelopmentScore" as keyof SubjectLine, width: 65 },
    { label: "TOTAL", key: "average" as keyof SubjectLine, width: 60 },
    { label: "COTE", key: "competenceLabel" as keyof SubjectLine, width: 54 },
  ];

  drawSubjectTable(doc, data.subjectLines, columns, "fr");

  drawBulletinFooter(doc, {
    generalAverage: data.generalAverage,
    mention: data.mention || getMentionFr(data.generalAverage),
    classMasterComment: data.classMasterComment,
    isOfficial: data.isOfficial,
    language: "fr",
  });

  doc.end();
  return Buffer.concat(buffers);
};

// ─── TEMPLATE 5 : ANNUAL ─────────────────────────────────────
export const generateAnnualBulletin = (data: BulletinData): Buffer => {
  const doc = new PDFDocument({ size: "A4", margin: 36, layout: "landscape" });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  drawBulletinHeader(doc, { ...data, template: "ANNUAL" });

  const columns = [
    { label: "MATIÈRE", key: "subjectName" as keyof SubjectLine, width: 120 },
    { label: "COEFF", key: "coefficient" as keyof SubjectLine, width: 35 },
    { label: "DS1", key: "seq1Score" as keyof SubjectLine, width: 40 },
    { label: "DS2", key: "seq2Score" as keyof SubjectLine, width: 40 },
    { label: "T1", key: "compositionScore" as keyof SubjectLine, width: 40 },
    { label: "DS3", key: "seq3Score" as keyof SubjectLine, width: 40 },
    { label: "DS4", key: "seq4Score" as keyof SubjectLine, width: 40 },
    { label: "T2", key: "classTestScore" as keyof SubjectLine, width: 40 },
    { label: "DS5", key: "seq5Score" as keyof SubjectLine, width: 40 },
    { label: "DS6", key: "seq6Score" as keyof SubjectLine, width: 40 },
    { label: "T3", key: "terminalExamScore" as keyof SubjectLine, width: 40 },
    { label: "MOY AN", key: "average" as keyof SubjectLine, width: 55 },
  ];

  drawSubjectTable(doc, data.subjectLines, columns, "fr");

  drawBulletinFooter(doc, {
    generalAverage: data.generalAverage,
    mention: data.mention || getMentionFr(data.generalAverage),
    classMasterComment: data.classMasterComment,
    isOfficial: data.isOfficial,
    language: "fr",
  });

  doc.end();
  return Buffer.concat(buffers);
};

// ─── TEMPLATE 6 : MONTHLY ────────────────────────────────────
export const generateMonthlyBulletin = (data: BulletinData): Buffer => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  const buffers: Buffer[] = [];
  doc.on("data", (chunk) => buffers.push(chunk));

  drawBulletinHeader(doc, { ...data, template: "MONTHLY" });

  const columns = [
    { label: "SUBJECT", key: "subjectName" as keyof SubjectLine, width: 180 },
    { label: "TOTAL MARKS", key: "seq1Score" as keyof SubjectLine, width: 80 },
    { label: "OUT OF", key: "seq2Score" as keyof SubjectLine, width: 70 },
    { label: "AVERAGE", key: "average" as keyof SubjectLine, width: 70 },
    { label: "GRADE", key: "competenceLabel" as keyof SubjectLine, width: 60 },
    { label: "COMMENT", key: "teacherComment" as keyof SubjectLine, width: 64 },
  ];

  drawSubjectTable(doc, data.subjectLines, columns, "en");

  drawBulletinFooter(doc, {
    generalAverage: data.generalAverage,
    mention: data.mention || getMentionEn(data.generalAverage),
    classMasterComment: data.classMasterComment,
    isOfficial: data.isOfficial,
    language: "en",
  });

  doc.end();
  return Buffer.concat(buffers);
};

// ─── DISPATCHER ──────────────────────────────────────────────
export const generateBulletinPdf = (
  template: string,
  data: BulletinData
): Buffer => {
  switch (template) {
    case "EN_SECONDARY": return generateEnSecondaryBulletin(data);
    case "TECHNICAL_FR": return generateTechnicalBulletin(data);
    case "PRIMARY": return generatePrimaryBulletin(data);
    case "ANNUAL": return generateAnnualBulletin(data);
    case "MONTHLY": return generateMonthlyBulletin(data);
    default: return generateFrSecondaryBulletin(data);
  }
};
