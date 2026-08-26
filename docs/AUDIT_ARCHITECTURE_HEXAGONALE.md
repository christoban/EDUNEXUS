  # Audit Architecture Hexagonale & Taille des Fichiers — ZekoulABia

> Audit complet réalisé par inspection directe du code (`backend/src`, `frontend/src`, `docs`). Chaque ligne cite des fichiers réellement lus/grep, jamais supposés.
> **Date** : 2026-08-24
> **Périmètre** : backend (Bun + Express + Prisma), frontend (Next.js App Router).

**Objectif** : relever toutes les violations de l'architecture hexagonale + tous les fichiers hors plafond de taille, classer ces derniers en 3 catégories, signaler les fichiers < 600 lignes mais multi-responsabilités, et proposer une solution pour chaque cas.

---

# PARTIE 1 — Violations de l'architecture hexagonale

## Légende des statuts

| Statut | Signification |
|---|---|
| 🔴 | Violation avérée et importante |
| 🟠 | Violation mineure / dette acceptée |
| 🟡 | Risque / à surveiller |
| ✅ | Conforme |

---

## 1.1 ✅ RÉSOLU — `application/` dépendait de `PrismaClient` (Dependency Inversion cassée)

> **Statut : résolu** par le chantier **P1** (`docs/PLAN_P1_SUPPRESSION_PRISMA_APPLICATION.md`, Vagues 0 → 13).
> La règle violée (SOLID D) est rétablie : `application/` ne dépend plus que de ports (`domain/ports/`).

### Preuve (état final P1)

```
grep -rln "@prisma/client" src/application   → 0 fichier
grep -rln "prisma\." src/application         → 0 fichier
./node_modules/.bin/tsc --noEmit             → clean
bun test                                     → 716 pass, 0 fail
```

- **115 fichiers** ont été portés vers ~20 ports (`domain/ports/repositories/`, 61 ports au total) + adapters `Prisma*`.
- **Transactions multi-tables** encapsulées en méthodes de port atomiques (§4.12) : `SchoolActivationRepository.activerEtablissement` (Unit of Work, la tx géante de 1095 lignes), `EleveOnboardingRepository.validerOnboarding`, `StaffProfileRepository.assignerAP`…
- **Garde-fou CI** : `backend/tests/unit/p1ArchitectureGuard.test.ts` échoue si `@prisma/client` / `this.prisma` / `ctx.prisma` réapparaît dans `application/`.

### Notes d'exécution (décisions déviant du plan initial)

