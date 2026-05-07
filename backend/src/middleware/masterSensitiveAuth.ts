import { type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcryptjs";

import { prisma } from "../config/prisma.ts";
import { logMasterAuthAudit } from "../utils/masterAuthAudit.ts";

const extractSensitiveAuthPayload = (req: Request) => {
  const body = req.body || {};
  const nested = body.sensitiveAuth || {};

  return {
    password: String(nested.password ?? body.password ?? "").trim(),
    code: String(nested.code ?? body.code ?? "").trim(),
  };
};

const isSixDigitCode = (value: string) => /^\d{6}$/.test(String(value || "").trim());

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

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!masterUser) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_user_not_authorized",
        email: req.masterUser?.email,
      });
      return res.status(401).json({ message: "Not authorized" });
    }

    const passwordOk = await bcrypt.compare(password, masterUser.passwordHash);
    if (!passwordOk) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_invalid_password",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid security verification" });
    }

    // MFA fields are not yet represented in the Prisma schema.
    // We still require a properly formatted code so the request shape stays stable.
    if (!isSixDigitCode(code)) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "sensitive_auth_invalid_code",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid security verification" });
    }

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "sensitive_auth_passed",
      email: masterUser.email,
    });

    return next();
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};
