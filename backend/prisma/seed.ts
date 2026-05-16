import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── BAC COEFFICIENTS ────────────────────────────────────────────────────────
// Source : Décret 95-035 du 24 février 1995 + Arrêté 227/18/MINESEC
//
// serieA4 / serieC / serieD / serieTI → Float NON NULLABLE — données décret confirmées
// serieABI (A4 Bilingue, code OBC: BAABI) → Float? nullable — à confirmer OBC
// serieE (arrêté mars 2022) → Float? nullable — à confirmer OBC
// Sous-séries A1-A5, SH, AC → Float? nullable — à confirmer terrain
//
// "Intensive English" : matière exclusive à la série ABI
//   serieA4/C/D/TI = 0 (non évaluée, pas null car champ non nullable)

const bacCoefficients = [
  {
    subjectName: "Mathématiques",
    serieA4: 3, serieC: 6, serieD: 4, serieTI: 5,
    serieABI: null, serieE: null,
    serieA1: null, serieA2: null, serieA3: null, serieA5: null, serieSH: null, serieAC: null,
  },
  {
    subjectName: "Français",
    serieA4: 6, serieC: 4, serieD: 4, serieTI: 3,
    serieABI: null, serieE: null,
    serieA1: null, serieA2: null, serieA3: null, serieA5: null, serieSH: null, serieAC: null,
  },
  {
    subjectName: "Physique-Chimie",
    serieA4: 2, serieC: 5, serieD: 3, serieTI: 4,
    serieABI: null, serieE: null,
    serieA1: null, serieA2: null, serieA3: null, serieA5: null, serieSH: null, serieAC: null,
  },
  {
    subjectName: "SVT / Biologie",
    serieA4: 2, serieC: 2, serieD: 4, serieTI: 2,
    serieABI: null, serieE: null,
    serieA1: null, serieA2: null, serieA3: null, serieA5: null, serieSH: null, serieAC: null,
  },
  {
    subjectName: "Philosophie",
    serieA4: 5, serieC: 3, serieD: 3, serieTI: 2,
    serieABI: null, serieE: null,
    serieA1: null, serieA2: null, serieA3: null, serieA5: null, serieSH: null, serieAC: null,
  },
  {
    subjectName: "Histoire-Géographie",
    serieA4: 4, serieC: 2, serieD: 2, serieTI: 2,
    serieABI: null, serieE: null,
    serieA1: null, serieA2: null, serieA3: null, serieA5: null, serieSH: null, serieAC: null,
  },
  {
    subjectName: "Anglais",
    serieA4: 3, serieC: 2, serieD: 2, serieTI: 2,
    serieABI: null, serieE: null,
    serieA1: null, serieA2: null, serieA3: null, serieA5: null, serieSH: null, serieAC: null,
  },
  {
    subjectName: "Intensive English",
    // Matière exclusive à la série ABI
    // serieA4/C/D/TI = 0 car non évaluée dans ces séries (champ Float non nullable)
    // serieABI = 5 confirmé terrain : Lycée Bilingue Garoua, 2nde ABI, bulletin T2 2020/2021
    serieA4: 0, serieC: 0, serieD: 0, serieTI: 0,
    serieABI: 5,  // ← confirmé terrain
    serieE: null,
    serieA1: null, serieA2: null, serieA3: null, serieA5: null, serieSH: null, serieAC: null,
  },
];

// ─── LES 17 VRAIS TEMPLATES D'ÉTABLISSEMENTS CAMEROUNAIS ────────────────────
//
// Répartition :
//   Francophone   : LYCEE_FR, CES_FR, PRIVE_FR, LYCEE_TECHNIQUE_FR, CETIC,
//                   SAR_SM, CFM, PRIMAIRE_FR, MATERNELLE_FR  (9 templates)
//   Anglophone    : GHS_EN, GSS_EN, PRIVE_EN, PRIMARY_EN, NURSERY_EN         (5 templates)
//   Bilingue      : LYCEE_BILINGUE, PRIMARY_BILINGUAL                         (2 templates)
//   Multi-niveaux : COMPLEXE_SCOLAIRE                                         (1 template)
//   TOTAL         : 17 templates
//
// NOTE : LYCEE_BILINGUE_FR a été supprimé — c'était une erreur conceptuelle.
//   Un lycée est soit francophone, soit bilingue. "Bilingue francophone" est
//   une contradiction dans les termes. La série ABI existe dans LYCEE_BILINGUE.

