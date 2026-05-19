import jwt from "jsonwebtoken";
import { type Response } from "express";

const ACCESS_TOKEN_EXPIRY  = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

const ACCESS_COOKIE_MAX_AGE  = 15 * 60 * 1000;           // 15 minutes en ms
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;  // 7 jours en ms

export interface TokenPayload {
  userId:      string
  schoolId:    string
  role:        string
  permissions: string[]
  refreshTokenVersion?: number
  tokenType:   "access" | "refresh"
}

/**
 * Génère un access token JWT (15 min) et un refresh token JWT (7 jours).
 * Les deux sont attachés en cookies httpOnly séparés.
 * Le payload contient userId, schoolId, role et permissions.
 */
export const generateTokens = (
  userId:      string,
  schoolId:    string,
  role:        string,
  permissions: string[],
  refreshTokenVersion: number,
  res:         Response,
): { accessToken: string; refreshToken: string } => {

  const secret = process.env.JWT_SECRET as string;
  const isProduction = process.env.NODE_ENV === "production";

  const basePayload = { userId, schoolId, role, permissions, refreshTokenVersion };

  // Access token — courte durée, contient tout le contexte
  const accessToken = jwt.sign(
    { ...basePayload, tokenType: "access" },
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY, algorithm: "HS512" },
  );

  // Refresh token — longue durée, contient le minimum
  const refreshToken = jwt.sign(
    { userId, schoolId, role, permissions: [], refreshTokenVersion, tokenType: "refresh" },
    secret,
    { expiresIn: REFRESH_TOKEN_EXPIRY, algorithm: "HS512" },
  );

  const cookieBase = {
    httpOnly: true,
    secure:   isProduction,
    sameSite: "strict" as const,
    path:     "/",
  };

  res.cookie("access_token",  accessToken,  { ...cookieBase, maxAge: ACCESS_COOKIE_MAX_AGE  });
  res.cookie("refresh_token", refreshToken, { ...cookieBase, maxAge: REFRESH_COOKIE_MAX_AGE });

  return { accessToken, refreshToken };
};

/**
 * Efface les deux cookies d'authentification.
 * À appeler lors du logout.
 */
export const clearTokens = (res: Response): void => {
  const cookieBase = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path:     "/",
  };
  res.cookie("access_token",  "", { ...cookieBase, expires: new Date(0) });
  res.cookie("refresh_token", "", { ...cookieBase, expires: new Date(0) });
};
