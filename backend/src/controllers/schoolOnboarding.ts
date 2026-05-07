import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  InviteStatus,
  PlanType,
  SchoolStatus,
  UserRole,
  type School,
  type SchoolInvite,
} from "@prisma/client";
import { prisma } from "../config/prisma.ts";
import {
  getSchoolTemplate,
  SCHOOL_ONBOARDING_TEMPLATES,
  buildSchoolDbName,
} from "../utils/schoolOnboarding.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { logActivity } from "../utils/activitieslog.ts";
import { buildSchoolInviteTemplate } from "../utils/emailTemplates.ts";

const ALLOWED_ONBOARDING_STATUSES = [
  "draft",
  "pending",
  "approved",
  "provisioning",
  "active",
  "rejected",
] as const;

const statusFromQuery = (status: string): SchoolStatus | null => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "pending" || normalized === "draft" || normalized === "provisioning") {
    return SchoolStatus.PENDING;
  }
  if (normalized === "approved") return SchoolStatus.APPROVED;
  if (normalized === "active") return SchoolStatus.ACTIVE;
  if (normalized === "rejected") return SchoolStatus.REJECTED;
  return null;
};

const statusToLegacy = (status: SchoolStatus): string => {
  if (status === SchoolStatus.PENDING) return "pending";
  if (status === SchoolStatus.APPROVED) return "approved";
  if (status === SchoolStatus.ACTIVE) return "active";
  if (status === SchoolStatus.REJECTED) return "rejected";
  return "rejected";
};

const inviteStatusToLegacy = (status: InviteStatus): "pending" | "accepted" | "expired" => {
  if (status === InviteStatus.PENDING) return "pending";
  if (status === InviteStatus.USED) return "accepted";
  return "expired";
};

const planFromInput = (plan: string | undefined): PlanType => {
  const normalized = String(plan || "").trim().toLowerCase();
  if (normalized === "premium") return PlanType.PREMIUM;
  if (normalized === "standard") return PlanType.STANDARD;
  return PlanType.DISCOVERY;
};

const planToLegacy = (plan: PlanType): "decouverte" | "standard" | "premium" => {
  if (plan === PlanType.PREMIUM) return "premium";
  if (plan === PlanType.STANDARD) return "standard";
  return "decouverte";
};

const splitName = (fullName: string) => {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "Admin", lastName: "School" };

  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] || "Admin";
  const lastName = parts.slice(1).join(" ") || "School";
  return { firstName, lastName };
};

const toLegacySchool = (school: School) => ({
  _id: school.id,
  schoolName: school.name,
  schoolMotto: "",
  systemType: school.system,
  structure: "simple",
  onboardingStatus: statusToLegacy(school.status),
  dbName: school.subdomain,
  requestedAdminEmail: school.email,
  requestedAdminName: null,
  isActive: school.status === SchoolStatus.ACTIVE,
  createdAt: school.createdAt,
  updatedAt: school.updatedAt,
});

