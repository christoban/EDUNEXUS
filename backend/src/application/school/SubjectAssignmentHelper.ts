/**
 * Helpers pour l'assignation des matières et coefficients par classe.
 * Utilisé par ActiverEtablissementUseCase (activation) et
 * la route POST /api/v2/schools/:id/sync-subjects (rattrapage).
 */
import type { PrismaClient } from '@prisma/client';

type DbClient = Pick<PrismaClient, 'subject' | 'subjectCoefficient' | 'bacCoefficient' | 'cycleCoefficient' | 'anglophoneSubjectLoad'>;

export const CYCLE1_ORDER: ReadonlyArray<string> = ['6e', '5e', '4e', '3e'];
export const CYCLE2_LEVELS: ReadonlyArray<string> = ['2nde', '1ere', '1ère', 'Tle'];

export const NIVEAU_MAP: Readonly<Record<string, string>> = {
  '2nde': 'SECONDE',
  '1ere': 'PREMIERE',
  '1ère': 'PREMIERE',
  'Tle':  'TERMINALE',
};

/**
 * Parse le code série depuis le nom d'une classe de 2e cycle.
 * "1ère A4-Arabe" → "A4" ; "Tle C A" → "C" ; "6e A" → null
 */
export function parseSerie(className: string, level: string): string | null {
  if (!(CYCLE2_LEVELS as string[]).includes(level)) return null;
  const parts = className.split(' ');
  const raw = parts[1];
  if (!raw) return null;
  const dashIdx = raw.indexOf('-');
  return dashIdx >= 0 ? raw.slice(0, dashIdx) : raw;
}

// ─────────────────────────────────────────────
// Sous-ensembles Sixth Form (Arts / Sciences)
// Utilisés en complément des données DB pour filtrer
// les matières selon la filière de la classe.
// ─────────────────────────────────────────────
const TOUTES_MATIERES_SIXTH = [
  "English Language","Literature in English","French","Geography",
  "Economics","History","Biology","Chemistry","Mathematics","Physics",
  "Computer Science","Geology","Food and Nutrition",
  "Additional Mathematics","Philosophy"
]

const MATIERES_SIXTH_ARTS = [
  "English Language","Literature in English","French","History",
  "Geography","Economics","Philosophy","Additional Mathematics"
]

const MATIERES_SIXTH_SCIENCES = [
  "Mathematics","Physics","Chemistry","Biology",
  "Computer Science","Geology","Additional Mathematics"
]

/**
 * Crée le Subject s'il n'existe pas encore (par nom, dans l'école).
 * Retourne l'id dans tous les cas.
 */
export async function getOrCreateSubject(
  db: DbClient,
  schoolId: string,
  name: string,
  coefficient: number,
  subjectByName: Map<string, string>,
  subjectCountRef: { value: number },
  hoursPerWeek: number = 2,
): Promise<string> {
  let id = subjectByName.get(name);
  if (!id) {
    const code = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    const created = await db.subject.create({
      data: { schoolId, name, code, coefficient, hoursPerWeek, subjectType: 'THEORETICAL' },
    });
    id = created.id;
    subjectByName.set(name, id);
    subjectCountRef.value++;
  }
  return id;
}

/**
 * Prisma ne supporte pas `null` dans le `where` d'un upsert sur une contrainte unique composée.
 * Pour les classes sans série (1er cycle, anglophone), on utilise findFirst + create/update.
 */
async function upsertSubjectCoeff(
  db: DbClient,
  schoolId: string,
  subjectId: string,
  classLevel: string,
  serieCode: string | null,
  coefficient: number,
): Promise<void> {
  if (serieCode !== null) {
    await db.subjectCoefficient.upsert({
      where: { schoolId_subjectId_classLevel_serieCode: { schoolId, subjectId, classLevel, serieCode } },
      update: { coefficient },
      create: { schoolId, subjectId, classLevel, serieCode, coefficient },
    });
    return;
  }
  // serieCode est null → upsert impossible, on fait findFirst + create/update
  const existing = await db.subjectCoefficient.findFirst({
    where: { schoolId, subjectId, classLevel, serieCode: null },
    select: { id: true },
  });
  if (existing) {
    await db.subjectCoefficient.update({ where: { id: existing.id }, data: { coefficient } });
  } else {
    await db.subjectCoefficient.create({ data: { schoolId, subjectId, classLevel, serieCode: null, coefficient } });
  }
}

/**
 * Crée les SubjectCoefficients pour une classe donnée.
 *
 * B.1 — 1er cycle (6e/5e/4e/3e) : pack fixe 8 matières + LV2 si applicable
 * B.2 — 2e cycle (2nde/1ère/Tle) : BacCoefficients, LV2→langue réelle pour A4
 * B.3 — Anglophone (Form1→U6) : coefficients officiels GCE Board
 *
 * Idempotent grâce aux upserts (safe à appeler plusieurs fois pour le même niveau).
 */
