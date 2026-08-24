/**
 * INFRASTRUCTURE LAYER — Container d'injection de dépendances ZekoulABia
 *
 * Ce fichier branche les implémentations concrètes sur les interfaces (ports).
 * C'est le seul endroit où Prisma, SendGrid, Campay etc. sont instanciés.
 *
 * Principe :
 *   Adapters (Prisma, services) → injectés dans → Use Cases → injectés dans → Controllers
 */

import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from '@infrastructure/persistence/prisma/softDeleteExtension';

// --- Adapters Persistence ---
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaSchoolRepository } from '@infrastructure/persistence/prisma/PrismaSchoolRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaNoteRepository } from '@infrastructure/persistence/prisma/PrismaNoteRepository';
import { PrismaPresenceRepository } from '@infrastructure/persistence/prisma/PrismaPresenceRepository';
import { PrismaBulletinRepository } from '@infrastructure/persistence/prisma/PrismaBulletinRepository';
import { PrismaMatiereRepository } from '@infrastructure/persistence/prisma/PrismaMatiereRepository';
import { PrismaRoomRepository } from '@infrastructure/persistence/prisma/PrismaRoomRepository';
import { PrismaTeacherUnavailabilityRepository } from '@infrastructure/persistence/prisma/PrismaTeacherUnavailabilityRepository';
import { PrismaStudentGroupSetRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupSetRepository';
import { PrismaStudentGroupRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupRepository';
import { PrismaStudentGroupMembershipRepository } from '@infrastructure/persistence/prisma/PrismaStudentGroupMembershipRepository';
import { PrismaClassRoomAssignmentRepository } from '@infrastructure/persistence/prisma/PrismaClassRoomAssignmentRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaSectionRepository } from '@infrastructure/persistence/prisma/PrismaSectionRepository';
import { PrismaStudentProfileRepository } from '@infrastructure/persistence/prisma/PrismaStudentProfileRepository';

// --- Adapters Audit ---
import { ActivityLogAdapter } from '@infrastructure/services/audit/ActivityLogAdapter';
import { AIActionAuditAdapter } from '@infrastructure/services/ai/AIActionAuditAdapter';

// --- Use Cases : Notes ---
import { SaisirNoteUseCase } from '@application/grade/SaisirNoteUseCase';
import { SoumettreNoteUseCase } from '@application/grade/SoumettreNoteUseCase';
import { ValiderNoteUseCase } from '@application/grade/ValiderNoteUseCase';
import { RejeterNoteUseCase } from '@application/grade/RejeterNoteUseCase';
import { ValiderEnBlocUseCase } from '@application/grade/ValiderEnBlocUseCase';

// --- Use Cases : Présences ---
import { EnregistrerPresenceUseCase } from '@application/attendance/EnregistrerPresenceUseCase';

// --- Use Cases : School ---
import { OnboarderEcoleUseCase } from '@application/school/OnboarderEcoleUseCase';
import { ApprouverEcoleUseCase } from '@application/school/ApprouverEcoleUseCase';

// --- Use Case : Import ---
import { ImporterUtilisateursUseCase } from '@application/user/ImporterUtilisateursUseCase';

// --- Use Cases : Bulletins ---
import { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';

// --- Use Cases : Conseil de Classe ---
import { TenirConseilClasseUseCase } from '@application/classCouncil/TenirConseilClasseUseCase';
import { PreparerVueConseilClasseUseCase } from '@application/classCouncil/PreparerVueConseilClasseUseCase';
import { CreerSessionConseilClasseUseCase } from '@application/classCouncil/CreerSessionConseilClasseUseCase';
import { ListerSessionsConseilClasseUseCase } from '@application/classCouncil/ListerSessionsConseilClasseUseCase';
import { ObtenirSessionConseilClasseUseCase } from '@application/classCouncil/ObtenirSessionConseilClasseUseCase';
import { AjouterDecisionConseilClasseUseCase } from '@application/classCouncil/AjouterDecisionConseilClasseUseCase';
import { AjouterDecisionsEnBlocUseCase } from '@application/classCouncil/AjouterDecisionsEnBlocUseCase';
import { VerrouillerConseilClasseUseCase } from '@application/classCouncil/VerrouillerConseilClasseUseCase';
import { PublierBulletinsConseilClasseUseCase } from '@application/classCouncil/PublierBulletinsConseilClasseUseCase';
import { GenererProcesVerbalUseCase } from '@application/classCouncil/GenererProcesVerbalUseCase';
import { GenererRapportConseilUseCase } from '@application/classCouncil/GenererRapportConseilUseCase';

// --- Use Cases : Matricule ---
import { ImporterMatriculesUseCase } from '@application/matricule/ImporterMatriculesUseCase';
import { VerifierMatriculeUseCase } from '@application/matricule/VerifierMatriculeUseCase';
import { SyncFromCarteScolaireUseCase } from '@application/matricule/SyncFromCarteScolaireUseCase';
import { VerifierRecuUseCase } from '@application/matricule/VerifierRecuUseCase';
import { ConfirmerCorrespondanceFuzzyUseCase } from '@application/matricule/ConfirmerCorrespondanceFuzzyUseCase';
import { SignalerErreurCarteScolaireUseCase } from '@application/matricule/SignalerErreurCarteScolaireUseCase';
import { CarteScolaireScrapingAdapter } from '@infrastructure/services/scraping/CarteScolaireScrapingAdapter';

// --- Use Cases : Onboarding Auto-Service Élèves ---
import { CreerSqueletteOnboardingUseCase } from '@application/eleveOnboarding/CreerSqueletteOnboardingUseCase';
import { SoumettreFormulaireOnboardingUseCase } from '@application/eleveOnboarding/SoumettreFormulaireOnboardingUseCase';
import { ValiderOnboardingUseCase } from '@application/eleveOnboarding/ValiderOnboardingUseCase';
import { RejeterOnboardingUseCase } from '@application/eleveOnboarding/RejeterOnboardingUseCase';
import { VerifierCompletudeSupplementUseCase } from '@application/statisticalCampaign/VerifierCompletudeSupplementUseCase';
import { GenererDeclarationStatistiqueMinesecUseCase } from '@application/statisticalCampaign/GenererDeclarationStatistiqueMinesecUseCase';
import { GenererRapportSyntheseMinedubUseCase } from '@application/statisticalCampaignMinedub/GenererRapportSyntheseMinedubUseCase';

// --- Use Cases : Paiement MINESEC ---
import { GenererPaiementsMinesecUseCase } from '@application/paiementMinesec/GenererPaiementsMinesecUseCase';
import { GenererPaiementsMinesecPourEcoleUseCase } from '@application/paiementMinesec/GenererPaiementsMinesecPourEcoleUseCase';
import { GetStudentPaymentDashboardUseCase } from '@application/paiementMinesec/GetStudentPaymentDashboardUseCase';
import { GetSchoolPaymentOverviewUseCase } from '@application/paiementMinesec/GetSchoolPaymentOverviewUseCase';

// --- Use Cases : Examen ---
import { PrepareExamDossierUseCase } from '@application/examen/PrepareExamDossierUseCase';

// --- Use Cases : LV2 Choice ---
import { OuvrirFenetreChoixLV2UseCase } from '@application/lv2Choice/OuvrirFenetreChoixLV2UseCase';
import { SoumettreChoixLV2EleveUseCase } from '@application/lv2Choice/SoumettreChoixLV2EleveUseCase';
import { SaisirChoixLV2ManuelUseCase } from '@application/lv2Choice/SaisirChoixLV2ManuelUseCase';
import { AppliquerChoixLV2UseCase } from '@application/lv2Choice/AppliquerChoixLV2UseCase';
import { SuivreFenetreChoixLV2UseCase } from '@application/lv2Choice/SuivreFenetreChoixLV2UseCase';

// --- Use Cases : Entrance Exam ---
import { CreerSessionConcoursUseCase } from '@application/entranceExam/CreerSessionConcoursUseCase';
import { AjouterCandidatsConcoursUseCase } from '@application/entranceExam/AjouterCandidatsConcoursUseCase';
import { CalculerAdmissionConcoursUseCase } from '@application/entranceExam/CalculerAdmissionConcoursUseCase';
import { EnregistrerResultatCepUseCase } from '@application/entranceExam/EnregistrerResultatCepUseCase';
import { ResumeSessionConcoursUseCase } from '@application/entranceExam/ResumeSessionConcoursUseCase';
import { ScannerListeCandidatsUseCase } from '@application/entranceExam/ScannerListeCandidatsUseCase';
import { DetecterAnomaliesConcoursUseCase } from '@application/entranceExam/DetecterAnomaliesConcoursUseCase';

// --- Use Cases : Push Notification ---
import { SouscrirePushUseCase } from '@application/pushNotification/SouscrirePushUseCase';
import { DesinscrirePushUseCase } from '@application/pushNotification/DesinscrirePushUseCase';

// --- Use Cases : PEBS Exam ---
import { CreerSessionPebsUseCase } from '@application/pebsExam/CreerSessionPebsUseCase';
import { AjouterCandidatsPebsUseCase } from '@application/pebsExam/AjouterCandidatsPebsUseCase';
import { CalculerSelectionPebsUseCase } from '@application/pebsExam/CalculerSelectionPebsUseCase';
import { AppliquerTransfertPebsUseCase } from '@application/pebsExam/AppliquerTransfertPebsUseCase';
import { ResumeSessionPebsUseCase } from '@application/pebsExam/ResumeSessionPebsUseCase';
import { ScannerListeCandidatsPebsUseCase } from '@application/pebsExam/ScannerListeCandidatsPebsUseCase';
import { DetecterAnomaliesPebsUseCase } from '@application/pebsExam/DetecterAnomaliesPebsUseCase';

// --- Adapters Services ---
import { NodemailerEmailService } from '@infrastructure/services/email/NodemailerEmailService';
import { SocketNotificationService } from '@infrastructure/services/notification/SocketNotificationService';
import { PdfKitBulletinService } from '@infrastructure/services/pdf/PdfKitBulletinService';
import { JwtTokenService } from '@infrastructure/services/auth/JwtTokenService';

// --- Adapters Persistence (suite) ---
import { PrismaInvitationRepository } from '@infrastructure/persistence/prisma/PrismaInvitationRepository';

// --- Use Cases : User ---
import { ConnecterUtilisateurUseCase } from '@application/user/ConnecterUtilisateurUseCase';
import { InscrireUtilisateurUseCase } from '@application/user/InscrireUtilisateurUseCase';
import { RafraichirTokenUseCase } from '@application/user/RafraichirTokenUseCase';
import { DeconnecterUtilisateurUseCase } from '@application/user/DeconnecterUtilisateurUseCase';
import { ModifierUtilisateurUseCase } from '@application/user/ModifierUtilisateurUseCase';
import { SupprimerUtilisateurUseCase } from '@application/user/SupprimerUtilisateurUseCase';
import { TransfererEleveUseCase } from '@application/user/TransfererEleveUseCase';

// --- Adapters Persistence Finance ---
import { PrismaPlanFraisRepository } from '@infrastructure/persistence/prisma/PrismaPlanFraisRepository';
import { PrismaFactureRepository } from '@infrastructure/persistence/prisma/PrismaFactureRepository';
import { PrismaPaiementRepository } from '@infrastructure/persistence/prisma/PrismaPaiementRepository';
import { PrismaDepenseRepository } from '@infrastructure/persistence/prisma/PrismaDepenseRepository';

// --- Adapter Service Campay ---
import { CampayPaiementService } from '@infrastructure/services/payment/CampayPaiementService';

// --- Use Cases : Finance ---
import { CreerPlanFraisUseCase } from '@application/finance/CreerPlanFraisUseCase';
import { ChangerStatutPlanFraisUseCase } from '@application/finance/ChangerStatutPlanFraisUseCase';
import { CopierPlansFraisAnneePrecedenteUseCase } from '@application/finance/CopierPlansFraisAnneePrecedenteUseCase';
import { GenererFactureUseCase } from '@application/finance/GenererFactureUseCase';
import { GenererFacturesEnMasseUseCase } from '@application/finance/GenererFacturesEnMasseUseCase';
import { InitierPaiementMobileMoneyUseCase } from '@application/finance/InitierPaiementMobileMoneyUseCase';
import { TraiterWebhookCampayUseCase } from '@application/finance/TraiterWebhookCampayUseCase';
import { RembourserCautionUseCase } from '@application/finance/RembourserCautionUseCase';
import { EnregistrerDepenseUseCase } from '@application/finance/EnregistrerDepenseUseCase';
import { EnregistrerPaiementCashUseCase } from '@application/finance/EnregistrerPaiementCashUseCase';

// --- Adapters Persistence Classe + Matière ---
import { PrismaSousGroupeRepository } from '@infrastructure/persistence/prisma/PrismaSousGroupeRepository';

// --- Adapters Persistence AnneeAcademique + Promotion ---
import { PrismaPromotionRepository } from '@infrastructure/persistence/prisma/PrismaPromotionRepository';

// --- Adapters Persistence Timetable ---
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';

// --- Adapters Persistence AI ---
import { PrismaSanteEleveRepository } from '@infrastructure/persistence/prisma/PrismaSanteEleveRepository';
import { PrismaClassCouncilRepository } from '@infrastructure/persistence/prisma/PrismaClassCouncilRepository';
import { PrismaClassCouncilPreviewQueryPort } from '@infrastructure/persistence/prisma/PrismaClassCouncilPreviewQueryPort';

// --- Adapter Service IA ---
import { GroqIAService } from '@infrastructure/services/ai/GroqIAService';

// --- Use Cases : AI ---
import { CalculerIndiceSanteUseCase } from '@application/ai/CalculerIndiceSanteUseCase';
import { CompareRisquePredictionsUseCase } from '@application/ai/CompareRisquePredictionsUseCase';
import { RulesBasedPredictionService } from '@infrastructure/services/ai/RulesBasedPredictionService';
import { TabPfnPredictionService } from '@infrastructure/services/ai/TabPfnPredictionService';

// --- Adapters Persistence Parent + SchoolSettings ---
import { PrismaParentRepository } from '@infrastructure/persistence/prisma/PrismaParentRepository';
import { PrismaSchoolSettingsRepository } from '@infrastructure/persistence/prisma/PrismaSchoolSettingsRepository';

// --- Use Cases : Parent ---
import { ObtenirEnfantsUseCase } from '@application/parent/ObtenirEnfantsUseCase';
import { ObtenirAlertesSoldeUseCase } from '@application/parent/ObtenirAlertesSoldeUseCase';
import { VerifierAccesEnfantUseCase } from '@application/parent/VerifierAccesEnfantUseCase';

// --- Use Cases : SchoolSettings ---
import { ObtenirParametresEcoleUseCase } from '@application/schoolSettings/ObtenirParametresEcoleUseCase';
import { MettreAJourParametresEcoleUseCase } from '@application/schoolSettings/MettreAJourParametresEcoleUseCase';

// --- Use Cases : Timetable ---
import { CreerEmploiDuTempsUseCase } from '@application/timetable/CreerEmploiDuTempsUseCase';
import { AjouterCreneauUseCase } from '@application/timetable/AjouterCreneauUseCase';
import { ModifierCreneauUseCase } from '@application/timetable/ModifierCreneauUseCase';
import { PublierEmploiDuTempsUseCase } from '@application/timetable/PublierEmploiDuTempsUseCase';
import { DemanderRattrapageUseCase } from '@application/timetable/DemanderRattrapageUseCase';
import { GenererSeancesGroupeUseCase } from '@application/timetable/GenererSeancesGroupeUseCase';
import { ProposerEmploiDuTempsUseCase } from '@application/timetable/ProposerEmploiDuTempsUseCase';
import { GenererSqueletteEmploiDuTempsUseCase } from '@application/timetable/GenererSqueletteEmploiDuTempsUseCase';
import { AppliquerPropositionEmploiDuTempsUseCase } from '@application/timetable/AppliquerPropositionEmploiDuTempsUseCase';
import { SimulerEmploiDuTempsUseCase } from '@application/timetable/SimulerEmploiDuTempsUseCase';
import { ORToolsWasmAdapter } from '@infrastructure/scheduling/ORToolsWasmAdapter';

// --- Use Cases : AnneeAcademique ---
import { CreerAnneeAcademiqueUseCase } from '@application/academicYear/CreerAnneeAcademiqueUseCase';
import { DefinirPeriodeCouranteUseCase } from '@application/academicYear/DefinirPeriodeCouranteUseCase';
import { VerifierPrerequisClotureUseCase } from '@application/academicYear/VerifierPrerequisClotureUseCase';
import { CloturerAnneeUseCase } from '@application/academicYear/CloturerAnneeUseCase';
import { ProposerStructureAnneeSuivanteUseCase } from '@application/academicYear/ProposerStructureAnneeSuivanteUseCase';
import { ValiderStructureAnneeSuivanteUseCase } from '@application/academicYear/ValiderStructureAnneeSuivanteUseCase';
import { AnnulerStructureProposeeUseCase } from '@application/academicYear/AnnulerStructureProposeeUseCase';
import { MettreAJourCalendrierUseCase } from '@application/academicYear/MettreAJourCalendrierUseCase';

// --- Use Cases : Classe ---
import { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import { CreerCanalClasseUseCase } from '@application/messagerie/CreerCanalClasseUseCase';
import { CreerCanalParentsUseCase } from '@application/messagerie/CreerCanalParentsUseCase';
import { ModifierClasseUseCase } from '@application/class/ModifierClasseUseCase';
import { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import { AssignerProfesseurPrincipalUseCase } from '@application/class/AssignerProfesseurPrincipalUseCase';
import { CreerSousGroupeTPUseCase } from '@application/class/CreerSousGroupeTPUseCase';
import { AssignerElevesAuSousGroupeUseCase } from '@application/class/AssignerElevesAuSousGroupeUseCase';

// --- Use Cases : Matière ---
import { CreerMatiereUseCase } from '@application/subject/CreerMatiereUseCase';
import { ModifierMatiereUseCase } from '@application/subject/ModifierMatiereUseCase';
import { AssignerEnseignantMatiereUseCase } from '@application/subject/AssignerEnseignantMatiereUseCase';
import { DefinirCoefficientUseCase } from '@application/subject/DefinirCoefficientUseCase';
import { SupprimerMatiereUseCase } from '@application/subject/SupprimerMatiereUseCase';

// --- Use Cases : Room (Salle) ---
import { CreerSalleUseCase } from '@application/room/CreerSalleUseCase';
import { ModifierSalleUseCase } from '@application/room/ModifierSalleUseCase';
import { SupprimerSalleUseCase } from '@application/room/SupprimerSalleUseCase';

// --- Use Cases : TeacherUnavailability (V2.4) ---
import { CreerIndisponibiliteEnseignantUseCase } from '@application/timetable/CreerIndisponibiliteEnseignantUseCase';
import { ModifierIndisponibiliteEnseignantUseCase } from '@application/timetable/ModifierIndisponibiliteEnseignantUseCase';
import { SupprimerIndisponibiliteEnseignantUseCase } from '@application/timetable/SupprimerIndisponibiliteEnseignantUseCase';
import { ListerIndisponibilitesEnseignantUseCase } from '@application/timetable/ListerIndisponibilitesEnseignantUseCase';

// --- Use Cases : StudentGroup / ClassRoomAssignment ---
import { CreerStudentGroupSetUseCase } from '@application/studentGroup/CreerStudentGroupSetUseCase';
import { ModifierStudentGroupSetUseCase } from '@application/studentGroup/ModifierStudentGroupSetUseCase';
import { SupprimerStudentGroupSetUseCase } from '@application/studentGroup/SupprimerStudentGroupSetUseCase';
import { CreerStudentGroupUseCase } from '@application/studentGroup/CreerStudentGroupUseCase';
import { ModifierStudentGroupUseCase } from '@application/studentGroup/ModifierStudentGroupUseCase';
import { SupprimerStudentGroupUseCase } from '@application/studentGroup/SupprimerStudentGroupUseCase';
import { AssignerSalleClasseUseCase } from '@application/studentGroup/AssignerSalleClasseUseCase';
import { RetirerAssignationSalleUseCase } from '@application/studentGroup/RetirerAssignationSalleUseCase';

// --- Adapter Persistence Orientation ---
import { PrismaOrientationRepository } from '@infrastructure/persistence/prisma/PrismaOrientationRepository';

// --- Use Cases : Orientation ---
import { CreerFicheOrientationUseCase } from '@application/orientation/CreerFicheOrientationUseCase';
import { AjouterEntretienUseCase } from '@application/orientation/AjouterEntretienUseCase';
import { AjouterTestAptitudeUseCase } from '@application/orientation/AjouterTestAptitudeUseCase';
import { CreerRecommandationSerieUseCase } from '@application/orientation/CreerRecommandationSerieUseCase';
import { AjouterSuiviUseCase } from '@application/orientation/AjouterSuiviUseCase';
import { ListerFichesOrientationUseCase } from '@application/orientation/ListerFichesOrientationUseCase';
import { GetStatsOrientationUseCase } from '@application/orientation/GetStatsOrientationUseCase';
import { SaisirAspirationsEleveUseCase } from '@application/orientation/SaisirAspirationsEleveUseCase';
import { GenererRecommandationOrientationUseCase } from '@application/orientation/GenererRecommandationOrientationUseCase';
import { ValiderRecommandationConseillerUseCase } from '@application/orientation/ValiderRecommandationConseillerUseCase';
import { ProposerRecommandationEleveUseCase } from '@application/orientation/ProposerRecommandationEleveUseCase';
import { ChoisirPisteEleveUseCase } from '@application/orientation/ChoisirPisteEleveUseCase';
import { ListerElevesAOrienterUseCase } from '@application/orientation/ListerElevesAOrienterUseCase';
import { ConfigurerCheckpointOrientationUseCase } from '@application/orientation/ConfigurerCheckpointOrientationUseCase';

// --- Use Cases : MasterAdmin ---
import { InviterEcoleUseCase } from '@application/masterAdmin/InviterEcoleUseCase';
import { SuspendreEcoleUseCase } from '@application/masterAdmin/SuspendreEcoleUseCase';
import { ReactiverEcoleUseCase } from '@application/masterAdmin/ReactiverEcoleUseCase';
import { RejeterEcoleUseCase } from '@application/masterAdmin/RejeterEcoleUseCase';
import { ChangerPlanAbonnementUseCase } from '@application/masterAdmin/ChangerPlanAbonnementUseCase';

// ─────────────────────────────────────────────
// Factory principale
// ─────────────────────────────────────────────

export function creerContainer() {
  // 1. Client Prisma (singleton) — connexion séparée de celle de prisma.client.ts (dette
  // architecturale préexistante, pas corrigée ici), mais l'extension de soft-delete doit couvrir
  // les DEUX pour que le filtre deletedAt:null soit vraiment universel (voir softDeleteExtension.ts).
  const prisma = new PrismaClient().$extends(softDeleteExtension) as unknown as PrismaClient;

  // 2. Repositories
  const userRepository = new PrismaUserRepository(prisma);
  const schoolRepository = new PrismaSchoolRepository(prisma);
  const classeRepository = new PrismaClasseRepository(prisma);
  const noteRepository = new PrismaNoteRepository(prisma);
  const presenceRepository = new PrismaPresenceRepository(prisma);
  const bulletinRepository = new PrismaBulletinRepository(prisma);
  const matiereRepository = new PrismaMatiereRepository(prisma);
  const sectionRepository = new PrismaSectionRepository(prisma);
  const studentProfileRepository = new PrismaStudentProfileRepository(prisma);
  const anneeRepository = new PrismaAnneeAcademiqueRepository(prisma);
  const roomRepository = new PrismaRoomRepository(prisma);
  const studentGroupSetRepository = new PrismaStudentGroupSetRepository(prisma);
  const studentGroupRepository = new PrismaStudentGroupRepository(prisma);
  const studentGroupMembershipRepository = new PrismaStudentGroupMembershipRepository(prisma);
  const classRoomAssignmentRepository = new PrismaClassRoomAssignmentRepository(prisma);

  // 3. Services (adaptateurs réels)
  const emailService = new NodemailerEmailService();
  const notificationService = new SocketNotificationService();
  const pdfService = new PdfKitBulletinService();

  // 4. Use Cases — Notes
  const saisirNoteUseCase = new SaisirNoteUseCase(
    noteRepository, matiereRepository, userRepository, prisma
  );
  const soumettreNoteUseCase = new SoumettreNoteUseCase(noteRepository);
  const validerNoteUseCase = new ValiderNoteUseCase(noteRepository, userRepository);
  const rejeterNoteUseCase = new RejeterNoteUseCase(
    noteRepository, userRepository, notificationService
  );
  const validerEnBlocUseCase = new ValiderEnBlocUseCase(noteRepository, userRepository);

  // 5. Use Cases — Import
  const importerUtilisateursUseCase = new ImporterUtilisateursUseCase(
    prisma, userRepository, studentGroupSetRepository, studentGroupRepository, studentGroupMembershipRepository
  );

  // 6. Use Cases — Présences
  const enregistrerPresenceUseCase = new EnregistrerPresenceUseCase(
    presenceRepository, userRepository, notificationService, prisma
  );

  // 6. Use Cases — School
  const onboarderEcoleUseCase = new OnboarderEcoleUseCase(
    schoolRepository, userRepository, emailService
  );
  const approuverEcoleUseCase = new ApprouverEcoleUseCase(
    schoolRepository, userRepository, emailService
  );

  // 7. Use Cases — Bulletins
  const classCouncilRepository = new PrismaClassCouncilRepository(prisma);
  const activityLog = new ActivityLogAdapter();
  const auditLog = new AIActionAuditAdapter(prisma);

  const genererBulletinUseCase = new GenererBulletinUseCase(
    noteRepository, bulletinRepository, classeRepository,
    userRepository, matiereRepository, anneeRepository,
    presenceRepository, pdfService, classCouncilRepository,
    schoolRepository, sectionRepository, studentProfileRepository,
  );
  const envoyerBulletinsUseCase = new EnvoyerBulletinsUseCase(
    bulletinRepository, userRepository, emailService
  );

  // 8. Use Cases — Conseil de Classe
  const tenirConseilClasseUseCase = new TenirConseilClasseUseCase(
    noteRepository, classeRepository, userRepository
  );
  const preparerVueConseilClasseUseCase = new PreparerVueConseilClasseUseCase(
    new PrismaClassCouncilPreviewQueryPort(prisma),
    classCouncilRepository,
  );
  const creerSessionConseilUseCase = new CreerSessionConseilClasseUseCase(classCouncilRepository, activityLog, auditLog);
  const listerSessionsConseilUseCase = new ListerSessionsConseilClasseUseCase(classCouncilRepository);
  const obtenirSessionConseilUseCase = new ObtenirSessionConseilClasseUseCase(classCouncilRepository);
  const ajouterDecisionConseilUseCase = new AjouterDecisionConseilClasseUseCase(classCouncilRepository);
  const ajouterDecisionsEnBlocUseCase = new AjouterDecisionsEnBlocUseCase(classCouncilRepository);
  const verrouillerConseilUseCase = new VerrouillerConseilClasseUseCase(classCouncilRepository, activityLog);
  const publierBulletinsConseilUseCase = new PublierBulletinsConseilClasseUseCase(classCouncilRepository);
  const genererPVConseilUseCase = new GenererProcesVerbalUseCase(classCouncilRepository);
  const genererRapportConseilUseCase = new GenererRapportConseilUseCase(classCouncilRepository);

  // Repositories supplémentaires
  const invitationRepository = new PrismaInvitationRepository(prisma);

  // Service token
  const tokenService = new JwtTokenService();

  // 9. Use Cases — User
  const connecterUtilisateurUseCase = new ConnecterUtilisateurUseCase(
    userRepository, schoolRepository, tokenService
  );
  const inscrireUtilisateurUseCase = new InscrireUtilisateurUseCase(userRepository);
  const rafraichirTokenUseCase = new RafraichirTokenUseCase(
    userRepository, schoolRepository, tokenService
  );
  const deconnecterUtilisateurUseCase = new DeconnecterUtilisateurUseCase(userRepository);
  const modifierUtilisateurUseCase = new ModifierUtilisateurUseCase(userRepository);
  const supprimerUtilisateurUseCase = new SupprimerUtilisateurUseCase(userRepository);
  const transfererEleveUseCase = new TransfererEleveUseCase(userRepository, classeRepository);

  // 10. Use Cases — Finance
  const planFraisRepository = new PrismaPlanFraisRepository(prisma);
  const factureRepository = new PrismaFactureRepository(prisma);
  const paiementRepository = new PrismaPaiementRepository(prisma);
  const depenseRepository = new PrismaDepenseRepository(prisma);
  const campayPaiementService = new CampayPaiementService();

  const creerPlanFraisUseCase = new CreerPlanFraisUseCase(planFraisRepository);
  const changerStatutPlanFraisUseCase = new ChangerStatutPlanFraisUseCase(planFraisRepository);
  const genererFactureUseCase = new GenererFactureUseCase(factureRepository, planFraisRepository);
  const genererFacturesEnMasseUseCase = new GenererFacturesEnMasseUseCase(
    factureRepository, planFraisRepository, userRepository,
  );
  const initierPaiementUseCase = new InitierPaiementMobileMoneyUseCase(
    factureRepository, paiementRepository, campayPaiementService,
  );
  const traiterWebhookUseCase = new TraiterWebhookCampayUseCase(
    paiementRepository, factureRepository,
  );
  const rembourserCautionUseCase = new RembourserCautionUseCase(paiementRepository);
  const enregistrerDepenseUseCase = new EnregistrerDepenseUseCase(
    depenseRepository, userRepository,
  );
  const enregistrerPaiementCashUseCase = new EnregistrerPaiementCashUseCase(
    factureRepository, paiementRepository,
  );
  const copierPlansFraisAnneePrecedenteUseCase = new CopierPlansFraisAnneePrecedenteUseCase(planFraisRepository);

  // 11. Use Cases — Classe + Matière
  const sousGroupeRepository = new PrismaSousGroupeRepository(prisma);

  const creerClasseUseCase = new CreerClasseUseCase(
    classeRepository,
    new CreerCanalClasseUseCase(prisma),
    new CreerCanalParentsUseCase(prisma),
  );
  const modifierClasseUseCase = new ModifierClasseUseCase(classeRepository);
  const supprimerClasseUseCase = new SupprimerClasseUseCase(classeRepository);
  const assignerProfesseurUseCase = new AssignerProfesseurPrincipalUseCase(
    classeRepository, userRepository
  );
  const creerSousGroupeUseCase = new CreerSousGroupeTPUseCase(
    classeRepository, sousGroupeRepository
  );
  const assignerElevesUseCase = new AssignerElevesAuSousGroupeUseCase(sousGroupeRepository);

  const creerMatiereUseCase = new CreerMatiereUseCase(matiereRepository, userRepository);
  const modifierMatiereUseCase = new ModifierMatiereUseCase(matiereRepository, userRepository);
  const assignerEnseignantUseCase = new AssignerEnseignantMatiereUseCase(
    matiereRepository, userRepository
  );
  const definirCoefficientUseCase = new DefinirCoefficientUseCase(matiereRepository);
  const supprimerMatiereUseCase = new SupprimerMatiereUseCase(matiereRepository);

  const creerSalleUseCase = new CreerSalleUseCase(roomRepository);
  const modifierSalleUseCase = new ModifierSalleUseCase(roomRepository);
  const supprimerSalleUseCase = new SupprimerSalleUseCase(roomRepository);

  const teacherUnavailabilityRepository = new PrismaTeacherUnavailabilityRepository(prisma);
  const creerIndisponibiliteEnseignantUseCase = new CreerIndisponibiliteEnseignantUseCase(
    teacherUnavailabilityRepository, userRepository
  );
  const modifierIndisponibiliteEnseignantUseCase = new ModifierIndisponibiliteEnseignantUseCase(
    teacherUnavailabilityRepository
  );
  const supprimerIndisponibiliteEnseignantUseCase = new SupprimerIndisponibiliteEnseignantUseCase(
    teacherUnavailabilityRepository
  );
  const listerIndisponibilitesEnseignantUseCase = new ListerIndisponibilitesEnseignantUseCase(
    teacherUnavailabilityRepository, userRepository
  );

  const creerStudentGroupSetUseCase = new CreerStudentGroupSetUseCase(studentGroupSetRepository);
  const modifierStudentGroupSetUseCase = new ModifierStudentGroupSetUseCase(studentGroupSetRepository);
  const supprimerStudentGroupSetUseCase = new SupprimerStudentGroupSetUseCase(studentGroupSetRepository);
  const creerStudentGroupUseCase = new CreerStudentGroupUseCase(studentGroupRepository, studentGroupSetRepository);
  const modifierStudentGroupUseCase = new ModifierStudentGroupUseCase(studentGroupRepository, studentGroupSetRepository);
  const supprimerStudentGroupUseCase = new SupprimerStudentGroupUseCase(studentGroupRepository, studentGroupSetRepository);
  const assignerSalleClasseUseCase = new AssignerSalleClasseUseCase(classRoomAssignmentRepository, classeRepository, roomRepository);
  const retirerAssignationSalleUseCase = new RetirerAssignationSalleUseCase(classRoomAssignmentRepository);

  // 12. Use Cases — Timetable
  const timetableRepository = new PrismaTimetableRepository(prisma);

  const creerEmploiDuTempsUseCase = new CreerEmploiDuTempsUseCase(timetableRepository);
  const ajouterCreneauUseCase = new AjouterCreneauUseCase(timetableRepository);
  const modifierCreneauUseCase = new ModifierCreneauUseCase(timetableRepository);
  const publierEmploiDuTempsUseCase = new PublierEmploiDuTempsUseCase(timetableRepository);
  const demanderRattrapageUseCase = new DemanderRattrapageUseCase(
    userRepository,
    notificationService,
    prisma,
  );
  const genererSeancesGroupeUseCase = new GenererSeancesGroupeUseCase(
    timetableRepository, studentGroupRepository, studentGroupMembershipRepository,
    classRoomAssignmentRepository, roomRepository,
  );

  // Scheduling Engine (V2.5) — port hexagonal : le solveur OR-Tools/CP-SAT est interchangeable.
  const schedulingSolver = new ORToolsWasmAdapter();
  const proposerEmploiDuTempsUseCase = new ProposerEmploiDuTempsUseCase(
    timetableRepository, roomRepository, classRoomAssignmentRepository, schedulingSolver, prisma,
  );
  const appliquerPropositionEmploiDuTempsUseCase = new AppliquerPropositionEmploiDuTempsUseCase(
    timetableRepository,
  );
  const simulerEmploiDuTempsUseCase = new SimulerEmploiDuTempsUseCase(
    proposerEmploiDuTempsUseCase, schedulingSolver, prisma,
  );
  const genererSqueletteEmploiDuTempsUseCase = new GenererSqueletteEmploiDuTempsUseCase(
    timetableRepository, prisma,
  );

  // 13. Use Cases — AnneeAcademique
  const promotionRepository = new PrismaPromotionRepository(prisma);

  const creerAnneeUseCase = new CreerAnneeAcademiqueUseCase(anneeRepository);
  const definirPeriodeUseCase = new DefinirPeriodeCouranteUseCase(anneeRepository);
  const verifierPrerequisUseCase = new VerifierPrerequisClotureUseCase(anneeRepository);
  const cloturerAnneeUseCase = new CloturerAnneeUseCase(anneeRepository, promotionRepository);
  const mettreAJourCalendrierUseCase = new MettreAJourCalendrierUseCase(anneeRepository);
  const proposerStructureAnneeSuivanteUseCase = new ProposerStructureAnneeSuivanteUseCase(
    anneeRepository, classeRepository, promotionRepository,
  );
  const validerStructureAnneeSuivanteUseCase = new ValiderStructureAnneeSuivanteUseCase(anneeRepository, classeRepository);
  const annulerStructureAnneeSuivanteUseCase = new AnnulerStructureProposeeUseCase(anneeRepository, classeRepository);

  // 14. Use Cases — AI
  const santeEleveRepository = new PrismaSanteEleveRepository(prisma);
  const groqIAService = new GroqIAService();
  const calculerIndiceSanteUseCase = new CalculerIndiceSanteUseCase(
    santeEleveRepository, groqIAService
  );

  // Infrastructure prédictive (Partie B du plan) — jamais branchée à un flux de production réel
  // (calculerIndiceSanteUseCase ci-dessus reste la seule voie réelle, via IndiceSanteRules
  // directement). Ces deux adapters existent pour être comparés via compareRisquePredictionsUseCase.
  const rulesBasedPredictionService = new RulesBasedPredictionService();
  const tabPfnPredictionService = new TabPfnPredictionService();
  const compareRisquePredictionsUseCase = new CompareRisquePredictionsUseCase(
    santeEleveRepository, rulesBasedPredictionService, tabPfnPredictionService
  );

  // 15. Use Cases — Parent + SchoolSettings
  const parentRepository = new PrismaParentRepository(prisma);
  const schoolSettingsRepository = new PrismaSchoolSettingsRepository(prisma);

  const obtenirEnfantsUseCase = new ObtenirEnfantsUseCase(parentRepository);
  const verifierAccesUseCase = new VerifierAccesEnfantUseCase(parentRepository);
  const obtenirAlertesSoldeUseCase = new ObtenirAlertesSoldeUseCase(parentRepository, factureRepository);
  const obtenirParametresUseCase = new ObtenirParametresEcoleUseCase(schoolSettingsRepository);
  const mettreAJourParametresUseCase = new MettreAJourParametresEcoleUseCase(schoolSettingsRepository);

  // 16. Use Cases — Orientation
  const orientationRepository = new PrismaOrientationRepository(prisma);
  const creerFicheOrientationUseCase = new CreerFicheOrientationUseCase(orientationRepository);
  const ajouterEntretienUseCase = new AjouterEntretienUseCase(orientationRepository);
  const ajouterTestAptitudeUseCase = new AjouterTestAptitudeUseCase(orientationRepository);
  const creerRecommandationSerieUseCase = new CreerRecommandationSerieUseCase(orientationRepository);
  const ajouterSuiviUseCase = new AjouterSuiviUseCase(orientationRepository);
  const listerFichesOrientationUseCase = new ListerFichesOrientationUseCase(orientationRepository);
  const getStatsOrientationUseCase = new GetStatsOrientationUseCase(orientationRepository);
  const saisirAspirationsEleveUseCase = new SaisirAspirationsEleveUseCase(orientationRepository);
  const genererRecommandationOrientationUseCase = new GenererRecommandationOrientationUseCase(prisma, orientationRepository);
  const validerRecommandationConseillerUseCase = new ValiderRecommandationConseillerUseCase(orientationRepository);
  const proposerRecommandationEleveUseCase = new ProposerRecommandationEleveUseCase(orientationRepository);
  const choisirPisteEleveUseCase = new ChoisirPisteEleveUseCase(orientationRepository);
  const listerElevesAOrienterUseCase = new ListerElevesAOrienterUseCase(prisma);
  const configurerCheckpointOrientationUseCase = new ConfigurerCheckpointOrientationUseCase(orientationRepository);

  // 17. Use Cases — MasterAdmin
  const inviterEcoleUseCase = new InviterEcoleUseCase(
    schoolRepository, invitationRepository, emailService
  );
  const suspendreEcoleUseCase = new SuspendreEcoleUseCase(schoolRepository, invitationRepository);
  const reactiverEcoleUseCase = new ReactiverEcoleUseCase(schoolRepository);
  const rejeterEcoleUseCase = new RejeterEcoleUseCase(schoolRepository, userRepository, emailService);
  const changerPlanUseCase = new ChangerPlanAbonnementUseCase(schoolRepository);
  const genererPaiementsMinesec = new GenererPaiementsMinesecUseCase(prisma);
  const creerSqueletteOnboarding = new CreerSqueletteOnboardingUseCase(prisma);

  return {
    grade: {
      saisirNote: saisirNoteUseCase,
      soumettreNote: soumettreNoteUseCase,
      validerNote: validerNoteUseCase,
      rejeterNote: rejeterNoteUseCase,
      validerEnBloc: validerEnBlocUseCase,
    },
    attendance: {
      enregistrerPresence: enregistrerPresenceUseCase,
    },
    school: {
      onboarder: onboarderEcoleUseCase,
      approuver: approuverEcoleUseCase,
    },
    reportCard: {
      generer: genererBulletinUseCase,
      envoyer: envoyerBulletinsUseCase,
    },
    classCouncil: {
      creerSession: creerSessionConseilUseCase,
      tenir: tenirConseilClasseUseCase,
      preparerVue: preparerVueConseilClasseUseCase,
      listerSessions: listerSessionsConseilUseCase,
      obtenirSession: obtenirSessionConseilUseCase,
      ajouterDecision: ajouterDecisionConseilUseCase,
      ajouterDecisionsEnBloc: ajouterDecisionsEnBlocUseCase,
      verrouiller: verrouillerConseilUseCase,
      publierBulletins: publierBulletinsConseilUseCase,
      genererPV: genererPVConseilUseCase,
      genererRapport: genererRapportConseilUseCase,
    },
    user: {
      connecter: connecterUtilisateurUseCase,
      inscrire: inscrireUtilisateurUseCase,
      rafraichir: rafraichirTokenUseCase,
      deconnecter: deconnecterUtilisateurUseCase,
      modifier: modifierUtilisateurUseCase,
      supprimer: supprimerUtilisateurUseCase,
      transferer: transfererEleveUseCase,
      importer: importerUtilisateursUseCase,
      tokenService,
      schoolRepository,
    },
    masterAdmin: {
      inviter: inviterEcoleUseCase,
      suspendre: suspendreEcoleUseCase,
      reactiver: reactiverEcoleUseCase,
      rejeter: rejeterEcoleUseCase,
      changerPlan: changerPlanUseCase,
    },
    class: {
      creer: creerClasseUseCase,
      modifier: modifierClasseUseCase,
      supprimer: supprimerClasseUseCase,
      assignerProfesseur: assignerProfesseurUseCase,
      creerSousGroupe: creerSousGroupeUseCase,
      assignerEleves: assignerElevesUseCase,
    },
    subject: {
      creer: creerMatiereUseCase,
      modifier: modifierMatiereUseCase,
      assignerEnseignant: assignerEnseignantUseCase,
      definirCoefficient: definirCoefficientUseCase,
      supprimer: supprimerMatiereUseCase,
    },
    room: {
      creer: creerSalleUseCase,
      modifier: modifierSalleUseCase,
      supprimer: supprimerSalleUseCase,
    },
    teacherUnavailability: {
      creer: creerIndisponibiliteEnseignantUseCase,
      modifier: modifierIndisponibiliteEnseignantUseCase,
      supprimer: supprimerIndisponibiliteEnseignantUseCase,
      lister: listerIndisponibilitesEnseignantUseCase,
    },
    studentGroup: {
      creerGroupSet: creerStudentGroupSetUseCase,
      modifierGroupSet: modifierStudentGroupSetUseCase,
      supprimerGroupSet: supprimerStudentGroupSetUseCase,
      creerGroup: creerStudentGroupUseCase,
      modifierGroup: modifierStudentGroupUseCase,
      supprimerGroup: supprimerStudentGroupUseCase,
      assignerSalleClasse: assignerSalleClasseUseCase,
      retirerAssignationSalle: retirerAssignationSalleUseCase,
    },
    timetable: {
      creer: creerEmploiDuTempsUseCase,
      ajouterCreneau: ajouterCreneauUseCase,
      modifierCreneau: modifierCreneauUseCase,
      publier: publierEmploiDuTempsUseCase,
      demanderRattrapage: demanderRattrapageUseCase,
      genererSeancesGroupe: genererSeancesGroupeUseCase,
      proposerEmploiDuTemps: proposerEmploiDuTempsUseCase,
      appliquerProposition: appliquerPropositionEmploiDuTempsUseCase,
      simulerEmploiDuTemps: simulerEmploiDuTempsUseCase,
      genererSquelette: genererSqueletteEmploiDuTempsUseCase,
    },
    academicYear: {
      creer: creerAnneeUseCase,
      definirPeriode: definirPeriodeUseCase,
      verifierPrerequis: verifierPrerequisUseCase,
      cloturer: cloturerAnneeUseCase,
      mettreAJourCalendrier: mettreAJourCalendrierUseCase,
      proposerStructureSuivante: proposerStructureAnneeSuivanteUseCase,
      validerStructureSuivante: validerStructureAnneeSuivanteUseCase,
      annulerStructureSuivante: annulerStructureAnneeSuivanteUseCase,
    },
    finance: {
      creerPlanFrais: creerPlanFraisUseCase,
      genererFacture: genererFactureUseCase,
      genererFacturesEnMasse: genererFacturesEnMasseUseCase,
      initierPaiement: initierPaiementUseCase,
      traiterWebhook: traiterWebhookUseCase,
      rembourserCaution: rembourserCautionUseCase,
      enregistrerDepense: enregistrerDepenseUseCase,
      enregistrerPaiementCash: enregistrerPaiementCashUseCase,
      copierPlansFraisAnneePrecedente: copierPlansFraisAnneePrecedenteUseCase,
      changerStatutPlanFrais: changerStatutPlanFraisUseCase,
      factureRepository,
    },
    ai: {
      calculerIndiceSante: calculerIndiceSanteUseCase,
    },
    prediction: {
      rulesService: rulesBasedPredictionService,
      tabpfnService: tabPfnPredictionService,
      comparerRisque: compareRisquePredictionsUseCase,
    },
    parent: {
      obtenirEnfants: obtenirEnfantsUseCase,
      verifierAcces: verifierAccesUseCase,
      obtenirAlertesSolde: obtenirAlertesSoldeUseCase,
    },
    schoolSettings: {
      obtenir: obtenirParametresUseCase,
      mettreAJour: mettreAJourParametresUseCase,
    },
    orientation: {
      creerFiche: creerFicheOrientationUseCase,
      ajouterEntretien: ajouterEntretienUseCase,
      ajouterTest: ajouterTestAptitudeUseCase,
      creerRecommandation: creerRecommandationSerieUseCase,
      ajouterSuivi: ajouterSuiviUseCase,
      listerFiches: listerFichesOrientationUseCase,
      getStats: getStatsOrientationUseCase,
      repo: orientationRepository,
      saisirAspiration: saisirAspirationsEleveUseCase,
      genererRecommandation: genererRecommandationOrientationUseCase,
      validerRecommandationConseiller: validerRecommandationConseillerUseCase,
      proposerRecommandationEleve: proposerRecommandationEleveUseCase,
      choisirPisteEleve: choisirPisteEleveUseCase,
      listerElevesAOrienter: listerElevesAOrienterUseCase,
      configurerCheckpoint: configurerCheckpointOrientationUseCase,
    },
    matricule: {
      importerMatricules: new ImporterMatriculesUseCase(prisma),
      verifierMatricule: new VerifierMatriculeUseCase(prisma, new CarteScolaireScrapingAdapter()),
      syncFromCarteScolaire: new SyncFromCarteScolaireUseCase(prisma, new CarteScolaireScrapingAdapter()),
      verifierRecu: new VerifierRecuUseCase(prisma, new CarteScolaireScrapingAdapter()),
      confirmerFuzzy: new ConfirmerCorrespondanceFuzzyUseCase(prisma),
      signalerErreur: new SignalerErreurCarteScolaireUseCase(prisma),
    },
    eleveOnboarding: {
      creerSquelette: creerSqueletteOnboarding,
      soumettreFormulaire: new SoumettreFormulaireOnboardingUseCase(prisma),
      valider: new ValiderOnboardingUseCase(prisma),
      rejeter: new RejeterOnboardingUseCase(prisma),
    },
    statisticalCampaign: {
      verifierCompletude: new VerifierCompletudeSupplementUseCase(prisma),
      genererDeclaration: new GenererDeclarationStatistiqueMinesecUseCase(prisma, new VerifierCompletudeSupplementUseCase(prisma)),
    },
    statisticalCampaignMinedub: {
      genererRapport: new GenererRapportSyntheseMinedubUseCase(prisma),
    },
    paiementMinesec: {
      genererPaiements: genererPaiementsMinesec,
      genererPaiementsEcole: new GenererPaiementsMinesecPourEcoleUseCase(prisma, genererPaiementsMinesec),
      getDashboard: new GetStudentPaymentDashboardUseCase(prisma),
      getOverview: new GetSchoolPaymentOverviewUseCase(prisma),
    },
    examen: {
      prepareDossier: new PrepareExamDossierUseCase(prisma),
    },
    lv2Choice: {
      ouvrirFenetre: new OuvrirFenetreChoixLV2UseCase(prisma),
      soumettreChoix: new SoumettreChoixLV2EleveUseCase(prisma),
      saisirManuel: new SaisirChoixLV2ManuelUseCase(prisma),
      appliquerChoix: new AppliquerChoixLV2UseCase(prisma, studentGroupSetRepository, studentGroupRepository, studentGroupMembershipRepository),
      suivreFenetre: new SuivreFenetreChoixLV2UseCase(prisma),
    },
    entranceExam: {
      creerSession: new CreerSessionConcoursUseCase(prisma),
      ajouterCandidats: new AjouterCandidatsConcoursUseCase(prisma),
      calculerAdmission: new CalculerAdmissionConcoursUseCase(prisma),
      enregistrerCep: new EnregistrerResultatCepUseCase(prisma, creerSqueletteOnboarding),
      resumeSession: new ResumeSessionConcoursUseCase(prisma),
      scannerListe: new ScannerListeCandidatsUseCase(prisma),
      detecterAnomalies: new DetecterAnomaliesConcoursUseCase(prisma),
    },
    pebsExam: {
      creerSession: new CreerSessionPebsUseCase(prisma),
      ajouterCandidats: new AjouterCandidatsPebsUseCase(prisma),
      calculerSelection: new CalculerSelectionPebsUseCase(prisma),
      appliquerTransfert: new AppliquerTransfertPebsUseCase(prisma, studentGroupSetRepository, studentGroupRepository, studentGroupMembershipRepository),
      resumeSession: new ResumeSessionPebsUseCase(prisma),
      scannerListe: new ScannerListeCandidatsPebsUseCase(prisma),
      detecterAnomalies: new DetecterAnomaliesPebsUseCase(prisma),
    },
    pushNotification: {
      souscrire: new SouscrirePushUseCase(prisma),
      desinscrire: new DesinscrirePushUseCase(prisma),
    },
    notification: {
      service: notificationService,
    },
  };
}

export type Container = ReturnType<typeof creerContainer>;
