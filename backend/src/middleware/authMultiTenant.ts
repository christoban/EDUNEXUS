import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { dbRouter } from "../config/dbRouter.ts";

/**
 * Déclaration des types pour extension Request
 */
declare global {
  namespace Express {
    interface Request {
      user?: any; // User de l'école
      masterUser?: any; // Admin du platform
      schoolId?: string; // ID de l'école
      schoolConnection?: any; // Connection MongoDB vers l'école
    }
  }
}

/**
 * Middleware pour authentifier un user du PLATFORM (super_admin, platform_admin, etc.)
 * Basé sur JWT du MASTER DB
 */
export const protectMaster = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({ message: "No token, not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    // NOTE: masterUser lookup would be implemented when MasterUser model is used
    // For now, we attach the decoded JWT to req for master routes
    req.masterUser = decoded;
    next();
  } catch (error: any) {
    return res.status(401).json({ message: "Not authorized", error: error.message });
  }
};

/**
 * Middleware pour vérifier qu'un user du platform a les bons rôles
 */
export const authorizeMaster = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.masterUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!roles.includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized for this action" });
    }

    next();
  };
};

/**
 * Middleware pour authentifier un user d'UNE ÉCOLE
 * Route la requête vers la base de données de son école
 * NOTE: Full implementation requires School model integration
 */
export const protectSchool = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.cookies?.jwt;

    if (!token) {
      return res.status(401).json({ message: "No token, not authorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    // TODO: Récupère la school depuis MASTER DB
    // const masterConn = dbRouter.getMasterConnection();
    // const school = await School.findById(decoded.schoolId).lean();
    
    // For now, attach schoolId from JWT
    req.schoolId = decoded.schoolId;
    next();
  } catch (error: any) {
    return res.status(401).json({ message: "Not authorized", error: error.message });
  }
};

/**
 * Middleware pour vérifier qu'un user de l'école a les bons rôles
 */
export const authorizeSchool = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Not authorized for this action" });
    }

    next();
  };
};
