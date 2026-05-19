import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import * as otplib from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import { logActivity } from "../utils/activitieslog.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { buildSchoolInviteTemplate } from "../utils/emailTemplates.ts";
import { logMasterAuthAudit } from "../utils/masterAuthAudit.ts";
import {
  buildSchoolDbName,
  getSchoolTemplate,
} from "../utils/schoolOnboarding.ts";
import { prisma } from "../config/prisma.ts";
import {
  InviteStatus,
  PlanType,
  SchoolStatus,
  SchoolSubsystem,
  SchoolType,
} from "@prisma/client";

const masterJwtSecret = process.env.MASTER_JWT_SECRET || process.env.JWT_SECRET;
const masterPreAuthTtl = process.env.MASTER_PREAUTH_TTL || "10m";
const masterEmailOtpTtl = process.env.MASTER_EMAIL_OTP_TTL || "10m";
const masterPasswordChangeOtpTtl = process.env.MASTER_PASSWORD_CHANGE_OTP_TTL || "10m";
const getOtpLib = () => {
  if (
    typeof (otplib as any)?.verify !== "function" ||
    typeof (otplib as any)?.generateSecret !== "function" ||
    typeof (otplib as any)?.generateURI !== "function"
  ) {
    throw new Error("MFA authenticator is unavailable");
  }

  return otplib as any;
};

const buildOtpAuthUrl = (email: string, secret: string) => {
  const otpLib = getOtpLib();
  return otpLib.generateURI({
    issuer: "EDUNEXUS Master",
    label: email,
    secret,
  });
};

const verifyOtpToken = async (token: string, secret: string) => {
  const otpLib = getOtpLib();
  const result = await otpLib.verify({ token, secret });

  if (typeof result === "boolean") {
    return result;
  }

  return Boolean(result?.valid);
};

const parseDurationToMs = (value: string, fallbackMs: number) => {
  const normalized = String(value || "").trim().toLowerCase();
  const match = normalized.match(/^(\d+)([smhd])$/);

  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "s") return amount * 1000;
  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
};

const masterEmailOtpTtlMs = parseDurationToMs(masterEmailOtpTtl, 10 * 60 * 1000);
const masterPasswordChangeOtpTtlMs = parseDurationToMs(masterPasswordChangeOtpTtl, 10 * 60 * 1000);

const generateLoginEmailCode = () => String(randomInt(0, 1000000)).padStart(6, "0");

export const normalizeRecoveryCode = (value: string) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const generateRecoveryCode = () => {
  const rawCode = randomBytes(8).toString("hex").toUpperCase();
  const chunks = rawCode.match(/.{1,4}/g);
  return chunks ? chunks.join("-") : rawCode;
};

const generateRecoveryCodes = async (count = 10) => {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const code = generateRecoveryCode();
    codes.push(code);
    hashes.push(await bcrypt.hash(normalizeRecoveryCode(code), 10));
  }

  return { codes, hashes };
};

export const verifyAndConsumeRecoveryCode = async (
  candidateCode: string,
  recoveryCodeHashes: string[]
) => {
  const normalizedCode = normalizeRecoveryCode(candidateCode);

  for (let index = 0; index < recoveryCodeHashes.length; index += 1) {
    const hash = recoveryCodeHashes[index] ?? "";
    if (!hash) {
      continue;
    }

    const matches = await bcrypt.compare(normalizedCode, hash);
    if (matches) {
      const updated = [...recoveryCodeHashes];
      updated.splice(index, 1);
      return {
        matched: true,
        updatedHashes: updated,
      };
    }
  }

  return {
    matched: false,
    updatedHashes: recoveryCodeHashes,
  };
};

export const verifyMfaOrRecoveryCode = async (
  code: string,
  secret: string,
  recoveryCodeHashes: string[],
  allowRecoveryCode: boolean
) => {
  const validTotp = await verifyOtpToken(code, secret);
  if (validTotp) {
    return {
      valid: true,
      usedRecoveryCode: false,
      updatedRecoveryCodeHashes: recoveryCodeHashes,
    };
  }

  if (!allowRecoveryCode || recoveryCodeHashes.length === 0) {
    return {
      valid: false,
      usedRecoveryCode: false,
      updatedRecoveryCodeHashes: recoveryCodeHashes,
    };
  }

  const recoveryResult = await verifyAndConsumeRecoveryCode(code, recoveryCodeHashes);
  return {
    valid: recoveryResult.matched,
    usedRecoveryCode: recoveryResult.matched,
    updatedRecoveryCodeHashes: recoveryResult.updatedHashes,
  };
};

