import PDFDocument from "pdfkit";
import QRCode from "qrcode";

// ─── Types ────────────────────────────────────────────────────

export type SchoolInfo = {
  name: string;
  ville?: string;
  motto?: string;
  logoUrl?: string;
  bp?: string;
  tel?: string;
};

export type CertificatData = {
  documentId: string;
  school: SchoolInfo;
  studentName: string;
  matricule?: string;
  className: string;
  yearName: string;
  dateOfBirth?: string;
  gender?: string;
  status: string;
  generatedAt: Date;
  verifyUrl: string;
};

export type CarteData = {
  documentId: string;
  school: SchoolInfo;
  studentName: string;
  matricule?: string;
  className: string;
  yearName: string;
  photoUrl?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  generatedAt: Date;
  verifyUrl: string;
};

export type LettreTransfertData = {
  documentId: string;
  school: SchoolInfo;
  studentName: string;
  matricule?: string;
  className: string;
  yearName: string;
  motif: string;
  lastAverage?: number;
  generatedAt: Date;
  verifyUrl: string;
};

// ─── Utilitaire : finalize PDFDocument → Buffer ───────────────

function finalizePdf(
  doc: InstanceType<typeof PDFDocument>,
  build: (doc: InstanceType<typeof PDFDocument>) => Promise<void>
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
    try {
      await build(doc);
    } catch (err) {
      reject(err);
      return;
    }
    doc.end();
  });
}

// ─── En-tête commun ──────────────────────────────────────────

function drawHeader(
  doc: InstanceType<typeof PDFDocument>,
  school: SchoolInfo,
  title: string
) {
  // Bandeau supérieur bleu marine
  doc.rect(0, 0, 595, 80).fill("#1e3a5f");

  // République du Cameroun / Republic of Cameroon
  doc
    .fontSize(7)
    .font("Helvetica")
    .fillColor("white")
    .text("RÉPUBLIQUE DU CAMEROUN", 40, 12, { align: "left", width: 230 })
    .text("Paix — Travail — Patrie", 40, 22, { align: "left", width: 230 });

  doc
    .fontSize(7)
    .fillColor("white")
    .text("REPUBLIC OF CAMEROON", 320, 12, { align: "right", width: 235 })
    .text("Peace — Work — Fatherland", 320, 22, { align: "right", width: 235 });

  // Nom établissement centré
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor("white")
    .text(school.name.toUpperCase(), 40, 36, { align: "center", width: 515 });

  if (school.motto) {
    doc
      .fontSize(8)
      .font("Helvetica-Oblique")
      .fillColor("#cbd5e1")
      .text(`"${school.motto}"`, 40, 52, { align: "center", width: 515 });
  }

  if (school.ville || school.bp || school.tel) {
    const contact = [school.bp && `B.P. ${school.bp}`, school.ville, school.tel && `Tél: ${school.tel}`]
      .filter(Boolean)
      .join(" | ");
    doc
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#94a3b8")
      .text(contact, 40, 64, { align: "center", width: 515 });
  }

  doc.fillColor("black");

  // Titre du document
  doc
    .rect(40, 95, 515, 28)
    .fillAndStroke("#f0f4f8", "#1e3a5f");

  doc
    .fontSize(13)
    .font("Helvetica-Bold")
    .fillColor("#1e3a5f")
    .text(title, 40, 102, { align: "center", width: 515 });

  doc.fillColor("black");
  doc.y = 140;
}

// ─── QR code helper ──────────────────────────────────────────

async function drawQr(
  doc: InstanceType<typeof PDFDocument>,
  url: string,
  x: number,
  y: number,
  size: number = 70
): Promise<void> {
  const qrBuffer = await QRCode.toBuffer(url, { type: "png", margin: 1, width: 200 });
  doc.image(qrBuffer, x, y, { fit: [size, size] });

  doc
    .fontSize(6)
    .font("Helvetica")
    .fillColor("#64748b")
    .text("Scannez pour vérifier", x, y + size + 3, { width: size, align: "center" });
}

