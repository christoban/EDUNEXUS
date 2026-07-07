# MODULE_INDEX — EduNexus

> Index des modules pour identifier **rapidement où intervenir** quand une fonctionnalité évolue.
> Convention : un « module métier » = un dossier `application/<module>` (use cases) + son/ses controller(s), routes, repository, et sections frontend associées.
> Liés : [ARCHITECTURE.md](ARCHITECTURE.md) · [FEATURES.md](FEATURES.md) · [CONVENTIONS.md](CONVENTIONS.md)

Chemins raccourcis : `app/` = `backend/src/application`, `infra/` = `backend/src/infrastructure`, `fe/` = `frontend/src`.

---

## A. Modules métier backend (application/)

| Module | Rôle | Dossiers principaux | Fichiers clés | Dépendances |
|---|---|---|---|---|
| **user** (9 UC) | Auth (login/refresh/logout), inscription, CRUD utilisateurs, import Excel, transfert élève | `app/user`, `infra/http/controllers/UserController` `.../MasterAuthController` | `ConnecterUtilisateurUseCase`, `InscrireUtilisateurUseCase`, `ImporterUtilisateursUseCase`, `middleware/auth.ts` | `UserRepository`, `TokenService` (JWT), bcrypt |
| **school** (4 UC) | Onboarding, approbation, **activation déterministe** (crée classes/matières/sections) | `app/school`, `infra/http/controllers/SchoolOnboardingController` `InviteOnboardingController` | `OnboarderEcoleUseCase`, `ApprouverEcoleUseCase`, `ConfigurerEtablissementUseCase`, `ActiverEtablissementUseCase`, `schoolTemplateConfig.ts` | `SchoolRepository`, `EmailService`, Prisma |
| **masterAdmin** (7 UC) | Plateforme : inviter/suspendre/réactiver/rejeter une école, changer de plan | `app/masterAdmin`, `infra/http/controllers/MasterAdminHexController` | `InviterEcoleUseCase`, `SuspendreEcoleUseCase`, `ChangerPlanAbonnementUseCase`, `VerifyMfaUseCase` | `SchoolRepository`, `InvitationRepository`, `EmailService`, otplib |
| **class** (6 UC) | Classes, prof principal, sous-groupes TP, affectation élèves | `app/class`, `infra/http/controllers/ClasseController` | `CreerClasseUseCase`, `SupprimerClasseUseCase`, `AssignerProfesseurPrincipalUseCase`, `CreerSousGroupeTPUseCase` | `ClasseRepository`, `SousGroupeRepository` |
| **subject** (5 UC) | Matières, coefficients, assignation enseignant | `app/subject`, `infra/http/controllers/SubjectController` | `CreerMatiereUseCase`, `AssignerEnseignantMatiereUseCase`, `DefinirCoefficientUseCase` | `MatiereRepository`, `UserRepository` |
| **grade** (5 UC) | Saisie/soumission/validation des notes (workflow MINESEC) | `app/grade`, `infra/http/controllers/GradeController` | `SaisirNoteUseCase`, `SoumettreNoteUseCase`, `ValiderNoteUseCase`, `ValiderEnBlocUseCase`, `RejeterNoteUseCase` | `NoteRepository`, `MatiereRepository` |
| **reportCard** (2 UC) | Bulletins : génération (calcul + PDF) + envoi | `app/reportCard`, `infra/http/controllers/ReportCardController`, `utils/reportCards/` | `GenererBulletinUseCase`, `EnvoyerBulletinsUseCase`, `templates.ts`, `helpers.ts` | `BulletinRepository`, `PdfService`, `EmailService`, `languageHelper` |
| **attendance** (1 UC) | Présences + notifications (SMS/app) | `app/attendance`, `infra/http/controllers/AttendanceController` | `EnregistrerPresenceUseCase` | `PresenceRepository`, `NotificationService`, SMS |
| **timetable** (6 UC) | Emplois du temps, créneaux, publication, rattrapages ; **génération auto IA** | `app/timetable`, `infra/http/controllers/TimetableController` `TimetableAutoController` `TimetableGridConfigController` | `CreerEmploiDuTempsUseCase`, `AjouterCreneauUseCase`, `ModifierCreneauUseCase`, `GetElevesLV2PourCreneauUseCase` | `TimetableRepository`, Groq (EDT auto), Inngest |
| **academicYear** (5 UC) | Années/périodes/séquences, clôture d'année, promotions | `app/academicYear`, `infra/http/controllers/AcademicYearController` | `CreerAnneeAcademiqueUseCase`, `CloturerAnneeUseCase`, `DefinirPeriodeCouranteUseCase`, `MettreAJourCalendrierUseCase` | `AnneeAcademiqueRepository`, `PromotionRepository` |
| **finance** (8 UC) | Plans de frais, factures (unitaire/masse), paiements Mobile Money + cash, dépenses, cautions, webhook | `app/finance`, `infra/http/controllers/FinanceController` | `CreerPlanFraisUseCase`, `GenererFacturesEnMasseUseCase`, `InitierPaiementMobileMoneyUseCase`, `TraiterWebhookCampayUseCase`, `RembourserCautionUseCase`, `EnregistrerDepenseUseCase` | `PlanFraisRepository`, `FactureRepository`, `PaiementRepository`, `DepenseRepository`, `PaiementService` (Campay) |
| **classCouncil** (1 UC) | Conseils de classe (délibérations) | `app/classCouncil`, `infra/http/controllers/ClassCouncilController` | `TenirConseilClasseUseCase` | `ClassCouncilRepository` |
| **orientation** (7 UC) | Fiches d'orientation, entretiens, tests d'aptitude, recommandations de série | `app/orientation`, `infra/http/controllers/OrientationController` | `CreerFicheOrientationUseCase`, `AjouterEntretienUseCase`, `CreerRecommandationSerieUseCase`, `GetStatsOrientationUseCase` | `OrientationRepository` |
| **parent** (2 UC) | Espace parent : enfants, contrôle d'accès | `app/parent`, `infra/http/controllers/ParentController` | `ObtenirEnfantsUseCase`, `VerifierAccesEnfantUseCase` | `ParentRepository` |
| **schoolSettings** (2 UC) | Paramètres établissement (locale, notifications, etc.) | `app/schoolSettings`, `infra/http/controllers/SchoolSettingsController` | `ObtenirParametresEcoleUseCase`, `MettreAJourParametresEcoleUseCase` | `SchoolSettingsRepository` |
| **student** (5 UC) | LV2 (par élève / en masse), matières A-Level, préremplissage combinaisons | `app/student` | `AffecterLV2EleveUseCase`, `AffecterLV2EnMasseUseCase`, `AffecterMatieresALevelEleveUseCase`, `PreremplirDepuisCombinaisonUseCase` | Prisma (LV2/A-Level) |
| **ai** (1 UC) | Indice de santé scolaire (score + recommandations IA) | `app/ai`, `infra/http/controllers/AIController` | `CalculerIndiceSanteUseCase` | `SanteEleveRepository`, `IAService` (Groq) |
| **assistant** | Copilot admin exécutant (function-calling Groq) : catalogue d'actions + RBAC + undo | `app/assistant`, `infra/http/controllers/AssistantController` | `adminActionCatalog.ts`, endpoints execute/confirm-action/undo-action | Groq (tools), use cases class/subject, `AssistantActionLog` |
| **messaging** | Conversations / messages in-app | `app/messaging`, `infra/http/controllers/CommunicationsController` | (modèles `Conversation`/`Message`/`MessageReadStatus`) | Prisma, Socket.io |

