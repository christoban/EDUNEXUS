import { type Request, type Response } from "express";
import SchoolSettings from "../models/schoolSettings.ts";
import { DEFAULT_SCHOOL_SETTINGS, getEffectiveSchoolSettings } from "../utils/schoolSettings.ts";
import { logActivity } from "../utils/activitieslog.ts";

export const getSchoolSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await getEffectiveSchoolSettings();
    return res.json(settings);
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};

export const upsertSchoolSettings = async (req: Request, res: Response) => {
  try {
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

    const settings =
      (await SchoolSettings.findOne()) ||
      new SchoolSettings({
        schoolName: DEFAULT_SCHOOL_SETTINGS.schoolName,
        schoolMotto: DEFAULT_SCHOOL_SETTINGS.schoolMotto,
        schoolLogoUrl: DEFAULT_SCHOOL_SETTINGS.schoolLogoUrl,
        academicCalendarType: DEFAULT_SCHOOL_SETTINGS.academicCalendarType,
        preferredLanguage: DEFAULT_SCHOOL_SETTINGS.preferredLanguage,
        schoolLanguageMode: DEFAULT_SCHOOL_SETTINGS.schoolLanguageMode,
        mode: DEFAULT_SCHOOL_SETTINGS.mode,
        cycles: DEFAULT_SCHOOL_SETTINGS.cycles,
        hasMultipleCycles: DEFAULT_SCHOOL_SETTINGS.hasMultipleCycles,
        officialLanguages: DEFAULT_SCHOOL_SETTINGS.officialLanguages,
        attendanceLateAsAbsence: DEFAULT_SCHOOL_SETTINGS.attendanceLateAsAbsence,
        attendanceExcusedCountsAsAbsence: DEFAULT_SCHOOL_SETTINGS.attendanceExcusedCountsAsAbsence,
        councilDecisionMode: DEFAULT_SCHOOL_SETTINGS.councilDecisionMode,
        councilPassAverageThreshold: DEFAULT_SCHOOL_SETTINGS.councilPassAverageThreshold,
        councilMaxAbsences: DEFAULT_SCHOOL_SETTINGS.councilMaxAbsences,
        bulletinBlockOnUnpaidFees: DEFAULT_SCHOOL_SETTINGS.bulletinBlockOnUnpaidFees,
        bulletinAllowedOutstandingBalance: DEFAULT_SCHOOL_SETTINGS.bulletinAllowedOutstandingBalance,
      });

    settings.schoolName = schoolName;
    settings.schoolMotto = schoolMotto;
    settings.schoolLogoUrl = schoolLogoUrl;
    settings.academicCalendarType = academicCalendarType as "trimester" | "semester";
    settings.preferredLanguage = preferredLanguage as "fr" | "en";
    settings.schoolLanguageMode =
      schoolLanguageMode as "anglophone" | "francophone" | "bilingual";
    settings.mode = resolvedMode;
    settings.cycles = resolvedCycles;
    settings.hasMultipleCycles = hasMultipleCycles;
    settings.officialLanguages = officialLanguages;
    settings.attendanceLateAsAbsence = attendanceLateAsAbsence;
    settings.attendanceExcusedCountsAsAbsence = attendanceExcusedCountsAsAbsence;
    settings.councilDecisionMode = councilDecisionMode;
    settings.councilPassAverageThreshold = councilPassAverageThreshold;
    settings.councilMaxAbsences = councilMaxAbsences;
    settings.bulletinBlockOnUnpaidFees = bulletinBlockOnUnpaidFees;
    settings.bulletinAllowedOutstandingBalance = bulletinAllowedOutstandingBalance;

    await settings.save();

    const user = (req as any).user;
    if (user?._id) {
      await logActivity({
        userId: String(user._id),
        action: "Updated school settings",
        details: `calendar=${settings.academicCalendarType}, language=${settings.preferredLanguage}, mode=${settings.schoolLanguageMode}`,
      });
    }

    return res.json({
      schoolName: settings.schoolName,
      schoolMotto: settings.schoolMotto,
      schoolLogoUrl: settings.schoolLogoUrl || "",
      academicCalendarType: settings.academicCalendarType,
      preferredLanguage: settings.preferredLanguage,
      schoolLanguageMode: settings.schoolLanguageMode,
      mode: settings.mode,
      cycles: settings.cycles,
      hasMultipleCycles: settings.hasMultipleCycles,
      officialLanguages: settings.officialLanguages,
      attendanceLateAsAbsence: settings.attendanceLateAsAbsence,
      attendanceExcusedCountsAsAbsence: settings.attendanceExcusedCountsAsAbsence,
      councilDecisionMode: settings.councilDecisionMode,
      councilPassAverageThreshold: settings.councilPassAverageThreshold,
      councilMaxAbsences: settings.councilMaxAbsences,
      bulletinBlockOnUnpaidFees: settings.bulletinBlockOnUnpaidFees,
      bulletinAllowedOutstandingBalance: settings.bulletinAllowedOutstandingBalance,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};
