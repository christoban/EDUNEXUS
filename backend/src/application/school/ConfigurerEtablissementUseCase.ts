/**
 * APPLICATION LAYER — Use Case : Configurer un établissement depuis l'onboarding conversationnel (Phase 2)
 *
 * Reçoit l'OnboardingState collecté par le questionnaire IA, le traduit vers le format
 * `onboardingConfig` déjà compris par ActiverEtablissementUseCase, le persiste, puis
 * délègue toute la construction (atomique) au moteur déterministe existant.
 *
 * Choix d'architecture : Groq sert uniquement à la conversation + au récapitulatif côté
 * frontend. La création des classes / matières / coefficients reste 100% déterministe
 * (source de vérité MINESEC : CycleCoefficient / BacCoefficient). Aucun coefficient n'est
 * généré par le LLM.
 */
import type { PrismaClient } from '@prisma/client';
import { ActiverEtablissementUseCase } from './ActiverEtablissementUseCase';

// ── OnboardingState (miroir du frontend) ─────────────────────────────────────
export interface LV2OrgRule {
  level: string;
  organisation: 'UNIFORME' | 'MIXTE' | 'VARIABLE';
  langue?: string | null;
  note?: string;
}

export interface OnboardingState {
  schoolId: string;
  schoolName?: string;
  schoolType?: string;
  subSystem?: 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL';
  region?: string;

  cycles?: string[];        // 'MATERNELLE' | 'PRIMAIRE' | 'PREMIER_CYCLE' | 'SECOND_CYCLE' | 'TECHNIQUE'
  template?: string;        // code template MINESEC
  series?: string[];        // séries 2nd cycle francophones (A1..A4, C, D, E, TI, SH, AC)
  anglophoneStreams?: string[];       // types de stream anglophones : ARTS, SCIENCES, COMMERCIAL
  anglophoneCombinations?: string[];  // codes combinaisons : A1..A5, S1..S4
  technicalFilieres?: string[];
  primaryLevels?: string[];

  lv2Active?: boolean;
  lv2Languages?: string[];
  lv2Organisation?: LV2OrgRule[];

  academicYearStart?: string;
  academicYearEnd?: string;
  periodsCount?: number;      // 2 (semestres) | 3 (trimestres)
  sequencesPerPeriod?: number;

  directionRoles?: {
    proviseur?: string;
    censeur?: string;
    surveillantGeneral?: string;
    intendant?: string;
  };

  feesTypes?: string[];       // codes FeeType
  paymentTranches?: number;

  hasCanteen?: boolean;
  hasTransport?: boolean;
  hasLibrary?: boolean;
  hasBoarding?: boolean;
}

export interface ConfigurerEtablissementResultat {
  schoolId: string;
  message: string;
  classCount: number;
  subjectCount: number;
  academicYear: string;
}

// Niveaux standards dérivés d'un cycle (l'admin affinera ensuite dans le dashboard)
const NIVEAUX_1ER_FR = ['6e', '5e', '4e', '3e'];
const NIVEAUX_1ER_EN = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5'];
const NIVEAUX_2ND_FR = ['2nde', '1ère', 'Tle'];
const NIVEAUX_2ND_EN = ['LowerSixth', 'UpperSixth'];
const NIVEAUX_PRIMAIRE_FR = ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
const NIVEAUX_PRIMAIRE_EN = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6'];

/** Normalise une série 2nd cycle vers un code accepté par BacCoefficient (A1/A2/A3 → A). */
function normaliserSerie(serie: string): string {
  const s = serie.trim().toUpperCase();
  if (s === 'A4' || s.startsWith('A4')) return 'A4';
  if (/^A[1-3]$/.test(s)) return 'A';
  // "C — Mathématiques..." → "C"
  const m = s.match(/^([A-Z0-9]+)/);
  return m?.[1] ?? s;
}

/** Dérive les codes de combinaisons anglophones (A1..A5 / S1..S4) depuis les réponses. */
function deriveAngloCombos(state: OnboardingState): string[] {
  if (state.anglophoneCombinations?.length) return [...new Set(state.anglophoneCombinations)];
  const defaults: Record<string, string> = { ARTS: 'A1', SCIENCES: 'S1', COMMERCIAL: 'A4' };
  const codes = (state.anglophoneStreams ?? []).map((s) => defaults[s]).filter((c): c is string => !!c);
  return [...new Set(codes)];
}