---

## B. Modules transverses backend (hors application/)

| Module | Rôle | Emplacement | Notes |
|---|---|---|---|
| **Container / Bootstrap** | Composition root : câble repos + services + use cases, monte les routes | `infra/config/container.ts`, `infra/config/hexagonal.bootstrap.ts` | Point unique où l'on branche un nouveau use case / une nouvelle route |
| **Auth / RBAC** | Middlewares JWT, multi-tenant, sécurité master, rate-limit | `middleware/auth.ts`, `authMultiTenant.ts`, `masterAuthSecurity.ts`, `rateLimit.ts` | `requireAuth`, `requireRole`, `requireSchool` |
| **i18n / langue** | Source unique de langue + templates emails | `utils/languageHelper.ts`, `utils/emailTemplates.ts` | `resolveLanguage`, `instructionLangue` |
| **Documents** | Génération PDF : bulletins, documents scolaires, RH | `utils/reportCards/`, `utils/schoolDocuments/`, `utils/hrDocuments.ts`, `infra/services/PdfKitBulletinService.ts` | PDFKit |
| **IA (Groq)** | Façade LLM | `services/groq.ts`, `infra/services/GroqIAService.ts` | `generateWithGroq`, `groqModel` (llama-3.3-70b) |
| **Intégrations externes** | Mobile Money, Email, SMS | `services/campay.ts` + `infra/services/CampayPaiementService.ts`, `services/emailService.ts` + `NodemailerEmailService.ts`, `services/smsService.ts` + `infra/services/SmsNotificationService.ts` | |
| **Jobs asynchrones** | Bulletins en masse, EDT auto, notifications | `inngest/functions.ts`, `inngest/index.ts` | Inngest |
| **Temps réel** | Notifications poussées | `socket/io.ts`, `infra/services/SocketNotificationService.ts` | Socket.io |
| **Persistence** | 21 repositories Prisma | `infra/persistence/prisma/*Repository.ts`, `config/prisma.ts` | Implémentent les ports |
| **Scripts / migrations data** | Seed, migrations ponctuelles, reset master | `scripts/` | ex. `migrate-lv2-subjects.ts`, `reset-master.ts` |
| **Schéma DB** | 87 modèles Prisma | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | Multi-tenant par `schoolId` |

