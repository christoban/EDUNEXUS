import PDFDocument from "pdfkit";
import {
  drawBulletinHeader,
  drawBulletinFooter,
  drawTable,
  getMentionFr,
  getMentionEn,
  getMentionApc,
  type TableColumnDef,
} from "./helpers.ts";

// ─── Types ────────────────────────────────────────────────────
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

// ─── Helper : finalise un PDFDocument → Buffer ────────────────
function finalizePdf(
  doc: InstanceType<typeof PDFDocument>,
  build: (doc: InstanceType<typeof PDFDocument>) => void,
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

// ─── TEMPLATE 1 : FR_SECONDARY ───────────────────────────────
// Portrait A4, tableau à 7 colonnes
// Ratios : 30 + 8 + 10 + 10 + 10 + 12 + 20 = 100
const COLS_FR_SECONDARY: TableColumnDef[] = [
  { label: "MATIÈRE",      key: "subjectName",      ratio: 30, type: "subject"     },
  { label: "COEFF",        key: "coefficient",      ratio:  8, type: "score"       },
  { label: "DS 1",         key: "seq1Score",        ratio: 10, type: "score"       },
  { label: "DS 2",         key: "seq2Score",        ratio: 10, type: "score"       },
  { label: "COMPO",        key: "compositionScore", ratio: 10, type: "score"       },
  { label: "MOY /20",      key: "subjectAverage",   ratio: 12, type: "average"     },
  { label: "APPRÉCIATION", key: "teacherComment",   ratio: 20, type: "text"        },
];

export const generateFrSecondaryBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "FR_SECONDARY" });
    drawTable(d, COLS_FR_SECONDARY, data.subjectLines as Record<string, unknown>[]);
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
// Portrait A4, tableau à 6 colonnes
// Ratios : 30 + 8 + 14 + 14 + 12 + 22 = 100
const COLS_EN_SECONDARY: TableColumnDef[] = [
  { label: "SUBJECT",         key: "subjectName",       ratio: 30, type: "subject"  },
  { label: "COEFF",           key: "coefficient",       ratio:  8, type: "score"    },
  { label: "CLASS TEST",      key: "classTestScore",    ratio: 14, type: "score"    },
  { label: "EXAM",            key: "terminalExamScore", ratio: 14, type: "score"    },
  { label: "AVG /20",         key: "subjectAverage",    ratio: 12, type: "average"  },
  { label: "TEACHER COMMENT", key: "teacherComment",    ratio: 22, type: "text"     },
];

export const generateEnSecondaryBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "EN_SECONDARY" });
    drawTable(d, COLS_EN_SECONDARY, data.subjectLines as Record<string, unknown>[]);
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
// Portrait A4, tableau à 8 colonnes
// Ratios : 28 + 7 + 9 + 9 + 10 + 10 + 11 + 16 = 100
const COLS_TECHNICAL_FR: TableColumnDef[] = [
  { label: "MATIÈRE",      key: "subjectName",      ratio: 28, type: "subject"  },
  { label: "COEFF",        key: "coefficient",      ratio:  7, type: "score"    },
  { label: "EVAL 1",       key: "seq1Score",        ratio:  9, type: "score"    },
  { label: "EVAL 2",       key: "seq2Score",        ratio:  9, type: "score"    },
  { label: "THÉORIE",      key: "theoreticalScore", ratio: 10, type: "score"    },
  { label: "PRATIQUE",     key: "practicalScore",   ratio: 10, type: "score"    },
  { label: "MOY /20",      key: "subjectAverage",   ratio: 11, type: "average"  },
  { label: "APPRÉCIATION", key: "teacherComment",   ratio: 16, type: "text"     },
];

