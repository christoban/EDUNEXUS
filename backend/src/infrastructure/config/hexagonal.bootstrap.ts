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
import { ExamController } from '@infrastructure/http/controllers/ExamController';
import { CoreDomainController } from '@infrastructure/http/controllers/CoreDomainController';
import { PublicController } from '@infrastructure/http/controllers/PublicController';
import { SMSController } from '@infrastructure/http/controllers/SMSController';
import { creerActivitiesRoutes } from '@infrastructure/http/routes/activities.routes';
import { creerDashboardRoutes } from '@infrastructure/http/routes/dashboard.routes';
import { creerEmailLogRoutes } from '@infrastructure/http/routes/emailLog.routes';
import { creerSearchRoutes } from '@infrastructure/http/routes/search.routes';
import { creerAIRoutes } from '@infrastructure/http/routes/ai.routes';
import { creerExamRoutes } from '@infrastructure/http/routes/exam.routes';
import { creerCoreDomainRoutes } from '@infrastructure/http/routes/coreDomain.routes';
import { creerPublicRoutes } from '@infrastructure/http/routes/public.routes';
import { creerSMSRoutes } from '@infrastructure/http/routes/sms.routes';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';

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

  app.use('/api/v2/grades', creerGradeRoutes(gradeController));
  app.use('/api/v2/attendance', creerAttendanceRoutes(attendanceController));
  app.use('/api/v2/onboarding', creerOnboardingRoutes(onboardingController));
  app.use('/api/v2/report-cards', creerReportCardRoutes(reportCardController));
  app.use('/api/v2/class-councils', creerClassCouncilRoutes(classCouncilController));

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
  );

  const masterAdminHexController = new MasterAdminHexController(
    container.masterAdmin.inviter,
    container.masterAdmin.suspendre,
    container.masterAdmin.reactiver,
    container.masterAdmin.rejeter,
    container.masterAdmin.changerPlan,
  );

  app.use('/api/v2/users', creerUserRoutes(userController));
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
  const examController       = new ExamController(prisma);
  const coreDomainController = new CoreDomainController(prisma);
  const publicController     = new PublicController();
  const smsController        = new SMSController(prisma);

  app.use('/api/v2/activities',    creerActivitiesRoutes(activitiesController));
  app.use('/api/v2/dashboard',     creerDashboardRoutes(dashboardController));
  app.use('/api/v2/email-logs',    creerEmailLogRoutes(emailLogController));
  app.use('/api/v2/search',        creerSearchRoutes(searchController));
  app.use('/api/v2/ai',            creerAIRoutes(aiController));
  app.use('/api/v2/exams',         creerExamRoutes(examController));
  app.use('/api/v2/core-domain',   creerCoreDomainRoutes(coreDomainController));
  app.use('/api/v2/public',        creerPublicRoutes(publicController));
  app.use('/api/v2/sms',           creerSMSRoutes(smsController));

  // Master admin — approbation d'une école (hexagonale)
  app.post(
    '/api/master/schools/:id/approve',
    protectMaster,
    authorizeMaster(['super_admin']),
    onboardingController.approuverEcole,
  );

  app.use(errorHandler);

  console.log('✅ Architecture hexagonale montée sur /api/v2');
}
