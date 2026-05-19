import { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  InviteStatus,
  AcademicYearStatus,
  EducationType,
  GradingSystem,
  PlanType,
  SchoolStatus,
  SchoolLevel,
  SchoolOwnership,
  SchoolSubsystem,
  UserRole,
  PeriodType,
  SequenceType,
  SectionLanguage,
  SchoolType,
  type School,
  type SchoolInvite,
} from "@prisma/client";
import { prisma } from "../config/prisma.ts";
import {
  getSchoolTemplate,
  SCHOOL_ONBOARDING_TEMPLATES,
  buildSchoolDbName,
  type SchoolTemplate,
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

const subsystemToLegacySystemType = (subsystem: SchoolSubsystem): "francophone" | "anglophone" | "bilingual" => {
  if (subsystem === SchoolSubsystem.ANGLOPHONE) return "anglophone";
  if (subsystem === SchoolSubsystem.BILINGUAL) return "bilingual";
  return "francophone";
};

const schoolTypeToLegacyStructure = (type: SchoolType): "simple" | "complex" =>
  type === SchoolType.MULTI ? "complex" : "simple";

const schoolTypeFromTemplate = (template?: SchoolTemplate | null) => {
  const templateKey = String(template?.key || "").toLowerCase();
  if (templateKey.includes("bilingual")) return SchoolType.MULTI;
  if (templateKey.includes("primary")) return SchoolType.PRIMARY;
  if (templateKey.includes("technical")) return SchoolType.SECONDARY;
  return SchoolType.SECONDARY;
};

const subsystemFromTemplate = (template?: SchoolTemplate | null) => {
  if (template?.systemType === "anglophone") return SchoolSubsystem.ANGLOPHONE;
  if (template?.systemType === "bilingual") return SchoolSubsystem.BILINGUAL;
  return SchoolSubsystem.FRANCOPHONE;
};

const educationTypeFromTemplate = (template?: SchoolTemplate | null) => {
  const templateKey = String(template?.key || "").toLowerCase();
  if (templateKey.includes("technical")) return EducationType.TECHNICAL;
  if (template?.systemType === "bilingual") return EducationType.MIXED;
  return EducationType.GENERAL;
};

const schoolLevelFromTemplate = (template?: SchoolTemplate | null) => {
  const templateKey = String(template?.key || "").toLowerCase();
  if (templateKey.includes("primary")) return SchoolLevel.PRIMARY;
  if (templateKey.includes("bilingual")) return SchoolLevel.MULTI;
  if (templateKey.includes("technical")) return SchoolLevel.SECONDARY;
  return SchoolLevel.SECONDARY;
};

const gradeSystemFromTemplate = (template?: SchoolTemplate | null) => {
  const gradingSystem = String(template?.gradingSystem || "").toLowerCase();
  return gradingSystem === "percent" ? GradingSystem.OUT_OF_100 : GradingSystem.OUT_OF_20;
};

const sectionLanguageFromSubsystem = (subsystem: SchoolSubsystem) =>
  subsystem === SchoolSubsystem.ANGLOPHONE ? SectionLanguage.EN : SectionLanguage.FR;

const schoolYearBounds = (referenceDate = new Date()) => {
  const year = referenceDate.getMonth() >= 8 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
  return {
    startDate: new Date(year, 8, 1),
    endDate: new Date(year + 1, 6, 31),
    academicYearLabel: `${year}-${year + 1}`,
  };
};

const addMonths = (date: Date, months: number) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const buildProvisioningBlueprint = (school: School, template?: SchoolTemplate | null) => {
  const subsystem = school.subsystem || subsystemFromTemplate(template);
  const sections =
    subsystem === SchoolSubsystem.BILINGUAL
      ? [
          { name: "Section française", code: SectionLanguage.FR },
          { name: "English Section", code: SectionLanguage.EN },
        ]
      : [
          {
            name: subsystem === SchoolSubsystem.ANGLOPHONE ? "English Section" : "Section francophone",
            code: sectionLanguageFromSubsystem(subsystem),
          },
        ];

  const classPrefix = subsystem === SchoolSubsystem.ANGLOPHONE ? "Class" : "Classe";
  const { startDate, endDate, academicYearLabel } = schoolYearBounds();
  const termsNames = template?.schoolConfig.termsNames?.length
    ? template.schoolConfig.termsNames
    : ["Trimestre 1", "Trimestre 2", "Trimestre 3"];
  const periodMonths = Math.max(1, Math.floor(12 / termsNames.length));

  const periods = termsNames.map((name, index) => {
    const periodStart = addMonths(startDate, index * periodMonths);
    const periodEnd = index === termsNames.length - 1 ? endDate : addMonths(startDate, (index + 1) * periodMonths);
    return { name, orderIndex: index + 1, startDate: periodStart, endDate: periodEnd };
  });

  return {
    sections,
    classPrefix,
    academicYearLabel,
    startDate,
    endDate,
    periods,
  };
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
  schoolMotto: getSchoolTemplate(school.templateCode || "")?.schoolMotto || "",
  systemType: subsystemToLegacySystemType(school.subsystem),
  structure: schoolTypeToLegacyStructure(school.type),
  onboardingStatus: statusToLegacy(school.status),
  dbName: school.subdomain,
  requestedAdminEmail: school.email,
  requestedAdminName: null,
  isActive: school.status === SchoolStatus.ACTIVE,
  templateKey: school.templateCode || null,
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
      expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000),
      schoolId: school.id,
    },
  });
};

