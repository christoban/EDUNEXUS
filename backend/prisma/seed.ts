import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── BAC COEFFICIENTS — Arrêté N° 92/22 MINESEC du 17 Mars 2022 ───────────────
// Structure : une entrée par (matière, série, niveau, groupe)
// Groupe 1 = matières principales, Groupe 2 = transversales

type BacCoeffEntry = {
  subjectName: string
  serie: string
  niveau: string
  coefficient: number
  groupe: number
  templateCode: string
  source: string
  isOfficialMinesec: boolean
}

function bc(sn: string, s: string, n: string, c: number, g: number): BacCoeffEntry {
  return {
    subjectName: sn, serie: s, niveau: n, coefficient: c, groupe: g,
    templateCode: "__ALL__",
    source: "Arrêté N° 92/22 MINESEC du 17 Mars 2022",
    isOfficialMinesec: true,
  }
}

const N = { S: "SECONDE", P: "PREMIERE", T: "TERMINALE" } as const
const G1 = 1, G2 = 2

const bacCoefficients: BacCoeffEntry[] = [

  // ══════════════════ SÉRIE A1 ══════════════════════════════════════════════
  // Groupe 1 — identique sur les 3 niveaux
  bc("Latin",         "A1", N.S, 3, G1),
  bc("Latin",         "A1", N.P, 3, G1),
  bc("Latin",         "A1", N.T, 3, G1),
  bc("Grec",          "A1", N.S, 3, G1),
  bc("Grec",          "A1", N.P, 3, G1),
  bc("Grec",          "A1", N.T, 3, G1),
  bc("Littérature",   "A1", N.S, 3, G1),
  bc("Littérature",   "A1", N.P, 3, G1),
  bc("Littérature",   "A1", N.T, 3, G1),
  // Groupe 2 — identique sur les 3 niveaux
  bc("Informatique",          "A1", N.S, 2, G2),
  bc("Informatique",          "A1", N.P, 2, G2),
  bc("Informatique",          "A1", N.T, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale", "A1", N.S, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale", "A1", N.P, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale", "A1", N.T, 2, G2),
  bc("EPS",             "A1", N.S, 2, G2),
  bc("EPS",             "A1", N.P, 2, G2),
  bc("EPS",             "A1", N.T, 2, G2),
  bc("Mathématiques",   "A1", N.S, 2, G2),
  bc("Mathématiques",   "A1", N.P, 2, G2),
  bc("Mathématiques",   "A1", N.T, 2, G2),
  bc("Sciences",        "A1", N.S, 1, G2),
  bc("Sciences",        "A1", N.P, 1, G2),
  bc("Sciences",        "A1", N.T, 1, G2),
  bc("Langues Nationales","A1", N.S, 1, G2),
  bc("Langues Nationales","A1", N.P, 1, G2),
  bc("Langues Nationales","A1", N.T, 1, G2),
  bc("Cultures Nationales","A1", N.S, 1, G2),
  bc("Cultures Nationales","A1", N.P, 1, G2),
  bc("Cultures Nationales","A1", N.T, 1, G2),
  bc("Éducation Artistique et Culturelle","A1", N.S, 1, G2),
  bc("Éducation Artistique et Culturelle","A1", N.P, 1, G2),
  bc("Éducation Artistique et Culturelle","A1", N.T, 1, G2),
  bc("Travail Manuel",  "A1", N.S, 1, G2),
  bc("Travail Manuel",  "A1", N.P, 1, G2),
  bc("Travail Manuel",  "A1", N.T, 1, G2),

  // ══════════════════ SÉRIE A2 ══════════════════════════════════════════════
  // Groupe 1
  bc("Latin",            "A2", N.S, 3, G1),
  bc("Latin",            "A2", N.P, 3, G1),
  bc("Latin",            "A2", N.T, 3, G1),
  bc("LV2",              "A2", N.S, 3, G1),
  bc("LV2",              "A2", N.P, 3, G1),
  bc("LV2",              "A2", N.T, 3, G1),
  bc("Littérature",      "A2", N.S, 3, G1),
  bc("Littérature",      "A2", N.P, 3, G1),
  bc("Littérature",      "A2", N.T, 3, G1),
  bc("Langue Française", "A2", N.S, 2, G1),
  bc("Langue Française", "A2", N.P, 2, G1),
  bc("Langue Française", "A2", N.T, 2, G1),
  bc("Philosophie",      "A2", N.S, 2, G1),
  bc("Philosophie",      "A2", N.P, 2, G1),
  bc("Philosophie",      "A2", N.T, 4, G1), // ⚠️ 4 en Tle
  bc("Anglais",          "A2", N.S, 4, G1),
  bc("Anglais",          "A2", N.P, 4, G1),
  bc("Anglais",          "A2", N.T, 4, G1),
  // Groupe 2 — sauf Informatique qui change en Tle
  bc("Informatique",                "A2", N.S, 2, G2),
  bc("Informatique",                "A2", N.P, 2, G2),
  bc("Informatique",                "A2", N.T, 1, G2), // ⚠️ 1 en Tle
  bc("Éducation à la Citoyenneté et à la Morale",   "A2", N.S, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale",   "A2", N.P, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale",   "A2", N.T, 2, G2),
  bc("EPS",               "A2", N.S, 2, G2),
  bc("EPS",               "A2", N.P, 2, G2),
  bc("EPS",               "A2", N.T, 2, G2),
  bc("Histoire",          "A2", N.S, 2, G2),
  bc("Histoire",          "A2", N.P, 2, G2),
  bc("Histoire",          "A2", N.T, 2, G2),
  bc("Géographie",        "A2", N.S, 2, G2),
  bc("Géographie",        "A2", N.P, 2, G2),
  bc("Géographie",        "A2", N.T, 2, G2),
  bc("Sciences",          "A2", N.S, 1, G2),
  bc("Sciences",          "A2", N.P, 1, G2),
  bc("Sciences",          "A2", N.T, 1, G2),
  bc("Langues Nationales",  "A2", N.S, 1, G2),
  bc("Langues Nationales",  "A2", N.P, 1, G2),
  bc("Langues Nationales",  "A2", N.T, 1, G2),
  bc("Cultures Nationales","A2", N.S, 1, G2),
  bc("Cultures Nationales","A2", N.P, 1, G2),
  bc("Cultures Nationales","A2", N.T, 1, G2),
  bc("Éducation Artistique et Culturelle","A2", N.S, 1, G2),
  bc("Éducation Artistique et Culturelle","A2", N.P, 1, G2),
  bc("Éducation Artistique et Culturelle","A2", N.T, 1, G2),
  bc("Travail Manuel",    "A2", N.S, 1, G2),
  bc("Travail Manuel",    "A2", N.P, 1, G2),
  bc("Travail Manuel",    "A2", N.T, 1, G2),

  // ══════════════════ SÉRIE A3 ══════════════════════════════════════════════
  // Groupe 1
  bc("Latin",            "A3", N.S, 4, G1),
  bc("Latin",            "A3", N.P, 4, G1),
  bc("Latin",            "A3", N.T, 4, G1),
  bc("Littérature",      "A3", N.S, 3, G1),
  bc("Littérature",      "A3", N.P, 3, G1),
  bc("Littérature",      "A3", N.T, 3, G1),
  bc("Langue Française", "A3", N.S, 2, G1),
  bc("Langue Française", "A3", N.P, 2, G1),
  bc("Langue Française", "A3", N.T, 2, G1),
  bc("Philosophie",      "A3", N.S, 2, G1),
  bc("Philosophie",      "A3", N.P, 2, G1),
  bc("Philosophie",      "A3", N.T, 4, G1), // ⚠️ 4 en Tle
  bc("Anglais",          "A3", N.S, 4, G1),
  bc("Anglais",          "A3", N.P, 4, G1),
  bc("Anglais",          "A3", N.T, 4, G1),
  // Groupe 2 — identique à A2
  bc("Informatique",                "A3", N.S, 2, G2),
  bc("Informatique",                "A3", N.P, 2, G2),
  bc("Informatique",                "A3", N.T, 1, G2),
  bc("Éducation à la Citoyenneté et à la Morale",   "A3", N.S, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale",   "A3", N.P, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale",   "A3", N.T, 2, G2),
  bc("EPS",               "A3", N.S, 2, G2),
  bc("EPS",               "A3", N.P, 2, G2),
  bc("EPS",               "A3", N.T, 2, G2),
  bc("Histoire",          "A3", N.S, 2, G2),
  bc("Histoire",          "A3", N.P, 2, G2),
  bc("Histoire",          "A3", N.T, 2, G2),
  bc("Géographie",        "A3", N.S, 2, G2),
  bc("Géographie",        "A3", N.P, 2, G2),
  bc("Géographie",        "A3", N.T, 2, G2),
  bc("Sciences",          "A3", N.S, 1, G2),
  bc("Sciences",          "A3", N.P, 1, G2),
  bc("Sciences",          "A3", N.T, 1, G2),
  bc("Langues Nationales",  "A3", N.S, 1, G2),
  bc("Langues Nationales",  "A3", N.P, 1, G2),
  bc("Langues Nationales",  "A3", N.T, 1, G2),
  bc("Cultures Nationales","A3", N.S, 1, G2),
  bc("Cultures Nationales","A3", N.P, 1, G2),
  bc("Cultures Nationales","A3", N.T, 1, G2),
  bc("Éducation Artistique et Culturelle","A3", N.S, 1, G2),
  bc("Éducation Artistique et Culturelle","A3", N.P, 1, G2),
  bc("Éducation Artistique et Culturelle","A3", N.T, 1, G2),
  bc("Travail Manuel",    "A3", N.S, 1, G2),
  bc("Travail Manuel",    "A3", N.P, 1, G2),
  bc("Travail Manuel",    "A3", N.T, 1, G2),

  // ══════════════════ SÉRIE A4 ══════════════════════════════════════════════
  // Groupe 1
  bc("Littérature",      "A4", N.S, 3, G1),
  bc("Littérature",      "A4", N.P, 3, G1),
  bc("Littérature",      "A4", N.T, 3, G1),
  bc("Langue Française", "A4", N.S, 2, G1),
  bc("Langue Française", "A4", N.P, 2, G1),
  bc("Langue Française", "A4", N.T, 2, G1),
  bc("Philosophie",      "A4", N.S, 2, G1),
  bc("Philosophie",      "A4", N.P, 2, G1),
  bc("Philosophie",      "A4", N.T, 4, G1), // ⚠️ 4 en Tle
  bc("Anglais",          "A4", N.S, 4, G1),
  bc("Anglais",          "A4", N.P, 4, G1),
  bc("Anglais",          "A4", N.T, 4, G1),
  bc("LV2",              "A4", N.S, 3, G1),
  bc("LV2",              "A4", N.P, 3, G1),
  bc("LV2",              "A4", N.T, 3, G1),
  // Groupe 2
  bc("Géographie",               "A4", N.S, 2, G2),
  bc("Géographie",               "A4", N.P, 2, G2),
  bc("Géographie",               "A4", N.T, 2, G2),
  bc("Histoire",                 "A4", N.S, 2, G2),
  bc("Histoire",                 "A4", N.P, 2, G2),
  bc("Histoire",                 "A4", N.T, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale","A4", N.S, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale","A4", N.P, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale","A4", N.T, 2, G2),
  bc("Informatique",             "A4", N.S, 2, G2),
  bc("Informatique",             "A4", N.P, 2, G2),
  bc("Informatique",             "A4", N.T, 2, G2),
  bc("EPS",            "A4", N.S, 2, G2),
  bc("EPS",            "A4", N.P, 2, G2),
  bc("EPS",            "A4", N.T, 2, G2),
  bc("Mathématiques",  "A4", N.S, 2, G2),
  bc("Mathématiques",  "A4", N.P, 2, G2),
  bc("Mathématiques",  "A4", N.T, 2, G2),
  bc("Sciences",       "A4", N.S, 1, G2),
  bc("Sciences",       "A4", N.P, 1, G2),
  bc("Sciences",       "A4", N.T, 1, G2),
  bc("Langues Nationales","A4", N.S, 1, G2),
  bc("Langues Nationales","A4", N.P, 1, G2),
  bc("Langues Nationales","A4", N.T, 1, G2),
  bc("Cultures Nationales","A4", N.S, 1, G2),
  bc("Cultures Nationales","A4", N.P, 1, G2),
  bc("Cultures Nationales","A4", N.T, 1, G2),
  bc("Éducation Artistique et Culturelle","A4", N.S, 1, G2),
  bc("Éducation Artistique et Culturelle","A4", N.P, 1, G2),
  bc("Éducation Artistique et Culturelle","A4", N.T, 1, G2),
  bc("Travail Manuel", "A4", N.S, 1, G2),
  bc("Travail Manuel", "A4", N.P, 1, G2),
  bc("Travail Manuel", "A4", N.T, 1, G2),

  // ══════════════════ SÉRIE A5 ══════════════════════════════════════════════
  // Groupe 1 — identique sur les 3 niveaux (Philosophie reste à 2)
  bc("Littérature",      "A5", N.S, 3, G1),
  bc("Littérature",      "A5", N.P, 3, G1),
  bc("Littérature",      "A5", N.T, 3, G1),
  bc("Langue Française", "A5", N.S, 2, G1),
  bc("Langue Française", "A5", N.P, 2, G1),
  bc("Langue Française", "A5", N.T, 2, G1),
  bc("Philosophie",      "A5", N.S, 2, G1),
  bc("Philosophie",      "A5", N.P, 2, G1),
  bc("Philosophie",      "A5", N.T, 2, G1), // ⚠️ reste à 2 même en Tle
  bc("Anglais",          "A5", N.S, 4, G1),
  bc("Anglais",          "A5", N.P, 4, G1),
  bc("Anglais",          "A5", N.T, 4, G1),
  bc("LV2",              "A5", N.S, 3, G1),
  bc("LV2",              "A5", N.P, 3, G1),
  bc("LV2",              "A5", N.T, 3, G1),
  bc("LV3",              "A5", N.S, 3, G1),
  bc("LV3",              "A5", N.P, 3, G1),
  bc("LV3",              "A5", N.T, 3, G1),
  // Groupe 2
  bc("Informatique",                "A5", N.S, 2, G2),
  bc("Informatique",                "A5", N.P, 2, G2),
  bc("Informatique",                "A5", N.T, 1, G2), // ⚠️ 1 en Tle
  bc("Éducation à la Citoyenneté et à la Morale",   "A5", N.S, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale",   "A5", N.P, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale",   "A5", N.T, 2, G2),
  bc("EPS",               "A5", N.S, 2, G2),
  bc("EPS",               "A5", N.P, 2, G2),
  bc("EPS",               "A5", N.T, 2, G2),
  bc("Histoire",          "A5", N.S, 2, G2),
  bc("Histoire",          "A5", N.P, 2, G2),
  bc("Histoire",          "A5", N.T, 2, G2),
  bc("Géographie",        "A5", N.S, 2, G2),
  bc("Géographie",        "A5", N.P, 2, G2),
  bc("Géographie",        "A5", N.T, 2, G2),
  bc("Sciences",          "A5", N.S, 1, G2),
  bc("Sciences",          "A5", N.P, 1, G2),
  bc("Sciences",          "A5", N.T, 1, G2),
  bc("Langues Nationales",  "A5", N.S, 1, G2),
  bc("Langues Nationales",  "A5", N.P, 1, G2),
  bc("Langues Nationales",  "A5", N.T, 1, G2),
  bc("Cultures Nationales","A5", N.S, 1, G2),
  bc("Cultures Nationales","A5", N.P, 1, G2),
  bc("Cultures Nationales","A5", N.T, 1, G2),
  bc("Éducation Artistique et Culturelle","A5", N.S, 1, G2),
  bc("Éducation Artistique et Culturelle","A5", N.P, 1, G2),
  bc("Éducation Artistique et Culturelle","A5", N.T, 1, G2),
  bc("Travail Manuel",    "A5", N.S, 1, G2),
  bc("Travail Manuel",    "A5", N.P, 1, G2),
  bc("Travail Manuel",    "A5", N.T, 1, G2),

  // ══════════════════ SÉRIE ABI ═════════════════════════════════════════════
  // Groupe 1
  bc("Intensive English", "ABI", N.S, 5, G1),
  bc("Intensive English", "ABI", N.P, 5, G1),
  bc("Intensive English", "ABI", N.T, 5, G1),
  bc("Littérature",       "ABI", N.S, 3, G1),
  bc("Littérature",       "ABI", N.P, 3, G1),
  bc("Littérature",       "ABI", N.T, 3, G1),
  bc("Langue Française",  "ABI", N.S, 2, G1),
  bc("Langue Française",  "ABI", N.P, 2, G1),
  bc("Langue Française",  "ABI", N.T, 2, G1),
  bc("Philosophie",       "ABI", N.S, 2, G1),
  bc("Philosophie",       "ABI", N.P, 2, G1),
  bc("Philosophie",       "ABI", N.T, 4, G1), // ⚠️ 4 en Tle
  bc("LV2",               "ABI", N.S, 3, G1),
  bc("LV2",               "ABI", N.P, 3, G1),
  bc("LV2",               "ABI", N.T, 3, G1),
  // Groupe 2
  bc("Informatique",                  "ABI", N.S, 2, G2),
  bc("Informatique",                  "ABI", N.P, 2, G2),
  bc("Informatique",                  "ABI", N.T, 1, G2),
  bc("Citizenship Education",         "ABI", N.S, 2, G2),
  bc("Citizenship Education",         "ABI", N.P, 2, G2),
  bc("Citizenship Education",         "ABI", N.T, 2, G2),
  bc("Sport and Physical Education",  "ABI", N.S, 2, G2),
  bc("Sport and Physical Education",  "ABI", N.P, 2, G2),
  bc("Sport and Physical Education",  "ABI", N.T, 2, G2),
  bc("Mathématiques",                 "ABI", N.S, 2, G2),
  bc("Mathématiques",                 "ABI", N.P, 2, G2),
  bc("Mathématiques",                 "ABI", N.T, 2, G2),
  bc("Histoire",                      "ABI", N.S, 2, G2),
  bc("Histoire",                      "ABI", N.P, 2, G2),
  bc("Histoire",                      "ABI", N.T, 2, G2),
  bc("Géographie",                    "ABI", N.S, 2, G2),
  bc("Géographie",                    "ABI", N.P, 2, G2),
  bc("Géographie",                    "ABI", N.T, 2, G2),
  bc("Sciences",                      "ABI", N.S, 1, G2),
  bc("Sciences",                      "ABI", N.P, 1, G2),
  bc("Sciences",                      "ABI", N.T, 1, G2),
  bc("Langues Nationales",              "ABI", N.S, 1, G2),
  bc("Langues Nationales",              "ABI", N.P, 1, G2),
  bc("Langues Nationales",              "ABI", N.T, 1, G2),
  bc("Cultures Nationales",           "ABI", N.S, 1, G2),
  bc("Cultures Nationales",           "ABI", N.P, 1, G2),
  bc("Cultures Nationales",           "ABI", N.T, 1, G2),
  bc("Éducation Artistique et Culturelle",          "ABI", N.S, 1, G2),
  bc("Éducation Artistique et Culturelle",          "ABI", N.P, 1, G2),
  bc("Éducation Artistique et Culturelle",          "ABI", N.T, 1, G2),
  bc("Manual Labor / Handicraft / Drawing", "ABI", N.S, 1, G2),
  bc("Manual Labor / Handicraft / Drawing", "ABI", N.P, 1, G2),
  bc("Manual Labor / Handicraft / Drawing", "ABI", N.T, 1, G2),

  // ══════════════════ SÉRIE C ═══════════════════════════════════════════════
  // Groupe 1 — Seconde
  bc("Mathématiques",  "C", N.S, 5, G1), // ⚠️ 5 (arrêté), pas 6
  bc("Physique",       "C", N.S, 3, G1),
  bc("Chimie",         "C", N.S, 3, G1),
  bc("Informatique",   "C", N.S, 3, G1),
  bc("SVTEEHB",        "C", N.S, 2, G1),
  // Groupe 1 — Première
  bc("Mathématiques",  "C", N.P, 6, G1),
  bc("Physique",       "C", N.P, 3, G1),
  bc("Chimie",         "C", N.P, 2, G1), // ⚠️ 2 (arrêté), pas 3
  bc("Informatique",   "C", N.P, 2, G1),
  // Groupe 1 — Terminale
  bc("Mathématiques",  "C", N.T, 6, G1),
  bc("Physique",       "C", N.T, 3, G1),
  bc("Chimie",         "C", N.T, 2, G1), // ⚠️ 2 (arrêté), pas 3
  bc("Informatique",   "C", N.T, 4, G1),
  // Groupe 2 — tous niveaux
  bc("Littérature",               "C", N.S, 2, G2),
  bc("Littérature",               "C", N.P, 2, G2),
  bc("Littérature",               "C", N.T, 2, G2),
  bc("Langue Française",          "C", N.S, 1, G2),
  bc("Langue Française",          "C", N.P, 1, G2),
  bc("Langue Française",          "C", N.T, 1, G2),
  bc("Anglais",                   "C", N.S, 3, G2),
  bc("Anglais",                   "C", N.P, 3, G2),
  bc("Anglais",                   "C", N.T, 3, G2),
  bc("Philosophie",               "C", N.S, 0, G2),
  bc("Philosophie",               "C", N.P, 1, G2),
  bc("Philosophie",               "C", N.T, 2, G2),
  bc("Histoire",                  "C", N.S, 2, G2), // Histoire + Géographie séparés
  bc("Géographie",                "C", N.S, 2, G2),
  bc("Histoire",                  "C", N.P, 2, G2),
  bc("Géographie",                "C", N.T, 2, G2),
  bc("SVTEEHB",                   "C", N.P, 2, G2), // SVTEEHB passe en G2 en 1ère/Tle
  bc("SVTEEHB",                   "C", N.T, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale","C", N.S, 1, G2),
  bc("Éducation à la Citoyenneté et à la Morale","C", N.P, 1, G2),
  bc("Éducation à la Citoyenneté et à la Morale","C", N.T, 1, G2),
  bc("EPS",                       "C", N.S, 2, G2),
  bc("EPS",                       "C", N.P, 2, G2),
  bc("EPS",                       "C", N.T, 2, G2),
  bc("Travail Manuel",            "C", N.S, 1, G2),
  bc("Travail Manuel",            "C", N.P, 1, G2),
  bc("Travail Manuel",            "C", N.T, 1, G2),

  // ══════════════════ SÉRIE D ═══════════════════════════════════════════════
  // ⚠️ COMMENCE EN 1ÈRE — AUCUNE ENTRÉE POUR SECONDE
  // Groupe 1 — Première
  bc("SVTEEHB",      "D", N.P, 6, G1),
  bc("Mathématiques","D", N.P, 4, G1),
  bc("Chimie",       "D", N.P, 2, G1),
  bc("Informatique", "D", N.P, 2, G1),
  // Groupe 1 — Terminale
  bc("SVTEEHB",      "D", N.T, 6, G1),
  bc("Mathématiques","D", N.T, 4, G1),
  bc("Chimie",       "D", N.T, 2, G1),
  bc("Informatique", "D", N.T, 2, G1),
  // Groupe 2 — Première et Terminale
  bc("Littérature",               "D", N.P, 2, G2),
  bc("Littérature",               "D", N.T, 2, G2),
  bc("Langue Française",          "D", N.P, 1, G2),
  bc("Langue Française",          "D", N.T, 1, G2),
  bc("Anglais",                   "D", N.P, 3, G2),
  bc("Anglais",                   "D", N.T, 3, G2),
  bc("Physique",                  "D", N.P, 2, G2),
  bc("Physique",                  "D", N.T, 3, G2), // ⚠️ 3 en Tle
  bc("Philosophie",               "D", N.P, 2, G2),
  bc("Philosophie",               "D", N.T, 2, G2),
  bc("Histoire",                  "D", N.P, 2, G2), // 1ère: Histoire seulement
  bc("Géographie",                "D", N.T, 2, G2), // Tle: Géographie seulement
  bc("Éducation à la Citoyenneté et à la Morale","D", N.P, 1, G2),
  bc("Éducation à la Citoyenneté et à la Morale","D", N.T, 1, G2),
  bc("EPS",                       "D", N.P, 2, G2),
  bc("EPS",                       "D", N.T, 2, G2),
  bc("Travail Manuel",            "D", N.P, 1, G2),
  bc("Travail Manuel",            "D", N.T, 1, G2),

  // ══════════════════ SÉRIE E ═══════════════════════════════════════════════
  // Groupe 1 — tous niveaux
  bc("Mathématiques",                    "E", N.S, 5, G1),
  bc("Mathématiques",                    "E", N.P, 6, G1),
  bc("Mathématiques",                    "E", N.T, 6, G1),
  bc("Physique",                         "E", N.S, 3, G1),
  bc("Physique",                         "E", N.P, 3, G1),
  bc("Physique",                         "E", N.T, 3, G1),
  bc("Chimie",                           "E", N.S, 2, G1),
  bc("Chimie",                           "E", N.P, 2, G1),
  bc("Chimie",                           "E", N.T, 2, G1),
  bc("Dessin et Technologie Mécaniques", "E", N.S, 6, G1),
  bc("Dessin et Technologie Mécaniques", "E", N.P, 6, G1),
  bc("Dessin et Technologie Mécaniques", "E", N.T, 6, G1),
  bc("Fabrication Éléments Mécaniques",  "E", N.S, 4, G1),
  bc("Fabrication Éléments Mécaniques",  "E", N.P, 4, G1),
  bc("Fabrication Éléments Mécaniques",  "E", N.T, 4, G1),
  // Groupe 2
  bc("Français",          "E", N.S, 3, G2),
  bc("Français",          "E", N.P, 2, G2),
  bc("Français",          "E", N.T, 2, G2),
  bc("Anglais",           "E", N.S, 3, G2),
  bc("Anglais",           "E", N.P, 3, G2),
  bc("Anglais",           "E", N.T, 2, G2),
  bc("Informatique",      "E", N.S, 2, G2),
  bc("Informatique",      "E", N.P, 2, G2),
  bc("Informatique",      "E", N.T, 2, G2),
  bc("Philosophie",       "E", N.S, 0, G2),
  bc("Philosophie",       "E", N.P, 1, G2),
  bc("Philosophie",       "E", N.T, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale","E", N.S, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale","E", N.P, 1, G2),
  bc("Éducation à la Citoyenneté et à la Morale","E", N.T, 1, G2),
  bc("EPS",               "E", N.S, 2, G2),
  bc("EPS",               "E", N.P, 2, G2),
  bc("EPS",               "E", N.T, 2, G2),

  // ══════════════════ SÉRIE TI ══════════════════════════════════════════════
  // ⚠️ COMMENCE EN 1ÈRE — AUCUNE ENTRÉE POUR SECONDE
  // Groupe 1 — Première
  bc("Algorithmique-Programmation", "TI", N.P, 3, G1),
  bc("Systèmes d'Information",      "TI", N.P, 3, G1),
  bc("Maintenance et Multimédia",   "TI", N.P, 2, G1),
  bc("Mathématiques",               "TI", N.P, 4, G1),
  bc("Physique",                    "TI", N.P, 2, G1),
  bc("Chimie",                      "TI", N.P, 1, G1),
  // Groupe 1 — Terminale
  bc("Programmation",               "TI", N.T, 3, G1),
  bc("Systèmes d'Information",      "TI", N.T, 3, G1),
  bc("Réseau Internet Sécurité",    "TI", N.T, 2, G1),
  bc("Mathématiques",               "TI", N.T, 4, G1),
  bc("Physique",                    "TI", N.T, 2, G1),
  bc("Chimie",                      "TI", N.T, 2, G1),
  // Groupe 2 — Première et Terminale
  bc("Français",                    "TI", N.P, 3, G2),
  bc("Français",                    "TI", N.T, 3, G2),
  bc("Anglais",                     "TI", N.P, 3, G2),
  bc("Anglais",                     "TI", N.T, 3, G2),
  bc("SVTEEHB",                     "TI", N.P, 2, G2),
  bc("SVTEEHB",                     "TI", N.T, 2, G2),
  bc("Histoire",                  "TI", N.P, 2, G2), // 1ère: Histoire seulement
  bc("Géographie",                "TI", N.T, 2, G2), // Tle: Géographie seulement
  bc("Éducation à la Citoyenneté et à la Morale",  "TI", N.P, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale",  "TI", N.T, 2, G2),
  bc("Philosophie",                 "TI", N.P, 1, G2),
  bc("Philosophie",                 "TI", N.T, 2, G2),
  bc("EPS",                         "TI", N.P, 2, G2),
  bc("EPS",                         "TI", N.T, 2, G2),
  bc("Cultures Nationales",         "TI", N.P, 1, G2),
  bc("Cultures Nationales",         "TI", N.T, 1, G2),
  bc("Travail Manuel",              "TI", N.P, 1, G2),
  bc("Travail Manuel",              "TI", N.T, 1, G2),

  // ══════════════════ SÉRIE SH ══════════════════════════════════════════════
  // Groupe 1
  bc("Géographie",                 "SH", N.S, 3, G1),
  bc("Géographie",                 "SH", N.P, 3, G1),
  bc("Géographie",                 "SH", N.T, 3, G1),
  bc("Histoire",                   "SH", N.S, 3, G1),
  bc("Histoire",                   "SH", N.P, 3, G1),
  bc("Histoire",                   "SH", N.T, 3, G1),
  bc("Littérature",                "SH", N.S, 3, G1),
  bc("Littérature",                "SH", N.P, 3, G1),
  bc("Littérature",                "SH", N.T, 3, G1),
  bc("Langue Française",           "SH", N.S, 2, G1),
  bc("Langue Française",           "SH", N.P, 2, G1),
  bc("Langue Française",           "SH", N.T, 2, G1),
  bc("Philosophie",                "SH", N.S, 2, G1),
  bc("Philosophie",                "SH", N.P, 2, G1),
  bc("Philosophie",                "SH", N.T, 4, G1), // ⚠️ 4 en Tle
  bc("Anglais",                    "SH", N.S, 4, G1),
  bc("Anglais",                    "SH", N.P, 4, G1),
  bc("Anglais",                    "SH", N.T, 4, G1),
  bc("Éducation à la Citoyenneté et à la Morale", "SH", N.S, 2, G1),
  bc("Éducation à la Citoyenneté et à la Morale", "SH", N.P, 2, G1),
  bc("Éducation à la Citoyenneté et à la Morale", "SH", N.T, 2, G1),
  // Groupe 2
  bc("Informatique",              "SH", N.S, 2, G2),
  bc("Informatique",              "SH", N.P, 2, G2),
  bc("Informatique",              "SH", N.T, 2, G2),
  bc("EPS",                       "SH", N.S, 2, G2),
  bc("EPS",                       "SH", N.P, 2, G2),
  bc("EPS",                       "SH", N.T, 2, G2),
  bc("Mathématiques",             "SH", N.S, 2, G2),
  bc("Mathématiques",             "SH", N.P, 2, G2),
  bc("Mathématiques",             "SH", N.T, 2, G2),
  bc("Sciences",                  "SH", N.S, 2, G2),
  bc("Sciences",                  "SH", N.P, 2, G2),
  bc("Sciences",                  "SH", N.T, 2, G2),
  bc("Langues Nationales",          "SH", N.S, 1, G2),
  bc("Langues Nationales",          "SH", N.P, 1, G2),
  bc("Langues Nationales",          "SH", N.T, 1, G2),
  bc("Cultures Nationales",       "SH", N.S, 1, G2),
  bc("Cultures Nationales",       "SH", N.P, 1, G2),
  bc("Cultures Nationales",       "SH", N.T, 1, G2),
  bc("Éducation Artistique et Culturelle",      "SH", N.S, 1, G2),
  bc("Éducation Artistique et Culturelle",      "SH", N.P, 1, G2),
  bc("Éducation Artistique et Culturelle",      "SH", N.T, 1, G2),
  bc("Travail Manuel",            "SH", N.S, 1, G2),
  bc("Travail Manuel",            "SH", N.P, 1, G2),
  bc("Travail Manuel",            "SH", N.T, 1, G2),

  // ══════════════════ SÉRIE AC ══════════════════════════════════════════════
  // Groupe 1 — Seconde
  bc("Histoire du Cinéma",          "AC", N.S, 4, G1),
  bc("Éléments Langage Cinéma",     "AC", N.S, 4, G1),
  bc("Outils et Métiers Cinéma",    "AC", N.S, 3, G1),
  // Groupe 1 — Première
  bc("Genres Cinématographiques",   "AC", N.P, 4, G1),
  bc("Analyse Filmique",            "AC", N.P, 3, G1),
  bc("Économie du Cinéma",          "AC", N.P, 3, G1),
  // Groupe 1 — Terminale
  bc("Processus Réalisation Film",  "AC", N.T, 3, G1),
  bc("Projet Fin Formation",        "AC", N.T, 4, G1),
  bc("Sociologie du Cinéma",        "AC", N.T, 3, G1),
  // Groupe 2
  bc("Français",                   "AC", N.S, 3, G2),
  bc("Français",                   "AC", N.P, 3, G2),
  bc("Français",                   "AC", N.T, 3, G2),
  bc("Anglais",                    "AC", N.S, 3, G2),
  bc("Anglais",                    "AC", N.P, 3, G2),
  bc("Anglais",                    "AC", N.T, 3, G2),
  bc("Informatique",               "AC", N.S, 3, G2),
  bc("Informatique",               "AC", N.P, 2, G2),
  bc("Informatique",               "AC", N.T, 2, G2),
  bc("Mathématiques",              "AC", N.S, 1, G2),
  bc("Mathématiques",              "AC", N.P, 1, G2),
  bc("Mathématiques",              "AC", N.T, 0, G2),
  bc("Physique",                   "AC", N.S, 2, G2),
  bc("Physique",                   "AC", N.P, 2, G2),
  bc("Physique",                   "AC", N.T, 0, G2),
  bc("Langues Nationales",           "AC", N.S, 1, G2),
  bc("Langues Nationales",           "AC", N.P, 1, G2),
  bc("Langues Nationales",           "AC", N.T, 1, G2),
  bc("Cultures Nationales",        "AC", N.S, 1, G2),
  bc("Cultures Nationales",        "AC", N.P, 1, G2),
  bc("Cultures Nationales",        "AC", N.T, 1, G2),
  bc("Éducation à la Citoyenneté et à la Morale", "AC", N.S, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale", "AC", N.P, 2, G2),
  bc("Éducation à la Citoyenneté et à la Morale", "AC", N.T, 2, G2),
  bc("Philosophie",                "AC", N.S, 1, G2),
  bc("Philosophie",                "AC", N.P, 1, G2),
  bc("Philosophie",                "AC", N.T, 1, G2),
  bc("Histoire",                   "AC", N.S, 0, G2),
  bc("Histoire",                   "AC", N.P, 2, G2),
  bc("Histoire",                   "AC", N.T, 0, G2),
  bc("Géographie",                 "AC", N.S, 0, G2),
  bc("Géographie",                 "AC", N.P, 0, G2),
  bc("Géographie",                 "AC", N.T, 2, G2),
  bc("EPS",                        "AC", N.S, 2, G2),
  bc("EPS",                        "AC", N.P, 2, G2),
  bc("EPS",                        "AC", N.T, 2, G2),
  bc("Travail Manuel",             "AC", N.S, 1, G2),
  bc("Travail Manuel",             "AC", N.P, 1, G2),
  bc("Travail Manuel",             "AC", N.T, 1, G2),
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
  // Pas de série D ni TI en 2nde (démarrent en 1ère)
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
        // 2nd cycle — séries A4, C (D et TI interdits en 2nde)
        { level: "2nde", serie: "A4", filiere: null },
        { level: "2nde", serie: "C",  filiere: null },
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

// ─── MATIÈRES PAR DÉFAUT PAR TEMPLATE ────────────────────────────────────────
// Stockées dans SchoolTemplate.config au moment du seed.
// Le use case d'activation les lit pour créer les Subject records de l'école.
// coefficient = coefficient standard (1er cycle FR) ou barème max (primaire).

type SubjectDef = {
  name: string
  code: string
  coefficient: number
  hoursPerWeek?: number
  subjectType?: 'THEORETICAL' | 'PRACTICAL' | 'MIXED'
}

const FR_SEC_SUBJECTS: SubjectDef[] = [
  { name: "Français",            code: "FR",    coefficient: 4, hoursPerWeek: 5 },
  { name: "Mathématiques",       code: "MATHS", coefficient: 4, hoursPerWeek: 4 },
  { name: "SVTEEHB",             code: "SVT",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Physique",            code: "PHY",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Chimie",              code: "CHIM",  coefficient: 2, hoursPerWeek: 2 },
  { name: "Histoire-Géographie", code: "HG",    coefficient: 2, hoursPerWeek: 3 },
  { name: "Anglais",             code: "ANG",   coefficient: 2, hoursPerWeek: 3 },
  { name: "LV2",                 code: "LV2",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Éducation Civique",   code: "EC",    coefficient: 1, hoursPerWeek: 1 },
  { name: "EPS",                 code: "EPS",   coefficient: 1, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
]

const TECH_FR_SUBJECTS: SubjectDef[] = [
  { name: "Français",            code: "FR",    coefficient: 2, hoursPerWeek: 3 },
  { name: "Mathématiques",       code: "MATHS", coefficient: 2, hoursPerWeek: 3 },
  { name: "Anglais",             code: "ANG",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Sciences Physiques",  code: "SP",    coefficient: 2, hoursPerWeek: 2 },
  { name: "Éducation Civique",   code: "EC",    coefficient: 1, hoursPerWeek: 1 },
  { name: "EPS",                 code: "EPS",   coefficient: 1, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
  { name: "Technologie",         code: "TECH",  coefficient: 6, hoursPerWeek: 6, subjectType: 'MIXED' },
  { name: "Travaux Pratiques",   code: "TP",    coefficient: 6, hoursPerWeek: 6, subjectType: 'PRACTICAL' },
]

const SAR_CFM_SUBJECTS: SubjectDef[] = [
  { name: "Pratique Atelier",         code: "PRATIQUE", coefficient: 6, hoursPerWeek: 6, subjectType: 'PRACTICAL' },
  { name: "Calcul Professionnel",      code: "CALCUL",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Français / Communication", code: "FR",       coefficient: 2, hoursPerWeek: 2 },
  { name: "Éducation Physique",        code: "EPS",      coefficient: 1, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
]

// barèmes APC — total = 300 pts (source: grille officielle MINEDUB)
const PRIMAIRE_FR_SUBJECTS: SubjectDef[] = [
  { name: "Français",                code: "FR",    coefficient: 30, hoursPerWeek: 5 },
  { name: "Anglais",                 code: "ANG",   coefficient: 30, hoursPerWeek: 3 },
  { name: "Mathématiques",           code: "MATHS", coefficient: 40, hoursPerWeek: 5 },
  { name: "Sciences et Technologie", code: "SCI",   coefficient: 40, hoursPerWeek: 3 },
  { name: "TIC",                     code: "TIC",   coefficient: 40, hoursPerWeek: 2 },
  { name: "Histoire-Géographie",     code: "HG",    coefficient: 20, hoursPerWeek: 2 },
  { name: "Éducation Morale + EPS",  code: "MEPS",  coefficient: 20, hoursPerWeek: 2 },
  { name: "Éducation Artistique",    code: "EA",    coefficient: 20, hoursPerWeek: 1 },
  { name: "Sport",                   code: "SPORT", coefficient: 20, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
  { name: "Développement Personnel", code: "DP",    coefficient: 20, hoursPerWeek: 1 },
  { name: "Langue Nationale",        code: "LN",    coefficient: 20, hoursPerWeek: 1 },
]

const EN_SEC_SUBJECTS: SubjectDef[] = [
  { name: "English Language",             code: "ENG",   coefficient: 4, hoursPerWeek: 5 },
  { name: "French",                       code: "FR",    coefficient: 3, hoursPerWeek: 3 },
  { name: "Mathematics",                  code: "MATHS", coefficient: 4, hoursPerWeek: 4 },
  { name: "Biology",                      code: "BIO",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Chemistry",                    code: "CHEM",  coefficient: 2, hoursPerWeek: 2 },
  { name: "Physics",                      code: "PHY",   coefficient: 2, hoursPerWeek: 2 },
  { name: "Geography",                    code: "GEO",   coefficient: 2, hoursPerWeek: 2 },
  { name: "History",                      code: "HIST",  coefficient: 2, hoursPerWeek: 2 },
  { name: "Computer Science",             code: "CS",    coefficient: 2, hoursPerWeek: 2 },
  { name: "Citizenship Education",        code: "CE",    coefficient: 1, hoursPerWeek: 1 },
  { name: "Physical & Health Education",  code: "PHE",   coefficient: 1, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
]

// barèmes variables par école — valeurs indicatives terrain
const PRIMARY_EN_SUBJECTS: SubjectDef[] = [
  { name: "English Language",            code: "ENG",   coefficient: 40, hoursPerWeek: 5 },
  { name: "French",                      code: "FR",    coefficient: 30, hoursPerWeek: 3 },
  { name: "Mathematics",                 code: "MATHS", coefficient: 40, hoursPerWeek: 4 },
  { name: "Sciences",                    code: "SCI",   coefficient: 20, hoursPerWeek: 2 },
  { name: "Social Studies",              code: "SS",    coefficient: 20, hoursPerWeek: 2 },
  { name: "Religious Studies",           code: "RS",    coefficient: 15, hoursPerWeek: 1 },
  { name: "Physical & Health Education", code: "PHE",   coefficient: 10, hoursPerWeek: 2, subjectType: 'PRACTICAL' },
  { name: "Arts & Crafts",               code: "AC",    coefficient: 10, hoursPerWeek: 1, subjectType: 'PRACTICAL' },
]

// fr = sujets section FR (aussi utilisé pour templates purement FR)
// en = sujets section EN (bilingual + purement EN)
const TEMPLATE_SUBJECTS: Record<string, { fr?: SubjectDef[]; en?: SubjectDef[] }> = {
  LYCEE_FR:           { fr: FR_SEC_SUBJECTS },
  CES_FR:             { fr: FR_SEC_SUBJECTS },
  PRIVE_FR:           { fr: FR_SEC_SUBJECTS },
  LYCEE_TECHNIQUE_FR: { fr: TECH_FR_SUBJECTS },
  CETIC:              { fr: TECH_FR_SUBJECTS },
  SAR_SM:             { fr: SAR_CFM_SUBJECTS },
  CFM:                { fr: SAR_CFM_SUBJECTS },
  PRIMAIRE_FR:        { fr: PRIMAIRE_FR_SUBJECTS },
  MATERNELLE_FR:      {},
  GHS_EN:             { en: EN_SEC_SUBJECTS },
  GSS_EN:             { en: EN_SEC_SUBJECTS },
  PRIVE_EN:           { en: EN_SEC_SUBJECTS },
  PRIMARY_EN:         { en: PRIMARY_EN_SUBJECTS },
  NURSERY_EN:         {},
  LYCEE_BILINGUE:     { fr: FR_SEC_SUBJECTS,       en: EN_SEC_SUBJECTS },
  PRIMARY_BILINGUAL:  { fr: PRIMAIRE_FR_SUBJECTS,  en: PRIMARY_EN_SUBJECTS },
  COMPLEXE_SCOLAIRE:  {},
}

// ─── SUBJECT PACKS ──────────────────────────────────────────────────────────
// Packs de matières par défaut qu'un Admin peut accepter en un clic
// lors de l'activation de son école. Stockés dans SchoolTemplate.config.subjectPacks.

type SubjectPackItem = { name: string; code: string; coefficient: number; optional?: boolean }

const CYCLE1_FR_PACK: SubjectPackItem[] = [
  { name: "Français",            code: "FR",    coefficient: 4 },
  { name: "Mathématiques",       code: "MATHS", coefficient: 4 },
  { name: "Sciences",            code: "SCI",   coefficient: 2 },
  { name: "Histoire-Géographie", code: "HG",    coefficient: 2 },
  { name: "Anglais LV1",         code: "ANG",   coefficient: 2 },
  { name: "Éducation Civique",   code: "EC",    coefficient: 1 },
  { name: "EPS",                 code: "EPS",   coefficient: 1 },
  { name: "LV2",                 code: "LV2",   coefficient: 2, optional: true },
]

const PRIMAIRE_FR_BASE_PACK: SubjectPackItem[] = [
  { name: "Français",      code: "FR",    coefficient: 30 },
  { name: "Mathématiques", code: "MATHS", coefficient: 40 },
  { name: "Éveil",         code: "EVEIL", coefficient: 20 },
  { name: "EPS",           code: "EPS",   coefficient: 20 },
  { name: "Religion",      code: "REL",   coefficient: 0,  optional: true },
]

const PRIMAIRE_FR_CE1_PLUS_PACK: SubjectPackItem[] = [
  { name: "Sciences/TIC",        code: "SCI",   coefficient: 40 },
  { name: "Histoire",            code: "HIST",  coefficient: 20 },
  { name: "Géographie",          code: "GEO",   coefficient: 20 },
  { name: "Langue Nationale",    code: "LN",    coefficient: 20 },
]

const TEMPLATE_SUBJECT_PACKS: Record<string, { cycle1?: SubjectPackItem[]; cycle2?: SubjectPackItem[]; primaire?: SubjectPackItem[]; primaireCE1Plus?: SubjectPackItem[] }> = {
  LYCEE_FR:           { cycle1: CYCLE1_FR_PACK, cycle2: undefined }, // cycle2 = BacCoefficients au moment de l'activation
  PRIVE_FR:           { cycle1: CYCLE1_FR_PACK, cycle2: undefined },
  CES_FR:             { cycle1: CYCLE1_FR_PACK },
  PRIMAIRE_FR:        { primaire: PRIMAIRE_FR_BASE_PACK, primaireCE1Plus: PRIMAIRE_FR_CE1_PLUS_PACK },
  MATERNELLE_FR:      {},
  LYCEE_TECHNIQUE_FR: {},
  CETIC:              {},
  SAR_SM:             {},
  CFM:                {},
  GHS_EN:             {},
  GSS_EN:             {},
  PRIVE_EN:           {},
  PRIMARY_EN:         {},
  NURSERY_EN:         {},
  LYCEE_BILINGUE:     { cycle1: CYCLE1_FR_PACK, cycle2: undefined },
  PRIMARY_BILINGUAL:  { primaire: PRIMAIRE_FR_BASE_PACK, primaireCE1Plus: PRIMAIRE_FR_CE1_PLUS_PACK },
  COMPLEXE_SCOLAIRE:  {},
}

// ─── FORMULES DE NOTES PAR DÉFAUT ────────────────────────────────────────────
// isDefault=true + schoolId null → règles système, non liées à une école.
// Appliquées automatiquement à l'activation selon le type de template.

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
  {
    id: "default-technique-fr",
    label: "Formule technique FR — Éval 1 + Éval 2 (50/50 par trimestre)",
    // Source : LYCEE_TECHNIQUE_FR, CETIC — 2 évaluations séparées par trimestre
    // Notes théorie et pratique saisies séparément (bulletin technique)
    evaluations: [
      { code: "EVAL1", label: "Évaluation 1", weight: 50, count: 1 },
      { code: "EVAL2", label: "Évaluation 2", weight: 50, count: 1 },
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
  {
    id: "default-apc-mentions",
    // Source : grille MINEDUB APC primaire — cotes sur /20
    rules: [
      { label: "Expert", min: 18,    max: 20    },
      { label: "Acquis", min: 15,    max: 17.99 },
      { label: "ECA",    min: 11,    max: 14.99 },
      { label: "NA",     min: 0,     max: 10.99 },
    ],
    isDefault: true,
  },
];

// ─── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 EduNexus — Phase 0 seed\n");

  // 0. SchoolTemplates (17) — seed FIRST to satisfy FK constraints on reference data
  console.log("\n🏫 Seeding SchoolTemplates...");
  for (const t of schoolTemplates) {
    const subs = TEMPLATE_SUBJECTS[t.code] ?? {}
    const packs = TEMPLATE_SUBJECT_PACKS[t.code] ?? {}
    const mergedConfig = {
      ...(t.config as any),
      ...(subs.fr ? { defaultSubjects: subs.fr } : {}),
      ...(subs.en ? { defaultSubjectsEN: subs.en } : {}),
      ...(Object.keys(packs).length > 0 ? { subjectPacks: packs } : {}),
    }
    await prisma.schoolTemplate.upsert({
      where:  { code: t.code },
      update: { config: mergedConfig as any, name: t.name },
      create: {
        code: t.code,
        name: t.name,
        subsystem: t.subsystem,
        educationType: t.educationType,
        level: t.level,
        ownership: t.ownership,
        config: mergedConfig as any,
      },
    });
    const nbSubj = (subs.fr?.length ?? 0) + (subs.en?.length ?? 0);
    console.log(`   ✓ ${t.code}${nbSubj ? ` (${nbSubj} matières)` : ''}`);
  }
  console.log(`   → ${schoolTemplates.length} templates seeded`);

  // 0b. Sentinel template pour les données référençant "__ALL__"
  await prisma.schoolTemplate.upsert({
    where:  { code: "__ALL__" },
    update: { name: "Sentinel (tous templates)" },
    create: { code: "__ALL__", name: "Sentinel (tous templates)", subsystem: "FRANCOPHONE", educationType: "GENERAL", level: "SECONDARY", config: {} },
  });

  // ─── 1. Données de référence (FK → SchoolTemplate) ─────────────────────────

  // 1a. BacCoefficients
  console.log("\n🎓 Seeding BacCoefficients...");
  for (const coeff of bacCoefficients) {
    await prisma.bacCoefficient.upsert({
      where: {
        subjectName_serie_niveau_templateCode: {
          subjectName: coeff.subjectName,
          serie: coeff.serie,
          niveau: coeff.niveau,
          templateCode: coeff.templateCode,
        },
      },
      update: {
        coefficient: coeff.coefficient,
        groupe: coeff.groupe,
        source: coeff.source,
        isOfficialMinesec: coeff.isOfficialMinesec,
      },
      create: coeff,
    });
  }
  console.log(`   ✓ ${bacCoefficients.length} entrées`);

  // 1b. CycleCoefficients — 1er cycle français (6e→3e), données officielles MINESEC
  const CYCLE_COEFFS: { templateCode: string; classLevel: string; subjectName: string; coefficient: number; weeklyPeriods?: number; filiere: string }[] = [];
  const CYCLE1_TEMPLATES = ['LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'LYCEE_BILINGUE'];

  // ── FR_GENERAL (programme général) ─────────────────────────────────────────
  // Matières pour 6e/5e
  const GEN_65: { name: string; coeff: number; hours: number }[] = [
    { name: 'Anglais',                              coeff: 3, hours: 3 },
    { name: 'Français',                              coeff: 6, hours: 6 },
    { name: 'Lettres classiques (Latin/Grec)',       coeff: 2, hours: 2 },
    { name: 'Éducation à la Citoyenneté et à la Morale',                                    coeff: 2, hours: 2 },
    { name: 'Histoire',                              coeff: 2, hours: 2 },
    { name: 'Géographie',                            coeff: 2, hours: 2 },
    { name: 'Informatique',                           coeff: 2, hours: 2 },
    { name: 'Mathématiques',                          coeff: 4, hours: 4 },
    { name: 'Sciences',                               coeff: 2, hours: 2 },
    { name: 'Éducation Artistique et Culturelle',     coeff: 1, hours: 1 },
    { name: 'Cultures Nationales',                    coeff: 1, hours: 1 },
    { name: 'Langues Nationales',                     coeff: 1, hours: 1 },
    { name: 'EPS',                                    coeff: 2, hours: 2 },
    { name: 'Travail Manuel',                         coeff: 1, hours: 2 },
  ];
  // Matières pour 4e/3e
  const GEN_43: { name: string; coeff: number; hours: number }[] = [
    { name: 'Anglais',                              coeff: 3, hours: 3 },
    { name: 'Français',                              coeff: 4, hours: 4 },
    { name: 'LV2',                                    coeff: 2, hours: 2 },
    { name: 'Lettres classiques (Latin/Grec)',       coeff: 1, hours: 1 },
    { name: 'Éducation à la Citoyenneté et à la Morale',                                    coeff: 2, hours: 2 },
    { name: 'Histoire',                              coeff: 2, hours: 2 },
    { name: 'Géographie',                            coeff: 2, hours: 2 },
    { name: 'Informatique',                           coeff: 2, hours: 2 },
    { name: 'Mathématiques',                          coeff: 4, hours: 4 },
    { name: 'Physique-Chimie-Technologie',            coeff: 2, hours: 2 },
    { name: 'SVTEEHB',                                coeff: 2, hours: 2 },
    { name: 'Éducation Artistique et Culturelle',     coeff: 1, hours: 1 },
    { name: 'Cultures Nationales',                    coeff: 1, hours: 1 },
    { name: 'Langues Nationales',                     coeff: 1, hours: 1 },
    { name: 'EPS',                                    coeff: 2, hours: 2 },
    { name: 'Travail Manuel',                         coeff: 1, hours: 2 },
  ];

  // ── FR_PEBS (Programme d'Éducation Bilingue Spécial) ──────────────────────
  const PEBS_65: { name: string; coeff: number; hours: number }[] = [
    { name: 'Intensive English',                      coeff: 5, hours: 5 },
    { name: 'Français',                              coeff: 4, hours: 4 },
    { name: 'Lettres classiques (Latin/Grec)',       coeff: 2, hours: 2 },
    { name: 'Citizenship Education',                 coeff: 2, hours: 2 },
    { name: 'Géographie',                            coeff: 2, hours: 2 },
    { name: 'Histoire',                               coeff: 2, hours: 2 },
    { name: 'Informatique',                           coeff: 2, hours: 2 },
    { name: 'Mathématiques',                          coeff: 4, hours: 4 },
    { name: 'Sciences',                               coeff: 2, hours: 2 },
    { name: 'Éducation Artistique et Culturelle',     coeff: 1, hours: 1 },
    { name: 'Cultures Nationales',                    coeff: 1, hours: 1 },
    { name: 'Langues Nationales',                     coeff: 1, hours: 1 },
    { name: 'Sport and Physical Education',           coeff: 2, hours: 2 },
    { name: 'Travail Manuel',                         coeff: 1, hours: 2 },
  ];
  const PEBS_43: { name: string; coeff: number; hours: number }[] = [
    { name: 'Intensive English',                      coeff: 5, hours: 5 },
    { name: 'Français',                              coeff: 4, hours: 4 },
    { name: 'LV2',                                    coeff: 2, hours: 2 },
    { name: 'Lettres classiques (Latin/Grec)',       coeff: 1, hours: 1 },
    { name: 'Citizenship Education',                 coeff: 2, hours: 2 },
    { name: 'Géographie',                            coeff: 1, hours: 1 },
    { name: 'Histoire',                               coeff: 1, hours: 1 },
    { name: 'Informatique',                           coeff: 2, hours: 2 },
    { name: 'Mathématiques',                          coeff: 4, hours: 4 },
    { name: 'Physique-Chimie-Technologie',            coeff: 2, hours: 2 },
    { name: 'SVTEEHB',                                coeff: 2, hours: 2 },
    { name: 'Éducation Artistique et Culturelle',     coeff: 1, hours: 1 },
    { name: 'Cultures Nationales',                    coeff: 1, hours: 1 },
    { name: 'Langues Nationales',                     coeff: 1, hours: 1 },
    { name: 'Sport and Physical Education',           coeff: 2, hours: 2 },
    { name: 'Travail Manuel',                         coeff: 1, hours: 2 },
  ];

  for (const tc of CYCLE1_TEMPLATES) {
    for (const level of ['6e', '5e'] as const) {
      for (const s of GEN_65) {
        CYCLE_COEFFS.push({ templateCode: tc, classLevel: level, subjectName: s.name, coefficient: s.coeff, weeklyPeriods: s.hours, filiere: 'FR_GENERAL' });
      }
      for (const s of PEBS_65) {
        CYCLE_COEFFS.push({ templateCode: tc, classLevel: level, subjectName: s.name, coefficient: s.coeff, weeklyPeriods: s.hours, filiere: 'FR_PEBS' });
      }
    }
    for (const level of ['4e', '3e'] as const) {
      for (const s of GEN_43) {
        CYCLE_COEFFS.push({ templateCode: tc, classLevel: level, subjectName: s.name, coefficient: s.coeff, weeklyPeriods: s.hours, filiere: 'FR_GENERAL' });
      }
      for (const s of PEBS_43) {
        CYCLE_COEFFS.push({ templateCode: tc, classLevel: level, subjectName: s.name, coefficient: s.coeff, weeklyPeriods: s.hours, filiere: 'FR_PEBS' });
      }
    }
  }
  console.log(`\n📊 Seeding CycleCoefficients (${CYCLE1_TEMPLATES.length} templates × GENERAL 6e/5e:${GEN_65.length} + 4e/3e:${GEN_43.length} + PEBS 6e/5e:${PEBS_65.length} + 4e/3e:${PEBS_43.length} matières)...`);
  for (const cc of CYCLE_COEFFS) {
    await prisma.cycleCoefficient.upsert({
      where: {
        templateCode_classLevel_subjectName_filiere: {
          templateCode: cc.templateCode,
          classLevel: cc.classLevel,
          subjectName: cc.subjectName,
          filiere: cc.filiere,
        },
      },
      update: { coefficient: cc.coefficient, weeklyPeriods: cc.weeklyPeriods },
      create: cc,
    });
  }
  console.log(`   ✓ ${CYCLE_COEFFS.length} entrées`);

  // 1c. AnglophoneSubjectLoad — coefficients + horaires hebdo (Form1→UpperSixth)
  console.log("\n📚 Seeding AnglophoneSubjectLoad...");
  const LEVEL_SHORT_TO_FULL: Record<string, string> = {
    F1: "Form1", F2: "Form2", F3: "Form3", F4: "Form4", F5: "Form5",
    L6: "LowerSixth", U6: "UpperSixth",
  };
  const ASL_TEMPLATES = ['GHS_EN', 'GSS_EN', 'PRIVE_EN', 'LYCEE_BILINGUE'];

  // ── EN_GENERAL (programme général) ─────────────────────────────────────────
  const ASL_DATA_GEN: Record<string, Record<string, { c: number; w: number }>> = {
    "English Language":       { F1:{c:3,w:5}, F2:{c:3,w:5}, F3:{c:3,w:5}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Literature in English":  { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "French":                 { F1:{c:3,w:5}, F2:{c:3,w:5}, F3:{c:3,w:5}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Geography":              { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Economics":              {                                     F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "History":                { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Citizenship Education":  { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:5,w:5}, F5:{c:5,w:5} },
    "Commerce":               {                                                       F4:{c:5,w:5}, F5:{c:5,w:5} },
    "Biology":                { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Chemistry":              { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Mathematics":            { F1:{c:3,w:5}, F2:{c:3,w:5}, F3:{c:3,w:5}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Physics":                { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:4}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Computer Science":       { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Geology":                {                                                                  F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Food and Nutrition":     { F1:{c:2,w:3}, F2:{c:2,w:3}, F3:{c:2,w:3}, F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6}, U6:{c:5,w:6} },
    "Human Biology":          {                                                                  F4:{c:5,w:5}, F5:{c:5,w:5} },
    "Additional Mathematics": {                                                                  F4:{c:5,w:5}, F5:{c:5,w:5}, L6:{c:5,w:6} },
    "Logic":                  {                                               F3:{c:2,w:2}, F4:{c:5,w:5}, F5:{c:5,w:5} },
    "Philosophy":             {                                                                                             L6:{c:5,w:6}, U6:{c:5,w:6} },
  };

  // ── EN_PEBS (Programme d'Éducation Bilingue Spécial, Form1→Form5 uniquement) ─
  const ASL_DATA_PEBS: Record<string, Record<string, { c: number; w: number }>> = {
    "Français intensif (Langue)":     { F1:{c:3,w:3}, F2:{c:3,w:3}, F3:{c:3,w:3}, F4:{c:3,w:3}, F5:{c:3,w:3} },
    "Français intensif (Littérature)":{ F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
    "English Language":               { F1:{c:4,w:4}, F2:{c:4,w:4}, F3:{c:4,w:4}, F4:{c:4,w:4}, F5:{c:4,w:4} },
    "Economics":                      {                                     F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
    "Éducation à la Citoyenneté et à la Morale":                            { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
    "Geography":                      { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
    "History":                        { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
    "Computer Sciences":              { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:3,w:3}, F4:{c:3,w:3}, F5:{c:3,w:3} },
    "Biology":                        { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
    "Chemistry":                      { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
    "Food and Nutrition":             {                                     F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
    "Home Economics":                 { F1:{c:2,w:2}, F2:{c:2,w:2} },
    "Mathematics":                    { F1:{c:4,w:4}, F2:{c:4,w:4}, F3:{c:4,w:4}, F4:{c:4,w:4}, F5:{c:4,w:4} },
    "Physics":                        { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:3,w:3}, F5:{c:3,w:3} },
    "Geology":                        {                                                                  F4:{c:3,w:3}, F5:{c:3,w:3} },
    "Logic":                          {                                               F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
    "Sport and Physical Education":   { F1:{c:2,w:2}, F2:{c:2,w:2}, F3:{c:2,w:2}, F4:{c:2,w:2}, F5:{c:2,w:2} },
    "Manual Labour":                  { F1:{c:1,w:1}, F2:{c:1,w:1}, F3:{c:1,w:1}, F4:{c:1,w:1}, F5:{c:1,w:1} },
  };

  const aslEntries: { templateCode: string; classLevel: string; subjectName: string; coefficient: number; weeklyPeriods: number; filiere: string }[] = [];
  for (const tc of ASL_TEMPLATES) {
    // EN_GENERAL
    for (const [subjectName, levels] of Object.entries(ASL_DATA_GEN)) {
      for (const [shortLevel, data] of Object.entries(levels)) {
        const classLevel = LEVEL_SHORT_TO_FULL[shortLevel];
        if (!classLevel) continue;
        if (tc === 'GSS_EN' && (classLevel === 'LowerSixth' || classLevel === 'UpperSixth')) continue;
        aslEntries.push({ templateCode: tc, classLevel, subjectName, coefficient: data.c, weeklyPeriods: data.w, filiere: 'EN_GENERAL' });
      }
    }
    // EN_PEBS
    for (const [subjectName, levels] of Object.entries(ASL_DATA_PEBS)) {
      for (const [shortLevel, data] of Object.entries(levels)) {
        const classLevel = LEVEL_SHORT_TO_FULL[shortLevel];
        if (!classLevel) continue;
        if (tc === 'GSS_EN' && (classLevel === 'LowerSixth' || classLevel === 'UpperSixth')) continue;
        aslEntries.push({ templateCode: tc, classLevel, subjectName, coefficient: data.c, weeklyPeriods: data.w, filiere: 'EN_PEBS' });
      }
    }
  }
  for (const entry of aslEntries) {
    await prisma.anglophoneSubjectLoad.upsert({
      where: {
        templateCode_classLevel_subjectName_filiere: {
          templateCode: entry.templateCode,
          classLevel: entry.classLevel,
          subjectName: entry.subjectName,
          filiere: entry.filiere,
        },
      },
      update: { coefficient: entry.coefficient, weeklyPeriods: entry.weeklyPeriods },
      create: entry,
    });
  }
  console.log(`   ✓ ${aslEntries.length} entrées`);

  // 1d. OLevelSubject — codes d'examens officiels GCE O-Level (P2)
  console.log("\n📋 Seeding OLevelSubject...");
  const O_LEVEL_CODES: { subjectName: string; examCode: string }[] = [
    { subjectName: "English Language",        examCode: "0530" },
    { subjectName: "Literature in English",   examCode: "0531" },
    { subjectName: "French",                  examCode: "0570" },
    { subjectName: "Geography",               examCode: "0460" },
    { subjectName: "Economics",               examCode: "0455" },
    { subjectName: "History",                 examCode: "0470" },
    { subjectName: "Mathematics",             examCode: "0705" },
    { subjectName: "Additional Mathematics",  examCode: "0606" },
    { subjectName: "Biology",                 examCode: "0650" },
    { subjectName: "Chemistry",               examCode: "0651" },
    { subjectName: "Physics",                 examCode: "0652" },
    { subjectName: "Computer Science",        examCode: "0653" },
    { subjectName: "Geology",                 examCode: "0654" },
    { subjectName: "Food and Nutrition",      examCode: "0648" },
    { subjectName: "Human Biology",           examCode: "0655" },
    { subjectName: "Commerce",                examCode: "0710" },
    { subjectName: "Citizenship Education",   examCode: "0533" },
    { subjectName: "Logic",                   examCode: "0535" },
  ];
  let oLevelCount = 0;
  for (const entry of O_LEVEL_CODES) {
    await prisma.oLevelSubject.upsert({
      where:  { subjectName: entry.subjectName },
      update: { examCode: entry.examCode },
      create: entry,
    });
    oLevelCount++;
  }
  console.log(`   ✓ ${oLevelCount} entrées`);

  // 1e. ALevelSubject — codes d'examens officiels GCE A-Level (P2)
  console.log("\n📋 Seeding ALevelSubject...");
  const A_LEVEL_CODES: { subjectName: string; examCode: string }[] = [
    { subjectName: "English Language",        examCode: "9070" },
    { subjectName: "Literature in English",   examCode: "9071" },
    { subjectName: "French",                  examCode: "9090" },
    { subjectName: "Geography",               examCode: "9095" },
    { subjectName: "Economics",               examCode: "9080" },
    { subjectName: "History",                 examCode: "9091" },
    { subjectName: "Mathematics",             examCode: "9231" },
    { subjectName: "Additional Mathematics",  examCode: "9232" },
    { subjectName: "Biology",                 examCode: "9260" },
    { subjectName: "Chemistry",               examCode: "9261" },
    { subjectName: "Physics",                 examCode: "9262" },
    { subjectName: "Computer Science",        examCode: "9263" },
    { subjectName: "Geology",                 examCode: "9265" },
    { subjectName: "Food and Nutrition",      examCode: "9248" },
    { subjectName: "Philosophy",              examCode: "9074" },
  ];
  let aLevelCount = 0;
  for (const entry of A_LEVEL_CODES) {
    await prisma.aLevelSubject.upsert({
      where:  { subjectName: entry.subjectName },
      update: { examCode: entry.examCode },
      create: entry,
    });
    aLevelCount++;
  }
  console.log(`   ✓ ${aLevelCount} entrées`);

  // 1f. AnglophoneStreamCombination — combinaisons indicatives A1-A5 / S1-S5 (P3)
  console.log("\n🧪 Seeding AnglophoneStreamCombination...");
  const STREAM_COMBOS: { filiere: string; type: string; coreSubjects: string[]; electiveGroup?: string[][]; description: string }[] = [
    {
      filiere: "A1", type: "ARTS",
      coreSubjects: ["English Language", "Literature in English", "French", "History", "Geography"],
      electiveGroup: [["Economics", "Logic"], ["Computer Science", "Food and Nutrition"]],
      description: "Lettres classiques — langues + littérature + histoire-géo",
    },
    {
      filiere: "A2", type: "ARTS",
      coreSubjects: ["English Language", "Literature in English", "French", "History"],
      electiveGroup: [["Geography", "Economics"], ["Logic", "Computer Science"]],
      description: "Lettres modernes — littérature + langues",
    },
    {
      filiere: "A3", type: "ARTS",
      coreSubjects: ["English Language", "French", "History", "Geography"],
      electiveGroup: [["Literature in English", "Economics"], ["Food and Nutrition", "Logic"]],
      description: "Sciences sociales — histoire-géo + langues",
    },
    {
      filiere: "A4", type: "ARTS",
      coreSubjects: ["English Language", "French", "Geography", "Economics"],
      electiveGroup: [["History", "Literature in English"], ["Commerce", "Logic"]],
      description: "Économie et commerce",
    },
    {
      filiere: "A5", type: "ARTS",
      coreSubjects: ["English Language", "French", "Literature in English"],
      electiveGroup: [["History", "Geography"], ["Economics", "Logic", "Food and Nutrition"]],
      description: "Lettres et arts appliqués",
    },
    {
      filiere: "S1", type: "SCIENCES",
      coreSubjects: ["Mathematics", "Physics", "Chemistry", "Biology", "English Language"],
      electiveGroup: [["Additional Mathematics", "Computer Science"], ["Geology", "Food and Nutrition"]],
      description: "Sciences pures — Maths + PC + SVT",
    },
    {
      filiere: "S2", type: "SCIENCES",
      coreSubjects: ["Mathematics", "Physics", "Chemistry", "English Language"],
      electiveGroup: [["Biology", "Computer Science"], ["Geology", "Additional Mathematics"]],
      description: "Sciences physiques et technologies",
    },
    {
      filiere: "S3", type: "SCIENCES",
      coreSubjects: ["Mathematics", "Biology", "Chemistry", "English Language"],
      electiveGroup: [["Physics", "Computer Science"], ["Food and Nutrition", "Human Biology"]],
      description: "Sciences de la vie et de la terre",
    },
    {
      filiere: "S4", type: "SCIENCES",
      coreSubjects: ["Mathematics", "Physics", "Computer Science", "English Language"],
      electiveGroup: [["Chemistry", "Additional Mathematics"], ["Commerce", "Economics"]],
      description: "Informatique et sciences numériques",
    },
  ];
  let streamCount = 0;
  for (const sc of STREAM_COMBOS) {
    await prisma.anglophoneStreamCombination.upsert({
      where:  { filiere: sc.filiere },
      update: {
        type: sc.type,
        coreSubjects: sc.coreSubjects,
        electiveGroup: sc.electiveGroup ?? null,
        description: sc.description,
      },
      create: {
        filiere: sc.filiere,
        type: sc.type,
        coreSubjects: sc.coreSubjects,
        electiveGroup: sc.electiveGroup ?? null,
        description: sc.description,
      },
    });
    streamCount++;
  }
  console.log(`   ✓ ${streamCount} entrées`);

  // 1g. OLevelGrade — barème notation GCE O-Level A→U (P4)
  console.log("\n📊 Seeding OLevelGrade (barème A→U)...");
  const O_LEVEL_GRADES: { grade: string; minScore: number; maxScore: number; description: string }[] = [
    { grade: "A", minScore: 75, maxScore: 100, description: "Excellent" },
    { grade: "B", minScore: 65, maxScore: 74.99, description: "Very Good" },
    { grade: "C", minScore: 55, maxScore: 64.99, description: "Good" },
    { grade: "D", minScore: 45, maxScore: 54.99, description: "Credit" },
    { grade: "E", minScore: 40, maxScore: 44.99, description: "Pass" },
    { grade: "F", minScore: 30, maxScore: 39.99, description: "Fail" },
    { grade: "U", minScore: 0, maxScore: 29.99, description: "Ungraded / Unclassified" },
  ];
  for (const g of O_LEVEL_GRADES) {
    await prisma.oLevelGrade.upsert({
      where:  { grade: g.grade },
      update: { minScore: g.minScore, maxScore: g.maxScore, description: g.description },
      create: g,
    });
  }
  console.log(`   ✓ ${O_LEVEL_GRADES.length} entrées`);

  // 1h. ALevelGrade — barème notation GCE A-Level A→F (P4)
  console.log("\n📊 Seeding ALevelGrade (barème A→F)...");
  const A_LEVEL_GRADES: { grade: string; minScore: number; maxScore: number; description: string }[] = [
    { grade: "A", minScore: 80, maxScore: 100, description: "Excellent" },
    { grade: "B", minScore: 70, maxScore: 79.99, description: "Very Good" },
    { grade: "C", minScore: 60, maxScore: 69.99, description: "Good" },
    { grade: "D", minScore: 50, maxScore: 59.99, description: "Credit" },
    { grade: "E", minScore: 40, maxScore: 49.99, description: "Pass" },
    { grade: "F", minScore: 0, maxScore: 39.99, description: "Fail" },
  ];
  for (const g of A_LEVEL_GRADES) {
    await prisma.aLevelGrade.upsert({
      where:  { grade: g.grade },
      update: { minScore: g.minScore, maxScore: g.maxScore, description: g.description },
      create: g,
    });
  }
  console.log(`   ✓ ${A_LEVEL_GRADES.length} entrées`);

  // 2. Autres seeds (pas de FK vers SchoolTemplate)
  // 3. École système de référence pour les données globales
  // Certains modèles exigent désormais un schoolId non nul au niveau DB.
  const systemSchool = await prisma.school.upsert({
    where: { subdomain: "system" },
    update: {},
    create: {
      name: "École système EduNexus",
      subdomain: "system",
      templateCode: "LYCEE_FR",
    },
  });

  console.log(`   ✓ School système ${systemSchool.id}`);

  // 4. GradeFormulas et MentionRules par défaut
  console.log("\n📐 Seeding default GradeFormulas and MentionRules...");

  for (const formula of defaultGradeFormulas) {
    await prisma.gradeFormula.upsert({
      where:  { id: formula.id },
      update: {
        schoolId:    null,   // règle système — pas liée à une école
        label:       formula.label,
        evaluations: formula.evaluations as any,
        isDefault:   formula.isDefault,
      },
      create: {
        id:          formula.id,
        schoolId:    null,
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
        schoolId:  null,   // règle système — pas liée à une école
        rules:     rule.rules as any,
        isDefault: rule.isDefault,
      },
      create: {
        id:        rule.id,
        schoolId:  null,
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