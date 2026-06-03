# Arborescence du Backend EDUNEXUS

```
backend/
├── .env
├── .gitignore
├── ARBORESCENCE.md
├── README.md
├── README_ACCESS_POLICY.md
├── README_PROJECT.md
├── bun.lock
├── create-admin.ts
├── create-schools.ps1
├── package.json
├── prisma.config.ts
├── tsconfig.json
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│       ├── migration_lock.toml
│       ├── complete_schema_v2/
│       │   └── migration.sql
│       ├── complete_schema_v3/
│       │   └── migration.sql
│       ├── fix_bac_coefficients_nullable/
│       │   └── migration.sql
│       ├── phase0_schema_complete/
│       │   └── migration.sql
│       ├── zz_revert_timetable_unique/
│       │   └── migration.sql
│       ├── 20260501000000_complete_schema_v2_baseline/
│       │   └── migration.sql
│       ├── 20260507111020_add_master_user_mfa_and_auth_fields/
│       │   └── migration.sql
│       ├── 20260516124536_phase0_schema_complete/
│       │   └── migration.sql
│       ├── 20260517005855_add_refresh_token_version/
│       │   └── migration.sql
│       ├── 20260517010223_verify_migrations/
│       │   └── migration.sql
│       ├── 20260517120000_add-refresh-token-version/
│       │   └── migration.sql
│       ├── 20260518000000_add_sequence_calculation_mode_and_legal_thresholds/
│       │   └── migration.sql
│       ├── 20260518193116_add_professor_principal_if_missing/
│       │   └── migration.sql
│       ├── 20260524000000_add_draft_to_school_status/
│       │   └── migration.sql
│       └── 20260603000000_fix_school_config_minesec/
│           └── migration.sql
│
└── src/
    ├── server.ts
    │
    ├── application/
    │   ├── academicYear/
    │   │   ├── index.ts
    │   │   ├── CloturerAnneeUseCase.ts
    │   │   ├── CreerAnneeAcademiqueUseCase.ts
    │   │   ├── DefinirPeriodeCouranteUseCase.ts
    │   │   ├── MettreAJourCalendrierUseCase.ts
    │   │   ├── VerifierPrerequisClotureUseCase.ts
    │   │   └── __tests__/
    │   │       ├── CloturerAnneeUseCase.test.ts
    │   │       ├── CreerAnneeAcademiqueUseCase.test.ts
    │   │       ├── VerifierPrerequisClotureUseCase.test.ts
    │   │       └── helpers/
    │   │           ├── InMemoryAnneeAcademiqueRepository.ts
    │   │           └── InMemoryPromotionRepository.ts
    │   │
    │   ├── ai/
    │   │   ├── .gitkeep
    │   │   ├── index.ts
    │   │   ├── CalculerIndiceSanteUseCase.ts
    │   │   └── __tests__/
    │   │       ├── CalculerIndiceSanteUseCase.test.ts
    │   │       └── helpers/
    │   │           ├── FakeIAService.ts
    │   │           └── InMemorySanteEleveRepository.ts
    │   │
    │   ├── attendance/
    │   │   ├── .gitkeep
    │   │   ├── index.ts
    │   │   ├── EnregistrerPresenceUseCase.ts
    │   │   └── __tests__/
    │   │       ├── EnregistrerPresenceUseCase.test.ts
    │   │       └── helpers/
    │   │           ├── InMemoryNotificationService.ts
    │   │           ├── InMemoryPresenceRepository.ts
    │   │           └── InMemoryUserRepository.ts
    │   │
    │   ├── class/
    │   │   ├── index.ts
    │   │   ├── AssignerElevesAuSousGroupeUseCase.ts
    │   │   ├── AssignerProfesseurPrincipalUseCase.ts
    │   │   ├── CreerClasseUseCase.ts
    │   │   ├── CreerSousGroupeTPUseCase.ts
    │   │   ├── ModifierClasseUseCase.ts
    │   │   ├── SupprimerClasseUseCase.ts
    │   │   └── __tests__/
    │   │       ├── AssignerProfesseurPrincipalUseCase.test.ts
    │   │       ├── CreerClasseUseCase.test.ts
    │   │       └── helpers/
    │   │           ├── InMemoryClasseRepository.ts
    │   │           └── InMemorySousGroupeRepository.ts
    │   │
    │   ├── classCouncil/
    │   │   ├── .gitkeep
    │   │   ├── index.ts
    │   │   ├── TenirConseilClasseUseCase.ts
    │   │   └── __tests__/
    │   │       ├── TenirConseilClasseUseCase.test.ts
    │   │       └── helpers/
    │   │           ├── InMemoryClasseRepository.ts
    │   │           ├── InMemoryNoteRepository.ts
    │   │           └── InMemoryUserRepository.ts
    │   │
    │   ├── exam/
    │   │   ├── index.ts
    │   │   ├── CreerExamenUseCase.ts
    │   │   ├── SoumettreReponseUseCase.ts
    │   │   └── __tests__/
    │   │       ├── SoumettreReponseUseCase.test.ts
    │   │       └── helpers/
    │   │           └── InMemoryExamenRepository.ts
    │   │
    │   ├── finance/
    │   │   ├── .gitkeep
    │   │   ├── index.ts
    │   │   ├── CreerPlanFraisUseCase.ts
    │   │   ├── EnregistrerDepenseUseCase.ts
    │   │   ├── GenererFactureUseCase.ts
    │   │   ├── GenererFacturesEnMasseUseCase.ts
    │   │   ├── InitierPaiementMobileMoneyUseCase.ts
    │   │   ├── RembourserCautionUseCase.ts
    │   │   ├── TraiterWebhookCampayUseCase.ts
    │   │   └── __tests__/
    │   │       ├── CreerPlanFraisUseCase.test.ts
    │   │       ├── EnregistrerDepenseUseCase.test.ts
    │   │       ├── RembourserCautionUseCase.test.ts
    │   │       ├── TraiterWebhookCampayUseCase.test.ts
    │   │       └── helpers/
    │   │           ├── FakePaiementService.ts
    │   │           ├── InMemoryDepenseRepository.ts
    │   │           ├── InMemoryFactureRepository.ts
    │   │           ├── InMemoryPaiementRepository.ts
    │   │           └── InMemoryPlanFraisRepository.ts
    │   │
    │   ├── grade/
    │   │   ├── .gitkeep
    │   │   ├── index.ts
    │   │   ├── RejeterNoteUseCase.ts
    │   │   ├── SaisirNoteUseCase.ts
    │   │   ├── SoumettreNoteUseCase.ts
    │   │   ├── ValiderEnBlocUseCase.ts
    │   │   ├── ValiderNoteUseCase.ts
    │   │   └── __tests__/
    │   │       ├── SaisirNoteUseCase.test.ts
    │   │       ├── ValiderNoteUseCase.test.ts
    │   │       └── helpers/
    │   │           ├── InMemoryMatiereRepository.ts
    │   │           ├── InMemoryNoteRepository.ts
    │   │           └── InMemoryUserRepository.ts
    │   │
    │   ├── masterAdmin/
    │   │   ├── index.ts
    │   │   ├── ChangerPlanAbonnementUseCase.ts
    │   │   ├── InviterEcoleUseCase.ts
    │   │   ├── ReactiverEcoleUseCase.ts
    │   │   ├── RejeterEcoleUseCase.ts
    │   │   ├── SuspendreEcoleUseCase.ts
    │   │   └── __tests__/
    │   │       ├── InviterEcoleUseCase.test.ts
    │   │       ├── SuspendreReactiverEcoleUseCase.test.ts
    │   │       └── helpers/
    │   │           └── FakeEmailService.ts
    │   │
    │   ├── messaging/
    │   │   └── .gitkeep
    │   │
    │   ├── parent/
    │   │   ├── index.ts
    │   │   ├── ObtenirEnfantsUseCase.ts
    │   │   └── VerifierAccesEnfantUseCase.ts
    │   │
    │   ├── reportCard/
    │   │   ├── .gitkeep
    │   │   ├── index.ts
    │   │   ├── EnvoyerBulletinsUseCase.ts
    │   │   ├── GenererBulletinUseCase.ts
    │   │   └── __tests__/
    │   │       ├── GenererBulletinUseCase.test.ts
    │   │       └── helpers/
    │   │           ├── InMemoryAnneeAcademiqueRepository.ts
    │   │           ├── InMemoryBulletinRepository.ts
    │   │           ├── InMemoryClasseRepository.ts
    │   │           ├── InMemoryMatiereRepository.ts
    │   │           ├── InMemoryNoteRepository.ts
    │   │           ├── InMemoryPdfService.ts
    │   │           ├── InMemoryPresenceRepository.ts
    │   │           └── InMemoryUserRepository.ts
    │   │
    │   ├── school/
    │   │   ├── .gitkeep
    │   │   ├── index.ts
    │   │   ├── ApprouverEcoleUseCase.ts
    │   │   ├── OnboarderEcoleUseCase.ts
    │   │   └── __tests__/
    │   │       ├── OnboarderEcoleUseCase.test.ts
    │   │       └── helpers/
    │   │           ├── InMemoryEmailService.ts
    │   │           ├── InMemorySchoolRepository.ts
    │   │           └── InMemoryUserRepository.ts
    │   │
    │   ├── schoolSettings/
    │   │   ├── index.ts
    │   │   ├── MettreAJourParametresEcoleUseCase.ts
    │   │   └── ObtenirParametresEcoleUseCase.ts
    │   │
    │   ├── subject/
    │   │   ├── index.ts
    │   │   ├── AssignerEnseignantMatiereUseCase.ts
    │   │   ├── CreerMatiereUseCase.ts
    │   │   ├── DefinirCoefficientUseCase.ts
    │   │   ├── ModifierMatiereUseCase.ts
    │   │   └── __tests__/
    │   │       ├── CreerMatiereUseCase.test.ts
    │   │       ├── DefinirCoefficientUseCase.test.ts
    │   │       └── helpers/
    │   │           └── InMemoryMatiereRepository.ts
    │   │
    │   ├── timetable/
    │   │   ├── index.ts
    │   │   ├── AjouterCreneauUseCase.ts
    │   │   ├── CreerEmploiDuTempsUseCase.ts
    │   │   ├── DemanderRattrapageUseCase.ts
    │   │   ├── ModifierCreneauUseCase.ts
    │   │   ├── PublierEmploiDuTempsUseCase.ts
    │   │   └── __tests__/
    │   │       ├── AjouterCreneauUseCase.test.ts
    │   │       ├── PublierEmploiDuTempsUseCase.test.ts
    │   │       └── helpers/
    │   │           └── InMemoryTimetableRepository.ts
    │   │
    │   └── user/
    │       ├── .gitkeep
    │       ├── index.ts
    │       ├── ConnecterUtilisateurUseCase.ts
    │       ├── DeconnecterUtilisateurUseCase.ts
    │       ├── InscrireUtilisateurUseCase.ts
    │       ├── ModifierUtilisateurUseCase.ts
    │       ├── RafraichirTokenUseCase.ts
    │       ├── SupprimerUtilisateurUseCase.ts
    │       ├── TransfererEleveUseCase.ts
    │       └── __tests__/
    │           ├── ConnecterUtilisateurUseCase.test.ts
    │           ├── InscrireUtilisateurUseCase.test.ts
    │           └── helpers/
    │               ├── FakeEmailService.ts
    │               ├── FakeTokenService.ts
    │               ├── InMemoryInvitationRepository.ts
    │               ├── InMemorySchoolRepository.ts
    │               └── InMemoryUserRepository.ts
    │
    ├── config/
    │   └── prisma.ts
    │
    ├── controllers/
    │   ├── activitieslog.ts
    │   ├── ai.ts
    │   ├── coreDomain.ts
    │   ├── dashboard.ts
    │   ├── emailLog.ts
    │   ├── exam.ts
    │   ├── parent.ts
    │   ├── schoolSettings.ts
    │   └── search.ts
    │
    ├── domain/
    │   ├── constants/
    │   │   └── SystemeEducatifCameroun.ts
    │   │
    │   ├── entities/
    │   │   ├── .gitkeep
    │   │   ├── index.ts
    │   │   ├── Bulletin.ts
    │   │   ├── Classe.ts
    │   │   ├── CreneauHoraire.ts
    │   │   ├── Depense.ts
    │   │   ├── EmploiDuTemps.ts
    │   │   ├── Facture.ts
    │   │   ├── Note.ts
    │   │   ├── Paiement.ts
    │   │   ├── PlanFrais.ts
    │   │   ├── Presence.ts
    │   │   ├── School.ts
    │   │   ├── User.ts
    │   │   └── __tests__/
    │   │       └── CreneauHoraire.test.ts
    │   │
    │   ├── errors/
    │   │   ├── .gitkeep
    │   │   ├── index.ts
    │   │   ├── BulletinBloqueError.ts
    │   │   ├── ConflitHoraireError.ts
    │   │   ├── ConseilBloqueError.ts
    │   │   ├── ExclusionNonAutoriseeError.ts
    │   │   ├── NoteValideeSyncError.ts
    │   │   ├── SeparationOrdonnateurError.ts
    │   │   ├── SeuilLegalDepasseError.ts
    │   │   └── VolumeHoraireAPError.ts
    │   │
    │   ├── ports/
    │   │   ├── repositories/
    │   │   │   ├── .gitkeep
    │   │   │   ├── index.ts
    │   │   │   ├── AnneeAcademiqueRepository.ts
    │   │   │   ├── BulletinRepository.ts
    │   │   │   ├── ClasseRepository.ts
    │   │   │   ├── DepenseRepository.ts
    │   │   │   ├── ExamenRepository.ts
    │   │   │   ├── FactureRepository.ts
    │   │   │   ├── InvitationRepository.ts
    │   │   │   ├── MatiereRepository.ts
    │   │   │   ├── NoteRepository.ts
    │   │   │   ├── PaiementRepository.ts
    │   │   │   ├── ParentRepository.ts
    │   │   │   ├── PlanFraisRepository.ts
    │   │   │   ├── PresenceRepository.ts
    │   │   │   ├── PromotionRepository.ts
    │   │   │   ├── SanteEleveRepository.ts
    │   │   │   ├── SchoolRepository.ts
    │   │   │   ├── SchoolSettingsRepository.ts
    │   │   │   ├── SousGroupeRepository.ts
    │   │   │   ├── TimetableRepository.ts
    │   │   │   └── UserRepository.ts
    │   │   │
    │   │   └── services/
    │   │       ├── .gitkeep
    │   │       ├── index.ts
    │   │       ├── EmailService.ts
    │   │       ├── IAService.ts
    │   │       ├── NotificationService.ts
    │   │       ├── PaiementService.ts
    │   │       ├── PdfService.ts
    │   │       ├── SmsService.ts
    │   │       └── TokenService.ts
    │   │
    │   ├── rules/
    │   │   ├── .gitkeep
    │   │   ├── BulletinPolicy.ts
    │   │   ├── CoreDomainDefaults.ts
    │   │   ├── GradingEngine.ts
    │   │   └── StaffPermissionRules.ts
    │   │
    │   ├── types/
    │   │   └── enums.ts
    │   │
    │   └── value-objects/
    │       ├── .gitkeep
    │       └── SerieBAC.ts
    │
    ├── infrastructure/
    │   ├── config/
    │   │   ├── .gitkeep
    │   │   ├── app.ts
    │   │   ├── container.ts
    │   │   └── hexagonal.bootstrap.ts
    │   │
    │   ├── http/
    │   │   ├── controllers/
    │   │   │   ├── .gitkeep
    │   │   │   ├── AcademicYearController.ts
    │   │   │   ├── AttendanceController.ts
    │   │   │   ├── ClassCouncilController.ts
    │   │   │   ├── ClasseController.ts
    │   │   │   ├── FinanceController.ts
    │   │   │   ├── GradeController.ts
    │   │   │   ├── MasterAdminHexController.ts
    │   │   │   ├── ReportCardController.ts
    │   │   │   ├── SchoolOnboardingController.ts
    │   │   │   ├── SubjectController.ts
    │   │   │   ├── TimetableController.ts
    │   │   │   └── UserController.ts
    │   │   │
    │   │   ├── dto/
    │   │   │   ├── .gitkeep
    │   │   │   └── grade.dto.ts
    │   │   │
    │   │   ├── middlewares/
    │   │   │   ├── .gitkeep
    │   │   │   └── errorHandler.ts
    │   │   │
    │   │   └── routes/
    │   │       ├── .gitkeep
    │   │       ├── academicYear.routes.ts
    │   │       ├── attendance.routes.ts
    │   │       ├── classCouncil.routes.ts
    │   │       ├── classe.routes.ts
    │   │       ├── finance.routes.ts
    │   │       ├── grade.routes.ts
    │   │       ├── masterAdminHex.routes.ts
    │   │       ├── onboarding.routes.ts
    │   │       ├── reportCard.routes.ts
    │   │       ├── subject.routes.ts
    │   │       ├── timetable.routes.ts
    │   │       └── user.routes.ts
    │   │
    │   ├── inngest/
    │   │   └── .gitkeep
    │   │
    │   ├── pdf/
    │   │   └── templates/
    │   │       └── .gitkeep
    │   │
    │   ├── persistence/
    │   │   ├── memory/
    │   │   │   └── .gitkeep
    │   │   └── prisma/
    │   │       ├── .gitkeep
    │   │       ├── prisma.client.ts
    │   │       ├── PrismaAnneeAcademiqueRepository.ts
    │   │       ├── PrismaBulletinRepository.ts
    │   │       ├── PrismaClasseRepository.ts
    │   │       ├── PrismaDepenseRepository.ts
    │   │       ├── PrismaExamenRepository.ts
    │   │       ├── PrismaFactureRepository.ts
    │   │       ├── PrismaInvitationRepository.ts
    │   │       ├── PrismaMatiereRepository.ts
    │   │       ├── PrismaNoteRepository.ts
    │   │       ├── PrismaPaiementRepository.ts
    │   │       ├── PrismaPlanFraisRepository.ts
    │   │       ├── PrismaPresenceRepository.ts
    │   │       ├── PrismaPromotionRepository.ts
    │   │       ├── PrismaSanteEleveRepository.ts
    │   │       ├── PrismaSchoolRepository.ts
    │   │       ├── PrismaSousGroupeRepository.ts
    │   │       ├── PrismaTimetableRepository.ts
    │   │       └── PrismaUserRepository.ts
    │   │
    │   └── services/
    │       ├── .gitkeep
    │       ├── CampayPaiementService.ts
    │       ├── GeminiIAService.ts
    │       ├── JwtTokenService.ts
    │       ├── NodemailerEmailService.ts
    │       ├── PdfKitBulletinService.ts
    │       └── SocketNotificationService.ts
    │
    ├── inngest/
    │   ├── index.ts
    │   └── functions.ts
    │
    ├── lib/
    │   └── classSerieValidator.ts
    │
    ├── middleware/
    │   ├── auth.ts
    │   ├── authMultiTenant.ts
    │   ├── masterAuthSecurity.ts
    │   ├── masterSensitiveAuth.ts
    │   ├── rateLimit.ts
    │   └── validate.ts
    │
    ├── routes/
    │   ├── activitieslog.ts
    │   ├── ai.ts
    │   ├── coreDomain.ts
    │   ├── dashboard.ts
    │   ├── emailLog.ts
    │   ├── exam.ts
    │   ├── parent.ts
    │   ├── public.ts
    │   ├── schoolSettings.ts
    │   ├── search.ts
    │   └── sms.ts
    │
    ├── scripts/
    │   ├── create-test-data.ts
    │   ├── delete-test-data.ts
    │   ├── list-gemini-models.ts
    │   ├── migrate-phase5.ts
    │   ├── migrate-phase8.ts
    │   ├── remove-test-data.ts
    │   ├── reset-master.ts
    │   └── seed-week4.ts
    │
    ├── services/
    │   ├── campay.ts
    │   ├── emailService.ts
    │   ├── gemini.ts
    │   └── smsService.ts
    │
    ├── socket/
    │   └── io.ts
    │
    ├── tests/
    │   ├── bulletinPolicy.test.ts
    │   ├── gradingEngine.test.ts
    │   └── phase8-rules.integration.test.ts
    │
    ├── types/
    │   ├── email.ts
    │   └── express.d.ts
    │
    ├── utils/
    │   ├── activitieslog.ts
    │   ├── bulletinPolicy.ts
    │   ├── coreDomainDefaults.ts
    │   ├── emailTemplates.ts
    │   ├── generateToken.ts
    │   ├── gradingEngine.ts
    │   ├── languageHelper.ts
    │   ├── masterAuthAudit.ts
    │   ├── reportCardTemplates.ts
    │   ├── reporting.ts
    │   ├── schoolOnboarding.ts
    │   ├── schoolSettings.ts
    │   └── reportCards/
    │       ├── helpers.ts
    │       ├── index.ts
    │       └── templates.ts
    │
    └── validation/
        └── schemas.ts
```

