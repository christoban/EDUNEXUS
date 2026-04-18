import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import * as otplib from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import { dbRouter } from "../config/dbRouter.ts";
import School from "../models/school.ts";
import SchoolComplex from "../models/schoolComplex.ts";
import SchoolConfig from "../models/schoolConfig.ts";
import SchoolInvite from "../models/schoolInvite.ts";
import EmailLog from "../models/emailLog.ts";
import MasterUser from "../models/masterUser.ts";
import ActivitiesLog from "../models/activitieslog.ts";
import MasterAuthAudit from "../models/masterAuthAudit.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { buildSchoolInviteTemplate } from "../utils/emailTemplates.ts";
import { logMasterAuthAudit } from "../utils/masterAuthAudit.ts";

const masterJwtSecret = process.env.MASTER_JWT_SECRET || process.env.JWT_SECRET;
const masterPreAuthTtl = process.env.MASTER_PREAUTH_TTL || "10m";
const masterEmailOtpTtl = process.env.MASTER_EMAIL_OTP_TTL || "10m";
const masterPasswordChangeOtpTtl = process.env.MASTER_PASSWORD_CHANGE_OTP_TTL || "10m";
const authenticator = (otplib as any).authenticator;

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

const normalizeRecoveryCode = (value: string) =>
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

const verifyAndConsumeRecoveryCode = async (
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

const verifyMfaOrRecoveryCode = async (
  code: string,
  secret: string,
  recoveryCodeHashes: string[],
  allowRecoveryCode: boolean
) => {
  const validTotp = authenticator.verify({ token: code, secret });
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

const signMasterSessionToken = (payload: {
  id: string;
  email: string;
  role: string;
}) => {
  if (!masterJwtSecret) {
    throw new Error("Master auth misconfigured");
  }

  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      tokenType: "master",
    },
    masterJwtSecret,
    { expiresIn: "30d", algorithm: "HS512" }
  );
};

const signMasterPreAuthToken = (payload: {
  id: string;
  email: string;
  role: string;
}) => {
  if (!masterJwtSecret) {
    throw new Error("Master auth misconfigured");
  }

  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      tokenType: "master_preauth",
    },
    masterJwtSecret,
    { expiresIn: masterPreAuthTtl as any, algorithm: "HS512" }
  );
};

const signMasterPasswordChangeChallengeToken = (payload: {
  id: string;
  email: string;
}) => {
  if (!masterJwtSecret) {
    throw new Error("Master auth misconfigured");
  }

  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      tokenType: "master_password_change",
    },
    masterJwtSecret,
    { expiresIn: masterPasswordChangeOtpTtl as any, algorithm: "HS512" }
  );
};

const getAllowedMasterEmails = () => {
  const raw = process.env.MASTER_ALLOWED_EMAILS?.trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
};

/**
 * AUTH MASTER
 */