---

## C. Modules frontend

| Module | Rôle | Emplacement | Fichiers clés |
|---|---|---|---|
| **Dashboard Admin** (20 sections) | Toute la gestion école | `fe/app/admin/dashboard` | `page.tsx`, `_components/Section*.tsx`, `AdminSidebar/Topbar/Toast`, `AssistantWidget` |
| **Dashboard Enseignant** (11) | Notes, présences, cahier de texte, PP | `fe/app/teacher/dashboard` | `_components/SectionTeacher*`, `SectionCahierDeTexte`, `SectionProfesseurPrincipal` |
| **Dashboard Staff** (13) | Selon permissions (Censeur, Intendant, discipline, orientation, biblio…) | `fe/app/staff/dashboard` | `_components/Section*Staff`, `SectionDiscipline`, `SectionFinanceStaff`, `SectionLibrary` |
| **Dashboard Parent** (7) | Suivi enfants, paiements, bulletins | `fe/app/parent/dashboard` | `_components/SectionParent*` |
| **Dashboard Élève** (6) | Notes, bulletins, EDT, biblio | `fe/app/student/dashboard` | `_components/SectionStudent*` |
| **Dashboard Master** (3) | Super-admin plateforme | `fe/app/master` | `_components/SectionSchools`, `SectionLogs`, `MasterModals` |
| **Onboarding Phase 1** | Wizard d'inscription (token) | `fe/app/onboarding/[token]/page.tsx` | `detectTemplate`, `TEMPLATE_META`, PEBS, LV2 |
| **Onboarding Phase 2** | Conversationnel + activation | `fe/app/admin/configuration` | `page.tsx`, `ConversationalOnboarding.tsx` (réconcilié depuis Phase 1) |
| **Auth / public** | Login, reset, landing, invite | `fe/app/login`, `reset-password`, `invite`, `components/LandingPage` | |
| **Socle i18n** | Traduction FR/EN | `fe/lib/i18n/`, `fe/locales/{fr,en}/*.json` | `useT`, `LanguageProvider`, `resolveLanguage`, `README.md` |
| **Thème** | Clair/sombre | `fe/app/providers.tsx` (next-themes), `fe/app/globals.css` (`.dark`), `components/ThemeToggle` | |
| **Offline / PWA** | File d'attente hors-ligne | `fe/lib/offline/` (Dexie), `components/OfflineIndicator/EmptyState` | |
| **Composants partagés** | UI transverse | `fe/components/` + `fe/components/ui/` (shadcn) | `AnimatedBackground`, `LanguageSwitch`, `PasswordStrengthBar` |
| **Accès réseau** | Wrapper API + auth session | `fe/lib/fetchApi.ts`, `fe/lib/userAuth.ts` | cookies, `/api/v2/*` |

---

## D. Où intervenir — aide-mémoire

- **Nouveau champ métier persistant** → `schema.prisma` (+ migration) → port/repository → use case → controller/route → section frontend.
- **Nouvelle action admin (copilot)** → `application/assistant/adminActionCatalog.ts`.
- **Nouveau document PDF** → `utils/schoolDocuments/` ou `utils/reportCards/` + controller dédié.
- **Nouvelle langue/texte UI** → `fe/locales/{fr,en}/<namespace>.json` (parité obligatoire) + `useT`.
- **Nouvelle route API** → controller + `routes/*.routes.ts` + montage dans `hexagonal.bootstrap.ts` (via `container`).
- **Logique de langue** → toujours `resolveLanguage` (jamais recréer).
