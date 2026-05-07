import nodemailer from "nodemailer";
import { Resend } from "resend";
import { prisma } from "../config/prisma.ts";
import type { EmailEventType } from "../types/email.ts";

// Resend client - use if API key is provided
let resendClient: Resend | null = null;

const getResendConfig = () => {
  return process.env.RESEND_API_KEY || null;
};

const getResendClient = () => {
  const apiKey = getResendConfig();
  if (!apiKey) return null;
  if (resendClient) return resendClient;
  resendClient = new Resend(apiKey);
  return resendClient;
};

export const isResendConfigured = () => {
  return Boolean(getResendConfig());
};

// Nodemailer fallback
let cachedTransporter: nodemailer.Transporter | null = null;

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = String(process.env.SMTP_SECURE || "false") === "true";

  return { host, port, user, pass, secure };
};

export const isEmailConfigured = () => {
  // Check Resend first, then fallback to SMTP
  if (isResendConfigured()) return true;
  const config = getSmtpConfig();
  return Boolean(config.host && config.port && config.user && config.pass);
};

// Dev mode - log OTP to console instead of sending
export const devModeSendEmail = async (
  recipientEmail: string,
  subject: string,
  html: string
): Promise<{ status: "sent"; messageId: string }> => {
  const otpMatch = html.match(/\b\d{6}\b/);
  console.log("\n" + "=".repeat(60));
  console.log("📧 [DEV MODE] Email zouant etre envoye:");
  console.log("   To:", recipientEmail);
  console.log("   Subject:", subject);
  if (otpMatch) {
    console.log("   OTP:", otpMatch[0]);
  }
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
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
};

// Send via Resend API
const sendViaResend = async (
  recipientEmail: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ status: "sent"; messageId: string }> => {
  const resend = getResendClient();
  if (!resend) throw new Error("Resend not configured");

  const fromName = process.env.SMTP_FROM_NAME || "EDUNEXUS";
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM || "onboarding@resend.dev";
  const senderEmail = fromEmail.includes("@") ? `${fromName} <${fromEmail}>` : fromEmail;

  const data = await resend.emails.send({
    from: senderEmail,
    to: recipientEmail,
    subject,
    html,
    text,
  });

  if (data.error) {
    throw new Error(data.error.message);
  }

  return { status: "sent", messageId: data.data?.id || "resend-ok" };
};

type SendEmailInput = {
  recipientEmail: string;
  recipientUserId?: string | null;
  subject: string;
  html: string;
  text?: string;
  template: string;
  eventType: EmailEventType;
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
  const fromName = process.env.SMTP_FROM_NAME || "EDUNEXUS";
  const superAdminEmail = (process.env.SUPER_ADMIN_EMAIL || "christoban2005@gmail.com").toLowerCase();
  const recipientEmail = String(input.recipientEmail).toLowerCase();
  const isForSuperAdmin = recipientEmail === superAdminEmail;

  let status: SendEmailResult["status"] = "failed";
  let messageId: string | undefined;
  let errorMessage: string | undefined;

  try {
    // Dev mode - log to console
    if (process.env.EMAIL_DISABLED === "true") {
      const result = await devModeSendEmail(
        input.recipientEmail,
        input.subject,
        input.html
      );
      status = "sent";
      messageId = result.messageId;
      await prisma.emailLog.create({
        data: {
          schoolId: resolveSchoolId(input.metadata),
          to: input.recipientEmail,
          subject: input.subject,
          status,
          provider: "dev",
        },
      });
      return { status, messageId };
    }

    // ✅ LOGIQUE OPTIMISÉE :
    // - Super Admin (toi) : Essaie Resend d'abord, puis fallback SMTP
    // - École (autre) : Passe DIRECTEMENT en SMTP (pas de tentative Resend inutile)

    if (isForSuperAdmin && isResendConfigured()) {
      // Cas 1 : Email pour le Super Admin → Essaie Resend
      try {
        const result = await sendViaResend(
          input.recipientEmail,
          input.subject,
          input.html,
          input.text
        );
        status = "sent";
        messageId = result.messageId;
      } catch (resendError: any) {
        console.log(`Resend failed for ${recipientEmail}, falling back to SMTP:`, resendError?.message);
        // Fall through to try SMTP
      }
    }

    // Fallback to SMTP (soit Resend a échoué, soit c'est pour une école)
    if (status !== "sent") {
      const smtpConfig = getSmtpConfig();
      if (smtpConfig.host && smtpConfig.user && smtpConfig.pass) {
        const transporter = getTransporter();
        const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
        const sent = await transporter.sendMail({
          from: `${fromName} <${fromAddress}>`,
          to: input.recipientEmail,
          subject: input.subject,
          html: input.html,
          text: input.text,
        });
        status = "sent";
        messageId = sent.messageId;
      }
    }

    if (status !== "sent") {
      throw new Error("No email provider configured");
    }
  } catch (error: any) {
    status = "failed";
    errorMessage = error?.message || "Unknown email error";
    console.error("Email send failed:", {
      message: errorMessage,
      code: error?.code,
      recipientEmail: input.recipientEmail,
      template: input.template,
      eventType: input.eventType,
    });
  }

  await prisma.emailLog.create({
    data: {
      schoolId: resolveSchoolId(input.metadata),
      to: input.recipientEmail,
      subject: input.subject,
      status,
      provider: isForSuperAdmin && isResendConfigured() ? "resend" : "smtp",
    },
  });

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
        <a href="https://edunexus.cm/master/login" style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
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