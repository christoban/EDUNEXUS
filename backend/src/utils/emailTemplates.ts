import type { ReportPeriod } from "./reporting.ts";

type Language = "fr" | "en";

const formatPeriodLabel = (period: ReportPeriod, language: Language) => {
  if (language === "fr") {
    if (period === "term1") return "Trimestre 1";
    if (period === "term2") return "Trimestre 2";
    if (period === "term3") return "Trimestre 3";
    return "Annuel";
  }

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
  language?: Language;
}) => {
  const {
    recipientName,
    examTitle,
    subjectName,
    score,
    maxScore,
    percentage,
    language = "fr",
  } = payload;

  const isFr = language === "fr";
  const subjectLine = isFr
    ? `Resultat examen: ${examTitle}`
    : `Exam result: ${examTitle}`;
  const body = isFr
    ? `
    <p>Bonjour <strong>${recipientName}</strong>,</p>
    <p>Le resultat d'examen est maintenant disponible.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
      <tr><td><strong>Matiere:</strong></td><td>${subjectName}</td></tr>
      <tr><td><strong>Examen:</strong></td><td>${examTitle}</td></tr>
      <tr><td><strong>Score:</strong></td><td>${score}/${maxScore}</td></tr>
      <tr><td><strong>Pourcentage:</strong></td><td>${percentage}%</td></tr>
    </table>
    <p>Connectez-vous a la plateforme pour consulter les details de vos reponses.</p>
  `
    : `
    <p>Hello <strong>${recipientName}</strong>,</p>
    <p>Your exam result is now available.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
      <tr><td><strong>Subject:</strong></td><td>${subjectName}</td></tr>
      <tr><td><strong>Exam:</strong></td><td>${examTitle}</td></tr>
      <tr><td><strong>Score:</strong></td><td>${score}/${maxScore}</td></tr>
      <tr><td><strong>Percentage:</strong></td><td>${percentage}%</td></tr>
    </table>
    <p>Please sign in to EDUNEXUS to view full details.</p>
  `;

  return {
    subject: subjectLine,
    html: shell(subjectLine, isFr ? "Notification academique" : "Academic notification", body),
    text: isFr
      ? `Bonjour ${recipientName}, votre resultat pour ${examTitle} (${subjectName}) est disponible. Score: ${score}/${maxScore} (${percentage}%).`
      : `Hello ${recipientName}, your result for ${examTitle} (${subjectName}) is now available. Score: ${score}/${maxScore} (${percentage}%).`,
  };
};

export const buildReportCardTemplate = (payload: {
  recipientName: string;
  period: ReportPeriod;
  yearName: string;
  average: number;
  mention: string;
  totalExams: number;
  language?: Language;
}) => {
  const {
    recipientName,
    period,
    yearName,
    average,
    mention,
    totalExams,
    language = "fr",
  } = payload;
  const isFr = language === "fr";
  const periodLabel = formatPeriodLabel(period, language);
  const subjectLine = isFr
    ? `Bulletin disponible - ${periodLabel}`
    : `Report card available - ${periodLabel}`;
  const body = isFr
    ? `
    <p>Bonjour <strong>${recipientName}</strong>,</p>
    <p>Le bulletin ${periodLabel} pour l'annee ${yearName} est maintenant disponible.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
      <tr><td><strong>Moyenne:</strong></td><td>${average}%</td></tr>
      <tr><td><strong>Mention:</strong></td><td>${mention}</td></tr>
      <tr><td><strong>Nombre d'examens:</strong></td><td>${totalExams}</td></tr>
    </table>
    <p>Connectez-vous a EDUNEXUS pour consulter le bulletin complet.</p>
  `
    : `
    <p>Hello <strong>${recipientName}</strong>,</p>
    <p>Your ${periodLabel} report card for ${yearName} is now available.</p>
    <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0;">
      <tr><td><strong>Average:</strong></td><td>${average}%</td></tr>
      <tr><td><strong>Mention:</strong></td><td>${mention}</td></tr>
      <tr><td><strong>Total exams:</strong></td><td>${totalExams}</td></tr>
    </table>
    <p>Sign in to EDUNEXUS to view the full report card.</p>
  `;

  return {
    subject: subjectLine,
    html: shell(subjectLine, isFr ? "Bulletin scolaire" : "Report card", body),
    text: isFr
      ? `Bonjour ${recipientName}, votre bulletin ${periodLabel} (${yearName}) est disponible. Moyenne: ${average}%, mention: ${mention}.`
      : `Hello ${recipientName}, your ${periodLabel} report card (${yearName}) is available. Average: ${average}%, mention: ${mention}.`,
  };
};

