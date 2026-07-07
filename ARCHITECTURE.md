# ARCHITECTURE — EduNexus

> Vision globale de l'application. À lire en premier par toute IA ou tout développeur qui rejoint le projet.
> Documents liés : [MODULE_INDEX.md](MODULE_INDEX.md) · [FEATURES.md](FEATURES.md) · [CONVENTIONS.md](CONVENTIONS.md) · [AGENTS.md](AGENTS.md)

---

## 1. Qu'est-ce qu'EduNexus ?

SaaS **multi-tenant** de gestion scolaire pour les établissements **camerounais** (système MINESEC). Une seule base gère plusieurs écoles isolées par `schoolId`. Le produit couvre l'inscription/onboarding d'un établissement, la gestion des utilisateurs, classes, matières, notes, bulletins, présences, emplois du temps, finances (Mobile Money), communications, orientation, RH, discipline, etc.

Spécificités métier camerounaises structurantes (voir [FEATURES.md](FEATURES.md)) :
- **Sous-systèmes** : `FRANCOPHONE`, `ANGLOPHONE`, `BILINGUAL` (deux sections cohabitant).
- **Templates d'établissement** (~17 : CES, Lycée général/technique, GHS/GSS anglophones, primaire, maternelle, complexe…).
- **Cycles** : maternelle / primaire / 1er cycle (6e–3e) / 2nd cycle (2nde–Tle) / technique.
- **Programme Spécial Bilingue (PEBS)** : variable orthogonale activable sur tout établissement général.
- **LV2** (2e langue vivante) : commence en 4e.
- **Anglophone** : O-Level / A-Level (GCE), streams Arts/Sciences.
- Coefficients MINESEC déterministes, mentions, séries BAC.

---

## 2. Vue d'ensemble (monorepo)

```
EDUNEXUS/
├── backend/      API — Bun + Express + Prisma + PostgreSQL — architecture HEXAGONALE
├── frontend/     Web — Next.js 16 (App Router) + React 19 + Tailwind v4
└── *.md          Documentation projet (ce fichier, MODULE_INDEX, FEATURES, CONVENTIONS, AGENTS)
```

