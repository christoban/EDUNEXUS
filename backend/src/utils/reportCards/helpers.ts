import type PDFDocument from "pdfkit";

// ─── MENTIONS MINESEC FR (bornes exactes) ────────────────────
export const getMentionFr = (average: number): string => {
  if (average >= 18) return "Excellent";
  if (average >= 16) return "Très Bien";
  if (average >= 14) return "Bien";
  if (average >= 12) return "Assez Bien";
  if (average >= 10) return "Passable";
  if (average >= 8) return "Insuffisant";
  if (average >= 6) return "Très Insuffisant";
  return "Médiocre";
};

// ─── MENTIONS EN (sur 20) ────────────────────────────────────
export const getMentionEn = (average: number): string => {
  if (average >= 16) return "Excellent";
  if (average >= 14) return "Very Good";
  if (average >= 12) return "Good";
  if (average >= 8) return "Average";
  return "Poor";
};

// ─── COULEUR CODE COULEUR /20 ────────────────────────────────
export const getAverageColor = (average: number): string => {
  if (average >= 14) return "#16a34a"; // vert
  if (average >= 10) return "#d97706"; // orange
  return "#dc2626"; // rouge
};

// ─── EN-TÊTE COMMUN BULLETIN ─────────────────────────────────
export const drawBulletinHeader = (
  doc: InstanceType<typeof PDFDocument>,
  options: {
    schoolName: string;
    schoolMotto?: string;
    logoUrl?: string;
    studentName: string;
    className: string;
    periodName: string;
    yearName: string;
    rank?: number | null;
    totalStudents?: number | null;
    absenceCount?: number;
    template: string;
  }
) => {
  const { schoolName, schoolMotto, logoUrl, studentName, className, periodName, yearName, rank, totalStudents, absenceCount, template } = options;

  // Logo
  if (logoUrl) {
    try {
      doc.image(logoUrl, 36, 28, { fit: [56, 56] });
    } catch { /* ignore */ }
  }

  // En-tête école
  doc.fontSize(16).font("Helvetica-Bold").text(schoolName, { align: "center" });
  if (schoolMotto) {
    doc.fontSize(9).font("Helvetica-Oblique").text(schoolMotto, { align: "center" });
  }
  doc.moveDown(0.3);

  // Titre bulletin
  const templateLabel: Record<string, string> = {
    FR_SECONDARY: "BULLETIN DE NOTES",
    EN_SECONDARY: "REPORT CARD",
    TECHNICAL_FR: "BULLETIN TECHNIQUE",
    PRIMARY: "BULLETIN PRIMAIRE",
    ANNUAL: "BULLETIN ANNUEL",
    MONTHLY: "BULLETIN MENSUEL",
  };
  doc.fontSize(13).font("Helvetica-Bold").text(templateLabel[template] || "BULLETIN", { align: "center" });
  doc.fontSize(10).font("Helvetica").text(`Année scolaire : ${yearName}   |   Période : ${periodName}`, { align: "center" });
  doc.moveDown(0.5);

  // Séparateur
  doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
  doc.moveDown(0.3);

  // Infos élève
  doc.fontSize(10).font("Helvetica-Bold").text("Élève / Student : ", { continued: true });
  doc.font("Helvetica").text(studentName);
  doc.text(`Classe : ${className}`, { continued: true });
  if (rank && totalStudents) {
    doc.text(`   Rang : ${rank} / ${totalStudents}`);
  } else {
    doc.text("");
  }
  if (absenceCount !== undefined) {
    doc.text(`Absences : ${absenceCount}`);
  }
  doc.moveDown(0.5);
  doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
  doc.moveDown(0.3);
};

// ─── PIED DE PAGE COMMUN ─────────────────────────────────────
export const drawBulletinFooter = (
  doc: InstanceType<typeof PDFDocument>,
  options: {
    generalAverage: number;
    mention: string;
    classMasterComment?: string | null;
    isOfficial?: boolean;
    language?: "fr" | "en";
  }
) => {
  const { generalAverage, mention, classMasterComment, isOfficial, language = "fr" } = options;

  doc.moveDown(0.5);
  doc.moveTo(36, doc.y).lineTo(559, doc.y).strokeColor("#334155").lineWidth(0.5).stroke();
  doc.moveDown(0.3);

  const avgLabel = language === "fr" ? "Moyenne générale" : "General Average";
  const mentionLabel = language === "fr" ? "Mention" : "Grade";
  const ppLabel = language === "fr" ? "Professeur Principal" : "Class Master";
  const censeurLabel = language === "fr" ? "Censeur / VP" : "Vice-Principal";
  const provLabel = language === "fr" ? "Proviseur / Principal" : "Principal";
  const parentLabel = language === "fr" ? "Visa Parent" : "Parent Signature";

  doc.fontSize(11).font("Helvetica-Bold")
    .text(`${avgLabel} : `, { continued: true })
    .text(`${generalAverage.toFixed(2)} / 20   ${mentionLabel} : ${mention}`);

  if (classMasterComment) {
    doc.fontSize(9).font("Helvetica-Oblique").text(`Appréciation : ${classMasterComment}`);
  }

  doc.moveDown(0.5);

  // Lignes de signature
  const sigY = doc.y;
  const sigCols = [36, 180, 330, 460];
  const sigLabels = [ppLabel, censeurLabel, provLabel, parentLabel];
  sigLabels.forEach((label, i) => {
    const x = sigCols[i] ?? 36;
    doc.fontSize(8).font("Helvetica").text(label, x, sigY, { width: 120, align: "center" });
    doc.moveTo(x, sigY + 30).lineTo(x + 120, sigY + 30).strokeColor("#94a3b8").lineWidth(0.5).stroke();
  });

  if (isOfficial) {
    doc.moveDown(2.5);
    doc.fontSize(7).font("Helvetica-Oblique")
      .text("Ce bulletin est un document officiel. Toute modification est passible de sanctions.", { align: "center" });
  }
};
