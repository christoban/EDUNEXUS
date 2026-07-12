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

// --- Adapters Persistence ---
import { PrismaUserRepository } from '@infrastructure/persistence/prisma/PrismaUserRepository';
import { PrismaSchoolRepository } from '@infrastructure/persistence/prisma/PrismaSchoolRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaNoteRepository } from '@infrastructure/persistence/prisma/PrismaNoteRepository';
import { PrismaPresenceRepository } from '@infrastructure/persistence/prisma/PrismaPresenceRepository';
import { PrismaBulletinRepository } from '@infrastructure/persistence/prisma/PrismaBulletinRepository';
import { PrismaMatiereRepository } from '@infrastructure/persistence/prisma/PrismaMatiereRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';

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

// --- Use Cases : Matricule ---
import { ImporterMatriculesUseCase } from '@application/matricule/ImporterMatriculesUseCase';
import { VerifierMatriculeUseCase } from '@application/matricule/VerifierMatriculeUseCase';
import { SyncFromCarteScolaireUseCase } from '@application/matricule/SyncFromCarteScolaireUseCase';
import { VerifierRecuUseCase } from '@application/matricule/VerifierRecuUseCase';
import { ConfirmerCorrespondanceFuzzyUseCase } from '@application/matricule/ConfirmerCorrespondanceFuzzyUseCase';
import { SignalerErreurCarteScolaireUseCase } from '@application/matricule/SignalerErreurCarteScolaireUseCase';
import { CarteScolaireScrapingAdapter } from '@infrastructure/services/CarteScolaireScrapingAdapter';

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

// --- Use Cases : PEBS Exam ---
import { CreerSessionPebsUseCase } from '@application/pebsExam/CreerSessionPebsUseCase';
import { AjouterCandidatsPebsUseCase } from '@application/pebsExam/AjouterCandidatsPebsUseCase';
import { CalculerSelectionPebsUseCase } from '@application/pebsExam/CalculerSelectionPebsUseCase';
import { AppliquerTransfertPebsUseCase } from '@application/pebsExam/AppliquerTransfertPebsUseCase';
import { ResumeSessionPebsUseCase } from '@application/pebsExam/ResumeSessionPebsUseCase';
import { ScannerListeCandidatsPebsUseCase } from '@application/pebsExam/ScannerListeCandidatsPebsUseCase';
import { DetecterAnomaliesPebsUseCase } from '@application/pebsExam/DetecterAnomaliesPebsUseCase';

// --- Adapters Services ---
import { NodemailerEmailService } from '@infrastructure/services/NodemailerEmailService';
import { SocketNotificationService } from '@infrastructure/services/SocketNotificationService';
import { PdfKitBulletinService } from '@infrastructure/services/PdfKitBulletinService';
import { JwtTokenService } from '@infrastructure/services/JwtTokenService';

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
import { CampayPaiementService } from '@infrastructure/services/CampayPaiementService';

// --- Use Cases : Finance ---
import { CreerPlanFraisUseCase } from '@application/finance/CreerPlanFraisUseCase';
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

// --- Adapter Service IA ---
import { GroqIAService } from '@infrastructure/services/GroqIAService';

// --- Use Cases : AI ---
import { CalculerIndiceSanteUseCase } from '@application/ai/CalculerIndiceSanteUseCase';

// --- Adapters Persistence Parent + SchoolSettings ---
import { PrismaParentRepository } from '@infrastructure/persistence/prisma/PrismaParentRepository';
import { PrismaSchoolSettingsRepository } from '@infrastructure/persistence/prisma/PrismaSchoolSettingsRepository';

// --- Use Cases : Parent ---
import { ObtenirEnfantsUseCase } from '@application/parent/ObtenirEnfantsUseCase';
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

// --- Use Cases : AnneeAcademique ---
import { CreerAnneeAcademiqueUseCase } from '@application/academicYear/CreerAnneeAcademiqueUseCase';
import { DefinirPeriodeCouranteUseCase } from '@application/academicYear/DefinirPeriodeCouranteUseCase';
import { VerifierPrerequisClotureUseCase } from '@application/academicYear/VerifierPrerequisClotureUseCase';
import { CloturerAnneeUseCase } from '@application/academicYear/CloturerAnneeUseCase';
import { MettreAJourCalendrierUseCase } from '@application/academicYear/MettreAJourCalendrierUseCase';

