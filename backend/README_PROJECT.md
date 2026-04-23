# Documentation Technique - Backend EDUNEXUS

## Vue d'Ensemble

Le backend EDUNEXUS est une API REST complète built avec Bun/Express et MongoDB. Il gère le système SaaS multi-tenant pour la gestion d'établissements scolaires au Cameroun.

---

## Structure des Répertoires

```
backend/
├── src/
│   ├── controllers/       # Logique métier principale
│   ├── models/            # Schémas MongoDB
│   ├── routes/           # Définitions des routes API
│   ├── middleware/      # Intercepteurs (auth, validation)
│   ├── services/        # Services externes (email, SMS)
│   ├── utils/           # Fonctions utilitaires
│   ├── config/          # Configuration DB
│   ├── validation/     # Schémas de validation
│   ├── scripts/        # Scripts de migration
│   ├── tests/          # Tests d'intégration
│   ├── inngest/        # Fonctions événementielles
│   └── socket/         # WebSocket (temps réel)
├── .env                 # Variables d'environnement
├── package.json
├── tsconfig.json
└── README.md
```

---

## Détail par Dossier

### 1. `src/controllers/` - Logique Métier

| Fichier | Rôle |
|---------|------|
| `masterAdmin.ts` | Gestion Master Admin (super admin) |
| `schoolOnboarding.ts` |流程 d'inscription écoles |
| `user.ts` | Gestion utilisateurs |
| `class.ts` | Gestion classes |
| `subject.ts` | Gestion matières |
| `dashboard.ts` | Statistiques et tableaux de bord |
| `finance.ts` | Opérations financières (paiements, factures) |
| `reportCard.ts` | Génération des bulletins |
| `attendance.ts` | Gestion des présences |
| `exam.ts` | Gestion des examens |
| `timetable.ts` | Gestion des emplois du temps |
| `parent.ts` | Interface parents |
| `ai.ts` | Intégrations IA |
| `search.ts` | Recherche globale |
| `schoolSettings.ts` | Configuration école |
| `activitieslog.ts` | Journal d'activité |
| `emailLog.ts` | Suivi des emails |
| `academicYear.ts` | Gestion années scolaires |
| `coreDomain.ts` | Domaines fondamentaux |

### 2. `src/models/` - Schémas MongoDB

| Fichier | Rôle |
|---------|------|
| `school.ts` | Modèle principal école/établissement |
| `schoolInvite.ts` | Invitations d'inscription |
| `user.ts` | Utilisateurs |
| `class.ts` | Classes |
| `subject.ts` | Matières |
| `academicYear.ts` | Années scolaires |
| `section.ts` | Divisions (primaire, secondaire) |
| `grade.ts` | Niveaux/classes |
| `attendance.ts` | Présences |
| `exam.ts` | Exams |
| `submission.ts` | Soumissions |
| `examGeneration.ts` | Génération Examens IA |
| `timetable.ts` | Emploi du temps |
| `timetableGeneration.ts` | Génération timetable |
| `invoice.ts` | Factures |
| `payment.ts` | Paiements |
| `feePlan.ts` | Plans de frais |
| `expense.ts` | Dépenses |
| `reportCard.ts` | Bulletins |
| `schoolSettings.ts` | Paramètres école |
| `schoolComplex.ts` | Complexes scol. |
| `schoolConfig.ts` | Config technique |
| `subSystem.ts` | Sous-systèmes |
| `masterUser.ts` | Comptes Master Admin |
| `masterAuthAudit.ts` | Audit auth Master |
| `emailLog.ts` | Logs emails |
| `smsLog.ts` | Logs SMS |
| `activitieslog.ts` | Journal activités |

### 3. `src/routes/` - Routes API

