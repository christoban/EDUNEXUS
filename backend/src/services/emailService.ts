import nodemailer from "nodemailer";
import { Resend } from "resend";
import { prisma } from "../config/prisma.ts";
import type { EmailEventType } from "../types/email.ts";

let cachedTransporter: nodemailer.Transporter | null = null;

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  return { host, port, user, pass, secure };
};

const isResendConfigured = () => Boolean(process.env.RESEND_API_KEY);

const isSmtpConfigured = () => {
  const { host, user, pass } = getSmtpConfig();
  return Boolean(host && user && pass);
};

// Résout l'adresse expéditrice selon le type d'email.
// Priorité : variable spécifique > EMAIL_FROM > défaut générique.
const resolveFromAddress = (eventType: string, fromName: string): string => {
  const SECURITY_EVENTS = new Set([
    'master_login_otp', 'master_password_change_otp', 'password_reset',
  ]);
  const INVITE_EVENTS = new Set([
    'school_invite', 'user_invite',
  ]);

  let addr: string;
  if (SECURITY_EVENTS.has(eventType) && process.env.EMAIL_FROM_SECURITY) {
    addr = process.env.EMAIL_FROM_SECURITY;
  } else if (INVITE_EVENTS.has(eventType) && process.env.EMAIL_FROM_INVITE) {
    addr = process.env.EMAIL_FROM_INVITE;
  } else {
    addr = process.env.EMAIL_FROM || 'notifications@chri.app';
  }

  return `${fromName} <${addr}>`;
};

export const isEmailConfigured = () => {
  if (isResendConfigured()) return true;
  const config = getSmtpConfig();
  return Boolean(config.host && config.port && config.user && config.pass);
};

// Dev mode - log email to console instead of sending
export const devModeSendEmail = async (
  recipientEmail: string,
  subject: string,
  html: string
): Promise<{ status: "sent"; messageId: string }> => {
  const otpMatch = html.match(/\b\d{6}\b/);
  const linkMatch = html.match(/href="([^"]*(?:reset|token|verify)[^"]*)"/i);
  console.log("\n" + "=".repeat(60));
  console.log("📧 [DEV MODE] Email simulé (non envoyé):");
  console.log("   To:", recipientEmail);
  console.log("   Subject:", subject);
  if (otpMatch) console.log("   OTP:", otpMatch[0]);
  if (linkMatch) console.log("   Lien:", linkMatch[1]);
  console.log("=".repeat(60) + "\n");

  return { status: "sent", messageId: `dev-${Date.now()}` };
};

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;

  const config = getSmtpConfig();
  if (!config.host || !config.user || !config.pass) {
    throw new Error("SMTP configuration is missing");
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure, // force STARTTLS sur port 587
    pool: true,          // réutilise la connexion SMTP au lieu d'en ouvrir une par email
    maxConnections: 2,
    maxMessages: 100,
    connectionTimeout: 10_000,  // 10s pour établir la connexion TCP
    greetingTimeout:   10_000,  // 10s pour le EHLO/HELO
    socketTimeout:     30_000,  // 30s d'inactivité socket max
    auth: {
      user: config.user,
      pass: config.pass,
    },
    tls: { rejectUnauthorized: false },
  });

  return cachedTransporter;
};


type SendEmailInput = {
  recipientEmail: string;
  recipientUserId?: string | null;
  subject: string;
  html: string;
  text?: string;
  template: string;
  eventType: EmailEventType;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType: string;
  }[];
  relatedEntityType?: string;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown>;
};

type SendEmailResult = {
  status: "sent" | "failed";
  messageId?: string;
  error?: string;
};

const resolveSchoolId = (metadata?: Record<string, unknown>) => {
  const schoolId = metadata?.schoolId;
  return typeof schoolId === "string" && schoolId.trim() ? schoolId.trim() : null;
};

