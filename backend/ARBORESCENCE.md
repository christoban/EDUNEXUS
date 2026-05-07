# Arborescence du Backend EDUNEXUS

```
backend/
├── .env
├── bun.lock
├── package.json
├── tsconfig.json
├── README.md
├── README_PROJECT.md
├── README_ACCESS_POLICY.md
├── create-admin.ts
├── create-schools.ps1
│
└── src/
    ├── server.ts
    │
    ├── config/
    │   ├── db.ts
    │   └── dbRouter.ts
    │
    ├── middleware/
    │   ├── auth.ts
    │   ├── authMultiTenant.ts
    │   ├── masterAuthSecurity.ts
    │   ├── masterSensitiveAuth.ts
    │   ├── rateLimit.ts
    │   └── validate.ts
    │
    ├── models/
    │   ├── academicPeriod.ts
    │   ├── academicYear.ts
    │   ├── activitieslog.ts
    │   ├── attendance.ts
    │   ├── class.ts
    │   ├── emailLog.ts
    │   ├── exam.ts
    │   ├── examGeneration.ts
    │   ├── expense.ts
    │   ├── feePlan.ts
    │   ├── grade.ts
    │   ├── invoice.ts
    │   ├── masterAuthAudit.ts
    │   ├── masterUser.ts
    │   ├── payment.ts
    │   ├── reportCard.ts
    │   ├── school.ts
    │   ├── schoolComplex.ts
    │   ├── schoolConfig.ts
    │   ├── schoolInvite.ts
    │   ├── schoolSettings.ts
    │   ├── section.ts
    │   ├── smsLog.ts
    │   ├── submission.ts
    │   ├── subSystem.ts
    │   ├── subject.ts
    │   ├── timetable.ts
    │   └── timetableGeneration.ts
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
    ├── utils/
    │   ├── activitieslog.ts
    │   ├── bulletinPolicy.ts
    │   ├── coreDomainDefaults.ts
    │   ├── emailTemplates.ts
    │   ├── generateToken.ts
    │   ├── gradingEngine.ts
    │   ├── initializeSchoolDatabase.ts
    │   ├── languageHelper.ts
    │   ├── masterAuthAudit.ts
    │   ├── reporting.ts
    │   ├── reportCardTemplates.ts
    │   ├── schoolOnboarding.ts
    │   └── schoolSettings.ts
    │
    ├── services/
    │   ├── emailService.ts
    │   └── smsService.ts
    │
    ├── socket/
    │   └── io.ts
    │
    ├── validation/
    │   └── schemas.ts
    │
    ├── scripts/
    │   ├── migrate-phase5.ts
    │   ├── migrate-phase8.ts
    │   └── seed-week4.ts
    │
    ├── tests/
    │   ├── bulletinPolicy.test.ts
    │   ├── gradingEngine.test.ts
    │   └── phase8-rules.integration.test.ts
    │
    └── inngest/
        ├── functions.ts
        └── index.ts
```

## Résumé

- **Nombre de fichiers:** ~100
- **Architecture:** MVC (Models, Views/Controllers, Routes, Utils)
- **Technologies:** TypeScript, Bun, Express, MongoDB (Mongoose), Socket.io, Inngest, Google AI (Gemini)
- **Fonctionnalités:**
  - Authentification multi-tenant avec Database Router
  - Gestion des écoles (school management)
  - Gestion des utilisateurs et rôles
  - Gestion académique (classes, matières, emploi du temps, examens)
  - Génération d'emploi du temps par IA (Google Gemini)
  - Gestion des notes et bulletins
  - Gestion financière (factures, paiements, plans de frais)
  - Services email/SMS (Nodemailer, Resend)
  - Événements asynchrones (Inngest)
  - Tests unitaires et d'intégration
  - Multi-bases de données (1 MASTER + N bases écoles)
