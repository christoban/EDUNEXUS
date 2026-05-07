import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma.ts";

const masterJwtSecret = process.env.MASTER_JWT_SECRET || process.env.JWT_SECRET;

export type MasterUserRole = "super_admin" | "platform_admin" | "school_manager" | "support";

export type MasterAuthPayload = {
  id: string;
  email: string;
  role: MasterUserRole;
};

declare global {
  namespace Express {
    interface Request {
      masterUser?: {
        id: string;
        _id?: string;
        email: string;
        role: MasterUserRole;
        name?: string;
        isActive?: boolean;
      };
      schoolId?: string;
      schoolConnection?: unknown;
    }
  }
}

const normalizeToken = (value?: string | null) => (value || "").trim();

export const protectMaster = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    const cookieToken = normalizeToken(req.cookies?.master_jwt);
    const bearerToken = normalizeToken(req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");
    const token = cookieToken || bearerToken;

    if (!token) {
      return res.status(401).json({ message: "No token, not authorized" });
    }

    const decoded = jwt.verify(token, masterJwtSecret, {
      algorithms: ["HS512"],
    }) as { tokenType?: string; id?: string; email?: string; role?: MasterUserRole };

    if (decoded?.tokenType !== "master" || !decoded.id) {
      return res.status(401).json({ message: "Invalid token type" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, isSuperAdmin: true },
    });

    if (!masterUser) {
      return res.status(401).json({ message: "Master account not authorized" });
    }

    req.masterUser = {
      id: masterUser.id,
      _id: masterUser.id,
      email: masterUser.email,
      role: masterUser.isSuperAdmin ? "super_admin" : (decoded.role || "support"),
      name: masterUser.name,
      isActive: true,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized", error: error instanceof Error ? error.message : String(error) });
  }
};

export const authorizeMaster = (roles: MasterUserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.masterUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!roles.includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized for this action" });
    }

    return next();
  };
};

export const protectSchool = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = normalizeToken(req.cookies?.token || req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : "");
    if (!token) {
      return res.status(401).json({ message: "No token, not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { schoolId?: string };
    if (decoded?.schoolId) {
      req.schoolId = decoded.schoolId;
    }

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized", error: error instanceof Error ? error.message : String(error) });
  }
};

export const authorizeSchool = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role;
    if (!userRole) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!roles.includes(userRole)) {
      return res.status(403).json({ message: "Not authorized for this action" });
    }

    return next();
  };
};