# Exploration — Extraction des use cases depuis HRController.ts

> Lecture seule, aucun code modifié. Préparation V3.5+ — pattern hexagonal.
> Date : 2026-09-03 — `HRController.ts` 620 lignes, 9 repositories injectés.

---

## Étape 1 — Vérifier le garde-fou

### 1.1 Le garde-fou interdit-il la logique métier dans un controller ?

**Oui, indirectement — mais pas par une règle nommée "pas de logique métier".** `architectureGuard.test.ts` (311 lignes) ne contient **aucune** règle qui dit littéralement "un controller ne doit pas appeler un repository" ou "pas de `if` métier dans un controller". Ce qu'il vérifie pour les controllers (`infrastructure/http/controllers`, 2 règles) :

- `controllers HTTP ne font aucun accès direct this.prisma/ctx.prisma (hors AssistantController)` (`:266`)
- `controllers HTTP n'importent jamais @prisma/client directement` (`:280`)

C'est une **interdiction d'accès Prisma brut**, pas d'accès Repository typé. `HRController.ts` respecte ces 2 règles : il n'importe pas `@prisma/client`, ne fait pas `this.prisma.attendance.findMany`, il injecte 9 **ports** (`UserRepository`, `StaffProfileRepository`, `LeaveRepository`, `CareerEventRepository`, `MissionOrderRepository`, etc.) — donc **il passe le garde-fou actuel**.

**Angle mort à noter (pas à corriger ici) :** le garde-fou ne détecte pas un controller qui serait devenu un "gros service" en appelant des repositories via ports. C'est exactement le cas `HRController` : 620 lignes, 11 routes, toute la validation métier (`if (!body.type) → 400`, `loadEmployeeOrFail`, `ensureLeaveBalance`, `traiterDemandeConge`) vit dans le controller, sans couche `application/`. Le garde-fou actuel laisse passer ce pattern, alors qu'il casse le §4.7 *Separation of Concerns* et §4.3 *hexagonal* d'AGENTS.md. C'est un trou de couverture à signaler séparément (proposition : règle "aucun controller n'importe `@domain/ports/repositories` directement sans passer par un `application/*UseCase`", ou comptage de lignes >150).

### 1.2 HRController est-il dans le périmètre scanné ?