const schoolTemplates = [

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTÈME FRANCOPHONE (9 templates)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 1. Lycée général francophone ───────────────────────────────────────────
  // Établissements publics : Lycée de Yaoundé, Lycée de Douala, etc.
  // 1er cycle (6e-3e) + 2nd cycle (2nde-Tle), séries A4/C/D/TI
  // Pas de série TI en 2nde (démarre en 1ère)
  {
    code: "LYCEE_FR",
    name: "Lycée général francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        // 1er cycle — pas de série
        { level: "6e",   serie: null, filiere: null },
        { level: "5e",   serie: null, filiere: null },
        { level: "4e",   serie: null, filiere: null },
        { level: "3e",   serie: null, filiere: null },
        // 2nd cycle — séries A4, C, D (TI interdit en 2nde)
        { level: "2nde", serie: "A4", filiere: null },
        { level: "2nde", serie: "C",  filiere: null },
        { level: "2nde", serie: "D",  filiere: null },
        // 1ère — TI démarre ici
        { level: "1ere", serie: "A4", filiere: null },
        { level: "1ere", serie: "C",  filiere: null },
        { level: "1ere", serie: "D",  filiere: null },
        { level: "1ere", serie: "TI", filiere: null },
        // Terminale
        { level: "Tle",  serie: "A4", filiere: null },
        { level: "Tle",  serie: "C",  filiere: null },
        { level: "Tle",  serie: "D",  filiere: null },
        { level: "Tle",  serie: "TI", filiere: null },
      ],
      officialExams: ["BEPC", "PROBATOIRE", "BAC"],
      bacSeriesAvailable: ["A4", "C", "D", "TI"],
      probatoire: "1ere",
      bacCoefficientsApplyAt: "Tle",
      roleTitles: {
        ADMIN:            "Proviseur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 2. CES — Collège d'Enseignement Secondaire francophone ─────────────────
  // 1er cycle uniquement (6e → 3e). Pas de 2nd cycle.
  // Exemple : CES de Mfou, CES de Mbalmayo
  {
    code: "CES_FR",
    name: "Collège d'Enseignement Secondaire francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "6e", serie: null, filiere: null },
        { level: "5e", serie: null, filiere: null },
        { level: "4e", serie: null, filiere: null },
        { level: "3e", serie: null, filiere: null },
      ],
      firstCycleOnly: true,
      officialExams: ["BEPC"],
      roleTitles: {
        ADMIN:            "Directeur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 3. Institut privé francophone ──────────────────────────────────────────
  // Établissements privés laïcs ou confessionnels francophones.
  // Même structure qu'un lycée FR. Le code ownership différencie public/privé.
  // Exemples : Institut Samba, Collège La Salle, etc.
  {
    code: "PRIVE_FR",
    name: "Établissement privé francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PRIVATE_SECULAR" as const,
    config: {
      classes: [
        { level: "6e",   serie: null, filiere: null },
        { level: "5e",   serie: null, filiere: null },
        { level: "4e",   serie: null, filiere: null },
        { level: "3e",   serie: null, filiere: null },
        { level: "2nde", serie: "A4", filiere: null },
        { level: "2nde", serie: "C",  filiere: null },
        { level: "2nde", serie: "D",  filiere: null },
        { level: "1ere", serie: "A4", filiere: null },
        { level: "1ere", serie: "C",  filiere: null },
        { level: "1ere", serie: "D",  filiere: null },
        { level: "1ere", serie: "TI", filiere: null },
        { level: "Tle",  serie: "A4", filiere: null },
        { level: "Tle",  serie: "C",  filiere: null },
        { level: "Tle",  serie: "D",  filiere: null },
        { level: "Tle",  serie: "TI", filiere: null },
      ],
      officialExams: ["BEPC", "PROBATOIRE", "BAC"],
      bacSeriesAvailable: ["A4", "C", "D", "TI"],
      probatoire: "1ere",
      bacCoefficientsApplyAt: "Tle",
      isPrivate: true,
      roleTitles: {
        ADMIN:            "Directeur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 4. Lycée Technique francophone ─────────────────────────────────────────
  // CAP (4 ans) + BT (3 ans). Filières industrielles et tertiaires.
  // Chef des Travaux obligatoire. Sous-groupes TP. Notes pratique/théorie séparées.
  {
    code: "LYCEE_TECHNIQUE_FR",
    name: "Lycée Technique francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "TECHNICAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "CAP1", serie: null, filiere: "F1" },
        { level: "CAP1", serie: null, filiere: "G2" },
        { level: "CAP2", serie: null, filiere: "F1" },
        { level: "CAP2", serie: null, filiere: "G2" },
        { level: "CAP3", serie: null, filiere: "F1" },
        { level: "CAP3", serie: null, filiere: "G2" },
        { level: "CAP4", serie: null, filiere: "F1" },
        { level: "CAP4", serie: null, filiere: "G2" },
        { level: "BT1",  serie: null, filiere: "F1" },
        { level: "BT1",  serie: null, filiere: "G2" },
        { level: "BT2",  serie: null, filiere: "F1" },
        { level: "BT2",  serie: null, filiere: "G2" },
        { level: "BT3",  serie: null, filiere: "F1" },
        { level: "BT3",  serie: null, filiere: "G2" },
      ],
      officialExams: ["CAP", "PROBATOIRE_TECHNIQUE", "BT"],
      subGroupEnabled: true,
      hasPracticalGrades: true,
      hasProfessionalAttitude: true,
      hasInternships: true,
      roleTitles: {
        ADMIN:            "Proviseur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_WORKS:      "Chef des Travaux",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 5. CETIC ───────────────────────────────────────────────────────────────
  // Collège d'Enseignement Technique Industriel et Commercial.
  // CAP uniquement (4 ans). Pas de BT. 1er cycle technique.
  {
    code: "CETIC",
    name: "Collège d'Enseignement Technique Industriel et Commercial",
    subsystem: "FRANCOPHONE" as const,
    educationType: "TECHNICAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "CAP1", serie: null, filiere: "F1" },
        { level: "CAP1", serie: null, filiere: "G2" },
        { level: "CAP2", serie: null, filiere: "F1" },
        { level: "CAP2", serie: null, filiere: "G2" },
        { level: "CAP3", serie: null, filiere: "F1" },
        { level: "CAP3", serie: null, filiere: "G2" },
        { level: "CAP4", serie: null, filiere: "F1" },
        { level: "CAP4", serie: null, filiere: "G2" },
      ],
      officialExams: ["CAP"],
      firstCycleOnly: true,
      subGroupEnabled: true,
      hasPracticalGrades: true,
      hasProfessionalAttitude: true,
      roleTitles: {
        ADMIN:            "Directeur",
        STAFF_DEPUTY:     "Censeur",
        STAFF_WORKS:      "Chef des Travaux",
        STAFF_DISCIPLINE: "Surveillant Général",
        STAFF_FINANCE:    "Intendant",
      },
    },
  },

  // ── 6. SAR-SM ──────────────────────────────────────────────────────────────
  // Section Artisanale Rurale (SAR) + Section Ménagère (SM).
  // Formation professionnelle courte, zones rurales. 2 ans.
  {
    code: "SAR_SM",
    name: "Section Artisanale Rurale / Section Ménagère",
    subsystem: "FRANCOPHONE" as const,
    educationType: "PROFESSIONAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Année1", serie: null, filiere: "SAR" },
        { level: "Année2", serie: null, filiere: "SAR" },
        { level: "Année1", serie: null, filiere: "SM"  },
        { level: "Année2", serie: null, filiere: "SM"  },
      ],
      hasPracticalGrades: true,
      isRural: true,
      roleTitles: {
        ADMIN:   "Directeur",
        TEACHER: "Moniteur / Monitrice",
      },
    },
  },

  // ── 7. CFM ─────────────────────────────────────────────────────────────────
  // Centre de Formation des Métiers. Formation professionnelle courte.
  // Filières : SAR, SM, Couture, et autres selon le centre.
  {
    code: "CFM",
    name: "Centre de Formation des Métiers",
    subsystem: "FRANCOPHONE" as const,
    educationType: "PROFESSIONAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Année1", serie: null, filiere: "SAR"     },
        { level: "Année2", serie: null, filiere: "SAR"     },
        { level: "Année1", serie: null, filiere: "SM"      },
        { level: "Année2", serie: null, filiere: "SM"      },
        { level: "Année1", serie: null, filiere: "COUTURE" },
        { level: "Année2", serie: null, filiere: "COUTURE" },
      ],
      hasPracticalGrades: true,
      isRural: true,
      roleTitles: {
        ADMIN:   "Directeur",
        TEACHER: "Formateur / Formatrice",
      },
    },
  },

  // ── 8. École primaire francophone ──────────────────────────────────────────
  // SIL (Sous-Initiation à la Lecture) → CM2.
  // Examen officiel : CEPE en CM2 + Concours d'entrée en 6e.
  // Un seul instituteur par classe. Directeur = admin.
  {
    code: "PRIMAIRE_FR",
    name: "École primaire francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "PRIMARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "SIL", serie: null, filiere: null },
        { level: "CP",  serie: null, filiere: null },
        { level: "CE1", serie: null, filiere: null },
        { level: "CE2", serie: null, filiere: null },
        { level: "CM1", serie: null, filiere: null },
        { level: "CM2", serie: null, filiere: null },
      ],
      officialExams: ["CEPE", "CONCOURS_6EME"],
      apcSystem: true,
      totalPoints: 300,
      gradingSystem: "COMPETENCY_BASED",
      bulletinTemplate: "PRIMARY",
      attendanceTwiceDaily: true,
      unitsPerYear: 8,
      unitsPerTerm: [3, 3, 2],
      subjectScales: {
        "Français":                30,
        "Anglais":                 30,
        "Mathématiques":           40,
        "Sciences et Technologie": 40,
        "TIC":                     40,
        "Histoire-Géographie":     20,
        "Éducation Morale + EPS":  20,
        "Éducation Artistique":    20,
        "Sport":                   20,
        "Développement Personnel": 20,
        "Langue Nationale":        20,
      },
      subjectsFromCE1: ["Histoire", "Géographie"],
      promotionByLevel: true,
      levels: [
        { name: "Niveau 1", classes: ["SIL", "CP"], collectivePromotion: true },
        { name: "Niveau 2", classes: ["CE1", "CE2"], collectivePromotion: true },
        { name: "Niveau 3", classes: ["CM1", "CM2"], collectivePromotion: true },
      ],
      teacherHasFinalDecision: true,
      roleTitles: {
        ADMIN:   "Directeur",
        TEACHER: "Instituteur / Institutrice",
      },
    },
  },

  // ── 9. Maternelle francophone ──────────────────────────────────────────────
  // Petite / Moyenne / Grande section.
  // Évaluation par compétences (pas de notes chiffrées).
  {
    code: "MATERNELLE_FR",
    name: "Maternelle francophone",
    subsystem: "FRANCOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "PRESCHOOL" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Petite section",  serie: null, filiere: null },
        { level: "Moyenne section", serie: null, filiere: null },
        { level: "Grande section",  serie: null, filiere: null },
      ],
      gradingSystem: "COMPETENCY_BASED",
      roleTitles: {
        ADMIN:   "Directeur",
        TEACHER: "Institutrice de maternelle",
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTÈME ANGLOPHONE (5 templates)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 10. GHS — Government High School anglophone ────────────────────────────
  // Form 1-5 (O-Level) + Lower Sixth + Upper Sixth (A-Level).
  // Examen : GCE O-Level (Form 5) + GCE A-Level (Upper Sixth).
  // Notes sur 100. Pass mark = 40%.
  {
    code: "GHS_EN",
    name: "Government High School (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Form1",      serie: null, filiere: null },
        { level: "Form2",      serie: null, filiere: null },
        { level: "Form3",      serie: null, filiere: null },
        { level: "Form4",      serie: null, filiere: null },
        { level: "Form5",      serie: null, filiere: null },
        { level: "LowerSixth", serie: null, filiere: null },
        { level: "UpperSixth", serie: null, filiere: null },
      ],
      officialExams: ["GCE_O_LEVEL", "GCE_A_LEVEL"],
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      roleTitles: {
        ADMIN:            "Principal",
        STAFF_DEPUTY:     "Vice-Principal",
        STAFF_DISCIPLINE: "Discipline Master",
        STAFF_FINANCE:    "Bursar",
        STAFF_HOD:        "Head of Department (HOD)",
      },
    },
  },

  // ── 11. GSS — Government Secondary School anglophone ──────────────────────
  // Form 1-5 uniquement. Pas d'A-Level.
  // Examen : GCE O-Level seulement.
  {
    code: "GSS_EN",
    name: "Government Secondary School (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Form1", serie: null, filiere: null },
        { level: "Form2", serie: null, filiere: null },
        { level: "Form3", serie: null, filiere: null },
        { level: "Form4", serie: null, filiere: null },
        { level: "Form5", serie: null, filiere: null },
      ],
      firstCycleOnly: true,
      officialExams: ["GCE_O_LEVEL"],
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      roleTitles: {
        ADMIN:            "Principal",
        STAFF_DEPUTY:     "Vice-Principal",
        STAFF_DISCIPLINE: "Discipline Master",
        STAFF_FINANCE:    "Bursar",
      },
    },
  },

  // ── 12. Private school anglophone ──────────────────────────────────────────
  // Même structure qu'un GHS mais privé (laïc ou confessionnel).
  // Exemples : Presbyterian Secondary School, Baptist High School, etc.
  {
    code: "PRIVE_EN",
    name: "Private school (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PRIVATE_SECULAR" as const,
    config: {
      classes: [
        { level: "Form1",      serie: null, filiere: null },
        { level: "Form2",      serie: null, filiere: null },
        { level: "Form3",      serie: null, filiere: null },
        { level: "Form4",      serie: null, filiere: null },
        { level: "Form5",      serie: null, filiere: null },
        { level: "LowerSixth", serie: null, filiere: null },
        { level: "UpperSixth", serie: null, filiere: null },
      ],
      officialExams: ["GCE_O_LEVEL", "GCE_A_LEVEL"],
      isPrivate: true,
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      roleTitles: {
        ADMIN:            "Principal",
        STAFF_DEPUTY:     "Vice-Principal",
        STAFF_DISCIPLINE: "Discipline Master",
        STAFF_FINANCE:    "Bursar",
      },
    },
  },

  // ── 13. Primary School anglophone ──────────────────────────────────────────
  // Class 1 → Class 6. Examen : FSLC (First School Leaving Certificate) en Class 6
  // + Common Entrance pour intégrer Form 1.
  {
    code: "PRIMARY_EN",
    name: "Primary School (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "PRIMARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "Class1", serie: null, filiere: null },
        { level: "Class2", serie: null, filiere: null },
        { level: "Class3", serie: null, filiere: null },
        { level: "Class4", serie: null, filiere: null },
        { level: "Class5", serie: null, filiere: null },
        { level: "Class6", serie: null, filiere: null },
      ],
      officialExams: ["FSLC", "COMMON_ENTRANCE"],
      gradingSystem: "OUT_OF_100",
      passmark: 40,
      // Confirmé terrain : Groupe Scolaire Bilingue Le Québécois, Class 5, 2025-2026
      // Bulletin mensuel (Month 1 Term 1) — pas trimestriel
      // Notes sur barèmes variables (40, 70, 10, 15...) — pas sur 20 ou 100 fixes
      monthlyReportCard: true,
      gradingVariableScale: true,
      bulletinTemplate: "MONTHLY",
      roleTitles: {
        ADMIN:   "Head Teacher",
        TEACHER: "Class Teacher",
      },
    },
  },

  // ── 14. Nursery School anglophone ──────────────────────────────────────────
  // PreNursery, Nursery 1, Nursery 2. Évaluation par compétences.
  {
    code: "NURSERY_EN",
    name: "Nursery School (anglophone)",
    subsystem: "ANGLOPHONE" as const,
    educationType: "GENERAL" as const,
    level: "PRESCHOOL" as const,
    ownership: "PUBLIC" as const,
    config: {
      classes: [
        { level: "PreNursery", serie: null, filiere: null },
        { level: "Nursery1",   serie: null, filiere: null },
        { level: "Nursery2",   serie: null, filiere: null },
      ],
      gradingSystem: "COMPETENCY_BASED",
      roleTitles: {
        ADMIN:   "Head Teacher",
        TEACHER: "Nursery Teacher",
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BILINGUE (2 templates)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 15. Lycée bilingue secondaire ──────────────────────────────────────────
  // Deux sections coexistant dans le même établissement :
  //   Section FR : 6e→Tle, séries A4/ABI/C/D/TI (ABI spécifique au bilingue)
  //   Section EN : Form 1→UpperSixth
  // Proviseur général supervise les deux sections.
  // Censeur (section FR) + Vice-Principal (section EN).
  // Certains enseignants peuvent enseigner dans les deux sections.
  {
    code: "LYCEE_BILINGUE",
    name: "Lycée bilingue (sections FR + EN)",
    subsystem: "BILINGUAL" as const,
    educationType: "GENERAL" as const,
    level: "SECONDARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      isBilingual: true,
      sections: [
        {
          code: "FR",
          name: "Section Francophone",
          gradingSystem: "OUT_OF_20",
          passmark: 10,
        },
        {
          code: "EN",
          name: "Anglophone Section",
          gradingSystem: "OUT_OF_100",
          passmark: 40,
        },
      ],
      // Section FR : ABI disponible (série bilingue, code OBC: BAABI)
      // Note : ABI démarre en 2nde dans les lycées bilingues
      classesFR: [
        { level: "6e",   serie: null  },
        { level: "5e",   serie: null  },
        { level: "4e",   serie: null  },
        { level: "3e",   serie: null  },
        { level: "2nde", serie: "A4"  },
        { level: "2nde", serie: "ABI" },
        { level: "2nde", serie: "C"   },
        { level: "2nde", serie: "D"   },
        { level: "1ere", serie: "A4"  },
        { level: "1ere", serie: "ABI" },
        { level: "1ere", serie: "C"   },
        { level: "1ere", serie: "D"   },
        { level: "1ere", serie: "TI"  },
        { level: "Tle",  serie: "A4"  },
        { level: "Tle",  serie: "ABI" },
        { level: "Tle",  serie: "C"   },
        { level: "Tle",  serie: "D"   },
        { level: "Tle",  serie: "TI"  },
      ],
      // Section EN : Form 1-5 + Sixth Form
      classesEN: [
        { level: "Form1"      },
        { level: "Form2"      },
        { level: "Form3"      },
        { level: "Form4"      },
        { level: "Form5"      },
        { level: "LowerSixth" },
        { level: "UpperSixth" },
      ],
      officialExams: ["BEPC", "PROBATOIRE", "BAC", "GCE_O_LEVEL", "GCE_A_LEVEL"],
      roleTitles: {
        ADMIN:               "Proviseur",
        STAFF_DEPUTY_FR:     "Censeur",
        STAFF_DEPUTY_EN:     "Vice-Principal",
        STAFF_DISCIPLINE:    "Surveillant Général / Discipline Master",
        STAFF_FINANCE:       "Intendant / Bursar",
      },
    },
  },

  // ── 16. École primaire bilingue ────────────────────────────────────────────
  // Section FR (SIL→CM2) + Section EN (Class 1→Class 6) dans le même bâtiment.
  {
    code: "PRIMARY_BILINGUAL",
    name: "École primaire bilingue",
    subsystem: "BILINGUAL" as const,
    educationType: "GENERAL" as const,
    level: "PRIMARY" as const,
    ownership: "PUBLIC" as const,
    config: {
      isBilingual: true,
      sections: [
        { code: "FR", name: "Section Francophone", gradingSystem: "OUT_OF_20",  passmark: 10 },
        { code: "EN", name: "Anglophone Section",  gradingSystem: "OUT_OF_100", passmark: 40 },
      ],
      attendanceTwiceDaily: true,
      apcSystem: true,
      unitsPerYear: 8,
      unitsPerTerm: [3, 3, 2],
      classesFR: [
        { level: "SIL" }, { level: "CP"  }, { level: "CE1" },
        { level: "CE2" }, { level: "CM1" }, { level: "CM2" },
      ],
      classesEN: [
        { level: "Class1" }, { level: "Class2" }, { level: "Class3" },
        { level: "Class4" }, { level: "Class5" }, { level: "Class6" },
      ],
      officialExams: ["CEPE", "FSLC", "COMMON_ENTRANCE"],
      teacherHasFinalDecision: true,
      roleTitles: {
        ADMIN:      "Directeur / Head Teacher",
        TEACHER_FR: "Instituteur / Institutrice",
        TEACHER_EN: "Class Teacher",
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-NIVEAUX (1 template)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── 17. Complexe scolaire ──────────────────────────────────────────────────
  // Établissement regroupant plusieurs cycles sous une direction générale.
  // Exemples : Complexe Scolaire Excellence, Institut Polyvalent…
  // Ce template crée la structure de base uniquement.
  // Chaque cycle est configuré séparément après approbation.
  {
    code: "COMPLEXE_SCOLAIRE",
    name: "Complexe scolaire (multi-niveaux)",
    subsystem: "BILINGUAL" as const,
    educationType: "MIXED" as const,
    level: "MULTI" as const,
    ownership: "PRIVATE_SECULAR" as const,
    config: {
      isMultiLevel: true,
      levels: ["PRESCHOOL", "PRIMARY", "SECONDARY"],
      note: "Structure de base — chaque cycle est configuré séparément par l'admin.",
      roleTitles: {
        ADMIN: "Directeur Général",
      },
    },
  },
];

// ─── FORMULES DE NOTES PAR DÉFAUT ────────────────────────────────────────────
// isDefault=true + schoolId null → règles système, non liées à une école.
// Appliquées automatiquement à l'onboarding selon le sous-système.
// Les valeurs seront confirmées par les enquêtes terrain (Mai 2026).

const defaultGradeFormulas = [
  {
    id: "default-fr",
    label: "Formule séquentielle FR standard — une note DS par séquence",
    // Cas majoritaire : l'enseignant saisit une seule note (DS) par séquence.
    // Moyenne trimestre = (Séq1 + Séq2) ÷ 2
    // Le CC existe dans certains établissements (ex: Le Québécois) → formule configurable par école.
    evaluations: [
      { code: "DS", label: "Devoir Surveillé", weight: 100, count: 1 },
    ],
    isDefault: true,
  },
  {
    id: "default-en",
    label: "Default EN formula — Class Tests 30% + Terminal Exam 70%",
    // Valeur provisoire à confirmer terrain
    evaluations: [
      { code: "CLASS_TEST",    label: "Class Test",    weight: 30, count: 2 },
      { code: "TERMINAL_EXAM", label: "Terminal Exam", weight: 70, count: 1 },
    ],
    isDefault: true,
  },
];

// ─── RÈGLES DE MENTION PAR DÉFAUT ────────────────────────────────────────────

const defaultMentionRules = [
  {
    id: "default-fr-mentions",
    rules: [
      { label: "Excellent",      min: 18,  max: 20    },
      { label: "Très Bien",      min: 16,  max: 17.99 },
      { label: "Bien",           min: 14,  max: 15.99 },
      { label: "Assez Bien",     min: 12,  max: 13.99 },
      { label: "Passable",       min: 10,  max: 11.99 },
      { label: "Insuffisant",    min: 8,   max: 9.99  },
      { label: "T. Insuffisant", min: 6,   max: 7.99  },
      { label: "Médiocre",       min: 0,   max: 5.99  },
    ],
    isDefault: true,
  },
  {
    id: "default-en-mentions",
    rules: [
      { label: "Excellent",  min: 80, max: 100   },
      { label: "Very Good",  min: 70, max: 79.99 },
      { label: "Good",       min: 60, max: 69.99 },
      { label: "Average",    min: 50, max: 59.99 },
      { label: "Poor",       min: 0,  max: 49.99 },
    ],
    isDefault: true,
  },
];

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 EduNexus — Phase 0 seed\n");

  // 1. BacCoefficients
  console.log("🎓 Seeding BacCoefficients...");
  for (const coeff of bacCoefficients) {
    await prisma.bacCoefficient.upsert({
      where:  { subjectName: coeff.subjectName },
      update: {
        serieA4:  coeff.serieA4,
        serieC:   coeff.serieC,
        serieD:   coeff.serieD,
        serieTI:  coeff.serieTI,
        serieABI: coeff.serieABI,
        serieE:   coeff.serieE,
        serieA1:  coeff.serieA1,
        serieA2:  coeff.serieA2,
        serieA3:  coeff.serieA3,
        serieA5:  coeff.serieA5,
        serieSH:  coeff.serieSH,
        serieAC:  coeff.serieAC,
      },
      create: coeff,
    });
  }
  console.log(`   ✓ ${bacCoefficients.length} matières`);

  // 2. SchoolTemplates (17)
  console.log("\n🏫 Seeding SchoolTemplates...");
  for (const t of schoolTemplates) {
    await prisma.schoolTemplate.upsert({
      where:  { code: t.code },
      update: { config: t.config as any, name: t.name },
      create: {
        code: t.code,
        name: t.name,
        subsystem: t.subsystem,
        educationType: t.educationType,
        level: t.level,
        ownership: t.ownership,
        config: t.config as any,
      },
    });
    console.log(`   ✓ ${t.code}`);
  }
  console.log(`   → ${schoolTemplates.length} templates seeded`);

  // 3. GradeFormulas et MentionRules par défaut
  console.log("\n📐 Seeding default GradeFormulas and MentionRules...");

  for (const formula of defaultGradeFormulas) {
    await prisma.gradeFormula.upsert({
      where:  { id: formula.id },
      update: {
        label:       formula.label,
        evaluations: formula.evaluations as any,
        isDefault:   formula.isDefault,
      },
      create: {
        id:          formula.id,
        label:       formula.label,
        evaluations: formula.evaluations as any,
        isDefault:   formula.isDefault,
      },
    });
    console.log(`   ✓ GradeFormula ${formula.id}`);
  }

  for (const rule of defaultMentionRules) {
    await prisma.mentionRule.upsert({
      where:  { id: rule.id },
      update: {
        rules:     rule.rules as any,
        isDefault: rule.isDefault,
      },
      create: {
        id:        rule.id,
        rules:     rule.rules as any,
        isDefault: rule.isDefault,
      },
    });
    console.log(`   ✓ MentionRule ${rule.id}`);
  }

  console.log(`   → ${defaultGradeFormulas.length} default GradeFormulas et ${defaultMentionRules.length} MentionRules seeded`);

  console.log("\n✅ Seed Phase 0 terminé.\n");
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });