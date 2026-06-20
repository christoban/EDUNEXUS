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
} from './SubjectAssignmentHelper';
import { getTemplateMeta, isPEBSFrancophoneEligible, isPEBSAnglophoneEligible } from './schoolTemplateConfig';

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
      // 1. Créer l'année académique courante
      const now = new Date();
      const currentYear = now.getFullYear();
      academicYearName = `${currentYear}-${currentYear + 1}`;
      const academicYear = await tx.academicYear.create({
        data: {
          schoolId,
          name: `${currentYear}-${currentYear + 1}`,
          startDate: new Date(`${currentYear}-09-01`),
          endDate: new Date(`${currentYear + 1}-06-30`),
          isCurrent: true,
          status: 'ACTIVE',
        },
      });

      // 2. Créer 3 périodes (Trimestre FR / Term EN)
      const periodType  = isAnglophone ? 'TERM' as const : 'TRIMESTER' as const;
      const periodNames = isAnglophone
        ? ['Term 1', 'Term 2', 'Term 3']
        : ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];

      const trimestres = [
        { name: periodNames[0], startDate: new Date(`${currentYear}-09-01`),     endDate: new Date(`${currentYear}-12-31`)     },
        { name: periodNames[1], startDate: new Date(`${currentYear + 1}-01-01`), endDate: new Date(`${currentYear + 1}-03-31`) },
        { name: periodNames[2], startDate: new Date(`${currentYear + 1}-04-01`), endDate: new Date(`${currentYear + 1}-06-30`) },
      ];

      for (let i = 0; i < trimestres.length; i++) {
        const t = trimestres[i];
        const period = await tx.academicPeriod.create({
          data: {
            academicYearId: academicYear.id,
            name: t.name,
            type: periodType,
            orderIndex: i + 1,
            startDate: t.startDate,
            endDate: t.endDate,
            isCurrent: i === 0,
          },
        });

        // 3. Créer 2 séquences par période (nommage FR vs EN)
        type SeqDef = { name: string; type: 'DS' | 'COMPOSITION' | 'CLASS_TEST' | 'TERMINAL_EXAM' };
        const seqDefs: SeqDef[] = isAnglophone
          ? [
              { name: 'Sequence 1', type: 'CLASS_TEST'    },
              { name: 'Sequence 2', type: 'TERMINAL_EXAM' },
            ]
          : [
              { name: i < 2 ? `DS${i * 2 + 1}` : 'DS5',       type: 'DS'          },
              { name: i < 2 ? `DS${i * 2 + 2}` : 'Composition', type: i < 2 ? 'DS' : 'COMPOSITION' },
            ];

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
      let classesACreer: { name: string; level: string; schoolId: string; serie?: string | null; filiere?: string | null }[] = [];
      if (config) {

        // 4a. 1er cycle (avec filiere PEBS/GENERAL)
        if (config.niveaux1erCycle?.length > 0) {
          const conv = config.conventionNommage ?? 'LETTRES';
          for (const niveau of config.niveaux1erCycle) {
            const count = config.classesParNiveau?.[niveau] ?? 2;
            for (let i = 0; i < Math.min(count, 26); i++) {
              const suffix = conv === 'LETTRES' ? LETTRES[i]
                : conv === 'CHIFFRES' ? `${i + 1}`
                : `${LETTRES[i]}1`;
              // PEBS: première classe (A) = FR_PEBS/EN_PEBS, reste = GENERAL
              const isPEBSClass = i === 0 && (
                (hasPEBSFrancophone && !isAnglophone) ||
                (hasPEBSAnglophone && isAnglophone)
              );
              const filiere = isPEBSClass
                ? (isAnglophone ? 'EN_PEBS' : 'FR_PEBS')
                : (isAnglophone ? 'EN_GENERAL' : 'FR_GENERAL');
              classesACreer.push({ name: `${niveau} ${suffix}`, level: niveau, schoolId, filiere });
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
          for (const niveau of config.niveaux2eCycle) {
            for (const filiere of config.filieres) {
              if (niveau === '2nde' && estFiliereTechnique(filiere)) continue;

              if (filiere.startsWith('A4') || filiere.includes('A4')) {
                const langs = config.a4Languages?.length ? config.a4Languages : ['LV'];
                for (const lang of langs) {
                  classesACreer.push({ name: `${niveau} A4-${lang}`, level: niveau, schoolId, serie: `A4-${lang}` });
                }
              } else {
                const serie = extraireSerie(filiere);
                for (let i = 0; i < nbClasses; i++) {
                  const suffix = nbClasses > 1 ? ` ${LETTRES[i]}` : '';
                  classesACreer.push({ name: `${niveau} ${serie}${suffix}`, level: niveau, schoolId, serie });
                }
              }
            }
          }
        }

        // 4c. LYCEE_BILINGUE — EN section classes
        if (config.templateCode === 'LYCEE_BILINGUE' && config.bilingualEnLevels?.length > 0) {
          const enFilieres: string[] = config.bilingualEnFilieres ?? [];
          for (const niveau of config.bilingualEnLevels as string[]) {
            if (enFilieres.length === 0) {
              classesACreer.push({ name: `${niveau} EN`, level: niveau, schoolId });
            } else {
              for (const filiere of enFilieres) {
                const serie = filiere.match(/^([A-Z][0-9])/)?.[1] ?? filiere;
                classesACreer.push({ name: `${niveau} ${serie}`, level: niveau, schoolId });
              }
            }
          }
        }

        // 4d. PRIMARY_BILINGUAL — EN section classes
        if (config.templateCode === 'PRIMARY_BILINGUAL' && config.bilingualEnLevels?.length > 0) {
          for (const niveau of config.bilingualEnLevels as string[]) {
            classesACreer.push({ name: `${niveau} EN`, level: niveau, schoolId });
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

        // Sauvegarder toutes les classes (avec serie pour le 2e cycle, filiere pour le 1er cycle/PEBS)
        for (const c of classesACreer) {
          await tx.class.create({
            data: { name: c.name, level: c.level, schoolId: c.schoolId, serie: c.serie ?? null, filiere: c.filiere ?? null },
          });
        }
        classCount = classesACreer.length;
      }

      // 4f. Créer les matières depuis template.config.defaultSubjects
      // Fallback : si school.templateCode n'était pas renseigné au moment de l'activation,
      // on récupère le template via onboardingConfig.templateCode
      let effectiveTemplate: any = school.template;
      if (!effectiveTemplate && templateCode) {
        effectiveTemplate = await tx.schoolTemplate.findUnique({ where: { code: templateCode } });
      }
      // Templates with full reference data (CycleCoefficients, BacCoefficients, AnglophoneSubjectLoad)
      // skip 4f — section 4g below creates subjects on-demand from correct reference data instead.
      const TEMPLATES_WITH_REFERENCE_DATA = ['LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'GHS_EN', 'GSS_EN', 'PRIVE_EN', 'LYCEE_BILINGUE'];
      const hasReferenceData = templateCode && TEMPLATES_WITH_REFERENCE_DATA.includes(templateCode);
      if (effectiveTemplate && !hasReferenceData) {
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

      // 4g. SubjectCoefficients pour toutes les classes (1er cycle + 2e cycle)
      if (classesACreer.length > 0) {
        const schoolSubjects = await tx.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
        const subjectByName  = new Map(schoolSubjects.map(s => [s.name, s.id]));
        const subjectCountRef = { value: 0 };

        // Déduplication par (level, serie, filiere) pour limiter les requêtes BacCoefficient
        // mais A4 doit être traité par (level, serie, langue) pour créer les LV2 réels
        const processedKeys = new Set<string>();
        for (const c of classesACreer) {
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

      // 4h. Créer les départements pédagogiques selon le template (uniquement secondaire)
      if (templateCode && !isPrimaire) {
        const schoolSubjects = await tx.subject.findMany({ where: { schoolId } });
        const FR_DEPT_TEMPLATES = ['LYCEE_FR', 'PRIVE_FR', 'CES_FR', 'LYCEE_BILINGUE'];
        const EN_DEPT_TEMPLATES = ['GHS_EN', 'GSS_EN', 'PRIVE_EN'];
        const subjectNamesLower = new Set(schoolSubjects.map(s => s.name.toLowerCase()));

        interface DeptDef { name: string; color: string; keywords: string[]; }
        let deptDefs: DeptDef[] = [];

        if (FR_DEPT_TEMPLATES.includes(templateCode)) {
          deptDefs = [
            { name: 'Lettres', color: '#3b82f6', keywords: ['français', 'littérature', 'philosophie', 'écriture', 'lecture', 'grammaire', 'francais', 'litterature'] },
            { name: 'Sciences Humaines', color: '#f59e0b', keywords: ['histoire', 'géographie', 'éducation civique', 'ecm', 'hgg', 'h-g', 'geographie'] },
            { name: 'Langues Vivantes', color: '#10b981', keywords: ['anglais', 'allemand', 'espagnol', 'langue vivante', 'lv1', 'lv2', 'lvent', 'lv', 'english'] },
            { name: 'Mathématiques et Sciences', color: '#ef4444', keywords: ['mathématiques', 'maths', 'math', 'physique', 'chimie', 'svt', 'science'] },
            { name: 'Arts et Culture', color: '#f97316', keywords: ['art', 'musique', 'danse', 'culture', 'éducation artistique', 'education artistique'] },
          ];
          if (subjectNamesLower.has('informatique')) {
            deptDefs.push({ name: 'Informatique', color: '#8b5cf6', keywords: ['informatique', 'tic', 'ntic', 'computer', 'technologie'] });
          }
          deptDefs.push({ name: 'Autres', color: '#9ca3af', keywords: [] });
        } else if (EN_DEPT_TEMPLATES.includes(templateCode)) {
          deptDefs = [
            { name: 'Languages', color: '#3b82f6', keywords: ['english', 'french', 'literature', 'language', 'linguistics'] },
            { name: 'Social Sciences', color: '#f59e0b', keywords: ['history', 'geography', 'social', 'civics', 'economics'] },
            { name: 'Sciences', color: '#ef4444', keywords: ['mathematics', 'math', 'physics', 'chemistry', 'biology', 'science'] },
            { name: 'Technical', color: '#8b5cf6', keywords: ['computer', 'ict', 'technology', 'technical', 'engineering', 'design'] },
            { name: 'PE & Arts', color: '#10b981', keywords: ['physical', 'pe', 'sport', 'art', 'music', 'drama', 'health'] },
            { name: 'Others', color: '#9ca3af', keywords: [] },
          ];
        }

        if (deptDefs.length > 0) {
          const matchedSubjectIds = new Set<string>();
          const createdDepartments: { id: string; name: string }[] = [];

          for (const def of deptDefs) {
            const department = await tx.department.create({
              data: { schoolId, name: def.name, color: def.color },
            });
            createdDepartments.push({ id: department.id, name: def.name });

            if (def.keywords.length > 0) {
              const matching = schoolSubjects.filter(s =>
                !matchedSubjectIds.has(s.id) &&
                def.keywords.some(kw => s.name.toLowerCase().includes(kw))
              );
              for (const subj of matching) {
                matchedSubjectIds.add(subj.id);
                await tx.subject.update({
                  where: { id: subj.id },
                  data: { departmentId: department.id },
                });
              }
            }
          }

          // Subjects non assignés → dernier département (Autres/Others)
          const fallbackDept = createdDepartments[createdDepartments.length - 1];
          for (const subj of schoolSubjects) {
            if (!matchedSubjectIds.has(subj.id)) {
              await tx.subject.update({
                where: { id: subj.id },
                data: { departmentId: fallbackDept.id },
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
        const mentionId = (isPrimaire && !isAnglophone) ? 'default-apc-mentions'
          : isAnglophone                                ? 'default-en-mentions'
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
          termsPerYear: 3,
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

      // 9. Passer le statut à ACTIVE + sauvegarder les flags PEBS
      await tx.school.update({
        where: { id: schoolId },
        data: { status: 'ACTIVE', hasPEBSFrancophone, hasPEBSAnglophone },
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
