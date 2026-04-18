import { type Request, type Response } from "express";
import crypto from "crypto";
import { dbRouter } from "../config/dbRouter.ts";
import School from "../models/school.ts";
import SchoolConfig from "../models/schoolConfig.ts";
import SchoolInvite from "../models/schoolInvite.ts";
import User from "../models/user.ts";
import { getSchoolTemplate, SCHOOL_ONBOARDING_TEMPLATES, buildSchoolConnectionString, buildSchoolDbName } from "../utils/schoolOnboarding.ts";

const ALLOWED_ONBOARDING_STATUSES = ["draft", "pending", "approved", "provisioning", "active", "rejected"] as const;

const getMasterSchoolModel = () => {
  const masterConn = dbRouter.getMasterConnection();
  return masterConn.model("School", School.schema);
};

const getMasterSchoolConfigModel = () => {
  const masterConn = dbRouter.getMasterConnection();
  return masterConn.model("SchoolConfig", SchoolConfig.schema);
};

const getMasterSchoolInviteModel = () => {
  const masterConn = dbRouter.getMasterConnection();
  return masterConn.model("SchoolInvite", SchoolInvite.schema);
};

export const getSchoolOnboardingTemplates = async (_req: Request, res: Response) => {
  return res.json({ templates: SCHOOL_ONBOARDING_TEMPLATES });
};

