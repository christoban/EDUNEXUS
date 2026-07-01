import PDFDocument from 'pdfkit';

type PdfBuilder = (doc: InstanceType<typeof PDFDocument>) => void;

function finalizePdf(build: PdfBuilder): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 42 });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

function formatDateFR(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-CM', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTimeFR(value?: Date | string | null): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-CM', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function drawHeader(doc: InstanceType<typeof PDFDocument>, title: string, subtitle: string): void {
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#1a2e1e').text('EduNexus', { align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor('#6b5c45').text(subtitle, { align: 'center' });
  doc.moveDown(0.5);
  doc.moveTo(42, doc.y).lineTo(553, doc.y).strokeColor('#1a2e1e').lineWidth(1).stroke();
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(title, { align: 'center' });
  doc.moveDown(1);
  doc.fillColor('#111827');
}

function drawLabelValue(doc: InstanceType<typeof PDFDocument>, label: string, value: string): void {
  doc.font('Helvetica-Bold').fontSize(10).text(`${label} : `, { continued: true });
  doc.font('Helvetica').text(value);
}

function drawSignature(doc: InstanceType<typeof PDFDocument>, signataire: string): void {
  doc.moveDown(1.2);
  doc.text(`Fait à Douala, le ${formatDateFR(new Date())}`, { align: 'right' });
  doc.moveDown(2);
  doc.text('Signature et cachet', { align: 'right' });
  doc.moveDown(2.5);
  doc.text(signataire || 'Le Chef d’établissement', { align: 'right' });
}

export async function generateAttestationTravailPdf(input: {
  schoolName: string;
  employeeName: string;
  roleLabel: string;
  dateEmbauche?: Date | string | null;
  dateNaissance?: Date | string | null;
  numeroCNPS?: string | null;
  typeContrat?: string | null;
  echelonActuel?: string | null;
  signataire?: string | null;
}): Promise<Buffer> {
  return finalizePdf((doc) => {
    drawHeader(doc, 'ATTESTATION DE TRAVAIL', input.schoolName);
    doc.fontSize(11).text(
      `Nous soussignés, attestons que ${input.employeeName}, ${input.roleLabel}, exerce au sein de notre établissement en qualité de collaborateur(trice) depuis le ${formatDateFR(input.dateEmbauche)}.`,
      { align: 'justify' },
    );
    doc.moveDown(0.8);
    doc.text('La présente attestation est délivrée pour servir et valoir ce que de droit.', { align: 'justify' });
    doc.moveDown(1.2);
    drawLabelValue(doc, 'Nom et prénom', input.employeeName);
    drawLabelValue(doc, 'Fonction', input.roleLabel);
    drawLabelValue(doc, 'Date de naissance', formatDateFR(input.dateNaissance));
    drawLabelValue(doc, 'Date d’embauche', formatDateFR(input.dateEmbauche));
    drawLabelValue(doc, 'Numéro CNPS', input.numeroCNPS || '—');
    drawLabelValue(doc, 'Type de contrat', input.typeContrat || '—');
    drawLabelValue(doc, 'Échelon', input.echelonActuel || '—');
    drawSignature(doc, input.signataire || 'Le Chef d’établissement');
  });
}

export async function generateCertificatTravailPdf(input: {
  schoolName: string;
  employeeName: string;
  roleLabel: string;
  dateEmbauche?: Date | string | null;
  dateNaissance?: Date | string | null;
  numeroCNPS?: string | null;
  typeContrat?: string | null;
  echelonActuel?: string | null;
  signataire?: string | null;
}): Promise<Buffer> {
  return finalizePdf((doc) => {
    drawHeader(doc, 'CERTIFICAT DE TRAVAIL', input.schoolName);
    doc.fontSize(11).text(
      `Nous certifions que ${input.employeeName}, ${input.roleLabel}, a travaillé dans notre établissement depuis le ${formatDateFR(input.dateEmbauche)} et présente un dossier administratif conforme à nos archives.`,
      { align: 'justify' },
    );
    doc.moveDown(0.8);
    doc.text('Ce certificat est établi à la demande de l’intéressé(e) pour faire valoir ce que de droit.', { align: 'justify' });
    doc.moveDown(1.2);
    drawLabelValue(doc, 'Nom et prénom', input.employeeName);
    drawLabelValue(doc, 'Fonction', input.roleLabel);
    drawLabelValue(doc, 'Date de naissance', formatDateFR(input.dateNaissance));
    drawLabelValue(doc, 'Date d’embauche', formatDateFR(input.dateEmbauche));
    drawLabelValue(doc, 'Numéro CNPS', input.numeroCNPS || '—');
    drawLabelValue(doc, 'Type de contrat', input.typeContrat || '—');
    drawLabelValue(doc, 'Échelon', input.echelonActuel || '—');
    drawSignature(doc, input.signataire || 'Le Chef d’établissement');
  });
}

export async function generateMissionOrderPdf(input: {
  schoolName: string;
  employeeName: string;
  motif: string;
  lieu: string;
  dateDebut: Date | string;
  dateFin: Date | string;
  signataire?: string | null;
}): Promise<Buffer> {
  return finalizePdf((doc) => {
    drawHeader(doc, 'ORDRE DE MISSION', input.schoolName);
    doc.fontSize(11).text(
      `Par la présente, ${input.employeeName} est autorisé(e) à se rendre à ${input.lieu} du ${formatDateFR(input.dateDebut)} au ${formatDateFR(input.dateFin)} dans le cadre de la mission suivante :`,
      { align: 'justify' },
    );
    doc.moveDown(0.8);
    doc.font('Helvetica-Bold').text(input.motif);
    doc.moveDown(1);
    drawLabelValue(doc, 'Bénéficiaire', input.employeeName);
    drawLabelValue(doc, 'Lieu', input.lieu);
    drawLabelValue(doc, 'Date de début', formatDateFR(input.dateDebut));
    drawLabelValue(doc, 'Date de fin', formatDateFR(input.dateFin));
    drawLabelValue(doc, 'Date de génération', formatDateTimeFR(new Date()));
    drawSignature(doc, input.signataire || 'Le Chef d’établissement');
  });
}
