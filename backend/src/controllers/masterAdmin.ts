import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import * as otplib from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import { randomBytes, randomInt } from "crypto";
import { logActivity } from "../utils/activitieslog.ts";
import { sendTransactionalEmail } from "../services/emailService.ts";
import { buildSchoolInviteTemplate } from "../utils/emailTemplates.ts";
import { logMasterAuthAudit } from "../utils/masterAuthAudit.ts";
import {
  buildSchoolDbName,
  buildSchoolConnectionString,
  getSchoolTemplate,
} from "../utils/schoolOnboarding.ts";
import { prisma } from "../config/prisma.ts";
import {
  InviteStatus,
  PlanType,
  SchoolStatus,
  SchoolType,
  UserRole,
} from "@prisma/client";

const masterJwtSecret = process.env.MASTER_JWT_SECRET || process.env.JWT_SECRET;
const masterPreAuthTtl = process.env.MASTER_PREAUTH_TTL || "10m";
const masterEmailOtpTtl = process.env.MASTER_EMAIL_OTP_TTL || "10m";
const masterPasswordChangeOtpTtl = process.env.MASTER_PASSWORD_CHANGE_OTP_TTL || "10m";
const getOtpLib = () => {
  if (
    typeof (otplib as any)?.verify !== "function" ||
    typeof (otplib as any)?.generateSecret !== "function" ||
    typeof (otplib as any)?.generateURI !== "function"
  ) {
    throw new Error("MFA authenticator is unavailable");
  }

  return otplib as any;
};

const buildOtpAuthUrl = (email: string, secret: string) => {
  const otpLib = getOtpLib();
  return otpLib.generateURI({
    issuer: "EDUNEXUS Master",
    label: email,
    secret,
  });
};

const verifyOtpToken = async (token: string, secret: string) => {
  const otpLib = getOtpLib();
  const result = await otpLib.verify({ token, secret });

  if (typeof result === "boolean") {
    return result;
  }

  return Boolean(result?.valid);
};

const parseDurationToMs = (value: string, fallbackMs: number) => {
  const normalized = String(value || "").trim().toLowerCase();
  const match = normalized.match(/^(\d+)([smhd])$/);

  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "s") return amount * 1000;
  if (unit === "m") return amount * 60 * 1000;
  if (unit === "h") return amount * 60 * 60 * 1000;
  return amount * 24 * 60 * 60 * 1000;
};

const masterEmailOtpTtlMs = parseDurationToMs(masterEmailOtpTtl, 10 * 60 * 1000);
const masterPasswordChangeOtpTtlMs = parseDurationToMs(masterPasswordChangeOtpTtl, 10 * 60 * 1000);

const generateLoginEmailCode = () => String(randomInt(0, 1000000)).padStart(6, "0");

const normalizeRecoveryCode = (value: string) =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const generateRecoveryCode = () => {
  const rawCode = randomBytes(8).toString("hex").toUpperCase();
  const chunks = rawCode.match(/.{1,4}/g);
  return chunks ? chunks.join("-") : rawCode;
};

const generateRecoveryCodes = async (count = 10) => {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const code = generateRecoveryCode();
    codes.push(code);
    hashes.push(await bcrypt.hash(normalizeRecoveryCode(code), 10));
  }

  return { codes, hashes };
};

const verifyAndConsumeRecoveryCode = async (
  candidateCode: string,
  recoveryCodeHashes: string[]
) => {
  const normalizedCode = normalizeRecoveryCode(candidateCode);

  for (let index = 0; index < recoveryCodeHashes.length; index += 1) {
    const hash = recoveryCodeHashes[index] ?? "";
    if (!hash) {
      continue;
    }

    const matches = await bcrypt.compare(normalizedCode, hash);
    if (matches) {
      const updated = [...recoveryCodeHashes];
      updated.splice(index, 1);
      return {
        matched: true,
        updatedHashes: updated,
      };
    }
  }

  return {
    matched: false,
    updatedHashes: recoveryCodeHashes,
  };
};

const verifyMfaOrRecoveryCode = async (
  code: string,
  secret: string,
  recoveryCodeHashes: string[],
  allowRecoveryCode: boolean
) => {
  const validTotp = await verifyOtpToken(code, secret);
  if (validTotp) {
    return {
      valid: true,
      usedRecoveryCode: false,
      updatedRecoveryCodeHashes: recoveryCodeHashes,
    };
  }

  if (!allowRecoveryCode || recoveryCodeHashes.length === 0) {
    return {
      valid: false,
      usedRecoveryCode: false,
      updatedRecoveryCodeHashes: recoveryCodeHashes,
    };
  }

  const recoveryResult = await verifyAndConsumeRecoveryCode(code, recoveryCodeHashes);
  return {
    valid: recoveryResult.matched,
    usedRecoveryCode: recoveryResult.matched,
    updatedRecoveryCodeHashes: recoveryResult.updatedHashes,
  };
};

const buildMasterLoginOtpEmail = (name: string, code: string) => {
  const safeName = name || "Master";

  return {
    subject: "EDUNEXUS - code de connexion master",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
          <h2 style="margin:0 0 12px;font-size:24px;color:#0f172a;">Bonjour ${safeName},</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#334155;">Voici votre code de validation pour accéder au portail master EDUNEXUS.</p>
          <div style="display:inline-block;background:#0f172a;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:6px;padding:14px 22px;border-radius:12px;">
            ${code}
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Ce code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>
        </div>
      </div>
    `,
    text: `Bonjour ${safeName},\n\nVotre code de validation EDUNEXUS est: ${code}\n\nCe code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
  };
};