const getInviteExpirationDate = () => new Date(Date.now() + 72 * 60 * 60 * 1000);

const getInviteFromSchool = async (school: School) => {
  const existingInvite = await prisma.schoolInvite.findFirst({
    where: { schoolId: school.id },
    orderBy: { createdAt: "desc" },
    include: { school: true },
  });

  if (existingInvite && existingInvite.status === InviteStatus.PENDING && existingInvite.expiresAt.getTime() >= Date.now()) {
    return existingInvite;
  }

  if (existingInvite && existingInvite.status === InviteStatus.PENDING) {
    await prisma.schoolInvite.update({
      where: { id: existingInvite.id },
      data: { status: InviteStatus.EXPIRED },
    });
  }

  const createdInvite = await prisma.schoolInvite.create({
    data: {
      token: crypto.randomUUID(),
      email: String(school.email || "").toLowerCase(),
      schoolName: school.name,
      plan: school.plan,
      status: InviteStatus.PENDING,
      expiresAt: getInviteExpirationDate(),
      schoolId: school.id,
    },
  });

  return prisma.schoolInvite.findUnique({
    where: { id: createdInvite.id },
    include: { school: true },
  });
};

const provisionApprovedSchool = async (school: School) => {
  const template = getSchoolTemplate(school.templateCode || "");
  const blueprint = buildProvisioningBlueprint(school, template);
  const subsystem = subsystemFromTemplate(template);
  const schoolType = schoolTypeFromTemplate(template);
  const educationType = educationTypeFromTemplate(template);
  const level = schoolLevelFromTemplate(template);
  const gradingSystem = gradeSystemFromTemplate(template);
  const locale = subsystem === SchoolSubsystem.ANGLOPHONE ? "en-US" : "fr-CM";

  return prisma.$transaction(async (tx) => {
    const activeSchool = await tx.school.update({
      where: { id: school.id },
      data: {
        status: SchoolStatus.ACTIVE,
        subsystem,
        type: schoolType,
        educationType,
        ownership: SchoolOwnership.PRIVATE_SECULAR,
      },
    });

    await tx.schoolSettings.upsert({
      where: { schoolId: school.id },
      create: {
        schoolId: school.id,
        timezone: "Africa/Douala",
        locale,
        currency: "XAF",
      },
      update: {
        timezone: "Africa/Douala",
        locale,
        currency: "XAF",
      },
    });

    await tx.schoolConfig.upsert({
      where: { schoolId: school.id },
      create: {
        schoolId: school.id,
        gradesPerTerm: template?.schoolConfig.standardSubjects.length || 3,
        termsPerYear: blueprint.periods.length,
        maxAbsences: 10,
        smsEnabled: false,
        offlineModeEnabled: true,
        aiAlertsEnabled: true,
        messageModeration: false,
      },
      update: {
        gradesPerTerm: template?.schoolConfig.standardSubjects.length || 3,
        termsPerYear: blueprint.periods.length,
        maxAbsences: 10,
        smsEnabled: false,
        offlineModeEnabled: true,
        aiAlertsEnabled: true,
        messageModeration: false,
      },
    });

    const existingAcademicYear = await tx.academicYear.findFirst({
      where: { schoolId: school.id },
      orderBy: { createdAt: "desc" },
    });

    const academicYear = existingAcademicYear ?? await tx.academicYear.create({
      data: {
        schoolId: school.id,
        name: blueprint.academicYearLabel,
        startDate: blueprint.startDate,
        endDate: blueprint.endDate,
        isCurrent: true,
        status: AcademicYearStatus.ACTIVE,
      },
    });

    const existingPeriods = await tx.academicPeriod.findMany({ where: { academicYearId: academicYear.id } });
    if (existingPeriods.length === 0) {
      for (const [index, period] of blueprint.periods.entries()) {
        const createdPeriod = await tx.academicPeriod.create({
          data: {
            academicYearId: academicYear.id,
            name: period.name,
            type: blueprint.periods.length > 1 ? PeriodType.TRIMESTER : PeriodType.TERM,
            orderIndex: period.orderIndex,
            startDate: period.startDate,
            endDate: period.endDate,
            isCurrent: index === 0,
          },
        });

        const sequenceBlueprints = [
          { name: "DS", type: SequenceType.DS },
          { name: "Class test", type: SequenceType.CLASS_TEST },
          { name: "Composition", type: SequenceType.COMPOSITION },
          { name: "Terminal exam", type: SequenceType.TERMINAL_EXAM },
        ];

        for (const [sequenceIndex, sequence] of sequenceBlueprints.entries()) {
          await tx.academicSequence.create({
            data: {
              academicPeriodId: createdPeriod.id,
              schoolId: school.id,
              name: `${sequence.name} - ${period.name}`,
              type: sequence.type,
              orderIndex: sequenceIndex + 1,
              startDate: period.startDate,
              endDate: period.endDate,
              isCurrent: index === 0 && sequenceIndex === 0,
            },
          });
        }
      }
    }

    const existingSections = await tx.section.findMany({ where: { schoolId: school.id } });
    const sections =
      existingSections.length > 0
        ? existingSections
        : await Promise.all(
            blueprint.sections.map((sectionBlueprint) =>
              tx.section.create({
                data: {
                  schoolId: school.id,
                  name: sectionBlueprint.name,
                  code: sectionBlueprint.code,
                  gradingSystem,
                  isActive: true,
                  passmark: 10,
                },
              })
            )
          );

    const existingClasses = await tx.class.findMany({ where: { schoolId: school.id } });
    if (existingClasses.length === 0) {
      for (const [index, section] of sections.entries()) {
        await tx.class.create({
          data: {
            schoolId: school.id,
            name: `${blueprint.classPrefix} ${index + 1}`,
            level: level,
            sectionId: section.id,
            capacity: 40,
          },
        });
      }
    }

    const existingGradeFormula = await tx.gradeFormula.findFirst({
      where: { schoolId: school.id, isDefault: true },
    });
    if (!existingGradeFormula) {
      await tx.gradeFormula.create({
        data: {
          schoolId: school.id,
          label: `Default ${template?.label || "school"} formula`,
          evaluations: {
            gradingSystem: template?.gradingSystem || "over_20",
            passingGrade: template?.passingGrade || 10,
            terms: blueprint.periods.map((period) => period.name),
          },
          isDefault: true,
        },
      });
    }

    const existingMentionRule = await tx.mentionRule.findFirst({
      where: { schoolId: school.id, isDefault: true },
    });
    if (!existingMentionRule) {
      await tx.mentionRule.create({
        data: {
          schoolId: school.id,
          rules: {
            template: template?.key || "fr_secondary",
            gradingSystem: template?.gradingSystem || "over_20",
            mentionThresholds: {
              excellent: 80,
              veryGood: 70,
              good: 60,
              fair: 50,
            },
          },
          isDefault: true,
        },
      });
    }

    return { school: activeSchool, academicYear, sections };
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
        subsystem: true,
        type: true,
      },
    });

    return res.json({
      schools: schools.map((school) => ({
        _id: school.id,
        schoolName: school.name,
        dbName: school.subdomain,
        systemType: subsystemToLegacySystemType(school.subsystem),
        structure: schoolTypeToLegacyStructure(school.type),
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
    const requestId = String(req.params.requestId || req.params.schoolId || "").trim();
    const school = await prisma.school.findUnique({ where: { id: requestId } });
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const provisioned = await provisionApprovedSchool(school);
    const updatedSchool = provisioned.school;
    const invite: any = await getInviteFromSchool(updatedSchool);

    if (invite.email || updatedSchool.email) {
      try {
        const loginUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${invite.token}`;
        await sendTransactionalEmail({
          recipientEmail: invite.email || updatedSchool.email || "",
          subject: `Bienvenue sur EDUNEXUS - ${updatedSchool.name}`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a"><p>Bonjour,</p><p>Votre établissement <b>${updatedSchool.name}</b> a été approuvé et configuré.</p><p>Vous pouvez finaliser la création de votre compte administrateur via ce lien temporaire :</p><p><a href="${loginUrl}">${loginUrl}</a></p><p>Subdomain: <b>${updatedSchool.subdomain}</b></p><p>Instructions: ouvrez le lien, renseignez le nom, l'email et le mot de passe de l'administrateur, puis conservez vos codes de secours.</p></div>`,
          text: `Bonjour,\n\nVotre établissement ${updatedSchool.name} a été approuvé et configuré.\n\nLien temporaire: ${loginUrl}\nSubdomain: ${updatedSchool.subdomain}\n\nOuvrez le lien, renseignez le nom, l'email et le mot de passe de l'administrateur, puis conservez vos codes de secours.`,
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
    const requestId = String(req.params.requestId || req.params.schoolId || "").trim();
    const school = await prisma.school.findUnique({ where: { id: requestId } });
    if (!school) {
      return res.status(404).json({ message: "School not found" });
    }

    const reason = String(req.body?.reason || req.body?.motif || "").trim();

    const updatedSchool = await prisma.school.update({
      where: { id: school.id },
      data: { status: SchoolStatus.REJECTED },
    });

    await prisma.schoolInvite.updateMany({
      where: { schoolId: school.id, status: InviteStatus.PENDING },
      data: { status: InviteStatus.EXPIRED },
    });

    if (school.email) {
      try {
        await sendTransactionalEmail({
          recipientEmail: school.email,
          subject: `Demande d'établissement refusée - ${school.name}`,
          html: `<p>Bonjour,<br><br>La demande d'onboarding pour l'établissement <b>${school.name}</b> a été refusée.${reason ? `<br><br>Motif: ${reason}` : ""}</p>`,
          text: `Bonjour,\n\nLa demande d'onboarding pour l'établissement ${school.name} a été refusée.${reason ? `\n\nMotif: ${reason}` : ""}`,
          template: "school_rejected",
          eventType: "school_invite",
          metadata: { schoolId: school.id, reason },
        });
      } catch (error) {
        console.error("Erreur lors de l'envoi de l'email de rejet à l'admin école:", error);
      }
    }

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
        subsystem: subsystemFromTemplate(template),
        type: schoolTypeFromTemplate(template),
        educationType: educationTypeFromTemplate(template),
        ownership: SchoolOwnership.PRIVATE_SECULAR,
        templateCode: template.key,
        plan: planFromInput(plan),
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
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      },
    });

    const activationUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/onboarding/join/${token}`;

    try {
      await logActivity({
        userId: String((req as any).masterUser?.id || (req as any).user?.userId || ""),
        action: "Created school onboarding request",
        details: `${schoolName} → ${normalizedEmail} (template: ${template.key})`,
      });
    } catch {
      // Non-blocking logging.
    }

    return res.status(201).json({
      message: "School onboarding request created.",
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
      emailSent: false,
      template,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const getSchoolOnboardingInvite = async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || "").trim();
    const invite = await prisma.schoolInvite.findUnique({
      where: { token },
      include: { school: true },
    }) as any;

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.status !== InviteStatus.PENDING) {
      return res.status(410).json({ message: "Invite already used or expired" });
    }

    const isExpired = invite.expiresAt.getTime() < Date.now();
    if (isExpired) {
      await prisma.schoolInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.EXPIRED },
      });
      return res.status(410).json({ message: "Invite expired" });
    }

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
        templateKey: invite.school?.templateCode || "fr_secondary",
        status: inviteStatusToLegacy(invite.status),
        expiresAt: invite.expiresAt,
        acceptedAt: null,
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

    const token = String(req.params.token || "").trim();
    const invite = await prisma.schoolInvite.findUnique({
      where: { token },
      include: { school: true },
    }) as any;

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.status !== InviteStatus.PENDING) {
      return res.status(409).json({ message: "Invite is not available" });
    }

    if (invite.expiresAt.getTime() < Date.now()) {
      await prisma.schoolInvite.update({
        where: { id: invite.id },
        data: { status: InviteStatus.EXPIRED },
      });
      return res.status(410).json({ message: "Invite expired" });
    }

    if (
      invite.school?.status !== SchoolStatus.ACTIVE &&
      invite.school?.status !== SchoolStatus.APPROVED &&
      invite.school?.status !== SchoolStatus.PENDING
    ) {
      return res.status(409).json({ message: "School is not available for onboarding" });
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
          subsystem: SchoolSubsystem.FRANCOPHONE,
          type: SchoolType.SECONDARY,
          educationType: EducationType.GENERAL,
          ownership: SchoolOwnership.PRIVATE_SECULAR,
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

    const result = await prisma.$transaction(async (tx) => {
      const inviteLock = await tx.schoolInvite.updateMany({
        where: {
          id: invite.id,
          status: InviteStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        data: { status: InviteStatus.USED },
      });

      if (inviteLock.count !== 1) {
        throw new Error("Invite is not available");
      }

      const createdAdmin = await tx.user.create({
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

      const updatedSchool = await tx.school.update({
        where: { id: school.id },
        data: {
          email: resolvedAdminEmail,
        },
      });

      const updatedInvite = await tx.schoolInvite.findUnique({ where: { id: invite.id } });

      return { createdAdmin, updatedSchool, updatedInvite };
    });

    return res.json({
      message: "School onboarding activated",
      school: toLegacySchool(result.updatedSchool),
      admin: {
        id: result.createdAdmin.id,
        email: result.createdAdmin.email,
        role: result.createdAdmin.role,
      },
      invite: {
        token: result.updatedInvite?.token || invite.token,
        status: inviteStatusToLegacy(result.updatedInvite?.status || InviteStatus.USED),
        acceptedAt: result.updatedInvite?.createdAt || invite.createdAt,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

export const activateSchool = acceptSchoolOnboardingInvite;