export async function assignerMatieresPourClasse(
  db: DbClient,
  classe: { name: string; level: string; filiere?: string | null },
  schoolId: string,
  config: Record<string, unknown>,
  isAnglophone: boolean,
  subjectByName: Map<string, string>,
  subjectCountRef: { value: number },
  templateCode: string = '',
): Promise<void> {
  const { level, filiere } = classe;

  async function assignerMatieresAnglophones() {
    if (!templateCode) return;
    const loads = await db.anglophoneSubjectLoad.findMany({
      where: { templateCode, classLevel: level, filiere: filiere ?? 'EN_GENERAL' },
    });
    if (loads.length === 0) return;

    const loadMap = new Map<string, { coefficient: number; weeklyPeriods: number | null }>();
    for (const load of loads) {
      loadMap.set(load.subjectName, { coefficient: load.coefficient, weeklyPeriods: load.weeklyPeriods });
    }

    let subjectNames: string[];
    if (level === "LowerSixth" || level === "UpperSixth") {
      if (classe.name.includes("Arts") || /\bA[1-4]\b/.test(classe.name)) {
        subjectNames = MATIERES_SIXTH_ARTS;
      } else if (classe.name.includes("Sciences") || /\bS[1-4]\b/.test(classe.name)) {
        subjectNames = MATIERES_SIXTH_SCIENCES;
      } else {
        subjectNames = Array.from(loadMap.keys());
      }
    } else {
      subjectNames = Array.from(loadMap.keys());
    }

    for (const nomMatiere of subjectNames) {
      const entry = loadMap.get(nomMatiere);
      if (!entry) continue;
      const subjectId = await getOrCreateSubject(db, schoolId, nomMatiere, entry.coefficient, subjectByName, subjectCountRef, entry.weeklyPeriods ?? 2);
      await upsertSubjectCoeff(db, schoolId, subjectId, level, null, entry.coefficient);
    }
  }

  // ── Fonction de rattrapage : crée SubjectCoefficients depuis toutes les matières ──
  // si aucune référence n'a matché (utile pour technique, primaire, etc.)
  async function ensureCoefficients() {
    const existing = await db.subjectCoefficient.findFirst({
      where: { schoolId, classLevel: level },
      select: { id: true },
    });
    if (!existing) {
      const allSubjects = await db.subject.findMany({ where: { schoolId } });
      for (const subj of allSubjects) {
        const subjectId = await getOrCreateSubject(db, schoolId, subj.name, subj.coefficient, subjectByName, subjectCountRef);
        await upsertSubjectCoeff(db, schoolId, subjectId, level, null, subj.coefficient);
      }
    }
  }

  // ── B.3 Anglophone ────────────────────────────────────────────────────────
  if (isAnglophone) {
    await assignerMatieresAnglophones();
    await ensureCoefficients();
    return;
  }

  // ── B.3b Bilingual EN section (LYCEE_BILINGUE classes with EN levels) ──
  if (templateCode === 'LYCEE_BILINGUE') {
    const enLoads = await db.anglophoneSubjectLoad.findMany({
      where: { templateCode, classLevel: level },
      select: { id: true },
      take: 1,
    });
    if (enLoads.length > 0) {
      await assignerMatieresAnglophones();
      await ensureCoefficients();
      return;
    }
  }

  // ── B.1 Premier cycle ─────────────────────────────────────────────────────
  const niveaux1er: string[] = (config['niveaux1erCycle'] as string[] | undefined) ?? [...CYCLE1_ORDER];
  if (niveaux1er.includes(level)) {
    const filiere1er = filiere ?? 'FR_GENERAL';
    const cycleCoeffs = await db.cycleCoefficient.findMany({
      where: { templateCode, classLevel: level, filiere: filiere1er },
    });
    if (cycleCoeffs.length > 0) {
      for (const cc of cycleCoeffs) {
        const subjectId = await getOrCreateSubject(db, schoolId, cc.subjectName, cc.coefficient, subjectByName, subjectCountRef, cc.weeklyPeriods ?? 2);
        await upsertSubjectCoeff(db, schoolId, subjectId, level, filiere1er, cc.coefficient);
      }
    }

    // LV2 optionnelle — uniquement le générique "LV2" depuis CycleCoefficients pour le 1er cycle
    await ensureCoefficients();
    return;
  }

  // ── B.2 Deuxième cycle ────────────────────────────────────────────────────
  const niveauBac = NIVEAU_MAP[level];
  if (!niveauBac) {
    await ensureCoefficients();
    return;
  }

  // "Tle A4-Arabe" → seriePart="A4", langueA4="Arabe"
  // "1ère C A"     → seriePart="C",  langueA4=null
  const nameParts = classe.name.split(' ');
  const serieRaw  = nameParts[1];
  if (!serieRaw) {
    await ensureCoefficients();
    return;
  }
  const dashIdx   = serieRaw.indexOf('-');
  const seriePart = dashIdx >= 0 ? serieRaw.slice(0, dashIdx) : serieRaw;
  const langueA4  = seriePart === 'A4' && dashIdx >= 0 ? serieRaw.slice(dashIdx + 1) : null;

  const bacCoeffs = await db.bacCoefficient.findMany({
    where: { serie: seriePart, niveau: niveauBac, templateCode: { in: [templateCode, '__ALL__'] } },
  });

  for (const bc of bacCoeffs) {
    // Pour A4 : "LV2" → langue réelle (ex. "Arabe")
    const subjectName = seriePart === 'A4' && bc.subjectName === 'LV2' && langueA4
      ? langueA4
      : bc.subjectName;

    const subjectId = await getOrCreateSubject(db, schoolId, subjectName, bc.coefficient, subjectByName, subjectCountRef);
    const effectiveSerieCode = seriePart === 'A4' ? serieRaw : seriePart;
    await upsertSubjectCoeff(db, schoolId, subjectId, level, effectiveSerieCode, bc.coefficient);
  }

  // Les coefficients BacCoefficient ont serieCode != null, donc le fallback avec
  // serieCode=null ne créera pas de doublons
  await ensureCoefficients();
}