export class ConfigurerEtablissementUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  /** Traduit l'OnboardingState vers le format onboardingConfig historique. */
  static mapStateToConfig(state: OnboardingState): Record<string, unknown> {
    const isAnglo = state.subSystem === 'ANGLOPHONE';
    const cyclesHas = (k: string) => Array.isArray(state.cycles) && state.cycles.includes(k);

    const config: Record<string, unknown> = {
      templateCode: state.template,

      // Calendrier
      academicYearStart: state.academicYearStart,
      academicYearEnd: state.academicYearEnd,
      periodsCount: state.periodsCount,
      sequencesPerPeriod: state.sequencesPerPeriod,

      // LV2
      lv2Active: !!state.lv2Active,
      lv2Languages: state.lv2Languages ?? [],
      lv2Organisation: state.lv2Organisation ?? [],

      // Finances / services
      feesTypes: state.feesTypes ?? [],
      paymentTranches: state.paymentTranches ?? 1,
      hasCanteen: !!state.hasCanteen,
      hasTransport: !!state.hasTransport,
      hasLibrary: !!state.hasLibrary,
      hasBoarding: !!state.hasBoarding,

      // Direction
      directionRoles: state.directionRoles ?? {},

      conventionNommage: 'LETTRES',
    };

    if (cyclesHas('PRIMAIRE')) {
      config['niveauxPrimaire'] = state.primaryLevels?.length
        ? state.primaryLevels
        : (isAnglo ? NIVEAUX_PRIMAIRE_EN : NIVEAUX_PRIMAIRE_FR);
    }

    if (cyclesHas('PREMIER_CYCLE')) {
      config['niveaux1erCycle'] = isAnglo ? NIVEAUX_1ER_EN : NIVEAUX_1ER_FR;
    }

    if (cyclesHas('SECOND_CYCLE')) {
      const wantFR = state.subSystem === 'FRANCOPHONE' || state.subSystem === 'BILINGUAL' || !state.subSystem;
      const wantEN = state.subSystem === 'ANGLOPHONE' || state.subSystem === 'BILINGUAL';

      // Section francophone : séries → filières (2nde/1ère/Tle), coefficients BacCoefficient
      if (wantFR) {
        config['niveaux2eCycle'] = NIVEAUX_2ND_FR;
        const filieres = [...new Set((state.series ?? []).map(normaliserSerie))];
        config['filieres'] = filieres;
        config['classesParFiliere'] = '1';
        if (filieres.includes('A4') && (state.lv2Languages?.length ?? 0) > 0) {
          config['a4Languages'] = state.lv2Languages;
        }
      }

      // Section anglophone : streams → Sixth Form (Lower/Upper), matières AnglophoneStreamCombination
      if (wantEN) {
        const combos = deriveAngloCombos(state);
        if (combos.length > 0) {
          config['anglophoneStreams'] = combos;
          config['niveauxSixth'] = NIVEAUX_2ND_EN;
        }
      }
    }

    if (cyclesHas('TECHNIQUE') && (state.technicalFilieres?.length ?? 0) > 0) {
      config['filieresTechniques'] = state.technicalFilieres;
    }

    return config;
  }

  async execute(state: OnboardingState): Promise<ConfigurerEtablissementResultat> {
    if (!state.schoolId) throw new Error('schoolId requis');

    const school = await this.prisma.school.findUnique({
      where: { id: state.schoolId },
      select: { id: true, status: true, onboardingConfig: true },
    });
    if (!school) throw new Error(`École introuvable : ${state.schoolId}`);
    if (school.status === 'ACTIVE') {
      throw new Error('Cet établissement est déjà configuré et actif.');
    }
    if (school.status !== 'APPROVED') {
      throw new Error(`L'établissement doit être approuvé avant configuration (statut : ${school.status}).`);
    }

    const config = ConfigurerEtablissementUseCase.mapStateToConfig(state);

    // Fusionner avec un éventuel config existant (préserve les données de la Phase 1)
    const existing = (school.onboardingConfig as Record<string, unknown> | null) ?? {};
    const mergedConfig = { ...existing, ...config };

    // Persister le config + le templateCode avant l'activation (l'activation les lit)
    await this.prisma.school.update({
      where: { id: state.schoolId },
      data: {
        onboardingConfig: mergedConfig as any,
        ...(state.template ? { templateCode: state.template } : {}),
      },
    });

    // Déléguer la construction atomique au moteur déterministe existant
    const activer = new ActiverEtablissementUseCase(this.prisma);
    const result = await activer.execute({ schoolId: state.schoolId });

    return {
      schoolId: result.schoolId,
      message: 'Établissement configuré et prêt à être utilisé !',
      classCount: result.classCount,
      subjectCount: result.subjectCount,
      academicYear: result.academicYear,
    };
  }
}
