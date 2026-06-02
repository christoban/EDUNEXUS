# PROJECT_SNAPSHOT — EduNexus
> Généré le 2026-05-23

---

## 1. ARBORESCENCE COMPLÈTE

```
EDUNEXUS/
├── .env
├── .gitignore
├── package.json                         (workspace root)
├── bun.lock
├── PROJECT_SNAPSHOT.md
│
├── backend/
│   ├── .env
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma.config.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── server.ts
│       ├── config/
│       │   └── prisma.ts
│       ├── controllers/
│       │   ├── academicYear.ts
│       │   ├── activitieslog.ts
│       │   ├── ai.ts
│       │   ├── attendance.ts
│       │   ├── class.ts
│       │   ├── classCouncil.ts
│       │   ├── coreDomain.ts
│       │   ├── dashboard.ts
│       │   ├── emailLog.ts
│       │   ├── exam.ts
│       │   ├── finance.ts
│       │   ├── grade.ts
│       │   ├── masterAdmin.ts
│       │   ├── parent.ts
│       │   ├── reportCard.ts
│       │   ├── schoolOnboarding.ts
│       │   ├── schoolSettings.ts
│       │   ├── search.ts
│       │   ├── subject.ts
│       │   ├── timetable.ts
│       │   └── user.ts
│       ├── inngest/
│       │   ├── index.ts
│       │   └── functions.ts
│       ├── lib/
│       │   └── classSerieValidator.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── authMultiTenant.ts
│       │   ├── masterAuthSecurity.ts
│       │   ├── masterSensitiveAuth.ts
│       │   ├── rateLimit.ts
│       │   └── validate.ts
│       ├── routes/
│       │   ├── academicYear.ts
│       │   ├── activitieslog.ts
│       │   ├── ai.ts
│       │   ├── attendance.ts
│       │   ├── class.ts
│       │   ├── classCouncil.ts
│       │   ├── coreDomain.ts
│       │   ├── dashboard.ts
│       │   ├── emailLog.ts
│       │   ├── exam.ts
│       │   ├── finance.ts
│       │   ├── grade.ts
│       │   ├── masterAdmin.ts
│       │   ├── parent.ts
│       │   ├── public.ts
│       │   ├── reportCard.ts
│       │   ├── schoolOnboarding.ts
│       │   ├── schoolSettings.ts
│       │   ├── search.ts
│       │   ├── sms.ts
│       │   ├── subject.ts
│       │   ├── timetable.ts
│       │   └── user.ts
│       ├── services/
│       │   ├── campay.ts
│       │   ├── emailService.ts
│       │   ├── gemini.ts
│       │   └── smsService.ts
│       ├── socket/
│       │   └── io.ts
│       ├── types/
│       │   ├── email.ts
│       │   └── express.d.ts
│       ├── utils/
│       │   ├── activitieslog.ts
│       │   ├── bulletinPolicy.ts
│       │   ├── coreDomainDefaults.ts
│       │   ├── emailTemplates.ts
│       │   ├── generateToken.ts
│       │   ├── gradingEngine.ts
│       │   ├── languageHelper.ts
│       │   ├── masterAuthAudit.ts
│       │   ├── reportCardTemplates.ts
│       │   ├── reporting.ts
│       │   ├── schoolOnboarding.ts
│       │   ├── schoolSettings.ts
│       │   └── reportCards/
│       │       ├── helpers.ts
│       │       ├── index.ts
│       │       └── templates.ts
│       └── validation/
│           └── schemas.ts
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
    ├── components.json
    ├── public/
    │   ├── favicon.svg
    │   ├── apple-touch-icon.svg
    │   ├── masked-icon.svg
    │   ├── pwa-192x192.svg
    │   └── pwa-512x512.svg
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── types.ts
        ├── sw.ts                        (Service Worker — workbox)
        ├── components/
        │   ├── ai/
        │   │   └── AIChatbot.tsx
        │   ├── offline/
        │   │   ├── OfflineBanner.tsx
        │   │   ├── OfflineStatus.tsx
        │   │   └── SyncReport.tsx
        │   ├── sidebar/
        │   │   ├── AppSidebar.tsx
        │   │   ├── nav-main.tsx
        │   │   ├── nav-user.tsx
        │   │   ├── team-switcher.tsx
        │   │   ├── ThemeToogle.tsx
        │   │   └── SuperAdminNavbar.tsx
        │   ├── academic-year/ (AcademicYearForm, academic-year-table, schema)
        │   ├── auth/ (UniversalUserForm)
        │   ├── classes/ (ClassForm, ClassTable, schema)
        │   ├── dashboard/ (ai-insight-widget, dashboard-stats, parent-dashboard)
        │   ├── global/ (CustomAlert, CustomAutocompleteSelect, CustomInput, ...)
        │   ├── lms/ (ExamGenerator, ExamRadio)
        │   ├── subjects/ (SubjectForm, SubjectTable, schema)
        │   ├── superadmin/ (SensitiveDialog)
        │   ├── timetable/ (GeneratorControls, TimetableGrid)
        │   ├── ui/ (40+ shadcn/ui components)
        │   └── users/ (UserDialog, UserTable)
        ├── hooks/
        │   ├── AuthProvider.tsx
        │   ├── use-mobile.ts
        │   ├── use-toast.ts
        │   ├── useMasterAuth.tsx
        │   ├── useOnlineStatus.ts
        │   ├── useSmsDeliveryStatus.ts
        │   └── useUILanguage.ts
        ├── lib/
        │   ├── accessPolicy.ts
        │   ├── api.ts
        │   ├── i18n.ts
        │   ├── masterRoutes.ts
        │   ├── offlineDB.ts
        │   ├── offlineQueue.ts
        │   ├── offlineSync.ts
        │   ├── roleAccess.ts
        │   ├── socket.ts
        │   └── utils.ts
        └── pages/
            ├── Dashboard.tsx
            ├── Home.tsx
            ├── Login.tsx
            ├── Offline.tsx
            ├── academics/ (Attendance, Classes, Subjects, Timetable)
            ├── admin/ (Absences, Classes, Dashboard, GradeStatus, ReportCards,
            │          Settings, Subjects, Users, YearEnd)
            ├── finance/ (Expenses, FeePlans, Invoices, OverdueAndReminders, Payments)
            ├── lms/ (Exam, Exams, ReportCards)
            ├── master/ (MasterDecoy, MasterEmailHistory, MasterEntry, MasterLogin)
            ├── onboarding/ (OnboardingConfirmation, SchoolOnboarding)
            ├── parent/ (ChildDetails, ParentDashboard, ParentSettings, Payments, ReportCards)
            ├── routes/ (PrivateRoutes, RoleGuard, router)
            ├── settings/ (EmailHistory, SchoolConfiguration, Subjects, academic-year)
            ├── staff/ (Cautions, ClassCouncil, Finance, GradeValidation, TimetableEditor)
            ├── student/ (ReportCards)
            ├── superadmin/ (AuditLog, DashboardSuperAdmin, InviteModal, InviteSchoolForm,
            │               ProtectedSuperAdmin, SchoolDetailPage, SchoolOnboardingForm,
            │               SchoolsTable, SuperAdminRequests, SuperAdminSecurity)
            ├── teacher/ (AIInsights, Attendance, Grades)
            └── users/ (index)
```

