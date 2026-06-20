/**
 * Bootstrap hexagonal — intégration progressive dans server.ts existant
 *
 * Usage dans server.ts :
 *   import { bootstrapHexagonal } from './infrastructure/config/hexagonal.bootstrap';
 *   bootstrapHexagonal(app);
 */
import type { Application } from 'express';
import { creerContainer } from '@infrastructure/config/container';
import { GradeController } from '@infrastructure/http/controllers/GradeController';
import { AttendanceController } from '@infrastructure/http/controllers/AttendanceController';
import { SchoolOnboardingController } from '@infrastructure/http/controllers/SchoolOnboardingController';
import { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { ClassCouncilController } from '@infrastructure/http/controllers/ClassCouncilController';
import { creerGradeRoutes } from '@infrastructure/http/routes/grade.routes';
import { creerAttendanceRoutes } from '@infrastructure/http/routes/attendance.routes';
import { creerOnboardingRoutes } from '@infrastructure/http/routes/onboarding.routes';
import { creerReportCardRoutes } from '@infrastructure/http/routes/reportCard.routes';
import { creerClassCouncilRoutes } from '@infrastructure/http/routes/classCouncil.routes';
import { protectMaster, authorizeMaster } from '../../middleware/authMultiTenant';
import { errorHandler } from '@infrastructure/http/middlewares/errorHandler';
import { DevController } from '@infrastructure/http/controllers/DevController';
import { creerDevRoutes } from '@infrastructure/http/routes/dev.routes';
import { UserController } from '@infrastructure/http/controllers/UserController';
import { MasterAdminHexController } from '@infrastructure/http/controllers/MasterAdminHexController';
import { creerUserRoutes } from '@infrastructure/http/routes/user.routes';
import { creerMasterAdminHexRoutes } from '@infrastructure/http/routes/masterAdminHex.routes';
import { FinanceController } from '@infrastructure/http/controllers/FinanceController';
import { creerFinanceRoutes } from '@infrastructure/http/routes/finance.routes';
import { ClasseController } from '@infrastructure/http/controllers/ClasseController';
import { SubjectController } from '@infrastructure/http/controllers/SubjectController';
import { AcademicYearController } from '@infrastructure/http/controllers/AcademicYearController';
import { TimetableController } from '@infrastructure/http/controllers/TimetableController';
import { ParentController } from '@infrastructure/http/controllers/ParentController';
import { SchoolSettingsController } from '@infrastructure/http/controllers/SchoolSettingsController';
import { creerClasseRoutes } from '@infrastructure/http/routes/classe.routes';
import { creerSubjectRoutes } from '@infrastructure/http/routes/subject.routes';
import { creerAcademicYearRoutes } from '@infrastructure/http/routes/academicYear.routes';
import { creerTimetableRoutes } from '@infrastructure/http/routes/timetable.routes';
import { creerParentRoutes } from '@infrastructure/http/routes/parent.routes';
import { creerSchoolSettingsRoutes } from '@infrastructure/http/routes/schoolSettings.routes';
import { ActivitiesLogController } from '@infrastructure/http/controllers/ActivitiesLogController';
import { DashboardController } from '@infrastructure/http/controllers/DashboardController';
import { EmailLogController } from '@infrastructure/http/controllers/EmailLogController';
import { SearchController } from '@infrastructure/http/controllers/SearchController';
import { AIController } from '@infrastructure/http/controllers/AIController';
import { CoreDomainController } from '@infrastructure/http/controllers/CoreDomainController';
import { PublicController } from '@infrastructure/http/controllers/PublicController';
import { SMSController } from '@infrastructure/http/controllers/SMSController';
import { InviteOnboardingController } from '@infrastructure/http/controllers/InviteOnboardingController';
import { TemplateController } from '@infrastructure/http/controllers/TemplateController';
import { TeachingAssignmentController } from '@infrastructure/http/controllers/TeachingAssignmentController';
import { creerTeachingAssignmentRoutes } from '@infrastructure/http/routes/teaching-assignment.routes';
import { TimetableGridConfigController, calculerSqelette } from '@infrastructure/http/controllers/TimetableGridConfigController';
import { creerTimetableGridConfigRoutes } from '@infrastructure/http/routes/timetable-grid-config.routes';
import { DepartmentController } from '@infrastructure/http/controllers/DepartmentController';
import { creerDepartmentRoutes } from '@infrastructure/http/routes/department.routes';
import { ActiverEtablissementUseCase } from '@application/school/ActiverEtablissementUseCase';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import {
  assignerMatieresPourClasse,
  CYCLE2_LEVELS as SYNC_CYCLE2_LEVELS,
  parseSerie as syncParseSerie,
} from '@application/school/SubjectAssignmentHelper';
import { creerSchoolConfigRoutes } from '@infrastructure/http/routes/school-config.routes';
import { OrientationController } from '@infrastructure/http/controllers/OrientationController';
import { creerActivitiesRoutes } from '@infrastructure/http/routes/activities.routes';
import { creerDashboardRoutes } from '@infrastructure/http/routes/dashboard.routes';
import { creerEmailLogRoutes } from '@infrastructure/http/routes/emailLog.routes';
import { creerSearchRoutes } from '@infrastructure/http/routes/search.routes';
import { creerAIRoutes } from '@infrastructure/http/routes/ai.routes';
import { creerCoreDomainRoutes } from '@infrastructure/http/routes/coreDomain.routes';
import { creerPublicRoutes } from '@infrastructure/http/routes/public.routes';
import { creerSMSRoutes } from '@infrastructure/http/routes/sms.routes';
import { creerOrientationRoutes } from '@infrastructure/http/routes/orientation.routes';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { DesignerAPUseCase } from '@application/user/DesignerAPUseCase';
import { LoginMasterUseCase } from '@application/masterAdmin/LoginMasterUseCase';
import { VerifyMfaUseCase } from '@application/masterAdmin/VerifyMfaUseCase';
import { MasterAuthController } from '@infrastructure/http/controllers/MasterAuthController';
import { creerMasterAuthRoutes } from '@infrastructure/http/routes/masterAuth.routes';
import { sendTransactionalEmail } from '../../services/emailService';
import { requireAuth, requireRole } from '../../middleware/auth';
import { requireMasterSensitiveAuth } from '../../middleware/masterSensitiveAuth';

export function bootstrapHexagonal(app: Application): void {
  const container = creerContainer();

  const gradeController = new GradeController(
    container.grade.saisirNote,
    container.grade.soumettreNote,
    container.grade.validerNote,
    container.grade.rejeterNote,
    container.grade.validerEnBloc,
  );

  const attendanceController = new AttendanceController(
    container.attendance.enregistrerPresence,
  );

  const onboardingController = new SchoolOnboardingController(
    container.school.onboarder,
    container.school.approuver,
  );

  const reportCardController = new ReportCardController(
    container.reportCard.generer,
    container.reportCard.envoyer,
  );

  const classCouncilController = new ClassCouncilController();

  // ── Routes publiques d'onboarding par invitation (pas d'auth requise) ──
  const inviteOnboardingController = new InviteOnboardingController(prisma);
  app.get('/api/v2/onboarding/invite/:token', inviteOnboardingController.validateInvite);
  app.post('/api/v2/onboarding/invite/:token/complete', inviteOnboardingController.completeOnboarding);
  app.post('/api/v2/onboarding/preview-structure', inviteOnboardingController.previewStructure);

  // ── Templates Excel téléchargeables (admin uniquement) ────────────────
  const templateController = new TemplateController(prisma);
  app.get('/api/v2/templates/import-eleves', requireAuth, requireRole('ADMIN'), templateController.importEleves);
  app.get('/api/v2/templates/import-enseignants', requireAuth, requireRole('ADMIN'), templateController.importEnseignants);

  // ── Informations de l'école (utilisateurs authentifiés) ──────────────
  app.get('/api/v2/school/me', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true, name: true, subdomain: true, logoUrl: true, plan: true, city: true, region: true, phone: true, email: true, subsystem: true, status: true, educationType: true, ownership: true, onboardingConfig: true, hasPEBSFrancophone: true, hasPEBSAnglophone: true },
      });
      if (!school) { res.status(404).json({ success: false, message: 'École introuvable' }); return; }
      res.json({ success: true, data: school });
    } catch (err) { next(err); }
  });

  // ── Mise à jour du logo (ADMIN uniquement) ────────────────────────────
  app.patch('/api/v2/school/logo', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { logoBase64 } = req.body as { logoBase64?: string };
      // Suppression si chaîne vide
      if (logoBase64 === '' || logoBase64 === null || logoBase64 === undefined) {
        const school = await prisma.school.update({ where: { id: schoolId }, data: { logoUrl: null }, select: { logoUrl: true } });
        res.json({ success: true, data: { logoUrl: school.logoUrl } });
        return;
      }
      if (!logoBase64.startsWith('data:image/')) {
        res.status(400).json({ success: false, message: 'Format de logo invalide. Envoyez une image en base64.' });
        return;
      }
      if (logoBase64.length > 2_000_000) {
        res.status(400).json({ success: false, message: 'Logo trop volumineux (max 1.5 MB).' });
        return;
      }
      const school = await prisma.school.update({
        where: { id: schoolId },
        data: { logoUrl: logoBase64 },
        select: { logoUrl: true },
      });
      res.json({ success: true, data: { logoUrl: school.logoUrl } });
    } catch (err) { next(err); }
  });

  // ── Prévisualisation des classes pour la page /admin/configuration ───────
  app.get('/api/v2/schools/:id/configuration/preview', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.params.id as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' }); return;
      }
      const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { onboardingConfig: true } });
      if (!school) { res.status(404).json({ success: false, message: 'École introuvable' }); return; }

      const cfg = (school.onboardingConfig ?? {}) as any;
      const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const classes: { name: string; level: string }[] = [];

      if (cfg.niveaux1erCycle) {
        const conv = cfg.conventionNommage ?? 'LETTRES';
        for (const n of cfg.niveaux1erCycle) {
          const c = cfg.classesParNiveau?.[n] ?? 2;
          for (let i = 0; i < Math.min(c, 26); i++) {
            const s = conv === 'LETTRES' ? L[i] : conv === 'CHIFFRES' ? `${i + 1}` : `${L[i]}1`;
            classes.push({ name: `${n} ${s}`, level: n });
          }
        }
      }
      if (cfg.niveaux2eCycle && cfg.filieres) {
        const nb = cfg.classesParFiliere === '3+' ? 3 : parseInt(cfg.classesParFiliere ?? '1');
        for (const n of cfg.niveaux2eCycle) {
          for (const f of cfg.filieres) {
            if (n === '2nde' && (/^TI/.test(f) || /F\s*·\s*G\s*·\s*H/.test(f) || /technique/i.test(f))) continue;
            if (f.startsWith('A4') || f.includes('A4')) {
              for (const lang of (cfg.a4Languages?.length ? cfg.a4Languages : ['LV'])) {
                classes.push({ name: `${n} A4-${lang}`, level: n });
              }
            } else {
              const short = f.split('—')[0]?.trim() ?? f;
              for (let i = 0; i < nb; i++) classes.push({ name: `${n} ${short}${nb > 1 ? ` ${L[i]}` : ''}`, level: n });
            }
          }
        }
      }
      if (cfg.niveauxPrimaire) {
        for (const n of cfg.niveauxPrimaire) {
          const c = cfg.classesParNiveauPrimaire?.[n] ?? 1;
          for (let i = 0; i < Math.min(c, 26); i++) classes.push({ name: `${n} ${L[i]}`, level: n });
        }
      }

      res.json({ success: true, data: { classes, totalClasses: classes.length } });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/school/profile ─────────────────────────────────────────
  app.patch('/api/v2/school/profile', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { name, city, phone, email } = req.body as { name?: string; city?: string; phone?: string; email?: string };
      const data: Record<string, string> = {};
      if (name)  data['name']  = name;
      if (city)  data['city']  = city;
      if (phone) data['phone'] = phone;
      if (email) data['email'] = email;
      const school = await prisma.school.update({ where: { id: schoolId }, data, select: { id: true, name: true, city: true, phone: true, email: true } });
      res.json({ success: true, data: school });
    } catch (err) { next(err); }
  });

  // ── GET  /api/v2/schools/check-subdomain ─────────────────────────────────
  app.get('/api/v2/schools/check-subdomain', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const value = (req.query['value'] as string | undefined)?.trim();
      if (!value) { res.status(400).json({ success: false, message: 'Valeur requise' }); return; }
      const existing = await prisma.school.findFirst({ where: { subdomain: value, id: { not: req.user!.schoolId } } });
      res.json({ success: true, available: !existing });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/schools/:id/subdomain ──────────────────────────────────
  app.patch('/api/v2/schools/:id/subdomain', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const { newSubdomain } = req.body as { newSubdomain?: string };
      if (!newSubdomain?.trim()) { res.status(400).json({ success: false, message: 'Sous-domaine requis' }); return; }
      const v = newSubdomain.trim();
      if (v.length < 3)  { res.status(400).json({ success: false, message: 'Minimum 3 caractères' }); return; }
      if (v.length > 30) { res.status(400).json({ success: false, message: 'Maximum 30 caractères' }); return; }
      if (!/^[a-z0-9-]+$/.test(v)) { res.status(400).json({ success: false, message: 'Format invalide : lettres, chiffres et tirets uniquement' }); return; }
      const taken = await prisma.school.findFirst({ where: { subdomain: v, id: { not: schoolId } } });
      if (taken) { res.status(400).json({ success: false, message: 'Ce sous-domaine est déjà utilisé' }); return; }
      await prisma.school.update({ where: { id: schoolId }, data: { subdomain: v } });
      res.json({ success: true, newSubdomain: v });
    } catch (err) { next(err); }
  });

  // ── POST /api/v2/schools/:id/sync-subjects ────────────────────────────────
  // Crée rétroactivement les SubjectCoefficients pour les classes qui n'en ont pas
  app.post('/api/v2/schools/:id/sync-subjects', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }

      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { onboardingConfig: true, templateCode: true },
      });
      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const config = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const templateCode = (config['templateCode'] as string | undefined) ?? school.templateCode ?? '';
      const isAnglophone = getTemplateMeta(templateCode).isAnglophone;

      const classes = await prisma.class.findMany({
        where: { schoolId },
        select: { id: true, name: true, level: true, serie: true, filiere: true },
        orderBy: { name: 'asc' },
      });

      const schoolSubjects = await prisma.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
      const subjectByName  = new Map(schoolSubjects.map(s => [s.name, s.id]));
      const subjectCountRef = { value: 0 };

      let classesTraitees = 0;
      let classesSkippees = 0;
      let coefficientsCreated = 0;
      const detail: { className: string; action: string }[] = [];

      for (const cls of classes) {
        if (!cls.level) { classesSkippees++; continue; }

        // Déterminer la série pour ce niveau
        const seriePart = syncParseSerie(cls.name, cls.level);
        // Pour A4, utiliser le nom complet (ex: "A4-Arabe") comme serieCode
        // Pour 1er cycle, utiliser la filière (FR_PEBS / FR_GENERAL)
        const nameParts = cls.name.split(' ');
        const rawSerie = (SYNC_CYCLE2_LEVELS as string[]).includes(cls.level) ? (nameParts[1] ?? '') : '';
        const dashIdx = rawSerie.indexOf('-');
        const effectiveSerieCode = seriePart === 'A4' && dashIdx >= 0
          ? rawSerie
          : seriePart ?? cls.filiere ?? null;

        // Vérifier si des SubjectCoefficients existent déjà pour ce niveau+serie
        const existing = await prisma.subjectCoefficient.count({
          where: {
            schoolId,
            classLevel: cls.level,
            serieCode: effectiveSerieCode ?? null,
          },
        });
        if (existing > 0) {
          classesSkippees++;
          detail.push({ className: cls.name, action: 'skipped (coefficients already exist)' });
          continue;
        }

        // Mettre à jour Class.serie si absent
        if (!cls.serie && seriePart && (SYNC_CYCLE2_LEVELS as string[]).includes(cls.level)) {
          await prisma.class.update({ where: { id: cls.id }, data: { serie: effectiveSerieCode } });
        }

        const beforeCount = subjectCountRef.value;
        const beforeCoeffs = await prisma.subjectCoefficient.count({ where: { schoolId } });

        await assignerMatieresPourClasse(
          prisma, { name: cls.name, level: cls.level, filiere: cls.filiere ?? undefined }, schoolId,
          config, isAnglophone, subjectByName, subjectCountRef, templateCode,
        );

        const afterCoeffs = await prisma.subjectCoefficient.count({ where: { schoolId } });
        coefficientsCreated += afterCoeffs - beforeCoeffs;
        void beforeCount;
        classesTraitees++;
        detail.push({ className: cls.name, action: 'processed' });
      }

      // Déclencher la création des départements si aucun n'existe
      const deptCount = await prisma.department.count({ where: { schoolId } });
      if (deptCount === 0 && templateCode) {
        const FR_DEPT_TEMPLATES = ['LYCEE_FR', 'PRIVE_FR', 'CES_FR', 'LYCEE_BILINGUE'];
        const EN_DEPT_TEMPLATES = ['GHS_EN', 'GSS_EN', 'PRIVE_EN'];
        const allTemplates = [...FR_DEPT_TEMPLATES, ...EN_DEPT_TEMPLATES];
        if (allTemplates.includes(templateCode)) {
          const meta = getTemplateMeta(templateCode);
          if (!meta.isPrimaire) {
            const allSubjects = await prisma.subject.findMany({ where: { schoolId } });
            const subjectNamesLower = new Set(allSubjects.map(s => s.name.toLowerCase()));
            interface DeptDef { name: string; color: string; keywords: string[]; }
            let deptDefs: DeptDef[] = FR_DEPT_TEMPLATES.includes(templateCode) ? [
              { name: 'Lettres', color: '#3b82f6', keywords: ['français', 'littérature', 'philosophie', 'écriture', 'lecture', 'grammaire', 'francais', 'litterature'] },
              { name: 'Sciences Humaines', color: '#f59e0b', keywords: ['histoire', 'géographie', 'éducation civique', 'ecm', 'hgg', 'h-g', 'geographie'] },
              { name: 'Langues Vivantes', color: '#10b981', keywords: ['anglais', 'allemand', 'espagnol', 'langue vivante', 'lv1', 'lv2', 'lvent', 'lv', 'english'] },
              { name: 'Mathématiques et Sciences', color: '#ef4444', keywords: ['mathématiques', 'maths', 'math', 'physique', 'chimie', 'svt', 'science'] },
              { name: 'Arts et Culture', color: '#f97316', keywords: ['art', 'musique', 'danse', 'culture', 'éducation artistique', 'education artistique'] },
            ] : [
              { name: 'Languages', color: '#3b82f6', keywords: ['english', 'french', 'literature', 'language', 'linguistics'] },
              { name: 'Social Sciences', color: '#f59e0b', keywords: ['history', 'geography', 'social', 'civics', 'economics'] },
              { name: 'Sciences', color: '#ef4444', keywords: ['mathematics', 'math', 'physics', 'chemistry', 'biology', 'science'] },
              { name: 'Technical', color: '#8b5cf6', keywords: ['computer', 'ict', 'technology', 'technical', 'engineering', 'design'] },
              { name: 'PE & Arts', color: '#10b981', keywords: ['physical', 'pe', 'sport', 'art', 'music', 'drama', 'health'] },
            ];
            if (FR_DEPT_TEMPLATES.includes(templateCode) && subjectNamesLower.has('informatique')) {
              deptDefs.push({ name: 'Informatique', color: '#8b5cf6', keywords: ['informatique', 'tic', 'ntic', 'computer', 'technologie'] });
            }
            deptDefs.push({ name: FR_DEPT_TEMPLATES.includes(templateCode) ? 'Autres' : 'Others', color: '#9ca3af', keywords: [] });

            const matchedSubjectIds = new Set<string>();
            const createdIds: { id: string; name: string }[] = [];
            for (const def of deptDefs) {
              const d = await prisma.department.create({ data: { schoolId, name: def.name, color: def.color } });
              createdIds.push({ id: d.id, name: def.name });
              if (def.keywords.length > 0) {
                const matching = allSubjects.filter(s => !matchedSubjectIds.has(s.id) && def.keywords.some(kw => s.name.toLowerCase().includes(kw)));
                for (const subj of matching) {
                  matchedSubjectIds.add(subj.id);
                  await prisma.subject.update({ where: { id: subj.id }, data: { departmentId: d.id } });
                }
              }
            }
            const fallback = createdIds[createdIds.length - 1];
            for (const subj of allSubjects) {
              if (!matchedSubjectIds.has(subj.id)) {
                await prisma.subject.update({ where: { id: subj.id }, data: { departmentId: fallback.id } });
              }
            }
          }
        }
      }

      res.json({
        success: true,
        data: {
          classesTraitees,
          classesSkippees,
          subjectsCreated: subjectCountRef.value,
          coefficientsCreated,
          detail,
        },
      });
    } catch (err) { next(err); }
  });

  // ── GET  /api/v2/schools/:id/notification-settings ───────────────────────
  app.get('/api/v2/schools/:id/notification-settings', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const settings = await (prisma as any).schoolNotificationSettings.upsert({
        where: { schoolId },
        create: { schoolId },
        update: {},
      });
      res.json({ success: true, data: settings });
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/schools/:id/notification-settings ──────────────────────
  app.patch('/api/v2/schools/:id/notification-settings', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const { smsAbsences, smsPayments, smsBulletins, emailDigestAdmin, smsLowBalance } = req.body;
      const data: Record<string, boolean> = {};
      if (smsAbsences      !== undefined) data['smsAbsences']      = Boolean(smsAbsences);
      if (smsPayments      !== undefined) data['smsPayments']      = Boolean(smsPayments);
      if (smsBulletins     !== undefined) data['smsBulletins']     = Boolean(smsBulletins);
      if (emailDigestAdmin !== undefined) data['emailDigestAdmin'] = Boolean(emailDigestAdmin);
      if (smsLowBalance    !== undefined) data['smsLowBalance']    = Boolean(smsLowBalance);
      const updated = await (prisma as any).schoolNotificationSettings.upsert({
        where: { schoolId },
        create: { schoolId, ...data },
        update: data,
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // ── GET  /api/v2/schools/:id/security-settings ───────────────────────────
  app.get('/api/v2/schools/:id/security-settings', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const config = await prisma.schoolConfig.findUnique({ where: { schoolId } }) as any;
      res.json({ success: true, data: {
        passwordMinLength:    config?.passwordMinLength    ?? 8,
        passwordRequireUpper: config?.passwordRequireUpper ?? false,
        passwordRequireDigit: config?.passwordRequireDigit ?? true,
        sessionTimeoutMin:    config?.sessionTimeoutMin    ?? 60,
      }});
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/schools/:id/security-settings ──────────────────────────
  app.patch('/api/v2/schools/:id/security-settings', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const { passwordMinLength, passwordRequireUpper, passwordRequireDigit, sessionTimeoutMin } = req.body;
      const data: Record<string, number | boolean> = {};
      if (passwordMinLength !== undefined) {
        const v = parseInt(String(passwordMinLength));
        if (isNaN(v) || v < 6 || v > 16) { res.status(400).json({ success: false, message: 'Longueur doit être entre 6 et 16' }); return; }
        data['passwordMinLength'] = v;
      }
      if (passwordRequireUpper !== undefined) data['passwordRequireUpper'] = Boolean(passwordRequireUpper);
      if (passwordRequireDigit !== undefined) data['passwordRequireDigit'] = Boolean(passwordRequireDigit);
      if (sessionTimeoutMin !== undefined) {
        const v = parseInt(String(sessionTimeoutMin));
        if (isNaN(v) || v < 15 || v > 480) { res.status(400).json({ success: false, message: 'Timeout doit être entre 15 et 480 minutes' }); return; }
        data['sessionTimeoutMin'] = v;
      }
      const updated = await (prisma as any).schoolConfig.upsert({
        where: { schoolId },
        create: { schoolId, ...data },
        update: data,
      });
      res.json({ success: true, data: {
        passwordMinLength:    updated.passwordMinLength    ?? 8,
        passwordRequireUpper: updated.passwordRequireUpper ?? false,
        passwordRequireDigit: updated.passwordRequireDigit ?? true,
        sessionTimeoutMin:    updated.sessionTimeoutMin    ?? 60,
      }});
    } catch (err) { next(err); }
  });

  // ── GET  /api/v2/schools/:id/audit-logs ──────────────────────────────────
  app.get('/api/v2/schools/:id/audit-logs', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const page  = Math.max(1, parseInt(req.query['page']  as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query['limit'] as string) || 20));
      const skip  = (page - 1) * limit;
      const action   = (req.query['action']   as string | undefined)?.trim();
      const userId   = (req.query['userId']   as string | undefined)?.trim();
      const fromDate = (req.query['from']     as string | undefined)?.trim();
      const toDate   = (req.query['to']       as string | undefined)?.trim();

      const where: Record<string, any> = { schoolId };
      if (userId) where['userId'] = userId;
      if (action) where['action'] = { contains: action, mode: 'insensitive' };
      if (fromDate || toDate) {
        where['createdAt'] = {};
        if (fromDate) where['createdAt']['gte'] = new Date(fromDate);
        if (toDate)   where['createdAt']['lte'] = new Date(toDate + 'T23:59:59');
      }

      const [logs, total] = await Promise.all([
        prisma.activitiesLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.activitiesLog.count({ where }),
      ]);

      const userIds = [...new Set(logs.map(l => l.userId).filter((id): id is string => !!id))];
      const users   = userIds.length
        ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } })
        : [];
      const userMap = Object.fromEntries(users.map(u => [u.id, u]));

      res.json({
        success: true,
        logs: logs.map(l => ({ ...l, user: l.userId ? (userMap[l.userId] ?? null) : null })),
        total, page, pages: Math.ceil(total / limit),
      });
    } catch (err) { next(err); }
  });

  app.use('/api/v2/grades', creerGradeRoutes(gradeController));
  app.use('/api/v2/attendance', creerAttendanceRoutes(attendanceController));
  app.use('/api/v2/onboarding', creerOnboardingRoutes(onboardingController));
  app.use('/api/v2/report-cards', creerReportCardRoutes(reportCardController));
  app.use('/api/v2/class-councils', creerClassCouncilRoutes(classCouncilController));

  const designerAPUseCase = new DesignerAPUseCase(prisma);

  const userController = new UserController(
    container.user.connecter,
    container.user.inscrire,
    container.user.rafraichir,
    container.user.deconnecter,
    container.user.modifier,
    container.user.supprimer,
    container.user.transferer,
    container.user.tokenService,
    container.user.schoolRepository,
    designerAPUseCase,
    container.user.importer,
    prisma,
  );

  const masterAdminHexController = new MasterAdminHexController(
    container.masterAdmin.inviter,
    container.masterAdmin.suspendre,
    container.masterAdmin.reactiver,
    container.masterAdmin.rejeter,
    container.masterAdmin.changerPlan,
    prisma,
  );

  app.use('/api/v2/users', creerUserRoutes(userController));

  // ── Master Auth (3FA) — monté AVANT /api/v2/master pour éviter protectMaster ──
  const loginMasterUseCase = new LoginMasterUseCase(
    prisma,
    async ({ recipientEmail, otp }: { recipientEmail: string; otp: string }) => {
      const result = await sendTransactionalEmail({
        recipientEmail,
        subject: 'EduNexus — Code de vérification connexion administrateur',
        html: `<p>Votre code de vérification est : <strong>${otp}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
        template: 'master-login-otp',
        eventType: 'master_login_otp',
      });
      if (result.status === 'failed') {
        throw new Error(result.error || "Échec d'envoi de l'email");
      }
    },
  );
  const verifyMfaUseCase = new VerifyMfaUseCase(prisma);
  const masterAuthController = new MasterAuthController(loginMasterUseCase, verifyMfaUseCase);
  app.use('/api/v2/master/auth', creerMasterAuthRoutes(masterAuthController));

  app.use('/api/v2/master', creerMasterAdminHexRoutes(masterAdminHexController));

  const financeController = new FinanceController(
    container.finance.creerPlanFrais,
    container.finance.genererFacture,
    container.finance.genererFacturesEnMasse,
    container.finance.initierPaiement,
    container.finance.traiterWebhook,
    container.finance.rembourserCaution,
    container.finance.enregistrerDepense,
    container.finance.enregistrerPaiementCash,
  );

  app.use('/api/v2/finance', creerFinanceRoutes(financeController));

  const classeController = new ClasseController(
    container.class.creer,
    container.class.modifier,
    container.class.supprimer,
    container.class.assignerProfesseur,
    container.class.creerSousGroupe,
    container.class.assignerEleves,
    prisma,
  );

  const subjectController = new SubjectController(
    container.subject.creer,
    container.subject.modifier,
    container.subject.assignerEnseignant,
    container.subject.definirCoefficient,
    container.subject.supprimer,
  );

  app.use('/api/v2/classes', creerClasseRoutes(classeController));
  app.use('/api/v2/subjects', creerSubjectRoutes(subjectController));

  const departmentController = new DepartmentController(prisma);
  app.use('/api/v2/departments', creerDepartmentRoutes(departmentController));

  const teachingAssignmentController = new TeachingAssignmentController(prisma);
  app.use('/api/v2/teaching-assignments', creerTeachingAssignmentRoutes(teachingAssignmentController));

  const timetableGridConfigController = new TimetableGridConfigController(prisma);
  app.use('/api/v2/timetable-grid-config', creerTimetableGridConfigRoutes(timetableGridConfigController));

  const academicYearController = new AcademicYearController(
    container.academicYear.creer,
    container.academicYear.definirPeriode,
    container.academicYear.verifierPrerequis,
    container.academicYear.cloturer,
    container.academicYear.mettreAJourCalendrier,
  );

  app.use('/api/v2/academic-years', creerAcademicYearRoutes(academicYearController));

  const timetableController = new TimetableController(
    container.timetable.creer,
    container.timetable.ajouterCreneau,
    container.timetable.modifierCreneau,
    container.timetable.publier,
    container.timetable.demanderRattrapage,
  );

  // ── POST /api/v2/timetables/generate-skeleton — génère les créneaux vides pour une classe ──
  app.post('/api/v2/timetables/generate-skeleton', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId } = req.body as { classId?: string };
      if (!classId) { res.status(400).json({ success: false, message: 'classId requis' }); return; }

      const gridConfig = await prisma.timetableGridConfig.findUnique({ where: { schoolId } });
      if (!gridConfig) { res.status(422).json({ success: false, message: 'Veuillez d\'abord configurer la grille horaire.' }); return; }

      const classeExiste = await prisma.class.findFirst({ where: { id: classId, schoolId } });
      if (!classeExiste) { res.status(404).json({ success: false, message: 'Classe introuvable.' }); return; }

      const annee = await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
      if (!annee) { res.status(422).json({ success: false, message: 'Aucune année scolaire courante. Configurez une année scolaire d\'abord.' }); return; }

      const existing = await prisma.timetable.findFirst({ where: { schoolId, classId, academicYearId: annee.id } });
      if (existing) { res.status(409).json({ success: false, message: 'Un emploi du temps existe déjà pour cette classe et cette année scolaire.', data: { timetableId: existing.id } }); return; }

      const squelette = calculerSqelette(gridConfig);
      const periodesCours = squelette.filter(p => p.type === 'COURS');

      const DAY_MAP: Record<string, number> = { LUNDI: 1, MARDI: 2, MERCREDI: 3, JEUDI: 4, VENDREDI: 5, SAMEDI: 6 };
      const joursActifs = gridConfig.joursActifs.map(j => DAY_MAP[j]).filter(Boolean);

      const timetable = await prisma.timetable.create({
        data: {
          schoolId, classId, academicYearId: annee.id,
          slots: {
            create: joursActifs.flatMap(dayOfWeek =>
              periodesCours.map(p => ({
                dayOfWeek, startTime: p.debut, endTime: p.fin, kind: 'CLASS',
              }))
            ),
          },
        },
        include: {
          class: { select: { id: true, name: true } },
          slots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        },
      });

      res.status(201).json({ success: true, data: timetable });
    } catch (err) { next(err); }
  });

  // ── GET /api/v2/timetables/check-conflict — vérifie si un enseignant est déjà occupé ──
  app.get('/api/v2/timetables/check-conflict', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { teacherId, dayOfWeek, startTime, excludeSlotId } = req.query as Record<string, string>;
      if (!teacherId || !dayOfWeek || !startTime) {
        res.status(400).json({ success: false, message: 'teacherId, dayOfWeek et startTime requis' }); return;
      }

      const conflitSlot = await prisma.timetableSlot.findFirst({
        where: {
          teacherId,
          dayOfWeek: parseInt(dayOfWeek),
          startTime,
          ...(excludeSlotId ? { id: { not: excludeSlotId } } : {}),
          timetable: { is: { schoolId } },
        },
        select: { timetableId: true },
      });

      if (conflitSlot) {
        const conflitTimetable = await prisma.timetable.findUnique({
          where: { id: conflitSlot.timetableId },
          include: { class: { select: { name: true } } },
        });
        res.json({ success: true, data: { hasConflict: true, conflictClass: conflitTimetable?.class.name ?? 'inconnue' } });
      } else {
        res.json({ success: true, data: { hasConflict: false } });
      }
    } catch (err) { next(err); }
  });

  // ── PATCH /api/v2/timetables/slots/:slotId — remplit un créneau (matière + enseignant) ──
  app.patch('/api/v2/timetables/slots/:slotId', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const slotId = String(req.params['slotId']);
      const { subjectId, teacherId } = req.body as { subjectId?: string | null; teacherId?: string | null };

      const slot = await prisma.timetableSlot.findFirst({
        where: { id: slotId },
        include: { timetable: { select: { schoolId: true } } },
      });
      if (!slot || slot.timetable.schoolId !== schoolId) { res.status(404).json({ success: false, message: 'Créneau introuvable.' }); return; }

      if (teacherId) {
        // Vérification conflit horaire
        const conflitSlot = await prisma.timetableSlot.findFirst({
          where: {
            teacherId,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            id: { not: slotId },
            timetable: { is: { schoolId } },
          },
          select: { timetableId: true },
        });
        if (conflitSlot) {
          const conflitTimetable = await prisma.timetable.findUnique({
            where: { id: conflitSlot.timetableId },
            include: { class: { select: { name: true } } },
          });
          res.status(409).json({ success: false, code: 'CONFLIT_HORAIRE', message: `Conflit : cet enseignant est déjà affecté à la classe ${conflitTimetable?.class.name ?? 'inconnue'} à ce créneau.` }); return;
        }

        // Vérification volume AP (14h/semaine max)
        const teacherProfile = await prisma.teacherProfile.findFirst({
          where: { userId: teacherId },
          select: { supervisedSubjectIds: true },
        });
        const isAP = teacherProfile && teacherProfile.supervisedSubjectIds.length > 0;
        if (isAP) {
          const slotsAP = await prisma.timetableSlot.count({
            where: {
              teacherId,
              id: { not: slotId },
              timetable: { is: { schoolId } },
            },
          });
          const dureePeriode = (await prisma.timetableGridConfig.findUnique({ where: { schoolId }, select: { dureePeriode: true } }))?.dureePeriode ?? 55;
          const heuresTotal = (slotsAP + 1) * dureePeriode / 60;
          if (heuresTotal > 14) {
            res.status(409).json({ success: false, code: 'VOLUME_AP_DEPASSE', message: `Cet Animateur Pédagogique aurait ${heuresTotal.toFixed(1)}h/semaine, dépassant la limite légale de 14h.` }); return;
          }
        }
      }

      const updated = await prisma.timetableSlot.update({
        where: { id: slotId },
        data: { subjectId: subjectId ?? null, teacherId: teacherId ?? null },
        include: {
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  app.use('/api/v2/timetables', creerTimetableRoutes(timetableController));

  const parentController = new ParentController(
    container.parent.obtenirEnfants,
    container.parent.verifierAcces,
    container.finance.initierPaiement,
    container.finance.factureRepository,
  );

  const schoolSettingsController = new SchoolSettingsController(
    container.schoolSettings.obtenir,
    container.schoolSettings.mettreAJour,
  );

  app.use('/api/v2/parent', creerParentRoutes(parentController));
  app.use('/api/v2/school-settings', creerSchoolSettingsRoutes(schoolSettingsController));

  // ── Activation de l'établissement (Admin, après configuration) ─────
  const activerEtablissementUseCase = new ActiverEtablissementUseCase(prisma);
  app.use('/api/v2', creerSchoolConfigRoutes(activerEtablissementUseCase));

  // ── Thin controllers (pas de use case — Prisma direct, aucune logique métier) ──
  const activitiesController = new ActivitiesLogController(prisma);
  const dashboardController  = new DashboardController(prisma);
  const emailLogController   = new EmailLogController(prisma);
  const searchController     = new SearchController(prisma);
  const aiController         = new AIController(prisma);
  const coreDomainController = new CoreDomainController(prisma);
  const publicController     = new PublicController(prisma);
  const smsController        = new SMSController(prisma);

  const orientationController = new OrientationController(
    container.orientation.creerFiche,
    container.orientation.ajouterEntretien,
    container.orientation.ajouterTest,
    container.orientation.creerRecommandation,
    container.orientation.ajouterSuivi,
    container.orientation.listerFiches,
    container.orientation.getStats,
    container.orientation.repo,
  );

  app.use('/api/v2/orientation', creerOrientationRoutes(orientationController));

  app.use('/api/v2/activities',    creerActivitiesRoutes(activitiesController));
  app.use('/api/v2/dashboard',     creerDashboardRoutes(dashboardController));
  app.use('/api/v2/email-logs',    creerEmailLogRoutes(emailLogController));
  app.use('/api/v2/search',        creerSearchRoutes(searchController));
  app.use('/api/v2/ai',            creerAIRoutes(aiController));
  app.use('/api/v2/core-domain',   creerCoreDomainRoutes(coreDomainController));
  app.use('/api/v2/public',        creerPublicRoutes(publicController));
  app.use('/api/v2/sms',           creerSMSRoutes(smsController));

  // ── GET list endpoints (Prisma direct, thin routes) ─────────────────────

  // GET /api/v2/users — liste paginée
  app.get('/api/v2/users', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { role, classId, page = '1', limit = '50', search } = req.query as Record<string, string>;
      const isAdmin = req.user!.role === 'ADMIN';
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        ...(role ? { role } : {}),
        ...(classId && role === 'STUDENT' ? { studentProfile: { classId } } : {}),
        ...(search ? { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ] } : {}),
      };
      if (!isAdmin && role !== 'STUDENT' && req.user!.role !== 'TEACHER') {
        res.status(403).json({ success: false, message: 'Accès refusé' });
        return;
      }
      const [total, users, roleGroups] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true, firstName: true, lastName: true, email: true, role: true,
            isActive: true, lastLogin: true, createdAt: true,
            studentProfile: { select: { id: true, classId: true, class: { select: { name: true } } } },
            staffProfile: { select: { title: true } },
            teacherProfile: {
              select: {
                teacherSubjects: {
                  select: { subjectId: true, subject: { select: { name: true } } },
                },
              },
            },
            classesProfessorPrincipal: { select: { id: true, name: true } },
          },
          orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        // Counts per role (sans filtre rôle seulement, pour l'affichage des onglets)
        !role
          ? prisma.user.groupBy({ by: ['role'], where: { schoolId }, _count: { id: true } })
          : Promise.resolve(null),
      ]);
      const roleCounts = roleGroups
        ? Object.fromEntries(roleGroups.map(g => [g.role, g._count.id]))
        : undefined;
      res.json({ success: true, data: users, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) }, roleCounts });
    } catch (err) { next(err); }
  });

  // GET /api/v2/users/me — infos de l'utilisateur connecté
  app.get('/api/v2/users/me', requireAuth, async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          id: true, firstName: true, lastName: true, email: true, role: true, isActive: true,
          teacherProfile: {
            select: {
              id: true, specialization: true,
              teacherSubjects: { select: { subject: { select: { id: true, name: true } } } },
            },
          },
          studentProfile: { select: { id: true, class: { select: { id: true, name: true } } } },
          staffProfile: { select: { id: true, title: true } },
        },
      });
      if (!user) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return; }
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  });

  // GET /api/v2/classes — classes visibles selon le rôle
  //   TEACHER → uniquement les classes où il a un TeachingAssignment ou est professeur principal
  //   Autres  → toutes les classes de l'école
  app.get('/api/v2/classes', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const userId   = req.user!.userId;
      const role     = req.user!.role;

      let whereClause: any = { schoolId };

      if (role === 'TEACHER') {
        const assignments = await prisma.teachingAssignment.findMany({
          where: { teacherId: userId, schoolId },
          select: { classId: true },
          distinct: ['classId'],
        });
        const assignedClassIds = assignments.map((a) => a.classId);
        whereClause = {
          schoolId,
          OR: [
            { id: { in: assignedClassIds } },
            { professorPrincipalId: userId },
          ],
        };
      }

      const classes = await prisma.class.findMany({
        where: whereClause,
        include: {
          professorPrincipal: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { students: true } },
        },
        orderBy: { name: 'asc' },
      });

      res.json({ success: true, data: classes });
    } catch (err) { next(err); }
  });

  // GET /api/v2/subjects — matières visibles selon le rôle
  //   ?classId=xxx → Vue par Classe : retourne les SubjectCoefficients de cette classe
  //   TEACHER      → uniquement ses matières assignées (TeacherSubject)
  //   Autres       → toutes les matières de l'école
  app.get('/api/v2/subjects', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const userId   = req.user!.userId;
      const role     = req.user!.role;
      const classId  = req.query['classId'] as string | undefined;

      // ── Vue par Classe ──
      if (classId) {
        const cls = await prisma.class.findFirst({
          where: { id: classId, schoolId },
          select: { name: true, level: true, serie: true, filiere: true },
        });
        if (!cls) {
          res.status(404).json({ success: false, message: 'Classe introuvable' });
          return;
        }

        const resolvedSerie: string | null =
          cls.serie ??
          cls.filiere ??
          ((cls.level && (SYNC_CYCLE2_LEVELS as string[]).includes(cls.level))
            ? syncParseSerie(cls.name, cls.level)
            : null);

        const coefficients = await prisma.subjectCoefficient.findMany({
          where: {
            schoolId,
            classLevel: cls.level ?? undefined,
            OR: resolvedSerie
              ? [{ serieCode: resolvedSerie }, { serieCode: null }]
              : [{ serieCode: null }],
          },
          include: { subject: { select: { id: true, name: true, code: true } } },
          orderBy: { subject: { name: 'asc' } },
        });

        const data = coefficients.map(c => ({
          id:          c.id,
          subjectId:   c.subjectId,
          name:        c.subject.name,
          code:        c.subject.code,
          coefficient: c.coefficient,
          classLevel:  c.classLevel,
          serieCode:   c.serieCode,
        }));

        res.json({ success: true, data, className: cls.name });
        return;
      }

      // ── Vue Catalogue ──
      let whereClause: any = { schoolId };

      if (role === 'TEACHER') {
        whereClause = {
          schoolId,
          teacherSubjects: { some: { teacherProfile: { userId } } },
        };
      }

      const subjects = await prisma.subject.findMany({
        where: whereClause,
        include: {
          teacherSubjects: {
            include: {
              teacherProfile: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
            },
          },
        },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: subjects });
    } catch (err) { next(err); }
  });

  // GET /api/v2/academic-years — liste des années scolaires avec périodes et séquences
  app.get('/api/v2/academic-years', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const years = await prisma.academicYear.findMany({
        where: { schoolId },
        include: {
          periods: {
            include: { sequences: { orderBy: { orderIndex: 'asc' } } },
            orderBy: { startDate: 'asc' },
          },
        },
        orderBy: { startDate: 'desc' },
      });
      res.json({ success: true, data: years });
    } catch (err) { next(err); }
  });

  // GET /api/v2/timetables?classId= — emploi du temps d'une classe
  app.get('/api/v2/timetables', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.query.classId as string | undefined;
      const timetables = await prisma.timetable.findMany({
        where: { schoolId, ...(classId ? { classId } : {}) },
        include: {
          class: { select: { id: true, name: true } },
          slots: {
            include: {
              subject: { select: { id: true, name: true } },
              teacher: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: timetables });
    } catch (err) { next(err); }
  });

  // GET /api/v2/finance/fee-plans — liste des plans de frais (ADMIN ou STAFF avec MANAGE_FINANCE)
  app.get('/api/v2/finance/fee-plans', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const plans = await prisma.feePlan.findMany({
        where: { schoolId },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: plans });
    } catch (err) { next(err); }
  });

  // GET /api/v2/finance/invoices?status=&feeType=&page= — liste des factures (ADMIN ou STAFF)
  app.get('/api/v2/finance/invoices', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { status, feeType, page = '1', limit = '50' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        ...(status ? { status } : {}),
        ...(feeType ? { feePlan: { feeType } } : {}),
      };
      const [total, invoices] = await Promise.all([
        prisma.invoice.count({ where }),
        prisma.invoice.findMany({
          where,
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            feePlan: { select: { id: true, name: true, feeType: true, amount: true } },
            payments: { select: { id: true, amount: true, status: true, paidAt: true, method: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({ success: true, data: invoices, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) { next(err); }
  });

  // PATCH /api/v2/school/profile — mise à jour du profil de l'école (ADMIN)
  app.patch('/api/v2/school/profile', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { name, city, phone, email } = req.body as { name?: string; city?: string; phone?: string; email?: string };
      const updated = await prisma.school.update({
        where: { id: schoolId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(city !== undefined ? { city } : {}),
          ...(phone !== undefined ? { phone } : {}),
          ...(email !== undefined ? { email } : {}),
        },
        select: { id: true, name: true, city: true, phone: true, email: true, logoUrl: true, subdomain: true },
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // ── Discipline ───────────────────────────────────────────────────────────────

  // GET /api/v2/discipline — liste des sanctions (ADMIN, STAFF)
  app.get('/api/v2/discipline', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentId, type, status, page = '1', limit = '30' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        ...(studentId ? { studentId } : {}),
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
      };
      const [total, records] = await Promise.all([
        prisma.disciplineRecord.count({ where }),
        prisma.disciplineRecord.findMany({
          where,
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            decidedBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({ success: true, data: records, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) { next(err); }
  });

  // POST /api/v2/discipline — créer une sanction (ADMIN, STAFF)
  app.post('/api/v2/discipline', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentId, type, reason, startDate, endDate } = req.body as Record<string, string>;
      if (!studentId || !type || !reason) {
        res.status(400).json({ success: false, message: 'studentId, type et reason sont requis' });
        return;
      }
      const validTypes = ['WARNING_ORAL', 'WARNING_WRITTEN', 'TEMP_EXCLUSION', 'COUNCIL_DECISION', 'PERMANENT_EXCLUSION'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ success: false, message: `type invalide. Valeurs : ${validTypes.join(', ')}` });
        return;
      }
      const student = await prisma.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' } });
      if (!student) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }
      const record = await prisma.disciplineRecord.create({
        data: {
          schoolId, studentId, type: type as any, reason,
          decidedById: req.user!.userId,
          ...(startDate ? { startDate: new Date(startDate) } : {}),
          ...(endDate ? { endDate: new Date(endDate) } : {}),
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          decidedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      res.status(201).json({ success: true, data: record });
    } catch (err) { next(err); }
  });

  // PATCH /api/v2/discipline/:id/lift — lever une sanction
  app.patch('/api/v2/discipline/:id/lift', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const record = await prisma.disciplineRecord.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!record) { res.status(404).json({ success: false, message: 'Sanction introuvable' }); return; }
      const updated = await prisma.disciplineRecord.update({
        where: { id: record.id },
        data: { status: 'LIFTED' },
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // ── Bibliothèque ─────────────────────────────────────────────────────────────

  // GET /api/v2/library/books — catalogue
  app.get('/api/v2/library/books', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { search, category, page = '1', limit = '50' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        ...(category ? { category } : {}),
        ...(search ? { OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
          { isbn: { contains: search, mode: 'insensitive' } },
        ]} : {}),
      };
      const [total, books] = await Promise.all([
        prisma.book.count({ where }),
        prisma.book.findMany({
          where,
          include: { _count: { select: { loans: { where: { status: 'ACTIVE' } } } } },
          orderBy: { title: 'asc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({ success: true, data: books, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) { next(err); }
  });

  // POST /api/v2/library/books — ajouter un ouvrage
  app.post('/api/v2/library/books', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { title, author, isbn, quantity, category } = req.body as Record<string, string>;
      if (!title) { res.status(400).json({ success: false, message: 'title requis' }); return; }
      const qty = Math.max(1, parseInt(quantity ?? '1') || 1);
      const book = await prisma.book.create({
        data: { schoolId, title, author: author ?? null, isbn: isbn ?? null, quantity: qty, available: qty, category: category ?? null },
      });
      res.status(201).json({ success: true, data: book });
    } catch (err) { next(err); }
  });

  // PATCH /api/v2/library/books/:id — modifier un ouvrage
  app.patch('/api/v2/library/books/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const book = await prisma.book.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!book) { res.status(404).json({ success: false, message: 'Ouvrage introuvable' }); return; }
      const updated = await prisma.book.update({
        where: { id: book.id },
        data: { ...req.body },
      });
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // DELETE /api/v2/library/books/:id — supprimer un ouvrage
  app.delete('/api/v2/library/books/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const book = await prisma.book.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!book) { res.status(404).json({ success: false, message: 'Ouvrage introuvable' }); return; }
      const activeCount = await prisma.bookLoan.count({
        where: { bookId: book.id, status: { in: ['ACTIVE', 'OVERDUE'] } },
      });
      if (activeCount > 0) {
        res.status(409).json({
          success: false,
          message: `Impossible de supprimer : ${activeCount} exemplaire(s) actuellement emprunté(s)`,
        });
        return;
      }
      await prisma.book.delete({ where: { id: book.id } });
      res.json({ success: true });
    } catch (err) { next(err); }
  });

  // GET /api/v2/library/loans — emprunts actifs
  app.get('/api/v2/library/loans', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { status = 'ACTIVE', page = '1', limit = '30' } = req.query as Record<string, string>;
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const where: any = { schoolId, ...(status ? { status } : {}) };
      const [total, loans] = await Promise.all([
        prisma.bookLoan.count({ where }),
        prisma.bookLoan.findMany({
          where,
          include: {
            book: { select: { id: true, title: true, author: true, isbn: true } },
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { borrowedAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({ success: true, data: loans, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) { next(err); }
  });

  // POST /api/v2/library/loans — enregistrer un emprunt
  app.post('/api/v2/library/loans', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { bookId, studentId, dueDate } = req.body as Record<string, string>;
      if (!bookId || !studentId) { res.status(400).json({ success: false, message: 'bookId et studentId requis' }); return; }
      const book = await prisma.book.findFirst({ where: { id: bookId, schoolId } });
      if (!book) { res.status(404).json({ success: false, message: 'Ouvrage introuvable' }); return; }
      if (book.available <= 0) { res.status(409).json({ success: false, message: 'Aucun exemplaire disponible' }); return; }
      const student = await prisma.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' } });
      if (!student) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }
      const [loan] = await prisma.$transaction([
        prisma.bookLoan.create({
          data: {
            schoolId, bookId, studentId,
            dueDate: dueDate ? new Date(dueDate) : null,
          },
          include: {
            book: { select: { id: true, title: true, author: true } },
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        prisma.book.update({ where: { id: bookId }, data: { available: { decrement: 1 } } }),
      ]);
      res.status(201).json({ success: true, data: loan });
    } catch (err) { next(err); }
  });

  // PATCH /api/v2/library/loans/:id/return — retour d'un livre
  app.patch('/api/v2/library/loans/:id/return', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const loan = await prisma.bookLoan.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!loan) { res.status(404).json({ success: false, message: 'Emprunt introuvable' }); return; }
      if (loan.status === 'RETURNED') { res.status(409).json({ success: false, message: 'Livre déjà retourné' }); return; }
      const [updated] = await prisma.$transaction([
        prisma.bookLoan.update({
          where: { id: loan.id },
          data: { status: 'RETURNED', returnedAt: new Date() },
          include: { book: { select: { id: true, title: true } } },
        }),
        prisma.book.update({ where: { id: loan.bookId }, data: { available: { increment: 1 } } }),
      ]);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // GET /api/v2/library/my-loans — emprunts de l'élève connecté ou des enfants du parent
  app.get('/api/v2/library/my-loans', requireAuth, async (req, res, next) => {
    try {
      const { userId, role, schoolId } = req.user!;
      const { studentId } = req.query as Record<string, string>;

      if (role === 'STUDENT') {
        const loans = await prisma.bookLoan.findMany({
          where: { schoolId, studentId: userId },
          include: { book: { select: { id: true, title: true, author: true, category: true } } },
          orderBy: { borrowedAt: 'desc' },
          take: 50,
        });
        res.json({ success: true, data: loans });
        return;
      }

      if (role === 'PARENT') {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId },
          include: { children: { include: { studentProfile: { select: { userId: true } } } } },
        });
        const childUserIds = (parentProfile?.children ?? [])
          .map(c => c.studentProfile?.userId)
          .filter((id): id is string => Boolean(id));

        if (studentId && !childUserIds.includes(studentId)) {
          res.status(403).json({ success: false, message: 'Accès refusé' });
          return;
        }

        const targetIds = studentId ? [studentId] : childUserIds;
        const loans = await prisma.bookLoan.findMany({
          where: { schoolId, studentId: { in: targetIds } },
          include: {
            book: { select: { id: true, title: true, author: true, category: true } },
            student: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { borrowedAt: 'desc' },
          take: 100,
        });
        res.json({ success: true, data: loans });
        return;
      }

      res.status(403).json({ success: false, message: 'Accès refusé' });
    } catch (err) { next(err); }
  });

  // ── Factures parent (portail parent) ────────────────────────────────────────
  // GET /api/v2/parent/invoices?studentId= — factures d'un enfant du parent connecté
  app.get('/api/v2/parent/invoices', requireAuth, requireRole('PARENT'), async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const { studentId, page = '1', limit = '30' } = req.query as Record<string, string>;

      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId },
        include: { children: { include: { studentProfile: { select: { userId: true } } } } },
      });
      const childUserIds = (parentProfile?.children ?? [])
        .map(c => c.studentProfile?.userId)
        .filter((id): id is string => Boolean(id));

      if (studentId && !childUserIds.includes(studentId)) {
        res.status(403).json({ success: false, message: 'Accès refusé' }); return;
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const where: any = {
        schoolId,
        studentId: studentId ? studentId : { in: childUserIds },
      };

      const [total, invoices] = await Promise.all([
        prisma.invoice.count({ where }),
        prisma.invoice.findMany({
          where,
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            feePlan: { select: { id: true, name: true, feeType: true, amount: true } },
            payments: { select: { id: true, amount: true, status: true, paidAt: true, method: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({ success: true, data: invoices, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) { next(err); }
  });

  // POST /api/v2/parent/pay — initier un paiement Mobile Money (PARENT)
  app.post('/api/v2/parent/pay', requireAuth, requireRole('PARENT'), async (req, res, next) => {
    try {
      const userId = req.user!.userId;
      const schoolId = req.user!.schoolId;
      const { invoiceId, method, phoneNumber } = req.body as { invoiceId: string; method: string; phoneNumber: string };

      if (!invoiceId || !method || !phoneNumber) {
        res.status(400).json({ success: false, message: 'invoiceId, method et phoneNumber requis' }); return;
      }
      if (!['MTN_MOMO', 'ORANGE_MONEY'].includes(method)) {
        res.status(400).json({ success: false, message: 'method invalide. Valeurs : MTN_MOMO, ORANGE_MONEY' }); return;
      }

      // Vérifier que la facture appartient à un enfant du parent
      const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, schoolId } });
      if (!invoice) { res.status(404).json({ success: false, message: 'Facture introuvable' }); return; }

      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId },
        include: { children: { include: { studentProfile: { select: { userId: true } } } } },
      });
      const childUserIds = (parentProfile?.children ?? [])
        .map(c => c.studentProfile?.userId)
        .filter((id): id is string => Boolean(id));

      if (!childUserIds.includes(invoice.studentId)) {
        res.status(403).json({ success: false, message: 'Accès refusé' }); return;
      }

      const result = await container.finance.initierPaiement.execute({
        factureId: invoiceId,
        studentId: invoice.studentId,
        method: method as any,
        phoneNumber,
        schoolId,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  // Master admin — approbation d'une école (hexagonale) — vérification identité requise
  // /api/master/ (v1) ne passe PAS par le router /api/v2/master, donc protectMaster est nécessaire
  app.post(
    '/api/master/schools/:id/approve',
    protectMaster,
    authorizeMaster(['super_admin']),
    requireMasterSensitiveAuth,
    onboardingController.approuverEcole,
  );
  // /api/v2/master/ passe déjà par router.use(protectMaster) dans creerMasterAdminHexRoutes
  // → ne pas répéter protectMaster ici pour éviter la double requête MasterUser
  app.post(
    '/api/v2/master/schools/:id/approve',
    authorizeMaster(['super_admin', 'platform_admin']),
    requireMasterSensitiveAuth,
    onboardingController.approuverEcole,
  );

  // ── Routes dev — DÉSACTIVÉES en production ──────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const devController = new DevController(prisma);
    app.use('/api/v2/dev', creerDevRoutes(devController));
    console.log('🔧 Routes dev montées sur /api/v2/dev (NODE_ENV:', process.env.NODE_ENV, ')');
  }

  app.use(errorHandler);

  console.log('✅ Architecture hexagonale montée sur /api/v2');
}
