import SchoolSettings from "../models/schoolSettings.ts";

export const DEFAULT_SCHOOL_SETTINGS = {
  schoolName: "EDUNEXUS Education",
  schoolMotto: "Excellence in Education & Innovation",
  schoolLogoUrl: "",
  academicCalendarType: "trimester" as "trimester" | "semester",
  preferredLanguage: "fr" as "fr" | "en",
  schoolLanguageMode: "francophone" as "anglophone" | "francophone" | "bilingual",
  officialLanguages: ["fr"],
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
    officialLanguages:
      settings?.officialLanguages || DEFAULT_SCHOOL_SETTINGS.officialLanguages,
  };
};
