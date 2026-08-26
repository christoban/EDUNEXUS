/**
 * Bootstrap hexagonal — intégration progressive dans server.ts existant
 *
 * Usage dans server.ts :
 *   import { bootstrapHexagonal } from './infrastructure/config/hexagonal.bootstrap';
 *   bootstrapHexagonal(app);
 */
import type { Application } from 'express';
import type { Prisma, DisciplineType } from '@prisma/client';
import type { PaymentMethod } from '@domain/types/enums';
import { creerContainer } from '@infrastructure/config/container';
import { GradeController } from '@infrastructure/http/controllers/GradeController';
import { AttendanceController } from '@infrastructure/http/controllers/AttendanceController';
import { SchoolOnboardingController } from '@infrastructure/http/controllers/SchoolOnboardingController';
import { ReportCardController } from '@infrastructure/http/controllers/ReportCardController';
import { GroqIAService } from '@infrastructure/services/ai/GroqIAService';
import { ClassCouncilController } from '@infrastructure/http/controllers/ClassCouncilController';
import { creerGradeRoutes } from '@infrastructure/http/routes/grade.routes';
import { creerAttendanceRoutes } from '@infrastructure/http/routes/attendance.routes';
import { creerOnboardingRoutes } from '@infrastructure/http/routes/onboarding.routes';
import { creerReportCardRoutes } from '@infrastructure/http/routes/reportCard.routes';
import { creerClassCouncilRoutes } from '@infrastructure/http/routes/classCouncil.routes';
import { StudentDocumentController } from '@infrastructure/http/controllers/StudentDocumentController';
import { creerStudentDocumentRoutes } from '@infrastructure/http/routes/studentDocument.routes';
import { protectMaster, authorizeMaster } from '../http/middlewares/authMultiTenant.ts';
import { errorHandler } from '@infrastructure/http/middlewares/errorHandler';
import { DevController } from '@infrastructure/http/controllers/DevController';
import { creerDevRoutes } from '@infrastructure/http/routes/dev.routes';
import { UserController } from '@infrastructure/http/controllers/UserController';
import { MasterAdminHexController } from '@infrastructure/http/controllers/MasterAdminHexController';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaMasterUserAuthRepository } from '@infrastructure/persistence/prisma/PrismaMasterUserAuthRepository';
import { PrismaStaffProfileRepository } from '@infrastructure/persistence/prisma/PrismaStaffProfileRepository';
import { creerUserRoutes } from '@infrastructure/http/routes/user.routes';
import { creerMasterAdminHexRoutes } from '@infrastructure/http/routes/masterAdminHex.routes';
import { FinanceController } from '@infrastructure/http/controllers/FinanceController';
import { creerFinanceRoutes } from '@infrastructure/http/routes/finance.routes';
import { ClasseController } from '@infrastructure/http/controllers/ClasseController';
import { SubjectController } from '@infrastructure/http/controllers/SubjectController';
import { RoomController } from '@infrastructure/http/controllers/RoomController';
import { TeacherUnavailabilityController } from '@infrastructure/http/controllers/TeacherUnavailabilityController';
import { creerTeacherUnavailabilityRoutes } from '@infrastructure/http/routes/teacher-unavailability.routes';
import { StudentGroupController } from '@infrastructure/http/controllers/StudentGroupController';
import { PrismaStudentGroupSetRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupSetRepository';
import { PrismaStudentGroupRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupRepository';
import { PrismaStudentGroupMembershipRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupMembershipRepository';
import { PrismaStudentAffectationRepository } from '@infrastructure/persistence/prisma/PrismaStudentAffectationRepository';
import { PrismaLv2ChoiceRepository } from '@infrastructure/persistence/prisma/PrismaLv2ChoiceRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';
import { PrismaClassCouncilRepository } from '@infrastructure/persistence/prisma/PrismaClassCouncilRepository';
import { AcademicYearController } from '@infrastructure/http/controllers/AcademicYearController';
import { TimetableController } from '@infrastructure/http/controllers/TimetableController';
import { ParentController } from '@infrastructure/http/controllers/ParentController';
import { SchoolSettingsController } from '@infrastructure/http/controllers/SchoolSettingsController';
import { buildPayload, getLatestSchoolBackup } from '../backup/SchoolBackupService';
import { creerClasseRoutes } from '@infrastructure/http/routes/classe.routes';
import { creerSubjectRoutes } from '@infrastructure/http/routes/subject.routes';
import { creerRoomRoutes } from '@infrastructure/http/routes/room.routes';
import { creerStudentGroupRoutes } from '@infrastructure/http/routes/studentGroup.routes';
import { creerAcademicYearRoutes } from '@infrastructure/http/routes/academicYear.routes';
import { creerTimetableRoutes } from '@infrastructure/http/routes/timetable.routes';
import { creerParentRoutes } from '@infrastructure/http/routes/parent.routes';
import { creerSchoolSettingsRoutes } from '@infrastructure/http/routes/schoolSettings.routes';
import { ActivitiesLogController } from '@infrastructure/http/controllers/ActivitiesLogController';
import { DashboardController } from '@infrastructure/http/controllers/DashboardController';
import { EmailLogController } from '@infrastructure/http/controllers/EmailLogController';
import { SearchController } from '@infrastructure/http/controllers/SearchController';
import { AIController } from '@infrastructure/http/controllers/AIController';
import { AcademicEventController } from '@infrastructure/http/controllers/AcademicEventController';
import { creerAcademicEventRoutes } from '@infrastructure/http/routes/academicEvent.routes';
import {
  CreerEvenementAcademiqueUseCase,
  DeclencherEvenementUseCase,
  AjusterFenetreEvenementUseCase,
  ListerEvenementsUseCase,
  ObtenirEvenementsActifsUseCase,
} from '@application/academicEvent';
import { AssistantController } from '@infrastructure/http/controllers/AssistantController';
import { buildAdminActionCatalog } from '@infrastructure/assistant/catalog/adminActionCatalog';
import { buildTeacherActionCatalog } from '@infrastructure/assistant/catalog/teacherActionCatalog';
import { buildStaffActionCatalog } from '@infrastructure/assistant/catalog/staffActionCatalog';
import { buildParentActionCatalog } from '@infrastructure/assistant/catalog/parentActionCatalog';
import { buildStudentActionCatalog } from '@infrastructure/assistant/catalog/studentActionCatalog';
import { CreerTransactionAPEEUseCase } from '@application/apee/CreerTransactionAPEEUseCase';
import { ValiderDepenseAPEEUseCase } from '@application/apee/ValiderDepenseAPEEUseCase';
import { PrismaApeeRepository } from '@infrastructure/persistence/prisma/PrismaApeeRepository';
import { AffecterLV2EleveUseCase } from '@application/student/AffecterLV2EleveUseCase';
import { AffecterLV2EnMasseUseCase } from '@application/student/AffecterLV2EnMasseUseCase';
import { AffecterPEBSEleveUseCase } from '@application/student/AffecterPEBSEleveUseCase';
import { AffecterPEBSEnMasseUseCase } from '@application/student/AffecterPEBSEnMasseUseCase';
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
import { StatisticsController } from '@infrastructure/http/controllers/StatisticsController';
import { creerStatisticsRoutes } from '@infrastructure/http/routes/statistics.routes';
import { CommunicationsController, executerBroadcast } from '@infrastructure/http/controllers/CommunicationsController';
import { creerCommunicationsRoutes } from '@infrastructure/http/routes/communications.routes';
import { TimetableAutoController } from '@infrastructure/http/controllers/TimetableAutoController';
import { PedagogieController, calculerAlertesRetardProgramme } from '@infrastructure/http/controllers/PedagogieController';
import { AIActionAuditController } from '@infrastructure/http/controllers/AIActionAuditController';
import { CorbeilleController } from '@infrastructure/http/controllers/CorbeilleController';
import { creerPedagogieRoutes } from '@infrastructure/http/routes/pedagogie.routes';
import { HRController, traiterDemandeConge } from '@infrastructure/http/controllers/HRController';
import { creerHrRoutes } from '@infrastructure/http/routes/hr.routes';
import { HRSelfServiceController } from '@infrastructure/http/controllers/HRSelfServiceController';
import { creerHrSelfServiceRoutes } from '@infrastructure/http/routes/hrSelfService.routes';
import { ActiverEtablissementUseCase } from '@application/school/ActiverEtablissementUseCase';
import { ConfigurerEtablissementUseCase } from '@application/school/ConfigurerEtablissementUseCase';
import { ObtenirAnomaliesEtablissementUseCase } from '@application/school/ObtenirAnomaliesEtablissementUseCase';
import { OnboardingPEBSController } from '@infrastructure/http/controllers/OnboardingPEBSController';
import { AffecterMatieresALevelEleveUseCase } from '@application/student/AffecterMatieresALevelEleveUseCase';
import { PreremplirDepuisCombinaisonUseCase } from '@application/student/PreremplirDepuisCombinaisonUseCase';
import { GetElevesParMatiereALevelUseCase } from '@application/student/GetElevesParMatiereALevelUseCase';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { isNiveauPrimaireOuMaternelle } from '../../lib/classSerieValidator';
import { getStaffTitlesForTemplate } from '@domain/rules/StaffPermissionRules';
import {
  assignerMatieresPourClasse,
  CYCLE2_LEVELS as SYNC_CYCLE2_LEVELS,
  parseSerie as syncParseSerie,
} from '@application/school/SubjectAssignmentHelper';
import { PrismaSubjectAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaSubjectAssignmentRepository';
import { PrismaSchoolActivationRepository } from '@infrastructure/persistence/prisma/PrismaSchoolActivationRepository';
import { creerSchoolConfigRoutes } from '@infrastructure/http/routes/school-config.routes';
import { OrientationController } from '@infrastructure/http/controllers/OrientationController';
import { creerActivitiesRoutes } from '@infrastructure/http/routes/activities.routes';
import { creerDashboardRoutes } from '@infrastructure/http/routes/dashboard.routes';
import { creerEmailLogRoutes } from '@infrastructure/http/routes/emailLog.routes';
import { creerSearchRoutes } from '@infrastructure/http/routes/search.routes';
import { creerAIRoutes } from '@infrastructure/http/routes/ai.routes';
import { StudentFollowUpController } from '@infrastructure/http/controllers/StudentFollowUpController';
import { creerStudentFollowUpRoutes } from '@infrastructure/http/routes/studentFollowUp.routes';
import { PrismaStudentFollowUpRepository } from '@infrastructure/persistence/prisma/PrismaStudentFollowUpRepository';
import { PrismaSuiviRBACRepository } from '@infrastructure/persistence/prisma/PrismaSuiviRBACRepository';
import { PrismaAcademicEventRepository } from '@infrastructure/persistence/prisma/PrismaAcademicEventRepository';
import { notifierEvenementAcademique } from '@infrastructure/services/notification/AcademicEventNotificationService';
import { CreerActionSuiviEleveUseCase } from '@application/suivi/CreerActionSuiviEleveUseCase';
import { ClorreActionSuiviUseCase } from '@application/suivi/ClorreActionSuiviUseCase';
import { ListerActionsEnCoursUseCase } from '@application/suivi/ListerActionsEnCoursUseCase';
import { AssignerActionSuiviUseCase } from '@application/suivi/AssignerActionSuiviUseCase';
import { ListerHistoriqueSuiviEleveUseCase } from '@application/suivi/ListerHistoriqueSuiviEleveUseCase';
import { creerCoreDomainRoutes } from '@infrastructure/http/routes/coreDomain.routes';
import { creerPublicRoutes } from '@infrastructure/http/routes/public.routes';
import { creerSMSRoutes } from '@infrastructure/http/routes/sms.routes';
import { creerOrientationRoutes } from '@infrastructure/http/routes/orientation.routes';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import { DesignerAPUseCase } from '@application/user/DesignerAPUseCase';
import { ActivityLogAdapter } from '@infrastructure/services/audit/ActivityLogAdapter';
import { SmsNotificationAdapter } from '@infrastructure/services/sms/SmsNotificationAdapter';
import { DocumentAiAdapter } from '@infrastructure/services/ai/DocumentAiAdapter';
import { RealtimeSocketAdapter } from '@infrastructure/socket/RealtimeSocketAdapter';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';
import { LoginMasterUseCase } from '@application/masterAdmin/LoginMasterUseCase';
import { VerifyMfaUseCase } from '@application/masterAdmin/VerifyMfaUseCase';
import { MasterAuthController } from '@infrastructure/http/controllers/MasterAuthController';
import { creerMasterAuthRoutes } from '@infrastructure/http/routes/masterAuth.routes';
import { LoginGroupOwnerUseCase } from '@application/schoolGroup/LoginGroupOwnerUseCase';
import { VerifyGroupOwnerMfaUseCase } from '@application/schoolGroup/VerifyGroupOwnerMfaUseCase';
import { GroupAuthController } from '@infrastructure/http/controllers/GroupAuthController';
import { creerGroupAuthRoutes } from '@infrastructure/http/routes/groupAuth.routes';
import { ObtenirKpisGroupeUseCase } from '@application/schoolGroup/ObtenirKpisGroupeUseCase';
import { ListerEcolesGroupeUseCase } from '@application/schoolGroup/ListerEcolesGroupeUseCase';
import { ObtenirDetailEcoleGroupeUseCase } from '@application/schoolGroup/ObtenirDetailEcoleGroupeUseCase';
import { GroupDashboardController } from '@infrastructure/http/controllers/GroupDashboardController';
import { creerGroupDashboardRoutes } from '@infrastructure/http/routes/groupDashboard.routes';
import { CreerDemandeTransfertGroupeUseCase } from '@application/schoolGroup/CreerDemandeTransfertGroupeUseCase';
import { ListerDemandesTransfertGroupeUseCase } from '@application/schoolGroup/ListerDemandesTransfertGroupeUseCase';
import { RechercherPersonneEcoleGroupeUseCase } from '@application/schoolGroup/RechercherPersonneEcoleGroupeUseCase';
import { ListerDemandesTransfertEntrantesUseCase } from '@application/schoolGroup/ListerDemandesTransfertEntrantesUseCase';
import { AccepterTransfertEleveUseCase } from '@application/schoolGroup/AccepterTransfertEleveUseCase';
import { AccepterTransfertEnseignantUseCase } from '@application/schoolGroup/AccepterTransfertEnseignantUseCase';
import { RejeterTransfertGroupeUseCase } from '@application/schoolGroup/RejeterTransfertGroupeUseCase';
import { PrismaSchoolGroupOwnerAuthRepository } from '@infrastructure/persistence/prisma/PrismaSchoolGroupOwnerAuthRepository';
import { PrismaGroupTransferRepository } from '@infrastructure/persistence/prisma/PrismaGroupTransferRepository';
import { PrismaGroupeScolaireQueryRepository } from '@infrastructure/persistence/prisma/PrismaGroupeScolaireQueryRepository';
import { GroupTransferController } from '@infrastructure/http/controllers/GroupTransferController';
import { creerGroupTransferRoutes } from '@infrastructure/http/routes/groupTransfer.routes';
import { AdminGroupTransferController } from '@infrastructure/http/controllers/AdminGroupTransferController';
import { creerAdminGroupTransferRoutes } from '@infrastructure/http/routes/adminGroupTransfer.routes';
import { LoginEmailOtpUseCase } from '@application/user/LoginEmailOtpUseCase';
import { VerifierMfaConnexionUseCase } from '@application/user/VerifierMfaConnexionUseCase';
import { sendTransactionalEmail } from '../services/email/EmailService.ts';
import { notifyDisciplineSms, DISCIPLINE_TYPE_LABELS } from '../services/sms/SmsNotificationService.ts';
import { notifierParentsPushDabord } from '../services/notification/PushFirstNotifier.ts';
import { requireAuth, requireRole } from '../http/middlewares/auth.ts';
import { requireMasterSensitiveAuth } from '../http/middlewares/masterSensitiveAuth.ts';
import { MatriculeController } from '@infrastructure/http/controllers/MatriculeController';
import { creerMatriculeRoutes } from '@infrastructure/http/routes/matricule.routes';
import { EleveOnboardingController } from '@infrastructure/http/controllers/EleveOnboardingController';
import { creerEleveOnboardingRoutes } from '@infrastructure/http/routes/eleveOnboarding.routes';
import { StatisticalCampaignController } from '@infrastructure/http/controllers/StatisticalCampaignController';
import { creerStatisticalCampaignRoutes } from '@infrastructure/http/routes/statisticalCampaign.routes';
import { StatisticalCampaignMinedubController } from '@infrastructure/http/controllers/StatisticalCampaignMinedubController';
import { creerStatisticalCampaignMinedubRoutes } from '@infrastructure/http/routes/statisticalCampaignMinedub.routes';
import { PaiementMinesecController } from '@infrastructure/http/controllers/PaiementMinesecController';
import { creerPaiementMinesecRoutes } from '@infrastructure/http/routes/paiementMinesec.routes';
import { ExamenController } from '@infrastructure/http/controllers/ExamenController';
import { creerExamenRoutes } from '@infrastructure/http/routes/examen.routes';
import { Lv2ChoiceController } from '@infrastructure/http/controllers/Lv2ChoiceController';
import { creerLv2ChoiceRoutes, creerLv2ChoiceStudentRoutes } from '@infrastructure/http/routes/lv2Choice.routes';
import { EntranceExamController } from '@infrastructure/http/controllers/EntranceExamController';
import { creerEntranceExamRoutes } from '@infrastructure/http/routes/entranceExam.routes';
import { PebsExamController } from '@infrastructure/http/controllers/PebsExamController';
import { creerPebsExamRoutes } from '@infrastructure/http/routes/pebsExam.routes';
import { PushNotificationController } from '@infrastructure/http/controllers/PushNotificationController';
import { creerPushNotificationRoutes } from '@infrastructure/http/routes/pushNotification.routes';
import { NotificationController } from '@infrastructure/http/controllers/NotificationController';
import { creerNotificationRoutes } from '@infrastructure/http/routes/notification.routes';
import { AnnouncementController } from '@infrastructure/http/controllers/AnnouncementController';
import { PrismaAnnouncementRepository } from '@infrastructure/persistence/prisma/PrismaAnnouncementRepository';
import { CreerAnnonceUseCase } from '@application/announcement/CreerAnnonceUseCase';
import { ListerAnnoncesUseCase } from '@application/announcement/ListerAnnoncesUseCase';
import { ModifierAnnonceUseCase } from '@application/announcement/ModifierAnnonceUseCase';
import { SupprimerAnnonceUseCase } from '@application/announcement/SupprimerAnnonceUseCase';
import { creerAnnouncementRoutes } from '@infrastructure/http/routes/announcement.routes';
import { MessagerieController } from '@infrastructure/http/controllers/MessagerieController';
import { creerMessagerieRoutes } from '@infrastructure/http/routes/messagerie.routes';
import { PrismaMessagerieRepository } from '@infrastructure/persistence/prisma/PrismaMessagerieRepository';
import { EnvoyerMessageUseCase } from '@application/messagerie/EnvoyerMessageUseCase';
import { ListerConversationsUseCase } from '@application/messagerie/ListerConversationsUseCase';
import { ListerMessagesUseCase } from '@application/messagerie/ListerMessagesUseCase';
import { MarquerMessagesLusUseCase } from '@application/messagerie/MarquerMessagesLusUseCase';
import { ModererMessageUseCase } from '@application/messagerie/ModererMessageUseCase';
import { ListerMessagesEnAttenteModerationUseCase } from '@application/messagerie/ListerMessagesEnAttenteModerationUseCase';
import { ListerContactsMessagerieUseCase } from '@application/messagerie/ListerContactsMessagerieUseCase';
import { CompterMessagesNonLusUseCase } from '@application/messagerie/CompterMessagesNonLusUseCase';
import { APEEController } from '@infrastructure/http/controllers/APEEController';
import { creerApeeRoutes } from '@infrastructure/http/routes/apee.routes';
import { DisciplineCouncilController } from '@infrastructure/http/controllers/DisciplineCouncilController';
import { creerDisciplineCouncilRoutes } from '@infrastructure/http/routes/disciplineCouncil.routes';
import { DisciplineController } from '@infrastructure/http/controllers/DisciplineController';
import { creerDisciplineRoutes } from '@infrastructure/http/routes/discipline.routes';

export function bootstrapHexagonal(app: Application): void {
  const container = creerContainer();

  const gradeController = new GradeController(
    container.grade.saisirNote,
    container.grade.soumettreNote,
    container.grade.validerNote,
    container.grade.rejeterNote,
    container.grade.validerEnBloc,
    container.grade.modifierNote,
    container.grade.draftEnMasse,
    container.grade.listerNotes,
    container.grade.listerNotesEnAttente,
    container.grade.statutParClasse,
    container.grade.calculerMoyenne,
    container.grade.importerNotesExcel,
    container.school.schoolRepository,
    container.school.anneeRepository,
    container.school.classeRepository,
    container.school.matiereRepository,
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
    new GroqIAService(),
  );

  const classCouncilController = new ClassCouncilController(
    container.classCouncil.creerSession,
    container.classCouncil.preparerVue,
    container.classCouncil.listerSessions,
    container.classCouncil.obtenirSession,
    container.classCouncil.ajouterDecision,
    container.classCouncil.ajouterDecisionsEnBloc,
    container.classCouncil.verrouiller,
    container.classCouncil.publierBulletins,
    container.classCouncil.genererPV,
    container.classCouncil.genererRapport,
  );

  // ── Routes publiques d'onboarding par invitation (pas d'auth requise) ──
  const inviteOnboardingController = new InviteOnboardingController(prisma);
  app.get('/api/v2/onboarding/invite/:token', inviteOnboardingController.validateInvite);
  app.post('/api/v2/onboarding/invite/:token/complete', inviteOnboardingController.completeOnboarding);
  app.post('/api/v2/onboarding/preview-structure', inviteOnboardingController.previewStructure);

  // Combinaisons de matières anglophones (Sixth Form) — source unique de vérité pour l'onboarding.
  // Données EXCLUSIVEMENT issues de AnglophoneStreamCombination (jamais de valeurs hardcodées).
  app.get('/api/v2/onboarding/anglophone-streams', async (_req, res, next) => {
    try {
      const combos = await prisma.anglophoneStreamCombination.findMany({
        orderBy: { filiere: 'asc' },
      });
      const toEntry = (c: typeof combos[number]) => {
        const core = Array.isArray(c.coreSubjects) ? (c.coreSubjects as string[]) : [];
        const electives = Array.isArray(c.electiveGroup)
          ? (c.electiveGroup as string[][]).flat().filter((x): x is string => typeof x === 'string')
          : [];
        const subjects = [...new Set([...core, ...electives])];
        return {
          code: c.filiere,
          type: c.type,
          label: c.description ?? core.join(', '),
          coreSubjects: core,
          subjects,
        };
      };
      res.json({
        success: true,
        data: {
          arts:    combos.filter(c => c.type === 'ARTS').map(toEntry),
          science: combos.filter(c => c.type === 'SCIENCES').map(toEntry),
        },
      });
    } catch (err) { next(err); }
  });

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
        select: { id: true, name: true, subdomain: true, logoUrl: true, plan: true, city: true, region: true, phone: true, email: true, subsystem: true, status: true, educationType: true, ownership: true, onboardingConfig: true, hasPEBSFrancophone: true, hasPEBSAnglophone: true, minesecSchoolCode: true, templateCode: true },
      });
      if (!school) { res.status(404).json({ success: false, message: 'École introuvable' }); return; }
      // isPrimaire pilote l-affichage MINESEC (secondaire) vs MINEDUB (maternelle/primaire)
      // dans la sidebar admin — les deux menus etaient affiches sans distinction jusqu-ici.
      // templateCode absent (écoles créées avant l-introduction du champ, ou artefacts de
      // tests) : on ne devine pas "secondaire" par défaut, on renvoie null pour que le
      // frontend garde les deux menus visibles plutôt que d-en masquer un à tort. Même repli
      // pour COMPLEXE_SCOLAIRE : une école multi-cycles a des élèves des deux types, donc les
      // deux menus doivent rester visibles plutôt que d'en masquer un.
      const isPrimaire = school.templateCode && school.templateCode !== 'COMPLEXE_SCOLAIRE'
        ? getTemplateMeta(school.templateCode).isPrimaire
        : null;
      res.json({ success: true, data: { ...school, isPrimaire } });
    } catch (err) { next(err); }
  });

  // Assistant proactif (Section 6.3) — bannière ADMIN, anomalies d'établissement.
  const obtenirAnomaliesEtablissementUseCase = new ObtenirAnomaliesEtablissementUseCase(
    new PrismaAnneeAcademiqueRepository(prisma),
    new PrismaClasseRepository(prisma),
    new PrismaTimetableRepository(prisma),
    new PrismaClassCouncilRepository(prisma),
  );
  app.get('/api/v2/school/anomalies', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const anomalies = await obtenirAnomaliesEtablissementUseCase.execute({
        schoolId: req.user!.schoolId,
        userId: req.user!.userId,
      });
      res.json({ success: true, data: anomalies });
    } catch (err) { next(err); }
  });

  app.get('/api/v2/school/last-backup', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const settings = await prisma.schoolSettings.findUnique({
        where: { schoolId },
        select: { lastBackupAt: true, lastBackupFile: true },
      });
      const latest = await getLatestSchoolBackup(schoolId);
      res.json({
        success: true,
        data: {
          lastBackupAt: settings?.lastBackupAt ?? latest?.createdAt ?? null,
          lastBackupFile: settings?.lastBackupFile ?? latest?.filePath ?? null,
          latestFileExists: Boolean(settings?.lastBackupFile || latest),
        },
      });
    } catch (err) { next(err); }
  });

  app.get('/api/v2/school/export', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { name: true },
      });

      if (!school) {
        res.status(404).json({ success: false, message: 'École introuvable' });
        return;
      }

      const payload = await buildPayload(prisma, schoolId);
      const exportedAt = new Date().toISOString().replace(/[:.]/g, '-');
      const safeName = school.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'ecole';

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}-rgpd-${exportedAt}.json"`);
      res.send(JSON.stringify({
        success: true,
        data: {
          exportedAt: new Date().toISOString(),
          schoolId,
          schoolName: school.name,
          export: payload,
        },
      }, null, 2));
    } catch (err) { next(err); }
  });

  // ── Titres de staff disponibles selon le template de l'école ────────────
  // Retourne uniquement les titres appropriés (pas de rôles EN dans une école FR, etc.)
  app.get('/api/v2/school/staff-titles', requireAuth, async (req, res, next) => {
    try {
      const school = await prisma.school.findUnique({
        where: { id: req.user!.schoolId },
        select: { templateCode: true, onboardingConfig: true },
      });
      const onboardingConfig = school?.onboardingConfig as Record<string, unknown> | null | undefined;
      const templateCode = school?.templateCode
        ?? (onboardingConfig?.templateCode as string | undefined)
        ?? undefined;
      const meta = getTemplateMeta(templateCode);
      const titles = getStaffTitlesForTemplate(meta, templateCode);
      res.json({ success: true, data: titles });
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

      const cfg = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const classes: { name: string; level: string }[] = [];

      const niveaux1erCycle = cfg.niveaux1erCycle as string[] | undefined;
      const classesParNiveau = cfg.classesParNiveau as Record<string, number> | undefined;
      if (niveaux1erCycle) {
        const conv = (cfg.conventionNommage as string | undefined) ?? 'LETTRES';
        for (const n of niveaux1erCycle) {
          const c = classesParNiveau?.[n] ?? 2;
          for (let i = 0; i < Math.min(c, 26); i++) {
            const s = conv === 'LETTRES' ? L[i] : conv === 'CHIFFRES' ? `${i + 1}` : `${L[i]}1`;
            classes.push({ name: `${n} ${s}`, level: n });
          }
        }
      }
      const niveaux2eCycle = cfg.niveaux2eCycle as string[] | undefined;
      const filieres = cfg.filieres as string[] | undefined;
      const classesParFiliere = cfg.classesParFiliere as string | undefined;
      const a4Languages = cfg.a4Languages as string[] | undefined;
      if (niveaux2eCycle && filieres) {
        const nb = classesParFiliere === '3+' ? 3 : parseInt(classesParFiliere ?? '1');
        for (const n of niveaux2eCycle) {
          for (const f of filieres) {
            if (n === '2nde' && (/^TI/.test(f) || /F\s*·\s*G\s*·\s*H/.test(f) || /technique/i.test(f))) continue;
            if (f.startsWith('A4') || f.includes('A4')) {
              for (const lang of (a4Languages?.length ? a4Languages : ['LV'])) {
                classes.push({ name: `${n} A4-${lang}`, level: n });
              }
            } else {
              const short = f.split('—')[0]?.trim() ?? f;
              for (let i = 0; i < nb; i++) classes.push({ name: `${n} ${short}${nb > 1 ? ` ${L[i]}` : ''}`, level: n });
            }
          }
        }
      }
      const niveauxPrimaire = cfg.niveauxPrimaire as string[] | undefined;
      const classesParNiveauPrimaire = cfg.classesParNiveauPrimaire as Record<string, number> | undefined;
      if (niveauxPrimaire) {
        for (const n of niveauxPrimaire) {
          const c = classesParNiveauPrimaire?.[n] ?? 1;
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
      const { name, city, phone, email, minesecSchoolCode } = req.body as { name?: string; city?: string; phone?: string; email?: string; minesecSchoolCode?: string };
      const data: Record<string, string> = {};
      if (name)  data['name']  = name;
      if (city)  data['city']  = city;
      if (phone) data['phone'] = phone;
      if (email) data['email'] = email;
      if (minesecSchoolCode !== undefined) data['minesecSchoolCode'] = minesecSchoolCode.trim();
      const school = await prisma.school.update({ where: { id: schoolId }, data, select: { id: true, name: true, city: true, phone: true, email: true, minesecSchoolCode: true } });
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
          new PrismaSubjectAssignmentRepository(prisma), { name: cls.name, level: cls.level, filiere: cls.filiere ?? undefined }, schoolId,
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

  // ── PATCH /api/v2/schools/:id/structure ──────────────────────────────────
  // Met à jour le nombre de classes par niveau et crée les nouvelles classes manquantes.
  // Non-destructif : ne supprime jamais de classes existantes.
  // Les nouvelles classes héritent automatiquement des SubjectCoefficients du niveau
  // (qui sont partagés par niveau, pas par classe individuelle).
  app.patch('/api/v2/schools/:id/structure', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
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

      const anneeCourante = await prisma.academicYear.findFirst({
        where: { schoolId, isCurrent: true },
        select: { id: true },
      });
      if (!anneeCourante) {
        res.status(400).json({ success: false, message: 'Aucune année académique courante — impossible de créer une classe.' });
        return;
      }

      const currentConfig = (school.onboardingConfig ?? {}) as Record<string, unknown>;
      const body = req.body as {
        classesParNiveau?: Record<string, number>;
        classesParNiveauPrimaire?: Record<string, number>;
      };

      if (!body.classesParNiveau && !body.classesParNiveauPrimaire) {
        res.status(400).json({ success: false, message: 'Aucune mise à jour fournie' });
        return;
      }

      // Fusionner les nouvelles valeurs dans le config existant
      const newConfig: Record<string, unknown> = { ...currentConfig };
      if (body.classesParNiveau) {
        newConfig['classesParNiveau'] = {
          ...(currentConfig['classesParNiveau'] as Record<string, number> | undefined ?? {}),
          ...body.classesParNiveau,
        };
      }
      if (body.classesParNiveauPrimaire) {
        newConfig['classesParNiveauPrimaire'] = {
          ...(currentConfig['classesParNiveauPrimaire'] as Record<string, number> | undefined ?? {}),
          ...body.classesParNiveauPrimaire,
        };
      }

      await prisma.school.update({ where: { id: schoolId }, data: { onboardingConfig: newConfig as Prisma.InputJsonValue } });

      // Calculer la liste complète des classes attendues depuis la config mise à jour
      const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const conv = (newConfig['conventionNommage'] as string | undefined) ?? 'LETTRES';
      const expectedClasses: { name: string; level: string }[] = [];

      const niveaux1er = (newConfig['niveaux1erCycle'] as string[] | undefined) ?? [];
      const cpn = newConfig['classesParNiveau'] as Record<string, number> | undefined;
      for (const n of niveaux1er) {
        const c = cpn?.[n] ?? 2;
        for (let i = 0; i < Math.min(c, 26); i++) {
          const s = conv === 'LETTRES' ? L[i]! : conv === 'CHIFFRES' ? `${i + 1}` : `${L[i]!}1`;
          expectedClasses.push({ name: `${n} ${s}`, level: n });
        }
      }
      const niveauxPrimaire = (newConfig['niveauxPrimaire'] as string[] | undefined) ?? [];
      const cpnp = newConfig['classesParNiveauPrimaire'] as Record<string, number> | undefined;
      for (const n of niveauxPrimaire) {
        const c = cpnp?.[n] ?? 1;
        for (let i = 0; i < Math.min(c, 26); i++) {
          expectedClasses.push({ name: `${n} ${L[i]!}`, level: n });
        }
      }

      // Trouver les classes manquantes
      const existingClasses = await prisma.class.findMany({ where: { schoolId }, select: { name: true } });
      const existingNames = new Set(existingClasses.map(c => c.name));
      const toCreate = expectedClasses.filter(c => !existingNames.has(c.name));
      const created: string[] = [];

      if (toCreate.length > 0) {
        const templateCode = (newConfig['templateCode'] as string | undefined) ?? school.templateCode ?? '';
        const isAnglophone = getTemplateMeta(templateCode).isAnglophone;
        const schoolSubjects = await prisma.subject.findMany({ where: { schoolId }, select: { id: true, name: true } });
        const subjectByName = new Map(schoolSubjects.map(s => [s.name, s.id]));
        const subjectCountRef = { value: 0 };

        for (const cls of toCreate) {
          await prisma.class.create({ data: { schoolId, academicYearId: anneeCourante.id, name: cls.name, level: cls.level } });
          created.push(cls.name);

          // Si aucun SubjectCoefficient n'existe encore pour ce niveau, bootstrapper depuis le template.
          // Sinon, la nouvelle classe hérite automatiquement des coefficients existants du niveau.
          const existingCoeffs = await prisma.subjectCoefficient.count({ where: { schoolId, classLevel: cls.level } });
          if (existingCoeffs === 0) {
            await assignerMatieresPourClasse(
              new PrismaSubjectAssignmentRepository(prisma), { name: cls.name, level: cls.level, filiere: null },
              schoolId, newConfig, isAnglophone, subjectByName, subjectCountRef, templateCode,
            );
          }
        }
      }

      res.json({
        success: true,
        message: created.length > 0
          ? `${created.length} classe(s) créée(s) avec succès.`
          : 'Aucune nouvelle classe à créer.',
        data: { classesCreated: created, totalCreated: created.length },
      });
    } catch (err) { next(err); }
  });

  // ── GET  /api/v2/schools/:id/notification-settings ───────────────────────
  app.get('/api/v2/schools/:id/notification-settings', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.params['id'] as string;
      if (req.user!.schoolId !== schoolId) { res.status(403).json({ success: false, message: 'Accès refusé' }); return; }
      const settings = await prisma.schoolNotificationSettings.upsert({
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
      const updated = await prisma.schoolNotificationSettings.upsert({
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
      const config = await prisma.schoolConfig.findUnique({ where: { schoolId } });
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
      const updated = await prisma.schoolConfig.upsert({
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

  // ── Documents scolaires vérifiables (certificat, carte, transfert) ────────
  const studentDocumentController = new StudentDocumentController(prisma);
  app.use('/api/v2', creerStudentDocumentRoutes(studentDocumentController));

  const designerAPUseCase = new DesignerAPUseCase(new PrismaStaffProfileRepository(prisma), new ActivityLogAdapter());

  // ── Connexion renforcée (email OTP pour tous les rôles + MFA obligatoire ADMIN/STAFF/TEACHER) ──
  const userRepository = new PrismaUserRepository(prisma);
  const loginEmailOtpUseCase = new LoginEmailOtpUseCase(
    userRepository,
    async ({ recipientEmail, otp }: { recipientEmail: string; otp: string }) => {
      const result = await sendTransactionalEmail({
        recipientEmail,
        subject: 'ZekoulABia — Code de vérification connexion',
        html: `<p>Votre code de vérification est : <strong>${otp}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
        template: 'user-login-otp',
        eventType: 'user_login_otp',
      });
      if (result.status === 'failed') {
        throw new Error(result.error || "Échec d'envoi de l'email");
      }
    },
  );
  const verifierMfaConnexionUseCase = new VerifierMfaConnexionUseCase(userRepository);

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
    loginEmailOtpUseCase,
    verifierMfaConnexionUseCase,
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
  const masterUserAuthRepository = new PrismaMasterUserAuthRepository(prisma);
  const loginMasterUseCase = new LoginMasterUseCase(
    masterUserAuthRepository,
    async ({ recipientEmail, otp }: { recipientEmail: string; otp: string }) => {
      const result = await sendTransactionalEmail({
        recipientEmail,
        subject: 'ZekoulABia — Code de vérification connexion administrateur',
        html: `<p>Votre code de vérification est : <strong>${otp}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
        template: 'master-login-otp',
        eventType: 'master_login_otp',
      });
      if (result.status === 'failed') {
        throw new Error(result.error || "Échec d'envoi de l'email");
      }
    },
  );
  const verifyMfaUseCase = new VerifyMfaUseCase(masterUserAuthRepository);
  const masterAuthController = new MasterAuthController(loginMasterUseCase, verifyMfaUseCase);
  app.use('/api/v2/master/auth', creerMasterAuthRoutes(masterAuthController));

  app.use('/api/v2/master', creerMasterAdminHexRoutes(masterAdminHexController));

  // ── Group Owner Auth — Fondateur de Groupe scolaire (compte séparé, cf. Plan_Groupe_Scolaire) ──
  const schoolGroupOwnerAuthRepository = new PrismaSchoolGroupOwnerAuthRepository(prisma);
  const groupTransferRepository = new PrismaGroupTransferRepository(prisma);
  const groupeScolaireQueryRepository = new PrismaGroupeScolaireQueryRepository(prisma);

  const loginGroupOwnerUseCase = new LoginGroupOwnerUseCase(
    schoolGroupOwnerAuthRepository,
    async ({ recipientEmail, otp }: { recipientEmail: string; otp: string }) => {
      const result = await sendTransactionalEmail({
        recipientEmail,
        subject: 'ZekoulABia — Code de vérification connexion (Groupe Scolaire)',
        html: `<p>Votre code de vérification est : <strong>${otp}</strong></p><p>Ce code expire dans 10 minutes.</p>`,
        template: 'group-owner-login-otp',
        eventType: 'group_login_otp',
      });
      if (result.status === 'failed') {
        throw new Error(result.error || "Échec d'envoi de l'email");
      }
    },
  );
  const verifyGroupOwnerMfaUseCase = new VerifyGroupOwnerMfaUseCase(schoolGroupOwnerAuthRepository);
  const groupAuthController = new GroupAuthController(loginGroupOwnerUseCase, verifyGroupOwnerMfaUseCase);
  app.use('/api/v2/group/auth', creerGroupAuthRoutes(groupAuthController));

  const groupDashboardController = new GroupDashboardController(
    new ObtenirKpisGroupeUseCase(groupeScolaireQueryRepository),
    new ListerEcolesGroupeUseCase(groupeScolaireQueryRepository),
    new ObtenirDetailEcoleGroupeUseCase(groupeScolaireQueryRepository),
  );
  app.use('/api/v2/group/dashboard', creerGroupDashboardRoutes(groupDashboardController));

  const groupTransferController = new GroupTransferController(
    new CreerDemandeTransfertGroupeUseCase(groupTransferRepository, groupeScolaireQueryRepository),
    new ListerDemandesTransfertGroupeUseCase(groupTransferRepository, groupeScolaireQueryRepository),
    new RechercherPersonneEcoleGroupeUseCase(groupeScolaireQueryRepository),
  );
  app.use('/api/v2/group/transfers', creerGroupTransferRoutes(groupTransferController));

  const adminGroupTransferController = new AdminGroupTransferController(
    prisma,
    new ListerDemandesTransfertEntrantesUseCase(groupTransferRepository, groupeScolaireQueryRepository),
    new AccepterTransfertEleveUseCase(groupTransferRepository, groupeScolaireQueryRepository, container.eleveOnboarding.creerSquelette),
    new AccepterTransfertEnseignantUseCase(groupTransferRepository, groupeScolaireQueryRepository, container.user.inscrire),
    new RejeterTransfertGroupeUseCase(groupTransferRepository),
  );
  app.use('/api/v2/group-transfers', creerAdminGroupTransferRoutes(adminGroupTransferController));

  const financeController = new FinanceController(
    container.finance.creerPlanFrais,
    container.finance.genererFacture,
    container.finance.genererFacturesEnMasse,
    container.finance.initierPaiement,
    container.finance.traiterWebhook,
    container.finance.rembourserCaution,
    container.finance.enregistrerDepense,
    container.finance.enregistrerPaiementCash,
    container.finance.copierPlansFraisAnneePrecedente,
    container.finance.changerStatutPlanFrais,
  );

  app.use('/api/v2/finance', creerFinanceRoutes(financeController));

  const classeController = new ClasseController(
    container.class.creer,
    container.class.modifier,
    container.class.supprimer,
    container.class.assignerProfesseur,
    container.class.creerSousGroupe,
    container.class.assignerEleves,
    container.studentGroup.assignerSalleClasse,
    container.studentGroup.retirerAssignationSalle,
    prisma,
  );

  const subjectController = new SubjectController(
    container.subject.creer,
    container.subject.modifier,
    container.subject.assignerEnseignant,
    container.subject.definirCoefficient,
    container.subject.supprimer,
  );

  const roomController = new RoomController(
    container.room.creer,
    container.room.modifier,
    container.room.supprimer,
    prisma,
  );

  const teacherUnavailabilityController = new TeacherUnavailabilityController(
    container.teacherUnavailability.creer,
    container.teacherUnavailability.modifier,
    container.teacherUnavailability.supprimer,
    container.teacherUnavailability.lister,
    prisma,
  );

  const studentGroupController = new StudentGroupController(
    container.studentGroup.creerGroupSet,
    container.studentGroup.modifierGroupSet,
    container.studentGroup.supprimerGroupSet,
    container.studentGroup.creerGroup,
    container.studentGroup.modifierGroup,
    container.studentGroup.supprimerGroup,
  );

  app.use('/api/v2/classes', creerClasseRoutes(classeController));
  app.use('/api/v2/subjects', creerSubjectRoutes(subjectController));
  app.use('/api/v2/rooms', creerRoomRoutes(roomController));
  app.use('/api/v2/teacher-unavailabilities', creerTeacherUnavailabilityRoutes(teacherUnavailabilityController));
  app.use('/api/v2/student-groups', creerStudentGroupRoutes(studentGroupController));

  const departmentController = new DepartmentController(prisma);
  app.use('/api/v2/departments', creerDepartmentRoutes(departmentController));

  const statisticsController = new StatisticsController(prisma);
  app.use('/api/v2/statistics', creerStatisticsRoutes(statisticsController));

  const communicationsController = new CommunicationsController(prisma);
  app.use('/api/v2/communications', creerCommunicationsRoutes(communicationsController));

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
    container.academicYear.proposerStructureSuivante,
    container.academicYear.validerStructureSuivante,
    container.academicYear.annulerStructureSuivante,
  );

  app.use('/api/v2/academic-years', creerAcademicYearRoutes(academicYearController));

  const timetableController = new TimetableController(
    container.timetable.creer,
    container.timetable.ajouterCreneau,
    container.timetable.modifierCreneau,
    container.timetable.publier,
    container.timetable.demanderRattrapage,
    container.timetable.genererSeancesGroupe,
    container.timetable.proposerEmploiDuTemps,
    container.timetable.appliquerProposition,
    container.timetable.simulerEmploiDuTemps,
  );

  // ── POST /api/v2/timetables/generate-skeleton — génère les créneaux vides pour une classe ──
  app.post('/api/v2/timetables/generate-skeleton', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { classId } = req.body as { classId?: string };
      if (!classId) { res.status(400).json({ success: false, message: 'classId requis' }); return; }

      // Les préconditions (grille configurée, classe/année existantes, EDT pas déjà créé) sont
      // portées par le use case — la route ne fait plus que traduire ses erreurs en statuts HTTP.
      const { timetableId } = await container.timetable.genererSquelette.execute({ schoolId, classId });

      // Relecture pour conserver à l'identique la forme de réponse attendue par le front
      // (timetable + class + slots triés).
      const timetable = await prisma.timetable.findUnique({
        where: { id: timetableId },
        include: {
          class: { select: { id: true, name: true } },
          slots: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        },
      });

      res.status(201).json({ success: true, data: timetable });
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('existe déjà')) {
        // Le front s'appuie sur data.timetableId pour basculer sur l'EDT existant — contrat conservé.
        const annee = await prisma.academicYear.findFirst({ where: { schoolId: req.user!.schoolId, isCurrent: true }, select: { id: true } });
        const existing = annee
          ? await prisma.timetable.findFirst({
              where: { schoolId: req.user!.schoolId, classId: (req.body as { classId?: string }).classId, academicYearId: annee.id },
              select: { id: true },
            })
          : null;
        res.status(409).json({ success: false, message, data: { timetableId: existing?.id } });
        return;
      }
      if (message.includes('Classe introuvable')) { res.status(404).json({ success: false, message }); return; }
      if (message.includes('grille horaire') || message.includes('année scolaire')) {
        res.status(422).json({ success: false, message }); return;
      }
      next(err);
    }
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
      const { subjectId, teacherId, isLV2Slot } = req.body as { subjectId?: string | null; teacherId?: string | null; isLV2Slot?: boolean };

      const slot = await prisma.timetableSlot.findFirst({
        where: { id: slotId },
        include: { timetable: { select: { schoolId: true, classId: true } } },
      });
      if (!slot || slot.timetable.schoolId !== schoolId) { res.status(404).json({ success: false, message: 'Créneau introuvable.' }); return; }

      // Vérifier que l'enseignant est bien assigné à cette matière pour cette classe
      if (teacherId && subjectId) {
        const assignment = await prisma.teachingAssignment.findUnique({
          where: { classId_subjectId: { classId: slot.timetable.classId, subjectId } },
        });
        if (!assignment || assignment.teacherId !== teacherId) {
          const msg = assignment
            ? 'Cette matière est assignée à un autre enseignant pour cette classe.'
            : 'Aucune affectation n\'existe pour cette matière dans cette classe. Assignez d\'abord l\'enseignant à la matière via la gestion des classes.';
          res.status(400).json({ success: false, code: 'ENSEIGNANT_NON_ASSIGNE', message: msg }); return;
        }
      }

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
        // Un enseignant est AP s'il a supervisedSubjectIds (via DesignerAPUseCase)
        // OU s'il est headId d'un département (via DepartmentController)
        const [teacherProfile, isHeadOfDept] = await Promise.all([
          prisma.teacherProfile.findFirst({ where: { userId: teacherId }, select: { supervisedSubjectIds: true } }),
          prisma.department.findFirst({ where: { headId: teacherId, schoolId }, select: { id: true } }),
        ]);
        const isAP = (teacherProfile && teacherProfile.supervisedSubjectIds.length > 0) || !!isHeadOfDept;
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
        data: {
          subjectId: subjectId ?? null,
          teacherId: teacherId ?? null,
          ...(typeof isLV2Slot === 'boolean' ? { isLV2Slot } : {}),
        },
        include: {
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  });

  // ── POST /api/v2/timetables/:id/adjust — ajustement d'un EDT en langage naturel ──
  // La génération automatique passe désormais exclusivement par le Scheduling Engine V2.5
  // (propose-schedule / apply-schedule) : l'ancien moteur glouton `auto-generate` a été
  // supprimé pour qu'il n'existe qu'UNE voie de génération. `adjust` est conservé — c'est une
  // fonctionnalité d'édition, sans équivalent côté solveur.
  const timetableAutoController = new TimetableAutoController(
    prisma,
    container.timetable.modifierCreneau,
  );
  app.post('/api/v2/timetables/:id/adjust', requireAuth, requireRole('ADMIN', 'STAFF'), timetableAutoController.adjust);

  app.use('/api/v2/timetables', creerTimetableRoutes(timetableController));

  // ── Module Pédagogie (C.1) ────────────────────────────────────────────────
  const pedagogieController = new PedagogieController(prisma);
  app.use('/api/v2/pedagogie', requireAuth, creerPedagogieRoutes(pedagogieController));

  // ── Sécurité de l'assistant IA — Journal d'établissement ───────────────────
  const aiActionAuditController = new AIActionAuditController(prisma);
  app.get('/api/v2/security/audit-log', requireAuth, requireRole('ADMIN'), aiActionAuditController.journalEtablissement);

  // ── Couche 1 — Écran Corbeille ───────────────────────────────────────────
  const corbeilleController = new CorbeilleController(prisma);
  app.get('/api/v2/corbeille', requireAuth, requireRole('ADMIN'), corbeilleController.lister);
  app.post('/api/v2/corbeille/:type/:id/restore', requireAuth, requireRole('ADMIN'), corbeilleController.restaurer);

  // ── Module RH (C.2) ───────────────────────────────────────────────────────
  const hrController = new HRController(prisma);
  app.use('/api/v2/hr', requireAuth, requireRole('ADMIN', 'STAFF'), creerHrRoutes(hrController));

  // ── Module RH — self-service employé (accès ADMIN/STAFF/TEACHER, scopé à soi-même) ──
  const hrSelfServiceController = new HRSelfServiceController(prisma);
  app.use('/api/v2/hr-self-service', creerHrSelfServiceRoutes(hrSelfServiceController));

  const parentController = new ParentController(
    container.parent.obtenirEnfants,
    container.parent.verifierAcces,
    container.finance.initierPaiement,
    container.finance.factureRepository,
    container.parent.obtenirAlertesSolde,
  );

  const schoolSettingsController = new SchoolSettingsController(
    container.schoolSettings.obtenir,
    container.schoolSettings.mettreAJour,
  );

  app.use('/api/v2/parent', creerParentRoutes(parentController));
  app.use('/api/v2/school-settings', creerSchoolSettingsRoutes(schoolSettingsController));

  // ── Activation de l'établissement (Admin, après configuration) ─────
  const schoolActivationRepository = new PrismaSchoolActivationRepository(prisma);
  const activerEtablissementUseCase = new ActiverEtablissementUseCase(schoolActivationRepository);
  app.use('/api/v2', creerSchoolConfigRoutes(activerEtablissementUseCase));

  // ── Onboarding conversationnel Phase 2 : exécution déterministe ────
  const configurerEtablissementUseCase = new ConfigurerEtablissementUseCase(schoolActivationRepository, activerEtablissementUseCase);
  const onboardingPEBSController = new OnboardingPEBSController();
  app.post('/api/v2/onboarding/execute', requireAuth, requireRole('ADMIN'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId; // schoolId forcé depuis la session (sécurité)
      const state = { ...(req.body ?? {}), schoolId };
      const result = await configurerEtablissementUseCase.execute(state);
      res.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('introuvable')) { res.status(404).json({ success: false, message: error.message }); return; }
        if (error.message.includes('déjà') || error.message.includes('approuvé') || error.message.includes('requis')) {
          res.status(422).json({ success: false, message: error.message }); return;
        }
      }
      next(error);
    }
  });
  app.post('/api/v2/onboarding/analyze-pebs', requireAuth, requireRole('ADMIN'), onboardingPEBSController.analyze);

  // ── Thin controllers (pas de use case — Prisma direct, aucune logique métier) ──
  const enrollmentRepository = new PrismaEnrollmentRepository(prisma);
  const activitiesController = new ActivitiesLogController(prisma);
  const dashboardController  = new DashboardController(prisma, enrollmentRepository);
  const emailLogController   = new EmailLogController(prisma);
  const searchController     = new SearchController(prisma);
  const aiController         = new AIController(prisma, enrollmentRepository, container.prediction.comparerRisque);
  const studentFollowUpRepo  = new PrismaStudentFollowUpRepository(prisma);
  const suiviRBACRepository    = new PrismaSuiviRBACRepository(prisma);
  const studentFollowUpController = new StudentFollowUpController(
    new CreerActionSuiviEleveUseCase(studentFollowUpRepo, suiviRBACRepository),
    new ClorreActionSuiviUseCase(studentFollowUpRepo),
    new ListerActionsEnCoursUseCase(studentFollowUpRepo),
    new AssignerActionSuiviUseCase(studentFollowUpRepo, suiviRBACRepository),
    new ListerHistoriqueSuiviEleveUseCase(studentFollowUpRepo, suiviRBACRepository),
    prisma,
  );
  const lv2ChoiceRepository = new PrismaLv2ChoiceRepository(prisma);
  const anneeRepository = new PrismaAnneeAcademiqueRepository(prisma);
  const studentAffectationRepository = new PrismaStudentAffectationRepository(prisma);
  const academicEventRepository = new PrismaAcademicEventRepository(prisma);
  const notifierEvenement = (schoolId: string, roles: string[], titre: string, corps: string) =>
    notifierEvenementAcademique(prisma, schoolId, roles, titre, corps);
  const smsNotificationAdapter = new SmsNotificationAdapter();
  const academicEventController = new AcademicEventController(
    new CreerEvenementAcademiqueUseCase(academicEventRepository, lv2ChoiceRepository, anneeRepository, smsNotificationAdapter),
    new DeclencherEvenementUseCase(academicEventRepository, lv2ChoiceRepository, anneeRepository, notifierEvenement, smsNotificationAdapter),
    new AjusterFenetreEvenementUseCase(academicEventRepository, lv2ChoiceRepository),
    new ListerEvenementsUseCase(academicEventRepository),
    new ObtenirEvenementsActifsUseCase(academicEventRepository),
  );
  const coreDomainController = new CoreDomainController(prisma);
  const publicController     = new PublicController(prisma);
  const smsController        = new SMSController(prisma, container.attendance.traiterSmsPresence);

  const orientationController = new OrientationController(
    container.orientation.creerFiche,
    container.orientation.ajouterEntretien,
    container.orientation.ajouterTest,
    container.orientation.creerRecommandation,
    container.orientation.ajouterSuivi,
    container.orientation.listerFiches,
    container.orientation.getStats,
    container.orientation.repo,
    container.orientation.saisirAspiration,
    container.orientation.genererRecommandation,
    container.orientation.validerRecommandationConseiller,
    container.orientation.proposerRecommandationEleve,
    container.orientation.choisirPisteEleve,
    container.orientation.listerElevesAOrienter,
    container.orientation.configurerCheckpoint,
    prisma,
  );

  app.use('/api/v2/orientation', creerOrientationRoutes(orientationController));

  // ── Matricule National MINESEC ──────────────────────────────────────────
  const matriculeController = new MatriculeController(
    container.matricule.importerMatricules,
    container.matricule.verifierMatricule,
    container.matricule.syncFromCarteScolaire,
    container.matricule.verifierRecu,
    container.matricule.confirmerFuzzy,
    container.matricule.signalerErreur,
    prisma,
  );
  app.use('/api/v2/matricules', creerMatriculeRoutes(matriculeController));
  // Route orpheline retrouvée : la méthode existait sur le controller mais n'était montée nulle part.
  app.patch('/api/v2/students/:id/matricule', requireAuth, requireRole('ADMIN', 'STAFF'), matriculeController.updateMatricule);

  // ── Onboarding Auto-Service Élèves ──────────────────────────────────────
  // Préfixe distinct de /api/v2/onboarding (déjà pris par l'onboarding d'établissement,
  // module sans rapport — voir spec-onboarding-eleve-autoservice.md section 0 point 4).
  const eleveOnboardingController = new EleveOnboardingController(
    container.eleveOnboarding.creerSquelette,
    container.eleveOnboarding.soumettreFormulaire,
    container.eleveOnboarding.valider,
    container.eleveOnboarding.rejeter,
    prisma,
  );
  app.use('/api/v2/eleve-onboarding', creerEleveOnboardingRoutes(eleveOnboardingController));

  // ── Interopérabilité statistique MINESEC ────────────────────────────────
  const statisticalCampaignController = new StatisticalCampaignController(
    container.statisticalCampaign.verifierCompletude,
    container.statisticalCampaign.genererDeclaration,
    prisma,
  );
  app.use('/api/v2/statistical-campaign', creerStatisticalCampaignRoutes(statisticalCampaignController));

  // ── Interopérabilité statistique MINEDUB (rapport PDF non officiel) ────
  const statisticalCampaignMinedubController = new StatisticalCampaignMinedubController(
    container.statisticalCampaignMinedub.genererRapport,
    prisma,
  );
  app.use('/api/v2/statistical-campaign-minedub', creerStatisticalCampaignMinedubRoutes(statisticalCampaignMinedubController));

  // ── Paiements MINESEC ───────────────────────────────────────────────────
  const paiementMinesecController = new PaiementMinesecController(
    container.paiementMinesec.genererPaiements,
    container.paiementMinesec.genererPaiementsEcole,
    container.paiementMinesec.getDashboard,
    container.paiementMinesec.getOverview,
    prisma,
  );
  app.use('/api/v2/paiements-minesec', creerPaiementMinesecRoutes(paiementMinesecController));

  // ── Inscriptions Examens ────────────────────────────────────────────────
  const examenController = new ExamenController(
    container.examen.prepareDossier,
    prisma,
  );
  app.use('/api/v2/examens', creerExamenRoutes(examenController));

  // ── LV2 Choice (Sous-module C) ─────────────────────────────────────────
  const lv2ChoiceController = new Lv2ChoiceController(
    prisma,
    container.lv2Choice.ouvrirFenetre,
    container.lv2Choice.soumettreChoix,
    container.lv2Choice.saisirManuel,
    container.lv2Choice.appliquerChoix,
    container.lv2Choice.suivreFenetre,
  );
  app.use('/api/v2/lv2-choice-windows', creerLv2ChoiceRoutes(lv2ChoiceController));
  app.use('/api/v2/students/me', creerLv2ChoiceStudentRoutes(lv2ChoiceController));

  // ── Entrance Exams (Sous-module A) ─────────────────────────────────────
  const entranceExamController = new EntranceExamController(
    container.entranceExam.creerSession,
    container.entranceExam.ajouterCandidats,
    container.entranceExam.calculerAdmission,
    container.entranceExam.enregistrerCep,
    container.entranceExam.resumeSession,
    container.entranceExam.scannerListe,
    container.entranceExam.detecterAnomalies,
    prisma,
  );
  app.use('/api/v2/entrance-exams', creerEntranceExamRoutes(entranceExamController));

  // ── PEBS Exams (Sous-module B) ─────────────────────────────────────────
  const pebsExamController = new PebsExamController(
    container.pebsExam.creerSession,
    container.pebsExam.ajouterCandidats,
    container.pebsExam.calculerSelection,
    container.pebsExam.appliquerTransfert,
    container.pebsExam.resumeSession,
    container.pebsExam.scannerListe,
    container.pebsExam.detecterAnomalies,
    prisma,
  );
  app.use('/api/v2/pebs-exams', creerPebsExamRoutes(pebsExamController));

  // ── Push Notifications (Web Push) ────────────────────────────────────────────
  const pushNotificationController = new PushNotificationController(
    container.pushNotification.souscrire,
    container.pushNotification.desinscrire,
  );
  app.use('/api/v2/push', creerPushNotificationRoutes(pushNotificationController));

  // ── Notifications IN_APP (cloche) ────────────────────────────────────────────
  const notificationController = new NotificationController(container.notification.service);
  app.use('/api/v2/notifications', creerNotificationRoutes(notificationController));

  // ── Babillard numérique ─────────────────────────────────────────────────────
  const announcementRepository = new PrismaAnnouncementRepository(prisma);
  const creerAnnonceUseCase = new CreerAnnonceUseCase(announcementRepository);
  const listerAnnoncesUseCase = new ListerAnnoncesUseCase(announcementRepository);
  const modifierAnnonceUseCase = new ModifierAnnonceUseCase(announcementRepository);
  const supprimerAnnonceUseCase = new SupprimerAnnonceUseCase(announcementRepository);
  const announcementController = new AnnouncementController(
    prisma,
    creerAnnonceUseCase,
    listerAnnoncesUseCase,
    modifierAnnonceUseCase,
    supprimerAnnonceUseCase,
  );
  app.use('/api/v2/announcements', creerAnnouncementRoutes(announcementController));

  // ── Messagerie bidirectionnelle ──────────────────────────────────────────────
  const messagerieRepository = new PrismaMessagerieRepository(prisma);
  const notificationService = new SocketNotificationService();
  const realtimeSocketAdapter = new RealtimeSocketAdapter();
  const envoyerMessageUseCase = new EnvoyerMessageUseCase(messagerieRepository, notificationService, realtimeSocketAdapter);
  const listerConversationsUseCase = new ListerConversationsUseCase(messagerieRepository);
  const listerMessagesUseCase = new ListerMessagesUseCase(messagerieRepository);
  const marquerLusUseCase = new MarquerMessagesLusUseCase(messagerieRepository);
  const modererMessageUseCase = new ModererMessageUseCase(messagerieRepository, notificationService);
  const listerEnAttenteModerationUseCase = new ListerMessagesEnAttenteModerationUseCase(messagerieRepository);
  const listerContactsMessagerieUseCase = new ListerContactsMessagerieUseCase(messagerieRepository);
  const compterMessagesNonLusUseCase = new CompterMessagesNonLusUseCase(messagerieRepository);
  const messagerieController = new MessagerieController(
    envoyerMessageUseCase,
    listerConversationsUseCase,
    listerMessagesUseCase,
    marquerLusUseCase,
    modererMessageUseCase,
    listerEnAttenteModerationUseCase,
    listerContactsMessagerieUseCase,
    compterMessagesNonLusUseCase,
  );
  app.use('/api/v2/messagerie', creerMessagerieRoutes(messagerieController));

  // ── Transparence financière APEE ─────────────────────────────────────────────
  const apeeController = new APEEController(prisma);
  app.use('/api/v2/apee', creerApeeRoutes(apeeController));

  // ── Conseil de Discipline (Art. 30) ──────────────────────────────────────────
  const disciplineCouncilController = new DisciplineCouncilController(prisma);
  app.use('/api/v2/discipline-council', creerDisciplineCouncilRoutes(disciplineCouncilController));

  app.use('/api/v2/activities',    creerActivitiesRoutes(activitiesController));
  app.use('/api/v2/dashboard',     creerDashboardRoutes(dashboardController));
  app.use('/api/v2/email-logs',    creerEmailLogRoutes(emailLogController));
  app.use('/api/v2/search',        creerSearchRoutes(searchController));
  app.use('/api/v2/ai',            creerAIRoutes(aiController));
  app.use('/api/v2/student-follow-up', creerStudentFollowUpRoutes(studentFollowUpController));
  app.use('/api/v2/academic-events', creerAcademicEventRoutes(academicEventController));
  app.post('/api/v2/assistant/chat', requireAuth, aiController.assistantChat);

  // ── Assistant IA EXÉCUTANT (copilot) — rôle ADMIN uniquement ────────────────
  // Catalogue d'actions mappé sur les use cases existants ; RBAC filtré + revérifié serveur.
  const groupSetRepositoryLeger = new PrismaStudentGroupSetRepository(prisma);
  const groupRepositoryLeger = new PrismaStudentGroupRepository(prisma);
  const membershipRepositoryLeger = new PrismaStudentGroupMembershipRepository(prisma);
  const adminActionCatalog = buildAdminActionCatalog({
    creerClasse: container.class.creer,
    supprimerClasse: container.class.supprimer,
    assignerProfesseur: container.class.assignerProfesseur,
    creerMatiere: container.subject.creer,
    assignerEnseignant: container.subject.assignerEnseignant,
    supprimerMatiere: container.subject.supprimer,
    creerSessionConcours: container.entranceExam.creerSession,
    creerSessionPebs: container.pebsExam.creerSession,
    ouvrirFenetreLV2: container.lv2Choice.ouvrirFenetre,
    inscrireEleve: container.user.inscrire,
    modifierUtilisateur: container.user.modifier,
    supprimerUtilisateur: container.user.supprimer,
    transfererEleve: container.user.transferer,
    modifierMatiere: container.subject.modifier,
    // Constructeurs légers (prisma uniquement) — pas encore exposés dans le container.
    affecterLV2Eleve: new AffecterLV2EleveUseCase(studentAffectationRepository, anneeRepository, groupSetRepositoryLeger, groupRepositoryLeger, membershipRepositoryLeger),
    affecterLV2Masse: new AffecterLV2EnMasseUseCase(studentAffectationRepository, anneeRepository, groupSetRepositoryLeger, groupRepositoryLeger, membershipRepositoryLeger),
    affecterPEBSEleve: new AffecterPEBSEleveUseCase(studentAffectationRepository, anneeRepository, groupSetRepositoryLeger, groupRepositoryLeger, membershipRepositoryLeger),
    affecterPEBSMasse: new AffecterPEBSEnMasseUseCase(studentAffectationRepository, anneeRepository, groupSetRepositoryLeger, groupRepositoryLeger, membershipRepositoryLeger),
    genererBulletins: container.reportCard.generer,
    envoyerBulletins: container.reportCard.envoyer,
    validerNotesEnBloc: container.grade.validerEnBloc,
    publierEDT: container.timetable.publier,
    ouvrirConseilClasse: container.classCouncil.tenir,
    definirPeriodeCourante: container.academicYear.definirPeriode,
    verifierPrerequisCloture: container.academicYear.verifierPrerequis,
    creerPlanFrais: container.finance.creerPlanFrais,
    genererFacturesMasse: container.finance.genererFacturesEnMasse,
    enregistrerPaiementCash: container.finance.enregistrerPaiementCash,
    resumeSessionConcours: container.entranceExam.resumeSession,
    calculerAdmissionConcours: container.entranceExam.calculerAdmission,
    resumeSessionPebs: container.pebsExam.resumeSession,
    calculerSelectionPebs: container.pebsExam.calculerSelection,
    verifierMatricule: container.matricule.verifierMatricule,
    traiterDemandeConge: (schoolId, requestId, statut, validatedById) =>
      traiterDemandeConge(prisma, schoolId, requestId, statut, validatedById),
    diffuserMessage: (schoolId, createdById, target, channel, message) =>
      executerBroadcast(prisma, schoolId, createdById, target as Parameters<typeof executerBroadcast>[3], channel, message),
    alertesRetardProgramme: (schoolId, academicYearId, seuilPct) =>
      calculerAlertesRetardProgramme(prisma, schoolId, academicYearId, seuilPct),
  });

  // ── Assistant IA EXÉCUTANT (copilot) — rôle TEACHER (Section 6.2 du chantier) ──
  const teacherActionCatalog = buildTeacherActionCatalog({
    saisirNote: container.grade.saisirNote,
    soumettreNote: container.grade.soumettreNote,
    enregistrerPresence: container.attendance.enregistrerPresence,
    demanderRattrapage: container.timetable.demanderRattrapage,
  });

  // ── Assistant IA EXÉCUTANT (copilot) — rôle STAFF (Section 6.2 du chantier) ──
  // Discipline/APEE/Bibliothèque/Orientation uniquement — le reste (Finance, Notes, Conseil
  // de classe...) est déjà dans adminActionCatalog.ts et devient accessible à STAFF via son
  // requiredPermission dès que la route l'autorise, sans duplication.
  const staffActionCatalog = buildStaffActionCatalog({
    creerTransactionAPEE: new CreerTransactionAPEEUseCase(new PrismaApeeRepository(prisma)),
    validerDepenseAPEE: new ValiderDepenseAPEEUseCase(new PrismaApeeRepository(prisma)),
    ajouterSuiviOrientation: container.orientation.ajouterSuivi,
    notifierSanctionDisciplinaire: async (schoolId, studentId, studentName, type, reason) => {
      const { phonesSansPush } = await notifierParentsPushDabord({
        schoolId, studentId, type: 'DISCIPLINE_SANCTION',
        titre: 'Sanction disciplinaire',
        corps: `${studentName} a fait l'objet d'une sanction disciplinaire. Motif : ${reason}.`,
      });
      await notifyDisciplineSms({ schoolId, studentId, studentName, type, reason, phones: phonesSansPush });
      const parentLinks = await prisma.parentStudent.findMany({
        where: { studentProfile: { userId: studentId } },
        include: { parentProfile: { include: { user: { select: { email: true } } } } },
      });
      const parentEmails = [...new Set(parentLinks.map((l) => l.parentProfile?.user?.email).filter((e): e is string => Boolean(e)))];
      const typeLabel = DISCIPLINE_TYPE_LABELS[type]?.fr ?? type;
      for (const email of parentEmails) {
        await sendTransactionalEmail({
          recipientEmail: email,
          subject: `Notification disciplinaire — ${studentName}`,
          html: `<p>Bonjour,</p><p><b>${studentName}</b> a fait l'objet d'une sanction disciplinaire.</p><p><b>Type :</b> ${typeLabel}</p><p><b>Motif :</b> ${reason}</p><p>Merci de contacter l'établissement pour plus d'informations.</p>`,
          text: `Sanction disciplinaire pour ${studentName} : ${typeLabel} — ${reason}`,
          template: 'discipline_notification',
          eventType: 'discipline_notification',
          metadata: { schoolId },
        });
      }
    },
  });

  // ── Assistant IA EXÉCUTANT (copilot) — rôle PARENT (Section 6.2 du chantier) ──
  const parentActionCatalog = buildParentActionCatalog({
    initierPaiement: container.finance.initierPaiement,
  });

  // ── Assistant IA EXÉCUTANT (copilot) — rôle STUDENT (Section 6.2 du chantier) ──
  // Consultation uniquement, pas d'actions (voir plan) — aucune dépendance à câbler.
  const studentActionCatalog = buildStudentActionCatalog();

  // Un seul copilot, un seul catalogue combiné (Principe 0.1) — chaque action porte son
  // propre `allowedRoles`/`requiredPermission`, filtré côté serveur par filterCatalogForUser.
  const assistantController = new AssistantController(prisma, [...adminActionCatalog, ...teacherActionCatalog, ...staffActionCatalog, ...parentActionCatalog, ...studentActionCatalog]);
  app.post('/api/v2/assistant/execute', requireAuth, requireRole('ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'), assistantController.execute);
  app.post('/api/v2/assistant/confirm-action', requireAuth, requireRole('ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'), assistantController.confirmAction);
  app.post('/api/v2/assistant/undo-action', requireAuth, requireRole('ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'), assistantController.undoAction);
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
        ...(classId && role === 'STUDENT' ? whereElevesParClasse(classId) : {}),
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
      const [total, rawUsers, roleGroups] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: {
            id: true, firstName: true, lastName: true, email: true, role: true,
            isActive: true, lastLogin: true, createdAt: true,
            studentProfile: {
              select: {
                id: true, dateOfBirth: true, gender: true,
                enrollmentsYearScoped: {
                  where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                  select: { classId: true, class: { select: { name: true } } },
                  take: 1,
                },
              },
            },
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

      // Mapper pour préserver le contrat API (studentProfile.classId + studentProfile.class.name)
      const users = rawUsers.map(u => {
        if (!u.studentProfile) return u;
        const enrollment = u.studentProfile.enrollmentsYearScoped?.[0];
        const { enrollmentsYearScoped: _enr, ...profileRest } = u.studentProfile;
        return {
          ...u,
          studentProfile: {
            ...profileRest,
            classId: enrollment?.classId ?? null,
            class: enrollment?.class ?? null,
          },
        };
      });

      const roleCounts = roleGroups
        ? Object.fromEntries(roleGroups.map(g => [g.role, g._count.id]))
        : undefined;
      res.json({ success: true, data: users, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) }, roleCounts });
    } catch (err) { next(err); }
  });

  // GET /api/v2/users/me — infos de l'utilisateur connecté
  app.get('/api/v2/users/me', requireAuth, async (req, res, next) => {
    try {
      const rawUser = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: {
          id: true, firstName: true, lastName: true, email: true, role: true, isActive: true,
          teacherProfile: {
            select: {
              id: true, specialization: true,
              teacherSubjects: { select: { subject: { select: { id: true, name: true } } } },
            },
          },
          studentProfile: {
            select: {
              id: true,
              enrollmentsYearScoped: {
                where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                select: { class: { select: { id: true, name: true } } },
                take: 1,
              },
            },
          },
          staffProfile: { select: { id: true, title: true } },
          classesProfessorPrincipal: {
            select: {
              id: true, name: true,
              _count: {
                select: {
                  enrollments: {
                    where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
                  },
                },
              },
            },
          },
          headedDepartments: { select: { id: true, name: true, color: true, subjects: { select: { id: true, name: true } } } },
        },
      });

      if (!rawUser) { res.status(404).json({ success: false, message: 'Utilisateur introuvable' }); return; }

      // Mapper pour préserver le contrat API
      const user = {
        ...rawUser,
        studentProfile: rawUser.studentProfile
          ? {
              id: rawUser.studentProfile.id,
              class: rawUser.studentProfile.enrollmentsYearScoped?.[0]?.class ?? null,
            }
          : null,
        classesProfessorPrincipal: rawUser.classesProfessorPrincipal?.map(c => ({
          id: c.id,
          name: c.name,
          _count: { students: c._count.enrollments }, // préserve la clé "students" pour le frontend
        })),
      };

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
          _count: {
            select: {
              enrollments: {
                where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Le niveau RÉEL de chaque classe (Class.level) tranche en priorité — nécessaire pour
      // COMPLEXE_SCOLAIRE où primaire et secondaire coexistent dans la même école. Repli sur le
      // template de l'école si le niveau n'est pas reconnu (inchangé pour tout établissement
      // mono-cycle, où toutes les classes ont de toute façon le même cycle).
      const ecole = await prisma.school.findUnique({ where: { id: schoolId }, select: { templateCode: true } });
      const ecoleEstPrimaire = getTemplateMeta(ecole?.templateCode).isPrimaire;
      const cycleDeClasse = (level: string | null | undefined): 'primaire' | 'secondaire' =>
        isNiveauPrimaireOuMaternelle(level) ? 'primaire' : (ecoleEstPrimaire ? 'primaire' : 'secondaire');

      // Nombre d'élèves PEBS par classe (une seule requête groupée via Enrollment)
      const classIds = classes.map(c => c.id);
      const pebsCounts = classIds.length > 0
        ? await prisma.enrollment.groupBy({
            by: ['classId'],
            where: {
              classId: { in: classIds },
              status: 'ACTIVE',
              academicYear: { isCurrent: true },
              student: { pebsFiliere: { not: null } },
            },
            _count: { _all: true },
          })
        : [];
      const pebsCountByClass = new Map(pebsCounts.map(p => [p.classId, p._count._all]));

      // Enrichir chaque classe avec pebsBadge (3 états : PEBS / MIXTE / GENERAL)
      const data = classes.map(cls => {
        const total = cls._count.enrollments;
        const pebsN = pebsCountByClass.get(cls.id) ?? 0;
        const pebsMixte = cls.pebsMixte === true;
        let pebsBadge: 'PEBS' | 'MIXTE' | 'GENERAL' | null = null;
        if (cls.filiere === 'FR_PEBS' || cls.filiere === 'EN_PEBS') {
          pebsBadge = 'PEBS';
        } else if (cls.filiere === 'FR_GENERAL' || cls.filiere === 'EN_GENERAL') {
          pebsBadge = total === 0
            ? (pebsMixte ? 'MIXTE' : 'GENERAL')
            : (pebsN === 0 ? 'GENERAL' : pebsN === total ? 'PEBS' : 'MIXTE');
        }
        return {
          ...cls,
          _count: { students: cls._count.enrollments }, // préserve la clé attendue par le frontend
          pebsBadge,
          cycle: cycleDeClasse(cls.level),
        };
      });

      res.json({ success: true, data });
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

        // 1er cycle FR : stocké avec serieCode='FR_GENERAL' (ou filière si définie)
        const isCycle1 = cls.level != null && (['6e','5e','4e','3e'] as string[]).includes(cls.level);
        const cycle1Filiere = cls.filiere ?? 'FR_GENERAL';

        const [coefficients, overrides] = await Promise.all([
          prisma.subjectCoefficient.findMany({
            where: {
              schoolId,
              classLevel: cls.level ?? undefined,
              OR: isCycle1
                ? [{ serieCode: cycle1Filiere }, { serieCode: null }]
                : resolvedSerie
                  ? [{ serieCode: resolvedSerie }, { serieCode: null }]
                  : [{ serieCode: null }],
            },
            include: { subject: { select: { id: true, name: true, code: true } } },
            orderBy: { subject: { name: 'asc' } },
          }),
          prisma.classSubjectOverride.findMany({
            where: { classId, schoolId },
            include: { subject: { select: { id: true, name: true, code: true } } },
            orderBy: { subject: { name: 'asc' } },
          }),
        ]);

        // Les overrides prennent priorité : on exclut les matières déjà couvertes par un override
        const overrideSubjectIds = new Set(overrides.map(o => o.subjectId));
        const sharedCoeffs = coefficients.filter(c => !overrideSubjectIds.has(c.subjectId));

        const data = [
          ...sharedCoeffs.map(c => ({
            id:          c.id,
            subjectId:   c.subjectId,
            name:        c.subject.name,
            code:        c.subject.code,
            coefficient: c.coefficient,
            classLevel:  c.classLevel,
            serieCode:   c.serieCode,
            classOnly:   false,
          })),
          ...overrides.map(o => ({
            id:          o.id,
            subjectId:   o.subjectId,
            name:        o.subject.name,
            code:        o.subject.code,
            coefficient: o.coefficient,
            classLevel:  cls.level ?? null,
            serieCode:   null,
            classOnly:   true,
          })),
        ].sort((a, b) => a.name.localeCompare(b.name));

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

  // GET /api/v2/rooms — catalogue des salles de l'établissement (aucun filtrage par rôle : une
  // salle est une donnée de référence, pas une donnée sensible par utilisateur).
  app.get('/api/v2/rooms', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const rooms = await prisma.room.findMany({
        where: { schoolId },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: rooms });
    } catch (err) { next(err); }
  });

  // GET /api/v2/student-groups — catalogue des GroupSet + leurs Group (référence, aucun
  // filtrage par rôle, même principe que /rooms et /subjects).
  app.get('/api/v2/student-groups', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const groupSets = await prisma.studentGroupSet.findMany({
        where: { schoolId },
        include: { groups: { orderBy: { name: 'asc' } } },
        orderBy: { name: 'asc' },
      });
      res.json({ success: true, data: groupSets });
    } catch (err) { next(err); }
  });

  // GET /api/v2/class-room-assignments?academicYearId= — salles habituelles par classe
  app.get('/api/v2/class-room-assignments', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const academicYearId = req.query['academicYearId'] as string | undefined;
      if (!academicYearId) {
        res.status(400).json({ success: false, message: 'academicYearId requis' });
        return;
      }
      const assignments = await prisma.classRoomAssignment.findMany({
        where: { schoolId, academicYearId },
        include: { class: { select: { id: true, name: true } }, room: { select: { id: true, name: true, capacity: true } } },
      });
      res.json({ success: true, data: assignments });
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
              room: { select: { id: true, name: true } },
            },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      // roomId (relation) → conserve le champ `room: string | null` attendu par le frontend
      // (dashboards élève/enseignant) — room était un texte libre avant migration V2.3, aucun
      // changement de contrat côté client.
      const data = timetables.map(tt => ({
        ...tt,
        slots: tt.slots.map(s => ({ ...s, room: s.room?.name ?? null })),
      }));
      res.json({ success: true, data });
    } catch (err) { next(err); }
  });

  // GET /api/v2/finance/fee-plans?academicYearId= — liste des plans de frais (ADMIN ou STAFF avec MANAGE_FINANCE)
  app.get('/api/v2/finance/fee-plans', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { academicYearId } = req.query as Record<string, string>;
      const plans = await prisma.feePlan.findMany({
        where: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
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
  // Extraits de bootstrap.ts vers DisciplineController (déviation architecturale corrigée)
  const disciplineController = new DisciplineController(prisma);
  app.use('/api/v2/discipline', creerDisciplineRoutes(disciplineController));

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
      journaliserActionIA(prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'livres_disponibles', targetType: 'Book', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { search, category },
      });
      res.json({ success: true, data: books, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'livres_disponibles', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
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
      journaliserActionIA(prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'emprunter_livre', targetType: 'BookLoan', targetId: loan.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { bookId, studentId, dueDate },
      });
      res.status(201).json({ success: true, data: loan });
    } catch (err) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'emprunter_livre', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
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
      journaliserActionIA(prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'retourner_livre', targetType: 'BookLoan', targetId: loan.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { loanId: loan.id },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'retourner_livre', targetType: 'BookLoan', targetId: req.params.id as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined,
      });
      next(err);
    }
  });

  // PATCH /api/v2/library/loans/:id/renew — prolonger la date limite d'un emprunt actif
  app.patch('/api/v2/library/loans/:id/renew', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { dueDate } = req.body as Record<string, string>;
      if (!dueDate) { res.status(400).json({ success: false, message: 'dueDate requis' }); return; }
      const newDueDate = new Date(dueDate);
      if (Number.isNaN(newDueDate.getTime()) || newDueDate <= new Date()) {
        res.status(400).json({ success: false, message: 'dueDate doit être une date future valide' }); return;
      }
      const loan = await prisma.bookLoan.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!loan) { res.status(404).json({ success: false, message: 'Emprunt introuvable' }); return; }
      if (loan.status === 'RETURNED') { res.status(409).json({ success: false, message: 'Livre déjà retourné — impossible de renouveler' }); return; }
      const updated = await prisma.bookLoan.update({
        where: { id: loan.id },
        // Renouveler un emprunt en retard le remet ACTIVE — sinon le job markOverdueLoans le
        // re-marquerait OVERDUE dès le lendemain malgré la nouvelle date limite future.
        data: { dueDate: newDueDate, status: 'ACTIVE' },
        include: { book: { select: { id: true, title: true } } },
      });
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
        method: method as PaymentMethod,
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

  // ── Module LV2 — gestion langue vivante 2 par élève ──────────────────────

  // PATCH /api/v2/students/:id/lv2 — affecter une LV2 à un élève
  app.patch('/api/v2/students/:id/lv2', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const { lv2SubjectId } = req.body as { lv2SubjectId?: string | null };

      const profile = await prisma.studentProfile.findFirst({
        where: { userId: studentUserId, user: { schoolId } },
        select: { id: true },
      });
      if (!profile) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }

      if (lv2SubjectId) {
        const subj = await prisma.subject.findFirst({ where: { id: lv2SubjectId, schoolId }, select: { id: true } });
        if (!subj) { res.status(404).json({ success: false, message: 'Matière introuvable' }); return; }
      }

      await prisma.studentProfile.update({
        where: { id: profile.id },
        data: { lv2SubjectId: lv2SubjectId ?? null },
      });
      journaliserActionIA(prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_lv2_eleve', targetType: 'User', targetId: studentUserId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { studentUserId, lv2SubjectId },
      });
      res.json({ success: true, message: 'LV2 affectée' });
    } catch (err) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'affecter_lv2_eleve', targetType: 'User', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  });

  // POST /api/v2/students/lv2/bulk — affecter la même LV2 à une liste d'élèves
  app.post('/api/v2/students/lv2/bulk', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentUserIds, lv2SubjectId } = req.body as { studentUserIds?: string[]; lv2SubjectId?: string | null };

      if (!Array.isArray(studentUserIds) || studentUserIds.length === 0) {
        res.status(400).json({ success: false, message: 'studentUserIds[] requis' }); return;
      }
      if (lv2SubjectId) {
        const subj = await prisma.subject.findFirst({ where: { id: lv2SubjectId, schoolId }, select: { id: true } });
        if (!subj) { res.status(404).json({ success: false, message: 'Matière introuvable' }); return; }
      }

      const profiles = await prisma.studentProfile.findMany({
        where: { userId: { in: studentUserIds }, user: { schoolId } },
        select: { id: true },
      });
      const result = await prisma.studentProfile.updateMany({
        where: { id: { in: profiles.map((p: any) => p.id) } },
        data: { lv2SubjectId: lv2SubjectId ?? null },
      });

      journaliserActionIA(prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_lv2_masse', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { studentUserIds, lv2SubjectId, modifies: result.count },
      });
      res.json({ success: true, data: { modifies: result.count } });
    } catch (err) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'affecter_lv2_masse', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  });

  // GET /api/v2/classes/:id/lv2-overview — répartition LV2 d'une classe
  app.get('/api/v2/classes/:id/lv2-overview', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;

      const classe = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const students = await prisma.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: {
          id: true, firstName: true, lastName: true,
          studentProfile: { select: { lv2SubjectId: true, lv2Subject: { select: { id: true, name: true } } } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      const groupes: Record<string, { subjectId: string; langue: string; eleves: { id: string; firstName: string; lastName: string }[] }> = {};
      const sansLV2: { id: string; firstName: string; lastName: string }[] = [];

      for (const s of students) {
        const lv2 = s.studentProfile?.lv2SubjectId;
        const lv2Name = s.studentProfile?.lv2Subject?.name ?? null;
        if (!lv2 || !lv2Name) {
          sansLV2.push({ id: s.id, firstName: s.firstName, lastName: s.lastName });
        } else {
          if (!groupes[lv2]) groupes[lv2] = { subjectId: lv2, langue: lv2Name, eleves: [] };
          groupes[lv2].eleves.push({ id: s.id, firstName: s.firstName, lastName: s.lastName });
        }
      }

      journaliserActionIA(prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'compter_eleves_par_lv2', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId },
      });
      res.json({
        success: true,
        data: {
          className: classe.name,
          groupes: Object.values(groupes).map(g => ({ ...g, nombreEleves: g.eleves.length })),
          sansLV2,
          total: students.length,
        },
      });
    } catch (err) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'compter_eleves_par_lv2', targetType: 'Class', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: { classId: req.params['id'] },
      });
      next(err);
    }
  });

  // ── Module PEBS — gestion Programme d'Éducation Bilingue Spécial par élève ──

  // PATCH /api/v2/students/:id/pebs — affecter PEBS à un élève
  app.patch('/api/v2/students/:id/pebs', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const { pebsFiliere } = req.body as { pebsFiliere?: string | null };

      const profile = await prisma.studentProfile.findFirst({
        where: { userId: studentUserId, user: { schoolId } },
        select: { id: true },
      });
      if (!profile) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }

      if (pebsFiliere !== null && pebsFiliere !== undefined && !['FR_PEBS', 'EN_PEBS'].includes(pebsFiliere)) {
        res.status(400).json({ success: false, message: 'Valeur pebsFiliere invalide' }); return;
      }

      await prisma.studentProfile.update({
        where: { id: profile.id },
        data: { pebsFiliere: pebsFiliere ?? null },
      });
      journaliserActionIA(prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_pebs_eleve', targetType: 'User', targetId: studentUserId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { studentUserId, pebsFiliere },
      });
      res.json({ success: true, message: 'PEBS affecté' });
    } catch (err) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'affecter_pebs_eleve', targetType: 'User', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  });

  // POST /api/v2/students/pebs/bulk — affecter PEBS en masse
  app.post('/api/v2/students/pebs/bulk', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const { studentUserIds, pebsFiliere } = req.body as { studentUserIds?: string[]; pebsFiliere?: string | null };

      if (!Array.isArray(studentUserIds) || studentUserIds.length === 0) {
        res.status(400).json({ success: false, message: 'studentUserIds[] requis' }); return;
      }

      if (pebsFiliere !== null && pebsFiliere !== undefined && !['FR_PEBS', 'EN_PEBS'].includes(pebsFiliere)) {
        res.status(400).json({ success: false, message: 'Valeur pebsFiliere invalide' }); return;
      }

      const profiles = await prisma.studentProfile.findMany({
        where: { userId: { in: studentUserIds }, user: { schoolId } },
        select: { id: true },
      });
      const result = await prisma.studentProfile.updateMany({
        where: { id: { in: profiles.map((p: any) => p.id) } },
        data: { pebsFiliere: pebsFiliere ?? null },
      });

      journaliserActionIA(prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_pebs_masse', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { studentUserIds, pebsFiliere, modifies: result.count },
      });
      res.json({ success: true, data: { modifies: result.count } });
    } catch (err) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'affecter_pebs_masse', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: req.body,
      });
      next(err);
    }
  });

  // GET /api/v2/classes/:id/pebs-overview — répartition PEBS d'une classe
  app.get('/api/v2/classes/:id/pebs-overview', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;

      const classe = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const students = await prisma.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: {
          id: true, firstName: true, lastName: true,
          studentProfile: { select: { pebsFiliere: true } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      const eleves = students.map((s: any) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        pebsFiliere: s.studentProfile?.pebsFiliere ?? null,
      }));

      const pebsCount = eleves.filter((e: any) => e.pebsFiliere !== null).length;
      const nonPEBSCount = eleves.filter((e: any) => e.pebsFiliere === null).length;

      journaliserActionIA(prisma, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'repartition_pebs_classe', targetType: 'Class', targetId: classId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { classId },
      });
      res.json({
        success: true,
        data: {
          className: classe.name,
          pebsCount,
          nonPEBSCount,
          total: students.length,
          eleves,
        },
      });
    } catch (err) {
      journaliserActionIA(prisma, {
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'repartition_pebs_classe', targetType: 'Class', targetId: req.params['id'] as string,
        origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: err instanceof Error ? err.message : undefined, parametersSummary: { classId: req.params['id'] },
      });
      next(err);
    }
  });

  // GET /api/v2/timetable-slots/:id/students — participants d'un créneau, résolus
  // automatiquement (électif A-Level > StudentGroup > LV2 legacy > toute la classe).
  const resoudreParticipantsSeanceUseCase = container.timetable.resoudreParticipantsSeance;
  app.get('/api/v2/timetable-slots/:id/students', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const slotId = req.params['id'] as string;
      const resultat = await resoudreParticipantsSeanceUseCase.execute(slotId, schoolId);
      res.json({ success: true, data: resultat });
    } catch (err) {
      if (err instanceof Error && err.message === 'Créneau introuvable') {
        res.status(404).json({ success: false, message: err.message }); return;
      }
      if (err instanceof Error && err.message === 'Accès refusé') {
        res.status(403).json({ success: false, message: err.message }); return;
      }
      next(err);
    }
  });

  // ── Module A-Level — choix individuel des matières par élève (max 5) ──────
  const affecterALevelUseCase   = new AffecterMatieresALevelEleveUseCase(studentAffectationRepository);
  const preremplirALevelUseCase = new PreremplirDepuisCombinaisonUseCase(studentAffectationRepository);
  const getElevesALevelUseCase  = new GetElevesParMatiereALevelUseCase(studentAffectationRepository);

  // PUT /api/v2/students/:id/alevel-subjects — remplacer la sélection A-Level (3 à 5 matières)
  app.put('/api/v2/students/:id/alevel-subjects', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const { subjectIds } = req.body as { subjectIds?: string[] };
      const result = await affecterALevelUseCase.execute({
        studentUserId: req.params['id'] as string,
        schoolId: req.user!.schoolId,
        subjectIds: Array.isArray(subjectIds) ? subjectIds : [],
      });
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (/au moins|plus de|introuvable|non A-Level/.test(msg)) { res.status(400).json({ success: false, message: msg }); return; }
      next(err);
    }
  });

  // POST /api/v2/students/:id/alevel-subjects/from-combination — préremplir depuis une combinaison
  app.post('/api/v2/students/:id/alevel-subjects/from-combination', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const { combinationCode } = req.body as { combinationCode?: string };
      if (!combinationCode) { res.status(400).json({ success: false, message: 'combinationCode requis' }); return; }
      const result = await preremplirALevelUseCase.execute({
        studentUserId: req.params['id'] as string,
        schoolId: req.user!.schoolId,
        combinationCode,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (/introuvable/.test(msg)) { res.status(404).json({ success: false, message: msg }); return; }
      next(err);
    }
  });

  // GET /api/v2/students/:id/alevel-subjects — matières A-Level actuelles de l'élève
  app.get('/api/v2/students/:id/alevel-subjects', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const profile = await prisma.studentProfile.findFirst({
        where: { userId: studentUserId, user: { schoolId } },
        select: { id: true },
      });
      if (!profile) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }

      const links = await prisma.studentALevelSubject.findMany({
        where: { studentId: profile.id },
        select: { subject: { select: { id: true, name: true } } },
        orderBy: { subject: { name: 'asc' } },
      });
      const subjects = links.map((l: any) => ({ id: l.subject.id, name: l.subject.name }));
      res.json({ success: true, data: { subjects, count: subjects.length } });
    } catch (err) { next(err); }
  });

  // GET /api/v2/classes/:id/alevel-overview — vue d'ensemble des sélections A-Level d'une classe
  app.get('/api/v2/classes/:id/alevel-overview', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;

      const classe = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      // Matières A-Level disponibles de l'établissement (matières de l'école dont le nom est un sujet A-Level officiel)
      const officialALevel = await prisma.aLevelSubject.findMany({ select: { subjectName: true } });
      const officialNames: string[] = officialALevel.map((a: any) => a.subjectName);
      const availableSubjects = await prisma.subject.findMany({
        where: { schoolId, name: { in: officialNames } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      const students = await prisma.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: {
          id: true, firstName: true, lastName: true,
          studentProfile: { select: { alevelSubjects: { select: { subject: { select: { id: true, name: true } } } } } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      res.json({
        success: true,
        data: {
          className: classe.name,
          availableSubjects,
          students: students.map((s: any) => {
            const subjects = (s.studentProfile?.alevelSubjects ?? []).map((a: any) => a.subject);
            return { id: s.id, firstName: s.firstName, lastName: s.lastName, subjects, count: subjects.length };
          }),
        },
      });
    } catch (err) { next(err); }
  });

  // GET /api/v2/subjects/:id/alevel-students?classId= — élèves ayant cette matière A-Level
  app.get('/api/v2/subjects/:id/alevel-students', requireAuth, async (req, res, next) => {
    try {
      const classId = typeof req.query['classId'] === 'string' ? (req.query['classId'] as string) : undefined;
      const result = await getElevesALevelUseCase.execute(req.params['id'] as string, req.user!.schoolId, classId);
      res.json({ success: true, data: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (/introuvable/.test(msg)) { res.status(404).json({ success: false, message: msg }); return; }
      next(err);
    }
  });

  // POST /api/v2/classes/:id/alevel-subjects/bulk-from-combination — préréglage pour toute la classe
  app.post('/api/v2/classes/:id/alevel-subjects/bulk-from-combination', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.params['id'] as string;
      const { combinationCode } = req.body as { combinationCode?: string };
      if (!combinationCode) { res.status(400).json({ success: false, message: 'combinationCode requis' }); return; }

      const classe = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const students = await prisma.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: { id: true },
      });

      let modifies = 0;
      for (const s of students) {
        try {
          await preremplirALevelUseCase.execute({ studentUserId: s.id, schoolId, combinationCode });
          modifies++;
        } catch { /* élève ignoré si erreur individuelle */ }
      }
      res.json({ success: true, data: { modifies, total: students.length } });
    } catch (err) { next(err); }
  });

  // GET /api/v2/teacher/roster?classId=&subjectId= — liste d'élèves d'un cours, filtrée
  // si la matière est élective (LV2 ou A-Level). Source unique pour la saisie présences/notes.
  app.get('/api/v2/teacher/roster', requireAuth, async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const classId = req.query['classId'] as string | undefined;
      const subjectId = req.query['subjectId'] as string | undefined;
      if (!classId) { res.status(400).json({ success: false, message: 'classId requis' }); return; }

      const classe = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const allStudents: any[] = await prisma.user.findMany({
        where: { schoolId, role: 'STUDENT', isActive: true, ...whereElevesParClasse(classId) },
        select: {
          id: true, firstName: true, lastName: true,
          studentProfile: { select: { lv2SubjectId: true, alevelSubjects: { select: { subjectId: true } } } },
        },
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      });

      const total = allStudents.length;
      let mode: 'FULL' | 'LV2' | 'ALEVEL' = 'FULL';
      let filtered: any[] = allStudents;
      let lv2Fallback = false; // matière LV2 uniforme sans affectation individuelle → toute la classe

      if (subjectId) {
        const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true, name: true, isLV2: true } });
        if (subject) {
          if (subject.isLV2) {
            mode = 'LV2';
            const assigned = allStudents.filter(s => s.studentProfile?.lv2SubjectId === subjectId);
            const anyLv2InClass = allStudents.some(s => s.studentProfile?.lv2SubjectId);
            // Repli (Situation 1) : la classe n'a AUCUNE affectation LV2 individuelle → toute la
            // classe est présumée faire cette langue (ex. « toute la 4eA fait Allemand »).
            // Dès qu'une répartition individuelle existe, on la respecte strictement.
            if (assigned.length === 0 && !anyLv2InClass) {
              filtered = allStudents;
              lv2Fallback = true;
            } else {
              filtered = assigned;
            }
          } else {
            const isOfficialALevel = await prisma.aLevelSubject.findUnique({ where: { subjectName: subject.name }, select: { subjectName: true } });
            if (isOfficialALevel) {
              mode = 'ALEVEL';
              filtered = allStudents.filter(s => (s.studentProfile?.alevelSubjects ?? []).some((a: any) => a.subjectId === subjectId));
            }
          }
        }
      }

      const subjectName = subjectId
        ? (await prisma.subject.findFirst({ where: { id: subjectId, schoolId }, select: { name: true } }))?.name ?? ''
        : '';
      const label = mode === 'LV2'
        ? (lv2Fallback
            ? `Cours LV2 — ${subjectName} — ${classe.name} (toute la classe — ${total} élèves, LV2 non répartie)`
            : `Cours LV2 — ${subjectName} — ${classe.name} (${filtered.length} élèves sur ${total})`)
        : mode === 'ALEVEL'
          ? `A-Level — ${subjectName} — ${classe.name} (${filtered.length} élèves sur ${total})`
          : null;

      res.json({
        success: true,
        data: {
          mode,
          filtered: mode !== 'FULL',
          lv2Fallback,
          label,
          total,
          className: classe.name,
          students: filtered.map(s => ({
            id: s.id, firstName: s.firstName, lastName: s.lastName,
            name: `${s.firstName} ${s.lastName}`.trim(),
            className: classe.name,
          })),
        },
      });
    } catch (err) { next(err); }
  });

  // ── Routes dev — DÉSACTIVÉES en production ──────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const devController = new DevController(prisma);
    app.use('/api/v2/dev', creerDevRoutes(devController));
    console.log('🔧 Routes dev montées sur /api/v2/dev (NODE_ENV:', process.env.NODE_ENV, ')');
  }

  app.use(errorHandler);

  console.log('✅ Architecture hexagonale montée sur /api/v2');
}