- **Runtime** : **Bun** partout (backend exécute le TS directement, pas de build backend).
- **Plateforme de dev** : Windows (voir gotchas §9 et [AGENTS.md](AGENTS.md)).
- **Communication front↔back** : REST `/api/v2/*` (cookies HTTP-only pour l'auth) + **Socket.io** (temps réel) + **Inngest** (jobs asynchrones).

---

## 3. Backend — architecture hexagonale (Ports & Adapters)

Le backend applique une **architecture hexagonale** stricte en 3 couches. Règle de dépendance : **l'extérieur dépend de l'intérieur, jamais l'inverse**.

```
                 ┌──────────────────────────────────────────────┐
   HTTP / Socket │              INFRASTRUCTURE                   │  ← adapters (Express, Prisma,
   / Inngest ───▶│  controllers · routes · repositories Prisma  │     Groq, Campay, Resend, PDFKit…)
                 │  services externes · container · bootstrap    │
                 └───────────────────┬──────────────────────────┘
                                     │ implémente les PORTS / appelle les USE CASES
                 ┌───────────────────▼──────────────────────────┐
                 │               APPLICATION                     │  ← orchestration métier
                 │   Use Cases (par domaine) — sans I/O direct   │
                 └───────────────────┬──────────────────────────┘
                                     │ dépend des ENTITÉS + PORTS (interfaces)
                 ┌───────────────────▼──────────────────────────┐
                 │                 DOMAIN                        │  ← cœur métier pur
                 │  entities · value-objects · rules · ports     │     (aucune dépendance technique)
                 │  errors · types · constants                   │
                 └──────────────────────────────────────────────┘
```

### 3.1 `domain/` — le cœur métier (aucune dépendance technique)
- `entities/` : agrégats riches avec logique métier (`School`, `User`, `Classe`, `Note`, `Bulletin`, `Facture`, `Paiement`, `Presence`, `EmploiDuTemps`, `CreneauHoraire`, `FicheOrientation`, `Depense`, `PlanFrais`).
- `ports/repositories/` : **interfaces** de persistance (ce dont le métier a besoin, pas comment).
- `ports/services/` : **interfaces** des services externes (`EmailService`, `PdfService`, `IAService`, `SmsService`, `PaiementService`, `TokenService`, `NotificationService`).
- `rules/` : règles métier pures (ex. `StaffPermissionRules` — titre terrain → permissions).
- `value-objects/`, `types/` (enums), `constants/`, `errors/` (erreurs domaine typées).

### 3.2 `application/` — les cas d'usage (orchestration)
19 modules par domaine (`class`, `subject`, `grade`, `reportCard`, `finance`, `timetable`, `school`, `student`, `user`, `masterAdmin`, `orientation`, `attendance`, `academicYear`, `classCouncil`, `schoolSettings`, `parent`, `ai`, `assistant`, `messaging`). Chaque use case :
- reçoit ses dépendances par **injection de constructeur** (ports, pas d'implémentations) ;
- ne touche **jamais** Prisma/HTTP directement (sauf `prisma?` optionnel injecté ponctuellement pour des lectures, cf. `GenererBulletinUseCase`) ;
- porte une méthode `execute(commande)` retournant un résultat typé ;
- est **testable en isolation** via des repos/services in-memory (`__tests__/helpers/`).

### 3.3 `infrastructure/` — les adapters (le monde réel)
- `http/controllers/` (37) : traduisent HTTP ↔ use cases. `http/routes/` (33) : montage Express + middlewares (`requireAuth`, `requireRole`). `http/dto/`, `http/middlewares/`.
- `persistence/prisma/` (21 repos) : implémentent les ports repository via Prisma.
- `services/` : adapters externes implémentant les ports (`GroqIAService` [Groq], `CampayPaiementService` [Mobile Money], `NodemailerEmailService`/Resend, `SmsNotificationService`, `PdfKitBulletinService`, `JwtTokenService`, `SocketNotificationService`).
- `config/container.ts` : **composition root** — instancie repos + services + use cases et les câble. `config/hexagonal.bootstrap.ts` : monte toutes les routes sur l'app Express à partir du container.
- `inngest/`, `socket/`, `pdf/`.

> ⚠️ Le repo contient aussi des **dossiers utilitaires hors hexagone** (historiques ou transverses) : `services/` (campay, emailService, groq, smsService), `utils/` (reportCards, schoolDocuments, hrDocuments, emailTemplates, languageHelper), `middleware/`, `inngest/`, `socket/`, `scripts/`, `validation/`, `lib/`. Ils sont utilisés directement par l'infrastructure. Ne pas les confondre avec les couches hexagonales.

### 3.4 Point d'entrée
`backend/src/server.ts` → crée l'app Express, appelle le bootstrap (container + routes), démarre Socket.io et le serveur HTTP.

---

## 4. Frontend — Next.js App Router par rôle

```
frontend/src/
├── app/
│   ├── login/ · reset-password/ · invite/            pages publiques
│   ├── onboarding/[token]/                            Phase 1 : questionnaire d'inscription (wizard)
│   ├── admin/configuration/                           Phase 2 : onboarding conversationnel + activation
│   ├── admin/ teacher/ staff/ parent/ student/ master/  dashboards par rôle (voir MODULE_INDEX)
│   └── api/                                           routes Next (le cas échéant)
├── components/     partagés : AnimatedBackground, ThemeToggle, LanguageSwitch, LandingPage, ui/ (shadcn)
└── lib/            fetchApi, i18n/, offline/ (Dexie/PWA), userAuth, colors, utils
```

- **Dashboards** : chaque rôle a un `dashboard/page.tsx` + `_components/Section*.tsx` (admin 20, teacher 11, staff 13, parent 7, student 6, master 3) + une sidebar + topbar + toasts.
- **Styles** : **inline styles** majoritaires + tokens CSS (`var(--bg)`, `var(--text)`…) définis dans `globals.css`, plus quelques utilitaires Tailwind. Thème clair/sombre via **next-themes** + `@custom-variant dark` (Tailwind v4).
- **i18n** : système **maison** (`src/lib/i18n`), 12 namespaces × fr/en, dictionnaires importés **statiquement**. Langue dérivée de l'établissement/section (jamais de l'URL).
- **Offline/PWA** : `@ducanh2912/next-pwa` + **Dexie** (IndexedDB) pour la file d'attente offline (`lib/offline`).
- **Data fetching** : `fetchApi` (wrapper `fetch` avec cookies) vers `/api/v2/*`. Temps réel via `socket.io-client`.

---

## 5. Rôles & multi-tenancy

| Rôle | Portée | Auth |
|---|---|---|
| **MASTER** | Plateforme (super-admin EduNexus) : invite/approuve/suspend les écoles | JWT master + **MFA (otplib)**, audit |
| **ADMIN** | Une école : configuration + toutes les capacités admin | JWT cookie `access_token`, `schoolId` |
| **STAFF** | Une école, permissions granulaires via `StaffPermissionType` (Censeur, Intendant, Surveillant Général, HOD…) | idem + `permissions[]` |
| **TEACHER / PARENT / STUDENT** | Une école, périmètre restreint | idem |

- **Isolation** : chaque requête est bornée par `req.user.schoolId` ; toutes les requêtes Prisma filtrent par `schoolId`.
- **RBAC** : `requireAuth` (vérifie le JWT) + `requireRole(...)` (middleware). Les titres staff → permissions via `domain/rules/StaffPermissionRules`.

---

## 6. Circulation des données (exemple : générer les bulletins d'une classe)

```
Frontend (SectionBulletins) ──POST /api/v2/report-cards/generate──▶ ReportCardController
   └─▶ GenererBulletinUseCase.execute()                    (application)
        ├─ lit notes/élèves/coeffs via repositories        (ports → PrismaRepositories)
        ├─ calcule moyennes / rangs / mentions             (domain: Bulletin, règles)
        ├─ résout la langue via resolveLanguage()          (utils/languageHelper)
        └─ PdfService.genererBulletin()                    (port → PdfKitBulletinService → utils/reportCards)
   └─▶ réponse JSON (stats) ; PDF stocké / envoyé
```

Autres flux importants :
- **Jobs asynchrones (Inngest)** : génération de bulletins en masse, génération auto d'emploi du temps (IA), notifications — `inngest/functions.ts`.
- **Temps réel (Socket.io)** : notifications in-app poussées via `SocketNotificationService`.
- **Paiement Mobile Money** : `InitierPaiementMobileMoneyUseCase` → `CampayPaiementService` → webhook Campay → `TraiterWebhookCampayUseCase`.
- **IA (Groq)** : assistant, insights, commentaires de bulletin, EDT auto — via `services/groq.ts` / `GroqIAService` (modèle **Groq** `llama-3.3-70b`).

---

## 7. Dépendances importantes

**Backend** : Express, Prisma/PostgreSQL, Zod (validation), jsonwebtoken + bcryptjs + otplib (auth/MFA), `@ai-sdk/groq` + `ai` (IA), Inngest (jobs), Socket.io (temps réel), PDFKit (bulletins), Nodemailer + Resend (email), Campay via axios (Mobile Money), multer + xlsx (imports), archiver (ZIP), helmet + cors + express-rate-limit (sécurité).

**Frontend** : Next 16 + React 19, Tailwind v4, next-themes (thème), Recharts (graphes), framer-motion + lenis (animations), react-hook-form + @hookform/resolvers + zod (formulaires), @dnd-kit (drag & drop, ex. emploi du temps), Dexie + next-pwa (offline), socket.io-client, sonner (toasts), lucide-react (icônes), shadcn/@base-ui (primitives UI).

---

## 8. Décisions architecturales importantes (ADR condensées)

1. **Hexagonal côté backend** : découple le métier des frameworks → testabilité (34 fichiers de tests, repos in-memory) et remplaçabilité des adapters.
2. **Multi-tenant à base partagée** (`schoolId`) plutôt qu'une base par école : simplicité opérationnelle ; l'isolation est une **responsabilité applicative stricte**.
3. **Source unique de langue** : `resolveLanguage(subsystem, sectionCode?)` (backend `utils/languageHelper`, miroir frontend `lib/i18n`). Ne jamais recréer de logique de langue. Langue dérivée des données, pas de l'URL.
   - **Pages « universelles » (sans établissement précis)** — `login`, landing publique, onboarding (`/onboarding/[token]` et `/admin/configuration`) : elles servent **tous** les établissements (FR/EN/bilingue), donc la langue **n'est PAS dérivée d'une école**. Elles démarrent en **français par défaut** et exposent un **toggle FR/EN** (`components/LanguageSwitch`) dont le choix est **mémorisé** (`localStorage edunexus_lang_override`, priorité maximale dans le provider). La langue officielle de l'établissement ne s'applique **qu'une fois connecté au dashboard** (école `ACTIVE`).
4. **Onboarding en 2 phases** : Phase 1 wizard token (structure) → Phase 2 conversationnel (affinage + activation déterministe). La Phase 2 **se nourrit** de la Phase 1 (réconciliation).
5. **Exécution déterministe de la configuration** (coefficients MINESEC exacts) plutôt que génération 100 % LLM.
6. **PEBS orthogonal au template** : le « bilingue » établissement (2 sections) ≠ le Programme Spécial Bilingue (flag activable). Ne pas les fusionner.
7. **i18n frontend maison** (pas de lib) + dictionnaires **statiques** : bascule FR↔EN fiable sur tout appareil.
8. **Thème via tokens CSS + next-themes** : migration progressive des couleurs hex vers `var(--token)`.
9. **IA via Groq** — point d'entrée `generateWithGroq` / `groqModel` (`services/groq.ts`), adapter `GroqIAService`.

---

## 9. Contraintes d'environnement (Windows) — à respecter absolument

- **Vérif TS** : `cd backend && ./node_modules/.bin/tsc --noEmit` (idem `frontend/`). Jamais `npx tsc`.
- **Migrations** : `npx prisma migrate dev --name X --skip-generate` depuis `backend/`.
- **`prisma generate` échoue** (EPERM verrou DLL) — attendu. Pour un **nouveau modèle**, utiliser `(prisma as any).monModele` au runtime.
- **Smoke tests** : `bun _smoke.ts` **dans** `backend/` (jamais `/tmp`), puis supprimer le fichier.
- **Backend sans build** : `bun run dev` / `bun run start`. **Build = frontend uniquement** (`bun run build`).

Détails complets et méthode de travail : voir **[AGENTS.md](AGENTS.md)**.

---

## 10. Maintenance de ce document

Ce fichier fait **partie du projet**. Toute modification structurante (nouvelle couche, nouveau service externe, changement de flux majeur, nouveau rôle) doit s'accompagner d'une mise à jour d'ARCHITECTURE.md et, si besoin, de MODULE_INDEX.md / FEATURES.md. Le Tech Lead (IA architecte) propose ces mises à jour automatiquement.