// ─── Ligne de données ─────────────────────────────────────────

function dataRow(
  doc: InstanceType<typeof PDFDocument>,
  label: string,
  value: string,
  y: number
): void {
  doc.fontSize(10).font("Helvetica-Bold").fillColor("#334155").text(label, 60, y);
  doc.fontSize(10).font("Helvetica").fillColor("#0f172a").text(value, 240, y);
  doc.moveTo(60, y + 14).lineTo(535, y + 14).strokeColor("#e2e8f0").stroke();
}

// ─── CERTIFICAT DE SCOLARITÉ ──────────────────────────────────

export async function generateCertificatPdf(data: CertificatData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  return finalizePdf(doc, async (d) => {
    drawHeader(d, data.school, "CERTIFICAT DE SCOLARITÉ");

    // Texte d'attestation
    const civilite = data.gender === "F" || data.gender === "FEMALE" ? "Mme/Mlle" : "M.";
    const genre = data.gender === "F" || data.gender === "FEMALE" ? "elle" : "il";
    const artDefini = data.gender === "F" || data.gender === "FEMALE" ? "la" : "le";

    d.y = 150;
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(
        `Nous soussignés, Proviseur/Directeur de l'établissement ${data.school.name}, certifions par la présente que ${civilite} :`,
        60,
        d.y,
        { width: 475, align: "justify" }
      );

    d.y += 25;

    // Bloc données
    const rows: [string, string][] = [
      ["Nom et Prénoms", data.studentName.toUpperCase()],
      ["Matricule", data.matricule || "—"],
      ["Date de naissance", data.dateOfBirth || "—"],
      ["Classe", data.className],
      ["Année scolaire", data.yearName],
      ["Statut", data.status === "ACTIVE" ? "Régulièrement inscrit(e)" : data.status],
    ];

    rows.forEach(([label, value], i) => {
      dataRow(d, label, value, d.y + i * 22);
    });

    d.y += rows.length * 22 + 20;

    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(
        `est bien inscrit(e) dans notre établissement pour l'année scolaire ${data.yearName} et que ${artDefini} dit(e) élève est en règle vis-à-vis de l'administration scolaire.`,
        60,
        d.y,
        { width: 475, align: "justify" }
      );

    d.y += 40;

    // En foi de quoi
    d
      .fontSize(9)
      .font("Helvetica-Oblique")
      .fillColor("#475569")
      .text(
        `En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.`,
        60,
        d.y,
        { width: 475, align: "center" }
      );

    d.y += 30;

    // Date et signature
    const dateStr = data.generatedAt.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(`Fait à ${data.school.ville || "___________"}, le ${dateStr}`, 60, d.y, {
        align: "right",
        width: 475,
      });

    d.y += 50;

    d
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#1e3a5f")
      .text("Le Proviseur / Directeur", 60, d.y, { align: "right", width: 475 });

    d.y += 15;
    d
      .fontSize(8)
      .font("Helvetica-Oblique")
      .fillColor("#94a3b8")
      .text("(Signature et cachet officiel)", 60, d.y, { align: "right", width: 475 });

    // QR code en bas à gauche
    const qrY = d.page.height - 130;
    await drawQr(d, data.verifyUrl, 60, qrY, 70);

    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#94a3b8")
      .text(`Document N° ${data.documentId.slice(0, 8).toUpperCase()}`, 60, qrY + 80, {
        width: 200,
      });

    // Pied de page
    d.rect(0, d.page.height - 22, 595, 22).fill("#1e3a5f");
    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("white")
      .text("Document généré par EduNexus — Vérifiable à l'adresse indiquée par le QR Code", 40, d.page.height - 15, {
        align: "center",
        width: 515,
      });
  });
}

// ─── CARTE D'IDENTITÉ SCOLAIRE ────────────────────────────────

