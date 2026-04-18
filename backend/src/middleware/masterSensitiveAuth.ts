import { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import * as otplib from "otplib";

import { dbRouter } from "../config/dbRouter.ts";
import MasterUser from "../models/masterUser.ts";
import { logMasterAuthAudit } from "../utils/masterAuthAudit.ts";

const authenticator = (otplib as any).authenticator;

const normalizeRecoveryCode = (value: string) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const extractSensitiveAuthPayload = (req: Request) => {
  const body = req.body || {};
  const nested = body.sensitiveAuth || {};

  const password = String(nested.password ?? body.password ?? "").trim();
  const code = String(nested.code ?? body.code ?? "").trim();

  return { password, code };
};

const verifyAndConsumeRecoveryCode = async (
  code: string,
  recoveryCodeHashes: string[]
) => {
  const normalizedCode = normalizeRecoveryCode(code);

  for (let index = 0; index < recoveryCodeHashes.length; index += 1) {
    const hash = recoveryCodeHashes[index] ?? "";
    if (!hash) continue;

    const matches = await bcrypt.compare(normalizedCode, hash);
    if (matches) {
      const updatedHashes = [...recoveryCodeHashes];
      updatedHashes.splice(index, 1);
      return {
        matched: true,
        updatedHashes,
      };
    }
  }

  return {
    matched: false,
    updatedHashes: recoveryCodeHashes,
  };
};

export const requireMasterSensitiveAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const { password, code } = extractSensitiveAuthPayload(req);

    if (!password || !code) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_missing_factors",
        email: req.masterUser?.email,
      });
      return res.status(400).json({ message: "Password and MFA/recovery code are required" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model("MasterUser", MasterUser.schema);

    const masterUser = await MasterUserModel.findById(req.masterUser.id)
      .select("_id email password isActive mfaEnabled mfaSecret mfaRecoveryCodeHashes")
      .lean<{
        _id: any;
        email: string;
        password: string;
        isActive: boolean;
        mfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaRecoveryCodeHashes?: string[] | null;
      }>();

    if (!masterUser || masterUser.isActive === false) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_user_not_authorized",
        email: req.masterUser?.email,
      });
      return res.status(401).json({ message: "Not authorized" });
    }

    const passwordOk = await bcrypt.compare(password, masterUser.password);
    if (!passwordOk) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_invalid_password",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid security verification" });
    }

    if (!masterUser.mfaEnabled || !masterUser.mfaSecret) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_mfa_required",
        email: masterUser.email,
      });
      return res.status(403).json({ message: "MFA must be enabled for this action" });
    }

    const totpValid = /^\d{6}$/.test(code)
      ? authenticator.verify({ token: code, secret: masterUser.mfaSecret })
      : false;

    let usedRecoveryCode = false;
    let updatedHashes = Array.isArray(masterUser.mfaRecoveryCodeHashes)
      ? masterUser.mfaRecoveryCodeHashes
      : [];

    let valid = totpValid;

    if (!valid && updatedHashes.length > 0) {
      const recoveryResult = await verifyAndConsumeRecoveryCode(code, updatedHashes);
      if (recoveryResult.matched) {
        valid = true;
        usedRecoveryCode = true;
        updatedHashes = recoveryResult.updatedHashes;
      }
    }

    if (!valid) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_invalid_code",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid security verification" });
    }

    if (usedRecoveryCode) {
      await MasterUserModel.updateOne(
        { _id: masterUser._id },
        {
          $set: {
            mfaRecoveryCodeHashes: updatedHashes,
          },
        }
      );
    }

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: usedRecoveryCode ? "sensitive_auth_passed_with_recovery_code" : "sensitive_auth_passed",
      email: masterUser.email,
    });

    return next();
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};