| Fichier | Préfixe | Description |
|---------|---------|-------------|
| `masterAdmin.ts` | `/master/*` | Routes Master Admin |
| `schoolOnboarding.ts` | `/onboarding/*` | Inscription écoles |
| `user.ts` | `/users/*` | CRUD utilisateurs |
| `class.ts` | `/classes/*` | Classes |
| `subject.ts` | `/subjects/*` | Matières |
| `dashboard.ts` | `/dashboard/*` | Stats |
| `finance.ts` | `/finance/*` | Finance |
| `reportCard.ts` | `/report-card/*` | Bulletins |
| `attendance.ts` | `/attendance/*` | Présences |
| `exam.ts` | `/exams/*` | Exams |
| `timetable.ts` | `/timetable/*` | EDT |
| `parent.ts` | `/parent/*` | Interface parents |
| `ai.ts` | `/ai/*` | IA |
| `search.ts` | `/search/*` | Recherche |
| `schoolSettings.ts` | `/settings/*` | Config |
| `activitieslog.ts` | `/activities-log/*` | Activités |
| `emailLog.ts` | `/email-log/*` | Emails |
| `academicYear.ts` | `/academic-years/*` | Années |

### 4. `src/middleware/` - Intercepteurs

| Fichier | Rôle |
|---------|------|
| `auth.ts` | Authentification JWT |
| `authMultiTenant.ts` | Router vers DB école |
| `masterSensitiveAuth.ts` | Auth sensitive (MFA) |
| `masterAuthSecurity.ts` |Sécurité Master |
| `rateLimit.ts` | Limitation requêtes |
| `validate.ts` | Validation données |

### 5. `src/services/` - Services Externes

| Fichier | Service |
|---------|---------|
| `emailService.ts` | Envoi emails (SMTP/SendGrid) |
| `smsService.ts` | Envoi SMS |

### 6. `src/utils/` - Utilitaires

| Fichier | Rôle |
|---------|------|
| `schoolOnboarding.ts` | Logique onboarding |
| `emailTemplates.ts` | Templates emails |
| `generateToken.ts` | Génération tokens |
| `activitieslog.ts` | Journal |
| `reporting.ts` | Rapports |
| `gradingEngine.ts` | Calcul notes |
| `bulletinPolicy.ts` | Règles bulletins |
| `reportCardTemplates.ts` | Templates bulletins |
| `schoolSettings.ts` | Settings |
| `coreDomainDefaults.ts` | Defaults domaines |
| `languageHelper.ts` | i18n |

### 7. `src/config/` - Configuration

| Fichier | Rôle |
|---------|------|
| `db.ts` | Connexion MongoDB principale |
| `dbRouter.ts` | Routage multi-tenant |

### 8. `src/scripts/` - Migrations

| Fichier | Description |
|---------|-------------|
| `migrate-phase5.ts` | Migration phase 5 |
| `migrate-phase8.ts` | Migration phase 8 |
| `seed-week4.ts` | Seed données test |

### 9. `src/inngest/` - Événements

| Fichier | Rôle |
|---------|------|
| `functions.ts` | Fonctions inngest (background jobs) |
| `index.ts` | Configuration |

---

## Flux Utilisateur

```
1. École s'inscrit → /onboarding/school
2. Master Admin approuve → /master/schools
3. École activée → crée son admin
4. Admin école crée utilisateurs
5. Profs ajoutent notes/présences
6. Parents consultent bulletins
```

---

## Authentification

| Niveau | Route | Méthode |
|--------|-------|--------|
| Public | `/onboarding/*` | Token invitation |
| Master | `/x9-private-master-entry` | Password + MFA |
| École | `/login` | JWT |
| API | Toutes | JWT Bearer |

---

## Points d'Entrée Principaux

| Service | URL Base |
|---------|---------|
| Onboarding | `/onboarding` |
| Master Admin | `/master` |
| École | `/api/v1/*` |
| Parent | `/parent` |
| IA | `/ai` |

---

## Variables d'Environnement

```
PORT=3000
MONGODB_URI=...
MASTER_PASSWORD_HASH=...
JWT_SECRET=...
SENDGRID_API_KEY=...
VITE_MASTER_LOGIN_PATH=/x9-private-master-entry
```

---

## Modifié Dernièrement

- `DashboardSuperAdmin.tsx` - Page super admin
- `InviteSchoolForm.tsx` - Formulaire invitation
- SchoolsTable, AuditLog, ProtectedSuperAdmin
- Routes ajoutées dans router.tsx
- CSS superadmin.css créé