---

## 2. FICHIERS IMPORTANTS — DESCRIPTIONS

### BACKEND — server.ts
- Point d'entrée Express : monte tous les routers, configure CORS/Helmet/cookie-parser.
- Enregistre le handler Inngest (`/api/inngest`), le socket.io, et la route publique SMS.
- Exporte le serveur HTTP pour Socket.io; charge les variables d'env via dotenv.

### BACKEND — config/prisma.ts
- Singleton PrismaClient partagé dans toute l'application.
- Évite les connexions multiples en mode développement (hot-reload Bun).

### BACKEND — controllers/user.ts
- CRUD utilisateurs multi-rôles (admin, teacher, student, parent, staff).
- Gestion de l'authentification : register, login, logout, refresh JWT via cookie HttpOnly.
- Upload avatar, changement de mot de passe, liste paginée avec filtres rôle/classe.

### BACKEND — controllers/finance.ts
- Gestion complète des finances : plans de frais, factures, paiements (CASH/MTN/Orange/EU).
- Intégration Campay : `initiateMobilePayment`, `campayWebhook` (public), `checkMobilePaymentStatus`.
- Endpoints cautions, dépenses, rapports de revenus, relances automatiques.

### BACKEND — controllers/ai.ts
- 5 endpoints IA via Gemini 1.5 Flash : insight rôle-aware, dashboard santé élèves, commentaire bulletin, chatbot contextuel, détection risque.
- `getStudentsHealthDashboard` : classe les élèves en 5 niveaux d'alerte selon healthScore.
- `aiChat` : historique 6 messages, prompt système adapté au rôle (admin/teacher/student/parent).

