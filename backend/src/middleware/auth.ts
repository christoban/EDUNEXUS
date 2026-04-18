import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";

import User, { type IUser, type userRoles } from "../models/user.ts";
import School from "../models/school.ts";
import { dbRouter } from "../config/dbRouter.ts";

export interface AuthRequest extends Request {
  user?: IUser;
}

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

// Protect routes middleware
export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  let token;

  // check for token in cookies //not token but jwt
  if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (token) {
    try {
      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);

      if (decoded?.schoolId && objectIdRegex.test(String(decoded.schoolId))) {
        const masterConn = dbRouter.getMasterConnection();
        const SchoolModel: any = masterConn.model("School", School.schema);
        const school: any = await SchoolModel.findById(decoded.schoolId)
          .select("_id isActive dbConnectionString")
          .lean();

        if (!school || !school.isActive) {
          return res.status(401).json({ message: "Not authorized, school not found or inactive" });
        }

        const schoolConn = await dbRouter.getSchoolConnection(
          String(school._id),
          String(school.dbConnectionString)
        );
        const SchoolUserModel: any = schoolConn.model("User", User.schema);
        req.user = (await SchoolUserModel.findById(decoded.userId).select("-password")) as IUser;
      } else {
        // Backward compatibility for legacy tokens/users without schoolId.
        req.user = (await User.findById(decoded.userId).select("-password")) as IUser;
      }

      if (!req.user) {
        return res.status(401).json({ message: "Not authorized, user not found" });
      }

      next();
    } catch (error) {
      console.log(error);
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

/**
 * Accepts a list of allowed roles (e.g. 'admin', 'teacher')
 * usage: router.post('/', protect, authorize('admin'), createClass)
 */

export const authorize = (roles: userRoles[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Not authorized, user not found" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }

    // user has permission to proceed
    next();
  };
};