export const masterLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "missing_credentials",
        email,
      });
      return res.status(400).json({ message: "Email and password required" });
    }

    if (!masterJwtSecret) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "server_misconfigured",
        email,
      });
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const allowedMasterEmails = getAllowedMasterEmails();

    if (allowedMasterEmails.length > 0 && !allowedMasterEmails.includes(normalizedEmail)) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_not_allowlisted",
        email: normalizedEmail,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);

    const masterUser = await MasterUserModel.findOne({ email: normalizedEmail });

    if (!masterUser) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "user_not_found",
        email: normalizedEmail,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (masterUser.isActive === false) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "inactive_account",
        email: normalizedEmail,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await masterUser.matchPassword(password);
    if (!isMatch) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "invalid_password",
        email: normalizedEmail,
      });
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const emailOtpCode = generateLoginEmailCode();
    const emailOtpHash = await bcrypt.hash(emailOtpCode, 10);
    const emailOtpExpiresAt = new Date(Date.now() + masterEmailOtpTtlMs);

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $set: {
          loginEmailOtpHash: emailOtpHash,
          loginEmailOtpExpiresAt: emailOtpExpiresAt,
          loginEmailOtpAttempts: 0,
          loginEmailOtpSentAt: new Date(),
        },
      }
    );

    const otpEmail = buildMasterLoginOtpEmail(masterUser.name || masterUser.email, emailOtpCode);
    const emailResult = await sendTransactionalEmail({
      recipientEmail: masterUser.email,
      recipientUserId: masterUser._id,
      subject: otpEmail.subject,
      html: otpEmail.html,
      text: otpEmail.text,
      template: "master_login_otp",
      eventType: "master_login_otp",
      relatedEntityType: "MasterUser",
      relatedEntityId: masterUser._id,
      metadata: {
        purpose: "master_login_email_otp",
        ttlMs: masterEmailOtpTtlMs,
      },
    });

    if (emailResult.status !== "sent") {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $unset: {
            loginEmailOtpHash: 1,
            loginEmailOtpExpiresAt: 1,
            loginEmailOtpAttempts: 1,
            loginEmailOtpSentAt: 1,
          },
        }
      );

      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_send_failed",
        email: masterUser.email,
      });

      return res.status(500).json({ message: "Unable to send the email verification code" });
    }

    const preAuthToken = signMasterPreAuthToken({
      id: String(masterUser._id),
      email: masterUser.email,
      role: masterUser.role,
    });

    res.cookie("master_preauth", preAuthToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 10 * 60 * 1000,
    });

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "password_verified_email_otp_sent",
      email: masterUser.email,
    });

    return res.json({
      message: "Email verification code sent",
      requiresEmailVerification: true,
      role: masterUser.role,
      email: masterUser.email,
    });
  } catch (error: any) {
    void logMasterAuthAudit({
      req,
      outcome: "failure",
      reason: "server_error",
      email: req.body?.email,
    });
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

const masterVerifyEmailCodeLegacy = async (req: Request, res: Response) => {
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

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(decoded.id)
      .select(
        "_id email role name isActive mfaEnabled mfaSecret mfaTempSecret loginEmailOtpHash loginEmailOtpExpiresAt loginEmailOtpAttempts"
      )
      .lean<{
        _id: any;
        email: string;
        role: string;
        name?: string | null;
        isActive: boolean;
        mfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaTempSecret?: string | null;
        loginEmailOtpHash?: string | null;
        loginEmailOtpExpiresAt?: string | Date | null;
        loginEmailOtpAttempts?: number | null;
      }>();

    if (!masterUser || masterUser.isActive === false) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_user_not_authorized",
        email: decoded?.email,
      });
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!masterUser.loginEmailOtpHash || !masterUser.loginEmailOtpExpiresAt) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_missing",
        email: masterUser.email,
      });
      return res.status(400).json({ message: "Email verification not initialized" });
    }

    const expiresAt = new Date(masterUser.loginEmailOtpExpiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $unset: {
            loginEmailOtpHash: 1,
            loginEmailOtpExpiresAt: 1,
            loginEmailOtpAttempts: 1,
            loginEmailOtpSentAt: 1,
          },
        }
      );

      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_expired",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Email code expired" });
    }

    const attempts = Number(masterUser.loginEmailOtpAttempts || 0);
    if (attempts >= 5) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $unset: {
            loginEmailOtpHash: 1,
            loginEmailOtpExpiresAt: 1,
            loginEmailOtpAttempts: 1,
            loginEmailOtpSentAt: 1,
          },
        }
      );

      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_attempts_exceeded",
        email: masterUser.email,
      });
      return res.status(429).json({ message: "Too many email code attempts" });
    }

    const isValidEmailCode = await bcrypt.compare(code, masterUser.loginEmailOtpHash);

    if (!isValidEmailCode) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        { $inc: { loginEmailOtpAttempts: 1 } }
      );

      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_invalid",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid email verification code" });
    }

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $unset: {
          loginEmailOtpHash: 1,
          loginEmailOtpExpiresAt: 1,
          loginEmailOtpAttempts: 1,
          loginEmailOtpSentAt: 1,
        },
      }
    );

    if (masterUser.mfaEnabled && masterUser.mfaSecret) {
      void logMasterAuthAudit({
        req,
        outcome: "success",
        reason: "email_otp_verified_mfa_required",
        email: masterUser.email,
      });

      return res.json({
        requiresMfa: true,
        mfaSetupRequired: false,
        message: "MFA verification required",
        email: masterUser.email,
        role: masterUser.role,
      });
    }

    const setupSecret = masterUser.mfaTempSecret || authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(masterUser.email, "EDUNEXUS Master", setupSecret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $set: {
          mfaTempSecret: setupSecret,
          mfaEnabled: false,
        },
      }
    );

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "email_otp_verified_mfa_setup_issued",
      email: masterUser.email,
    });

    return res.json({
      message: "MFA setup required",
      requiresMfa: true,
      mfaSetupRequired: true,
      qrCodeDataUrl,
      manualEntryKey: setupSecret,
      email: masterUser.email,
      role: masterUser.role,
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

export const masterVerifyMfa = async (req: Request, res: Response) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    const token = req.cookies?.master_preauth;
    const code = String(req.body?.code || "").trim();

    if (!token) {
      return res.status(401).json({ message: "MFA challenge missing" });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Invalid MFA code format" });
    }

    const decoded = jwt.verify(token, masterJwtSecret, {
      algorithms: ["HS512"],
    }) as any;

    if (decoded?.tokenType !== "master_preauth") {
      return res.status(401).json({ message: "Invalid MFA challenge" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(decoded.id)
      .select("_id email role isActive mfaEnabled mfaSecret mfaTempSecret mfaRecoveryCodeHashes")
      .lean<{
        _id: any;
        email: string;
        role: string;
        isActive: boolean;
        mfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaTempSecret?: string | null;
        mfaRecoveryCodeHashes?: string[] | null;
      }>();

    if (!masterUser || masterUser.isActive === false) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "mfa_user_not_authorized",
        email: decoded?.email,
      });
      return res.status(401).json({ message: "Not authorized" });
    }

    const isMfaSetupFlow = !masterUser.mfaEnabled;
    const secret = isMfaSetupFlow ? masterUser.mfaTempSecret : masterUser.mfaSecret;
    const recoveryCodeHashes = Array.isArray(masterUser.mfaRecoveryCodeHashes)
      ? masterUser.mfaRecoveryCodeHashes
      : [];

    if (!secret) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "mfa_secret_missing",
        email: masterUser.email,
      });
      return res.status(400).json({ message: "MFA not initialized" });
    }

    const verification = await verifyMfaOrRecoveryCode(
      code,
      secret,
      recoveryCodeHashes,
      !isMfaSetupFlow
    );

    if (!verification.valid) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "mfa_invalid_code",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid MFA code" });
    }

    if (verification.usedRecoveryCode) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $set: {
            mfaRecoveryCodeHashes: verification.updatedRecoveryCodeHashes,
          },
        }
      );
    }

    if (isMfaSetupFlow) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $set: {
            mfaEnabled: true,
            mfaSecret: secret,
          },
          $unset: {
            mfaTempSecret: 1,
          },
        }
      );
    }

    const sessionToken = signMasterSessionToken({
      id: String(masterUser._id),
      email: masterUser.email,
      role: masterUser.role,
    });

    res.cookie("master_jwt", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.clearCookie("master_preauth", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: verification.usedRecoveryCode ? "mfa_recovery_code_used" : isMfaSetupFlow ? "mfa_setup_completed" : "mfa_verified",
      email: masterUser.email,
    });

    return res.json({
      message: "Master login successful",
      role: masterUser.role,
      email: masterUser.email,
    });
  } catch (error: any) {
    void logMasterAuthAudit({
      req,
      outcome: "failure",
      reason: "mfa_verification_error",
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

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(decoded.id)
      .select(
        "_id email role name isActive mfaEnabled mfaSecret mfaTempSecret loginEmailOtpHash loginEmailOtpExpiresAt loginEmailOtpAttempts"
      )
      .lean<{
        _id: any;
        email: string;
        role: string;
        name?: string | null;
        isActive: boolean;
        mfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaTempSecret?: string | null;
        loginEmailOtpHash?: string | null;
        loginEmailOtpExpiresAt?: string | Date | null;
        loginEmailOtpAttempts?: number | null;
      }>();

    if (!masterUser || masterUser.isActive === false) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_user_not_authorized",
        email: decoded?.email,
      });
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!masterUser.loginEmailOtpHash || !masterUser.loginEmailOtpExpiresAt) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_missing",
        email: masterUser.email,
      });
      return res.status(400).json({ message: "Email verification not initialized" });
    }

    const expiresAt = new Date(masterUser.loginEmailOtpExpiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $unset: {
            loginEmailOtpHash: 1,
            loginEmailOtpExpiresAt: 1,
            loginEmailOtpAttempts: 1,
            loginEmailOtpSentAt: 1,
          },
        }
      );

      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_expired",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Email code expired" });
    }

    const attempts = Number(masterUser.loginEmailOtpAttempts || 0);
    if (attempts >= 5) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $unset: {
            loginEmailOtpHash: 1,
            loginEmailOtpExpiresAt: 1,
            loginEmailOtpAttempts: 1,
            loginEmailOtpSentAt: 1,
          },
        }
      );

      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_attempts_exceeded",
        email: masterUser.email,
      });
      return res.status(429).json({ message: "Too many email code attempts" });
    }

    const isValidEmailCode = await bcrypt.compare(code, masterUser.loginEmailOtpHash);

    if (!isValidEmailCode) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        { $inc: { loginEmailOtpAttempts: 1 } }
      );

      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_invalid",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid email verification code" });
    }

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $unset: {
          loginEmailOtpHash: 1,
          loginEmailOtpExpiresAt: 1,
          loginEmailOtpAttempts: 1,
          loginEmailOtpSentAt: 1,
        },
      }
    );

    if (masterUser.mfaEnabled && masterUser.mfaSecret) {
      void logMasterAuthAudit({
        req,
        outcome: "success",
        reason: "email_otp_verified_mfa_required",
        email: masterUser.email,
      });

      return res.json({
        requiresMfa: true,
        mfaSetupRequired: false,
        message: "MFA verification required",
        email: masterUser.email,
        role: masterUser.role,
      });
    }

    const setupSecret = masterUser.mfaTempSecret || authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(
      masterUser.email,
      "EDUNEXUS Master",
      setupSecret
    );
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
    const { codes: recoveryCodes, hashes: recoveryCodeHashes } = await generateRecoveryCodes();

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $set: {
          mfaTempSecret: setupSecret,
          mfaEnabled: false,
          mfaRecoveryCodeHashes: recoveryCodeHashes,
          mfaRecoveryCodeGeneratedAt: new Date(),
        },
      }
    );

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "email_otp_verified_mfa_setup_issued",
      email: masterUser.email,
    });

    return res.json({
      message: "MFA setup required",
      requiresMfa: true,
      mfaSetupRequired: true,
      qrCodeDataUrl,
      manualEntryKey: setupSecret,
      recoveryCodes,
      email: masterUser.email,
      role: masterUser.role,
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

export const getMasterAuthAuditLogs = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const filters: any = {};
    if (req.query.outcome) filters.outcome = req.query.outcome;
    if (req.query.reason) filters.reason = req.query.reason;
    if (req.query.email) filters.email = String(req.query.email).trim().toLowerCase();

    const masterConn = dbRouter.getMasterConnection();
    const MasterAuthAuditModel = masterConn.model(
      "MasterAuthAudit",
      MasterAuthAudit.schema
    );

    const [logs, total] = await Promise.all([
      MasterAuthAuditModel.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MasterAuthAuditModel.countDocuments(filters),
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

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(req.masterUser.id)
      .select("_id email mfaEnabled mfaSecret mfaTempSecret mfaRecoveryCodeHashes mfaRecoveryCodeGeneratedAt")
      .lean<{
        _id: any;
        email: string;
        mfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaTempSecret?: string | null;
        mfaRecoveryCodeHashes?: string[];
        mfaRecoveryCodeGeneratedAt?: Date | string | null;
      }>();

    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    return res.json({
      mfaEnabled: Boolean(masterUser.mfaEnabled && masterUser.mfaSecret),
      hasPendingMfaSetup: Boolean(masterUser.mfaTempSecret),
      recoveryCodesRemaining: Array.isArray(masterUser.mfaRecoveryCodeHashes)
        ? masterUser.mfaRecoveryCodeHashes.length
        : 0,
      recoveryCodesGeneratedAt: masterUser.mfaRecoveryCodeGeneratedAt || null,
      email: masterUser.email,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const regenerateMasterRecoveryCodes = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(req.masterUser.id)
      .select("_id email mfaEnabled mfaSecret mfaRecoveryCodeHashes")
      .lean<{
        _id: any;
        email: string;
        mfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaRecoveryCodeHashes?: string[];
      }>();

    if (!masterUser || !masterUser.mfaEnabled || !masterUser.mfaSecret) {
      return res.status(400).json({ message: "MFA is not enabled" });
    }

    const { codes: recoveryCodes, hashes: recoveryCodeHashes } = await generateRecoveryCodes();

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $set: {
          mfaRecoveryCodeHashes: recoveryCodeHashes,
          mfaRecoveryCodeGeneratedAt: new Date(),
        },
      }
    );

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "recovery_codes_regenerated",
      email: masterUser.email,
    });

    return res.json({
      message: "Recovery codes regenerated",
      recoveryCodes,
      recoveryCodesCount: recoveryCodes.length,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const disableMasterMfa = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(req.masterUser.id)
      .select("_id email mfaEnabled mfaSecret mfaRecoveryCodeHashes")
      .lean<{
        _id: any;
        email: string;
        mfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaRecoveryCodeHashes?: string[];
      }>();

    if (!masterUser || !masterUser.mfaEnabled || !masterUser.mfaSecret) {
      return res.status(400).json({ message: "MFA is not enabled" });
    }

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $set: {
          mfaEnabled: false,
        },
        $unset: {
          mfaSecret: 1,
          mfaTempSecret: 1,
          mfaRecoveryCodeHashes: 1,
          mfaRecoveryCodeGeneratedAt: 1,
        },
      }
    );

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "mfa_disabled",
      email: masterUser.email,
    });

    return res.json({
      message: "MFA disabled successfully",
      mfaEnabled: false,
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

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(req.masterUser.id)
      .select("_id email mfaEnabled mfaSecret")
      .lean<{
        _id: any;
        email: string;
        mfaEnabled?: boolean;
        mfaSecret?: string | null;
      }>();

    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    if (masterUser.mfaEnabled && masterUser.mfaSecret) {
      return res.status(400).json({ message: "MFA is already enabled" });
    }

    const setupSecret = authenticator.generateSecret();
    const otpAuthUrl = authenticator.keyuri(masterUser.email, "EDUNEXUS Master", setupSecret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);
    const { codes: recoveryCodes, hashes: recoveryCodeHashes } = await generateRecoveryCodes();

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $set: {
          mfaEnabled: false,
          mfaTempSecret: setupSecret,
          mfaRecoveryCodeHashes: recoveryCodeHashes,
          mfaRecoveryCodeGeneratedAt: new Date(),
        },
        $unset: {
          mfaSecret: 1,
        },
      }
    );

    return res.json({
      message: "MFA setup initiated",
      mfaSetupRequired: true,
      qrCodeDataUrl,
      manualEntryKey: setupSecret,
      recoveryCodes,
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

    const code = String(req.body?.code || "").trim();
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Invalid MFA code format" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(req.masterUser.id)
      .select("_id email mfaTempSecret")
      .lean<{
        _id: any;
        email: string;
        mfaTempSecret?: string | null;
      }>();

    if (!masterUser || !masterUser.mfaTempSecret) {
      return res.status(400).json({ message: "MFA setup not initialized" });
    }

    const isValidCode = authenticator.verify({ token: code, secret: masterUser.mfaTempSecret });
    if (!isValidCode) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "mfa_enable_confirm_invalid_code",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid MFA code" });
    }

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $set: {
          mfaEnabled: true,
          mfaSecret: masterUser.mfaTempSecret,
        },
        $unset: {
          mfaTempSecret: 1,
        },
      }
    );

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "mfa_enabled_from_security_panel",
      email: masterUser.email,
    });

    return res.json({
      message: "MFA enabled successfully",
      mfaEnabled: true,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const startMasterPasswordChange = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(req.masterUser.id)
      .select("_id email name isActive")
      .lean<{
        _id: any;
        email: string;
        name?: string | null;
        isActive: boolean;
      }>();

    if (!masterUser || masterUser.isActive === false) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const emailCode = generateLoginEmailCode();
    const emailCodeHash = await bcrypt.hash(emailCode, 10);
    const emailCodeExpiresAt = new Date(Date.now() + masterPasswordChangeOtpTtlMs);

    await MasterUserModel.updateOne(
      { _id: masterUser._id },
      {
        $set: {
          passwordChangeEmailOtpHash: emailCodeHash,
          passwordChangeEmailOtpExpiresAt: emailCodeExpiresAt,
          passwordChangeEmailOtpAttempts: 0,
          passwordChangeEmailOtpSentAt: new Date(),
        },
      }
    );

    const otpEmail = buildMasterPasswordChangeOtpEmail(
      masterUser.name || masterUser.email,
      emailCode
    );

    const emailResult = await sendTransactionalEmail({
      recipientEmail: masterUser.email,
      recipientUserId: masterUser._id,
      subject: otpEmail.subject,
      html: otpEmail.html,
      text: otpEmail.text,
      template: "master_password_change_otp",
      eventType: "master_password_change_otp",
      relatedEntityType: "MasterUser",
      relatedEntityId: masterUser._id,
      metadata: {
        purpose: "master_password_change_email_otp",
        ttlMs: masterPasswordChangeOtpTtlMs,
      },
    });

    if (emailResult.status !== "sent") {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $unset: {
            passwordChangeEmailOtpHash: 1,
            passwordChangeEmailOtpExpiresAt: 1,
            passwordChangeEmailOtpAttempts: 1,
            passwordChangeEmailOtpSentAt: 1,
          },
        }
      );
      return res.status(500).json({ message: "Unable to send password-change verification code" });
    }

    const challengeToken = signMasterPasswordChangeChallengeToken({
      id: String(masterUser._id),
      email: masterUser.email,
    });

    res.cookie("master_pwd_change_challenge", challengeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: masterPasswordChangeOtpTtlMs,
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

    const decoded = jwt.verify(challengeToken, masterJwtSecret, {
      algorithms: ["HS512"],
    }) as any;

    if (decoded?.tokenType !== "master_password_change") {
      return res.status(401).json({ message: "Invalid password-change challenge" });
    }

    if (String(decoded.id) !== String(req.masterUser.id)) {
      return res.status(401).json({ message: "Password-change challenge does not match current user" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);
    const masterUser = await MasterUserModel.findById(req.masterUser.id)
      .select("_id email password isActive passwordChangeEmailOtpHash passwordChangeEmailOtpExpiresAt passwordChangeEmailOtpAttempts passwordChangeEmailOtpSentAt")
      .lean<{
        _id: any;
        email: string;
        password: string;
        isActive: boolean;
        passwordChangeEmailOtpHash?: string | null;
        passwordChangeEmailOtpExpiresAt?: Date | string | null;
        passwordChangeEmailOtpAttempts?: number | null;
      }>();

    if (!masterUser || masterUser.isActive === false) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!masterUser.passwordChangeEmailOtpHash || !masterUser.passwordChangeEmailOtpExpiresAt) {
      return res.status(400).json({ message: "Password-change email verification is not initialized" });
    }

    const expiresAt = new Date(masterUser.passwordChangeEmailOtpExpiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $unset: {
            passwordChangeEmailOtpHash: 1,
            passwordChangeEmailOtpExpiresAt: 1,
            passwordChangeEmailOtpAttempts: 1,
            passwordChangeEmailOtpSentAt: 1,
          },
        }
      );
      return res.status(401).json({ message: "Email code expired" });
    }

    const attempts = Number(masterUser.passwordChangeEmailOtpAttempts || 0);
    if (attempts >= 5) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $unset: {
            passwordChangeEmailOtpHash: 1,
            passwordChangeEmailOtpExpiresAt: 1,
            passwordChangeEmailOtpAttempts: 1,
            passwordChangeEmailOtpSentAt: 1,
          },
        }
      );
      return res.status(429).json({ message: "Too many email code attempts" });
    }

    const isValidEmailCode = await bcrypt.compare(emailCode, masterUser.passwordChangeEmailOtpHash);
    if (!isValidEmailCode) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        { $inc: { passwordChangeEmailOtpAttempts: 1 } }
      );
      return res.status(401).json({ message: "Invalid email verification code" });
    }

    const fullMasterUser = await MasterUserModel.findById(masterUser._id);
    if (!fullMasterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    const isSamePassword = await fullMasterUser.matchPassword(newPassword);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    fullMasterUser.password = newPassword;
    fullMasterUser.set("passwordChangeEmailOtpHash", null);
    fullMasterUser.set("passwordChangeEmailOtpExpiresAt", null);
    fullMasterUser.set("passwordChangeEmailOtpAttempts", 0);
    fullMasterUser.set("passwordChangeEmailOtpSentAt", null);
    await fullMasterUser.save();

    res.clearCookie("master_pwd_change_challenge", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "password_changed_from_security_dashboard",
      email: fullMasterUser.email,
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

  return res.json({ message: "Master logout successful" });
};

/**
 * SCHOOLS MANAGEMENT
 */

export const createSchool = async (req: Request, res: Response) => {
  try {
    // Vérifier que c'est un super_admin
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Only super_admin can create schools" });
    }

    const {
      schoolName,
      schoolMotto,
      systemType,
      structure,
      dbName,
      dbConnectionString,
      foundedYear,
      location,
      contactEmail,
      contactPhone,
      parentComplex,
      isPilot,
    } = req.body;

    if (!schoolName || !schoolMotto || !systemType || !dbName || !dbConnectionString) {
      return res
        .status(400)
        .json({ message: "Required fields missing" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const SchoolModel = masterConn.model("School", School.schema);

    const school = await SchoolModel.create({
      schoolName,
      schoolMotto,
      systemType,
      structure: structure || "simple",
      dbName,
      dbConnectionString,
      foundedYear,
      location,
      contactEmail,
      contactPhone,
      parentComplex: parentComplex || null,
      isActive: true,
      isPilot: Boolean(isPilot),
      createdBy: req.masterUser?._id || req.masterUser?.id || null,
    });

    // TODO: Crée les collections de base dans la nouvelle DB
    // - User (vide)
    // - Classes (vide)
    // - SchoolSettings (defaults)
    // - etc.

    return res.status(201).json({
      message: "School created",
      school,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error.message || "Server error" });
  }
};

export const listSchools = async (req: Request, res: Response) => {
  try {
    if (!["super_admin", "platform_admin"].includes(req.masterUser?.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const masterConn = dbRouter.getMasterConnection();
    masterConn.model("SchoolComplex", SchoolComplex.schema);
    const SchoolModel = masterConn.model("School", School.schema);

    const schools = await SchoolModel.find({})
      .populate("parentComplex", "complexName")
      .lean();

    return res.json({ schools, total: schools.length });
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error.message || "Server error" });
  }
};

export const getSchool = async (req: Request, res: Response) => {
  try {
    const masterConn = dbRouter.getMasterConnection();
    masterConn.model("SchoolComplex", SchoolComplex.schema);
    const SchoolModel = masterConn.model("School", School.schema);

    const school = await SchoolModel.findById(req.params.schoolId)
      .populate("parentComplex", "complexName")
      .lean();

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.json(school);
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error.message || "Server error" });
  }
};

export const updateSchool = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Only super_admin can update schools" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const SchoolModel = masterConn.model("School", School.schema);

    const school = await SchoolModel.findByIdAndUpdate(
      req.params.schoolId,
      req.body,
      { new: true, runValidators: true }
    );

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.json({ message: "School updated", school });
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error.message || "Server error" });
  }
};