## Résumé

- **Nombre de fichiers source `.ts`:** ~370 (hors node_modules, dist)
- **Migrations Prisma:** 16 (5 legacy + 11 timestampées)
- **Base de données:** PostgreSQL 15 avec Prisma ORM
- **Architecture:** Hexagonale (Domain-Driven Design) + Controllers legacy
  - `domain/` — Entités, règles métier, ports (repositories & services)
  - `application/` — Use cases orchestrant le domaine
  - `infrastructure/` — Implémentations concrètes (Prisma, HTTP, services externes)
  - Controllers/routes legacy en cours de migration vers la nouvelle architecture

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/server.ts` | Point d'entrée — Express, routes, Socket.io |
| `src/config/prisma.ts` | Instance Prisma Client partagée (singleton) |
| `src/infrastructure/config/hexagonal.bootstrap.ts` | Bootstrap de l'architecture hexagonale |
| `src/infrastructure/config/container.ts` | Conteneur DI (Dependency Injection) |
| `src/middleware/authMultiTenant.ts` | Résolution du tenant school par sous-domaine |
| `src/middleware/masterAuthSecurity.ts` | Sécurité double-facteur session SuperAdmin |
| `src/controllers/masterAdmin.ts` | Hub de contrôle — invite/approuve/suspend écoles |
| `src/domain/rules/GradingEngine.ts` | Moteur de calcul moyennes MINESEC |
| `src/domain/rules/BulletinPolicy.ts` | Règles d'accès bulletins (rôles, périodes) |
| `src/domain/constants/SystemeEducatifCameroun.ts` | Constantes système éducatif camerounais |
| `src/services/campay.ts` | Paiement Mobile Money (Campay) |
| `src/services/gemini.ts` | Génération emploi du temps IA (Google Gemini) |
| `src/domain/value-objects/SerieBAC.ts` | Validation séries BAC camerounais |
| `src/domain/entities/` | Entités métier du domaine |
| `src/infrastructure/persistence/prisma/` | Implémentations Prisma des repositories |
| `src/infrastructure/http/controllers/` | Contrôleurs HTTP hexagonaux |
| `src/infrastructure/services/` | Services concrets (paiement, IA, email, PDF, etc.) |
| `prisma/schema.prisma` | Schéma complet BDD (toutes les tables) |
| `prisma/seed.ts` | Données initiales pour développement |

## Technologies

| Couche | Technologie |
|---|---|
| Runtime | **Bun** |
| Framework | **Express** |
| ORM | **Prisma** + PostgreSQL 15 |
| Auth | JWT (httpOnly cookies) + MFA TOTP |
| Temps réel | **Socket.io** |
| Événements async | **Inngest** |
| IA | **Google Gemini** |
| Paiement | **Campay** (MTN MoMo + Orange Money) |
| Email | Nodemailer (SMTP) |
| SMS | TechSoft Web Agency API |
| Validation | Zod |
| Tests | Bun test |
| PDF | PDFKit |
