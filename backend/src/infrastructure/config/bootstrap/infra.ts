import type { Application } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { ClasseController } from '@infrastructure/http/controllers/ClasseController';
import { SubjectController } from '@infrastructure/http/controllers/SubjectController';
import { RoomController } from '@infrastructure/http/controllers/RoomController';
import { TeacherUnavailabilityController } from '@infrastructure/http/controllers/TeacherUnavailabilityController';
import { StudentGroupController } from '@infrastructure/http/controllers/StudentGroupController';
import { AIActionAuditController } from '@infrastructure/http/controllers/AIActionAuditController';
import { CorbeilleController } from '@infrastructure/http/controllers/CorbeilleController';
import { HRController, traiterDemandeConge } from '@infrastructure/http/controllers/HRController';
import { HRSelfServiceController } from '@infrastructure/http/controllers/HRSelfServiceController';
import { ParentController } from '@infrastructure/http/controllers/ParentController';
import { SchoolSettingsController } from '@infrastructure/http/controllers/SchoolSettingsController';
import { ActivitiesLogController } from '@infrastructure/http/controllers/ActivitiesLogController';
import { DashboardController } from '@infrastructure/http/controllers/DashboardController';
import { EmailLogController } from '@infrastructure/http/controllers/EmailLogController';
import { SearchController } from '@infrastructure/http/controllers/SearchController';
import { AIController } from '@infrastructure/http/controllers/AIController';
import { AcademicEventController } from '@infrastructure/http/controllers/AcademicEventController';
import { CoreDomainController } from '@infrastructure/http/controllers/CoreDomainController';
import { PublicController } from '@infrastructure/http/controllers/PublicController';
import { SMSController } from '@infrastructure/http/controllers/SMSController';
import { OrientationController } from '@infrastructure/http/controllers/OrientationController';
import { MatriculeController } from '@infrastructure/http/controllers/MatriculeController';
import { EleveOnboardingController } from '@infrastructure/http/controllers/EleveOnboardingController';
import { StatisticalCampaignController } from '@infrastructure/http/controllers/StatisticalCampaignController';
import { StatisticalCampaignMinedubController } from '@infrastructure/http/controllers/StatisticalCampaignMinedubController';
import { PaiementMinesecController } from '@infrastructure/http/controllers/PaiementMinesecController';
import { ExamenController } from '@infrastructure/http/controllers/ExamenController';
import { Lv2ChoiceController } from '@infrastructure/http/controllers/Lv2ChoiceController';
import { EntranceExamController } from '@infrastructure/http/controllers/EntranceExamController';
import { PebsExamController } from '@infrastructure/http/controllers/PebsExamController';
import { PushNotificationController } from '@infrastructure/http/controllers/PushNotificationController';
import { NotificationController } from '@infrastructure/http/controllers/NotificationController';
import { AnnouncementController } from '@infrastructure/http/controllers/AnnouncementController';
import { MessagerieController } from '@infrastructure/http/controllers/MessagerieController';
import { APEEController } from '@infrastructure/http/controllers/APEEController';
import { DisciplineCouncilController } from '@infrastructure/http/controllers/DisciplineCouncilController';
import { DisciplineController } from '@infrastructure/http/controllers/DisciplineController';
import { StudentFollowUpController } from '@infrastructure/http/controllers/StudentFollowUpController';
import { AssistantController } from '@infrastructure/http/controllers/AssistantController';
import { DevController } from '@infrastructure/http/controllers/DevController';
import { OnboardingPEBSController } from '@infrastructure/http/controllers/OnboardingPEBSController';
import { creerClasseRoutes } from '@infrastructure/http/routes/classe.routes';
import { creerSubjectRoutes } from '@infrastructure/http/routes/subject.routes';
import { creerRoomRoutes } from '@infrastructure/http/routes/room.routes';
import { creerTeacherUnavailabilityRoutes } from '@infrastructure/http/routes/teacher-unavailability.routes';
import { creerStudentGroupRoutes } from '@infrastructure/http/routes/studentGroup.routes';
import { creerHrRoutes } from '@infrastructure/http/routes/hr.routes';
import { creerHrSelfServiceRoutes } from '@infrastructure/http/routes/hrSelfService.routes';
import { creerParentRoutes } from '@infrastructure/http/routes/parent.routes';
import { creerSchoolSettingsRoutes } from '@infrastructure/http/routes/schoolSettings.routes';
import { creerSchoolConfigRoutes } from '@infrastructure/http/routes/school-config.routes';
import { creerActivitiesRoutes } from '@infrastructure/http/routes/activities.routes';
import { creerDashboardRoutes } from '@infrastructure/http/routes/dashboard.routes';
import { creerEmailLogRoutes } from '@infrastructure/http/routes/emailLog.routes';
import { creerSearchRoutes } from '@infrastructure/http/routes/search.routes';
import { creerAIRoutes } from '@infrastructure/http/routes/ai.routes';
import { creerStudentFollowUpRoutes } from '@infrastructure/http/routes/studentFollowUp.routes';
import { creerAcademicEventRoutes } from '@infrastructure/http/routes/academicEvent.routes';
import { creerCoreDomainRoutes } from '@infrastructure/http/routes/coreDomain.routes';
import { creerPublicRoutes } from '@infrastructure/http/routes/public.routes';
import { creerSMSRoutes } from '@infrastructure/http/routes/sms.routes';
import { creerOrientationRoutes } from '@infrastructure/http/routes/orientation.routes';
import { creerMatriculeRoutes } from '@infrastructure/http/routes/matricule.routes';
import { creerEleveOnboardingRoutes } from '@infrastructure/http/routes/eleveOnboarding.routes';
import { creerStatisticalCampaignRoutes } from '@infrastructure/http/routes/statisticalCampaign.routes';
import { creerStatisticalCampaignMinedubRoutes } from '@infrastructure/http/routes/statisticalCampaignMinedub.routes';
import { creerPaiementMinesecRoutes } from '@infrastructure/http/routes/paiementMinesec.routes';
import { creerExamenRoutes } from '@infrastructure/http/routes/examen.routes';
import { creerLv2ChoiceRoutes, creerLv2ChoiceStudentRoutes } from '@infrastructure/http/routes/lv2Choice.routes';
import { creerEntranceExamRoutes } from '@infrastructure/http/routes/entranceExam.routes';
import { creerPebsExamRoutes } from '@infrastructure/http/routes/pebsExam.routes';
import { creerPushNotificationRoutes } from '@infrastructure/http/routes/pushNotification.routes';
import { creerNotificationRoutes } from '@infrastructure/http/routes/notification.routes';
import { creerAnnouncementRoutes } from '@infrastructure/http/routes/announcement.routes';
import { creerMessagerieRoutes } from '@infrastructure/http/routes/messagerie.routes';
import { creerApeeRoutes } from '@infrastructure/http/routes/apee.routes';
import { creerDisciplineCouncilRoutes } from '@infrastructure/http/routes/disciplineCouncil.routes';
import { creerDisciplineRoutes } from '@infrastructure/http/routes/discipline.routes';
import { creerDevRoutes } from '@infrastructure/http/routes/dev.routes';
import { requireAuth, requireRole } from '../../http/middlewares/auth';
import { protectMaster, authorizeMaster } from '../../http/middlewares/authMultiTenant';
import { requireMasterSensitiveAuth } from '../../http/middlewares/masterSensitiveAuth';
import { errorHandler } from '@infrastructure/http/middlewares/errorHandler';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { PrismaStudentFollowUpRepository } from '@infrastructure/persistence/prisma/PrismaStudentFollowUpRepository';
import { PrismaSuiviRBACRepository } from '@infrastructure/persistence/prisma/PrismaSuiviRBACRepository';
import { PrismaAcademicEventRepository } from '@infrastructure/persistence/prisma/PrismaAcademicEventRepository';
import { PrismaAnnouncementRepository } from '@infrastructure/persistence/prisma/PrismaAnnouncementRepository';
import { PrismaMessagerieRepository } from '@infrastructure/persistence/prisma/PrismaMessagerieRepository';
import { PrismaStudentGroupSetRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupSetRepository';
import { PrismaStudentGroupRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupRepository';
import { PrismaStudentGroupMembershipRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupMembershipRepository';
import { PrismaStudentAffectationRepository } from '@infrastructure/persistence/prisma/PrismaStudentAffectationRepository';
import { PrismaLv2ChoiceRepository } from '@infrastructure/persistence/prisma/PrismaLv2ChoiceRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';
import { PrismaClassCouncilRepository } from '@infrastructure/persistence/prisma/PrismaClassCouncilRepository';
import { PrismaSubjectAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaSubjectAssignmentRepository';
import { PrismaSchoolActivationRepository } from '@infrastructure/persistence/prisma/PrismaSchoolActivationRepository';
import { CreerEvenementAcademiqueUseCase, DeclencherEvenementUseCase, AjusterFenetreEvenementUseCase, ListerEvenementsUseCase, ObtenirEvenementsActifsUseCase } from '@application/academicEvent';
import { CreerActionSuiviEleveUseCase } from '@application/suivi/CreerActionSuiviEleveUseCase';
import { ClorreActionSuiviUseCase } from '@application/suivi/ClorreActionSuiviUseCase';
import { ListerActionsEnCoursUseCase } from '@application/suivi/ListerActionsEnCoursUseCase';
import { AssignerActionSuiviUseCase } from '@application/suivi/AssignerActionSuiviUseCase';
import { ListerHistoriqueSuiviEleveUseCase } from '@application/suivi/ListerHistoriqueSuiviEleveUseCase';
import { CreerAnnonceUseCase } from '@application/announcement/CreerAnnonceUseCase';
import { ListerAnnoncesUseCase } from '@application/announcement/ListerAnnoncesUseCase';
import { ModifierAnnonceUseCase } from '@application/announcement/ModifierAnnonceUseCase';
import { SupprimerAnnonceUseCase } from '@application/announcement/SupprimerAnnonceUseCase';
import { EnvoyerMessageUseCase } from '@application/messagerie/EnvoyerMessageUseCase';
import { ListerConversationsUseCase } from '@application/messagerie/ListerConversationsUseCase';
import { ListerMessagesUseCase } from '@application/messagerie/ListerMessagesUseCase';
import { MarquerMessagesLusUseCase } from '@application/messagerie/MarquerMessagesLusUseCase';
import { ModererMessageUseCase } from '@application/messagerie/ModererMessageUseCase';
import { ListerMessagesEnAttenteModerationUseCase } from '@application/messagerie/ListerMessagesEnAttenteModerationUseCase';
import { ListerContactsMessagerieUseCase } from '@application/messagerie/ListerContactsMessagerieUseCase';
import { CompterMessagesNonLusUseCase } from '@application/messagerie/CompterMessagesNonLusUseCase';
import { ActiverEtablissementUseCase } from '@application/school/ActiverEtablissementUseCase';
import { ConfigurerEtablissementUseCase } from '@application/school/ConfigurerEtablissementUseCase';
import { ObtenirAnomaliesEtablissementUseCase } from '@application/school/ObtenirAnomaliesEtablissementUseCase';
import { AffecterMatieresALevelEleveUseCase } from '@application/student/AffecterMatieresALevelEleveUseCase';
import { PreremplirDepuisCombinaisonUseCase } from '@application/student/PreremplirDepuisCombinaisonUseCase';
import { GetElevesParMatiereALevelUseCase } from '@application/student/GetElevesParMatiereALevelUseCase';
import { AffecterLV2EleveUseCase } from '@application/student/AffecterLV2EleveUseCase';
import { AffecterLV2EnMasseUseCase } from '@application/student/AffecterLV2EnMasseUseCase';
import { AffecterPEBSEleveUseCase } from '@application/student/AffecterPEBSEleveUseCase';
import { AffecterPEBSEnMasseUseCase } from '@application/student/AffecterPEBSEnMasseUseCase';
import { CreerTransactionAPEEUseCase } from '@application/apee/CreerTransactionAPEEUseCase';
import { ValiderDepenseAPEEUseCase } from '@application/apee/ValiderDepenseAPEEUseCase';
import { PrismaApeeRepository } from '@infrastructure/persistence/prisma/PrismaApeeRepository';
import { buildAdminActionCatalog } from '@infrastructure/assistant/catalog/adminActionCatalog';
import { buildTeacherActionCatalog } from '@infrastructure/assistant/catalog/teacherActionCatalog';
import { buildStaffActionCatalog } from '@infrastructure/assistant/catalog/staffActionCatalog';
import { buildParentActionCatalog } from '@infrastructure/assistant/catalog/parentActionCatalog';
import { buildStudentActionCatalog } from '@infrastructure/assistant/catalog/studentActionCatalog';
import { notifierEvenementAcademique } from '@infrastructure/services/notification/AcademicEventNotificationService';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';
import { RealtimeSocketAdapter } from '@infrastructure/socket/RealtimeSocketAdapter';
import { SmsNotificationAdapter } from '@infrastructure/services/sms/SmsNotificationAdapter';
import { getTemplateMeta } from '@application/school/schoolTemplateConfig';
import { isNiveauPrimaireOuMaternelle } from '../../../lib/classSerieValidator';
import { getStaffTitlesForTemplate } from '@domain/rules/StaffPermissionRules';
import { assignerMatieresPourClasse, CYCLE2_LEVELS as SYNC_CYCLE2_LEVELS, parseSerie as syncParseSerie } from '@application/school/SubjectAssignmentHelper';
import { buildPayload, getLatestSchoolBackup } from '../../backup/SchoolBackupService';
import type { PaymentMethod } from '@domain/types/enums';
import { journaliserActionIA } from '@infrastructure/services/ai/AIActionAuditLogger';
import { executerBroadcast } from '@infrastructure/http/controllers/CommunicationsController';
import { calculerAlertesRetardProgramme } from '@infrastructure/http/controllers/PedagogieController';
import { notifyDisciplineSms, DISCIPLINE_TYPE_LABELS } from '../../services/sms/SmsNotificationService';
import { notifierParentsPushDabord } from '../../services/notification/PushFirstNotifier';
import { sendTransactionalEmail } from '../../services/email/EmailService';
import { whereElevesParClasse } from '@application/shared/studentEnrollment';
import { SchoolOnboardingController as SchoolOnboardingControllerForMaster } from '@infrastructure/http/controllers/SchoolOnboardingController';


type Container = ReturnType<typeof creerContainer>;

export function registerInfra(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerInfraRoutes(app, _prisma, container);
}

export function registerInfraRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  const classeController = new ClasseController(
    c.class.creer,
    c.class.modifier,
    c.class.supprimer,
    c.class.assignerProfesseur,
    c.class.creerSousGroupe,
    c.class.assignerEleves,
    c.studentGroup.assignerSalleClasse,
    c.studentGroup.retirerAssignationSalle,
    prisma,
  );

  const subjectController = new SubjectController(
    c.subject.creer,
    c.subject.modifier,
    c.subject.assignerEnseignant,
    c.subject.definirCoefficient,
    c.subject.supprimer,
  );

  const roomController = new RoomController(
    c.room.creer,
    c.room.modifier,
    c.room.supprimer,
    prisma,
  );

  const teacherUnavailabilityController = new TeacherUnavailabilityController(
    c.teacherUnavailability.creer,
    c.teacherUnavailability.modifier,
    c.teacherUnavailability.supprimer,
    c.teacherUnavailability.lister,
    prisma,
  );

  const studentGroupController = new StudentGroupController(
    c.studentGroup.creerGroupSet,
    c.studentGroup.modifierGroupSet,
    c.studentGroup.supprimerGroupSet,
    c.studentGroup.creerGroup,
    c.studentGroup.modifierGroup,
    c.studentGroup.supprimerGroup,
  );

  app.use('/api/v2/classes', creerClasseRoutes(classeController));
  app.use('/api/v2/subjects', creerSubjectRoutes(subjectController));
  app.use('/api/v2/rooms', creerRoomRoutes(roomController));
  app.use('/api/v2/teacher-unavailabilities', creerTeacherUnavailabilityRoutes(teacherUnavailabilityController));
  app.use('/api/v2/student-groups', creerStudentGroupRoutes(studentGroupController));


  // ── Interopérabilité statistique MINESEC ────────────────────────────────
  const statisticalCampaignController = new StatisticalCampaignController(
    c.statisticalCampaign.verifierCompletude,
    c.statisticalCampaign.genererDeclaration,
    prisma,
  );
  app.use('/api/v2/statistical-campaign', creerStatisticalCampaignRoutes(statisticalCampaignController));

  // ── Interopérabilité statistique MINEDUB (rapport PDF non officiel) ────
  const statisticalCampaignMinedubController = new StatisticalCampaignMinedubController(
    c.statisticalCampaignMinedub.genererRapport,
    prisma,
  );
  app.use('/api/v2/statistical-campaign-minedub', creerStatisticalCampaignMinedubRoutes(statisticalCampaignMinedubController));

  // ── Paiements MINESEC ───────────────────────────────────────────────────
  const paiementMinesecController = new PaiementMinesecController(
    c.paiementMinesec.genererPaiements,
    c.paiementMinesec.genererPaiementsEcole,
    c.paiementMinesec.getDashboard,
    c.paiementMinesec.getOverview,
    prisma,
  );
  app.use('/api/v2/paiements-minesec', creerPaiementMinesecRoutes(paiementMinesecController));

  // ── Inscriptions Examens ────────────────────────────────────────────────
  const examenController = new ExamenController(
    c.examen.prepareDossier,
    prisma,
  );
  app.use('/api/v2/examens', creerExamenRoutes(examenController));

  // ── LV2 Choice (Sous-module C) ─────────────────────────────────────────
  const lv2ChoiceController = new Lv2ChoiceController(
    prisma,
    c.lv2Choice.ouvrirFenetre,
    c.lv2Choice.soumettreChoix,
    c.lv2Choice.saisirManuel,
    c.lv2Choice.appliquerChoix,
    c.lv2Choice.suivreFenetre,
  );
  app.use('/api/v2/lv2-choice-windows', creerLv2ChoiceRoutes(lv2ChoiceController));
  app.use('/api/v2/students/me', creerLv2ChoiceStudentRoutes(lv2ChoiceController));

  // ── Entrance Exams (Sous-module A) ─────────────────────────────────────
  const entranceExamController = new EntranceExamController(
    c.entranceExam.creerSession,
    c.entranceExam.ajouterCandidats,
    c.entranceExam.calculerAdmission,
    c.entranceExam.enregistrerCep,
    c.entranceExam.resumeSession,
    c.entranceExam.scannerListe,
    c.entranceExam.detecterAnomalies,
    prisma,
  );
  app.use('/api/v2/entrance-exams', creerEntranceExamRoutes(entranceExamController));

  // ── PEBS Exams (Sous-module B) ─────────────────────────────────────────
  const pebsExamController = new PebsExamController(
    c.pebsExam.creerSession,
    c.pebsExam.ajouterCandidats,
    c.pebsExam.calculerSelection,
    c.pebsExam.appliquerTransfert,
    c.pebsExam.resumeSession,
    c.pebsExam.scannerListe,
    c.pebsExam.detecterAnomalies,
    prisma,
  );
  app.use('/api/v2/pebs-exams', creerPebsExamRoutes(pebsExamController));

  // ── Push Notifications (Web Push) ────────────────────────────────────────────
  const pushNotificationController = new PushNotificationController(
    c.pushNotification.souscrire,
    c.pushNotification.desinscrire,
  );
  app.use('/api/v2/push', creerPushNotificationRoutes(pushNotificationController));

  // ── Notifications IN_APP (cloche) ────────────────────────────────────────────
  const notificationController = new NotificationController(c.notification.service);
  app.use('/api/v2/notifications', creerNotificationRoutes(notificationController));

  // ── Babillard numérique ─────────────────────────────────────────────────────
  const announcementRepository = new PrismaAnnouncementRepository(p);
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
  const messagerieRepository = new PrismaMessagerieRepository(p);
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
  const apeeController = new APEEController(p);
  app.use('/api/v2/apee', creerApeeRoutes(apeeController));

  // ── Conseil de Discipline (Art. 30) ──────────────────────────────────────────
  const disciplineCouncilController = new DisciplineCouncilController(p);
  app.use('/api/v2/discipline-council', creerDisciplineCouncilRoutes(disciplineCouncilController));

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
        p.user.count({ where }),
        p.user.findMany({
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
          ? p.user.groupBy({ by: ['role'], where: { schoolId }, _count: { id: true } })
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
      const rawUser = await p.user.findUnique({
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
        const assignments = await p.teachingAssignment.findMany({
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

      const classes = await p.class.findMany({
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
      const ecole = await p.school.findUnique({ where: { id: schoolId }, select: { templateCode: true } });
      const ecoleEstPrimaire = getTemplateMeta(ecole?.templateCode).isPrimaire;
      const cycleDeClasse = (level: string | null | undefined): 'primaire' | 'secondaire' =>
        isNiveauPrimaireOuMaternelle(level) ? 'primaire' : (ecoleEstPrimaire ? 'primaire' : 'secondaire');

      // Nombre d'élèves PEBS par classe (une seule requête groupée via Enrollment)
      const classIds = classes.map(c => c.id);
      const pebsCounts = classIds.length > 0
        ? await p.enrollment.groupBy({
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
        const cls = await p.class.findFirst({
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
          p.subjectCoefficient.findMany({
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
          p.classSubjectOverride.findMany({
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

      const subjects = await p.subject.findMany({
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
      const rooms = await p.room.findMany({
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
      const groupSets = await p.studentGroupSet.findMany({
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
      const assignments = await p.classRoomAssignment.findMany({
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
      const years = await p.academicYear.findMany({
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
      const timetables = await p.timetable.findMany({
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
      const plans = await p.feePlan.findMany({
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
        p.invoice.count({ where }),
        p.invoice.findMany({
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
      const updated = await p.school.update({
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
  const disciplineController = new DisciplineController(p);
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
        p.book.count({ where }),
        p.book.findMany({
          where,
          include: { _count: { select: { loans: { where: { status: 'ACTIVE' } } } } },
          orderBy: { title: 'asc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
      ]);
      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'livres_disponibles', targetType: 'Book', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { search, category },
      });
      res.json({ success: true, data: books, pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) } });
    } catch (err) {
      journaliserActionIA(p, {
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
      const book = await p.book.create({
        data: { schoolId, title, author: author ?? null, isbn: isbn ?? null, quantity: qty, available: qty, category: category ?? null },
      });
      res.status(201).json({ success: true, data: book });
    } catch (err) { next(err); }
  });

  // PATCH /api/v2/library/books/:id — modifier un ouvrage
  app.patch('/api/v2/library/books/:id', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const book = await p.book.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!book) { res.status(404).json({ success: false, message: 'Ouvrage introuvable' }); return; }
      const updated = await p.book.update({
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
      const book = await p.book.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!book) { res.status(404).json({ success: false, message: 'Ouvrage introuvable' }); return; }
      const activeCount = await p.bookLoan.count({
        where: { bookId: book.id, status: { in: ['ACTIVE', 'OVERDUE'] } },
      });
      if (activeCount > 0) {
        res.status(409).json({
          success: false,
          message: `Impossible de supprimer : ${activeCount} exemplaire(s) actuellement emprunté(s)`,
        });
        return;
      }
      await p.book.delete({ where: { id: book.id } });
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
        p.bookLoan.count({ where }),
        p.bookLoan.findMany({
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
      const book = await p.book.findFirst({ where: { id: bookId, schoolId } });
      if (!book) { res.status(404).json({ success: false, message: 'Ouvrage introuvable' }); return; }
      if (book.available <= 0) { res.status(409).json({ success: false, message: 'Aucun exemplaire disponible' }); return; }
      const student = await p.user.findFirst({ where: { id: studentId, schoolId, role: 'STUDENT' } });
      if (!student) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }
      const [loan] = await p.$transaction([
        p.bookLoan.create({
          data: {
            schoolId, bookId, studentId,
            dueDate: dueDate ? new Date(dueDate) : null,
          },
          include: {
            book: { select: { id: true, title: true, author: true } },
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        }),
        p.book.update({ where: { id: bookId }, data: { available: { decrement: 1 } } }),
      ]);
      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'emprunter_livre', targetType: 'BookLoan', targetId: loan.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { bookId, studentId, dueDate },
      });
      res.status(201).json({ success: true, data: loan });
    } catch (err) {
      journaliserActionIA(p, {
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
      const loan = await p.bookLoan.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!loan) { res.status(404).json({ success: false, message: 'Emprunt introuvable' }); return; }
      if (loan.status === 'RETURNED') { res.status(409).json({ success: false, message: 'Livre déjà retourné' }); return; }
      const [updated] = await p.$transaction([
        p.bookLoan.update({
          where: { id: loan.id },
          data: { status: 'RETURNED', returnedAt: new Date() },
          include: { book: { select: { id: true, title: true } } },
        }),
        p.book.update({ where: { id: loan.bookId }, data: { available: { increment: 1 } } }),
      ]);
      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'retourner_livre', targetType: 'BookLoan', targetId: loan.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { loanId: loan.id },
      });
      res.json({ success: true, data: updated });
    } catch (err) {
      journaliserActionIA(p, {
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
      const loan = await p.bookLoan.findFirst({ where: { id: req.params.id as string, schoolId } });
      if (!loan) { res.status(404).json({ success: false, message: 'Emprunt introuvable' }); return; }
      if (loan.status === 'RETURNED') { res.status(409).json({ success: false, message: 'Livre déjà retourné — impossible de renouveler' }); return; }
      const updated = await p.bookLoan.update({
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
        const loans = await p.bookLoan.findMany({
          where: { schoolId, studentId: userId },
          include: { book: { select: { id: true, title: true, author: true, category: true } } },
          orderBy: { borrowedAt: 'desc' },
          take: 50,
        });
        res.json({ success: true, data: loans });
        return;
      }

      if (role === 'PARENT') {
        const parentProfile = await p.parentProfile.findUnique({
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
        const loans = await p.bookLoan.findMany({
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

      const parentProfile = await p.parentProfile.findUnique({
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
        p.invoice.count({ where }),
        p.invoice.findMany({
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
      const invoice = await p.invoice.findFirst({ where: { id: invoiceId, schoolId } });
      if (!invoice) { res.status(404).json({ success: false, message: 'Facture introuvable' }); return; }

      const parentProfile = await p.parentProfile.findUnique({
        where: { userId },
        include: { children: { include: { studentProfile: { select: { userId: true } } } } },
      });
      const childUserIds = (parentProfile?.children ?? [])
        .map(c => c.studentProfile?.userId)
        .filter((id): id is string => Boolean(id));

      if (!childUserIds.includes(invoice.studentId)) {
        res.status(403).json({ success: false, message: 'Accès refusé' }); return;
      }

      const result = await c.finance.initierPaiement.execute({
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
  const onboardingControllerForMaster2 = new SchoolOnboardingControllerForMaster(c.school.onboarder, c.school.approuver);
  app.post(
    '/api/master/schools/:id/approve',
    protectMaster,
    authorizeMaster(['super_admin']),
    requireMasterSensitiveAuth,
    onboardingControllerForMaster2.approuverEcole,
  );
  // /api/v2/master/ passe déjà par router.use(protectMaster) dans creerMasterAdminHexRoutes
  // → ne pas répéter protectMaster ici pour éviter la double requête MasterUser
  app.post(
    '/api/v2/master/schools/:id/approve',
    authorizeMaster(['super_admin', 'platform_admin']),
    requireMasterSensitiveAuth,
    onboardingControllerForMaster2.approuverEcole,
  );

  // ── Module LV2 — gestion langue vivante 2 par élève ──────────────────────

  // PATCH /api/v2/students/:id/lv2 — affecter une LV2 à un élève
  app.patch('/api/v2/students/:id/lv2', requireAuth, requireRole('ADMIN', 'STAFF'), async (req, res, next) => {
    try {
      const schoolId = req.user!.schoolId;
      const studentUserId = req.params['id'] as string;
      const { lv2SubjectId } = req.body as { lv2SubjectId?: string | null };

      const profile = await p.studentProfile.findFirst({
        where: { userId: studentUserId, user: { schoolId } },
        select: { id: true },
      });
      if (!profile) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }

      if (lv2SubjectId) {
        const subj = await p.subject.findFirst({ where: { id: lv2SubjectId, schoolId }, select: { id: true } });
        if (!subj) { res.status(404).json({ success: false, message: 'Matière introuvable' }); return; }
      }

      await p.studentProfile.update({
        where: { id: profile.id },
        data: { lv2SubjectId: lv2SubjectId ?? null },
      });
      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_lv2_eleve', targetType: 'User', targetId: studentUserId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { studentUserId, lv2SubjectId },
      });
      res.json({ success: true, message: 'LV2 affectée' });
    } catch (err) {
      journaliserActionIA(p, {
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
        const subj = await p.subject.findFirst({ where: { id: lv2SubjectId, schoolId }, select: { id: true } });
        if (!subj) { res.status(404).json({ success: false, message: 'Matière introuvable' }); return; }
      }

      const profiles = await p.studentProfile.findMany({
        where: { userId: { in: studentUserIds }, user: { schoolId } },
        select: { id: true },
      });
      const result = await p.studentProfile.updateMany({
        where: { id: { in: profiles.map((p: any) => p.id) } },
        data: { lv2SubjectId: lv2SubjectId ?? null },
      });

      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_lv2_masse', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { studentUserIds, lv2SubjectId, modifies: result.count },
      });
      res.json({ success: true, data: { modifies: result.count } });
    } catch (err) {
      journaliserActionIA(p, {
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

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const students = await p.user.findMany({
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

      journaliserActionIA(p, {
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
      journaliserActionIA(p, {
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

      const profile = await p.studentProfile.findFirst({
        where: { userId: studentUserId, user: { schoolId } },
        select: { id: true },
      });
      if (!profile) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }

      if (pebsFiliere !== null && pebsFiliere !== undefined && !['FR_PEBS', 'EN_PEBS'].includes(pebsFiliere)) {
        res.status(400).json({ success: false, message: 'Valeur pebsFiliere invalide' }); return;
      }

      await p.studentProfile.update({
        where: { id: profile.id },
        data: { pebsFiliere: pebsFiliere ?? null },
      });
      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_pebs_eleve', targetType: 'User', targetId: studentUserId,
        origin: 'UI_DIRECT', outcome: 'SUCCES', parametersSummary: { studentUserId, pebsFiliere },
      });
      res.json({ success: true, message: 'PEBS affecté' });
    } catch (err) {
      journaliserActionIA(p, {
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

      const profiles = await p.studentProfile.findMany({
        where: { userId: { in: studentUserIds }, user: { schoolId } },
        select: { id: true },
      });
      const result = await p.studentProfile.updateMany({
        where: { id: { in: profiles.map((p: any) => p.id) } },
        data: { pebsFiliere: pebsFiliere ?? null },
      });

      journaliserActionIA(p, {
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'affecter_pebs_masse', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { studentUserIds, pebsFiliere, modifies: result.count },
      });
      res.json({ success: true, data: { modifies: result.count } });
    } catch (err) {
      journaliserActionIA(p, {
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

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const students = await p.user.findMany({
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

      journaliserActionIA(p, {
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
      journaliserActionIA(p, {
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
  const resoudreParticipantsSeanceUseCase = c.timetable.resoudreParticipantsSeance;
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
  const studentAffectationRepositoryForALevel = new PrismaStudentAffectationRepository(p);
  const affecterALevelUseCase   = new AffecterMatieresALevelEleveUseCase(studentAffectationRepositoryForALevel);
  const preremplirALevelUseCase = new PreremplirDepuisCombinaisonUseCase(studentAffectationRepositoryForALevel);
  const getElevesALevelUseCase  = new GetElevesParMatiereALevelUseCase(studentAffectationRepositoryForALevel);

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
      const profile = await p.studentProfile.findFirst({
        where: { userId: studentUserId, user: { schoolId } },
        select: { id: true },
      });
      if (!profile) { res.status(404).json({ success: false, message: 'Élève introuvable' }); return; }

      const links = await p.studentALevelSubject.findMany({
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

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      // Matières A-Level disponibles de l'établissement (matières de l'école dont le nom est un sujet A-Level officiel)
      const officialALevel = await p.aLevelSubject.findMany({ select: { subjectName: true } });
      const officialNames: string[] = officialALevel.map((a: any) => a.subjectName);
      const availableSubjects = await p.subject.findMany({
        where: { schoolId, name: { in: officialNames } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      const students = await p.user.findMany({
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

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const students = await p.user.findMany({
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

      const classe = await p.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
      if (!classe) { res.status(404).json({ success: false, message: 'Classe introuvable' }); return; }

      const allStudents: any[] = await p.user.findMany({
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
        const subject = await p.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true, name: true, isLV2: true } });
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
            const isOfficialALevel = await p.aLevelSubject.findUnique({ where: { subjectName: subject.name }, select: { subjectName: true } });
            if (isOfficialALevel) {
              mode = 'ALEVEL';
              filtered = allStudents.filter(s => (s.studentProfile?.alevelSubjects ?? []).some((a: any) => a.subjectId === subjectId));
            }
          }
        }
      }

      const subjectName = subjectId
        ? (await p.subject.findFirst({ where: { id: subjectId, schoolId }, select: { name: true } }))?.name ?? ''
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
    const devController = new DevController(p);
    app.use('/api/v2/dev', creerDevRoutes(devController));
    console.log('🔧 Routes dev montées sur /api/v2/dev (NODE_ENV:', process.env.NODE_ENV, ')');
  }

  app.use(errorHandler);
}
