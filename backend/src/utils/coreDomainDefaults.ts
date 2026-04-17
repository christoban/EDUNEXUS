import SubSystem from "../models/subSystem.ts";
import type { SectionCycle, SectionLanguage } from "../models/section.ts";

export const DEFAULT_SUBSYSTEMS = [
  {
    code: "FR_GENERAL_SEC",
    name: "Francophone General Secondary",
    gradingScale: "OVER_20",
    periodType: "SEQUENCES_6",
    hasCoefficientBySubject: true,
    passThreshold: 10,
  },
  {
    code: "FR_PRIMAIRE",
    name: "Francophone Primary",
    gradingScale: "COMPETENCY_ANA",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 10,
  },
  {
    code: "FR_TECHNIQUE_SEC",
    name: "Francophone Technical Secondary",
    gradingScale: "OVER_20",
    periodType: "SEQUENCES_6",
    hasCoefficientBySubject: true,
    passThreshold: 10,
  },
  {
    code: "EN_GENERAL_SEC",
    name: "Anglophone General Secondary",
    gradingScale: "PERCENT",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 40,
  },
  {
    code: "EN_PRIMAIRE",
    name: "Anglophone Primary",
    gradingScale: "PERCENT",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 40,
  },
  {
    code: "EN_TECHNIQUE_SEC",
    name: "Anglophone Technical Secondary",
    gradingScale: "PERCENT",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 40,
  },
  {
    code: "MATERNELLE",
    name: "Nursery",
    gradingScale: "COMPETENCY_ANA",
    periodType: "TERMS_3",
    hasCoefficientBySubject: false,
    passThreshold: 10,
  },
] as const;

export const ensureDefaultSubSystems = async () => {
  for (const subSystem of DEFAULT_SUBSYSTEMS) {
    await SubSystem.findOneAndUpdate(
      { code: subSystem.code },
      { ...subSystem, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
};

export const resolveDefaultSubsystemCodeForSection = (
  cycle?: SectionCycle | null,
  language?: SectionLanguage | null
) => {
  if (cycle === "maternelle") return "MATERNELLE";
  if (cycle === "primaire") return language === "en" ? "EN_PRIMAIRE" : "FR_PRIMAIRE";
  if (cycle === "technique") return language === "en" ? "EN_TECHNIQUE_SEC" : "FR_TECHNIQUE_SEC";
  return language === "en" ? "EN_GENERAL_SEC" : "FR_GENERAL_SEC";
};