- `ActiverEtablissement` : port **Unit of Work** (`SchoolActivationTx`, ~30 méthodes) plutôt que « `activerEtablissement(donneesCompletes)` » — préserve la logique verbatim et l'atomicité.
- **Catalogues du copilot IA** (`assistant/catalog/*`) : déplacés `application/` → `infrastructure/` (usines à outils consommées uniquement par l'infra) plutôt qu'un `AssistantCatalogQueryPort` — le plan sous-estimait de 13× l'ampleur (106 sites `ctx.prisma`, pas 8).

### Historique (diagnostic d'origine)

La majorité des bounded contexts avaient été écrits avant la mise en place des ports. La couche `application` parlait directement à Prisma (115 fichiers, en plus des 33 adapters `Prisma*`).

---

## 1.2 ✅ RÉSOLU — Couche `application/` qui importait depuis `infrastructure/` (sens de dépendance inversé)

> **Statut : résolu** par le chantier **§1.2** (5 ports services créés + 5 adapters + 10 use cases refactorés + DI câblée).
> La règle SOLID D est rétablie : `application/` ne dépend plus que de ports (`domain/ports/`).

### Preuve (état final)

```
grep -rln "from '@infrastructure|from '../../infrastructure" src/application → 0 fichier
./node_modules/.bin/tsc --noEmit → clean
bun test → 717 pass, 0 fail
```

### Résolution détaillée

**5 ports créés** dans `domain/ports/services/` :
- `SmsNotificationPort` — `notifyBulletinSms`, `notifyLv2WindowOpenSms`
- `DocumentAiPort` — `extraireDocument`
- `EmailTemplatePort` — `buildSchoolInviteTemplate`
- `RealtimeSocketPort` — `emettre` (emettre dans un salon socket)
- `SchedulingGridPort` — `calculerSqelette`

**5 adapters créés** dans `infrastructure/` :
- `SmsNotificationAdapter` (`services/sms/`)
- `DocumentAiAdapter` (`services/ai/`)
- `EmailTemplateAdapter` (`services/email/`)
- `RealtimeSocketAdapter` (`socket/`)
- `SchedulingGridAdapter` (`scheduling/`)

**10+ use cases refactorés** (imports + constructeurs + call sites) :
- `PublierBulletinsConseilClasseUseCase` (+SmsNotificationPort)
- `activerRessourceLieeSiApplicable` (+SmsNotificationPort)
- `CreerEvenementAcademiqueUseCase` (+SmsNotificationPort)
- `DeclencherEvenementUseCase` (+SmsNotificationPort)
- `ScannerListeCandidatsUseCase` (+DocumentAiPort)
- `ScannerListeCandidatsPebsUseCase` (+DocumentAiPort)
- `AnalyserDiplomeUseCase` (+DocumentAiPort)
- `InviterEcoleUseCase` (+EmailTemplatePort)
- `EnvoyerMessageUseCase` (+NotificationService +RealtimeSocketPort)
- `ModererMessageUseCase` (+NotificationService)
- `GenererSqueletteEmploiDuTempsUseCase` (+SchedulingGridPort)
- `ProposerEmploiDuTempsUseCase` (+SchedulingGridPort)

**DI câblée** : `container.ts` + `hexagonal.bootstrap.ts` + `inngest/functions/functions.ts`

### Notes

- Le port `NotificationService` (socket) existait déjà ; `EnvoyerMessageUseCase` et `ModererMessageUseCase` ont été migrés pour l'utiliser en injection au lieu d'instanciation directe.
- `RealtimeSocketPort` créé pour encapsuler `SocketNotificationService` (émetteur/diffuseur) — sépare le port de diffusion du port de notification email/SMS.

---

## 1.3 ✅ RÉSOLU — `domain/` qui importe depuis `application/` (1 fichier)

> **Statut : résolu** — `TemplateMeta` déplacé dans `domain/types/enums.ts` (type pur = concept domaine).
> `schoolTemplateConfig.ts` ré-exporte le type depuis `domain/` pour rétrocompatibilité.

### Preuve

```
grep -rln "from '@application|from '../../application" src/domain → 0
```

---

## 1.4 🔴 Controllers HTTP = logique métier + accès Prisma direct (Single Responsibility cassée)

**Règle violée (SOLID S) :** un controller HTTP ne doit contenir que la coordination requête→use case→réponse. Le calcul métier vit dans un use case / moteur dédié (cf. incident `GradingEngine`).

### Preuve

Sur 66 controllers, **46 importent `@prisma/client`** et font des requêtes Prisma directement :

| Controller | Lignes | Handlers | `prisma.` direct |
|---|---|---|---|
| `UserController.ts` | 1174 | ~20 | 26 |
| `GradeController.ts` | 1072 | ~15 | 32 |
| `DevController.ts` | 815 | 10 | 49 |
| `AIController.ts` | 647 | 9 | 34 |
| `PedagogieController.ts` | 759 | 15 | 39 |
| `HRController.ts` | 775 | 17 | 31 |
| `ClasseController.ts` | 757 | 13 | 24 |
| `FinanceController.ts` | 756 | 11 | 7 |
| `ReportCardController.ts` | 679 | 9 | 23 |
| `MasterAdminHexController.ts` | 639 | 18 | 24 |

Le `GradingEngine` vit toujours dans `GradeController.ts` (le calcul de moyenne séquence) au lieu d'un moteur `domain/`.

### Diagnostic

Ces controllers sont devenus des "god objects" : validation, accès DB, calcul métier, orchestration, réponses HTTP — tout mélangé.

### Propositions

- Extraire chaque bloc `prisma.*` d'un handler dans un use case dédié (pattern déjà validé sur `ClassCouncilController`).
- Sortir `GradingEngine` dans `domain/entities` ou `domain/rules` (source unique du calcul de moyenne).
- Cibler en priorité : `GradeController` (calcul de moyenne = métier), `UserController` (RBAC), `FinanceController`.

---

## 1.5 🟠 Duplication de calcul métier (DRY — calcul de moyenne)

**Règle violée (DRY) :** une seule source de vérité par calcul métier. L'incident historique des 8 implémentations dupliquées du calcul de moyenne ne doit pas se reproduire.

### Preuve

```
grep -rn "reduce((s, g) => s +\|reduce((s, n) => s +" src → 9 occurrences
```

- `src/application/reportCard/GenererBulletinUseCase.ts` (sommePonderee/sommeCoefficients)
- `src/infrastructure/persistence/prisma/PrismaSanteEleveRepository.ts`
- `src/application/assistant/catalogShared.ts`
- `src/application/assistant/teacherActionCatalog.ts`, `parentActionCatalog.ts`, `adminActionCatalog.ts`
- `src/infrastructure/http/controllers/ClasseController.ts`, `GradeController.ts`, `StatisticsController.ts`, `DepartmentController.ts`, `DashboardController.ts`

### Proposition

- `domain/entities/Note.ts` expose déjà `sequenceAverage` calculé par le `GradingEngine`. Centraliser TOUT calcul de moyenne générale pondérée dans un seul helper `domain/` (ex. `domain/rules/moyenneGenerale.ts`), consommé par les use cases et adapters.

---

## 1.6 🟠 Inngest : un seul fichier de 1744 lignes mélangeant 21 fonctions

`src/infrastructure/inngest/functions/functions.ts` = 1744 lignes, 21 `inngest.createFunction(...)`, 23 imports.

- Violation SOLID S : 21 responsabilités (bulletins, santé, alertes, paiements, prêts, purge, backups, orientation, IA...).
- Beaucoup de logique métier inline dans les fonctions (calcul de chute de moyenne ligne 796, seuils ligne 1476...).

### Propositions

- Découper en 1 fichier par domaine : `functions/reportCards.ts`, `functions/health.ts`, `functions/payments.ts`, `functions/maintenance.ts`, `functions/aiSecurity.ts`...
- Les fonctions qui calculent de la métrique métier doivent appeler des use cases (pas de Prisma inline).

---

## 1.7 🟠 `hexagonal.bootstrap.ts` = 3075 lignes (usine à DI monolithique)

66 controllers + 40+ use cases instanciés dans un seul fichier de 3075 lignes / 191 imports.

- Conforme fonctionnellement (rôle de composition), mais intenable : chaque ajout modifie ce fichier énorme, conflits Git fréquents.

### Propositions

- Éclater par bounded context : `bootstrap/gradeBootstrap.ts`, `bootstrap/financeBootstrap.ts`, `bootstrap/userBootstrap.ts`... (patterns "composition roots").
- Le container `container.ts` (803 lignes) est dans le même cas → fusionner ou répartir proprement les responsabilités.

---

## 1.8 🟠 `Prisma*Repository` de 300-535 lignes : responsabilités éclatées

- `PrismaOrientationRepository.ts` (534 lignes)
- `PrismaUserRepository.ts` (457 lignes)
- `PrismaTimetableRepository.ts` (419 lignes)
- `PrismaAnneeAcademiqueRepository.ts` (362 lignes)

Un adapter devrait implémenter un port cohérent. Quand il dépasse 400 lignes, c'est souvent que le port est trop gros (violation Interface Segregation) ou que l'adapter fait plusieurs jobs.

### Propositions

- Si le port fait trop de choses → le découper en ports spécialisés (I).
- Si l'adapter duplique du code → extraire dans des helpers prisma partagés.

---

## 1.9 🟡 `ports/` inégalement granulaires

32 ports repository pour 33 adapters prisma (ratio 1:1 — bon signe), mais :
- Ports très gros : `IOrientationRepository` (235 lignes), `AnneeAcademiqueRepository` (138), `TimetableRepository` (130).
- `domain/ports/services/` : 19 ports services (Email, Pdf, Sms, Paiement, IAService, SmsNotification, DocumentAi, EmailTemplate, RealtimeSocket, SchedulingGrid...) — tous avec un adapter sauf `ScrapingPort`, `GroqPort`.

### Propositions

- Vérifier que chaque port service a un adapter et que plus rien ne l'importe directement.
- Créer des adapters pour les ports restants sans implémentation (`ScrapingPort`, `GroqPort`).

---

## 1.10 🟡 RBAC/multi-tenant : risque résiduel sur les controllers non refactorés

- Les controllers refactorés (ClassCouncil) vérifient RBAC + isolation tenant par use case. Les controllers legacy (`UserController`, `GradeController`, `FinanceController`) le font encore dans le handler avec Prisma direct.
- Risque : chaque refactor de controller en use case doit impérativement préserver les contrôles RBAC/tenant (règle §4.12 de AGENTS.md).

### Proposition

Inclure la vérification RBAC/tenant dans les use cases lors des extractions (§1.4), jamais supposer hérité.

---

## 1.11 ✅ RÉSOLU — `logActivity` / audit : port existant mais sous-utilisé

> **Statut : résolu** par le chantier **P2** (logActivity → `ActivityLogPort` injecté).
> 6 use cases migrés vers `ActivityLogPort` injecté via constructeur (CloturerAnnee, MettreAJourParametresEcole, CreerSqueletteOnboarding, RejeterOnboarding, ValiderOnboarding, DesignerAP).
> `grep "logActivity" src/application → 0`.

### Preuve

```
grep -rln "logActivity" src/application → 0
```

---

## 1.12 ✅ Ce qui est déjà conforme (ne pas régresser)

- `GenererBulletinUseCase` : 100 % ports (School, Section, StudentProfile, Matiere) — aucun Prisma.
- `ClassCouncil` complet : port 15 méthodes + adapters + use cases + policies.
- `domain/` : plus aucune dépendance externe (vérifié — `grep "@prisma/client" src/domain` = 0 après les correctifs).
- `domain/policies/LanguagePolicy.ts` : règle de domaine propre.
- `tests/` : 112 fichiers unitaires + integration, 717 tests verts.

---

# PARTIE 2 — Fichiers hors plafond de taille (600-800 / 800+)

> Règle projet : cible confortable 150-250 lignes, alerte 300-400, **plafond dur 800**. Au-delà, split obligatoire SI multi-responsabilités.

## 2.1 Catégorie A — 600-800 lignes, UNE tâche précise, impossible/peu pertinent de diviser

| Fichier | Lignes | Nature | Verdict |
|---|---|---|---|
| `src/application/assistant/catalog/teacherActionCatalog.ts` | 415 | Catalogue d'actions IA (déclaratif) | 🟡 proche du plafond, reste sous 600 |
| `src/application/assistant/catalog/staffActionCatalog.ts` | 472 | Idem | 🟡 |
| `src/infrastructure/persistence/prisma/PrismaOrientationRepository.ts` | 534 | Adapter (port gros) | 🟠 plutôt §1.8 |
| `src/infrastructure/services/sms/SmsNotificationService.ts` | 602 | Service SMS (plusieurs canaux/templates) | 🟠 multi-templates — voir 2.3 |

**Verdict catégorie A stricte (600-800, une seule tâche) :** après analyse, la plupart des fichiers 600-800 sont en réalité des controllers multi-responsabilités (catégorie B) ou des fichiers déclaratifs/data. **Aucun fichier ne justifie d'être "une tâche unique impossible à diviser" au-delà de 600 lignes** dans cet état — les candidats data/declaratifs (catalogues, mappers) restent sous 600.

---

## 2.2 Catégorie B — > 800 lignes, MULTIPLES responsabilités → diviser

| Fichier | Lignes | Responsabilités identifiées | Action |
|---|---|---|---|
| `src/infrastructure/config/hexagonal.bootstrap.ts` | **3075** | Composition de 66 controllers + 40+ use cases + routes | 🔴 Split par bounded context |
| `src/application/assistant/catalog/adminActionCatalog.ts` | **2080** | ~35 actions IA (bulletin, notes, RH, finance, APEE...) | 🔴 Split en 1 fichier par domaine |
| `src/infrastructure/inngest/functions/functions.ts` | **1744** | 21 fonctions Inngest (bulletins, santé, paiements, backups, purge...) | 🔴 Split 1 fichier par domaine |
| `src/application/statisticalCampaign/minesecEsgFieldMap.ts` | **1629** | Data mapping ESG (déclaratif) | 🟡 Data pure, pas de logique — mais découpable par niveau/filière |
| `src/infrastructure/http/controllers/UserController.ts` | **1174** | Auth + profils + RBAC + transfert élèves + import | 🔴 Split par use case |
| `src/application/school/ActiverEtablissementUseCase.ts` | **1094** | Activation école + onboarding conversationnel + PEBS + LV2 + coefficients | 🔴 Split en 3-4 use cases |
| `src/infrastructure/http/controllers/GradeController.ts` | **1072** | Saisie + validation + calcul moyenne (GradingEngine) + statistiques | 🔴 Split + sortir GradingEngine |
| `src/infrastructure/http/controllers/DevController.ts` | 815 | Routes dev/test hétérogènes | 🔴 À supprimer en prod / scoper |
| `src/infrastructure/config/container.ts` | 803 | DI monolithique | 🟠 Fusionner/répartir avec §1.7 |

**Frontend :**

| Fichier | Lignes | Responsabilités | Action |
|---|---|---|---|
| `src/app/onboarding/[token]/page.tsx` | **2551** | Onboarding complet (école, classes, matières, personnel, élèves...) | 🔴 Split en composants par étape |
| `src/app/admin/dashboard/_components/SectionSubjects.tsx` | 1746 | Gestion matières (CRUD + coefficients + LV2) | 🔴 Split composants + hooks |
| `src/app/staff/dashboard/_components/SectionOrientation.tsx` | 1735 | Orientation (recommandations, validation, CEP) | 🔴 Split |
| `src/app/admin/dashboard/_components/SectionUsers.tsx` | 1645 | Utilisateurs (CRUD, import, rôles) | 🔴 Split |
| `src/app/admin/dashboard/_components/SectionSettings.tsx` | 1468 | Paramètres école (multi-onglets) | 🔴 Split par onglet |
| `src/app/admin/dashboard/_components/SectionClasses.tsx` | 1439 | Classes (CRUD, effectifs, professeurs) | 🔴 Split |
| `src/app/login/page.tsx` | 1092 | Login (multi-rôles, OTP, MFA) | 🟠 Split composants |
| `src/app/admin/configuration/ConversationalOnboarding.tsx` | 1073 | Onboarding conversationnel | 🔴 Split par étape |
| `src/components/LandingPage.tsx` | 1010 | Landing (héros, sections, tarifs, FAQ) | 🟠 Split sections |
| `src/app/master/dashboard/_components/SectionLogs.tsx` | 902 | Logs/audit Master | 🟠 Split |
| `src/app/admin/dashboard/_components/SectionAcademicYear.tsx` | 845 | Année académique (clôture, propositions) | 🟠 Split |

---

## 2.3 Catégorie C — > 800 lignes, UNE seule responsabilité (analyse approfondie)

Aucun fichier backend > 800 ne relève strictement d'"une seule tâche" — ils font tous plusieurs choses (voir §2.2). 

**Frontend : aucun non plus** au-delà de 800.

En dessous de 800, les candidats "une seule tâche mais grosse" :

| Fichier | Lignes | Verdict |
|---|---|---|
| `src/infrastructure/services/sms/SmsNotificationService.ts` | 602 | Multi-templates, multi-canal → **à diviser en 2** (logique d'envoi + templates) |
| `src/infrastructure/services/email/EmailService.ts` | 360 | OK (<= 400), pas urgent |
| `src/infrastructure/services/scraping/CarteScolaireScrapingAdapter.ts` | 318 | OK |

---

## 2.4 Catégorie D — fichiers < 600/800 lignes mais MULTI-responsabilités (à signaler)

| Fichier | Lignes | Pourquoi le diviser |
|---|---|---|
| `src/infrastructure/http/controllers/AssistantController.ts` | 590 | Orchestration IA + catalogues + sécurité (plusieurs rôles) |
| `src/infrastructure/http/controllers/OrientationController.ts` | 542 | Recommandations + validation + CEP (multi-flux) |
| `src/application/user/ImporterUtilisateursUseCase.ts` | 462 | Import élèves + enseignants + classes + LV2 + coefficients |
| `src/application/assistant/catalog/staffActionCatalog.ts` | 472 | ~15 actions métiers variées |
| `src/infrastructure/pdf/school-documents/SchoolDocumentPdfRenderer.ts` | 565 | Plusieurs types de documents |
| `src/infrastructure/http/validation/schemas.ts` | 473 | Tous les schémas Zod (auth, finance, classe, bulletin...) → découper par domaine |
| `src/application/assistant/catalog/teacherActionCatalog.ts` | 415 | Multi-actions |
| `src/infrastructure/persistence/prisma/PrismaUserRepository.ts` | 457 | Port User trop gros + logique de recherche |
| `src/infrastructure/persistence/prisma/PrismaTimetableRepository.ts` | 419 | Emploi du temps (slots, contraintes, groupes) |
| `src/application/shared/studentEnrollment.ts` | 404 | Helpers multi-usage (à transformer en port, cf. §1.1-D) |

**Frontend :**

| Fichier | Lignes | Pourquoi le diviser |
|---|---|---|
| `src/app/master/login/page.tsx` | 569 | Login + MFA + OTP (mélange) |
| `src/app/group/login/page.tsx` | 569 | Idem |
| `src/app/admin/dashboard/_components/SectionMinesecStatistics.tsx` | 566 | Statistiques multi-campagnes |
| `src/app/staff/dashboard/_components/SectionTimetableStaff.tsx` | 549 | Emploi du temps staff |
| `src/app/admin/dashboard/_components/SectionPedagogie.tsx` | 532 | Pédagogie (multi-onglets) |
| `src/app/admin/dashboard/_components/SectionCommunications.tsx` | 509 | Messagerie + babillard + notifications |
| `src/app/admin/dashboard/_components/SectionTimetable.tsx` | 506 | Emploi du temps admin |

---

# PARTIE 3 — Propositions de solutions (par cas)

## 3.1 Plan d'action — Violations hexagonales (par priorité)

| # | Problème | Solution | Difficulté | IA recommandée | Chantier |
|---|---|---|---|---|---|
| P1 | application/ dépend de Prisma (115 fichiers) | Par bounded context, créer ports + adapters + injection | Élevée | Claude Code (Tech Lead) | ✅ RÉSOLU |
| P2 | Controllers god-objects (46/66) | Extraire use cases (pattern ClassCouncil) + sortir GradingEngine | Élevée | Claude Code | Grade, User, Finance d'abord |
| P3 | application → infrastructure (22 fichiers) | Étendre ActivityLogPort, créer SmsScrapingGroqPorts | Moyenne | DeepSeek | ✅ RÉSOLU (logActivity + SMS + Email + Socket + Scheduling + AI) |
| P4 | domain → application (StaffPermissionRules) | Déplacer TemplateMeta dans domain/types | Faible | DeepSeek | ✅ RÉSOLU |
| P5 | Inngest 1744 lignes / 21 fonctions | Split par domaine + use cases au lieu de prisma inline | Moyenne | DeepSeek | ~5 commits |
| P6 | bootstrap/container monolithiques | Composition roots par bounded context | Élevée | Claude Code | Chantier dédié |
| P7 | Duplication calcul moyenne (9 sites) | Centraliser dans domain/rules/moyenneGenerale.ts | Moyenne | DeepSeek | Chantier DRY |
| P8 | Ports trop gros (Orientation, Timetable) | Interface Segregation : découper en sous-ports | Moyenne | DeepSeek | Au fil des P2 |
| P9 | logActivity direct (6 use cases) | Migrer vers ActivityLogPort injecté | Faible | DeepSeek | ✅ RÉSOLU |

## 3.2 Plan d'action — Taille des fichiers

| Catégorie | Stratégie | Difficulté | IA recommandée |
|---|---|---|---|
| A (600-800, une tâche) | Aucun aujourd'hui — surveiller les catalogues IA (415-472) | — | — |
| B (>800, multi-rôles) | Split par responsabilité — 9 fichiers backend + 11 frontend | Élevée | Claude Code (les plus gros) / DeepSeek |
| C (>800, une tâche) | Aucun — pas d'action | — | — |
| D (<800, multi-rôles) | Split — ~15 backend + 8 frontend | Moyenne | DeepSeek |

**Ordre de traitement recommandé pour les splits :**
1. `GradeController` (métier critique + GradingEngine)
2. `ActiverEtablissementUseCase` (onboarding = multi-tenant critique)
3. `adminActionCatalog` (bloquer le pattern : catalogue = 1 fichier par domaine)
4. `functions.ts` (Inngest)
5. Frontend : `onboarding/[token]`, `SectionSubjects`, `SectionUsers`
6. `hexagonal.bootstrap` (dernier, car dépend de tous les autres)

## 3.3 Règle de garde-fou à adopter

```
1 fichier = 1 responsabilité.
Plafond dur : 800 lignes (alarme à 400).
Dépassement → split OBLIGATOIRE si multi-responsabilités.
Data/déclaratif (mappings, catalogues) : plafond toléré 1000 lignes SI une seule responsabilité.
Les split doivent être des commits atomiques avec zéro régression (bun test + tsc avant/après).
```

---

# PARTIE 4 — Chiffres clés (récapitulatif)

| Métrique | Valeur |
|---|---|
| Fichiers backend > 600 lignes | 17 |
| Fichiers backend > 800 lignes | 9 |
| Fichiers frontend > 600 lignes | 18 |
| Fichiers frontend > 800 lignes | 11 |
| application/ qui importe @prisma/client | 0 ✅ |
| application/ qui utilise prisma. | 0 ✅ |
| application/ qui importe infrastructure | 0 ✅ |
| Controllers avec Prisma direct | 46 / 66 |
| Fichiers < 800 mais multi-responsabilités (backend) | ~15 |
| Fichiers < 800 mais multi-responsabilités (frontend) | ~8 |
| Tests | 717 passants / 112 fichiers |
| GradingEngine | Encore dans GradeController (à sortir) |
| Calculs de moyenne dupliqués | 9 sites |

---

*Fin de l'audit. Prochaine étape recommandée : valider ce document, puis lancer le chantier P2 (GradeController + GradingEngine) comme pilote du pattern d'extraction, avant de massifier sur les 115 use cases prisma-dépendants.*