const getMasterSchoolModels = () => {
  const masterConn = dbRouter.getMasterConnection();
  masterConn.model("SchoolComplex", SchoolComplex.schema);
  const SchoolModel = masterConn.model("School", School.schema);
  const SchoolInviteModel = masterConn.model("SchoolInvite", SchoolInvite.schema);

  return { SchoolModel, SchoolInviteModel };
};

export const getSchoolActivityLogs = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || "").trim();
    const skip = (page - 1) * limit;

    const query: Record<string, any> = { school: schoolId };
    if (search) {
      query.$or = [
        { action: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } },
      ];
    }

    const [total, logs] = await Promise.all([
      ActivitiesLog.countDocuments(query),
      ActivitiesLog.find(query)
        .populate("user", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
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

    const { SchoolModel, SchoolInviteModel } = getMasterSchoolModels();
    const school = await SchoolModel.findById(req.params.schoolId);
    const reason = String(req.body?.reason || req.body?.motif || "").trim();

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    school.isActive = false;
    await school.save();

    await SchoolInviteModel.updateMany(
      { school: school._id, status: "pending" },
      { $set: { status: "expired" } }
    );

    await logActivity({
      userId: String(req.masterUser._id || req.masterUser.id),
      action: "Suspended school",
      details: `${school.schoolName} (${school.dbName})${reason ? ` - ${reason}` : ""}`,
      schoolId: String(school._id),
    });

    return res.json({ message: "School suspended", school });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const reactivateSchool = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { SchoolModel } = getMasterSchoolModels();
    const school = await SchoolModel.findById(req.params.schoolId);

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    school.isActive = true;
    if (school.onboardingStatus === "rejected") {
      school.onboardingStatus = "approved";
    }
    await school.save();

    await logActivity({
      userId: String(req.masterUser._id || req.masterUser.id),
      action: "Reactivated school",
      details: `${school.schoolName} (${school.dbName})`,
      schoolId: String(school._id),
    });

    return res.json({ message: "School reactivated", school });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const regenerateSchoolInvite = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const { SchoolModel, SchoolInviteModel } = getMasterSchoolModels();
    const school = await SchoolModel.findById(req.params.schoolId);

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const currentInvite = await SchoolInviteModel.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (currentInvite && currentInvite.status === "pending") {
      currentInvite.status = "expired";
      await currentInvite.save();
    }

    const token = crypto.randomUUID();
    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/invite/${token}`;
    const inviteTemplate = buildSchoolInviteTemplate({
      schoolName: school.schoolName,
      requestedAdminName: school.requestedAdminName || school.schoolName,
      activationUrl,
      language: "fr",
    });
    const invite = await SchoolInviteModel.create({
      school: school._id,
      token,
      requestedAdminName: school.requestedAdminName || school.schoolName,
      requestedAdminEmail: school.requestedAdminEmail || "",
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      metadata: {
        regeneratedBy: req.masterUser._id || req.masterUser.id,
      },
    });

    if (school.requestedAdminEmail) {
      await sendTransactionalEmail({
        recipientEmail: school.requestedAdminEmail,
        subject: inviteTemplate.subject,
        html: inviteTemplate.html,
        text: inviteTemplate.text,
        template: "school_invite",
        eventType: "school_invite",
        relatedEntityType: "School",
        relatedEntityId: school._id,
        metadata: {
          schoolId: String(school._id),
          dbName: school.dbName,
          regenerated: true,
        },
      });
    }

    await logActivity({
      userId: String(req.masterUser._id || req.masterUser.id),
      action: "Regenerated school invite",
      details: `${school.schoolName} (${school.dbName})`,
      schoolId: String(school._id),
    });

    return res.json({
      message: "School invite regenerated",
      invite: {
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt,
        requestedAdminName: invite.requestedAdminName,
        requestedAdminEmail: invite.requestedAdminEmail,
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

    const { SchoolModel, SchoolInviteModel } = getMasterSchoolModels();
    const school = await SchoolModel.findById(req.params.schoolId);

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    if (!school.requestedAdminEmail) {
      return res.status(400).json({ message: "No admin email configured for this school" });
    }

    const invite = await SchoolInviteModel.findOne({ school: school._id }).sort({ createdAt: -1 });
    if (!invite) {
      return res.status(404).json({ message: "No invite found for this school" });
    }

    const isExpired = new Date(invite.expiresAt).getTime() < Date.now();
    if (isExpired && invite.status === "pending") {
      invite.status = "expired";
      await invite.save();
    }

    if (invite.status !== "pending") {
      return res.status(409).json({ message: "No pending invite to resend. Please regenerate first." });
    }

    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/invite/${invite.token}`;
    const inviteTemplate = buildSchoolInviteTemplate({
      schoolName: school.schoolName,
      requestedAdminName: invite.requestedAdminName || school.requestedAdminName || school.schoolName,
      activationUrl,
      language: "fr",
    });

    await sendTransactionalEmail({
      recipientEmail: school.requestedAdminEmail,
      subject: inviteTemplate.subject,
      html: inviteTemplate.html,
      text: inviteTemplate.text,
      template: "school_invite",
      eventType: "school_invite",
      relatedEntityType: "School",
      relatedEntityId: school._id,
      metadata: {
        schoolId: String(school._id),
        dbName: school.dbName,
        resend: true,
      },
    });

    await logActivity({
      userId: String(req.masterUser._id || req.masterUser.id),
      action: "Resent school invite email",
      details: `${school.schoolName} (${school.dbName})`,
      schoolId: String(school._id),
    });

    return res.json({
      message: "Invite email resent",
      invite: {
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt,
        requestedAdminName: invite.requestedAdminName,
        requestedAdminEmail: invite.requestedAdminEmail,
      },
      activationUrl,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolInviteEmailStatus = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;

    const lastEmail = await EmailLog.findOne({
      eventType: "school_invite",
      relatedEntityType: "School",
      relatedEntityId: schoolId,
    })
      .select("recipientEmail status sentAt providerMessageId errorMessage metadata")
      .sort({ sentAt: -1 })
      .lean();

    return res.json({
      lastEmail: lastEmail || null,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getMasterEmailLogs = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "").trim();
    const eventType = String(req.query.eventType || "").trim();
    const schoolId = String(req.query.schoolId || "").trim();
    const skip = (page - 1) * limit;

    const query: Record<string, any> = {};

    if (status) {
      query.status = status;
    }

    if (eventType) {
      query.eventType = eventType;
    }

    if (schoolId) {
      query.$or = [
        { relatedEntityType: "School", relatedEntityId: schoolId },
        { "metadata.schoolId": schoolId },
      ];
    }

    if (search) {
      const searchClause = [
        { recipientEmail: { $regex: search, $options: "i" } },
        { subject: { $regex: search, $options: "i" } },
      ];

      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchClause }];
        delete query.$or;
      } else {
        query.$or = searchClause;
      }
    }

    const [total, logs] = await Promise.all([
      EmailLog.countDocuments(query),
      EmailLog.find(query)
        .populate("recipientUser", "name email role")
        .sort({ sentAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    return res.json({
      logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
      filters: {
        search: search || null,
        status: status || null,
        eventType: eventType || null,
        schoolId: schoolId || null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

/**
 * SCHOOL CONFIGS
 */

export const setSchoolConfig = async (req: Request, res: Response) => {
  try {
    const masterConn = dbRouter.getMasterConnection();
    const SchoolConfigModel = masterConn.model("SchoolConfig", SchoolConfig.schema);

    const config = await SchoolConfigModel.findOneAndUpdate(
      { school: req.params.schoolId },
      {
        school: req.params.schoolId,
        ...req.body,
      },
      { new: true, upsert: true }
    );

    return res.json({ message: "Config updated", config });
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error.message || "Server error" });
  }
};

export const getSchoolConfig = async (req: Request, res: Response) => {
  try {
    const masterConn = dbRouter.getMasterConnection();
    const SchoolConfigModel = masterConn.model("SchoolConfig", SchoolConfig.schema);

    const config = await SchoolConfigModel.findOne({
      school: req.params.schoolId,
    }).lean();

    return res.json(config || {});
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error.message || "Server error" });
  }
};
