export type SectionCycle = "maternelle" | "primaire" | "secondaire_1" | "secondaire_2" | "technique";
export type SubSystemCode = "MATERNELLE" | "FR_PRIMAIRE" | "EN_PRIMAIRE" | "FR_SECONDARY" | "EN_SECONDARY";

export type BulletinTemplateType = "FR" | "EN" | "PRIMARY" | "KINDERGARTEN";

export const resolveBulletinTemplateType = (
  subSystemCode?: SubSystemCode,
  cycle?: SectionCycle,
  language?: "fr" | "en",
  bulletinTemplate?: string | null
): BulletinTemplateType => {
  const normalizedTemplate = String(bulletinTemplate || "").trim().toUpperCase();
  if (normalizedTemplate === "FR" || normalizedTemplate === "EN" || normalizedTemplate === "PRIMARY" || normalizedTemplate === "KINDERGARTEN") {
    return normalizedTemplate as BulletinTemplateType;
  }

  if (cycle === "maternelle" || subSystemCode === "MATERNELLE") return "KINDERGARTEN";
  if (cycle === "primaire" || subSystemCode === "FR_PRIMAIRE" || subSystemCode === "EN_PRIMAIRE") {
    return "PRIMARY";
  }
  if (language === "en" || String(subSystemCode || "").startsWith("EN_")) return "EN";
  return "FR";
};

export const getTemplateLabels = (template: BulletinTemplateType, language: "fr" | "en") => {
  const isFr = language === "fr";

  if (template === "EN") {
    return {
      title: "Report Card",
      detailTitle: "Subject Breakdown",
      classStats: "Class Statistics",
      rank: "Class Rank",
      average: "Average",
      absences: "Absences",
      late: "Late",
      signatures: "Signatures",
      teacherSignature: "Class Teacher",
      principalSignature: "Principal",
      note: "Summary based on available assessments.",
    };
  }

  if (template === "PRIMARY") {
    return {
      title: isFr ? "Bulletin Primaire" : "Primary Report Card",
      detailTitle: isFr ? "Résultats par matière" : "Subject Results",
      classStats: isFr ? "Statistiques de classe" : "Class Statistics",
      rank: isFr ? "Rang" : "Rank",
      average: isFr ? "Moyenne" : "Average",
      absences: isFr ? "Absences" : "Absences",
      late: isFr ? "Retards" : "Late",
      signatures: isFr ? "Signatures" : "Signatures",
      teacherSignature: isFr ? "Titulaire" : "Class Teacher",
      principalSignature: isFr ? "Direction" : "Principal",
      note: isFr
        ? "Synthèse basée sur les évaluations de la période."
        : "Summary based on period assessments.",
    };
  }

  if (template === "KINDERGARTEN") {
    return {
      title: isFr ? "Bulletin Maternelle" : "Kindergarten Report",
      detailTitle: isFr ? "Compétences observées" : "Observed Competencies",
      classStats: isFr ? "Repères de classe" : "Class Benchmarks",
      rank: isFr ? "Rang" : "Rank",
      average: isFr ? "Niveau global" : "Overall Level",
      absences: isFr ? "Absences" : "Absences",
      late: isFr ? "Retards" : "Late",
      signatures: isFr ? "Signatures" : "Signatures",
      teacherSignature: isFr ? "Éducateur(trice)" : "Teacher",
      principalSignature: isFr ? "Direction" : "Principal",
      note: isFr
        ? "Appréciation formative sur la période."
        : "Formative assessment over the period.",
    };
  }

  return {
    title: "Bulletin Scolaire",
    detailTitle: "Détail par matière",
    classStats: "Statistiques de classe",
    rank: "Rang",
    average: "Moyenne",
    absences: "Absences",
    late: "Retards",
    signatures: "Signatures",
    teacherSignature: "Enseignant principal",
    principalSignature: "Directeur",
    note: "Moyenne calculée à partir des notes disponibles.",
  };
};