export async function generateCarteScolairepdf(data: CarteData): Promise<Buffer> {
  // Format A6 paysage (148 x 105 mm) ≈ 420 x 298 pt — deux pages (recto/verso)
  const W = 420;
  const H = 298;
  const doc = new PDFDocument({ size: [W, H], margin: 0 });

  return finalizePdf(doc, async (d) => {
    // ── RECTO ────────────────────────────────────────────────
    // Bandeau haut
    d.rect(0, 0, W, 50).fill("#1e3a5f");
    d
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text("CARTE D'IDENTITÉ SCOLAIRE", 0, 10, { align: "center", width: W });
    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#cbd5e1")
      .text(data.school.name.toUpperCase(), 0, 25, { align: "center", width: W });
    d
      .fontSize(6)
      .fillColor("#94a3b8")
      .text(data.yearName, 0, 38, { align: "center", width: W });

    // Photo placeholder ou image
    const photoX = 18;
    const photoY = 60;
    const photoW = 75;
    const photoH = 90;

    if (data.photoUrl && data.photoUrl.startsWith("data:")) {
      // Base64 data URL → buffer
      const base64 = data.photoUrl.split(",")[1];
      if (base64) {
        const imgBuf = Buffer.from(base64, "base64");
        d.image(imgBuf, photoX, photoY, { width: photoW, height: photoH });
      }
    } else {
      // Placeholder gris
      d.rect(photoX, photoY, photoW, photoH).fillAndStroke("#e2e8f0", "#94a3b8");
      d
        .fontSize(6)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text("PHOTO", photoX, photoY + photoH / 2 - 3, { width: photoW, align: "center" });
    }

    // Données élève
    const infoX = 108;
    d.fillColor("#0f172a");

    const infoItems: [string, string][] = [
      ["Nom & Prénoms", data.studentName.toUpperCase()],
      ["Matricule", data.matricule || "—"],
      ["Classe", data.className],
    ];

    infoItems.forEach(([label, val], i) => {
      const y = 65 + i * 32;
      d.fontSize(7).font("Helvetica-Bold").fillColor("#64748b").text(label, infoX, y);
      d.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text(val, infoX, y + 10, { width: W - infoX - 20 });
      d.moveTo(infoX, y + 28).lineTo(W - 20, y + 28).strokeColor("#e2e8f0").stroke();
    });

    // Validité
    d.fontSize(7).font("Helvetica-Bold").fillColor("#64748b").text("Valable pour", infoX, 163);
    d.fontSize(8).font("Helvetica-Bold").fillColor("#1e3a5f").text(`Année scolaire ${data.yearName}`, infoX, 173);

    // QR code sur le recto
    const qrBuf = await QRCode.toBuffer(data.verifyUrl, { type: "png", margin: 1, width: 120 });
    d.image(qrBuf, W - 80, 60, { fit: [65, 65] });
    d.fontSize(5).font("Helvetica").fillColor("#94a3b8").text("Vérifier", W - 80, 128, { width: 65, align: "center" });

    // Bandeau bas recto
    d.rect(0, H - 22, W, 22).fill("#f0f4f8");
    d
      .fontSize(6)
      .font("Helvetica-Oblique")
      .fillColor("#94a3b8")
      .text("Cette carte doit être portée à tout moment dans l'enceinte de l'établissement.", 10, H - 14, {
        align: "center",
        width: W - 20,
      });

    // ── VERSO ────────────────────────────────────────────────
    d.addPage({ size: [W, H], margin: 0 });

    d.rect(0, 0, W, 50).fill("#1e3a5f");
    d
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text("RÈGLEMENT & CONTACT D'URGENCE", 0, 18, { align: "center", width: W });

    // Règlement intérieur (résumé)
    const regles = [
      "• La ponctualité et l'assiduité sont obligatoires.",
      "• L'élève doit se présenter en tenue réglementaire.",
      "• Il est interdit d'apporter téléphone ou appareil électronique.",
      "• Tout manquement peut entraîner une sanction disciplinaire.",
      "• En cas de perte, déclarer immédiatement à l'administration.",
    ];

    d.y = 60;
    regles.forEach((r) => {
      d.fontSize(7).font("Helvetica").fillColor("#334155").text(r, 20, d.y, { width: W - 40 });
      d.y += 16;
    });

    // Contact d'urgence
    d.y += 5;
    d.rect(15, d.y, W - 30, 1).fill("#e2e8f0");
    d.y += 8;
    d.fontSize(7).font("Helvetica-Bold").fillColor("#1e3a5f").text("CONTACT D'URGENCE", 20, d.y);
    d.y += 12;
    d
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(data.emergencyContact || "Nom parent/tuteur : ________________________________", 20, d.y);
    d.y += 14;
    d
      .fontSize(8)
      .text(data.emergencyPhone ? `Tél : ${data.emergencyPhone}` : "Tél : ________________________________", 20, d.y);

    // Pied verso
    d.rect(0, H - 22, W, 22).fill("#1e3a5f");
    d
      .fontSize(6)
      .font("Helvetica")
      .fillColor("white")
      .text("EduNexus — Système de Gestion Scolaire", 0, H - 14, { align: "center", width: W });
  });
}

