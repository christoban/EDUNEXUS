import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export type Language = "fr" | "en";

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
  language?: Language;
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
  language?: Language;
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
  language?: Language;
};

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

function drawHeader(
  doc: InstanceType<typeof PDFDocument>,
  school: SchoolInfo,
  title: string
) {
  doc.rect(0, 0, 595, 80).fill("#1e3a5f");

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

async function drawQr(
  doc: InstanceType<typeof PDFDocument>,
  url: string,
  x: number,
  y: number,
  lang: Language,
  size: number = 70
): Promise<void> {
  const qrBuffer = await QRCode.toBuffer(url, { type: "png", margin: 1, width: 200 });
  doc.image(qrBuffer, x, y, { fit: [size, size] });

  doc
    .fontSize(6)
    .font("Helvetica")
    .fillColor("#64748b")
    .text(lang === "en" ? "Scan to verify" : "Scannez pour vérifier", x, y + size + 3, { width: size, align: "center" });
}

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

export async function generateCertificatPdf(data: CertificatData): Promise<Buffer> {
  const lang = data.language ?? "fr";
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  return finalizePdf(doc, async (d) => {
    drawHeader(d, data.school, lang === "en" ? "ENROLLMENT CERTIFICATE" : "CERTIFICAT DE SCOLARITÉ");

    // Ne jamais deviner : un genre non renseigné (data.gender null/undefined) ne doit PAS
    // se transformer silencieusement en "M." — ça mégenrerait toute élève dont le profil
    // n'a pas encore été complété. On affiche les deux civilités plutôt qu'un défaut faux.
    const civilite = data.gender === "F" ? "Mme/Mlle" : data.gender === "M" ? "M." : "M./Mme";
    const artDefini = data.gender === "F" ? "la" : data.gender === "M" ? "le" : "le/la";

    d.y = 150;
    const intro = lang === "en"
      ? `We, the Principal/Head of ${data.school.name}, hereby certify that ${civilite}:`
      : `Nous soussignés, Proviseur/Directeur de l'établissement ${data.school.name}, certifions par la présente que ${civilite} :`;
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(intro, 60, d.y, { width: 475, align: "justify" });

    d.y += 25;

    const fieldLabels: Record<string, string> = {
      name: lang === "en" ? "Full Name" : "Nom et Prénoms",
      matricule: lang === "en" ? "Matricule" : "Matricule",
      dob: lang === "en" ? "Date of Birth" : "Date de naissance",
      class: lang === "en" ? "Class" : "Classe",
      year: lang === "en" ? "Academic Year" : "Année scolaire",
      status: lang === "en" ? "Status" : "Statut",
    };
    const statusValue = data.status === "ACTIVE"
      ? (lang === "en" ? "Regularly enrolled" : "Régulièrement inscrit(e)")
      : data.status;

    const rows: [string, string][] = [
      [fieldLabels.name, data.studentName.toUpperCase()],
      [fieldLabels.matricule, data.matricule || "—"],
      [fieldLabels.dob, data.dateOfBirth || "—"],
      [fieldLabels.class, data.className],
      [fieldLabels.year, data.yearName],
      [fieldLabels.status, statusValue],
    ];

    rows.forEach(([label, value], i) => {
      dataRow(d, label, value, d.y + i * 22);
    });

    d.y += rows.length * 22 + 20;

    const pronounVerb = artDefini === "la" ? "she is" : artDefini === "le" ? "he is" : "they are";
    const bodyLine = lang === "en"
      ? `is duly enrolled in our institution for the academic year ${data.yearName} and ${pronounVerb} in good standing with the school administration.`
      : `est bien inscrit(e) dans notre établissement pour l'année scolaire ${data.yearName} et que ${artDefini} dit(e) élève est en règle vis-à-vis de l'administration scolaire.`;
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(bodyLine, 60, d.y, { width: 475, align: "justify" });

    d.y += 40;

    const legalClause = lang === "en"
      ? "In witness whereof, this certificate is issued to serve and be used for all lawful purposes."
      : "En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.";
    d
      .fontSize(9)
      .font("Helvetica-Oblique")
      .fillColor("#475569")
      .text(legalClause, 60, d.y, { width: 475, align: "center" });

    d.y += 30;

    const dateStr = data.generatedAt.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const faitA = lang === "en" ? "Done at" : "Fait à";
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(`${faitA} ${data.school.ville || "___________"}, ${dateStr}`, 60, d.y, {
        align: "right",
        width: 475,
      });

    d.y += 50;

    const signataire = lang === "en" ? "The Principal / Head of School" : "Le Proviseur / Directeur";
    d
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#1e3a5f")
      .text(signataire, 60, d.y, { align: "right", width: 475 });

    d.y += 15;
    const cachet = lang === "en" ? "(Signature and official stamp)" : "(Signature et cachet officiel)";
    d
      .fontSize(8)
      .font("Helvetica-Oblique")
      .fillColor("#94a3b8")
      .text(cachet, 60, d.y, { align: "right", width: 475 });

    const qrY = d.page.height - 130;
    await drawQr(d, data.verifyUrl, 60, qrY, lang, 70);

    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#94a3b8")
      .text(`Document N° ${data.documentId.slice(0, 8).toUpperCase()}`, 60, qrY + 80, {
        width: 200,
      });

    d.rect(0, d.page.height - 22, 595, 22).fill("#1e3a5f");
    const footer = lang === "en"
      ? "Document generated by ZekoulABia — Verifiable via QR Code"
      : "Document généré par ZekoulABia — Vérifiable à l'adresse indiquée par le QR Code";
    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("white")
      .text(footer, 40, d.page.height - 15, {
        align: "center",
        width: 515,
      });
  });
}

export async function generateCarteScolairepdf(data: CarteData): Promise<Buffer> {
  const lang = data.language ?? "fr";
  const W = 420;
  const H = 298;
  const doc = new PDFDocument({ size: [W, H], margin: 0 });

  return finalizePdf(doc, async (d) => {
    d.rect(0, 0, W, 50).fill("#1e3a5f");
    d
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text(lang === "en" ? "SCHOOL IDENTITY CARD" : "CARTE D'IDENTITÉ SCOLAIRE", 0, 10, { align: "center", width: W });
    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#cbd5e1")
      .text(data.school.name.toUpperCase(), 0, 25, { align: "center", width: W });
    d
      .fontSize(6)
      .fillColor("#94a3b8")
      .text(data.yearName, 0, 38, { align: "center", width: W });

    const photoX = 18;
    const photoY = 60;
    const photoW = 75;
    const photoH = 90;

    if (data.photoUrl && data.photoUrl.startsWith("data:")) {
      const base64 = data.photoUrl.split(",")[1];
      if (base64) {
        const imgBuf = Buffer.from(base64, "base64");
        d.image(imgBuf, photoX, photoY, { width: photoW, height: photoH });
      }
    } else {
      d.rect(photoX, photoY, photoW, photoH).fillAndStroke("#e2e8f0", "#94a3b8");
      d
        .fontSize(6)
        .font("Helvetica")
        .fillColor("#94a3b8")
        .text("PHOTO", photoX, photoY + photoH / 2 - 3, { width: photoW, align: "center" });
    }

    const infoX = 108;
    d.fillColor("#0f172a");

    const infoItems: [string, string][] = [
      [lang === "en" ? "Name" : "Nom & Prénoms", data.studentName.toUpperCase()],
      ["Matricule", data.matricule || "—"],
      [lang === "en" ? "Class" : "Classe", data.className],
    ];

    infoItems.forEach(([label, val], i) => {
      const y = 65 + i * 32;
      d.fontSize(7).font("Helvetica-Bold").fillColor("#64748b").text(label, infoX, y);
      d.fontSize(9).font("Helvetica-Bold").fillColor("#0f172a").text(val, infoX, y + 10, { width: W - infoX - 20 });
      d.moveTo(infoX, y + 28).lineTo(W - 20, y + 28).strokeColor("#e2e8f0").stroke();
    });

    d.fontSize(7).font("Helvetica-Bold").fillColor("#64748b")
      .text(lang === "en" ? "Valid for" : "Valable pour", infoX, 163);
    d.fontSize(8).font("Helvetica-Bold").fillColor("#1e3a5f")
      .text(`${lang === "en" ? "Academic Year" : "Année scolaire"} ${data.yearName}`, infoX, 173);

    const qrBuf = await QRCode.toBuffer(data.verifyUrl, { type: "png", margin: 1, width: 120 });
    d.image(qrBuf, W - 80, 60, { fit: [65, 65] });
    d.fontSize(5).font("Helvetica").fillColor("#94a3b8")
      .text(lang === "en" ? "Verify" : "Vérifier", W - 80, 128, { width: 65, align: "center" });

    d.rect(0, H - 22, W, 22).fill("#f0f4f8");
    const rectoFooter = lang === "en"
      ? "This card must be worn at all times within the school premises."
      : "Cette carte doit être portée à tout moment dans l'enceinte de l'établissement.";
    d
      .fontSize(6)
      .font("Helvetica-Oblique")
      .fillColor("#94a3b8")
      .text(rectoFooter, 10, H - 14, { align: "center", width: W - 20 });

    d.addPage({ size: [W, H], margin: 0 });

    d.rect(0, 0, W, 50).fill("#1e3a5f");
    d
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("white")
      .text(lang === "en" ? "RULES & EMERGENCY CONTACT" : "RÈGLEMENT & CONTACT D'URGENCE", 0, 18, { align: "center", width: W });

    const regles = lang === "en"
      ? [
          "• Punctuality and regular attendance are mandatory.",
          "• Students must wear the prescribed uniform.",
          "• Mobile phones and electronic devices are prohibited.",
          "• Any misconduct may result in disciplinary action.",
          "• Report loss immediately to the administration.",
        ]
      : [
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

    d.y += 5;
    d.rect(15, d.y, W - 30, 1).fill("#e2e8f0");
    d.y += 8;
    d.fontSize(7).font("Helvetica-Bold").fillColor("#1e3a5f")
      .text(lang === "en" ? "EMERGENCY CONTACT" : "CONTACT D'URGENCE", 20, d.y);
    d.y += 12;
    const parentLabel = lang === "en" ? "Parent/Guardian name" : "Nom parent/tuteur";
    d
      .fontSize(8)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(data.emergencyContact || `${parentLabel} : ________________________________`, 20, d.y);
    d.y += 14;
    d
      .fontSize(8)
      .text(data.emergencyPhone ? `Tel : ${data.emergencyPhone}` : "Tel : ________________________________", 20, d.y);

    d.rect(0, H - 22, W, 22).fill("#1e3a5f");
    d
      .fontSize(6)
      .font("Helvetica")
      .fillColor("white")
      .text("ZekoulABia — School Management System", 0, H - 14, { align: "center", width: W });
  });
}

export async function generateLettreTransfertPdf(data: LettreTransfertData): Promise<Buffer> {
  const lang = data.language ?? "fr";
  const doc = new PDFDocument({ size: "A4", margin: 40 });

  return finalizePdf(doc, async (d) => {
    const title = lang === "en" ? "TRANSFER LETTER / FINAL DEPARTURE" : "LETTRE DE TRANSFERT / SORTIE DÉFINITIVE";
    drawHeader(d, data.school, title);

    d.y = 150;

    const dateStr = data.generatedAt.toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const faitA = lang === "en" ? "Done at" : "Fait à";
    d
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#475569")
      .text(`${faitA} ${data.school.ville || "___________"}, ${dateStr}`, 60, d.y, {
        align: "right",
        width: 475,
      });

    d.y += 30;

    const objet = lang === "en" ? "Subject: Student Transfer / Departure" : "Objet : Transfert / Sortie d'élève";
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(objet, 60, d.y);

    d.y += 25;

    const intro = lang === "en"
      ? `We, the Principal/Head of ${data.school.name}, hereby certify the final departure of the following student:`
      : `Nous soussignés, Proviseur/Directeur de l'établissement ${data.school.name}, attestons par la présente la sortie définitive de l'élève suivant(e) :`;
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(intro, 60, d.y, { width: 475, align: "justify" });

    d.y += 35;

    const fieldLabels: Record<string, string> = {
      name: lang === "en" ? "Full Name" : "Nom et Prénoms",
      matricule: "Matricule",
      lastClass: lang === "en" ? "Last class attended" : "Dernière classe fréquentée",
      year: lang === "en" ? "Academic Year" : "Année scolaire",
      reason: lang === "en" ? "Reason for departure" : "Motif de sortie",
      avg: lang === "en" ? "General average (last term)" : "Moyenne générale (dernier trimestre)",
    };

    const rows: [string, string][] = [
      [fieldLabels.name, data.studentName.toUpperCase()],
      [fieldLabels.matricule, data.matricule || "—"],
      [fieldLabels.lastClass, data.className],
      [fieldLabels.year, data.yearName],
      [fieldLabels.reason, data.motif],
      ...(data.lastAverage !== undefined
        ? [[fieldLabels.avg, `${data.lastAverage.toFixed(2)} / 20`] as [string, string]]
        : []),
    ];

    rows.forEach(([label, value], i) => {
      dataRow(d, label, value, d.y + i * 22);
    });

    d.y += rows.length * 22 + 25;

    const certLine = lang === "en"
      ? "We certify that this student has fulfilled all obligations towards our school administration as of the date of departure."
      : "Nous certifions que cet(te) élève a satisfait à toutes les obligations vis-à-vis de l'administration de notre établissement à la date de sa sortie.";
    d
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#0f172a")
      .text(certLine, 60, d.y, { width: 475, align: "justify" });

    d.y += 40;

    const legalClause = lang === "en"
      ? "This letter is issued to the student for all lawful purposes."
      : "La présente lettre est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.";
    d
      .fontSize(9)
      .font("Helvetica-Oblique")
      .fillColor("#475569")
      .text(legalClause, 60, d.y, { width: 475, align: "center" });

    d.y += 40;

    const signataire = lang === "en" ? "The Principal / Head of School" : "Le Proviseur / Directeur";
    d
      .fontSize(10)
      .font("Helvetica-Bold")
      .fillColor("#1e3a5f")
      .text(signataire, 60, d.y, { align: "right", width: 475 });

    d.y += 15;
    const cachet = lang === "en" ? "(Signature and official stamp)" : "(Signature et cachet officiel)";
    d
      .fontSize(8)
      .font("Helvetica-Oblique")
      .fillColor("#94a3b8")
      .text(cachet, 60, d.y, { align: "right", width: 475 });

    const qrY = d.page.height - 130;
    await drawQr(d, data.verifyUrl, 60, qrY, lang, 70);
    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("#94a3b8")
      .text(`Document N° ${data.documentId.slice(0, 8).toUpperCase()}`, 60, qrY + 80, { width: 200 });

    d.rect(0, d.page.height - 22, 595, 22).fill("#1e3a5f");
    const footer = lang === "en"
      ? "Document generated by ZekoulABia — Verifiable via QR Code"
      : "Document généré par ZekoulABia — Vérifiable à l'adresse indiquée par le QR Code";
    d
      .fontSize(7)
      .font("Helvetica")
      .fillColor("white")
      .text(footer, 40, d.page.height - 15, { align: "center", width: 515 });
  });
}
