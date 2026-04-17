import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { dbRouter } from "../config/dbRouter.ts";
import School from "../models/school.ts";
import SchoolComplex from "../models/schoolComplex.ts";
import SchoolConfig from "../models/schoolConfig.ts";
import MasterUser from "../models/masterUser.ts";
import { logActivity } from "../utils/activitieslog.ts";

/**
 * AUTH MASTER
 */

export const masterLogin = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password required" });
    }

    const masterConn = dbRouter.getMasterConnection();
    const MasterUserModel = masterConn.model(
      "MasterUser",
      MasterUser.schema
    );

    const masterUser = await MasterUserModel.findOne({ email });

    if (!masterUser) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await masterUser.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Génère JWT (sans schoolId car c'est un admin platform)
    const token = jwt.sign(
      { id: masterUser._id, email: masterUser.email, role: masterUser.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "30d", algorithm: "HS512" }
    );

    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      message: "Master login successful",
      role: masterUser.role,
      email: masterUser.email,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: error.message || "Server error" });
  }
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