// --- Use Cases : Classe ---
import { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
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
  // 1. Client Prisma (singleton)
  const prisma = new PrismaClient();

  // 2. Repositories
  const userRepository = new PrismaUserRepository(prisma);
  const schoolRepository = new PrismaSchoolRepository(prisma);
  const classeRepository = new PrismaClasseRepository(prisma);
  const noteRepository = new PrismaNoteRepository(prisma);
  const presenceRepository = new PrismaPresenceRepository(prisma);
  const bulletinRepository = new PrismaBulletinRepository(prisma);
  const matiereRepository = new PrismaMatiereRepository(prisma);
  const anneeRepository = new PrismaAnneeAcademiqueRepository(prisma);

  // 3. Services (adaptateurs réels)
  const emailService = new NodemailerEmailService();
  const notificationService = new SocketNotificationService();
  const pdfService = new PdfKitBulletinService();

  // 4. Use Cases — Notes
  const saisirNoteUseCase = new SaisirNoteUseCase(
    noteRepository, matiereRepository, userRepository
  );
  const soumettreNoteUseCase = new SoumettreNoteUseCase(noteRepository);
  const validerNoteUseCase = new ValiderNoteUseCase(noteRepository, userRepository);
  const rejeterNoteUseCase = new RejeterNoteUseCase(
    noteRepository, userRepository, notificationService
  );
  const validerEnBlocUseCase = new ValiderEnBlocUseCase(noteRepository, userRepository);

  // 5. Use Cases — Import
  const importerUtilisateursUseCase = new ImporterUtilisateursUseCase(
    prisma, userRepository
  );

  // 6. Use Cases — Présences
  const enregistrerPresenceUseCase = new EnregistrerPresenceUseCase(
    presenceRepository, userRepository, notificationService
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

  const genererBulletinUseCase = new GenererBulletinUseCase(
    noteRepository, bulletinRepository, classeRepository,
    userRepository, matiereRepository, anneeRepository,
    presenceRepository, pdfService, classCouncilRepository, prisma
  );
  const envoyerBulletinsUseCase = new EnvoyerBulletinsUseCase(
    bulletinRepository, userRepository, emailService
  );

  // 8. Use Cases — Conseil de Classe
  const tenirConseilClasseUseCase = new TenirConseilClasseUseCase(
    noteRepository, classeRepository, userRepository
  );

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

  // 11. Use Cases — Classe + Matière
  const sousGroupeRepository = new PrismaSousGroupeRepository(prisma);

  const creerClasseUseCase = new CreerClasseUseCase(classeRepository);
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

  // 12. Use Cases — Timetable
  const timetableRepository = new PrismaTimetableRepository(prisma);

  const creerEmploiDuTempsUseCase = new CreerEmploiDuTempsUseCase(timetableRepository);
  const ajouterCreneauUseCase = new AjouterCreneauUseCase(timetableRepository);
  const modifierCreneauUseCase = new ModifierCreneauUseCase(timetableRepository);
  const publierEmploiDuTempsUseCase = new PublierEmploiDuTempsUseCase(timetableRepository);
  const demanderRattrapageUseCase = new DemanderRattrapageUseCase(
    userRepository,
    notificationService,
  );

  // 13. Use Cases — AnneeAcademique
  const promotionRepository = new PrismaPromotionRepository(prisma);

  const creerAnneeUseCase = new CreerAnneeAcademiqueUseCase(anneeRepository);
  const definirPeriodeUseCase = new DefinirPeriodeCouranteUseCase(anneeRepository);
  const verifierPrerequisUseCase = new VerifierPrerequisClotureUseCase(anneeRepository);
  const cloturerAnneeUseCase = new CloturerAnneeUseCase(anneeRepository, promotionRepository);
  const mettreAJourCalendrierUseCase = new MettreAJourCalendrierUseCase(anneeRepository);

  // 14. Use Cases — AI
  const santeEleveRepository = new PrismaSanteEleveRepository(prisma);
  const groqIAService = new GroqIAService();
  const calculerIndiceSanteUseCase = new CalculerIndiceSanteUseCase(
    santeEleveRepository, groqIAService
  );

  // 15. Use Cases — Parent + SchoolSettings
  const parentRepository = new PrismaParentRepository(prisma);
  const schoolSettingsRepository = new PrismaSchoolSettingsRepository(prisma);

  const obtenirEnfantsUseCase = new ObtenirEnfantsUseCase(parentRepository);
  const verifierAccesUseCase = new VerifierAccesEnfantUseCase(parentRepository);
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

  // 17. Use Cases — MasterAdmin
  const inviterEcoleUseCase = new InviterEcoleUseCase(
    schoolRepository, invitationRepository, emailService
  );
  const suspendreEcoleUseCase = new SuspendreEcoleUseCase(schoolRepository, invitationRepository);
  const reactiverEcoleUseCase = new ReactiverEcoleUseCase(schoolRepository);
  const rejeterEcoleUseCase = new RejeterEcoleUseCase(schoolRepository, userRepository, emailService);
  const changerPlanUseCase = new ChangerPlanAbonnementUseCase(schoolRepository);
  const genererPaiementsMinesec = new GenererPaiementsMinesecUseCase(prisma);

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
      tenir: tenirConseilClasseUseCase,
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
    timetable: {
      creer: creerEmploiDuTempsUseCase,
      ajouterCreneau: ajouterCreneauUseCase,
      modifierCreneau: modifierCreneauUseCase,
      publier: publierEmploiDuTempsUseCase,
      demanderRattrapage: demanderRattrapageUseCase,
    },
    academicYear: {
      creer: creerAnneeUseCase,
      definirPeriode: definirPeriodeUseCase,
      verifierPrerequis: verifierPrerequisUseCase,
      cloturer: cloturerAnneeUseCase,
      mettreAJourCalendrier: mettreAJourCalendrierUseCase,
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
      factureRepository,
    },
    ai: {
      calculerIndiceSante: calculerIndiceSanteUseCase,
    },
    parent: {
      obtenirEnfants: obtenirEnfantsUseCase,
      verifierAcces: verifierAccesUseCase,
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
    },
    matricule: {
      importerMatricules: new ImporterMatriculesUseCase(prisma),
      verifierMatricule: new VerifierMatriculeUseCase(prisma, new CarteScolaireScrapingAdapter()),
      syncFromCarteScolaire: new SyncFromCarteScolaireUseCase(prisma, new CarteScolaireScrapingAdapter()),
      verifierRecu: new VerifierRecuUseCase(prisma, new CarteScolaireScrapingAdapter()),
      confirmerFuzzy: new ConfirmerCorrespondanceFuzzyUseCase(prisma),
      signalerErreur: new SignalerErreurCarteScolaireUseCase(prisma),
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
      appliquerChoix: new AppliquerChoixLV2UseCase(prisma),
      suivreFenetre: new SuivreFenetreChoixLV2UseCase(prisma),
    },
    entranceExam: {
      creerSession: new CreerSessionConcoursUseCase(prisma),
      ajouterCandidats: new AjouterCandidatsConcoursUseCase(prisma),
      calculerAdmission: new CalculerAdmissionConcoursUseCase(prisma),
      enregistrerCep: new EnregistrerResultatCepUseCase(prisma),
      resumeSession: new ResumeSessionConcoursUseCase(prisma),
      scannerListe: new ScannerListeCandidatsUseCase(prisma),
      detecterAnomalies: new DetecterAnomaliesConcoursUseCase(prisma),
    },
    pebsExam: {
      creerSession: new CreerSessionPebsUseCase(prisma),
      ajouterCandidats: new AjouterCandidatsPebsUseCase(prisma),
      calculerSelection: new CalculerSelectionPebsUseCase(prisma),
      appliquerTransfert: new AppliquerTransfertPebsUseCase(prisma),
      resumeSession: new ResumeSessionPebsUseCase(prisma),
      scannerListe: new ScannerListeCandidatsPebsUseCase(prisma),
      detecterAnomalies: new DetecterAnomaliesPebsUseCase(prisma),
    },
  };
}

export type Container = ReturnType<typeof creerContainer>;
