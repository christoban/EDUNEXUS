import SchoolSettings from "../models/schoolSettings.ts";

export const DEFAULT_SCHOOL_SETTINGS = {
  schoolName: "EDUNEXUS Education",
  schoolMotto: "Excellence in Education & Innovation",
  schoolLogoUrl: "",
  academicCalendarType: "trimester" as "trimester" | "semester",
  preferredLanguage: "fr" as "fr" | "en",
  schoolLanguageMode: "francophone" as "anglophone" | "francophone" | "bilingual",
  mode: "simple_fr" as "simple_fr" | "simple_en" | "bilingual" | "complex",
  cycles: ["secondaire_1", "secondaire_2"] as Array<
    "maternelle" | "primaire" | "secondaire_1" | "secondaire_2" | "technique"
  >,
  hasMultipleCycles: true,
  officialLanguages: ["fr"],
  attendanceLateAsAbsence: true,
  attendanceExcusedCountsAsAbsence: false,
  councilDecisionMode: "automatic" as "manual" | "automatic",
  councilPassAverageThreshold: 50,
  councilMaxAbsences: 10,
  bulletinBlockOnUnpaidFees: false,
  bulletinAllowedOutstandingBalance: 0,
};

export const getEffectiveSchoolSettings = async () => {
  const settings = await SchoolSettings.findOne().lean();

  return {
    schoolName: settings?.schoolName || DEFAULT_SCHOOL_SETTINGS.schoolName,
    schoolMotto: settings?.schoolMotto || DEFAULT_SCHOOL_SETTINGS.schoolMotto,
    schoolLogoUrl: settings?.schoolLogoUrl || DEFAULT_SCHOOL_SETTINGS.schoolLogoUrl,
    academicCalendarType:
      settings?.academicCalendarType || DEFAULT_SCHOOL_SETTINGS.academicCalendarType,
    preferredLanguage:
      settings?.preferredLanguage || DEFAULT_SCHOOL_SETTINGS.preferredLanguage,
    schoolLanguageMode:
      settings?.schoolLanguageMode || DEFAULT_SCHOOL_SETTINGS.schoolLanguageMode,
    mode: settings?.mode || DEFAULT_SCHOOL_SETTINGS.mode,
    cycles: settings?.cycles || DEFAULT_SCHOOL_SETTINGS.cycles,
    hasMultipleCycles:
      typeof settings?.hasMultipleCycles === "boolean"
        ? settings.hasMultipleCycles
        : DEFAULT_SCHOOL_SETTINGS.hasMultipleCycles,
    officialLanguages:
      settings?.officialLanguages || DEFAULT_SCHOOL_SETTINGS.officialLanguages,
    attendanceLateAsAbsence:
      typeof settings?.attendanceLateAsAbsence === "boolean"
        ? settings.attendanceLateAsAbsence
        : DEFAULT_SCHOOL_SETTINGS.attendanceLateAsAbsence,
    attendanceExcusedCountsAsAbsence:
      typeof settings?.attendanceExcusedCountsAsAbsence === "boolean"
        ? settings.attendanceExcusedCountsAsAbsence
        : DEFAULT_SCHOOL_SETTINGS.attendanceExcusedCountsAsAbsence,
    councilDecisionMode:
      settings?.councilDecisionMode || DEFAULT_SCHOOL_SETTINGS.councilDecisionMode,
    councilPassAverageThreshold:
      typeof settings?.councilPassAverageThreshold === "number"
        ? settings.councilPassAverageThreshold
        : DEFAULT_SCHOOL_SETTINGS.councilPassAverageThreshold,
    councilMaxAbsences:
      typeof settings?.councilMaxAbsences === "number"
        ? settings.councilMaxAbsences
        : DEFAULT_SCHOOL_SETTINGS.councilMaxAbsences,
    bulletinBlockOnUnpaidFees:
      typeof settings?.bulletinBlockOnUnpaidFees === "boolean"
        ? settings.bulletinBlockOnUnpaidFees
        : DEFAULT_SCHOOL_SETTINGS.bulletinBlockOnUnpaidFees,
    bulletinAllowedOutstandingBalance:
      typeof settings?.bulletinAllowedOutstandingBalance === "number"
        ? settings.bulletinAllowedOutstandingBalance
        : DEFAULT_SCHOOL_SETTINGS.bulletinAllowedOutstandingBalance,
  };
};
