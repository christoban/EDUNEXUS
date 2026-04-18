import nodemailer from "nodemailer";
import mongoose from "mongoose";
import EmailLog, { type EmailEventType } from "../models/emailLog.ts";

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
  const config = getSmtpConfig();
  return Boolean(config.host && config.port && config.user && config.pass);
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

type SendEmailInput = {
  recipientEmail: string;
  recipientUserId?: string | mongoose.Types.ObjectId | null;
  subject: string;
  html: string;
  text?: string;
  template: string;
  eventType: EmailEventType;
  relatedEntityType?: string;
  relatedEntityId?: string | mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;
};

type SendEmailResult = {
  status: "sent" | "failed";
  messageId?: string;
  error?: string;
};

const normalizeObjectId = (value?: string | mongoose.Types.ObjectId | null) => {
  if (!value) return null;
  return typeof value === "string" ? new mongoose.Types.ObjectId(value) : value;
};

export const sendTransactionalEmail = async (
  input: SendEmailInput
): Promise<SendEmailResult> => {
  const fromName = process.env.SMTP_FROM_NAME || "EDUNEXUS";
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;

  let status: SendEmailResult["status"] = "failed";
  let messageId: string | undefined;
  let errorMessage: string | undefined;

  try {
    if (!isEmailConfigured()) {
      throw new Error("SMTP is not configured");
    }

    const transporter = getTransporter();
    const sent = await transporter.sendMail({
      from: `${fromName} <${fromAddress}>`,
      to: input.recipientEmail,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    status = "sent";
    messageId = sent.messageId;
  } catch (error: any) {
    status = "failed";
    errorMessage = error?.message || "Unknown email error";
    console.error("Email send failed:", {
      message: errorMessage,
      code: error?.code,
      responseCode: error?.responseCode,
      response: error?.response,
      command: error?.command,
      recipientEmail: input.recipientEmail,
      template: input.template,
      eventType: input.eventType,
    });
  }

  await EmailLog.create({
    recipientEmail: input.recipientEmail,
    recipientUser: normalizeObjectId(input.recipientUserId),
    subject: input.subject,
    template: input.template,
    eventType: input.eventType,
    status,
    providerMessageId: messageId || null,
    errorMessage: errorMessage || null,
    metadata: input.metadata || null,
    relatedEntityType: input.relatedEntityType || null,
    relatedEntityId: normalizeObjectId(input.relatedEntityId),
    sentAt: new Date(),
  });

  if (status === "failed") {
    return { status, error: errorMessage };
  }

  return { status, messageId };
};