| Règle | Périmètre | HRController inclus ? | Verdict |
|-------|-----------|------------------------|---------|
| `any` non justifié domain/ | `domain/` | Non (HRController est dans `infrastructure/`) | Non scanné |
| `any` non justifié application/ | `application/` | Non | Non scanné |
| `any` controllers | — | Non scanné (seulement `this.prisma`/`@prisma/client` pour controllers) | `getCurrentUser(req): any` (`:67`), `fileByUserId.get(employee.id)` `as any` (`:119`) ne sont **pas** flagués |
| Imports interdits `@prisma/client`, `inngest`... | `domain/` + `application/` | Non | Non scanné |
| `this.prisma` dans `application/` | `application/` | Non | Non scanné |
| `*Port` hors `domain/ports/` | `application/` + `infrastructure/` | Non (HRController ne déclare pas d'`interface *Port`) | Pass |

**HRController est scanné uniquement pour les 2 règles controllers** (`this.prisma` / `@prisma/client`), qu'il respecte. Il **n'est pas** scanné pour `any` ni pour la règle "pas de logique métier".

---

## Étape 2 — Cartographier toute la logique à extraire

> Conventions du projet pour les use cases (relevé sur `EnregistrerPresenceUseCase.ts`, `SaisirNoteUseCase.ts`, `TraiterSmsPresenceUseCase.ts`) :
> - Fichier `VerbeNomUseCase.ts` en français (`EnregistrerPresenceUseCase`, `SaisirNoteUseCase`, `DemanderRattrapageUseCase`)
> - `Commande` = interface `XxxCommande` avec `schoolId` obligatoire (isolation tenant) + `Resultat` = `XxxResultat` ou `{ success }`
> - Constructeur = ports typés uniquement, jamais `PrismaClient`
> - Validation métier (préconditions, `throw new Error('...')` → `400/404/409` mappé par le controller) + appel repository + `audit.journaliser()` si sensible
> - RBAC **hors** use case : `requireRole('ADMIN','STAFF')` au montage de route (`hr.routes.ts`), ou `rattachementRepository.estRattacheALaClasse` **dans** le use case quand c'est une règle métier (ex: enseignant rattaché à la classe)

### 2.1 `addCareerEvent` (~278)

**Fait :** Crée un événement de carrière pour un employé.
- Validation : `loadEmployeeOrFail(userId, schoolId)` → `404` si absent ; `type && date` requis → `400`
- Appel : `careerEventRepository.create({ userId, schoolId, type, date: normalizeDateInput(date), observation })` (`:295`)
- RBAC mêlé : **Non** — seulement `loadEmployeeOrFail` (vérifie que l'employé appartient à l'école, via `userRepository.findEmployeeById`). Pas de `requirePermission` ni de vérification de rôle créateur. Le `audit` n'est pas appelé ici (contrairement à `updateLeaveRequest`).
- Repositories : `UserRepository.findEmployeeById` + `CareerEventRepository.create` + `findByUserOrdered` (lecture seule `listCareerEvents:320`)

**Méthodes similaires ailleurs :** `GererCahierDeTexteUseCase`, `CreerAnnonceUseCase`, `SaisirNoteUseCase` — même pattern `Commande { schoolId, demandeurId, ... }` + `findById` + `create` + `throw`.

### 2.2 `createLeaveRequest` / `updateLeaveRequest` / `listLeaveRequests` (~382-453)

**`createLeaveRequest:382`**
- Validation : `userId, type, dateDebut, dateFin` requis → `400` ; `loadEmployeeOrFail` → `404` ; `ensureLeaveBalance(userId, schoolId)` (crée le solde N si absent, via `findBalanceForYear` → `findLatestBalance` → `createBalance` `:90-106`)
- Appel : `leaveRepository.createRequest({ userId, schoolId, type, dateDebut, dateFin, motif })` (`:400`)
- RBAC : Non — tout membre authentifié peut créer une demande pour tout employé de son école (pas de vérification `requester === target` ni `MANAGE_LEAVE`). C'est une **règle métier manquante** à trancher lors de l'extraction.

**`updateLeaveRequest:415`**
- Validation : `statut ∈ {APPROVED, REJECTED}` → `400` ; délègue à `traiterDemandeConge(leaveRepository, schoolId, id, statut, currentUser.id)` (`:429`) — c'est un **service** `infrastructure/services/hr/TraiterCongeService.ts`, pas un repository direct. Ce service porte la vraie logique : vérifie `findRequestById` → `404` si absent, `409` si déjà traité, décrémente `LeaveBalance` si `APPROVED`, journalise.
- RBAC + audit : `audit.journaliser({ actionName: 'traiter_demande_conge', origin: 'UI_DIRECT', outcome: 'ERREUR|SUCCES' })` (`:431,442`) — **audit déjà présent** dans le controller, à déplacer dans le use case.
- Repositories : `LeaveRepository` (via le service) + `AIActionAuditPort`

**`listLeaveRequests:453`**
- Aucune validation : `leaveRepository.findRequestsBySchool(schoolId, userId?)` (`:458`), filtre optionnel `?userId=` en query. Pas de RBAC (tout le monde voit tout).

**`getLeaveBalance:465` + `getCurrentLeaveBalance:90`/`ensureLeaveBalance:101` (helpers privés)**
- Logique de solde : `findBalanceForYear(year)` → `findLatestBalance` → `createBalance` — à extraire avec le use case, pas à laisser en helper privé du controller.

**Méthodes similaires ailleurs :** `DemanderRattrapageUseCase` (validation + `notificationService` + `rattachementRepository`), `TraiterSmsPresenceUseCase` (délégation à un service). Le pattern `traiterDemandeConge` (service séparé) est atypique — les autres use cases portent la logique directement, sans service intermédiaire. À l'extraction, on pourra soit garder le service en dépendance du use case, soit l'inliner.

### 2.3 `createMissionOrder` (~557)

- Validation : `userId, motif, lieu, dateDebut, dateFin` requis → `400` ; `loadEmployeeOrFail` → `404`
- Appel : `missionOrderRepository.create({ userId, schoolId, motif, lieu, dateDebut, dateFin, signataire })` (`:573`)
- RBAC : Non
- Lecture associée `getMissionOrderPdf:589` (hors scope extraction mais même repository) : `findByIdAndSchool(missionId, schoolId)` → `404` + `loadEmployeeOrFail` + `getEmployeeSectionCode` + `resolveLanguage` + `generateMissionOrderPdf` + `sendPdf` — mélange **lecture + génération PDF + envoi** à séparer (le use case ne devrait que valider et retourner les données, le controller s'occupe du `Content-Disposition: pdf`).

**Méthode similaire :** `GenererBulletinUseCase` (même séparation `useCase → { data }` puis `controller → pdf`/`res.send`).

### 2.4 Permissions

**`grep permission` dans HRController.ts → 0 résultat.** Le controller ne fait **aucune** vérification `StaffPermission` ni `requirePermission`. Les routes HR (`hr.routes.ts`) montent `requireRole('ADMIN','STAFF')` au niveau router, pas de granularité `MANAGE_LEAVE`/`MANAGE_CAREER`/`MANAGE_MISSION`.

**Permissions existantes dans le projet (hors HRController) :**
- `StaffPermissionRules.ts` (si présent) ou `UserRepository` + `StaffProfileRepository.findSectionIdByUserId` — HRController utilise déjà `staffProfileRepository` pour `getEmployeeSectionCode` mais pas pour vérifier une permission avant `createLeaveRequest`.
- `EnregistrerPresenceUseCase` vérifie `rattachementRepository.estRattacheALaClasse` (règle métier, pas RBAC simple) — pattern à reproduire si HR doit vérifier `MANAGE_HR` ou `MANAGE_LEAVE`.

**À trancher à l'extraction :** faut-il que `createLeaveRequest` vérifie que le demandeur a `MANAGE_LEAVE` ou qu'il est `ADMIN` ? Aujourd'hui : non. C'est un **manque RBAC** à documenter, pas à inventer.

---

## Étape 3 — Proposition (sans implémenter)

### 3.1 Combien de use cases ?

**6 use cases distincts** (1 par intention métier, pas 1 par méthode HTTP) :

| # | VerbeNomUseCase.ts | Méthode(s) HRController couverte(s) | Commande / Résultat |
|---|--------------------|-------------------------------------|---------------------|
| 1 | `AjouterEvenementCarriereUseCase` | `addCareerEvent:278` + `listCareerEvents:309` (lecture seule regroupée) | `AjouterEvenementCarriereCommande { schoolId, demandeurId, userId, type, date, observation }` → `{ event }` / `ListerEvenementsCarriere` inclus |
| 2 | `CreerDemandeCongeUseCase` | `createLeaveRequest:382` | `CreerDemandeCongeCommande { schoolId, demandeurId, userId, type, dateDebut, dateFin, motif }` → `{ leaveRequest }` |
| 3 | `TraiterDemandeCongeUseCase` | `updateLeaveRequest:415` (APPROVED/REJECTED) | `TraiterDemandeCongeCommande { schoolId, demandeurId, leaveRequestId, statut }` → `{ leaveRequest }` — **remplace** l'appel au service `traiterDemandeConge` en en faisant le cœur du use case (ou le garde en dépendance interne, à trancher) |
| 4 | `ListerDemandesCongeUseCase` | `listLeaveRequests:453` + `getLeaveBalance:465` (lecture) | `ListerDemandesCongeCommande { schoolId, demandeurId, filtreUserId? }` → `{ leaveRequests, balances }` |
| 5 | `CreerOrdreMissionUseCase` | `createMissionOrder:557` | `CreerOrdreMissionCommande { schoolId, demandeurId, userId, motif, lieu, dateDebut, dateFin, signataire? }` → `{ missionOrder }` |
| 6 | `GererPermissionsRHUseCase` ? **Non — pas de use case Permissions à ce stade.** `HRController` ne gère pas les permissions (0 occurrence). Si un besoin `GererPermissions` existe, il vit dans `StaffProfileRepository`/`UserRepository` hors HRController. Ne pas inventer un 6e use case. **Total réel : 5** (1+2+3+4+5). |

*Si on compte `list`/`get` séparément, on pourrait découper 1 et 4 en 2, mais KISS : 1 use case gère `create` + `list` par employé, ou 2 use cases distincts si on veut rester strict 1 intention = 1 use case. Le découpage ci-dessus (5) est le compromis le plus lisible.*

### 3.2 Ordre de dépendance

```
Aucune dépendance métier entre les 5 :
  AjouterEvenementCarriere ─┐
  CreerDemandeConge         ├─► indépendants, aucun ne lit le résultat d'un autre
  TraiterDemandeConge       │   (Traiter lit LeaveRepository, pas le use case Créer)
  ListerDemandesConge       │
  CreerOrdreMission         ┘

Seule dépendance technique : `ensureLeaveBalance` est partagée par CreerDemandeConge et TraiterDemandeConge
→ extraire une méthode privée `LeaveBalanceService` ou dupliquer le helper `find-or-create` dans chaque use case (préférence : helper `LeaveRepository` déjà existant, pas de service).

Permissions : si on ajoute une vérification RBAC (ex: `MANAGE_HR`), elle dépendrait d'un `PermissionService`/`StaffProfileRepository` — à faire **après** les 5, pas avant.
```

**Pas d'ordre imposé** — les 5 peuvent être faits en parallèle, puis branchés ensemble dans `HRController`.

### 3.3 Taille / découpage

**Taille estimée :** HRController 620 lignes → 5 use cases × ~80-120 lignes chacun (validation + port + test unitaire) + `HRController` réduit à ~150 lignes (uniquement `req→Commande` + `useCase.execute` + `res.json` + `audit`). Total ~600 lignes déplacées, pas de nouvelle logique.

**Un seul chantier ou découper comme V3.5 ?**

- **V3.5 a été découpé** (Phase 1 moteur, V3.5-bis 4 points, T4, T7-T9) parce qu'il touchait **4 couches** (domain, application, infrastructure, tests) et introduisait un **nouveau pattern transversal** (`MetricDefinition`). Le découpage était nécessaire pour isoler le risque d'incohérence `hasCoefficient`.
- **HRController est différent :** c'est 5 extractions **mécaniques** du même pattern (controller → use case mince), sans nouveau pattern, sans risque d'incohérence inter-métriques, sans `isAbsentGrade` à réconcilier. Découper en 2 chantiers (ex: CareerEvent seul d'abord) n'apporterait pas de sécurité, juste du overhead de revue.

**Proposition : un seul chantier**, 5 use cases + 1 controller allégé, livré en **un commit** (ou 2 commits max : 1. `AjouterEvenementCarriere` + 2. `Leave+MissionOrder` si on veut une revue intermédiaire). Pas besoin de Phase 1 / Phase 2.

**Taille vs 300-ligne signal :** chaque use case restera <150 lignes (Single Responsibility, §4.1/4.2 AGENTS.md), HRController repassera sous 250 lignes.

---

## Livrable

Ce document — en attente de revue avant implémentation. Aucun `HRController.ts` modifié.