### BACKEND — controllers/attendance.ts
- Saisie de présences par enseignant, historique par classe/date, statistiques.
- Support du flag `isOfflineSync` pour la réconciliation des données hors ligne.
- Agrégation mensuelle pour les bulletins et le tableau de bord admin.

### BACKEND — controllers/grade.ts
- Saisie et validation des notes par matière/trimestre avec workflow de validation.
- Calcul automatique des moyennes, rangs, mentions selon le barème camerounais.
- Statuts : DRAFT → SUBMITTED → VALIDATED → LOCKED ; contrôle d'accès par rôle.

### BACKEND — controllers/reportCard.ts
- Génération des bulletins PDF avec PDFKit selon 17 templates (Général, Technique, etc.).
- Appel à `gradingEngine` pour les calculs et `bulletinPolicy` pour les règles métier.
- Support multi-format : téléchargement individuel ou ZIP de classe.

### BACKEND — controllers/schoolOnboarding.ts
- Onboarding multi-étapes : création école, vérification token invitation, finalisation.
- Génère les paramètres par défaut (domaines curriculaires, plans de notation).
- Envoi d'email de bienvenue via Resend après activation.

### BACKEND — controllers/timetable.ts
- Génération automatique d'emplois du temps via Inngest (tâche asynchrone).
- Détecte les conflits salle/enseignant/classe, respecte les contraintes hebdomadaires.
- CRUD manuel pour édition par le staff; export PDF/JSON.

### BACKEND — controllers/classCouncil.ts
- Tableau de conseil de classe : statistiques par élève (moy., absent., rang).
- Génère les décisions (passage, redoublement, félicitations) selon seuils configurés.
- Export PDF du procès-verbal de conseil.

### BACKEND — inngest/functions.ts
- `generateTimeTable` : génère l'EDT en arrière-plan avec gestion des conflits.
- `sendPaymentReminders` : cron quotidien 8h, envoie des emails J-7/J-3/J-0/retard.
- `computeStudentHealthScores` : cron 2h, calcule le healthScore (5 composantes) pour chaque élève actif.

### BACKEND — services/gemini.ts
- Wrapper Vercel AI SDK v6 autour de Gemini 1.5 Flash.
- `generateWithGemini(prompt, systemPrompt?)` : prompt système par défaut en français pour le contexte camerounais.
- Utilise `maxOutputTokens: 1000` (syntaxe ai v6, pas `maxTokens`).

### BACKEND — services/campay.ts
- Client API Campay (MTN MoMo / Orange Money) : acquisition de token, initiation paiement, vérification statut.
- `detectOperator(phone)` : détermine MTN/ORANGE/UNKNOWN via préfixes à 3 chiffres.
- Normalise les numéros camerounais (préfixe 237 optionnel).