export const buildPaymentReminderTemplate = (payload: {
  studentName: string;
  totalOutstanding: number;
  currency?: string;
  language?: Language;
}) => {
  const { studentName, totalOutstanding, currency = "XAF", language = "fr" } = payload;
  const isFr = language === "fr";
  const amount = `${Math.round(totalOutstanding).toLocaleString("fr-CM")} ${currency}`;

  const subject = isFr ? "Rappel de paiement - EDUNEXUS" : "Payment reminder - EDUNEXUS";
  const body = isFr
    ? `
      <p>Bonjour,</p>
      <p>Nous vous informons que <strong>${studentName}</strong> a un montant impaye de <strong>${amount}</strong>.</p>
      <p>Merci de regulariser des que possible.</p>
    `
    : `
      <p>Hello,</p>
      <p>Please note that <strong>${studentName}</strong> has an outstanding balance of <strong>${amount}</strong>.</p>
      <p>Please complete payment as soon as possible.</p>
    `;

  return {
    subject,
    html: shell(subject, isFr ? "Rappel finance" : "Finance reminder", body),
    text: isFr
      ? `Rappel EDUNEXUS: ${studentName} a un montant impaye de ${amount}. Merci de regulariser.`
      : `EDUNEXUS reminder: ${studentName} has an outstanding balance of ${amount}. Please complete payment.`,
    sms: isFr
      ? `Rappel EDUNEXUS: ${studentName} a un montant impaye de ${amount}. Merci de regulariser.`
      : `EDUNEXUS reminder: ${studentName} has an outstanding balance of ${amount}. Please complete payment.`,
  };
};

export const buildSchoolInviteTemplate = (payload: {
  schoolName: string;
  requestedAdminName: string;
  activationUrl: string;
  language?: Language;
}) => {
  const { schoolName, requestedAdminName, activationUrl, language = "fr" } = payload;
  const isFr = language === "fr";
  const subject = isFr ? `Invitation EDUNEXUS - ${schoolName}` : `EDUNEXUS invite - ${schoolName}`;
  const body = isFr
    ? `
      <p>Bonjour <strong>${requestedAdminName}</strong>,</p>
      <p>Votre établissement <strong>${schoolName}</strong> est prêt pour l'activation.</p>
      <p><a href="${activationUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Activer l'établissement</a></p>
      <p>Ce lien est personnel et temporaire.</p>
    `
    : `
      <p>Hello <strong>${requestedAdminName}</strong>,</p>
      <p>Your school <strong>${schoolName}</strong> is ready for activation.</p>
      <p><a href="${activationUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:12px 16px;border-radius:8px;text-decoration:none;">Activate school</a></p>
      <p>This link is personal and temporary.</p>
    `;

  return {
    subject,
    html: shell(subject, isFr ? "Invitation établissement" : "School invitation", body),
    text: isFr
      ? `Bonjour ${requestedAdminName}, votre établissement ${schoolName} est prêt. Activez-le ici: ${activationUrl}`
      : `Hello ${requestedAdminName}, your school ${schoolName} is ready. Activate it here: ${activationUrl}`,
  };
};
