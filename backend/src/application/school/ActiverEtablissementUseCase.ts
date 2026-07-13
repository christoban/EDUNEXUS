/**
 * APPLICATION LAYER — Use Case : Activer un établissement (Admin)
 * APPROVED → ACTIVE
 * Déclenché quand l'Admin soumet le formulaire de configuration (/admin/configuration).
 * Transaction atomique : crée l'année scolaire, les périodes, séquences, classes,
 * et copie les formules/mentions du template dans l'école.
 */
import type { PrismaClient } from '@prisma/client';
import {
  assignerMatieresPourClasse,
  parseSerie,
  NIVEAU_MAP,
} from './SubjectAssignmentHelper';
import { getTemplateMeta, isPEBSFrancophoneEligible, isPEBSAnglophoneEligible } from './schoolTemplateConfig';
import { APC_COMPETENCES, APC_UNITES } from './curriculum/primaire-apc';

export interface ActiverEtablissementCommande {
  schoolId: string;
}

export interface ActiverEtablissementResultat {
  schoolId: string;
  message: string;
  classCount: number;
  subjectCount: number;
  academicYear: string;
}

const LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class ActiverEtablissementUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(commande: ActiverEtablissementCommande): Promise<ActiverEtablissementResultat> {
    const { schoolId } = commande;

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        template: true,
        configurationForm: true,
      },
    });
    if (!school) throw new Error(`École introuvable : ${schoolId}`);
    if (school.status !== 'APPROVED') {
      throw new Error(`L'établissement doit être approuvé avant d'être activé (statut actuel : ${school.status})`);
    }

    const config = school.onboardingConfig as any;

    // Derive SchoolConfig overrides from new onboarding fields
    const enGradingSystem: string | undefined = config?.enGradingSystem;
    const bulletinFrequency: string | undefined = config?.bulletinFrequency;
    const evalSystemPrimaire: string | undefined = config?.evalSystemPrimaire;
    const templateCode: string | undefined = config?.templateCode;

    // passMark: 50 for /100 grading, 10 otherwise
    const passMark = enGradingSystem === 'OVER_100' ? 50 : 10;

    // schoolLanguageMode & bulletinTemplate
    const templateMeta = getTemplateMeta(templateCode);
    const langMode = templateMeta.langMode;
    const isPrimaire = templateMeta.isPrimaire;
    const isAnglophone = templateMeta.isAnglophone;
    const isTechnique = templateMeta.isTechnique;

    // PEBS flags (from onboarding config or defaults)
    const hasPEBSFrancophone = config?.hasPEBSFrancophone === true && isPEBSFrancophoneEligible(templateCode);
    const hasPEBSAnglophone  = config?.hasPEBSAnglophone  === true && isPEBSAnglophoneEligible(templateCode);
    type BulletinTpl = 'FR_SECONDARY' | 'EN_SECONDARY' | 'TECHNICAL_FR' | 'PRIMARY' | 'MONTHLY';
    let bulletinTemplate: BulletinTpl = 'FR_SECONDARY';
    if (bulletinFrequency === 'MONTHLY' && isPrimaire) bulletinTemplate = 'MONTHLY';
    else if (isPrimaire)   bulletinTemplate = 'PRIMARY';
    else if (isTechnique)  bulletinTemplate = 'TECHNICAL_FR';
    else if (isAnglophone) bulletinTemplate = 'EN_SECONDARY';

    // termsPerYear: monthly reports = keep 3 terms but gradesPerTerm higher
    const gradesPerTerm = bulletinFrequency === 'MONTHLY' ? 4 : 2;

    // APC_300 → passMark 300 is the total but individual subjects still /10
    const finalPassMark = evalSystemPrimaire === 'APC_300' ? 10 : passMark;

    let classCount = 0;
    let subjectCount = 0;
    let academicYearName = '';

    await this.prisma.$transaction(async (tx) => {
      // 1. Créer l'année académique
      // Calendrier configurable (onboarding conversationnel) avec repli sur les valeurs par défaut
      // pour l'ancien chemin d'activation (config sans champs calendrier).
      const now = new Date();
      const yStart = config?.academicYearStart ? new Date(config.academicYearStart) : new Date(`${now.getFullYear()}-09-01`);
      const startYear = yStart.getFullYear();
      const yEnd = config?.academicYearEnd ? new Date(config.academicYearEnd) : new Date(`${startYear + 1}-06-30`);
      academicYearName = `${startYear}-${yEnd.getFullYear()}`;
      const academicYear = await tx.academicYear.create({
        data: {
          schoolId,
          name: academicYearName,
          startDate: yStart,
          endDate: yEnd,
          isCurrent: true,
          status: 'ACTIVE',
        },
      });

      // 2. Créer les périodes.
      // Primaire (APC) et anglophone restent sur 3 périodes (l'APC dépend d'un découpage en 3 trimestres).
      // FR secondaire/technique : nombre de périodes configurable (2 semestres OU 3 trimestres).
      const canConfigurePeriods = !isPrimaire && !isAnglophone;
      const requestedPeriods = Number(config?.periodsCount);
      const periodsCount = canConfigurePeriods && requestedPeriods === 2 ? 2 : 3;
      const isSemester = periodsCount === 2;
      const periodType = isAnglophone ? 'TERM' as const : 'TRIMESTER' as const;
      const periodLabel = isAnglophone ? 'Term' : isSemester ? 'Semestre' : 'Trimestre';

      // Nombre de séquences par période (FR secondaire/technique uniquement) — défaut 2
      const requestedSeq = Number(config?.sequencesPerPeriod);
      const seqPerPeriod = canConfigurePeriods && requestedSeq >= 1 && requestedSeq <= 6 ? Math.floor(requestedSeq) : 2;

      // Découpage des dates : parts égales sur [yStart, yEnd]
      const msTotal = yEnd.getTime() - yStart.getTime();
      let runningSeq = 0;
      for (let i = 0; i < periodsCount; i++) {
        const pStart = i === 0 ? yStart : new Date(yStart.getTime() + Math.round((msTotal * i) / periodsCount));
        const pEnd = i === periodsCount - 1 ? yEnd : new Date(yStart.getTime() + Math.round((msTotal * (i + 1)) / periodsCount) - 86400000);
        const period = await tx.academicPeriod.create({
          data: {
            academicYearId: academicYear.id,
            name: `${periodLabel} ${i + 1}`,
            type: periodType,
            orderIndex: i + 1,
            startDate: pStart,
            endDate: pEnd,
            isCurrent: i === 0,
          },
        });

        // 3. Créer les séquences/UA par période
        // APC primaire : UA1-UA8 distribuées 3-3-2
        // EN : Sequence 1 (Class Test) + Sequence 2 (Terminal Exam) par terme
        // FR : "Séquence 1...N" — N = seqPerPeriod × periodsCount
        type SeqDef = { name: string; type: 'DS' | 'COMPOSITION' | 'CLASS_TEST' | 'TERMINAL_EXAM' | 'UA' };
        const seqDefs: SeqDef[] = isPrimaire
          ? APC_UNITES[i].unites.map(ua => ({ name: ua, type: 'UA' as const }))
          : isAnglophone
            ? [
                { name: 'Sequence 1', type: 'CLASS_TEST'    },
                { name: 'Sequence 2', type: 'TERMINAL_EXAM' },
              ]
            : Array.from({ length: seqPerPeriod }, () => {
                runningSeq += 1;
                return { name: `Séquence ${runningSeq}`, type: 'DS' as const };
              });

        for (let j = 0; j < seqDefs.length; j++) {
          await tx.academicSequence.create({
            data: {
              academicPeriodId: period.id,
              schoolId,
              name:       seqDefs[j].name,
              type:       seqDefs[j].type,
              orderIndex: j + 1,
              startDate:  null,
              endDate:    null,
              isCurrent:  i === 0 && j === 0,
            },
          });
        }
      }

      // 4. Créer les classes depuis onboardingConfig
      let classesACreer: { name: string; level: string; schoolId: string; serie?: string | null; filiere?: string | null; pebsMixte?: boolean }[] = [];
      const enSixthClassNames = new Set<string>(); // classes Sixth anglophones (matières gérées à part, exclues de 4g)
      if (config) {

        // 4a. 1er cycle (filière technique propre OU filière PEBS/GENERAL)
        if (config.niveaux1erCycle?.length > 0) {
          const conv = config.conventionNommage ?? 'LETTRES';
          const filieresTech: string[] = config.filieresTechniques ?? [];
          for (const niveau of config.niveaux1erCycle) {
            if (isTechnique && filieresTech.length > 0) {
              // Lycées techniques / CETIC : une classe par combinaison (niveau × filière)
              // La filière (ex: 'F1', 'G2' FR ou 'STT', 'IND' EN) doit correspondre aux
              // CycleCoefficients (FR) ou AnglophoneSubjectLoad (EN, ex: "Form 1" → "Form1").
              const levelNormTech = isAnglophone ? niveau.replace(/\s+/g, '') : niveau;
              for (const fil of filieresTech) {
                classesACreer.push({ name: `${niveau} ${fil}`, level: levelNormTech, schoolId, filiere: fil });
              }
            } else {
              const count = config.classesParNiveau?.[niveau] ?? 2;
              // Anglophone : level sans espaces pour matcher AnglophoneSubjectLoad (seeded 'Form1' etc.)
              const levelNorm = isAnglophone ? niveau.replace(/\s+/g, '') : niveau;
              // Construire un index className → statut PEBS si pebsOrganisation fourni
              const pebsIndex: Record<string, string> = {};
              if (Array.isArray(config.pebsOrganisation)) {
                for (const rule of config.pebsOrganisation as Array<{ className: string; statut: string }>) {
                  pebsIndex[rule.className] = rule.statut;
                }
              }
              for (let i = 0; i < Math.min(count, 26); i++) {
                const suffix = conv === 'LETTRES' ? LETTRES[i]
                  : conv === 'CHIFFRES' ? `${i + 1}`
                  : `${LETTRES[i]}1`;
                const className = `${niveau} ${suffix}`;
                // PEBS: utilise pebsOrganisation si disponible, sinon fallback i === 0
                const pebsStatut = pebsIndex[className];
                let filiere: string;
                if (pebsStatut === 'PEBS_PUR') {
                  filiere = isAnglophone ? 'EN_PEBS' : 'FR_PEBS';
                } else if (pebsStatut === 'MIXTE') {
                  // Classes mixtes : marquées GENERAL + pebsMixte pour le badge 3 états
                  filiere = isAnglophone ? 'EN_GENERAL' : 'FR_GENERAL';
                  classesACreer.push({ name: className, level: levelNorm, schoolId, filiere, pebsMixte: true });
                  continue;
                } else if (pebsStatut === 'NON_PEBS') {
                  filiere = isAnglophone ? 'EN_GENERAL' : 'FR_GENERAL';
                } else {
                  // Fallback historique : première classe = PEBS si flag actif
                  const isPEBSClass = i === 0 && (
                    (hasPEBSFrancophone && !isAnglophone) ||
                    (hasPEBSAnglophone && isAnglophone)
                  );
                  filiere = isPEBSClass
                    ? (isAnglophone ? 'EN_PEBS' : 'FR_PEBS')
                    : (isAnglophone ? 'EN_GENERAL' : 'FR_GENERAL');
                }
                classesACreer.push({ name: className, level: levelNorm, schoolId, filiere });
              }
            }
          }
        }

        // 4b. 2e cycle
        const FILIERES_TECHNIQUES_PATTERNS = [/^TI/, /F · G · H/, /technique/i];
        function estFiliereTechnique(filiereLabel: string): boolean {
          return FILIERES_TECHNIQUES_PATTERNS.some(p => p.test(filiereLabel));
        }
        function extraireSerie(filiereLabel: string): string {
          const m = filiereLabel.match(/^([A-Z0-9]+)/);
          return m?.[1] ?? filiereLabel;
        }

        // Auto-ajouter ABI si PEBS Francophone activé et ABI pas déjà sélectionnée
        if (hasPEBSFrancophone) {
          const hasABI = config.filieres?.some((f: string) => /^ABI/.test(f));
          if (!hasABI) {
            config.filieres = [...(config.filieres ?? []), 'ABI — A Bilingue (Intensive English)'];
          }
        }

        if (config.niveaux2eCycle?.length > 0 && config.filieres?.length > 0) {
          const nbClasses = config.classesParFiliere === '3+' ? 3 : parseInt(config.classesParFiliere ?? '1');

          // Pré-charger les combinaisons (niveauBac, serie) valides — source de vérité MINESEC
          const bacCombosRaw = await tx.bacCoefficient.findMany({
            select: { serie: true, niveau: true },
            distinct: ['serie', 'niveau'],
          });
          const validBacCombos = new Set(bacCombosRaw.map(b => `${b.niveau}|${b.serie}`));

          // Issue #7: enStreamStartLevel — niveaux anglophone avant ce seuil = classe générale
          const EN_LEVEL_ORDER = ['Form4', 'Form5', 'LowerSixth', 'UpperSixth'];
          const streamStartMap: Record<string, string> = { FORM4: 'Form4', FORM5: 'Form5', SIXTH: 'LowerSixth' };
          const streamThreshold: string | null = isAnglophone && config.enStreamStartLevel
            ? (streamStartMap[config.enStreamStartLevel as string] ?? null)
            : null;

          for (const niveau of config.niveaux2eCycle) {
            const niveauBac = NIVEAU_MAP[niveau];
            // Anglophone : level sans espaces pour matcher AnglophoneSubjectLoad
            const levelNorm2 = isAnglophone ? niveau.replace(/\s+/g, '') : niveau;

            // Anglophone : si le niveau est en-dessous du seuil de streaming, 1 classe générale
            if (streamThreshold) {
              const levelIdx = EN_LEVEL_ORDER.indexOf(levelNorm2);
              const threshIdx = EN_LEVEL_ORDER.indexOf(streamThreshold);
              if (levelIdx >= 0 && levelIdx < threshIdx) {
                classesACreer.push({ name: niveau, level: levelNorm2, schoolId });
                continue;
              }
            }

            for (const filiere of config.filieres) {
              if (niveau === '2nde' && estFiliereTechnique(filiere)) continue;

              if (filiere.startsWith('A4') || filiere.includes('A4')) {
                // Vérifie que A4 existe à ce niveau avant de créer
                if (niveauBac && !validBacCombos.has(`${niveauBac}|A4`)) continue;
                const langs = config.a4Languages?.length ? config.a4Languages : ['LV'];
                for (const lang of langs) {
                  classesACreer.push({ name: `${niveau} A4-${lang}`, level: levelNorm2, schoolId, serie: `A4-${lang}` });
                }
              } else {
                const serie = extraireSerie(filiere);
                // Rejeter les séries inexistantes à ce niveau (ex: D en 2nde, TI en 2nde)
                if (niveauBac && !validBacCombos.has(`${niveauBac}|${serie}`)) continue;
                for (let i = 0; i < nbClasses; i++) {
                  const suffix = nbClasses > 1 ? ` ${LETTRES[i]}` : '';
                  classesACreer.push({ name: `${niveau} ${serie}${suffix}`, level: levelNorm2, schoolId, serie });
                }
              }
            }
          }
        }

        // 4b-bis. GTC_GTHS_EN — 2e cycle technique anglophone (LowerSixth/UpperSixth × STT/IND).
        // Miroir du 1er cycle technique (4a) mais pour niveaux2eCycle : les coefficients
        // viennent d'AnglophoneSubjectLoad (filiere STT/IND), jamais de BacCoefficient (francophone).
        if (templateCode === 'GTC_GTHS_EN' && config.niveaux2eCycle?.length > 0) {
          const filieresTechGths: string[] = config.filieresTechniques ?? [];
          for (const niveau of config.niveaux2eCycle as string[]) {
            const levelNormTech2 = niveau.replace(/\s+/g, '');
            for (const fil of filieresTechGths) {
              classesACreer.push({ name: `${niveau} ${fil}`, level: levelNormTech2, schoolId, filiere: fil });
            }
          }
        }

        // 4c. LYCEE_BILINGUE — EN section classes
        if (config.templateCode === 'LYCEE_BILINGUE' && config.bilingualEnLevels?.length > 0) {
          const enFilieres: string[] = config.bilingualEnFilieres ?? [];
          for (const niveau of config.bilingualEnLevels as string[]) {
            const levelNormEn = niveau.replace(/\s+/g, '');
            if (enFilieres.length === 0) {
              classesACreer.push({ name: `${niveau} EN`, level: levelNormEn, schoolId });
            } else {
              for (const filiere of enFilieres) {
                const serie = filiere.match(/^([A-Z][0-9])/)?.[1] ?? filiere;
                classesACreer.push({ name: `${niveau} ${serie}`, level: levelNormEn, schoolId });
              }
            }
          }
        }

        // 4d. PRIMARY_BILINGUAL — EN section classes
        if (config.templateCode === 'PRIMARY_BILINGUAL' && config.bilingualEnLevels?.length > 0) {
          for (const niveau of config.bilingualEnLevels as string[]) {
            classesACreer.push({ name: `${niveau} EN`, level: niveau.replace(/\s+/g, ''), schoolId });
          }
        }

        // 4e. Primaire
        if (config.niveauxPrimaire?.length > 0) {
          for (const niveau of config.niveauxPrimaire) {
            const count = config.classesParNiveauPrimaire?.[niveau] ?? 1;
            for (let i = 0; i < Math.min(count, 26); i++) {
              classesACreer.push({ name: `${niveau} ${LETTRES[i]}`, level: niveau, schoolId });
            }
          }
        }

        // 4e-pro. SAR_SM + CFM : classes par filière (codes SAR/SM/COUTURE) × années
        if (templateCode === 'SAR_SM') {
          for (const fil of ['SAR', 'SM'] as const) {
            classesACreer.push({ name: `Année1 ${fil}`, level: 'Année1', schoolId, filiere: fil });
            classesACreer.push({ name: `Année2 ${fil}`, level: 'Année2', schoolId, filiere: fil });
          }
        }
        if (templateCode === 'CFM') {
          // cfmFilieres = noms libres soumis par l'admin ; fallback vers les filières seeded
          const cfmFils: string[] = (config.cfmFilieres as string[] | undefined)?.length
            ? config.cfmFilieres
            : ['SAR', 'SM', 'COUTURE'];
          for (const fil of cfmFils) {
            classesACreer.push({ name: `Année1 ${fil}`, level: 'Année1', schoolId, filiere: fil });
            classesACreer.push({ name: `Année2 ${fil}`, level: 'Année2', schoolId, filiere: fil });
          }
        }

        // 4e-nur. Nursery_EN : classes par niveau (normalisation espaces pour level)
        if (templateCode === 'NURSERY_EN' && (config.nurseryLevels as string[] | undefined)?.length) {
          for (const lvl of config.nurseryLevels as string[]) {
            classesACreer.push({ name: lvl, level: lvl.replace(/\s+/g, ''), schoolId });
          }
        }

        // 4e-mat. Maternelle_FR : classes par section
        if (templateCode === 'MATERNELLE_FR' && (config.maternelleSections as string[] | undefined)?.length) {
          for (const section of config.maternelleSections as string[]) {
            classesACreer.push({ name: section, level: section, schoolId });
          }
        }

        // 4e-EN. Second cycle anglophone (Sixth Form) — classes par stream/combinaison.
        // Chemin dédié (séparé du 2e cycle FR) : évite la collision du code "A4".
        if (Array.isArray(config.anglophoneStreams) && (config.anglophoneStreams as string[]).length > 0) {
          const sixthLevels: string[] = (config.niveauxSixth as string[] | undefined)?.length
            ? (config.niveauxSixth as string[])
            : ['LowerSixth', 'UpperSixth'];
          for (const niveau of sixthLevels) {
            const levelNorm = niveau.replace(/\s+/g, '');
            for (const combo of config.anglophoneStreams as string[]) {
              const name = `${levelNorm} ${combo}`;
              enSixthClassNames.add(name);
              classesACreer.push({ name, level: levelNorm, schoolId, serie: combo, filiere: 'EN_GENERAL' });
            }
          }
        }

        // Sauvegarder toutes les classes (avec serie pour le 2e cycle, filiere pour le 1er cycle/PEBS)
        for (const c of classesACreer) {
          await tx.class.create({
            data: { name: c.name, level: c.level, schoolId: c.schoolId, serie: c.serie ?? null, filiere: c.filiere ?? null, pebsMixte: c.pebsMixte ?? false } as any,
          });
        }
        classCount = classesACreer.length;
      }

      // 4f. Primaire APC — créer une Matière par Sous-Compétence (11 au total)
      // Structure terrain : 6 Compétences → 11 Sous-Compétences évaluées par UA (UA1-UA8)
      // Le coefficient ici = totalPoints de la sous-compétence (poids dans /260)
      if (isPrimaire) {
        for (const comp of APC_COMPETENCES) {
          for (const sc of comp.sousCompetences) {
            await tx.subject.create({
              data: {
                schoolId,
                name:         sc.label,
                code:         sc.code,
                coefficient:  sc.totalPoints,
                hoursPerWeek: 0,
                subjectType:  'THEORETICAL',
              },
            });
            subjectCount++;
          }
        }
      }

      // 4f-bis. Secondaire/Technique — créer les matières depuis template.config.defaultSubjects
      // Fallback : si school.templateCode n'était pas renseigné au moment de l'activation,
      // on récupère le template via onboardingConfig.templateCode
      let effectiveTemplate: any = school.template;
      if (!effectiveTemplate && templateCode) {
        effectiveTemplate = await tx.schoolTemplate.findUnique({ where: { code: templateCode } });
      }
      // Templates with full reference data (CycleCoefficients, BacCoefficients, AnglophoneSubjectLoad)
      // skip 4f-bis — section 4g below creates subjects on-demand from correct reference data instead.
      const TEMPLATES_WITH_REFERENCE_DATA = ['LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'GHS_EN', 'GSS_EN', 'PRIVE_EN', 'LYCEE_BILINGUE'];
      const hasReferenceData = templateCode && TEMPLATES_WITH_REFERENCE_DATA.includes(templateCode);
      if (effectiveTemplate && !hasReferenceData && !isPrimaire) {
        const tCfg = effectiveTemplate.config as any;
        const frSubjects: any[] = tCfg.defaultSubjects   ?? [];
        const enSubjects: any[] = tCfg.defaultSubjectsEN ?? [];

        for (const s of frSubjects) {
          await tx.subject.create({
            data: {
              schoolId,
              name:        s.name,
              code:        s.code,
              coefficient: s.coefficient,
              hoursPerWeek: s.hoursPerWeek ?? 2,
              subjectType: (s.subjectType ?? 'THEORETICAL') as any,
            },
          });
        }
        // Section anglophone des lycées/primaires bilingues — suffixe _EN pour différencier
        for (const s of enSubjects) {
          await tx.subject.create({
            data: {
              schoolId,
              name:        frSubjects.length > 0 ? `${s.name} (EN)` : s.name,
              code:        frSubjects.length > 0 ? `${s.code}_EN`   : s.code,
              coefficient: s.coefficient,
              hoursPerWeek: s.hoursPerWeek ?? 2,
              subjectType: (s.subjectType ?? 'THEORETICAL') as any,
            },
          });
        }
        subjectCount = frSubjects.length + enSubjects.length;
      }

      // 4g. SubjectCoefficients pour toutes les classes — secondaire uniquement
      // Primaire APC : pas de SubjectCoefficient par classe (toutes les classes ont les mêmes sous-compétences)
      if (classesACreer.length > 0 && !isPrimaire) {
        const schoolSubjects = await tx.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
        const subjectByName  = new Map(schoolSubjects.map(s => [s.name, s.id]));
        const subjectCountRef = { value: 0 };

        // Déduplication par (level, serie, filiere) pour limiter les requêtes BacCoefficient
        // mais A4 doit être traité par (level, serie, langue) pour créer les LV2 réels
        const processedKeys = new Set<string>();
        for (const c of classesACreer) {
          if (enSixthClassNames.has(c.name)) continue; // matières Sixth EN gérées en 4g-EN
          const seriePart = parseSerie(c.name, c.level);
          // 1er cycle : clé inclut la filière (FR_PEBS ≠ FR_GENERAL)
          // A4 2nd cycle : clé inclut le nom complet pour distinguer les langues
          // Autres 2nd cycle : (level|seriePart) suffit
          const dedupKey = seriePart === 'A4'
            ? `${c.level}|${c.name}`
            : seriePart
              ? `${c.level}|${seriePart}`
              : `${c.level}|${c.filiere ?? ''}`;
          if (processedKeys.has(dedupKey)) continue;
          processedKeys.add(dedupKey);

          await assignerMatieresPourClasse(
            tx, c, schoolId, config, isAnglophone, subjectByName, subjectCountRef, school.templateCode ?? '',
          );
        }
        subjectCount += subjectCountRef.value;
      }

      // 4g-EN. Matières Sixth Form anglophone (stream combinations) — coefficients déterministes.
      // Consomme AnglophoneStreamCombination (matières de la filière) + AnglophoneSubjectLoad (coeffs officiels /20).
      if (Array.isArray(config?.anglophoneStreams) && config.anglophoneStreams.length > 0 && templateCode) {
        const comboCodes = config.anglophoneStreams as string[];
        const sixthLevels: string[] = (config.niveauxSixth as string[] | undefined)?.length
          ? (config.niveauxSixth as string[])
          : ['LowerSixth', 'UpperSixth'];

        const combos = await tx.anglophoneStreamCombination.findMany({ where: { filiere: { in: comboCodes } } });

        const existingSubjects = await tx.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
        const subjectByName = new Map(existingSubjects.map(s => [s.name, s.id]));

        for (const niveau of sixthLevels) {
          const levelNorm = niveau.replace(/\s+/g, '');
          const loads = await tx.anglophoneSubjectLoad.findMany({
            where: { templateCode, classLevel: levelNorm, filiere: 'EN_GENERAL' },
          });
          const loadMap = new Map(loads.map(l => [l.subjectName, l]));

          for (const combo of combos) {
            const core = Array.isArray(combo.coreSubjects) ? combo.coreSubjects as string[] : [];
            // Une option représentative par groupe d'électifs (l'élève affine son choix ensuite, max 5 au A-Level)
            const electives: string[] = Array.isArray(combo.electiveGroup)
              ? (combo.electiveGroup as string[][]).map(g => Array.isArray(g) ? g[0] : null).filter((x): x is string => !!x)
              : [];
            const subjectNames = [...new Set([...core, ...electives])];

            for (const name of subjectNames) {
              const load = loadMap.get(name);
              const coeff = load?.coefficient ?? 1;
              const hours = load?.weeklyPeriods ?? 2;

              let subjectId = subjectByName.get(name);
              if (!subjectId) {
                const created = await tx.subject.create({
                  data: {
                    schoolId,
                    name,
                    code: name.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8),
                    coefficient: coeff,
                    hoursPerWeek: hours,
                    subjectType: 'THEORETICAL',
                  },
                });
                subjectId = created.id;
                subjectByName.set(name, subjectId);
                subjectCount++;
              }

              const existing = await tx.subjectCoefficient.findFirst({
                where: { schoolId, subjectId, classLevel: levelNorm, serieCode: combo.filiere },
                select: { id: true },
              });
              if (!existing) {
                await tx.subjectCoefficient.create({
                  data: { schoolId, subjectId, classLevel: levelNorm, serieCode: combo.filiere, coefficient: coeff },
                });
              }
            }
          }
        }
      }

      // 4h. Créer les départements pédagogiques (uniquement secondaire)
      if (templateCode && !isPrimaire) {
        const schoolSubjects = await tx.subject.findMany({ where: { schoolId } });
        const DEPT_MERGE: Record<string, string> = {
          'Sciences':                                    'SVT',
          'SVTEEHB':                                     'SVT',
          'Physique-Chimie-Technologie':                 'PCT',
          'Physique':                                    'PCT',
          'Chimie':                                      'PCT',
          'Anglais':                                     'Anglais',
          'English Language':                            'Anglais',
          'Intensive English':                           'Anglais',
          'Literature in English':                       'Anglais',
          'Français':                                    'Français',
          'Langue Française':                            'Français',
          'Littérature':                                 'Français',
        };
        const DEPT_COLORS = [
          '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
          '#f97316', '#06b6d4', '#ec4899', '#84cc16', '#6366f1',
          '#14b8a6', '#f43f5e', '#d946ef', '#0ea5e9', '#22c55e',
        ];
        // Déterminer le département cible pour chaque matière
        const subjectDeptMap = new Map<string, string>();
        for (const subj of schoolSubjects) {
          subjectDeptMap.set(subj.id, DEPT_MERGE[subj.name] ?? subj.name);
        }
        // Grouper les subjectId par département
        const deptGroups = new Map<string, string[]>();
        for (const [subjectId, deptName] of subjectDeptMap) {
          const group = deptGroups.get(deptName) ?? [];
          group.push(subjectId);
          deptGroups.set(deptName, group);
        }
        // Créer UN département par groupe, trié alphabétiquement
        let colorIdx = 0;
        const sortedDeptNames = [...deptGroups.keys()].sort((a, b) => a.localeCompare(b));
        for (const deptName of sortedDeptNames) {
          const color = DEPT_COLORS[colorIdx % DEPT_COLORS.length];
          colorIdx++;
          const department = await tx.department.create({
            data: { schoolId, name: deptName, color },
          });
          for (const subjectId of deptGroups.get(deptName)!) {
            await tx.subject.update({
              where: { id: subjectId },
              data: { departmentId: department.id },
            });
          }
        }
      }

      // 4h-APC. Primaire — créer un Département par Compétence APC (6 compétences)
      // Les Sujets (sous-compétences) créés à l'étape 4f sont rattachés à leur compétence.
      if (isPrimaire) {
        const APC_DEPT_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981', '#f97316'];
        const apcSubjects = await tx.subject.findMany({
          where: { schoolId },
          select: { id: true, code: true },
        });
        const subjectByCode = new Map(apcSubjects.map(s => [s.code, s.id]));

        for (let ci = 0; ci < APC_COMPETENCES.length; ci++) {
          const comp = APC_COMPETENCES[ci];
          const dept = await tx.department.create({
            data: {
              schoolId,
              name:  `Compétence ${comp.numero}`,
              color: APC_DEPT_COLORS[ci] ?? '#9ca3af',
            },
          });
          for (const sc of comp.sousCompetences) {
            const subjectId = subjectByCode.get(sc.code);
            if (subjectId) {
              await tx.subject.update({
                where: { id: subjectId },
                data:  { departmentId: dept.id },
              });
            }
          }
        }
      }

      // 5. Cloner la GradeFormula adaptée au type de template
      if (school.templateCode) {
        const formulaId = isTechnique    ? 'default-technique-fr'
          : isAnglophone                 ? 'default-en'
          : 'default-fr';

        const formula = await tx.gradeFormula.findUnique({ where: { id: formulaId } });
        if (formula) {
          await tx.gradeFormula.create({
            data: { schoolId, label: formula.label, evaluations: formula.evaluations, isDefault: true },
          });
        }

        // 6. Cloner la MentionRule adaptée
        // Primaire FR et EN : les deux utilisent l'échelle APC (Expert/Acquis/ECA/NA sur /20)
        // Source terrain : bulletin CM2 FR + rapport Class V anglophone Le Québécois
        const mentionId = isPrimaire    ? 'default-apc-mentions'
          : isAnglophone                ? 'default-en-mentions'
          : 'default-fr-mentions';

        const rule = await tx.mentionRule.findUnique({ where: { id: mentionId } });
        if (rule) {
          await tx.mentionRule.create({
            data: { schoolId, rules: rule.rules, isDefault: true },
          });
        }
      }

      // 7. Créer SchoolConfig (valeurs MINESEC + overrides depuis onboarding)
      await tx.schoolConfig.create({
        data: {
          schoolId,
          passMark: finalPassMark,
          councilPassMark: finalPassMark,
          termsPerYear: periodsCount,
          maxAbsences: 10,
          gradesPerTerm,
          attendanceLateAsAbsence: false,
          schoolLanguageMode: langMode,
          bulletinTemplate,
        },
      });

      // 8. Créer SchoolSettings
      await tx.schoolSettings.create({
        data: {
          schoolId,
          timezone: 'Africa/Douala',
          locale: 'fr-CM',
          currency: 'XAF',
        },
      });

      // ── 8b. Onboarding conversationnel — étapes additionnelles ──────────────
      // Gated : ne s'exécutent que si les champs correspondants existent dans le config.
      // L'ancien chemin d'activation (formulaire statique) n'a pas ces champs → sauté.

      // LV2 : réconcilier la matière générique "LV2" du curriculum.
      // Le curriculum ne place la LV2 QU'EN 4e et 3e (jamais 6e/5e) — cf. premier-cycle.ts.
      //   CAS A (lv2Active + langues) : créer une matière-langue réelle (isLV2=true) par langue déclarée,
      //     copier les coefficients LV2 officiels du premier cycle, puis retirer l'entrée générique.
      //   CAS B (pas de LV2) : retirer l'entrée générique sans créer aucune matière de langue.
      //   CAS C (2nd cycle) : NON touché — on ne transforme que les coefficients de niveau 4e/3e.
      //     Les langues du 2e cycle (A4…) sont déjà des matières réelles gérées par SubjectAssignmentHelper.
      {
        const PREMIER_CYCLE_LV2_LEVELS = ['4e', '3e'];
        const abstractLV2 = await tx.subject.findFirst({ where: { schoolId, name: 'LV2' } });

        if (abstractLV2) {
          // Coefficients LV2 du premier cycle uniquement (4e/3e) — jamais 6e/5e, jamais 2nd cycle
          const premierCoeffs = await tx.subjectCoefficient.findMany({
            where: { schoolId, subjectId: abstractLV2.id, classLevel: { in: PREMIER_CYCLE_LV2_LEVELS } },
          });

          const languesActives: string[] = config?.lv2Active === true && Array.isArray(config?.lv2Languages)
            ? (config.lv2Languages as unknown[])
                .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
                .map((l) => l.trim())
            : [];

          // ── CAS A : matières-langues réelles (partagées entre tous les niveaux, créées une seule fois) ──
          // Uniquement s'il existe réellement une LV2 de premier cycle (4e/3e) à transformer.
          if (languesActives.length > 0 && premierCoeffs.length > 0) {
            const langDept = await tx.department.findFirst({
              where: { schoolId, name: { in: ['Langues Vivantes', 'Languages'] } },
              select: { id: true },
            });
            const lv2Coeff = abstractLV2.coefficient ?? 2;
            const lv2Hours = abstractLV2.hoursPerWeek ?? 2;

            for (const langue of languesActives) {
              // Anti-doublon : réutiliser une matière existante du même nom (ex. "Allemand" déjà créée en A4)
              const existing = await tx.subject.findFirst({ where: { schoolId, name: langue } });
              const langSubject = existing ?? await tx.subject.create({
                data: {
                  schoolId,
                  name: langue,
                  code: langue.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8),
                  coefficient: lv2Coeff,
                  hoursPerWeek: lv2Hours,
                  subjectType: 'THEORETICAL',
                  departmentId: langDept?.id ?? null,
                  isLV2: true,
                } as any,
              });
              if (existing) {
                await tx.subject.update({
                  where: { id: langSubject.id },
                  data: { isLV2: true, ...(langDept ? { departmentId: langDept.id } : {}) } as any,
                });
              }
            }

            // ── LV2 par classe (via ClassSubjectOverride) ou par niveau (SubjectCoefficient) ──
            const lv2Org = (config?.lv2Organisation ?? []) as Array<{ className?: string | null; level: string; langue?: string | null; langues?: string[]; organisation: string }>;
            const hasPerClassConfig = lv2Org.some(r => r.className);

            if (hasPerClassConfig) {
              // PER-CLASS : ClassSubjectOverride — chaque classe reçoit UNIQUEMENT ses langues
              const classes = await tx.class.findMany({
                where: { schoolId, level: { in: PREMIER_CYCLE_LV2_LEVELS } },
                select: { id: true, name: true, level: true },
              });
              // Build a lookup map of language subjects by name
              const langSubjects = await tx.subject.findMany({
                where: { schoolId, isLV2: true },
                select: { id: true, name: true },
              });
              const langSubjectByName = new Map(langSubjects.map(s => [s.name, s.id]));

              for (const cls of classes) {
                const rule = lv2Org.find(r => r.className === cls.name)
                  ?? lv2Org.find(r => !r.className && r.level === cls.level);
                if (!rule) continue;

                const targetLangues = rule.organisation === 'MIXTE'
                  ? (rule.langues ?? [])
                  : rule.langue ? [rule.langue] : [];

                for (const langue of targetLangues) {
                  const sid = langSubjectByName.get(langue);
                  if (!sid) continue;
                  const exists = await tx.classSubjectOverride.findUnique({
                    where: { classId_subjectId: { classId: cls.id, subjectId: sid } },
                    select: { id: true },
                  });
                  if (!exists) {
                    await tx.classSubjectOverride.create({
                      data: { schoolId, classId: cls.id, subjectId: sid, coefficient: lv2Coeff },
                    });
                  }
                }
              }
            } else {
              // FALLBACK : une seule langue pour TOUT l'établissement (vrai scénario "uniforme global").
              // La règle globale UNIFORME (sans className) porte la langue unique choisie par l'admin :
              // on n'applique QUE cette langue — plus jamais toutes les langues déclarées dans chaque classe.
              // (Repli historique : configs anciennes sans règle globale explicite → comportement inchangé.)
              const globalRule = lv2Org.find(r => !r.className && r.organisation === 'UNIFORME' && r.langue);
              const globalLangues = globalRule?.langue ? [globalRule.langue] : languesActives;
              for (const pc of premierCoeffs) {
                for (const langue of globalLangues) {
                  const langSubject = await tx.subject.findFirst({
                    where: { schoolId, name: langue, isLV2: true },
                    select: { id: true },
                  });
                  if (!langSubject) continue;
                  const already = await tx.subjectCoefficient.findFirst({
                    where: { schoolId, subjectId: langSubject.id, classLevel: pc.classLevel, serieCode: pc.serieCode },
                    select: { id: true },
                  });
                  if (!already) {
                    await tx.subjectCoefficient.create({
                      data: { schoolId, subjectId: langSubject.id, classLevel: pc.classLevel, serieCode: pc.serieCode, coefficient: pc.coefficient },
                    });
                  }
                }
              }
            }
          }

          // ── CAS A & CAS B : retirer les coefficients LV2 du premier cycle de la matière générique ──
          if (premierCoeffs.length > 0) {
            await tx.subjectCoefficient.deleteMany({
              where: { schoolId, subjectId: abstractLV2.id, classLevel: { in: PREMIER_CYCLE_LV2_LEVELS } },
            });
          }
          // Supprimer la matière générique seulement si plus AUCUN coefficient ne la référence
          // (préserve un éventuel usage 2nd cycle A2/A5/ABI — CAS C).
          const remaining = await tx.subjectCoefficient.count({ where: { schoolId, subjectId: abstractLV2.id } });
          if (remaining === 0) {
            await tx.subject.delete({ where: { id: abstractLV2.id } });
          }
        }
      }

      // ── 8c. PEBS MIXTE : ajouter les matières PEBS aux classes mixtes ──────────────
      // Une classe MIXTE (contenant à la fois des élèves PEBS et non-PEBS) doit
      // exposer les matières des DEUX curricula pour que l'affectation individuelle
      // (StudentProfile.pebsFiliere) fonctionne. Les matières communes sont
      // dédupliquées automatiquement par subjectId.
      // Source des matières PEBS + serieCode des matières générales selon le cycle de la classe :
      //   • 1er cycle (4e/3e…)  → CycleCoefficient filière FR_PEBS ; général sous serieCode 'FR_GENERAL'
      //   • 2nd cycle (2nde/1ère/Tle) → BacCoefficient série ABI (Intensive English, Citizenship…) ;
      //                                  général sous serieCode = série de la classe
      {
        const pebsOrg = (config?.pebsOrganisation ?? []) as Array<{ className: string; level: string; statut: string }>;
        const mixteRules = pebsOrg.filter(r => r.statut === 'MIXTE');
        if (mixteRules.length > 0 && hasPEBSFrancophone) {
          const schoolClasses = await tx.class.findMany({
            where: { schoolId },
            select: { id: true, name: true, level: true, serie: true },
          });
          const allSubjects = await tx.subject.findMany({ where: { schoolId } });
          const subjectByName = new Map(allSubjects.map(s => [s.name, s.id]));

          for (const rule of mixteRules) {
            const cls = schoolClasses.find(c => c.name === rule.className);
            if (!cls) continue;

            // Choisir la source des matières PEBS selon le cycle de la classe
            const niveauBac = NIVEAU_MAP[cls.level];
            const isSecondCycle = !!niveauBac;

            type PebsSubj = { subjectName: string; coefficient: number; weeklyPeriods: number | null };
            let pebsSubjects: PebsSubj[];
            let generalSerieCode: string; // serieCode sous lequel sont stockées les matières générales de cette classe

            if (isSecondCycle) {
              // 2nd cycle : matières spécifiques ABI (série bilingue intensive) via BacCoefficient
              const bacCoeffs = await tx.bacCoefficient.findMany({
                where: { serie: 'ABI', niveau: niveauBac, templateCode: { in: [templateCode ?? '', '__ALL__'] } },
              });
              pebsSubjects = bacCoeffs.map(bc => ({ subjectName: bc.subjectName, coefficient: bc.coefficient, weeklyPeriods: null }));
              generalSerieCode = cls.serie ?? '';
            } else {
              // 1er cycle : matières FR_PEBS via CycleCoefficient
              const cycleCoeffs = await tx.cycleCoefficient.findMany({
                where: { templateCode: templateCode ?? '', classLevel: cls.level, filiere: 'FR_PEBS' },
              });
              pebsSubjects = cycleCoeffs.map(cc => ({ subjectName: cc.subjectName, coefficient: cc.coefficient, weeklyPeriods: cc.weeklyPeriods }));
              generalSerieCode = 'FR_GENERAL';
            }
            if (pebsSubjects.length === 0) continue;

            // Lister les sujets déjà disponibles via le curriculum général de la classe (déduplication)
            const generalSubjIds = await tx.subjectCoefficient.findMany({
              where: { schoolId, classLevel: cls.level, serieCode: generalSerieCode },
              select: { subjectId: true },
            });
            const generalSubjSet = new Set(generalSubjIds.map(s => s.subjectId));

            for (const ps of pebsSubjects) {
              // Créer la matière PEBS si elle n'existe pas encore dans l'école
              let subjId = subjectByName.get(ps.subjectName);
              if (!subjId) {
                const created = await tx.subject.create({
                  data: {
                    schoolId,
                    name: ps.subjectName,
                    code: ps.subjectName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8),
                    coefficient: ps.coefficient,
                    hoursPerWeek: ps.weeklyPeriods ?? 2,
                    subjectType: 'THEORETICAL',
                  },
                });
                subjId = created.id;
                subjectByName.set(ps.subjectName, subjId);
                subjectCount++;
              }

              // Ne pas dupliquer une matière déjà présente dans le curriculum général
              if (generalSubjSet.has(subjId)) continue;

              const exists = await tx.classSubjectOverride.findUnique({
                where: { classId_subjectId: { classId: cls.id, subjectId: subjId } },
                select: { id: true },
              });
              if (!exists) {
                await tx.classSubjectOverride.create({
                  data: { schoolId, classId: cls.id, subjectId: subjId, coefficient: ps.coefficient },
                });
              }
            }
          }
        }
      }

      // FeePlans de base depuis feesTypes (montant à définir plus tard par l'admin)
      if (Array.isArray(config?.feesTypes) && config.feesTypes.length > 0) {
        const FEE_MAP: Record<string, { feeType: string; name: string; refundable?: boolean }> = {
          TUITION:          { feeType: 'TUITION',          name: 'Frais de scolarité' },
          APEE_PTA:         { feeType: 'APEE_PTA',         name: 'Frais APEE / PTA' },
          EXAM:             { feeType: 'EXAM',             name: "Frais d'examen" },
          UNIFORM:          { feeType: 'UNIFORM',          name: "Frais d'uniforme" },
          INSCRIPTION:      { feeType: 'INSCRIPTION',      name: "Frais d'inscription / réinscription" },
          CAUTION:          { feeType: 'CAUTION',          name: 'Caution', refundable: true },
          DEVELOPMENT_LEVY: { feeType: 'DEVELOPMENT_LEVY', name: 'Frais de développement' },
          SPORTS_LEVY:      { feeType: 'SPORTS_LEVY',      name: 'Frais de sport / activités' },
        };
        for (const t of config.feesTypes as string[]) {
          const def = FEE_MAP[t];
          if (!def) continue;
          const exists = await tx.feePlan.findFirst({ where: { schoolId, feeType: def.feeType as any }, select: { id: true } });
          if (exists) continue;
          await tx.feePlan.create({
            data: {
              schoolId,
              name: def.name,
              amount: 0,
              feeType: def.feeType as any,
              isRefundable: def.refundable ?? false,
              description: 'Créé à la configuration — montant à définir',
            },
          });
        }
      }

      // Services + rôles de direction → School.features (Json)
      const featuresPatch: Record<string, unknown> = {};
      const hasServiceFlags = ['hasCanteen', 'hasTransport', 'hasLibrary', 'hasBoarding']
        .some((k) => typeof (config as any)?.[k] === 'boolean');
      if (hasServiceFlags) {
        featuresPatch['services'] = {
          canteen: !!config?.hasCanteen,
          transport: !!config?.hasTransport,
          library: !!config?.hasLibrary,
          boarding: !!config?.hasBoarding,
        };
      }
      if (config?.directionRoles && typeof config.directionRoles === 'object') {
        featuresPatch['directionRoles'] = config.directionRoles;
      }
      if (config?.paymentTranches) {
        featuresPatch['paymentTranches'] = Number(config.paymentTranches) || 1;
      }

      // 9. Passer le statut à ACTIVE + sauvegarder les flags PEBS (+ features fusionnées)
      const mergedFeatures = Object.keys(featuresPatch).length > 0
        ? { ...(typeof school.features === 'object' && school.features ? school.features as Record<string, unknown> : {}), ...featuresPatch }
        : undefined;
      await tx.school.update({
        where: { id: schoolId },
        data: {
          status: 'ACTIVE',
          hasPEBSFrancophone,
          hasPEBSAnglophone,
          ...(mergedFeatures ? { features: mergedFeatures as any } : {}),
        },
      });

      // 10. Marquer le formulaire de configuration comme complété
      if (school.configurationForm) {
        await tx.schoolConfigurationForm.update({
          where: { schoolId },
          data: { completedAt: new Date() },
        });
      }
    });

    return {
      schoolId: school.id,
      message: `Établissement "${school.name}" activé avec succès`,
      classCount,
      subjectCount,
      academicYear: academicYearName,
    };
  }
}