const buildMasterPasswordChangeOtpEmail = (name: string, code: string) => {
  const safeName = name || "Master";

  return {
    subject: "EDUNEXUS - code de changement de mot de passe",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;background:#f8fafc;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
          <h2 style="margin:0 0 12px;font-size:24px;color:#0f172a;">Bonjour ${safeName},</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#334155;">Voici votre code pour confirmer le changement du mot de passe master EDUNEXUS.</p>
          <div style="display:inline-block;background:#0f172a;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:6px;padding:14px 22px;border-radius:12px;">
            ${code}
          </div>
          <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Ce code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette action, sécurisez votre compte immédiatement.</p>
        </div>
      </div>
    `,
    text: `Bonjour ${safeName},\n\nVotre code de confirmation de changement de mot de passe EDUNEXUS est: ${code}\n\nCe code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette action, sécurisez votre compte immédiatement.`,
  };

    const legacySchoolStatus = (status: SchoolStatus) => {
      if (status === SchoolStatus.PENDING) return "pending";
      if (status === SchoolStatus.APPROVED) return "approved";
      if (status === SchoolStatus.ACTIVE) return "active";
      if (status === SchoolStatus.SUSPENDED) return "active";
      return "rejected";
    };

    const mapSystemTypeToSchoolType = (systemType?: string) => {
      const value = String(systemType || "").toLowerCase();
      if (value.includes("bilingual")) return SchoolType.BILINGUAL;
      if (value.includes("technical")) return SchoolType.TECHNICAL;
      return SchoolType.SECONDARY;
    };

    const planFromLegacy = (plan?: string | null) => {
      const value = String(plan || "").toLowerCase();
      if (value === "premium") return PlanType.PREMIUM;
      if (value === "standard") return PlanType.STANDARD;
      return PlanType.DISCOVERY;
    };

    const planToLegacy = (plan: PlanType) => {
      if (plan === PlanType.PREMIUM) return "premium";
      if (plan === PlanType.STANDARD) return "standard";
      return "decouverte";
    };

    const toLegacySchool = (
      school: {
        id: string;
        name: string;
        subdomain: string;
        type: SchoolType;
        plan: PlanType;
        status: SchoolStatus;
        city: string | null;
        region: string | null;
        address: string | null;
        phone: string | null;
        email: string | null;
        logoUrl: string | null;
        language: string;
        system: string;
        createdAt: Date;
        updatedAt: Date;
        invites?: Array<{ token: string; email: string; status: InviteStatus; expiresAt: Date; createdAt: Date; plan: PlanType }>
      }
    ) => ({
      _id: school.id,
      schoolName: school.name,
      schoolMotto: "",
      systemType: school.system,
      structure: school.type === SchoolType.BILINGUAL ? "complex" : "simple",
      dbName: school.subdomain,
      dbConnectionString: null,
      foundedYear: null,
      location: school.city || school.address || "",
      contactEmail: school.email || "",
      contactPhone: school.phone || "",
      parentComplex: null,
      isActive: school.status === SchoolStatus.ACTIVE,
      isPilot: false,
      onboardingStatus: legacySchoolStatus(school.status),
      templateKey: school.system || "fr_secondary",
      requestedAdminName: null,
      requestedAdminEmail: school.email || null,
      createdAt: school.createdAt,
      updatedAt: school.updatedAt,
      plan: planToLegacy(school.plan),
      latestInvite: school.invites?.[0]
        ? {
            token: school.invites[0].token,
            status: school.invites[0].status === InviteStatus.USED ? "accepted" : school.invites[0].status === InviteStatus.EXPIRED ? "expired" : "pending",
            expiresAt: school.invites[0].expiresAt,
            requestedAdminName: school.name,
            requestedAdminEmail: school.invites[0].email,
            createdAt: school.invites[0].createdAt,
            metadata: { plan: planToLegacy(school.invites[0].plan) },
          }
        : null,
    });

    const toLegacyInvite = (invite: {
      token: string;
      email: string;
      schoolName: string | null;
      status: InviteStatus;
      expiresAt: Date;
      acceptedAt?: Date | null;
      createdAt: Date;
      plan: PlanType;
    }) => ({
      token: invite.token,
      email: invite.email,
      schoolName: invite.schoolName || "",
      status: invite.status === InviteStatus.USED ? "accepted" : invite.status === InviteStatus.EXPIRED ? "expired" : "pending",
      expiresAt: invite.expiresAt,
      acceptedAt: invite.acceptedAt || null,
      createdAt: invite.createdAt,
      metadata: { plan: planToLegacy(invite.plan) },
    });

    const getSchoolById = async (schoolId: string) =>
      prisma.school.findUnique({
        where: { id: schoolId },
        include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } },
      });

    const getSchoolByInviteToken = async (token: string) =>
      prisma.schoolInvite.findUnique({
        where: { token },
        include: { school: true },
      });

    const createOrRotateSchoolInvite = async (schoolId: string, email?: string | null) => {
      const existing = await prisma.schoolInvite.findFirst({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
      });

      if (existing && existing.status === InviteStatus.PENDING && existing.expiresAt.getTime() > Date.now()) {
        return existing;
      }

      if (existing && existing.status === InviteStatus.PENDING) {
        await prisma.schoolInvite.update({ where: { id: existing.id }, data: { status: InviteStatus.EXPIRED } });
      }

      const school = await prisma.school.findUnique({ where: { id: schoolId } });
      if (!school) {
        throw new Error("School not found");
      }

      return prisma.schoolInvite.create({
        data: {
          schoolId,
          token: crypto.randomUUID(),
          email: String(email || school.email || "").toLowerCase(),
          schoolName: school.name,
          plan: school.plan,
          status: InviteStatus.PENDING,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
    };

    export const createSchool = async (req: Request, res: Response) => {
      try {
        if (req.masterUser?.role !== "super_admin") {
          return res.status(403).json({ message: "Only super_admin can create schools" });
        }

        const { schoolName, systemType, dbName, foundedYear, location, contactEmail, contactPhone, isPilot, plan } = req.body;

        if (!schoolName || !systemType || !dbName) {
          return res.status(400).json({ message: "Required fields missing" });
        }

        const school = await prisma.school.create({
          data: {
            name: String(schoolName).trim(),
            subdomain: String(dbName).trim(),
            type: mapSystemTypeToSchoolType(systemType),
            plan: planFromLegacy(plan),
            status: isPilot ? SchoolStatus.PENDING : SchoolStatus.ACTIVE,
            city: location ? String(location).trim() : null,
            phone: contactPhone ? String(contactPhone).trim() : null,
            email: contactEmail ? String(contactEmail).trim().toLowerCase() : null,
            system: String(systemType),
          },
        });

        await prisma.schoolConfig.upsert({
          where: { schoolId: school.id },
          create: { schoolId: school.id, gradesPerTerm: 3, termsPerYear: 3, passMark: 10, maxAbsences: 10 },
          update: {},
        });

        return res.status(201).json({
          message: "School created",
          school: toLegacySchool({ ...school, invites: [] }),
        });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const inviteSchool = async (req: Request, res: Response) => {
      try {
        if (req.masterUser?.role !== "super_admin") {
          return res.status(403).json({ message: "Only super_admin can invite schools" });
        }

        const { requestedAdminEmail, schoolName, templateKey = "fr_secondary", plan = "standard" } = req.body ?? {};
        if (!requestedAdminEmail || !schoolName) {
          return res.status(400).json({ message: "L'email et le nom de l'établissement sont requis" });
        }

        const normalizedEmail = String(requestedAdminEmail).trim().toLowerCase();
        const normalizedSchoolName = String(schoolName).trim();
        const template = getSchoolTemplate(String(templateKey)) ?? getSchoolTemplate("fr_secondary")!;

        const subdomain = String(normalizedSchoolName)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || `school-${Date.now()}`;

        const school = await prisma.school.create({
          data: {
            name: normalizedSchoolName,
            subdomain,
            type: mapSystemTypeToSchoolType(template.systemType),
            plan: planFromLegacy(plan),
            status: SchoolStatus.PENDING,
            email: normalizedEmail,
            system: template.systemType,
            city: null,
          },
        });

        const invite = await prisma.schoolInvite.create({
          data: {
            schoolId: school.id,
            token: crypto.randomUUID(),
            email: normalizedEmail,
            schoolName: normalizedSchoolName,
            plan: planFromLegacy(plan),
            status: InviteStatus.PENDING,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${invite.token}`;
        const inviteTemplate = buildSchoolInviteTemplate({
          schoolName: normalizedSchoolName,
          requestedAdminName: "Administrateur",
          activationUrl,
          language: "fr",
        });

        await sendTransactionalEmail({
          recipientEmail: normalizedEmail,
          subject: inviteTemplate.subject,
          html: inviteTemplate.html,
          text: inviteTemplate.text,
          template: "school_invite",
          eventType: "school_invite",
          metadata: { token: invite.token, templateKey: template.key, plan: String(plan).toLowerCase(), schoolId: school.id },
        });

        return res.status(201).json({
          message: "Invitation envoyée",
          invite: {
            token: invite.token,
            email: normalizedEmail,
            schoolName: normalizedSchoolName,
            templateKey: template.key,
            plan: String(plan).toLowerCase(),
          },
        });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const listSchools = async (req: Request, res: Response) => {
      try {
        if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
          return res.status(403).json({ message: "Not authorized" });
        }

        const schools = await prisma.school.findMany({
          orderBy: { createdAt: "desc" },
          include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } },
        });

        return res.json({ schools: schools.map((school) => toLegacySchool(school)), total: schools.length });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const getSchool = async (req: Request, res: Response) => {
      try {
        const school = await getSchoolById(req.params.schoolId);
        if (!school) {
          return res.status(404).json({ message: "School not found" });
        }

        return res.json(toLegacySchool(school));
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const updateSchool = async (req: Request, res: Response) => {
      try {
        if (req.masterUser?.role !== "super_admin") {
          return res.status(403).json({ message: "Only super_admin can update schools" });
        }

        const current = await prisma.school.findUnique({ where: { id: req.params.schoolId } });
        if (!current) {
          return res.status(404).json({ message: "School not found" });
        }

        const updated = await prisma.school.update({
          where: { id: current.id },
          data: {
            name: req.body.schoolName ?? current.name,
            email: req.body.contactEmail ?? current.email,
            phone: req.body.contactPhone ?? current.phone,
            city: req.body.location ?? current.city,
            plan: req.body.plan ? planFromLegacy(req.body.plan) : current.plan,
            type: req.body.systemType ? mapSystemTypeToSchoolType(req.body.systemType) : current.type,
            status: req.body.isActive === false ? SchoolStatus.SUSPENDED : current.status,
          },
          include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } },
        });

        return res.json({ message: "School updated", school: toLegacySchool(updated) });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const deleteSchool = async (req: Request, res: Response) => {
      try {
        if (req.masterUser?.role !== "super_admin") {
          return res.status(403).json({ message: "Not authorized" });
        }

        const school = await prisma.school.findUnique({ where: { id: req.params.schoolId } });
        if (!school) {
          return res.status(404).json({ message: "School not found" });
        }

        await prisma.school.delete({ where: { id: school.id } });

        return res.json({ message: "School deleted", schoolId: school.id });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const suspendSchool = async (req: Request, res: Response) => {
      try {
        const school = await prisma.school.findUnique({ where: { id: req.params.schoolId } });
        if (!school) {
          return res.status(404).json({ message: "School not found" });
        }

        const updated = await prisma.school.update({ where: { id: school.id }, data: { status: SchoolStatus.SUSPENDED } });
        return res.json({ message: "School suspended", school: toLegacySchool({ ...updated, invites: [] }) });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const reactivateSchool = async (req: Request, res: Response) => {
      try {
        const school = await prisma.school.findUnique({ where: { id: req.params.schoolId } });
        if (!school) {
          return res.status(404).json({ message: "School not found" });
        }

        const updated = await prisma.school.update({
          where: { id: school.id },
          data: { status: SchoolStatus.ACTIVE },
        });
        return res.json({ message: "School reactivated", school: toLegacySchool({ ...updated, invites: [] }) });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const regenerateSchoolInvite = async (req: Request, res: Response) => {
      try {
        const school = await prisma.school.findUnique({ where: { id: req.params.schoolId } });
        if (!school) {
          return res.status(404).json({ message: "School not found" });
        }

        const invite = await createOrRotateSchoolInvite(school.id, school.email);
        const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${invite.token}`;

        if (school.email) {
          const inviteTemplate = buildSchoolInviteTemplate({
            schoolName: school.name,
            requestedAdminName: school.name,
            activationUrl,
            language: "fr",
          });

          await sendTransactionalEmail({
            recipientEmail: school.email,
            subject: inviteTemplate.subject,
            html: inviteTemplate.html,
            text: inviteTemplate.text,
            template: "school_invite",
            eventType: "school_invite",
            metadata: { schoolId: school.id, regenerated: true, token: invite.token },
          });
        }

        return res.json({
          message: "School invite regenerated",
          invite: toLegacyInvite(invite),
          activationUrl,
        });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const resendSchoolInviteEmail = async (req: Request, res: Response) => {
      try {
        const school = await prisma.school.findUnique({
          where: { id: req.params.schoolId },
          include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } },
        });

        if (!school) {
          return res.status(404).json({ message: "School not found" });
        }

        const invite = school.invites[0];
        if (!invite) {
          return res.status(404).json({ message: "No invite found for this school" });
        }

        const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${invite.token}`;
        const inviteTemplate = buildSchoolInviteTemplate({
          schoolName: school.name,
          requestedAdminName: school.name,
          activationUrl,
          language: "fr",
        });

        await sendTransactionalEmail({
          recipientEmail: school.email || invite.email,
          subject: inviteTemplate.subject,
          html: inviteTemplate.html,
          text: inviteTemplate.text,
          template: "school_invite",
          eventType: "school_invite",
          metadata: { schoolId: school.id, resend: true, token: invite.token },
        });

        return res.json({ message: "Invite email resent", invite: toLegacyInvite(invite), activationUrl });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const getSchoolActivityLogs = async (req: Request, res: Response) => {
      try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
        const search = String(req.query.search || "").trim();
        const skip = (page - 1) * limit;

        const where: any = {
          schoolId: req.params.schoolId,
          ...(search
            ? {
                OR: [
                  { action: { contains: search, mode: "insensitive" } },
                  { description: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        };

        const [total, logs] = await Promise.all([
          prisma.activitiesLog.count({ where }),
          prisma.activitiesLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
        ]);

        return res.json({
          logs,
          pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
        });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const getSchoolInviteEmailStatus = async (req: Request, res: Response) => {
      try {
        const school = await prisma.school.findUnique({
          where: { id: req.params.schoolId },
          include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } },
        });

        const lastEmail = await prisma.emailLog.findFirst({
          where: { schoolId: req.params.schoolId },
          orderBy: { createdAt: "desc" },
        });

        return res.json({
          invite: school?.invites[0] ? toLegacyInvite(school.invites[0]) : null,
          lastEmail: lastEmail || null,
        });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const getMasterEmailLogs = async (req: Request, res: Response) => {
      try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
        const search = String(req.query.search || "").trim();
        const status = String(req.query.status || "").trim();
        const schoolId = String(req.query.schoolId || "").trim();
        const skip = (page - 1) * limit;

        const where: any = {
          ...(status ? { status } : {}),
          ...(schoolId ? { schoolId } : {}),
          ...(search
            ? {
                OR: [
                  { to: { contains: search, mode: "insensitive" } },
                  { subject: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        };

        const [total, logs] = await Promise.all([
          prisma.emailLog.count({ where }),
          prisma.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
        ]);

        return res.json({
          logs,
          pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
          filters: { search: search || null, status: status || null, schoolId: schoolId || null },
        });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const getMasterAuthAuditLogs = async (req: Request, res: Response) => {
      try {
        if (req.masterUser?.role !== "super_admin") {
          return res.status(403).json({ message: "Not authorized" });
        }

        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const skip = (page - 1) * limit;

        const [logs, total] = await Promise.all([
          prisma.masterAuthAudit.findMany({ orderBy: { createdAt: "desc" }, skip, take: limit }),
          prisma.masterAuthAudit.count(),
        ]);

        return res.json({
          logs,
          pagination: { total, page, pages: Math.ceil(total / limit) || 1, limit },
        });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const setSchoolConfig = async (req: Request, res: Response) => {
      try {
        const config = await prisma.schoolConfig.upsert({
          where: { schoolId: req.params.schoolId },
          create: {
            schoolId: req.params.schoolId,
            gradesPerTerm: Number(req.body?.gradesPerTerm || 3),
            termsPerYear: Number(req.body?.termsPerYear || 3),
            passMark: Number(req.body?.passMark ?? 10),
            maxAbsences: Number(req.body?.maxAbsences ?? 10),
            smsEnabled: Boolean(req.body?.smsEnabled ?? false),
            offlineModeEnabled: Boolean(req.body?.offlineModeEnabled ?? true),
            aiAlertsEnabled: Boolean(req.body?.aiAlertsEnabled ?? true),
            messageModeration: Boolean(req.body?.messageModeration ?? false),
          },
          update: {
            gradesPerTerm: Number(req.body?.gradesPerTerm || 3),
            termsPerYear: Number(req.body?.termsPerYear || 3),
            passMark: Number(req.body?.passMark ?? 10),
            maxAbsences: Number(req.body?.maxAbsences ?? 10),
            smsEnabled: Boolean(req.body?.smsEnabled ?? false),
            offlineModeEnabled: Boolean(req.body?.offlineModeEnabled ?? true),
            aiAlertsEnabled: Boolean(req.body?.aiAlertsEnabled ?? true),
            messageModeration: Boolean(req.body?.messageModeration ?? false),
          },
        });

        return res.json({ message: "Config updated", config });
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

    export const getSchoolConfig = async (req: Request, res: Response) => {
      try {
        const config = await prisma.schoolConfig.findUnique({ where: { schoolId: req.params.schoolId } });
        return res.json(config || {});
      } catch (error: any) {
        return res.status(500).json({ message: error.message || "Server error" });
      }
    };

export const masterVerifyEmailCode = async (req: Request, res: Response) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    const token = req.cookies?.master_preauth;
    const code = String(req.body?.code || "").trim();

    if (!token) {
      return res.status(401).json({ message: "Email challenge missing" });
    }

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: "Invalid email code format" });
    }

    const decoded = jwt.verify(token, masterJwtSecret, {
      algorithms: ["HS512"],
    }) as any;

    if (decoded?.tokenType !== "master_preauth") {
      return res.status(401).json({ message: "Invalid email challenge" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, isSuperAdmin: true, passwordHash: true },
    });

    if (!masterUser) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_user_not_authorized",
        email: decoded?.email,
      });
      return res.status(401).json({ message: "Not authorized" });
    }

    const tokenOtpHash =
      typeof decoded?.emailOtpHash === "string" && decoded.emailOtpHash.trim().length > 0
        ? decoded.emailOtpHash
        : null;
    const tokenOtpExpiresAt =
      typeof decoded?.emailOtpExpiresAt === "string"
        ? decoded.emailOtpExpiresAt
        : null;

    const effectiveOtpHash = tokenOtpHash;
    const effectiveOtpExpiresAt = tokenOtpExpiresAt;

    if (!effectiveOtpHash || !effectiveOtpExpiresAt) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_missing",
        email: masterUser.email,
      });

      return res.status(400).json({ message: "Email verification not initialized" });
    }

    const expiresAt = new Date(effectiveOtpExpiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_expired",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Email code expired" });
    }

    const isValidEmailCode = await bcrypt.compare(code, effectiveOtpHash);

    if (!isValidEmailCode) {
      void logMasterAuthAudit({
        req,
        outcome: "failure",
        reason: "email_otp_invalid",
        email: masterUser.email,
      });
      return res.status(401).json({ message: "Invalid email verification code" });
    }

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "email_otp_verified",
      email: masterUser.email,
    });

    const sessionToken = signMasterSessionToken({
      id: masterUser.id,
      email: masterUser.email,
      role: masterUser.isSuperAdmin ? "super_admin" : "support",
    });

    res.cookie("master_jwt", sessionToken, {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });

    res.clearCookie("master_preauth", {
      httpOnly: false,
      secure: false,
      sameSite: "lax",
    });

    return res.json({
      message: "Master login successful",
      role: masterUser.isSuperAdmin ? "super_admin" : "support",
      email: masterUser.email,
    });
  } catch (error: any) {
    void logMasterAuthAudit({
      req,
      outcome: "failure",
      reason: "email_otp_verification_error",
      email: req.body?.email,
    });
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getMasterAuthAuditLogs = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const filters: any = {};
    if (req.query.reason) filters.action = { contains: String(req.query.reason), mode: "insensitive" };
    if (req.query.email) filters.description = { contains: String(req.query.email).trim().toLowerCase(), mode: "insensitive" };

    const [logs, total] = await Promise.all([
      prisma.masterAuthAudit.findMany({
        where: filters,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.masterAuthAudit.count({ where: filters }),
    ]);

    return res.json({
      logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const masterMe = async (req: Request, res: Response) => {
  if (!req.masterUser) {
    return res.status(401).json({ message: "Not authorized" });
  }

  return res.json({ user: req.masterUser });
};

export const getMasterMfaStatus = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: { id: true },
    });

    if (!masterUser) {
      return res.status(404).json({ message: "Master user not found" });
    }

    return res.json({
      mfaEnabled: false,
      hasPendingMfaSetup: false,
      recoveryCodesRemaining: 0,
      recoveryCodesGeneratedAt: null,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const regenerateMasterRecoveryCodes = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

        return res.status(501).json({ message: "MFA management is not supported by the current Prisma schema" });

export const disableMasterMfa = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

        return res.status(501).json({ message: "MFA management is not supported by the current Prisma schema" });

export const beginMasterMfaEnable = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

        return res.status(501).json({ message: "MFA setup is not supported by the current Prisma schema" });

export const confirmMasterMfaEnable = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

        return res.status(501).json({ message: "MFA setup is not supported by the current Prisma schema" });

export const startMasterPasswordChange = async (req: Request, res: Response) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Fetch master user via Prisma
    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (!masterUser || masterUser.isActive === false) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Generate 6-digit OTP code
    const code = generateLoginEmailCode(); // Returns 6-digit string from utils

    // Hash the code with bcrypt
    const emailOtpHash = await bcrypt.hash(code, 10);

    // Define OTP TTL (15 minutes)
    const masterPasswordChangeOtpTtlMs = 15 * 60 * 1000;
    const emailOtpExpiresAt = new Date(Date.now() + masterPasswordChangeOtpTtlMs).toISOString();

    // Create JWT token with embedded OTP hash and expiration
    const masterPasswordChangeOtpTtl = "15m";
    const challengeToken = jwt.sign(
      {
        tokenType: "master_password_change",
        id: masterUser.id,
        email: masterUser.email,
        emailOtpHash,
        emailOtpExpiresAt,
      },
      masterJwtSecret,
      { algorithm: "HS512", expiresIn: masterPasswordChangeOtpTtl }
    );

    // Set cookie with challenge token
    res.cookie("master_pwd_change_challenge", challengeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: masterPasswordChangeOtpTtlMs,
    });

    // Send email with code
    await sendTransactionalEmail({
      to: masterUser.email,
      template: "master_password_change_code",
      subject: "Password Change Verification Code",
      data: {
        code,
        expiresInMinutes: 15,
      },
    }).catch((emailError: any) => {
      console.error("Email send error in startMasterPasswordChange:", emailError);
      // Don't throw; let user know email failed
    });

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "password_change_email_otp_sent",
      email: masterUser.email,
    });

    return res.json({
      message: "Email verification code sent for password change",
      requiresEmailVerification: true,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const confirmMasterPasswordChange = async (req: Request, res: Response) => {
  try {
    if (!masterJwtSecret) {
      return res.status(500).json({ message: "Master auth misconfigured" });
    }

    if (!req.masterUser?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    const challengeToken = req.cookies?.master_pwd_change_challenge;
    if (!challengeToken) {
      return res.status(401).json({ message: "Password-change challenge missing" });
    }

    const emailCode = String(req.body?.emailCode || "").trim();
    const newPassword = String(req.body?.newPassword || "");
    const confirmNewPassword = String(req.body?.confirmNewPassword || "");

    if (!/^\d{6}$/.test(emailCode)) {
      return res.status(400).json({ message: "Invalid email code format" });
    }

    if (newPassword.length < 12) {
      return res.status(400).json({ message: "New password must contain at least 12 characters" });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(challengeToken, masterJwtSecret, {
        algorithms: ["HS512"],
      });
    } catch (jwtError: any) {
      return res.status(401).json({ message: "Password-change challenge expired or invalid" });
    }

    if (decoded?.tokenType !== "master_password_change") {
      return res.status(401).json({ message: "Invalid password-change challenge" });
    }

    if (String(decoded.id) !== String(req.masterUser.id)) {
      return res.status(401).json({ message: "Password-change challenge does not match current user" });
    }

    // Extract OTP hash from JWT token (Prisma approach: stored in JWT, not database)
    const emailOtpHash = decoded.emailOtpHash;
    const emailOtpExpiresAt = decoded.emailOtpExpiresAt;

    if (!emailOtpHash || !emailOtpExpiresAt) {
      return res.status(400).json({ message: "Password-change email verification is not initialized" });
    }

    const expiresAt = new Date(emailOtpExpiresAt).getTime();
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      return res.status(401).json({ message: "Email code expired" });
    }

    // Verify email code against JWT-stored hash
    const isValidEmailCode = await bcrypt.compare(emailCode, emailOtpHash);
    if (!isValidEmailCode) {
      return res.status(401).json({ message: "Invalid email verification code" });
    }

    // Fetch master user via Prisma
    const masterUser = await prisma.masterUser.findUnique({
      where: { id: req.masterUser.id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!masterUser || masterUser.isActive === false) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Check if new password is different from current password
    const isSamePassword = await bcrypt.compare(newPassword, masterUser.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password via Prisma
    await prisma.masterUser.update({
      where: { id: req.masterUser.id },
      data: { passwordHash: hashedPassword },
    });

    res.clearCookie("master_pwd_change_challenge", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    void logMasterAuthAudit({
      req,
      outcome: "success",
      reason: "password_changed_from_security_dashboard",
      email: masterUser.email,
    });

    return res.json({
      message: "Password changed successfully",
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const masterLogout = async (_req: Request, res: Response) => {
  res.clearCookie("master_jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.clearCookie("master_preauth", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  res.clearCookie("master_pwd_change_challenge", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res.json({ message: "Master logout successful" });
};

/**
 * SCHOOLS MANAGEMENT
 */

const legacyPlanFromInput = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "premium") return PlanType.PREMIUM;
  if (normalized === "standard") return PlanType.STANDARD;
  return PlanType.DISCOVERY;
};

const legacySchoolTypeFromInput = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("bilingual")) return SchoolType.BILINGUAL;
  if (normalized.includes("technical")) return SchoolType.TECHNICAL;
  if (normalized.includes("university")) return SchoolType.UNIVERSITY;
  if (normalized.includes("primary")) return SchoolType.PRIMARY;
  if (normalized.includes("preschool") || normalized.includes("pre-school") || normalized.includes("nursery")) return SchoolType.PRESCHOOL;
  return SchoolType.SECONDARY;
};

const legacySchoolStatusFromInput = (value?: string | null) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pending") return SchoolStatus.PENDING;
  if (normalized === "approved") return SchoolStatus.APPROVED;
  if (normalized === "active") return SchoolStatus.ACTIVE;
  if (normalized === "suspended") return SchoolStatus.SUSPENDED;
  return SchoolStatus.REJECTED;
};

const normalizeSchoolSubdomain = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const readString = (...values: Array<unknown>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
};

export const createSchool = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Only super_admin can create schools" });
    }

    const body = req.body ?? {};
    const schoolName = String(body.schoolName || body.name || "").trim();

    if (!schoolName) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const subdomain = buildSchoolDbName(schoolName)
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!subdomain) {
      return res.status(400).json({ message: "Invalid school subdomain" });
    }

    const school = await prisma.school.create({
      data: {
        name: schoolName,
        subdomain,
        type: legacySchoolStatusFromInput(String(body.systemType || body.type)) === SchoolStatus.REJECTED
          ? SchoolType.SECONDARY
          : legacySchoolTypeFromInput(String(body.systemType || body.type)),
        plan: legacyPlanFromInput(String(body.plan)),
        status: SchoolStatus.ACTIVE,
        city: String(body.location || body.city || "").trim() || null,
        region: String(body.region || "").trim() || null,
        address: String(body.address || body.location || "").trim() || null,
        phone: String(body.contactPhone || body.phone || "").trim() || null,
        email: String(body.contactEmail || body.email || "").trim().toLowerCase() || null,
        language: String(body.language || "fr").trim() || "fr",
        system: String(body.system || body.systemType || "francophone").trim() || "francophone",
        contractEnd: body.contractEnd ? new Date(body.contractEnd) : null,
      },
    });

    await logActivity({
      userId: String(req.masterUser?.id || ""),
      action: "Created school",
      details: `${school.name} (${school.subdomain})`,
      schoolId: school.id,
    });

    return res.status(201).json({
      message: "School created",
      school,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

/**
 * POST /api/master/schools/invite
 *
 * Flux principal du dashboard super admin — modale "✉ Inviter une école" :
 *   1. Super admin saisit l'email du responsable (+ nom et template optionnels)
 *   2. Crée la School en statut "pending"
 *   3. Génère un SchoolInvite avec token UUID sécurisé (expire 7j)
 *   4. Envoie un email d'invitation à requestedAdminEmail
 *   5. L'école apparaît dans l'onglet PENDING du Hub de Contrôle
 *
 * Body :
 *   - requestedAdminEmail  (requis)
 *   - schoolName           (optionnel — déduit de l'email si absent)
 *   - templateKey          (optionnel — défaut: "fr_secondary")
 *   - plan                 (optionnel — "premium" | "standard" | "decouverte", défaut: "standard")
 *
 * ⚠️  Route à placer AVANT /:schoolId dans masterAdmin.ts (routes) :
 *     router.post("/schools/invite", protectMaster, authorizeMaster(["super_admin"]),
 *       masterMfaLimiter, requireMasterSensitiveAuth, inviteSchool);
 */
export const inviteSchool = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Only super_admin can invite schools" });
    }

    const body = req.body ?? {};
    const requestedAdminEmail = readString(body.requestedAdminEmail, body.email).toLowerCase();
    const schoolName = readString(body.schoolName, body.name);
    const templateKey = readString(body.templateKey) || "fr_secondary";
    const plan = legacyPlanFromInput(readString(body.plan, body.subscriptionPlan));

    if (!requestedAdminEmail || !schoolName) {
      return res.status(400).json({ message: "L'email et le nom de l'établissement sont requis" });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestedAdminEmail)) {
      return res.status(400).json({ message: "Email invalide" });
    }

    const template = getSchoolTemplate(templateKey) ?? getSchoolTemplate("fr_secondary")!;
    const subdomain = normalizeSchoolSubdomain(buildSchoolDbName(schoolName));
    const existingInvite = await prisma.schoolInvite.findFirst({
      where: {
        email: requestedAdminEmail,
        status: InviteStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      await prisma.schoolInvite.updateMany({
        where: { email: requestedAdminEmail, status: InviteStatus.PENDING },
        data: { status: InviteStatus.EXPIRED },
      });
    }

    const school = await prisma.school.create({
      data: {
        name: schoolName,
        subdomain,
        type: legacySchoolTypeFromInput(readString(body.systemType, body.type)),
        plan,
        status: SchoolStatus.PENDING,
        email: requestedAdminEmail,
        language: "fr",
        system: "francophone",
      },
    });

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${token}`;

    const invite = await prisma.schoolInvite.create({
      data: {
        email: requestedAdminEmail,
        schoolName,
        token,
        plan,
        status: InviteStatus.PENDING,
        expiresAt,
        schoolId: school.id,
      },
    });

    const inviteTemplate = buildSchoolInviteTemplate({
      schoolName,
      requestedAdminName: "Administrateur",
      activationUrl,
      language: "fr",
    });

    await sendTransactionalEmail({
      recipientEmail: requestedAdminEmail,
      subject: inviteTemplate.subject,
      html: inviteTemplate.html,
      text: inviteTemplate.text,
      template: "school_invite",
      eventType: "school_invite",
      relatedEntityType: "School",
      relatedEntityId: school.id,
      metadata: {
        schoolId: school.id,
        token,
        templateKey,
        plan: String(body.plan || "standard").toLowerCase(),
      },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Invited school",
      details: `${schoolName} → ${requestedAdminEmail} (template: ${template.key}, plan: ${plan})`,
      schoolId: school.id,
    });

    return res.status(201).json({
      message: "Invitation envoyée",
      invite: {
        token: invite.token,
        email: invite.email,
        schoolName: invite.schoolName,
        templateKey: template.key,
        plan: invite.plan,
      },
      school,
    });
  } catch (error: any) {
    console.error("[inviteSchool] Error:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const listSchools = async (req: Request, res: Response) => {
  try {
    if (!["super_admin", "platform_admin"].includes(req.masterUser?.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const schools = await prisma.school.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        schoolConfig: true,
        schoolSettings: true,
        invites: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return res.json({
      schools: schools.map((school) => ({
        ...school,
        latestInvite: school.invites[0] || null,
      })),
      total: schools.length,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchool = async (req: Request, res: Response) => {
  try {
    const school = await prisma.school.findUnique({
      where: { id: req.params.schoolId },
      include: {
        schoolConfig: true,
        schoolSettings: true,
        invites: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        activitiesLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    return res.json(school);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const updateSchool = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Only super_admin can update schools" });
    }

    const body = req.body ?? {};
    const data: Record<string, any> = {};

    const name = readString(body.schoolName, body.name);
    if (name) data.name = name;

    const subdomain = readString(body.subdomain, body.dbName);
    if (subdomain) data.subdomain = normalizeSchoolSubdomain(subdomain);

    if (body.systemType || body.type) {
      data.type = legacySchoolTypeFromInput(readString(body.systemType, body.type));
    }

    if (body.plan) {
      data.plan = legacyPlanFromInput(readString(body.plan));
    }

    if (body.status) {
      data.status = legacySchoolStatusFromInput(readString(body.status));
    }

    if (body.city || body.location) data.city = readString(body.city, body.location) || null;
    if (body.region) data.region = readString(body.region) || null;
    if (body.address || body.location) data.address = readString(body.address, body.location) || null;
    if (body.phone || body.contactPhone) data.phone = readString(body.phone, body.contactPhone) || null;
    if (body.email || body.contactEmail) data.email = readString(body.email, body.contactEmail).toLowerCase() || null;
    if (body.logoUrl) data.logoUrl = readString(body.logoUrl) || null;
    if (body.language) data.language = readString(body.language) || null;
    if (body.systemType || body.system) data.system = readString(body.systemType, body.system) || null;
    if (body.contractEnd) data.contractEnd = toOptionalDate(body.contractEnd) || null;

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No updatable school fields provided" });
    }

    const school = await prisma.school.update({
      where: { id: req.params.schoolId },
      data,
    });

    return res.json({ message: "School updated", school });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "School not found" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolActivityLogs = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const search = String(req.query.search || "").trim();
    const skip = (page - 1) * limit;

    const where: any = { schoolId };
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.activitiesLog.count({ where }),
      prisma.activitiesLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return res.json({
      logs,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const suspendSchool = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const reason = String(req.body?.reason || req.body?.motif || "").trim();
    const school = await prisma.school.update({
      where: { id: req.params.schoolId },
      data: { status: SchoolStatus.SUSPENDED },
    });

    await prisma.schoolInvite.updateMany({
      where: { schoolId: school.id, status: InviteStatus.PENDING },
      data: { status: InviteStatus.EXPIRED },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Suspended school",
      details: `${school.name}${reason ? ` - ${reason}` : ""}`,
      schoolId: school.id,
    });

    return res.json({ message: "School suspended", school });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "School not found" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const reactivateSchool = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const school = await prisma.school.update({
      where: { id: req.params.schoolId },
      data: { status: SchoolStatus.ACTIVE },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Reactivated school",
      details: school.name,
      schoolId: school.id,
    });

    return res.json({ message: "School reactivated", school });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "School not found" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const deleteSchool = async (req: Request, res: Response) => {
  try {
    if (req.masterUser?.role !== "super_admin") {
      return res.status(403).json({ message: "Not authorized" });
    }

    const school = await prisma.school.findUnique({
      where: { id: req.params.schoolId },
      select: { id: true, name: true, subdomain: true },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    await prisma.schoolInvite.deleteMany({ where: { schoolId: school.id } });
    await prisma.school.delete({ where: { id: school.id } });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Deleted school",
      details: `${school.name} (${school.subdomain})`,
      schoolId: school.id,
    });

    return res.json({ message: "School deleted", schoolId: school.id });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return res.status(404).json({ message: "School not found" });
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const regenerateSchoolInvite = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const school = await prisma.school.findUnique({
      where: { id: req.params.schoolId },
      include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const currentInvite = school.invites[0] || null;
    if (currentInvite?.status === InviteStatus.PENDING) {
      await prisma.schoolInvite.update({
        where: { id: currentInvite.id },
        data: { status: InviteStatus.EXPIRED },
      });
    }

    const recipientEmail = school.email || currentInvite?.email || null;
    if (!recipientEmail) {
      return res.status(400).json({ message: "No admin email configured for this school" });
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${token}`;
    const inviteTemplate = buildSchoolInviteTemplate({
      schoolName: school.name,
      requestedAdminName: school.name,
      activationUrl,
      language: "fr",
    });

    const invite = await prisma.schoolInvite.create({
      data: {
        email: recipientEmail,
        schoolName: school.name,
        token,
        status: InviteStatus.PENDING,
        plan: school.plan,
        expiresAt,
        schoolId: school.id,
      },
    });

    await sendTransactionalEmail({
      recipientEmail,
      subject: inviteTemplate.subject,
      html: inviteTemplate.html,
      text: inviteTemplate.text,
      template: "school_invite",
      eventType: "school_invite",
      relatedEntityType: "School",
      relatedEntityId: school.id,
      metadata: { schoolId: school.id, token, regenerated: true },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Regenerated school invite",
      details: school.name,
      schoolId: school.id,
    });

    return res.json({
      message: "School invite regenerated",
      invite: {
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt,
        requestedAdminName: invite.schoolName,
        requestedAdminEmail: invite.email,
      },
      activationUrl,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const resendSchoolInviteEmail = async (req: Request, res: Response) => {
  try {
    if (!req.masterUser || !["super_admin", "platform_admin"].includes(req.masterUser.role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const school = await prisma.school.findUnique({
      where: { id: req.params.schoolId },
      include: { invites: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const invite = school.invites[0] || null;
    const recipientEmail = school.email || invite?.email || null;

    if (!recipientEmail) {
      return res.status(400).json({ message: "No admin email configured for this school" });
    }

    if (!invite) {
      return res.status(404).json({ message: "No invite found for this school" });
    }

    if (invite.status !== InviteStatus.PENDING) {
      return res.status(409).json({ message: "No pending invite to resend. Please regenerate first." });
    }

    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${invite.token}`;
    const inviteTemplate = buildSchoolInviteTemplate({
      schoolName: school.name,
      requestedAdminName: invite.schoolName || school.name,
      activationUrl,
      language: "fr",
    });

    await sendTransactionalEmail({
      recipientEmail,
      subject: inviteTemplate.subject,
      html: inviteTemplate.html,
      text: inviteTemplate.text,
      template: "school_invite",
      eventType: "school_invite",
      relatedEntityType: "School",
      relatedEntityId: school.id,
      metadata: { schoolId: school.id, resend: true },
    });

    await logActivity({
      userId: String(req.masterUser.id),
      action: "Resent school invite email",
      details: school.name,
      schoolId: school.id,
    });

    return res.json({
      message: "Invite email resent",
      invite: {
        token: invite.token,
        status: invite.status,
        expiresAt: invite.expiresAt,
        requestedAdminName: invite.schoolName,
        requestedAdminEmail: invite.email,
      },
      activationUrl,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolInviteEmailStatus = async (req: Request, res: Response) => {
  try {
    const { schoolId } = req.params;

    const lastEmail = await prisma.emailLog.findFirst({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ lastEmail: lastEmail || null });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

/**
 * SCHOOL CONFIGS
 */