### BACKEND — services/smsService.ts
- `sendSMS` / `sendBulkSMS` : envoi via Techsoft ou Africa's Talking (configurable par `SMS_PROVIDER`).
- `sendSms` (v2) : abstraction multi-provider avec gestion d'erreurs unifiée.
- `parseSMSAttendance` / `processSMSAttendance` : parse le format `PRES#CLASSE#1,0,1,...` et crée les enregistrements de présence.

### BACKEND — services/emailService.ts
- Envoi d'emails transactionnels via Resend (bulletins, invitations, rappels paiement).
- Templates HTML pour chaque type de communication (invitation, rappel, bulletin).

### BACKEND — middleware/auth.ts
- `protect` : vérifie le JWT dans le cookie HttpOnly, attache `req.user`.
- `authorize(roles[])` : contrôle d'accès basé sur le rôle après `protect`.
- `authMultiTenant` : vérifie que l'utilisateur appartient bien à l'école (schoolId).

### BACKEND — middleware/masterSensitiveAuth.ts
- Protection des routes superadmin sensibles avec MFA TOTP + vérification IP allowlist.
- Rate limiting renforcé sur les opérations critiques (reset master, suppression école).

### BACKEND — utils/gradingEngine.ts
- Calcul des moyennes coefficientées selon les séries camerounaises (A, C, D, TI, etc.).
- Détermine le rang, la mention (Très Bien / Bien / Assez Bien / Passable / Insuffisant).
- Gère les règles spéciales BAC (matières éliminatoires, coefficients par série).

### BACKEND — utils/bulletinPolicy.ts
- Politique de génération des bulletins : règles de passage, mention d'honneur, redoublement.
- Vérifie la conformité des notes avant génération (toutes les matières saisies et validées).

### BACKEND — validation/schemas.ts
- Schémas Zod pour toutes les entrées API : users, classes, grades, finance, settings.
- Utilisé dans le middleware `validate` pour la validation automatique des body/query.

### BACKEND — routes/finance.ts
- Exporte deux routers : `financeRouter` (protégé) et `publicFinanceRouter` (webhook Campay sans auth).
- Routes mobiles accessibles aux rôles admin/parent/staff avant le middleware admin-only.

### BACKEND — routes/sms.ts
- Route publique `GET /api/sms/incoming` : webhook Techsoft pour les SMS entrants de présence.
- Aucune authentification (Techsoft envoie une requête GET sans token).

### BACKEND — routes/ai.ts
- Toutes les routes protégées par `protect` (JWT requis).
- `POST /ai/chat`, `GET /ai/students-health`, `POST /ai/generate-insight`, `GET /ai/risk-detection/:id`, `POST /ai/bulletin-comment`.

---

### FRONTEND — src/main.tsx
- Point d'entrée React 19 : monte `<App>` dans le DOM, configure le router.

### FRONTEND — src/App.tsx
- Fournit le `ThemeProvider` et le `Toaster` (Sonner) autour du `RouterProvider`.

### FRONTEND — src/types.ts
- Types globaux TypeScript : `UserRole`, `User`, `School`, interfaces partagées entre pages.

### FRONTEND — pages/routes/router.tsx
- Définit toutes les routes de l'application avec `createBrowserRouter`.
- Routes publiques (Home, Login, Onboarding), routes superadmin, et routes privées protégées par `RoleGuard`.
- Couvre : admin, teacher, staff, parent, student, finance, settings, IA.

### FRONTEND — pages/routes/PrivateRoutes.tsx
- Layout principal authentifié : `SidebarProvider` + `AppSidebar` + `SidebarInset` + `AIChatbot`.
- Redirige vers `/login` si non authentifié, vers le home de rôle depuis `/dashboard`.
- Affiche un spinner pendant le chargement de l'auth.

### FRONTEND — pages/routes/RoleGuard.tsx
- HOC de protection par rôle : vérifie `canAccessPath` ou `allowedRoles` avant le rendu.
- Redirige vers la page d'accueil du rôle si non autorisé.