export const sendTransactionalEmail = async (
  input: SendEmailInput
): Promise<SendEmailResult> => {
  const fromName = process.env.EMAIL_FROM_NAME || "ZekoulABia";
  const recipientEmail = String(input.recipientEmail).toLowerCase();

  let status: SendEmailResult["status"] = "failed";
  let messageId: string | undefined;
  let errorMessage: string | undefined;
  let usedProvider = "unknown";

  try {
    // Dev mode — log to console
    if (process.env.EMAIL_DISABLED === "true") {
      const result = await devModeSendEmail(input.recipientEmail, input.subject, input.html);
      status = "sent";
      messageId = result.messageId;
      usedProvider = "dev";
      const schoolId = resolveSchoolId(input.metadata);
      if (schoolId) {
        await prisma.emailLog.create({
          data: { schoolId, to: input.recipientEmail, subject: input.subject, status, provider: "dev" },
        });
      }
      return { status, messageId };
    }

    if (!isResendConfigured() && !isSmtpConfigured()) {
      throw new Error("Aucun provider email configuré — ajoutez RESEND_API_KEY ou les variables SMTP_* dans .env");
    }

    // Resend (production, domaine vérifié)
    if (isResendConfigured()) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = resolveFromAddress(input.eventType, fromName);
      console.log(`[Email] Resend → ${recipientEmail} from ${from}`);
      const { data: resendData, error: resendError } = await resend.emails.send({
        from,
        to: [input.recipientEmail],
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.attachments && {
          attachments: input.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
          })),
        }),
      });
      if (resendError) {
        console.error(`[Email] ERREUR Resend:`, resendError);
        throw new Error(resendError.message);
      }
      status = "sent";
      messageId = resendData?.id;
      usedProvider = "resend";
      console.log(`[Email] Resend SUCCÈS id=${resendData?.id}`);
    } else {
      // SMTP (fallback si Resend absent)
      const smtpConfig = getSmtpConfig();
      const transporter = getTransporter();
      const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
      console.log(`[Email] SMTP → ${recipientEmail} via ${smtpConfig.host}:${smtpConfig.port}`);
      try {
        const sent = await transporter.sendMail({
          from: `${fromName} <${fromAddress}>`,
          to: input.recipientEmail,
          subject: input.subject,
          html: input.html,
          text: input.text,
          ...(input.attachments && { attachments: input.attachments }),
        });
        status = "sent";
        messageId = sent.messageId;
        usedProvider = "smtp";
        console.log(`[Email] SMTP SUCCÈS messageId=${sent.messageId}`);
      } catch (smtpErr: any) {
        console.error(`[Email] ERREUR SMTP:`, smtpErr?.message, smtpErr?.code, smtpErr?.response);
        cachedTransporter = null;
        throw smtpErr;
      }
    }
  } catch (error: any) {
    status = "failed";
    errorMessage = error?.message || "Unknown email error";
    console.error("Email send failed:", {
      message: errorMessage,
      code: error?.code,
      recipientEmail,
      template: input.template,
      eventType: input.eventType,
    });
  }

  const schoolId = resolveSchoolId(input.metadata);
  if (schoolId) {
    await prisma.emailLog.create({
      data: { schoolId, to: input.recipientEmail, subject: input.subject, status, provider: usedProvider },
    });
  }

  if (status === "failed") {
    return { status, error: errorMessage };
  }

  return { status, messageId };
};

export const sendContactRequestEmail = async ({
  to,
  schoolName,
  responsibleEmail,
  phone,
  message,
}: {
  to: string;
  schoolName: string;
  responsibleEmail: string;
  phone: string;
  message: string;
}) => {
  const subject = `Nouvelle demande de contact - ${schoolName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
      <div style="background: #1e293b; padding: 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; margin: 0; font-size: 24px;">📬 Nouvelle demande de contact</h1>
      </div>
      <div style="background: #fff; padding: 24px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
              <strong style="color: #64748b;">Établissement:</strong>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${schoolName}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
              <strong style="color: #64748b;">Email du responsable:</strong>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${responsibleEmail}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
              <strong style="color: #64748b;">Téléphone:</strong>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${phone}</td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
              <strong style="color: #64748b;">Message:</strong>
            </td>
            <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0; color: #1e293b;">${message}</td>
          </tr>
        </table>
        <p style="margin-top: 24px; color: #64748b; font-size: 14px;">
          Connectez-vous au hub de contrôle pour traiter cette demande.
        </p>
        <a href="https://zekoulabia.cm/master/login" style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Accéder au hub
        </a>
      </div>
    </div>
  `;

  const input: SendEmailInput = {
    recipientEmail: to,
    subject,
    html,
    template: "contact_request",
    eventType: "contact_request",
  };

  return sendTransactionalEmail(input);
};