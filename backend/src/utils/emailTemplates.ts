import type { ReportPeriod } from "./reporting.ts";

const formatPeriodLabel = (period: ReportPeriod) => {
  if (period === "term1") return "Term 1";
  if (period === "term2") return "Term 2";
  if (period === "term3") return "Term 3";
  return "Annual";
};

const shell = (title: string, subtitle: string, body: string) => {
  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${title}</title>
    </head>
    <body style="margin:0;background:#f6f8fb;font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
        <tr>
          <td align="center">
            <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
              <tr>
                <td style="background:#0f766e;color:#ffffff;padding:20px 24px;">
                  <div style="font-size:22px;font-weight:700;">EDUNEXUS</div>
                  <div style="font-size:14px;opacity:0.9;">${subtitle}</div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px;line-height:1.6;font-size:15px;">${body}</td>
              </tr>
              <tr>
                <td style="padding:16px 24px;background:#f9fafb;color:#6b7280;font-size:12px;">
                  Message automatique EDUNEXUS. Merci de ne pas repondre a cet email.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
};

export const buildExamResultTemplate = (payload: {
  recipientName: string;
  examTitle: string;
  subjectName: string;
  score: number;
  maxScore: number;
  percentage: number;
}) => {
  const { recipientName, examTitle, subjectName, score, maxScore, percentage } = payload;

  const subjectLine = `Resultat examen: ${examTitle}`;
  const body = `
    <p>Bonjour <strong>${recipientName}</strong>,</p>
    <p>Le resultat d'examen est maintenant disponible.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
      <tr><td><strong>Matiere:</strong></td><td>${subjectName}</td></tr>
      <tr><td><strong>Examen:</strong></td><td>${examTitle}</td></tr>
      <tr><td><strong>Score:</strong></td><td>${score}/${maxScore}</td></tr>
      <tr><td><strong>Pourcentage:</strong></td><td>${percentage}%</td></tr>
    </table>
    <p>Connectez-vous a la plateforme pour consulter les details de vos reponses.</p>
  `;

  return {
    subject: subjectLine,
    html: shell(subjectLine, "Notification academique", body),
    text: `Bonjour ${recipientName}, votre resultat pour ${examTitle} (${subjectName}) est disponible. Score: ${score}/${maxScore} (${percentage}%).`,
  };
};

export const buildReportCardTemplate = (payload: {
  recipientName: string;
  period: ReportPeriod;
  yearName: string;
  average: number;
  mention: string;
  totalExams: number;
}) => {
  const { recipientName, period, yearName, average, mention, totalExams } = payload;
  const periodLabel = formatPeriodLabel(period);
  const subjectLine = `Bulletin disponible - ${periodLabel}`;
  const body = `
    <p>Bonjour <strong>${recipientName}</strong>,</p>
    <p>Le bulletin ${periodLabel} pour l'annee ${yearName} est maintenant disponible.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
      <tr><td><strong>Moyenne:</strong></td><td>${average}%</td></tr>
      <tr><td><strong>Mention:</strong></td><td>${mention}</td></tr>
      <tr><td><strong>Nombre d'examens:</strong></td><td>${totalExams}</td></tr>
    </table>
    <p>Connectez-vous a EDUNEXUS pour consulter le bulletin complet.</p>
  `;

  return {
    subject: subjectLine,
    html: shell(subjectLine, "Bulletin scolaire", body),
    text: `Bonjour ${recipientName}, votre bulletin ${periodLabel} (${yearName}) est disponible. Moyenne: ${average}%, mention: ${mention}.`,
  };
};