export const generateTechnicalBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "TECHNICAL_FR" });
    drawTable(d, COLS_TECHNICAL_FR, data.subjectLines as Record<string, unknown>[]);

    // Attitude professionnelle — champ spécifique aux filières techniques
    const attitudeLine = data.subjectLines.find(
      (l) => l.professionalAttitude != null,
    );
    if (attitudeLine?.professionalAttitude != null) {
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
// Portrait A4, tableau à 7 colonnes (APC primaire)
// Ratios : 33 + 10 + 10 + 13 + 13 + 10 + 11 = 100
const COLS_PRIMARY: TableColumnDef[] = [
  { label: "MATIÈRE / COMPÉTENCE", key: "subjectName",         ratio: 33, type: "subject",    align: "left" },
  { label: "ORAL",                 key: "oralScore",            ratio: 10, type: "score"                     },
  { label: "ÉCRIT",                key: "seq1Score",            ratio: 10, type: "score"                     },
  { label: "SAVOIR-FAIRE",         key: "seq2Score",            ratio: 13, type: "score"                     },
  { label: "SAVOIR-ÊTRE",          key: "selfDevelopmentScore", ratio: 13, type: "score"                     },
  { label: "TOTAL",                key: "subjectAverage",       ratio: 10, type: "average"                   },
  { label: "COTE",                 key: "competenceLabel",      ratio: 11, type: "competence"                },
];

export const generatePrimaryBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "PRIMARY" });
    drawTable(d, COLS_PRIMARY, data.subjectLines as Record<string, unknown>[]);
    drawBulletinFooter(d, {
      generalAverage: data.generalAverage,
      mention: data.mention || getMentionApc(data.generalAverage),
      classMasterComment: data.classMasterComment,
      isOfficial: data.isOfficial,
      language: "fr",
    });
  });
};

// ─── TEMPLATE 5 : ANNUAL ─────────────────────────────────────
// Paysage A4 (~770px utile), tableau à 12 colonnes
// Ratios : 20 + 6 + (9 × 7) + 11 = 100
// En paysage les colonnes reçoivent ~770px de largeur réelle
// → chaque séquence ≈ 54px, matière ≈ 154px, coeff ≈ 46px, moy ≈ 85px
const COLS_ANNUAL: TableColumnDef[] = [
  { label: "MATIÈRE", key: "subjectName",      ratio: 20, type: "subject"  },
  { label: "COEFF",   key: "coefficient",      ratio:  6, type: "score"    },
  { label: "DS1",     key: "seq1Score",        ratio:  7, type: "score"    },
  { label: "DS2",     key: "seq2Score",        ratio:  7, type: "score"    },
  { label: "T1",      key: "compositionScore", ratio:  7, type: "score"    },
  { label: "DS3",     key: "seq3Score",        ratio:  7, type: "score"    },
  { label: "DS4",     key: "seq4Score",        ratio:  7, type: "score"    },
  { label: "T2",      key: "classTestScore",   ratio:  7, type: "score"    },
  { label: "DS5",     key: "seq5Score",        ratio:  7, type: "score"    },
  { label: "DS6",     key: "seq6Score",        ratio:  7, type: "score"    },
  { label: "T3",      key: "terminalExamScore",ratio:  7, type: "score"    },
  { label: "MOY AN",  key: "subjectAverage",   ratio: 11, type: "average"  },
];

export const generateAnnualBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36, layout: "landscape" });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "ANNUAL" });
    drawTable(d, COLS_ANNUAL, data.subjectLines as Record<string, unknown>[]);
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
// Portrait A4, tableau à 6 colonnes
// Ratios : 30 + 16 + 14 + 13 + 12 + 15 = 100
const COLS_MONTHLY: TableColumnDef[] = [
  { label: "SUBJECT",      key: "subjectName",    ratio: 30, type: "subject",    align: "left" },
  { label: "TOTAL MARKS",  key: "seq1Score",      ratio: 16, type: "score"                     },
  { label: "OUT OF",       key: "seq2Score",      ratio: 14, type: "score"                     },
  { label: "AVERAGE",      key: "subjectAverage", ratio: 13, type: "average"                   },
  { label: "GRADE",        key: "competenceLabel",ratio: 12, type: "competence"                },
  { label: "COMMENT",      key: "teacherComment", ratio: 15, type: "text"                      },
];

export const generateMonthlyBulletin = (data: BulletinData): Promise<Buffer> => {
  const doc = new PDFDocument({ size: "A4", margin: 36 });
  return finalizePdf(doc, (d) => {
    drawBulletinHeader(d, { ...data, template: "MONTHLY" });
    drawTable(d, COLS_MONTHLY, data.subjectLines as Record<string, unknown>[]);
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
  data: BulletinData,
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
