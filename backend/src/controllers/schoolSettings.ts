import { type Request, type Response } from "express";
import { prisma } from "../config/prisma.ts";
import { DEFAULT_SCHOOL_SETTINGS, getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { logActivity } from "../utils/activitieslog.ts";

export const getSchoolSettings = async (_req: Request, res: Response) => {
  try {
    const schoolId = (_req as any).user?.schoolId;
    const settings = await getEffectiveSchoolSettings(schoolId);
    return res.json(settings);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const upsertSchoolSettings = async (req: Request, res: Response) => {
  try {
    const schoolId = (req as any).user?.schoolId;
    if (!schoolId) {
      return res.status(403).json({ message: "Aucun établissement associé" });
    }

    const schoolName = String(req.body?.schoolName || "").trim();
    const schoolMotto = String(req.body?.schoolMotto || "").trim();
    const schoolLogoUrl = String(req.body?.schoolLogoUrl || "").trim();
    const academicCalendarType = String(req.body?.academicCalendarType || req.body?.calendarType || "trimester").trim();
    const preferredLanguage = String(req.body?.preferredLanguage || "fr").trim();
    const schoolLanguageMode = String(req.body?.schoolLanguageMode || req.body?.languageMode || "francophone").trim();
    const mode = String(req.body?.mode || "").trim();
    const cycles = Array.isArray(req.body?.cycles)
      ? req.body.cycles.filter((value: unknown) =>
          ["maternelle", "primaire", "secondaire_1", "secondaire_2", "technique"].includes(
            String(value)
          )
        )
      : [];
    const officialLanguages = Array.isArray(req.body?.officialLanguages)
      ? req.body.officialLanguages.filter((value: unknown) => value === "fr" || value === "en")
      : schoolLanguageMode === "anglophone"
        ? ["en"]
        : schoolLanguageMode === "bilingual"
          ? ["fr", "en"]
          : ["fr"];
    const attendanceLateAsAbsence =
      typeof req.body?.attendanceLateAsAbsence === "boolean"
        ? req.body.attendanceLateAsAbsence
        : DEFAULT_SCHOOL_SETTINGS.attendanceLateAsAbsence;
    const attendanceExcusedCountsAsAbsence =
      typeof req.body?.attendanceExcusedCountsAsAbsence === "boolean"
        ? req.body.attendanceExcusedCountsAsAbsence
        : DEFAULT_SCHOOL_SETTINGS.attendanceExcusedCountsAsAbsence;
    const councilDecisionMode =
      req.body?.councilDecisionMode === "manual" || req.body?.councilDecisionMode === "automatic"
        ? req.body.councilDecisionMode
        : DEFAULT_SCHOOL_SETTINGS.councilDecisionMode;
    const councilPassAverageThreshold = Number.isFinite(Number(req.body?.councilPassAverageThreshold))
      ? Math.min(Math.max(Number(req.body.councilPassAverageThreshold), 0), 100)
      : DEFAULT_SCHOOL_SETTINGS.councilPassAverageThreshold;
    const councilMaxAbsences = Number.isFinite(Number(req.body?.councilMaxAbsences))
      ? Math.max(Number(req.body.councilMaxAbsences), 0)
      : DEFAULT_SCHOOL_SETTINGS.councilMaxAbsences;
    const bulletinBlockOnUnpaidFees =
      typeof req.body?.bulletinBlockOnUnpaidFees === "boolean"
        ? req.body.bulletinBlockOnUnpaidFees
        : DEFAULT_SCHOOL_SETTINGS.bulletinBlockOnUnpaidFees;
    const bulletinAllowedOutstandingBalance = Number.isFinite(
      Number(req.body?.bulletinAllowedOutstandingBalance)
    )
      ? Math.max(Number(req.body.bulletinAllowedOutstandingBalance), 0)
      : DEFAULT_SCHOOL_SETTINGS.bulletinAllowedOutstandingBalance;

    if (!schoolName) {
      return res.status(400).json({ message: "schoolName is required" });
    }

    if (!schoolMotto) {
      return res.status(400).json({ message: "schoolMotto is required" });
    }

    if (!["trimester", "semester"].includes(academicCalendarType)) {
      return res.status(400).json({ message: "academicCalendarType must be 'trimester' or 'semester'" });
    }

    if (!["fr", "en"].includes(preferredLanguage)) {
      return res.status(400).json({ message: "preferredLanguage must be 'fr' or 'en'" });
    }

    if (!["anglophone", "francophone", "bilingual"].includes(schoolLanguageMode)) {
      return res.status(400).json({
        message: "schoolLanguageMode must be 'anglophone', 'francophone' or 'bilingual'",
      });
    }

    const resolvedMode =
      mode && ["simple_fr", "simple_en", "bilingual", "complex"].includes(mode)
        ? (mode as "simple_fr" | "simple_en" | "bilingual" | "complex")
        : schoolLanguageMode === "anglophone"
          ? "simple_en"
          : schoolLanguageMode === "bilingual"
            ? "bilingual"
            : "simple_fr";

    const resolvedCycles = cycles.length
      ? (cycles as Array<"maternelle" | "primaire" | "secondaire_1" | "secondaire_2" | "technique">)
      : DEFAULT_SCHOOL_SETTINGS.cycles;

    const hasMultipleCycles =
      typeof req.body?.hasMultipleCycles === "boolean"
        ? req.body.hasMultipleCycles
        : resolvedCycles.length > 1;

    const settings = await prisma.schoolSettings.upsert({
      where: { schoolId },
      create: {
        schoolId,
        timezone: req.body?.timezone || "Africa/Douala",
        locale: preferredLanguage === "en" ? "en-US" : "fr-CM",
        currency: req.body?.currency || "XAF",
      },
      update: {
        timezone: req.body?.timezone || undefined,
        locale: preferredLanguage === "en" ? "en-US" : "fr-CM",
        currency: req.body?.currency || undefined,
      },
    });

    await prisma.schoolConfig.upsert({
      where: { schoolId },
      create: {
        schoolId,
        gradesPerTerm: 3,
        termsPerYear: 3,
        passMark: Number(req.body?.passMark ?? 10),
        maxAbsences: councilMaxAbsences,
        smsEnabled: Boolean(req.body?.smsEnabled ?? false),
        offlineModeEnabled: Boolean(req.body?.offlineModeEnabled ?? true),
        aiAlertsEnabled: Boolean(req.body?.aiAlertsEnabled ?? true),
        messageModeration: Boolean(req.body?.messageModeration ?? false),
      },
      update: {
        passMark: Number(req.body?.passMark ?? 10),
        maxAbsences: councilMaxAbsences,
        smsEnabled: Boolean(req.body?.smsEnabled ?? false),
        offlineModeEnabled: Boolean(req.body?.offlineModeEnabled ?? true),
        aiAlertsEnabled: Boolean(req.body?.aiAlertsEnabled ?? true),
        messageModeration: Boolean(req.body?.messageModeration ?? false),
      },
    });

    const user = (req as any).user;
    if (user?.userId) {
      await logActivity({
        userId: String(user.userId),
        schoolId,
        action: "Updated school settings",
        details: `locale=${settings.locale}, currency=${settings.currency}`,
      });
    }

    return res.json({
      schoolName,
      schoolMotto,
      schoolLogoUrl,
      academicCalendarType,
      preferredLanguage,
      schoolLanguageMode,
      mode: resolvedMode,
      cycles: resolvedCycles,
      hasMultipleCycles,
      officialLanguages,
      attendanceLateAsAbsence,
      attendanceExcusedCountsAsAbsence,
      councilDecisionMode,
      councilPassAverageThreshold,
      councilMaxAbsences,
      bulletinBlockOnUnpaidFees,
      bulletinAllowedOutstandingBalance,
      timezone: settings.timezone,
      locale: settings.locale,
      currency: settings.currency,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};