const ensureUniqueSubdomain = async (schoolName: string) => {
  const base = buildSchoolDbName(schoolName)
    .replace(/^edunexus_/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "school";

  let candidate = base;
  let suffix = 1;

  while (true) {
    const existing = await prisma.school.findUnique({ where: { subdomain: candidate } });
    if (!existing) {
      return candidate;
    }
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
};

const createOrReuseInvite = async (
  school: School,
  fallbackAdminEmail?: string | null,
  fallbackSchoolName?: string | null,
  plan?: PlanType
) => {
  const existingInvite = await prisma.schoolInvite.findFirst({
    where: { schoolId: school.id },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  if (
    existingInvite &&
    existingInvite.status === InviteStatus.PENDING &&
    existingInvite.expiresAt.getTime() >= now.getTime()
  ) {
    return existingInvite;
  }

  if (existingInvite && existingInvite.status === InviteStatus.PENDING) {
    await prisma.schoolInvite.update({
      where: { id: existingInvite.id },
      data: { status: InviteStatus.EXPIRED },
    });
  }

  return prisma.schoolInvite.create({
    data: {
      token: crypto.randomUUID(),
      email: String(fallbackAdminEmail || school.email || "").toLowerCase(),
      schoolName: fallbackSchoolName || school.name,
      plan: plan || school.plan,
      status: InviteStatus.PENDING,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      schoolId: school.id,
    },
  });
};

export const getSchoolOnboardingTemplates = async (_req: Request, res: Response) => {
  return res.json({ templates: SCHOOL_ONBOARDING_TEMPLATES });
};

export const getActiveSchoolsForLogin = async (_req: Request, res: Response) => {
  try {
    const schools = await prisma.school.findMany({
      where: { status: { in: [SchoolStatus.APPROVED, SchoolStatus.ACTIVE] } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        subdomain: true,
        system: true,
      },
    });

    return res.json({
      schools: schools.map((school) => ({
        _id: school.id,
        schoolName: school.name,
        dbName: school.subdomain,
        systemType: school.system,
        structure: "simple",
      })),
      total: schools.length,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolOnboardingRequests = async (req: Request, res: Response) => {
  try {
    const rawPage = Number(req.query.page || 1);
    const rawLimit = Number(req.query.limit || 20);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 100) : 20;
    const skip = (page - 1) * limit;

    const status = String(req.query.status || "").trim();
    const search = String(req.query.search || "").trim();

    if (status && !ALLOWED_ONBOARDING_STATUSES.includes(status as (typeof ALLOWED_ONBOARDING_STATUSES)[number])) {
      return res.status(400).json({ message: "Invalid onboarding status filter" });
    }

    const prismaStatus = status ? statusFromQuery(status) : null;
    const where = {
      ...(prismaStatus ? { status: prismaStatus } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { subdomain: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, schools] = await Promise.all([
      prisma.school.count({ where }),
      prisma.school.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          invites: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);

    const requests = schools.map((school) => {
      const latestInvite = school.invites[0] || null;
      return {
        ...toLegacySchool(school),
        latestInvite: latestInvite
          ? {
              token: latestInvite.token,
              status: inviteStatusToLegacy(latestInvite.status),
              expiresAt: latestInvite.expiresAt,
              acceptedAt: latestInvite.status === InviteStatus.USED ? latestInvite.createdAt : null,
              requestedAdminName: school.name,
              requestedAdminEmail: latestInvite.email,
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

export const approveSchoolOnboardingRequest = async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.schoolId } });
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const updatedSchool = await prisma.school.update({
      where: { id: school.id },
      data: { status: SchoolStatus.APPROVED },
    });

    const invite = await createOrReuseInvite(updatedSchool, updatedSchool.email, updatedSchool.name, updatedSchool.plan);

    if (updatedSchool.email) {
      try {
        const loginUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/login`;
        await sendTransactionalEmail({
          recipientEmail: updatedSchool.email,
          subject: "Votre établissement a été approuvé !",
          html: `<p>Bonjour,<br><br>Votre demande d'inscription pour l'établissement <b>${updatedSchool.name}</b> a été validée par le super administrateur.<br>Vous pouvez maintenant vous connecter à la plateforme en cliquant sur le lien ci-dessous :<br><a href="${loginUrl}">${loginUrl}</a><br><br>Bienvenue !</p>`,
          text: `Bonjour,\n\nVotre demande d'inscription pour l'établissement ${updatedSchool.name} a été validée par le super administrateur.\nVous pouvez maintenant vous connecter à la plateforme : ${loginUrl}\n\nBienvenue !`,
          template: "school_approved",
          eventType: "school_approved",
          metadata: { schoolId: updatedSchool.id },
        });
      } catch (err) {
        console.error("Erreur lors de l'envoi de l'email d'approbation à l'admin école:", err);
      }
    }

    return res.json({
      message: "School onboarding approved",
      school: toLegacySchool(updatedSchool),
      invite: {
        token: invite.token,
        status: inviteStatusToLegacy(invite.status),
        expiresAt: invite.expiresAt,
        requestedAdminName: updatedSchool.name,
        requestedAdminEmail: invite.email,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const rejectSchoolOnboardingRequest = async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({ where: { id: req.params.schoolId } });
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const updatedSchool = await prisma.school.update({
      where: { id: school.id },
      data: { status: SchoolStatus.REJECTED },
    });

    await prisma.schoolInvite.updateMany({
      where: { schoolId: school.id, status: InviteStatus.PENDING },
      data: { status: InviteStatus.EXPIRED },
    });

    return res.json({
      message: "School onboarding rejected",
      school: toLegacySchool(updatedSchool),
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const createSchoolOnboardingRequest = async (req: Request, res: Response) => {
  try {
    const {
      schoolName,
      templateKey,
      location,
      contactEmail,
      contactPhone,
      requestedAdminName,
      requestedAdminEmail,
      plan,
    } = req.body ?? {};

    if (!schoolName || !templateKey || !requestedAdminName || !requestedAdminEmail) {
      return res.status(400).json({
        message: "schoolName, templateKey, requestedAdminName and requestedAdminEmail are required",
      });
    }

    const template = getSchoolTemplate(String(templateKey));
    if (!template) {
      return res.status(400).json({ message: "Invalid templateKey" });
    }

    const normalizedEmail = String(requestedAdminEmail).trim().toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({ message: "An account with this admin email already exists" });
    }

    const subdomain = await ensureUniqueSubdomain(String(schoolName));
    const school = await prisma.school.create({
      data: {
        name: String(schoolName).trim(),
        subdomain,
        status: SchoolStatus.PENDING,
        email: contactEmail ? String(contactEmail).trim().toLowerCase() : normalizedEmail,
        phone: contactPhone ? String(contactPhone).trim() : null,
        city: location ? String(location).trim() : null,
        system: template.systemType,
        plan: planFromInput(plan),
      },
    });

    await prisma.schoolConfig.upsert({
      where: { schoolId: school.id },
      create: {
        schoolId: school.id,
        termsPerYear: template.schoolConfig.termsNames.length || 3,
        passMark: Number(template.schoolConfig.passingGrade || 10),
      },
      update: {
        termsPerYear: template.schoolConfig.termsNames.length || 3,
        passMark: Number(template.schoolConfig.passingGrade || 10),
      },
    });

    const token = crypto.randomUUID();
    const invite = await prisma.schoolInvite.create({
      data: {
        schoolId: school.id,
        token,
        email: normalizedEmail,
        schoolName: String(schoolName).trim(),
        plan: planFromInput(plan),
        status: InviteStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${token}`;

    let emailSent = true;
    try {
      const inviteTemplate = buildSchoolInviteTemplate({
        schoolName: String(schoolName),
        requestedAdminName: String(requestedAdminName),
        activationUrl,
        language: "fr",
      });

      const emailResult = await sendTransactionalEmail({
        recipientEmail: normalizedEmail,
        subject: inviteTemplate.subject,
        html: inviteTemplate.html,
        text: inviteTemplate.text,
        template: "school_invite",
        eventType: "school_invite",
        metadata: { token, templateKey: template.key, schoolId: school.id },
      });

      if (emailResult.status === "failed") {
        emailSent = false;
      }
    } catch {
      emailSent = false;
    }

    try {
      await logActivity({
        userId: String(req.masterUser?._id || req.masterUser?.id || ""),
        action: "Created school onboarding request",
        details: `${schoolName} → ${normalizedEmail} (template: ${template.key})`,
      });
    } catch {
      // Non-blocking logging.
    }

    return res.status(201).json({
      message: emailSent
        ? "School onboarding request created. Invitation email sent."
        : "School onboarding request created. Email sending failed, but invitation is valid.",
      school: {
        _id: school.id,
        schoolName: school.name,
        onboardingStatus: statusToLegacy(school.status),
      },
      invite: {
        token: invite.token,
        expiresAt: invite.expiresAt,
        activationUrl,
      },
      emailSent,
      template,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolOnboardingInvite = async (req: Request, res: Response) => {
  try {
    const invite = await prisma.schoolInvite.findUnique({
      where: { token: req.params.token },
      include: { school: true },
    });

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    const isExpired = invite.expiresAt.getTime() < Date.now();
    if (isExpired && invite.status === InviteStatus.PENDING) {
      await prisma.schoolInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.EXPIRED },
      });
    }

    const effectiveStatus =
      isExpired && invite.status === InviteStatus.PENDING
        ? InviteStatus.EXPIRED
        : invite.status;

    const response: {
      invite: {
        token: string;
        requestedAdminName: string;
        requestedAdminEmail: string;
        schoolName: string;
        templateKey: string;
        status: "pending" | "accepted" | "expired";
        expiresAt: Date;
        acceptedAt: Date | null;
      };
      school?: ReturnType<typeof toLegacySchool>;
    } = {
      invite: {
        token: invite.token,
        requestedAdminName: invite.schoolName || "",
        requestedAdminEmail: invite.email,
        schoolName: invite.schoolName || "",
        templateKey: "fr_secondary",
        status: inviteStatusToLegacy(effectiveStatus),
        expiresAt: invite.expiresAt,
        acceptedAt: effectiveStatus === InviteStatus.USED ? invite.createdAt : null,
      },
    };

    if (invite.school) {
      response.school = toLegacySchool(invite.school);
    }

    return res.json(response);
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

    const invite = await prisma.schoolInvite.findUnique({
      where: { token: req.params.token },
      include: { school: true },
    });

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.status === InviteStatus.USED) {
      return res.status(200).json({ message: "Invite already accepted" });
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      await prisma.schoolInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.EXPIRED },
      });
      return res.status(410).json({ message: "Invite expired" });
    }

    const resolvedAdminEmail = String(adminEmail || invite.email || "").trim().toLowerCase();
    const resolvedAdminName = String(adminName || invite.schoolName || "").trim();

    if (!resolvedAdminEmail || !resolvedAdminName) {
      return res.status(400).json({ message: "adminName and adminEmail are required" });
    }

    let school = invite.school;
    if (!school) {
      const fallbackName = String(invite.schoolName || "Nouvelle école").trim();
      const subdomain = await ensureUniqueSubdomain(fallbackName);
      school = await prisma.school.create({
        data: {
          name: fallbackName,
          subdomain,
          status: SchoolStatus.PENDING,
          email: resolvedAdminEmail,
        },
      });

      await prisma.schoolInvite.update({
        where: { id: invite.id },
        data: { schoolId: school.id },
      });
    }

    if (![SchoolStatus.PENDING, SchoolStatus.APPROVED].includes(school.status)) {
      return res.status(409).json({
        message: `School onboarding status is "${statusToLegacy(school.status)}", cannot proceed`,
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        schoolId: school.id,
        email: resolvedAdminEmail,
      },
      select: { id: true },
    });

    if (existingUser) {
      return res.status(409).json({ message: "An account with this admin email already exists" });
    }

    const { firstName, lastName } = splitName(resolvedAdminName);
    const passwordHash = await bcrypt.hash(String(adminPassword), 10);

    const createdAdmin = await prisma.user.create({
      data: {
        schoolId: school.id,
        role: UserRole.ADMIN,
        email: resolvedAdminEmail,
        passwordHash,
        firstName,
        lastName,
        isActive: true,
      },
    });

    const updatedSchool = await prisma.school.update({
      where: { id: school.id },
      data: {
        status: SchoolStatus.PENDING,
        email: resolvedAdminEmail,
      },
    });

    const updatedInvite = await prisma.schoolInvite.update({
      where: { id: invite.id },
      data: {
        status: InviteStatus.USED,
        email: resolvedAdminEmail,
        schoolName: updatedSchool.name,
      },
    });

    return res.json({
      message: "School onboarding activated",
      school: toLegacySchool(updatedSchool),
      admin: {
        id: createdAdmin.id,
        email: createdAdmin.email,
        role: createdAdmin.role,
      },
      invite: {
        token: updatedInvite.token,
        status: inviteStatusToLegacy(updatedInvite.status),
        acceptedAt: updatedInvite.createdAt,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const activateSchool = acceptSchoolOnboardingInvite;