### FRONTEND — hooks/AuthProvider.tsx
- Context React d'authentification : `user`, `year`, `loading`, `setUser`.
- Vérifie la session au montage via `GET /users/me`, expose `getRoleHomePath`.

### FRONTEND — lib/accessPolicy.ts
- `SIDEBAR_NAV_POLICY` : structure complète de la sidebar (sections, items, URLs).
- `ROUTE_ROLE_POLICY` : mapping URL → rôles autorisés pour toute l'application.
- `canAccessPath(role, path)` : utilisé par RoleGuard et AppSidebar pour filtrer.

### FRONTEND — lib/api.ts
- Instance axios configurée avec `baseURL=/api`, `withCredentials: true`.
- Intercepteur de réponse pour redirection automatique vers `/login` sur 401.

### FRONTEND — lib/offlineDB.ts
- Abstraction IndexedDB : 6 stores (`attendance_queue`, `grades_queue`, `students_cache`, `classes_cache`, `timetable_cache`, `sync_reports`).
- API `dbSet / dbGetAll / dbDelete / dbClear / dbCount` ; génère un UUID si aucun `id` fourni.

### FRONTEND — lib/offlineQueue.ts
- `enqueue(item)` : ajoute une présence ou note à la file d'attente IndexedDB.
- `syncAll()` : rejoue toute la file, gère les conflits (note déjà validée = reject), retourne un `SyncReport`.
- `getPendingCount()` : compte total des éléments en attente.

### FRONTEND — lib/offlineSync.ts
- Couche avancée offline : `cacheApiResponse / getCachedApiResponse` pour le cache GET.
- `queueOfflineMutation / flushOfflineQueue` : file de mutations génériques (attendance, grades, timetables).
- `shouldCacheApiResponse / shouldQueueOfflineMutation` : prédicats de décision par URL.

### FRONTEND — hooks/useOnlineStatus.ts
- Écoute les événements `online/offline` du navigateur.
- Déclenche `syncAll()` automatiquement au retour de connexion si la file n'est pas vide.
- Expose `{ isOnline, pendingCount, syncing, refreshPendingCount }`.

### FRONTEND — components/offline/OfflineBanner.tsx
- Bannière fixe en haut de l'écran : rouge (hors ligne) ou amber (données en attente).
- Bouton "Synchroniser" manuel quand en ligne avec données en attente.

### FRONTEND — components/offline/OfflineStatus.tsx
- Indicateur flottant centré (pill) : affiche la taille de la queue de mutations.
- Utilise `offlineSync.ts` (flushOfflineQueue) plutôt que `offlineQueue.ts`.

### FRONTEND — components/offline/SyncReport.tsx
- Affiche l'historique des rapports de synchronisation stockés dans IndexedDB.
- Chaque rapport liste les items acceptés/rejetés avec leur raison.

### FRONTEND — src/sw.ts
- Service Worker custom (stratégie `injectManifest` de VitePWA).
- Précache tous les assets avec Workbox, CacheFirst pour Google Fonts, NetworkFirst pour `/api/classes` et `/api/users`.

### FRONTEND — components/ai/AIChatbot.tsx
- Chatbot flottant (bas-droite) : ouvre un panneau 480px avec historique de messages.
- Appelle `POST /ai/chat` avec les 6 derniers messages comme contexte.
- Disponible sur toutes les pages authentifiées via PrivateRoutes.

### FRONTEND — pages/teacher/AIInsights.tsx
- Dashboard santé élèves : 5 KPIs cliquables (critique/alerte/recommandation/bien/excellent).
- Clic sur un élève → analyse de risque Gemini + indicateurs (moy., présence, matières faibles).

### FRONTEND — pages/staff/Finance.tsx
- Tableau de bord intendant : KPIs (attendu, reçu, en retard, taux recouvrement) + élèves en retard.
- Sélecteur de période (mois/trimestre/année), bouton "Relancer" par élève.

