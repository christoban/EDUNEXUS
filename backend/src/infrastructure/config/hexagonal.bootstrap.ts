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
import { creerClasseRoutes } from '@infrastructure/http/routes/classe.routes';
import { creerSubjectRoutes } from '@infrastructure/http/routes/subject.routes';
import { creerAcademicYearRoutes } from '@infrastructure/http/routes/academicYear.routes';

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