export const getActiveSchoolsForLogin = async (_req: Request, res: Response) => {
  try {
    const SchoolModel = getMasterSchoolModel();

    const schools = await SchoolModel.find({
      isActive: true,
      onboardingStatus: "active",
    })
      .select("_id schoolName dbName systemType structure")
      .sort({ schoolName: 1 })
      .lean();

    return res.json({
      schools,
      total: schools.length,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolOnboardingRequests = async (req: Request, res: Response) => {
  try {
    const SchoolModel = getMasterSchoolModel();
    const SchoolInviteModel = getMasterSchoolInviteModel();

    const rawPage = Number(req.query.page || 1);
    const rawLimit = Number(req.query.limit || 20);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 20;
    const skip = (page - 1) * limit;

    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim();

    const query: Record<string, any> = {};
    if (status) {
      if (!ALLOWED_ONBOARDING_STATUSES.includes(status as any)) {
        return res.status(400).json({ message: "Invalid onboarding status filter" });
      }
      query.onboardingStatus = status;
    }

    if (search) {
      query.$or = [
        { schoolName: { $regex: search, $options: "i" } },
        { dbName: { $regex: search, $options: "i" } },
        { requestedAdminName: { $regex: search, $options: "i" } },
        { requestedAdminEmail: { $regex: search, $options: "i" } },
      ];
    }

    const [total, schools] = await Promise.all([
      SchoolModel.countDocuments(query),
      SchoolModel.find(query)
        .select("_id schoolName dbName systemType structure isActive onboardingStatus templateKey requestedAdminName requestedAdminEmail createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const schoolIds = schools.map((school: any) => school._id);
    const invites = schoolIds.length
      ? await SchoolInviteModel.find({ school: { $in: schoolIds } })
          .select("school token status expiresAt acceptedAt requestedAdminName requestedAdminEmail createdAt")
          .sort({ createdAt: -1 })
          .lean()
      : [];

    const latestInviteBySchool = new Map<string, any>();
    for (const invite of invites as any[]) {
      const schoolId = String(invite.school);
      if (!latestInviteBySchool.has(schoolId)) {
        latestInviteBySchool.set(schoolId, invite);
      }
    }

    const requests = (schools as any[]).map((school) => {
      const latestInvite = latestInviteBySchool.get(String(school._id)) || null;
      return {
        ...school,
        latestInvite: latestInvite
          ? {
              token: latestInvite.token,
              status: latestInvite.status,
              expiresAt: latestInvite.expiresAt,
              acceptedAt: latestInvite.acceptedAt,
              requestedAdminName: latestInvite.requestedAdminName,
              requestedAdminEmail: latestInvite.requestedAdminEmail,
              createdAt: latestInvite.createdAt,
            }
          : null,
      };
    });

    return res.json({
      requests,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
      filters: {
        status: status || null,
        search: search || null,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

const createOrReuseInvite = async (
  school: any,
  SchoolInviteModel: any,
  fallbackAdminName?: string | null,
  fallbackAdminEmail?: string | null
) => {
  const existingInvite = await SchoolInviteModel.findOne({ school: school._id }).sort({ createdAt: -1 });
  const inviteIsReusable = existingInvite && existingInvite.status === "pending" && new Date(existingInvite.expiresAt).getTime() >= Date.now();

  if (inviteIsReusable) {
    return existingInvite;
  }

  const token = crypto.randomUUID();
  return SchoolInviteModel.create({
    school: school._id,
    token,
    requestedAdminName: fallbackAdminName || school.requestedAdminName || school.schoolName,
    requestedAdminEmail: fallbackAdminEmail || school.requestedAdminEmail || "",
    status: "pending",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    metadata: { approvedAt: new Date().toISOString() },
  });
};

export const approveSchoolOnboardingRequest = async (req: Request, res: Response) => {
  try {
    const SchoolModel = getMasterSchoolModel();
    const SchoolInviteModel = getMasterSchoolInviteModel();

    const school = await SchoolModel.findById(req.params.schoolId);
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    school.onboardingStatus = "approved";
    await school.save();

    const invite = await createOrReuseInvite(
      school,
      SchoolInviteModel,
      school.requestedAdminName,
      school.requestedAdminEmail
    );

    return res.json({
      message: "School onboarding approved",
      school,
      invite: {
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt,
        requestedAdminName: invite.requestedAdminName,
        requestedAdminEmail: invite.requestedAdminEmail,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const rejectSchoolOnboardingRequest = async (req: Request, res: Response) => {
  try {
    const SchoolModel = getMasterSchoolModel();
    const SchoolInviteModel = getMasterSchoolInviteModel();

    const school = await SchoolModel.findById(req.params.schoolId);
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    school.onboardingStatus = "rejected";
    school.isActive = false;
    await school.save();

    await SchoolInviteModel.updateMany(
      { school: school._id, status: "pending" },
      { $set: { status: "expired" } }
    );

    return res.json({
      message: "School onboarding rejected",
      school,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const createSchoolOnboardingRequest = async (req: Request, res: Response) => {
  try {
    const {
      schoolName,
      schoolMotto,
      templateKey,
      foundedYear,
      location,
      contactEmail,
      contactPhone,
      requestedAdminName,
      requestedAdminEmail,
    } = req.body ?? {};

    if (!schoolName || !schoolMotto || !templateKey || !requestedAdminName || !requestedAdminEmail) {
      return res.status(400).json({ message: "schoolName, schoolMotto, templateKey, requestedAdminName and requestedAdminEmail are required" });
    }

    const template = getSchoolTemplate(String(templateKey));
    if (!template) {
      return res.status(400).json({ message: "Invalid templateKey" });
    }

    const SchoolModel = getMasterSchoolModel();
    const SchoolConfigModel = getMasterSchoolConfigModel();
    const SchoolInviteModel = getMasterSchoolInviteModel();

    const dbName = buildSchoolDbName(String(schoolName));
    const masterBaseUrl = process.env.MONGO_URL || "mongodb://localhost:27017/edunexus_school_1";
    const dbConnectionString = buildSchoolConnectionString(masterBaseUrl, dbName);

    const existingSchool = await SchoolModel.findOne({ $or: [{ schoolName }, { dbName }] }).lean();
    if (existingSchool) {
      return res.status(409).json({ message: "A school with the same name or database already exists" });
    }

    const school = await SchoolModel.create({
      schoolName,
      schoolMotto,
      systemType: template.systemType,
      structure: template.structure,
      dbName,
      dbConnectionString,
      foundedYear,
      location,
      contactEmail,
      contactPhone,
      parentComplex: null,
      isActive: false,
      isPilot: false,
      onboardingStatus: "pending",
      templateKey: template.key,
      requestedAdminName,
      requestedAdminEmail,
      createdBy: req.masterUser?._id || req.masterUser?.id || null,
    });

    await SchoolConfigModel.findOneAndUpdate(
      { school: school._id },
      {
        school: school._id,
        ...template.schoolConfig,
        metadata: {
          ...template.schoolConfig.metadata,
          onboarding: {
            templateKey: template.key,
            requestedAdminName,
            requestedAdminEmail,
          },
        },
      },
      { new: true, upsert: true }
    );

    const token = crypto.randomUUID();
    const invite = await SchoolInviteModel.create({
      school: school._id,
      token,
      requestedAdminName,
      requestedAdminEmail,
      status: "pending",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      metadata: { templateKey: template.key },
    });

    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/invite/${token}`;

    return res.status(201).json({
      message: "School onboarding request created",
      school,
      invite: {
        token: invite.token,
        expiresAt: invite.expiresAt,
        activationUrl,
      },
      template,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolOnboardingInvite = async (req: Request, res: Response) => {
  try {
    const SchoolInviteModel = getMasterSchoolInviteModel();
    const SchoolModel = getMasterSchoolModel();

    const invite: any = await SchoolInviteModel.findOne({ token: req.params.token }).lean();
    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const school: any = await SchoolModel.findById(invite.school).lean();
    if (!school) {
      return res.status(404).json({ message: "Associated school not found" });
    }

    const isExpired = new Date(invite.expiresAt).getTime() < Date.now();
    if (isExpired && invite.status === "pending") {
      await SchoolInviteModel.updateOne({ token: req.params.token }, { $set: { status: "expired" } });
    }

    return res.json({
      invite: {
        token: invite.token,
        requestedAdminName: invite.requestedAdminName,
        requestedAdminEmail: invite.requestedAdminEmail,
        status: isExpired && invite.status === "pending" ? "expired" : invite.status,
        expiresAt: invite.expiresAt,
        acceptedAt: invite.acceptedAt || null,
      },
      school,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const acceptSchoolOnboardingInvite = async (req: Request, res: Response) => {
  try {
    const { adminPassword, adminName, adminEmail } = req.body ?? {};

    if (!adminPassword || String(adminPassword).length < 6) {
      return res.status(400).json({ message: "adminPassword is required and must be at least 6 characters" });
    }

    const SchoolInviteModel = getMasterSchoolInviteModel();
    const SchoolModel = getMasterSchoolModel();

    const invite: any = await SchoolInviteModel.findOne({ token: req.params.token });
    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.status === "accepted") {
      return res.status(200).json({ message: "Invite already accepted" });
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      await SchoolInviteModel.updateOne({ token: req.params.token }, { $set: { status: "expired" } });
      return res.status(410).json({ message: "Invite expired" });
    }

    const school = await SchoolModel.findById(invite.school);
    if (!school) {
      return res.status(404).json({ message: "Associated school not found" });
    }

    if (school.onboardingStatus !== "approved") {
      return res.status(409).json({ message: "School must be approved before activation" });
    }

    school.onboardingStatus = "provisioning";
    await school.save();

    const resolvedAdminEmail = String(adminEmail || invite.requestedAdminEmail || "").trim().toLowerCase();
    const resolvedAdminName = String(adminName || invite.requestedAdminName || "").trim();

    if (!resolvedAdminEmail || !resolvedAdminName) {
      return res.status(400).json({ message: "adminName and adminEmail are required" });
    }

    const existingUser = await User.findOne({ email: resolvedAdminEmail }).lean();
    if (existingUser) {
      school.onboardingStatus = "pending";
      await school.save();
      return res.status(409).json({ message: "An account with this admin email already exists" });
    }

    const createdAdmin = await User.create({
      name: resolvedAdminName,
      email: resolvedAdminEmail,
      password: String(adminPassword),
      role: "admin",
      isActive: true,
      schoolId: school._id,
      schoolSection: school.systemType,
    });

    school.isActive = true;
    school.onboardingStatus = "active";
    school.requestedAdminName = resolvedAdminName;
    school.requestedAdminEmail = resolvedAdminEmail;
    await school.save();

    invite.status = "accepted";
    invite.acceptedAt = new Date();
    invite.requestedAdminName = resolvedAdminName;
    invite.requestedAdminEmail = resolvedAdminEmail;
    invite.metadata = {
      ...(invite.metadata || {}),
      adminUserId: String(createdAdmin._id),
    };
    await invite.save();

    return res.json({
      message: "School onboarding activated",
      school,
      admin: {
        id: createdAdmin._id,
        email: createdAdmin.email,
        role: createdAdmin.role,
      },
      invite: {
        token: invite.token,
        status: invite.status,
        acceptedAt: invite.acceptedAt,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};