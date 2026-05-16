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
│   └── migrations/
│       ├── migration_lock.toml
│       ├── 20260506214233_init/
│       │   └── migration.sql
│       └── 20260507111020_add_master_user_mfa_and_auth_fields/
│           └── migration.sql
│
└── src/
    ├── server.ts
    │
    ├── config/
    │   └── prisma.ts
    │
    ├── controllers/
    │   ├── academicYear.ts
    │   ├── activitieslog.ts
    │   ├── ai.ts
    │   ├── attendance.ts
    │   ├── class.ts
    │   ├── coreDomain.ts
    │   ├── dashboard.ts
    │   ├── emailLog.ts
    │   ├── exam.ts
    │   ├── finance.ts
    │   ├── masterAdmin.ts
    │   ├── parent.ts
    │   ├── reportCard.ts
    │   ├── schoolOnboarding.ts
    │   ├── schoolSettings.ts
    │   ├── search.ts
    │   ├── subject.ts
    │   ├── timetable.ts
    │   └── user.ts
    │
    ├── inngest/
    │   ├── functions.ts
    │   └── index.ts
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
    │   ├── academicYear.ts
    │   ├── activitieslog.ts
    │   ├── ai.ts
    │   ├── attendance.ts
    │   ├── class.ts
    │   ├── coreDomain.ts
    │   ├── dashboard.ts
    │   ├── emailLog.ts
    │   ├── exam.ts
    │   ├── finance.ts
    │   ├── masterAdmin.ts
    │   ├── parent.ts
    │   ├── public.ts
    │   ├── reportCard.ts
    │   ├── schoolOnboarding.ts
    │   ├── schoolSettings.ts
    │   ├── search.ts
    │   ├── subject.ts
    │   ├── timetable.ts
    │   └── user.ts
    │
    ├── scripts/
    │   ├── migrate-phase5.ts
    │   ├── migrate-phase8.ts
    │   └── seed-week4.ts
    │
    ├── services/
    │   ├── emailService.ts
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
    │   └── email.ts
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
    │   └── schoolSettings.ts
    │
    └── validation/
        └── schemas.ts
```

## Résumé

- **Nombre de fichiers:** ~75 (hors node_modules)
- **Base de données:** PostgreSQL avec Prisma ORM (migrations)
- **Architecture:** Controllers, Routes, Middleware, Services, Utils
- **Technologies:** TypeScript, Bun, Express, Prisma, Socket.io, Inngest, Google AI (Gemini)
- **Fonctionnalités:**
  - Authentification multi-tenant avec middleware dédié
  - Gestion des écoles (onboarding, configuration)
  - Gestion des utilisateurs et rôles
  - Gestion académique (classes, matières, emploi du temps, examens)
  - Génération d'emploi du temps par IA (Google Gemini)
  - Gestion des notes, bulletins et relevés
  - Gestion financière (factures, paiements, plans de frais)
  - Services email/SMS
  - Événements asynchrones (Inngest)
  - Tests unitaires et d'intégration
  - Base de données unique avec schéma multi-école