### FRONTEND — pages/staff/Cautions.tsx
- Gestion des cautions : liste avec filtres, actions Rembourser/Confisquer, création via dialog.

### FRONTEND — pages/parent/Payments.tsx
- Vue parent : liste des factures + KPIs + dialog paiement mobile (MTN MoMo / Orange Money).
- Détection temps réel de l'opérateur par préfixe, badge coloré, vérification statut post-paiement.

### FRONTEND — pages/admin/Dashboard.tsx
- Tableau de bord admin : statistiques école, actions rapides, widget IA insight.

### FRONTEND — components/sidebar/AppSidebar.tsx
- Sidebar dynamique : filtre les sections/items selon le rôle via `canAccessPath`.
- Internationalisation via `useUILanguage` + `t()`, chargement du branding école.
- Affiche le nom/logo de l'école, le nom de l'année scolaire active, bouton déconnexion.

### FRONTEND — lib/i18n.ts
- Dictionnaire de traductions FR/EN pour tous les labels de navigation et messages UI.
- Fonction `t(key, language)` utilisée dans toute l'application.

---

## 3. RÉSULTAT bunx tsc --noEmit

### Backend
```
✅ 0 erreur TypeScript
```

### Frontend
```
✅ 0 erreur TypeScript
```

---

## 4. PROBLÈME CRITIQUE DÉTECTÉ — PWA

### ❌ vite-plugin-pwa NON installé

`vite.config.ts` importe `VitePWA` depuis `vite-plugin-pwa` **mais ce package n'est pas dans `package.json` et n'est pas dans `node_modules`**.

De même, `src/sw.ts` importe des packages Workbox qui ne sont pas installés :
- `workbox-strategies`
- `workbox-expiration`
- `workbox-core`
- `workbox-routing`
- `workbox-precaching`

**La build `bun run build` échouera** tant que ces dépendances ne sont pas installées.

**Fix — exécuter dans `frontend/` :**
```bash
bun add -D vite-plugin-pwa workbox-build workbox-window
```
Les packages workbox sont inclus automatiquement par `vite-plugin-pwa`.

### ✅ Ce qui est correctement implémenté

