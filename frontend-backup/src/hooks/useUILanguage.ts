import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/AuthProvider";
import type { AcademicCalendarType } from "@/lib/i18n";
import type { SchoolSection, UserRole } from "@/types";

export type UILanguage = "fr" | "en";

type SchoolSettings = {
  preferredLanguage?: UILanguage;
  schoolLanguageMode?: "anglophone" | "francophone" | "bilingual";
  academicCalendarType?: AcademicCalendarType;
};

type UISchoolContext = {
  language: UILanguage;
  academicCalendarType: AcademicCalendarType;
};

const getSchoolDefaultLanguage = (
  settings?: SchoolSettings,
  fallback: UILanguage = "fr"
): UILanguage => {
  if (settings?.schoolLanguageMode === "anglophone") return "en";
  if (settings?.schoolLanguageMode === "francophone") return "fr";
  if (settings?.preferredLanguage) return settings.preferredLanguage;
  return fallback;
};

const getSectionLanguage = (
  section: SchoolSection | undefined,
  settings?: SchoolSettings
): UILanguage | null => {
  if (section === "anglophone") return "en";
  if (section === "francophone") return "fr";
  if (section === "bilingual") return null;

  if (settings?.schoolLanguageMode === "anglophone") return "en";
  if (settings?.schoolLanguageMode === "francophone") return "fr";
  return null;
};

const resolveUserLanguage = (params: {
  role?: UserRole;
  parentLanguagePreference?: UILanguage;
  uiLanguagePreference?: UILanguage;
  schoolSection?: SchoolSection;
  settings?: SchoolSettings;
}): UILanguage => {
  const { role, parentLanguagePreference, uiLanguagePreference, schoolSection, settings } = params;
  const schoolDefault = getSchoolDefaultLanguage(settings, settings?.preferredLanguage || "fr");

  if (!role) return schoolDefault;

  if (role === "parent") {
    return parentLanguagePreference || schoolDefault;
  }

  if (role === "student") {
    if (settings?.schoolLanguageMode === "bilingual") {
      return getSectionLanguage(schoolSection, settings) || schoolDefault;
    }
    return schoolDefault;
  }

  if (role === "teacher") {
    if (settings?.schoolLanguageMode === "bilingual") {
      if (schoolSection === "bilingual") {
        return uiLanguagePreference || schoolDefault;
      }
      return getSectionLanguage(schoolSection, settings) || schoolDefault;
    }
    return schoolDefault;
  }

  if (role === "admin") {
    if (settings?.schoolLanguageMode === "bilingual") {
      return uiLanguagePreference || schoolDefault;
    }
    return schoolDefault;
  }

  return schoolDefault;
};

export const useUILanguage = () => {
  const { language } = useUISchoolContext();
  return language;
};

export const useUISchoolContext = (): UISchoolContext => {
  const { user } = useAuth();
  const [context, setContext] = useState<UISchoolContext>({
    language: "fr",
    academicCalendarType: "trimester",
  });

  useEffect(() => {
    let mounted = true;

    const resolveLanguage = async () => {
      try {
        const { data } = await api.get<SchoolSettings>("/school-settings");
        if (!mounted) return;

        const academicCalendarType = data.academicCalendarType || "trimester";

        setContext({
          language: resolveUserLanguage({
            role: user?.role,
            parentLanguagePreference: user?.parentLanguagePreference,
            uiLanguagePreference: user?.uiLanguagePreference,
            schoolSection: user?.schoolSection,
            settings: data,
          }),
          academicCalendarType,
        });
      } catch {
        if (!mounted) return;

        setContext({
          language: resolveUserLanguage({
            role: user?.role,
            parentLanguagePreference: user?.parentLanguagePreference,
            uiLanguagePreference: user?.uiLanguagePreference,
            schoolSection: user?.schoolSection,
          }),
          academicCalendarType: "trimester",
        });
      }
    };

    resolveLanguage();

    const onParentLangChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ language?: UILanguage }>;
      const nextLanguage = customEvent.detail?.language;
      if (nextLanguage === "fr" || nextLanguage === "en") {
        setContext((previous) => ({ ...previous, language: nextLanguage }));
      }
    };

    const onSchoolSettingsChange = () => {
      resolveLanguage();
    };

    window.addEventListener("parent-language-changed", onParentLangChange);
    window.addEventListener("school-settings-updated", onSchoolSettingsChange);

    return () => {
      mounted = false;
      window.removeEventListener("parent-language-changed", onParentLangChange);
      window.removeEventListener("school-settings-updated", onSchoolSettingsChange);
    };
  }, [user?.role, user?.parentLanguagePreference, user?.schoolSection, user?.uiLanguagePreference]);

  return context;
};
