# Arborescence du Backend EDUNEXUS

> Mis à jour le 2026-05-29 — reflète l'état réel du dossier `backend/`

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
│   ├── seed.ts                                              ← seed de données initiales
│   └── migrations/
│       ├── migration_lock.toml
│       │
│       ├── [sans timestamp — migrations legacy db push]
│       ├── complete_schema_v2/
│       │   └── migration.sql
│       ├── complete_schema_v3/
│       │   └── migration.sql
│       ├── fix_bac_coefficients_nullable/
│       │   └── migration.sql
│       ├── phase0_schema_complete/
│       │   └── migration.sql
│       └── zz_revert_timetable_unique/
│           └── migration.sql
│
│       [migrations timestampées — appliquées via migrate]
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
│       └── 20260524000000_add_draft_to_school_status/
│           └── migration.sql
│
└── src/
    ├── server.ts                                            ← point d'entrée Express + routes
    │
    ├── config/
    │   └── prisma.ts                                        ← instance Prisma Client partagée
    │
    ├── controllers/                                         ← logique métier (21 fichiers)
    │   ├── academicYear.ts
    │   ├── activitieslog.ts
    │   ├── ai.ts
    │   ├── attendance.ts
    │   ├── class.ts
    │   ├── classCouncil.ts                                  ← conseil de classe (NEW)
    │   ├── coreDomain.ts
    │   ├── dashboard.ts
    │   ├── emailLog.ts
    │   ├── exam.ts
    │   ├── finance.ts
    │   ├── grade.ts                                         ← notes / validation (NEW)
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
    │   ├── functions.ts                                     ← handlers d'événements Inngest
    │   └── index.ts                                         ← client Inngest
    │
    ├── lib/                                                 ← bibliothèques internes (NEW)
    │   └── classSerieValidator.ts                           ← validation séries BAC camerounais
    │
    ├── middleware/                                          ← middlewares Express (6 fichiers)
    │   ├── auth.ts                                          ← JWT verify + inject user
    │   ├── authMultiTenant.ts                               ← résolution tenant par subdomain
    │   ├── masterAuthSecurity.ts                            ← sécurité session master
    │   ├── masterSensitiveAuth.ts                           ← re-auth pour actions sensibles
    │   ├── rateLimit.ts
    │   └── validate.ts                                      ← validation Zod des requêtes
    │
    ├── routes/                                              ← définition des endpoints (23 fichiers)
    │   ├── academicYear.ts
    │   ├── activitieslog.ts
    │   ├── ai.ts
    │   ├── attendance.ts
    │   ├── class.ts
    │   ├── classCouncil.ts                                  ← NEW
    │   ├── coreDomain.ts
    │   ├── dashboard.ts
    │   ├── emailLog.ts
    │   ├── exam.ts
    │   ├── finance.ts
    │   ├── grade.ts                                         ← NEW
    │   ├── masterAdmin.ts
    │   ├── parent.ts
    │   ├── public.ts                                        ← routes non-authentifiées
    │   ├── reportCard.ts
    │   ├── schoolOnboarding.ts
    │   ├── schoolSettings.ts
    │   ├── search.ts
    │   ├── sms.ts                                           ← NEW
    │   ├── subject.ts
    │   ├── timetable.ts
    │   └── user.ts
    │
    ├── scripts/                                             ← scripts utilitaires Bun (8 fichiers)
    │   ├── create-test-data.ts                              ← création données de test (NEW)
    │   ├── delete-test-data.ts                              ← suppression données de test (NEW)
    │   ├── list-gemini-models.ts                            ← liste des modèles Gemini dispo (NEW)
    │   ├── migrate-phase5.ts
    │   ├── migrate-phase8.ts
    │   ├── remove-test-data.ts                              ← variante suppression test (NEW)
    │   ├── reset-master.ts                                  ← reset du compte SuperAdmin (NEW)
    │   └── seed-week4.ts
    │
    ├── services/                                            ← intégrations tierces (4 fichiers)
    │   ├── campay.ts                                        ← Mobile Money MTN/Orange (NEW)
    │   ├── emailService.ts
    │   ├── gemini.ts                                        ← Google Gemini AI (NEW)
    │   └── smsService.ts
    │
    ├── socket/
    │   └── io.ts                                            ← serveur Socket.io
    │
    ├── tests/                                               ← tests unitaires et intégration (4 fichiers)
    │   ├── bulletinPolicy.test.ts
    │   ├── gradingEngine.test.ts
    │   ├── masterMfa.test.ts                                ← tests MFA master (NEW)
    │   └── phase8-rules.integration.test.ts
    │
    ├── types/                                               ← déclarations TypeScript (2 fichiers)
    │   ├── email.ts
    │   └── express.d.ts                                     ← augmentation types Express (NEW)
    │
    ├── utils/                                               ← utilitaires métier (15 fichiers)
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
    │   └── reportCards/                                     ← générateur PDF bulletins (NEW)
    │       ├── helpers.ts
    │       ├── index.ts
    │       └── templates.ts
    │
    └── validation/
        └── schemas.ts                                       ← schémas Zod partagés
```

## Résumé

- **Nombre de fichiers source `.ts`:** ~95 (hors node_modules, dist)
- **Migrations Prisma:** 14 (5 legacy sans timestamp + 9 timestampées)
- **Base de données:** PostgreSQL 15 avec Prisma ORM
- **Architecture:** Controllers → Routes → Middleware → Services → Utils

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/server.ts` | Point d'entrée — Express, routes, Socket.io |
| `src/config/prisma.ts` | Instance Prisma Client partagée (singleton) |
| `src/middleware/authMultiTenant.ts` | Résolution du tenant school par sous-domaine |
| `src/middleware/masterAuthSecurity.ts` | Sécurité double-facteur session SuperAdmin |
| `src/controllers/masterAdmin.ts` | Hub de contrôle — invite/approuve/suspend écoles |
| `src/controllers/schoolOnboarding.ts` | Workflow onboarding + provisioning école |
| `src/controllers/grade.ts` | Saisie, validation et calcul des notes |
| `src/controllers/classCouncil.ts` | Conseil de classe — décisions + rapport PDF |
| `src/services/campay.ts` | Paiement Mobile Money (Campay — MTN + Orange) |
| `src/services/gemini.ts` | Génération emploi du temps IA (Google Gemini) |
| `src/utils/gradingEngine.ts` | Moteur de calcul moyennes MINESEC |
| `src/utils/bulletinPolicy.ts` | Règles d'accès bulletins (rôles, périodes) |
| `src/utils/reportCards/` | Génération PDF bulletins scolaires |
| `src/lib/classSerieValidator.ts` | Validation séries et mentions BAC camerounais |
| `src/scripts/reset-master.ts` | Reset compte SuperAdmin (urgence) |
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
