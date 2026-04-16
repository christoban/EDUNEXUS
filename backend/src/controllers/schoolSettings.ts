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
    const academicCalendarType = String(req.body?.academicCalendarType || "trimester").trim();
    const preferredLanguage = String(req.body?.preferredLanguage || "fr").trim();
    const schoolLanguageMode = String(req.body?.schoolLanguageMode || "francophone").trim();
    const officialLanguages = Array.isArray(req.body?.officialLanguages)
      ? req.body.officialLanguages.filter((value: unknown) => value === "fr" || value === "en")
      : schoolLanguageMode === "anglophone"
        ? ["en"]
        : schoolLanguageMode === "bilingual"
          ? ["fr", "en"]
          : ["fr"];

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

    const settings =
      (await SchoolSettings.findOne()) ||
      new SchoolSettings({
        schoolName: DEFAULT_SCHOOL_SETTINGS.schoolName,
        schoolMotto: DEFAULT_SCHOOL_SETTINGS.schoolMotto,
        schoolLogoUrl: DEFAULT_SCHOOL_SETTINGS.schoolLogoUrl,
        academicCalendarType: DEFAULT_SCHOOL_SETTINGS.academicCalendarType,
        preferredLanguage: DEFAULT_SCHOOL_SETTINGS.preferredLanguage,
        schoolLanguageMode: DEFAULT_SCHOOL_SETTINGS.schoolLanguageMode,
        officialLanguages: DEFAULT_SCHOOL_SETTINGS.officialLanguages,
      });

    settings.schoolName = schoolName;
    settings.schoolMotto = schoolMotto;
    settings.schoolLogoUrl = schoolLogoUrl;
    settings.academicCalendarType = academicCalendarType as "trimester" | "semester";
    settings.preferredLanguage = preferredLanguage as "fr" | "en";
    settings.schoolLanguageMode =
      schoolLanguageMode as "anglophone" | "francophone" | "bilingual";
    settings.officialLanguages = officialLanguages;

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
      officialLanguages: settings.officialLanguages,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message || "Server Error" });
  }
};
