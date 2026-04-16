/**
 * Language helper utilities for multilingual bulletin generation
 * Handles bulletin language selection based on viewer role and preferences
 */

export type UserRole = "student" | "parent" | "teacher" | "admin" | "staff";
export type Language = "fr" | "en";
export type SchoolLanguageMode = "anglophone" | "francophone" | "bilingual";
export type SchoolSection = "anglophone" | "francophone" | "bilingual";

/**
 * Determine which language to use for bulletin generation
 * @param viewerRole - Role of the person viewing the bulletin
 * @param parentPreference - Parent's language preference (if role is parent)
 * @param schoolLanguageMode - Official language mode of the school
 * @returns Language code ("fr" or "en")
 */
export function getBulletinLanguage(
  viewerRole: UserRole,
  parentPreference: string | undefined,
  schoolLanguageMode: SchoolLanguageMode
): Language {
  // Student always sees bulletin in school's official language
  if (viewerRole === "student") {
    // Determine school's primary official language
    if (schoolLanguageMode === "anglophone") {
      return "en";
    }
    return "fr"; // francophone and bilingual default to FR for student official bulletin
  }

  // Parent sees bulletin in their personal language preference
  if (viewerRole === "parent") {
    return (parentPreference as Language) || "fr";
  }

  // Teachers/admin/staff see school's official language
  if (schoolLanguageMode === "anglophone") {
    return "en";
  }
  return "fr";
}

const getSchoolDefaultLanguage = (schoolLanguageMode: SchoolLanguageMode): Language => {
  if (schoolLanguageMode === "anglophone") return "en";
  return "fr";
};

const getLanguageFromSection = (
  section: SchoolSection | undefined,
  schoolLanguageMode: SchoolLanguageMode
): Language | null => {
  if (!section) return null;
  if (section === "anglophone") return "en";
  if (section === "francophone") return "fr";

  // "bilingual" section means no fixed language at section level.
  if (schoolLanguageMode === "anglophone") return "en";
  if (schoolLanguageMode === "francophone") return "fr";
  return null;
};

/**
 * Resolve user language with bilingual-school rules:
 * - Parent: always parent preference when present.
 * - Student: language follows their section in bilingual school.
 * - Teacher: section-based unless teacher section is bilingual, then UI preference.
 * - Admin/staff: user UI preference first.
 */
export const resolveUserLanguage = (params: {
  role: UserRole;
  schoolLanguageMode: SchoolLanguageMode;
  schoolSection?: SchoolSection;
  parentLanguagePreference?: string;
  uiLanguagePreference?: string;
  schoolPreferredLanguage?: string;
}): Language => {
  const {
    role,
    schoolLanguageMode,
    schoolSection,
    parentLanguagePreference,
    uiLanguagePreference,
    schoolPreferredLanguage,
  } = params;

  const schoolDefault =
    schoolLanguageMode === "bilingual"
      ? ((schoolPreferredLanguage as Language | undefined) || "fr")
      : getSchoolDefaultLanguage(schoolLanguageMode);

  if (role === "parent") {
    return (parentLanguagePreference as Language | undefined) || schoolDefault;
  }

  if (role === "student") {
    if (schoolLanguageMode === "bilingual") {
      return getLanguageFromSection(schoolSection, schoolLanguageMode) || schoolDefault;
    }
    return getSchoolDefaultLanguage(schoolLanguageMode);
  }

  if (role === "teacher") {
    if (schoolLanguageMode === "bilingual") {
      if (schoolSection === "bilingual") {
        return (uiLanguagePreference as Language | undefined) || schoolDefault;
      }
      return getLanguageFromSection(schoolSection, schoolLanguageMode) || schoolDefault;
    }
    return getSchoolDefaultLanguage(schoolLanguageMode);
  }

  if (role === "admin" || role === "staff") {
    if (schoolLanguageMode === "bilingual") {
      return (uiLanguagePreference as Language | undefined) || schoolDefault;
    }
    return getSchoolDefaultLanguage(schoolLanguageMode);
  }

  return schoolDefault;
};

/**
 * Get legal notice footer for translated bulletins
 * @param isOfficial - Whether this is the official (not translated) bulletin
 * @param language - Language of the notice
 * @returns Legal notice text, or empty string if official
 */
export function getLegalNotice(isOfficial: boolean, language: Language): string {
  if (isOfficial) {
    return ""; // Official bulletins have no notice
  }

  if (language === "en") {
    return "Translated version for informational purposes\nTranslation of the official report card";
  }

  return "Version traduite à titre informatif\nTraduction du bulletin officiel";
}

/**
 * Determine if this bulletin is official or a translation
 * @param viewerRole - Role of the person viewing
 * @returns true if official, false if translated
 */
export function isOfficialBulletin(viewerRole: UserRole): boolean {
  return viewerRole === "student";
}
