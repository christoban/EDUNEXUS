import rateLimit from "express-rate-limit";
import { logMasterAuthAudit } from "../utils/masterAuthAudit.ts";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
});

export const masterAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    void logMasterAuthAudit({
      req,
      outcome: "blocked",
      reason: "rate_limit_exceeded",
      email: req.body?.email,
    });
    res.status(options.statusCode).json(options.message);
  },
  message: {
    message: "Too many login attempts. Please try again later.",
  },
});

export const masterMfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many MFA attempts. Please try again later.",
  },
});

export const masterEmailOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many email verification attempts. Please try again later.",
  },
});

export const sensitiveWriteLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Too many requests on sensitive operations. Please retry shortly.",
  },
});