const buildMasterLoginOtpEmail = (name: string, code: string) => {
  const safeName = name || "Master";

  return {
    subject: "EDUNEXUS - code de connexion master",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
          <h2 style="margin:0 0 12px;font-size:24px;color:#0f172a;">Bonjour ${safeName},</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#334155;">Voici votre code de validation pour accéder au portail master EDUNEXUS.</p>
          <div style="display:inline-block;background:#0f172a;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:6px;padding:14px 22px;border-radius:12px;">
            ${code}
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Ce code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
        </div>
      </div>
    `,
    text: `Bonjour ${safeName},\n\nVotre code de validation EDUNEXUS est: ${code}\n\nCe code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
  };
};

const buildMasterPasswordChangeOtpEmail = (name: string, code: string) => {
  const safeName = name || "Master";

  return {
    subject: "EDUNEXUS - code de changement de mot de passe",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
          <h2 style="margin:0 0 12px;font-size:24px;color:#0f172a;">Bonjour ${safeName},</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#334155;">Voici votre code pour confirmer le changement du mot de passe master EDUNEXUS.</p>
          <div style="display:inline-block;background:#0f172a;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:6px;padding:14px 22px;border-radius:12px;">
            ${code}
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Ce code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette action, sécurisez votre compte immédiatement.</p>
        </div>
      </div>
    `,
    text: `Bonjour ${safeName},\n\nVotre code de confirmation de changement de mot de passe EDUNEXUS est: ${code}\n\nCe code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette action, sécurisez votre compte immédiatement.`,
  };
};

const signMasterSessionToken = (payload: { id: string; email: string; role: string }) =>
  jwt.sign(
    { tokenType: "master", ...payload },
    masterJwtSecret as string,
    { algorithm: "HS512", expiresIn: "8h" },
  );

const toOptionalDate = (value: unknown): Date | null => {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const getMasterEmailLogs = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const schoolId = String(req.query.schoolId || "").trim();
    const skip = (page - 1) * limit;

    const where: any = {
      ...(status ? { status } : {}),
      ...(schoolId ? { schoolId } : {}),
      ...(search
        ? {
            OR: [
              { to: { contains: search, mode: "insensitive" } },
              { subject: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.emailLog.count({ where }),
      prisma.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    ]);

    return res.json({
      logs,
      pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
      filters: { search: search || null, status: status || null, schoolId: schoolId || null },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const setSchoolConfig = async (req: Request, res: Response) => {
  try {
    const schoolId = String(req.params.schoolId);
    const config = await prisma.schoolConfig.upsert({
      where: { schoolId },
      create: {
        schoolId,
        termsPerYear: Number(req.body?.termsPerYear || 3),
        maxAbsences: Number(req.body?.maxAbsences ?? 10),
        smsEnabled: Boolean(req.body?.smsEnabled ?? false),
        offlineModeEnabled: Boolean(req.body?.offlineModeEnabled ?? true),
        aiAlertsEnabled: Boolean(req.body?.aiAlertsEnabled ?? true),
        messageModeration: Boolean(req.body?.messageModeration ?? false),
      },
      update: {
        termsPerYear: Number(req.body?.termsPerYear || 3),
        maxAbsences: Number(req.body?.maxAbsences ?? 10),
        smsEnabled: Boolean(req.body?.smsEnabled ?? false),
        offlineModeEnabled: Boolean(req.body?.offlineModeEnabled ?? true),
        aiAlertsEnabled: Boolean(req.body?.aiAlertsEnabled ?? true),
        messageModeration: Boolean(req.body?.messageModeration ?? false),
      },
    });

    return res.json({ message: "Config updated", config });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolConfig = async (req: Request, res: Response) => {
  try {
    const config = await prisma.schoolConfig.findUnique({ where: { schoolId: String(req.params.schoolId) } });
    return res.json(config || {});
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};


export const masterLogin = async (req: Request, res: Response) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
        isActive: true,
        isSuperAdmin: true,
      },
    });

    if (!masterUser || masterUser.isActive === false) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "login_invalid_credentials",
        email,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordOk = await bcrypt.compare(password, masterUser.passwordHash);
    if (!passwordOk) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "login_invalid_password",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const code = generateLoginEmailCode();
    const emailOtpHash = await bcrypt.hash(code, 10);
    const emailOtpExpiresAt = new Date(Date.now() + masterEmailOtpTtlMs).toISOString();

    const preAuthToken = jwt.sign(
      {
        tokenType: "master_preauth",
        id: masterUser.id,
        email: masterUser.email,
        emailOtpHash,
        emailOtpExpiresAt,
      },
      masterJwtSecret as string,
      { algorithm: "HS512", expiresIn: masterPreAuthTtl as any }
    );

    res.cookie("master_preauth", preAuthToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: parseDurationToMs(masterPreAuthTtl, 10 * 60 * 1000),
    });

    const emailContent = buildMasterLoginOtpEmail(masterUser.name, code);
    await sendTransactionalEmail({
      recipientEmail: masterUser.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      template: "master_login_otp",
      eventType: "master_login_otp",
    }).catch((emailError: any) => {
      console.error("[masterLogin] Email send error:", emailError);
    });

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "login_email_otp_sent",
      email: masterUser.email,
    });

    return res.json({
      message: "Verification code sent to your email",
      requiresEmailVerification: true,
    });
  } catch (error: any) {
    void logMasterAuthAudit({
      req,
      outcome: "failure",
      reason: "login_error",
      email: req.body?.email,
    });
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const masterVerifyEmailCode = async (req: Request, res: Response) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    const token = req.cookies?.master_preauth;
    const code = String(req.body?.code || "").trim();

    if (!token) {
      return res.status(401).json({ message: "Email challenge missing" });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Invalid email code format" });
    }

    const decoded = jwt.verify(token, masterJwtSecret, {
      algorithms: ["HS512"],
    }) as any;

    if (decoded?.tokenType !== "master_preauth") {
      return res.status(401).json({ message: "Invalid email challenge" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, isSuperAdmin: true, passwordHash: true },
    });

    if (!masterUser) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_user_not_authorized",
        email: decoded?.email,
      });
      return res.status(401).json({ message: "Not authorized" });
    }

    const tokenOtpHash =
      typeof decoded?.emailOtpHash === "string" && decoded.emailOtpHash.trim().length > 0
        ? decoded.emailOtpHash
        : null;
    const tokenOtpExpiresAt =
      typeof decoded?.emailOtpExpiresAt === "string"
        ? decoded.emailOtpExpiresAt
        : null;

    const effectiveOtpHash = tokenOtpHash;
    const effectiveOtpExpiresAt = tokenOtpExpiresAt;

    if (!effectiveOtpHash || !effectiveOtpExpiresAt) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_missing",
        email: masterUser.email,
      });

      return res.status(400).json({ message: "Email verification not initialized" });
    }

    const expiresAt = new Date(effectiveOtpExpiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_expired",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Email code expired" });
    }

    const isValidEmailCode = await bcrypt.compare(code, effectiveOtpHash);

    if (!isValidEmailCode) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_invalid",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid email verification code" });
    }

    // Vérifier si MFA est activé pour cet utilisateur
    const masterUserMfa = await prisma.masterUser.findUnique({
      where: { id: masterUser.id },
      select: { mfaEnabled: true, mfaSecret: true, mfaTempSecret: true },
    });

    // Si MFA activé → retourner un challenge TOTP au lieu de créer la session
    if (masterUserMfa?.mfaEnabled && masterUserMfa.mfaSecret) {
      // Créer un token intermédiaire pour la vérification MFA
      const mfaChallengeToken = jwt.sign(
        { tokenType: "master_mfa_challenge", id: masterUser.id, email: masterUser.email },
        masterJwtSecret as string,
        { algorithm: "HS512", expiresIn: "5m" }
      );

      res.cookie("master_mfa_challenge", mfaChallengeToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 5 * 60 * 1000, // 5 minutes
      });

      void logMasterAuthAudit({
        req,
        outcome: "success",
        reason: "email_otp_verified_mfa_required",
        email: masterUser.email,
      });

      return res.json({
        message: "Email verified. MFA required.",
        requiresMfa: true,
        mfaSetupRequired: false,
      });
    }

    // Pas de MFA → créer la session directement
    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "email_otp_verified",
      email: masterUser.email,
    });

    const sessionToken = signMasterSessionToken({
      id: masterUser.id,
      email: masterUser.email,
      role: masterUser.isSuperAdmin ? "super_admin" : "support",
    });

    res.cookie("master_jwt", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.clearCookie("master_preauth", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.json({
      message: "Master login successful",
      requiresMfa: false,
      role: masterUser.isSuperAdmin ? "super_admin" : "support",
      email: masterUser.email,
    });
  } catch (error: any) {
    void logMasterAuthAudit({
      req,
      outcome: "failure",
      reason: "email_otp_verification_error",
      email: req.body?.email,
    });
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

// @desc    Vérifie le code TOTP lors du login master (étape 3 du flow)
// @route   POST /api/master/auth/verify-mfa
// @access  Public (cookie master_mfa_challenge requis)
export const verifyMasterMfaLogin = async (req: Request, res: Response) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    const challengeToken = req.cookies?.master_mfa_challenge;
    if (!challengeToken) {
      return res.status(401).json({ message: "MFA challenge missing or expired" });
    }

    const code = String(req.body?.code || "").trim();
    if (!code) {
      return res.status(400).json({ message: "MFA code required" });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(challengeToken, masterJwtSecret, { algorithms: ["HS512"] });
    } catch {
      return res.status(401).json({ message: "MFA challenge expired. Please login again." });
    }

    if (decoded?.tokenType !== "master_mfa_challenge") {
      return res.status(401).json({ message: "Invalid MFA challenge" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        mfaEnabled: true,
        mfaSecret: true,
        mfaRecoveryCodeHashes: true,
      },
    });

    if (!masterUser || !masterUser.mfaEnabled || !masterUser.mfaSecret) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Vérifier TOTP ou recovery code
    const mfaResult = await verifyMfaOrRecoveryCode(
      code,
      masterUser.mfaSecret,
      masterUser.mfaRecoveryCodeHashes,
      true
    );

    if (!mfaResult.valid) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "mfa_login_invalid_code",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid MFA code" });
    }

    // Si recovery code utilisé, consommer le code
    if (mfaResult.usedRecoveryCode) {
      await prisma.masterUser.update({
        where: { id: masterUser.id },
        data: { mfaRecoveryCodeHashes: mfaResult.updatedRecoveryCodeHashes },
      });
    }

    // Créer la session master
    const sessionToken = signMasterSessionToken({
      id: masterUser.id,
      email: masterUser.email,
      role: masterUser.isSuperAdmin ? "super_admin" : "support",
    });

    res.cookie("master_jwt", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.clearCookie("master_mfa_challenge", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: mfaResult.usedRecoveryCode ? "mfa_login_recovery_code" : "mfa_login_totp",
      email: masterUser.email,
    });

    return res.json({
      message: "Master login successful",
      role: masterUser.isSuperAdmin ? "super_admin" : "support",
      email: masterUser.email,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getMasterAuthAuditLogs = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const filters: any = {};
    if (req.query.reason) filters.action = { contains: String(req.query.reason), mode: "insensitive" };
    if (req.query.email) filters.description = { contains: String(req.query.email).trim().toLowerCase(), mode: "insensitive" };

    const [logs, total] = await Promise.all([
      prisma.masterAuthAudit.findMany({
        where: filters,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.masterAuthAudit.count({ where: filters }),
    ]);

    return res.json({
      logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const masterMe = async (req: Request, res: Response) => {
  if (!req.masterUser) {
    return res.status(401).json({ message: "Not authorized" });
  }

  return res.json({ user: req.masterUser });
};

export const getMasterMfaStatus = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: {
        mfaEnabled: true,
        mfaTempSecret: true,
        mfaRecoveryCodeHashes: true,
        mfaRecoveryCodeGeneratedAt: true,
      },
    });

    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    return res.json({
      mfaEnabled: masterUser.mfaEnabled,
      hasPendingMfaSetup: Boolean(masterUser.mfaTempSecret),
      recoveryCodesRemaining: masterUser.mfaRecoveryCodeHashes.length,
      recoveryCodesGeneratedAt: masterUser.mfaRecoveryCodeGeneratedAt,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const beginMasterMfaEnable = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: { id: true, email: true, mfaEnabled: true },
    });

    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    if (masterUser.mfaEnabled) {
      return res.status(400).json({ message: "MFA is already enabled" });
    }

    const otpLib = getOtpLib();
    const tempSecret = otpLib.generateSecret();

    await prisma.masterUser.update({
      where: { id: masterUser.id },
      data: { mfaTempSecret: tempSecret },
    });

    const otpAuthUrl = buildOtpAuthUrl(masterUser.email, tempSecret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "mfa_setup_initiated",
      email: masterUser.email,
    });

    return res.json({
      message: "MFA setup initiated",
      qrCodeDataUrl: qrCodeDataUrl,
      manualEntryKey: tempSecret,
      otpAuthUrl,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const confirmMasterMfaEnable = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const totpCode = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(totpCode)) {
      return res.status(400).json({ message: "Invalid TOTP code format" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: { id: true, email: true, mfaEnabled: true, mfaTempSecret: true },
    });

    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    if (masterUser.mfaEnabled) {
      return res.status(400).json({ message: "MFA is already enabled" });
    }

    if (!masterUser.mfaTempSecret) {
      return res.status(400).json({ message: "MFA setup not initiated. Call beginMasterMfaEnable first." });
    }

    const isValid = await verifyOtpToken(totpCode, masterUser.mfaTempSecret);
    if (!isValid) {
      void logMasterAuthAudit({ req, outcome: "failure", reason: "mfa_setup_invalid_totp", email: masterUser.email });
      return res.status(401).json({ message: "Invalid TOTP code" });
    }

    const { codes, hashes } = await generateRecoveryCodes(10);

    await prisma.masterUser.update({
      where: { id: masterUser.id },
      data: {
        mfaEnabled: true,
        mfaSecret: masterUser.mfaTempSecret,
        mfaTempSecret: null,
        mfaRecoveryCodeHashes: hashes,
        mfaRecoveryCodeGeneratedAt: new Date(),
      },
    });

    void logMasterAuthAudit({ req, outcome: "success", reason: "mfa_enabled", email: masterUser.email });

    return res.json({ message: "MFA enabled successfully", recoveryCodes: codes });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const disableMasterMfa = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: { id: true, email: true, mfaEnabled: true },
    });

    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    if (!masterUser.mfaEnabled) {
      return res.status(400).json({ message: "MFA is not enabled" });
    }

    await prisma.masterUser.update({
      where: { id: masterUser.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaTempSecret: null,
        mfaRecoveryCodeHashes: [],
        mfaRecoveryCodeGeneratedAt: null,
      },
    });

    void logMasterAuthAudit({ req, outcome: "success", reason: "mfa_disabled", email: masterUser.email });

    return res.json({ message: "MFA disabled successfully" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const regenerateMasterRecoveryCodes = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: { id: true, email: true, mfaEnabled: true },
    });

    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    if (!masterUser.mfaEnabled) {
      return res.status(400).json({ message: "MFA is not enabled" });
    }

    const { codes, hashes } = await generateRecoveryCodes(10);

    await prisma.masterUser.update({
      where: { id: masterUser.id },
      data: { mfaRecoveryCodeHashes: hashes, mfaRecoveryCodeGeneratedAt: new Date() },
    });

    void logMasterAuthAudit({ req, outcome: "success", reason: "recovery_codes_regenerated", email: masterUser.email });

    return res.json({ message: "Recovery codes regenerated", recoveryCodes: codes });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const startMasterPasswordChange = async (req: Request, res: Response) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Fetch master user via Prisma
    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
      },
    });

    if (!masterUser || masterUser.isActive === false) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const code = generateLoginEmailCode();
    const emailOtpHash = await bcrypt.hash(code, 10);
    const masterPasswordChangeOtpTtlMs = 15 * 60 * 1000;
    const emailOtpExpiresAt = new Date(Date.now() + masterPasswordChangeOtpTtlMs).toISOString();

    const challengeToken = jwt.sign(
      {
        tokenType: "master_password_change",
        id: masterUser.id,
        email: masterUser.email,
        emailOtpHash,
        emailOtpExpiresAt,
      },
      masterJwtSecret as string,
      { algorithm: "HS512", expiresIn: "15m" }
    );

    res.cookie("master_pwd_change_challenge", challengeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: masterPasswordChangeOtpTtlMs,
    });

    const emailContent = buildMasterPasswordChangeOtpEmail(masterUser.name, code);
    await sendTransactionalEmail({
      recipientEmail: masterUser.email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      template: "master_password_change_code",
      eventType: "master_password_change_otp",
    }).catch((emailError: any) => {
      console.error("[startMasterPasswordChange] Email send error:", emailError);
    });

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "password_change_email_otp_sent",
      email: masterUser.email,
    });

    return res.json({
      message: "Email verification code sent for password change",
      requiresEmailVerification: true,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const confirmMasterPasswordChange = async (req: Request, res: Response) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const challengeToken = req.cookies?.master_pwd_change_challenge;
    if (!challengeToken) {
      return res.status(401).json({ message: "Password-change challenge missing" });
    }

    const emailCode = String(req.body?.emailCode || "").trim();
    const newPassword = String(req.body?.newPassword || "");
    const confirmNewPassword = String(req.body?.confirmNewPassword || "");

    if (!/^\d{6}$/.test(emailCode)) {
      return res.status(400).json({ message: "Invalid email code format" });
    }

    if (newPassword.length < 12) {
      return res.status(400).json({ message: "New password must contain at least 12 characters" });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(challengeToken, masterJwtSecret, {
        algorithms: ["HS512"],
      });
    } catch (jwtError: any) {
      return res.status(401).json({ message: "Password-change challenge expired or invalid" });
    }

    if (decoded?.tokenType !== "master_password_change") {
      return res.status(401).json({ message: "Invalid password-change challenge" });
    }

    if (String(decoded.id) !== String(req.masterUser.id)) {
      return res.status(401).json({ message: "Password-change challenge does not match current user" });
    }

    // Extract OTP hash from JWT token (Prisma approach: stored in JWT, not database)
    const emailOtpHash = decoded.emailOtpHash;
    const emailOtpExpiresAt = decoded.emailOtpExpiresAt;

    if (!emailOtpHash || !emailOtpExpiresAt) {
      return res.status(400).json({ message: "Password-change email verification is not initialized" });
    }

    const expiresAt = new Date(emailOtpExpiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      return res.status(401).json({ message: "Email code expired" });
    }

    // Verify email code against JWT-stored hash
    const isValidEmailCode = await bcrypt.compare(emailCode, emailOtpHash);
    if (!isValidEmailCode) {
      return res.status(401).json({ message: "Invalid email verification code" });
    }

    // Fetch master user via Prisma
    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!masterUser || masterUser.isActive === false) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, masterUser.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password via Prisma
    await prisma.masterUser.update({
      where: { id: req.masterUser.id },
      data: { passwordHash: hashedPassword },
    });

    res.clearCookie("master_pwd_change_challenge", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "password_changed_from_security_dashboard",
      email: masterUser.email,
    });

    return res.json({
      message: "Password changed successfully",
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const masterLogout = async (_req: Request, res: Response) => {
  res.clearCookie("master_jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.clearCookie("master_preauth", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.clearCookie("master_pwd_change_challenge", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.clearCookie("master_mfa_challenge", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res.json({ message: "Master logout successful" });
};

/**
 * SCHOOLS MANAGEMENT
 */

const legacyPlanFromInput = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "premium") return PlanType.PREMIUM;
  if (normalized === "standard") return PlanType.STANDARD;
  return PlanType.DISCOVERY;
};

const legacySchoolTypeFromInput = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  // Normalize to a lookup-friendly key: "primary school" -> "primary_school"
  const key = normalized.replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "");

  const map: Record<string, SchoolType> = {
    primary: SchoolType.PRIMARY,
    primary_school: SchoolType.PRIMARY,
    preschool: SchoolType.PRESCHOOL,
    nursery: SchoolType.PRESCHOOL,
    preschool_school: SchoolType.PRESCHOOL,
    secondary: SchoolType.SECONDARY,
    secondary_school: SchoolType.SECONDARY,
    multi: SchoolType.MULTI,
    multi_school: SchoolType.MULTI,
    multi_level: SchoolType.MULTI,
    "multi-level": SchoolType.MULTI,
  };

  if (Object.prototype.hasOwnProperty.call(map, key)) {
    return map[key];
  }

  // Fallback: if nothing matches, default to SECONDARY
  return SchoolType.SECONDARY;
};

const legacySchoolStatusFromInput = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pending") return SchoolStatus.PENDING;
  if (normalized === "approved") return SchoolStatus.APPROVED;
  if (normalized === "active") return SchoolStatus.ACTIVE;
  if (normalized === "suspended") return SchoolStatus.SUSPENDED;
  return SchoolStatus.REJECTED;
};

const normalizeSchoolSubdomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const readString = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

export const createSchool = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Only super_admin can create schools" });
    }

    const body = req.body ?? {};
    const schoolName = String(body.schoolName || body.name || "").trim();

    if (!schoolName) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const subdomain = buildSchoolDbName(schoolName)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!subdomain) {
      return res.status(400).json({ message: "Invalid school subdomain" });
    }

    const school = await prisma.school.create({
      data: {
        name: schoolName,
        subdomain,
        type: legacySchoolStatusFromInput(String(body.systemType || body.type)) === SchoolStatus.REJECTED
          ? SchoolType.SECONDARY
          : legacySchoolTypeFromInput(String(body.systemType || body.type)),
        plan: legacyPlanFromInput(String(body.plan)),
        status: SchoolStatus.ACTIVE,
        city: String(body.location || body.city || "").trim() || null,
        region: String(body.region || "").trim() || null,
        address: String(body.address || body.location || "").trim() || null,
        phone: String(body.contactPhone || body.phone || "").trim() || null,
        email: String(body.contactEmail || body.email || "").trim().toLowerCase() || null,
        subsystem: SchoolSubsystem.FRANCOPHONE,
        contractEnd: body.contractEnd ? new Date(body.contractEnd) : null,
      },
    });

    await logActivity({
      userId: String(req.masterUser?.id || ""),
      action: "Created school",
      details: `${school.name} (${school.subdomain})`,
      schoolId: school.id,
    });

    return res.status(201).json({
      message: "School created",
      school,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

/**
 * POST /api/master/schools/invite
 *
 * Flux principal du dashboard super admin — modale "✉ Inviter une école" :
 *   1. Super admin saisit l'email du responsable (+ nom et template optionnels)
 *   2. Crée la School en statut "pending"
 *   3. Génère un SchoolInvite avec token UUID sécurisé (expire 7j)
 *   4. Envoie un email d'invitation à requestedAdminEmail
 *   5. L'école apparaît dans l'onglet PENDING du Hub de Contrôle
 *
 * Body :
 *   - requestedAdminEmail  (requis)
 *   - schoolName           (optionnel — déduit de l'email si absent)
 *   - templateKey          (optionnel — défaut: "fr_secondary")
 *   - plan                 (optionnel — "premium" | "standard" | "decouverte", défaut: "standard")
 *
 * ⚠️  Route à placer AVANT /:schoolId dans masterAdmin.ts (routes) :
 *     router.post("/schools/invite", protectMaster, authorizeMaster(["super_admin"]),
 *       masterMfaLimiter, requireMasterSensitiveAuth, inviteSchool);
 */
export const inviteSchool = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Only super_admin can invite schools" });
    }

    const body = req.body ?? {};
    const requestedAdminEmail = readString(body.requestedAdminEmail, body.email).toLowerCase();
    const schoolName = readString(body.schoolName, body.name);
    const templateKey = readString(body.templateKey) || "fr_secondary";
    const plan = legacyPlanFromInput(readString(body.plan, body.subscriptionPlan));

    if (!requestedAdminEmail || !schoolName) {
      return res.status(400).json({ message: "L'email et le nom de l'établissement sont requis" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedAdminEmail)) {
      return res.status(400).json({ message: "Email invalide" });
    }

    const template = getSchoolTemplate(templateKey) ?? getSchoolTemplate("fr_secondary")!;
    const subdomain = normalizeSchoolSubdomain(buildSchoolDbName(schoolName));
    const existingInvite = await prisma.schoolInvite.findFirst({
      where: {
        email: requestedAdminEmail,
        status: InviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      await prisma.schoolInvite.updateMany({
        where: { email: requestedAdminEmail, status: InviteStatus.PENDING },
        data: { status: InviteStatus.EXPIRED },
      });
    }

    const school = await prisma.school.create({
      data: {
        name: schoolName,
        subdomain,
        type: legacySchoolTypeFromInput(readString(body.systemType, body.type)),
        plan,
        status: SchoolStatus.PENDING,
        email: requestedAdminEmail,
        subsystem: SchoolSubsystem.FRANCOPHONE,
      },
    });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${token}`;

    const invite = await prisma.schoolInvite.create({
      data: {
        email: requestedAdminEmail,
        schoolName,
        token,
        plan,
        status: InviteStatus.PENDING,
        expiresAt,
        schoolId: school.id,
      },
    });

    const inviteTemplate = buildSchoolInviteTemplate({
      schoolName,
      requestedAdminName: "Administrateur",
      activationUrl,
      language: "fr",
    });

    await sendTransactionalEmail({
      recipientEmail: requestedAdminEmail,
      subject: inviteTemplate.subject,
      html: inviteTemplate.html,
      text: inviteTemplate.text,
      template: "school_invite",
      eventType: "school_invite",
      relatedEntityType: "School",
      relatedEntityId: school.id,
      metadata: {
        schoolId: school.id,
        token,
        templateKey,
        plan: String(body.plan || "standard").toLowerCase(),
      },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Invited school",
      details: `${schoolName} → ${requestedAdminEmail} (template: ${template.key}, plan: ${plan})`,
      schoolId: school.id,
    });

    return res.status(201).json({
      message: "Invitation envoyée",
      invite: {
        token: invite.token,
        email: invite.email,
        schoolName: invite.schoolName,
        templateKey: template.key,
        plan: invite.plan,
      },
      school,
    });
  } catch (error: any) {
    console.error("[inviteSchool] Error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const listSchools = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const schools = await prisma.school.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        schoolConfig: true,
        schoolSettings: true,
        invites: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return res.json({
      schools: schools.map((school) => ({
        ...school,
        latestInvite: school.invites[0] || null,
      })),
      total: schools.length,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchool = async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({
      where: { id: String(req.params.schoolId) },
      include: {
        schoolConfig: true,
        schoolSettings: true,
        invites: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        activitiesLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.json(school);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const updateSchool = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Only super_admin can update schools" });
    }

    const body = req.body ?? {};
    const data: Record<string, any> = {};

    const name = readString(body.schoolName, body.name);
    if (name) data.name = name;

    const subdomain = readString(body.subdomain, body.dbName);
    if (subdomain) data.subdomain = normalizeSchoolSubdomain(subdomain);

    if (body.systemType || body.type) {
      data.type = legacySchoolTypeFromInput(readString(body.systemType, body.type));
    }

    if (body.plan) {
      data.plan = legacyPlanFromInput(readString(body.plan));
    }

    if (body.status) {
      data.status = legacySchoolStatusFromInput(readString(body.status));
    }

    if (body.city || body.location) data.city = readString(body.city, body.location) || null;
    if (body.region) data.region = readString(body.region) || null;
    if (body.address || body.location) data.address = readString(body.address, body.location) || null;
    if (body.phone || body.contactPhone) data.phone = readString(body.phone, body.contactPhone) || null;
    if (body.email || body.contactEmail) data.email = readString(body.email, body.contactEmail).toLowerCase() || null;
    if (body.logoUrl) data.logoUrl = readString(body.logoUrl) || null;
    if (body.contractEnd) data.contractEnd = toOptionalDate(body.contractEnd) || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No updatable school fields provided" });
    }

    const school = await prisma.school.update({
      where: { id: String(req.params.schoolId) },
      data,
    });

    return res.json({ message: "School updated", school });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "School not found" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolActivityLogs = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || "").trim();
    const skip = (page - 1) * limit;

    const where: any = { schoolId };
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.activitiesLog.count({ where }),
      prisma.activitiesLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return res.json({
      logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const suspendSchool = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const reason = String(req.body?.reason || req.body?.motif || "").trim();
    const school = await prisma.school.update({
      where: { id: String(req.params.schoolId) },
      data: { status: SchoolStatus.SUSPENDED },
    });

    await prisma.schoolInvite.updateMany({
      where: { schoolId: school.id, status: InviteStatus.PENDING },
      data: { status: InviteStatus.EXPIRED },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Suspended school",
      details: `${school.name}${reason ? ` - ${reason}` : ""}`,
      schoolId: school.id,
    });

    return res.json({ message: "School suspended", school });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "School not found" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const reactivateSchool = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const school = await prisma.school.update({
      where: { id: String(req.params.schoolId) },
      data: { status: SchoolStatus.ACTIVE },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Reactivated school",
      details: school.name,
      schoolId: school.id,
    });

    return res.json({ message: "School reactivated", school });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "School not found" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const deleteSchool = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const school = await prisma.school.findUnique({
      where: { id: String(req.params.schoolId) },
      select: { id: true, name: true, subdomain: true },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    await prisma.schoolInvite.deleteMany({ where: { schoolId: school.id } });
    await prisma.school.delete({ where: { id: school.id } });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Deleted school",
      details: `${school.name} (${school.subdomain})`,
      schoolId: school.id,
    });

    return res.json({ message: "School deleted", schoolId: school.id });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "School not found" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const regenerateSchoolInvite = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const school = await prisma.school.findUnique({
      where: { id: String(req.params.schoolId) },
      include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const currentInvite = school.invites[0] || null;
    if (currentInvite?.status === InviteStatus.PENDING) {
      await prisma.schoolInvite.update({
        where: { id: currentInvite.id },
        data: { status: InviteStatus.EXPIRED },
      });
    }

    const recipientEmail = school.email || currentInvite?.email || null;
    if (!recipientEmail) {
      return res.status(400).json({ message: "No admin email configured for this school" });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h
    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${token}`;
    const inviteTemplate = buildSchoolInviteTemplate({
      schoolName: school.name,
      requestedAdminName: school.name,
      activationUrl,
      language: "fr",
    });

    const invite = await prisma.schoolInvite.create({
      data: {
        email: recipientEmail,
        schoolName: school.name,
        token,
        status: InviteStatus.PENDING,
        plan: school.plan,
        expiresAt,
        schoolId: school.id,
      },
    });

    await sendTransactionalEmail({
      recipientEmail,
      subject: inviteTemplate.subject,
      html: inviteTemplate.html,
      text: inviteTemplate.text,
      template: "school_invite",
      eventType: "school_invite",
      relatedEntityType: "School",
      relatedEntityId: school.id,
      metadata: { schoolId: school.id, token, regenerated: true },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Regenerated school invite",
      details: school.name,
      schoolId: school.id,
    });

    return res.json({
      message: "School invite regenerated",
      invite: {
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt,
        requestedAdminName: invite.schoolName,
        requestedAdminEmail: invite.email,
      },
      activationUrl,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const resendSchoolInviteEmail = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const school = await prisma.school.findUnique({
      where: { id: String(req.params.schoolId) },
      include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const invite = school.invites[0] || null;
    const recipientEmail = school.email || invite?.email || null;

    if (!recipientEmail) {
      return res.status(400).json({ message: "No admin email configured for this school" });
    }

    if (!invite) {
      return res.status(404).json({ message: "No invite found for this school" });
    }

    if (invite.status !== InviteStatus.PENDING) {
      return res.status(409).json({ message: "No pending invite to resend. Please regenerate first." });
    }

    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${invite.token}`;
    const inviteTemplate = buildSchoolInviteTemplate({
      schoolName: school.name,
      requestedAdminName: invite.schoolName || school.name,
      activationUrl,
      language: "fr",
    });

    await sendTransactionalEmail({
      recipientEmail,
      subject: inviteTemplate.subject,
      html: inviteTemplate.html,
      text: inviteTemplate.text,
      template: "school_invite",
      eventType: "school_invite",
      relatedEntityType: "School",
      relatedEntityId: school.id,
      metadata: { schoolId: school.id, resend: true },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Resent school invite email",
      details: school.name,
      schoolId: school.id,
    });

    return res.json({
      message: "Invite email resent",
      invite: {
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt,
        requestedAdminName: invite.schoolName,
        requestedAdminEmail: invite.email,
      },
      activationUrl,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolInviteEmailStatus = async (req: Request, res: Response) => {
  try {
    const schoolId = String(req.params.schoolId);

    const lastEmail = await prisma.emailLog.findFirst({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ lastEmail: lastEmail || null });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

/**
 * SCHOOL CONFIGS
 */