| Étape | Statut | Notes |
|-------|--------|-------|
| 1.1 Install vite-plugin-pwa | ❌ | Manquant dans package.json + node_modules |
| 1.2 vite.config.ts (VitePWA) | ✅ | Config `injectManifest` + sw.ts custom |
| 2 offlineDB.ts | ✅ | Amélioration : UUID auto si id absent |
| 3 offlineQueue.ts | ✅ | Amélioration : `createdAt` dans le type `Omit` |
| 3bis offlineSync.ts | ✅ | Bonus : cache GET + mutations génériques |
| 4 useOnlineStatus.ts | ✅ | Auto-sync au retour de connexion |
| 5 OfflineBanner.tsx | ✅ | Bannière fixe top avec sync manuel |
| 5bis OfflineStatus.tsx | ✅ | Bonus : indicateur pill centré |
| 6 SyncReport.tsx | ✅ | Historique complet avec statuts |
| 7 OfflineBanner dans PrivateRoutes | ⚠️ | À vérifier — non visible dans PrivateRoutes.tsx actuel |
| 8 smsService.ts | ✅ | Amélioré : multi-provider (Techsoft + Africa's Talking) |
| 9 routes/sms.ts | ✅ | Webhook GET /api/sms/incoming |
| 9 server.ts smsRouter | ✅ | Monté sur /api/sms |
| 10 Variables .env | ⚠️ | À vérifier dans backend/.env |

---

## 5. DÉPENDANCES INSTALLÉES

### Backend — dependencies
| Package | Version |
|---------|---------|
| @ai-sdk/google | ^3.0.60 |
| @prisma/client | 6 |
| ai | ^6.0.154 |
| archiver | ^8.0.0 |
| axios | ^1.16.1 |
| bcryptjs | ^3.0.3 |
| cookie-parser | ^1.4.7 |
| cors | ^2.8.6 |
| dotenv | ^17.4.1 |
| express | ^5.2.1 |
| express-rate-limit | ^7.4.1 |
| helmet | ^8.1.0 |
| inngest | ^4.2.0 |
| jsonwebtoken | ^9.0.3 |
| morgan | ^1.10.1 |
| nodemailer | ^8.0.5 |
| otplib | ^13.4.0 |
| pdfkit | ^0.18.0 |
| prisma | 6 |
| qrcode | ^1.5.4 |
| resend | ^6.12.2 |
| socket.io | ^4.8.3 |
| zod | ^3.23.8 |

### Backend — devDependencies
| Package | Version |
|---------|---------|
| @types/archiver | ^7.0.0 |
| @types/bcryptjs | ^3.0.0 |
| @types/bun | latest |
| @types/cookie-parser | ^1.4.10 |
| @types/cors | ^2.8.19 |
| @types/express | ^5.0.6 |
| @types/jsonwebtoken | ^9.0.10 |
| @types/morgan | ^1.9.10 |
| @types/node | ^25.5.2 |
| @types/nodemailer | ^8.0.0 |
| @types/pdfkit | ^0.17.5 |
| @types/qrcode | ^1.5.6 |
| inngest-cli | ^1.17.9 |
| nodemon | ^3.1.14 |
| ts-node | ^10.9.2 |
| tsx | ^4.22.0 |

### Frontend — dependencies
| Package | Version |
|---------|---------|
| @hookform/resolvers | ^5.2.2 |
| @radix-ui/* (30+ packages) | ^1.x – ^2.x |
| @tailwindcss/vite | ^4.1.18 |
| axios | ^1.13.2 |
| class-variance-authority | ^0.7.1 |
| clsx | ^2.1.1 |
| cmdk | ^1.1.1 |
| date-fns | ^4.1.0 |
| embla-carousel-react | ^8.6.0 |
| input-otp | ^1.4.2 |
| lucide-react | ^0.562.0 |
| next-themes | ^0.4.6 |
| radix-ui | ^1.4.3 |
| react | ^19.2.0 |
| react-day-picker | ^9.13.0 |
| react-dom | ^19.2.0 |
| react-hook-form | ^7.70.0 |
| react-resizable-panels | ^4.2.2 |
| react-router | ^7.11.0 |
| recharts | 2.15.4 |
| socket.io-client | ^4.8.3 |
| sonner | ^2.0.7 |
| tailwind-merge | ^3.4.0 |
| tailwindcss | ^4.1.18 |
| vaul | ^1.1.2 |
| zod | ^4.3.5 |

### Frontend — devDependencies
| Package | Version |
|---------|---------|
| @eslint/js | ^9.39.1 |
| @types/node | ^25.0.3 |
| @types/react | ^19.2.5 |
| @types/react-dom | ^19.2.3 |
| @vitejs/plugin-react | ^5.1.1 |
| babel-plugin-react-compiler | ^1.0.0 |
| eslint | ^9.39.1 |
| globals | ^16.5.0 |
| tw-animate-css | ^1.4.0 |
| typescript | ~5.9.3 |
| typescript-eslint | ^8.46.4 |
| vite (rolldown-vite) | 7.2.5 |
| **vite-plugin-pwa** | ❌ **MANQUANT** |

---

## 6. ACTIONS REQUISES

### Critique (bloque la build PWA)
```bash
cd frontend
bun add -D vite-plugin-pwa
```

### Vérifier (intégration OfflineBanner)
Dans `frontend/src/pages/routes/PrivateRoutes.tsx`, s'assurer que `<OfflineBanner />` est présent avant `<SidebarProvider>`.

### Vérifier (.env backend)
S'assurer que `backend/.env` contient :
```
SMS_PROVIDER=techsoft
TECHSOFT_API_KEY=<votre clé>
TECHSOFT_SENDER_ID=TECHSOF-SMS
TECHSOFT_BASE_URL=https://app.techsoft-web-agency.com/sms/api
```
