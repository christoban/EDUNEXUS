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

  // ── Informations de l'école (utilisateurs authentifiés) ──────────────
  app.get('/api/v2/school/me', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true, name: true, subdomain: true, logoUrl: true, plan: true, city: true, region: true, phone: true, email: true, subsystem: true },
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
  );

  app.use('/api/v2/finance', creerFinanceRoutes(financeController));

  const classeController = new ClasseController(
    container.class.creer,
    container.class.modifier,
    container.class.supprimer,
    container.class.assignerProfesseur,
    container.class.creerSousGroupe,
    container.class.assignerEleves,
  );

  const subjectController = new SubjectController(
    container.subject.creer,
    container.subject.modifier,
    container.subject.assignerEnseignant,
    container.subject.definirCoefficient,
  );

  app.use('/api/v2/classes', creerClasseRoutes(classeController));
  app.use('/api/v2/subjects', creerSubjectRoutes(subjectController));

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

  app.use('/api/v2/timetables', creerTimetableRoutes(timetableController));

  const parentController = new ParentController(
    container.parent.obtenirEnfants,
    container.parent.verifierAcces,
  );

  const schoolSettingsController = new SchoolSettingsController(
    container.schoolSettings.obtenir,
    container.schoolSettings.mettreAJour,
  );

  app.use('/api/v2/parent', creerParentRoutes(parentController));
  app.use('/api/v2/school-settings', creerSchoolSettingsRoutes(schoolSettingsController));

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
      const [total, users] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true, firstName: true, lastName: true, email: true, role: true,
            isActive: true, lastLogin: true, createdAt: true,
            studentProfile: { select: { id: true, classId: true, class: { select: { name: true } } } },
            staffProfile: { select: { title: true } },
          },
          orderBy: [{ role: 'asc' }, { lastName: 'asc' }],
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      res.json({ success: true, data: users, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
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

  // GET /api/v2/classes — liste toutes les classes de l'école
  app.get('/api/v2/classes', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classes = await prisma.class.findMany({
        where: { schoolId },
        include: {
          professorPrincipal: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { students: true } },
        },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: classes });
    } catch (err) { next(err); }
  });

  // GET /api/v2/subjects — liste toutes les matières de l'école
  app.get('/api/v2/subjects', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const subjects = await prisma.subject.findMany({
        where: { schoolId },
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
  app.post(
    '/api/master/schools/:id/approve',
    protectMaster,
    authorizeMaster(['super_admin']),
    requireMasterSensitiveAuth,
    onboardingController.approuverEcole,
  );
  app.post(
    '/api/v2/master/schools/:id/approve',
    protectMaster,
    authorizeMaster(['super_admin', 'platform_admin']),
    requireMasterSensitiveAuth,
    onboardingController.approuverEcole,
  );

  app.use(errorHandler);

  console.log('✅ Architecture hexagonale montée sur /api/v2');
}
