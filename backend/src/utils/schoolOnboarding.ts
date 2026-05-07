export type SchoolOnboardingStatus = "pending" | "approved" | "active" | "rejected";
export type SchoolStructure = "simple" | "complex" | "multi";
export type SchoolSystemType = "francophone" | "anglophone" | "bilingual";

export type SchoolTemplateKey =
  | "fr_primary"
  | "fr_secondary"
  | "en_primary"
  | "bilingual_complex"
  | "technical_school";

export type SchoolTemplate = {
  key: SchoolTemplateKey;
  label: string;
  description: string;
  systemType: SchoolSystemType;
  structure: SchoolStructure;
  schoolMotto: string;
  gradingSystem: "over_20" | "percent" | "grades_ae" | "competency_ana";
  passingGrade: number;
  termsType: "sequences_6" | "terms_3" | "monthly_9" | "trimesters_3";
  bulletinFormat: "standard" | "detailed" | "compact";
  includeRankings: boolean;
  onboardingStatus: SchoolOnboardingStatus;
  schoolConfig: {
    gradingSystem: "over_20" | "percent" | "grades_ae" | "competency_ana";
    passingGrade: number;
    termsType: "sequences_6" | "terms_3" | "monthly_9" | "trimesters_3";
    termsNames: string[];
    standardSubjects: Array<{ name: string; code: string; coefficient: number }>;
    bulletinFormat: "standard" | "detailed" | "compact";
    includeRankings: boolean;
    metadata: Record<string, unknown>;
  };
};

export const SCHOOL_ONBOARDING_TEMPLATES: SchoolTemplate[] = [
  {
    key: "fr_primary",
    label: "Primaire francophone",
    description: "École primaire simple, pensée pour les cycles francophones de base.",
    systemType: "francophone",
    structure: "simple",
    schoolMotto: "Apprendre, grandir, réussir",
    gradingSystem: "over_20",
    passingGrade: 10,
    termsType: "trimesters_3",
    bulletinFormat: "standard",
    includeRankings: true,
    onboardingStatus: "pending",
    schoolConfig: {
      gradingSystem: "over_20",
      passingGrade: 10,
      termsType: "trimesters_3",
      termsNames: ["Trimestre 1", "Trimestre 2", "Trimestre 3"],
      standardSubjects: [
        { name: "Mathématiques", code: "MATH", coefficient: 4 },
        { name: "Français", code: "FR", coefficient: 4 },
        { name: "Sciences", code: "SCI", coefficient: 3 },
      ],
      bulletinFormat: "standard",
      includeRankings: true,
      metadata: { focus: "primary_fr" },
    },
  },
  {
    key: "fr_secondary",
    label: "Secondaire francophone",
    description: "Parcours secondaire avec bulletins et périodes trimestrielles.",
    systemType: "francophone",
    structure: "simple",
    schoolMotto: "Excellence et discipline",
    gradingSystem: "over_20",
    passingGrade: 10,
    termsType: "trimesters_3",
    bulletinFormat: "detailed",
    includeRankings: true,
    onboardingStatus: "pending",
    schoolConfig: {
      gradingSystem: "over_20",
      passingGrade: 10,
      termsType: "trimesters_3",
      termsNames: ["Trimestre 1", "Trimestre 2", "Trimestre 3"],
      standardSubjects: [
        { name: "Mathématiques", code: "MATH", coefficient: 5 },
        { name: "Français", code: "FR", coefficient: 4 },
        { name: "Physique", code: "PHY", coefficient: 4 },
      ],
      bulletinFormat: "detailed",
      includeRankings: true,
      metadata: { focus: "secondary_fr" },
    },
  },
  {
    key: "en_primary",
    label: "Primary English",
    description: "English-speaking primary school with a light configuration.",
    systemType: "anglophone",
    structure: "simple",
    schoolMotto: "Learn with confidence",
    gradingSystem: "percent",
    passingGrade: 50,
    termsType: "terms_3",
    bulletinFormat: "standard",
    includeRankings: true,
    onboardingStatus: "pending",
    schoolConfig: {
      gradingSystem: "percent",
      passingGrade: 50,
      termsType: "terms_3",
      termsNames: ["Term 1", "Term 2", "Term 3"],
      standardSubjects: [
        { name: "Mathematics", code: "MATH", coefficient: 4 },
        { name: "English", code: "ENG", coefficient: 4 },
        { name: "Science", code: "SCI", coefficient: 3 },
      ],
      bulletinFormat: "standard",
      includeRankings: true,
      metadata: { focus: "primary_en" },
    },
  },
  {
    key: "bilingual_complex",
    label: "Bilingual Complex",
    description: "Multi-campus school with bilingual operating mode.",
    systemType: "bilingual",
    structure: "complex",
    schoolMotto: "Two languages, one standard",
    gradingSystem: "over_20",
    passingGrade: 10,
    termsType: "trimesters_3",
    bulletinFormat: "detailed",
    includeRankings: true,
    onboardingStatus: "pending",
    schoolConfig: {
      gradingSystem: "over_20",
      passingGrade: 10,
      termsType: "trimesters_3",
      termsNames: ["Trimestre 1", "Trimestre 2", "Trimestre 3"],
      standardSubjects: [
        { name: "Mathématiques", code: "MATH", coefficient: 4 },
        { name: "French", code: "FR", coefficient: 4 },
        { name: "English", code: "ENG", coefficient: 4 },
      ],
      bulletinFormat: "detailed",
      includeRankings: true,
      metadata: { focus: "bilingual_complex" },
    },
  },
  {
    key: "technical_school",
    label: "Technological School",
    description: "Technical / science-oriented institution with competency tracking.",
    systemType: "francophone",
    structure: "complex",
    schoolMotto: "Techniques, innovation, avenir",
    gradingSystem: "competency_ana",
    passingGrade: 60,
    termsType: "terms_3",
    bulletinFormat: "compact",
    includeRankings: false,
    onboardingStatus: "pending",
    schoolConfig: {
      gradingSystem: "competency_ana",
      passingGrade: 60,
      termsType: "terms_3",
      termsNames: ["Term 1", "Term 2", "Term 3"],
      standardSubjects: [
        { name: "Technology", code: "TECH", coefficient: 5 },
        { name: "Mathematics", code: "MATH", coefficient: 4 },
        { name: "Physics", code: "PHY", coefficient: 4 },
      ],
      bulletinFormat: "compact",
      includeRankings: false,
      metadata: { focus: "technical" },
    },
  },
];

export const buildSchoolDbName = (schoolName: string) => {
  const slug = schoolName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug ? `edunexus_${slug}` : "edunexus_school";
};

export const buildSchoolConnectionString = (baseUrl: string, dbName: string) => {
  try {
    const normalizedBaseUrl = baseUrl.startsWith("mongodb://") || baseUrl.startsWith("mongodb+srv://")
      ? baseUrl
      : `mongodb://localhost:27017/${baseUrl}`;

    const url = new URL(normalizedBaseUrl);
    url.pathname = `/${dbName}`;
    return url.toString();
  } catch {
    return `mongodb://localhost:27017/${dbName}`;
  }
};

export const getSchoolTemplate = (templateKey: string) =>
  SCHOOL_ONBOARDING_TEMPLATES.find((template) => template.key === templateKey);