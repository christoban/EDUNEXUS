import { type Request } from "express";
import { prisma } from "../config/prisma.ts";

export type MasterAuthOutcome = "success" | "failure";

const normalizeIp = (value?: string | null) => {
  if (!value) return "unknown";
  const trimmed = value.trim();
  if (!trimmed) return "unknown";

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.replace("::ffff:", "");
  }

  return trimmed;
};

const resolveClientIp = (req: Request) => {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0];
    return normalizeIp(first);
  }

  return normalizeIp(req.ip || req.socket.remoteAddress || "");
};

export const logMasterAuthAudit = async (params: {
  req: Request;
  outcome: MasterAuthOutcome;
  reason: string;
  email?: string | null;
}) => {
  try {
    const { req, outcome, reason, email } = params;

    await prisma.masterAuthAudit.create({
      data: {
        action: `${outcome}:${reason}`,
        description: email ? String(email).trim().toLowerCase() : null,
        ipAddress: resolveClientIp(req),
      },
    });
  } catch (error) {
    // Keep this silent to avoid blocking auth flow in case of audit persistence issues.
    console.error("[SECURITY][MASTER_AUTH_AUDIT] Failed to persist event", error);
  }
};
