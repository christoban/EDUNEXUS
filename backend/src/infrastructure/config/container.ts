/**
 * INFRASTRUCTURE LAYER — Container d'injection de dépendances EduNexus
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

// --- Use Cases : Bulletins ---
import { GenererBulletinUseCase } from '@application/reportCard/GenererBulletinUseCase';
import { EnvoyerBulletinsUseCase } from '@application/reportCard/EnvoyerBulletinsUseCase';

// --- Use Cases : Conseil de Classe ---
import { TenirConseilClasseUseCase } from '@application/classCouncil/TenirConseilClasseUseCase';

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

// --- Adapters Persistence Classe + Matière ---
import { PrismaSousGroupeRepository } from '@infrastructure/persistence/prisma/PrismaSousGroupeRepository';

// --- Adapters Persistence AnneeAcademique + Promotion ---
import { PrismaPromotionRepository } from '@infrastructure/persistence/prisma/PrismaPromotionRepository';

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

  // 5. Use Cases — Présences
  const enregistrerPresenceUseCase = new EnregistrerPresenceUseCase(
    presenceRepository, userRepository, notificationService
  );

  // 6. Use Cases — School
  const onboarderEcoleUseCase = new OnboarderEcoleUseCase(
    schoolRepository, userRepository, emailService
  );
  const approuverEcoleUseCase = new ApprouverEcoleUseCase(
    schoolRepository, userRepository, anneeRepository, emailService
  );

  // 7. Use Cases — Bulletins
  const genererBulletinUseCase = new GenererBulletinUseCase(
    noteRepository, bulletinRepository, classeRepository,
    userRepository, matiereRepository, anneeRepository,
    presenceRepository, pdfService
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

  // 12. Use Cases — AnneeAcademique
  const promotionRepository = new PrismaPromotionRepository(prisma);

  const creerAnneeUseCase = new CreerAnneeAcademiqueUseCase(anneeRepository);
  const definirPeriodeUseCase = new DefinirPeriodeCouranteUseCase(anneeRepository);
  const verifierPrerequisUseCase = new VerifierPrerequisClotureUseCase(anneeRepository);
  const cloturerAnneeUseCase = new CloturerAnneeUseCase(anneeRepository, promotionRepository);
  const mettreAJourCalendrierUseCase = new MettreAJourCalendrierUseCase(anneeRepository);

  // 13. Use Cases — MasterAdmin
  const inviterEcoleUseCase = new InviterEcoleUseCase(
    schoolRepository, invitationRepository, emailService
  );
  const suspendreEcoleUseCase = new SuspendreEcoleUseCase(schoolRepository, invitationRepository);
  const reactiverEcoleUseCase = new ReactiverEcoleUseCase(schoolRepository);
  const rejeterEcoleUseCase = new RejeterEcoleUseCase(schoolRepository, userRepository, emailService);
  const changerPlanUseCase = new ChangerPlanAbonnementUseCase(schoolRepository);

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
    },
  };
}

export type Container = ReturnType<typeof creerContainer>;