// ─── LETTRE DE TRANSFERT ──────────────────────────────────────

export async function generateLettreTransfertPdf(data: LettreTransfertData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  return finalizePdf(doc, async (d) => {
    drawHeader(d, data.school, "LETTRE DE TRANSFERT / SORTIE DÉFINITIVE");

    d.y = 150;

    const dateStr = data.generatedAt.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    // En-tête de la lettre
    d
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#475569")
      .text(`Fait à ${data.school.ville || "___________"}, le ${dateStr}`, 60, d.y, {
        align: "right",
        width: 475,
      });

    d.y += 30;

    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text("Objet : Transfert / Sortie d'élève", 60, d.y);

    d.y += 25;

    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(
        `Nous soussignés, Proviseur/Directeur de l'établissement ${data.school.name}, attestons par la présente la sortie définitive de l'élève suivant(e) :`,
        60,
        d.y,
        { width: 475, align: "justify" }
      );

    d.y += 35;

    const rows: [string, string][] = [
      ["Nom et Prénoms", data.studentName.toUpperCase()],
      ["Matricule", data.matricule || "—"],
      ["Dernière classe fréquentée", data.className],
      ["Année scolaire", data.yearName],
      ["Motif de sortie", data.motif],
      ...(data.lastAverage !== undefined
        ? [["Moyenne générale (dernier trimestre)", `${data.lastAverage.toFixed(2)} / 20`] as [string, string]]
        : []),
    ];

    rows.forEach(([label, value], i) => {
      dataRow(d, label, value, d.y + i * 22);
    });

    d.y += rows.length * 22 + 25;

    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(
        "Nous certifions que cet(te) élève a satisfait à toutes les obligations vis-à-vis de l'administration de notre établissement à la date de sa sortie.",
        60,
        d.y,
        { width: 475, align: "justify" }
      );

    d.y += 40;

    d
      .fontSize(9)
      .font("Helvetica-Oblique")
      .fillColor("#475569")
      .text(
        "La présente lettre est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.",
        60,
        d.y,
        { width: 475, align: "center" }
      );

    d.y += 40;

    d
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#1e3a5f")
      .text("Le Proviseur / Directeur", 60, d.y, { align: "right", width: 475 });

    d.y += 15;
    d
      .fontSize(8)
      .font("Helvetica-Oblique")
      .fillColor("#94a3b8")
      .text("(Signature et cachet officiel)", 60, d.y, { align: "right", width: 475 });

    // QR code
    const qrY = d.page.height - 130;
    await drawQr(d, data.verifyUrl, 60, qrY, 70);
    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#94a3b8")
      .text(`Document N° ${data.documentId.slice(0, 8).toUpperCase()}`, 60, qrY + 80, { width: 200 });

    // Pied de page
    d.rect(0, d.page.height - 22, 595, 22).fill("#1e3a5f");
    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("white")
      .text("Document généré par EduNexus — Vérifiable à l'adresse indiquée par le QR Code", 40, d.page.height - 15, {
        align: "center",
        width: 515,
      });
  });
}
