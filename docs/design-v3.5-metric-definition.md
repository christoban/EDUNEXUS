# Design v1 — MetricDefinition : `taux_presence` + `moyenne_generale`

> **Statut :** proposition pour revue Tech Lead — aucune implémentation avant validation
> **Périmètre v1 :** 2 métriques uniquement. Pas de DSL de formules, pas de UI admin dynamique, pas de 3ᵉ métrique, pas de versionnage actif (préparé seulement).
> **Post-fix :** harmonisation LATE=présent clos (`4f7a9b9`). Les `fichier:ligne` ci-dessous sont re-vérifiés post-fix (ne pas se fier à l'audit V3.5 pour les 4 fichiers touchés).

---

## Partie 1 — Patterns existants à réutiliser (synthèse courte)

### 1.1 `rbacCache.ts` — seul cache serveur gradué en prod (référence pour `MetricCache`)

- **Emplacement :** `frontend/src/lib/offline/rbacCache.ts` (frontend, mais pattern transposable côté backend dans `backend/src/infrastructure/cache/` — dossier à créer, aucun `backend/src/infrastructure/cache/` n'existe aujourd'hui, cf. `ls backend/src/infrastructure/` : `assistant, backup, config, http, inngest, pdf, persistence, scheduling, seed, services, socket`).
- **Style de clé :** clé unique `STORAGE_KEY='zekoulabia_user'` + méta `CACHE_META_KEY='zekoulabia_rbac_cache_meta'` ; pas de clé composite par dimension. À adapter côté `MetricCache` en clé composite `metricKey + dimensions hash` (ex. `taux_presence:schoolId:classId:dateRange`).
- **TTL gradué par catégorie :** `CACHE_TTL_MS = { LECTURE: 10min, ECRITURE: 2min, DESTRUCTIF: 0 }` (`rbacCache.ts:74`). `hasPermission()` vérifie `Date.now()-cachedAt > ttl` puis relit `localStorage` (`rbacCache.ts:115`). `getOperationCategory()` mappe `PendingActionType → OperationCategory` (`rbacCache.ts:55`).
- **Invalidation :** `invalidateRBACCache()` remet `cachedAt` à 0 + `cachedUser=null` (`rbacCache.ts:149`), appelé après login/changement de rôle/déconnexion. Pas d'invalidation par clé fine. Pour `MetricCache`, s'en inspirer pour une invalidation **par préfixe** (`invalidate('taux_presence', {schoolId})`) plutôt que globale.
- **Garde-fou :** `DESTRUCTIF` → `hasPermissionFresh()` re-lit toujours (`rbacCache.ts:138`). Transposer : métriques sensibles (bulletin officiel) ne passent pas par le cache générique, restent sur `reportCard` dédié.
- **Limite :** cache **frontend `localStorage`**, pas serveur. Le futur `MetricCache` sera **serveur en mémoire** (Map + TTL) — même esprit gradué, mais emplacement `backend/src/infrastructure/cache/MetricCache.ts` (cohérence demandée).

### 1.2 `useCachedFetch` + `offline/db.ts` — cache frontend des stats (ne pas dupliquer)

- **Fichiers :** `frontend/src/hooks/useCachedFetch.ts:6` + `frontend/src/lib/offline/db.ts:54` (Dexie `ZekoulABiaDB`, tables `cachedData` + `pendingActions` + `messages`, chiffrées via `chiffrer`/`dechiffrer`).
- **Mécanisme :** `useCachedFetch<T>(cacheKey, fetchFn)` (`useCachedFetch.ts:6`) :
  1. Si `isOnline` → `fetchFn()` puis `putCachedData(cacheKey, result)` (`db.ts:106` chiffré) ; en cas d'erreur → fallback `getCachedData<T>(cacheKey)` + `fromCache=true, cachedAt`.
  2. Si offline → `getCachedData` direct, sinon `OFFLINE_NO_CACHE`.
  - `cachedAt` affiché via badge jaune `Package` (`SectionStatistics.tsx`, `SectionDashboard.tsx`).
  - **TTL :** infini jusqu'à `refetch()` manuel (bouton Refresh) ou `isOnline` change. Aucune expiration automatique.
- **Usage actuel pour les métriques :**
  - `SectionDashboard.tsx:32` `useCachedFetch('admin:dashboard-stats', fetchStatsFn)` → `GET /api/v2/dashboard/stats`
  - `SectionStatistics.tsx:84,95,104,114` 4 clés `admin:stats-evolution:${class}:${subject}`, `admin:stats-comparison:${level}`, `admin:stats-distribution:${criteria}`, `admin:stats-teacher:${id}`
- **Consigne pour v1 :** le futur `MetricCache` backend **ne remplace pas** ce cache frontend (offline-first). Il **complète** l'absence de cache **serveur** : `StatisticsController`, `AttendanceController`, `ListerElevesClasseUseCase`, `PrismaPresenceRepository` sont aujourd'hui 100% à la volée côté serveur (0 TTL serveur avant ce chantier). Le cache serveur évite `count/groupBy/findMany` répétés ; le cache frontend reste pour l'offline.

### 1.3 Pattern architecture standard (à suivre strictement)

- **Domain** : `backend/src/domain/rules/GradingEngine.ts:77` (`calculateAverageScoreOn20` pur) + `IndiceSanteRules.ts` — formules en code TS, pas en base.
- **Port** : `backend/src/domain/ports/repositories/PresenceRepository.ts:85`, `NoteRepository.ts:51`, `StatisticsQueryRepository.ts` — interfaces avec `schoolId` en premier param (isolation multi-tenant).
- **Application** : `backend/src/application/grade/CalculerMoyenneUseCase.ts`, `classe/ListerElevesClasseUseCase.ts`, `finance/VerifierSeuilAbsencesUseCase.ts` — `execute(cmd:{schoolId,...})`, injecte `Repository` + `calculateAverageScoreOn20`.
- **Infrastructure** : `backend/src/infrastructure/persistence/prisma/Prisma*Repository.ts` — `groupBy`, `count`, `aggregate` Prisma ; `infrastructure/http/controllers/*Controller.ts` — `req.user.schoolId` + `requireRole`/`checkPermission`.
- **Le futur `MetricDefinition` doit s'insérer dans ce pattern** : `domain/ports/MetricRegistry.ts` (port), `domain/rules/MetricDefinitions.ts` (formules TS), `application/reporting/GetMetricUseCase.ts` (orchestration cache+calcul), `infrastructure/cache/MetricCache.ts` (adapter mémoire), `infrastructure/persistence/prisma/PrismaMetricCacheRepository.ts` **uniquement si** option persistance choisie (voir §3.1).

### 1.4 `reportCard` et `StudentProfile.healthScore` — colonnes dédiées (ne pas remplacer)

- **Schéma :** `prisma/schema.prisma:1264` `ReportCard { generalAverage Float?, rank Int?, mention String?, absenceCount Int, totalStudents Int?, validationStatus, @@unique([studentId, academicPeriodId]) }` + `ReportCardSubjectLine { subjectAverage, weightedScore, coefficient }` (`schema.prisma:1299`) ; `StudentProfile.healthScore Int? @default(75)` (`schema.prisma:687`).
- **Pourquoi colonnes dédiées et non cache générique :**
  1. `reportCard` est un **document officiel** (bulletin) avec workflow `DRAFT→GENERATED→VALIDATED`, PDF `pdfUrl`, `classWorkflowStatus`, historique par période (`@@unique([studentId, academicPeriodId])`). Il doit rester interrogeable par `prisma.reportCard.findFirst` sans désérialiser un KV.
  2. `healthScore` est lu par 5 vues (`getStudentsHealth`, `getAtRisk`, `getHealthTracking`, `GererAlertesSante`, `EnvoyerDigest`) + `StudentProfile` jointure directe. Une colonne évite un join sur un KV.
  3. Les deux ont une **sémantique métier forte** (moyenne figée au moment de l'édition, santé recalculée chaque nuit) — un cache TTL invaliderait un document.
- **Consigne v1 :** `MetricDefinition` **ne couvre que les usages sans cache** : `AttendanceController:258`, `StatisticsController:232`, `ListerElevesClasseUseCase:51`, `PrismaPresenceRepository:120`, copilot. Les lectures `reportCard.generalAverage` et `studentProfile.healthScore` restent directes, jamais via `MetricCache`.

---

## Partie 2 — Inventaire des consommateurs réels (`taux_presence` + `moyenne_generale`)

> Re-vérification post-fix `4f7a9b9` pour les 4 fichiers touchés. Les lignes indiquées sont celles du **calcul**, pas de l'import.

### 2.1 `taux_presence` — 9 consommateurs listés à l'audit, re-vérifiés

| # | Consommateur | Fichier:ligne actuel (calcul) | Formule actuelle (post-fix) | Dimensions |
|---|---|---|---|---|
| T1 | `getStatistiquesEleve` (bulletin) | `backend/src/infrastructure/persistence/prisma/PrismaPresenceRepository.ts:120-139` — `tauxPresence = ((presents+retards)/total)*100` (`:138`) ; `joursAbsent = ABSENT+ABSENT_JUSTIFIED` | `(PRESENT+LATE)/total` | `schoolId, studentId, academicPeriodId` |
| T2 | `countAbsencesEtRetards` (absenceCount Inngest) | `backend/src/infrastructure/persistence/prisma/PrismaPresenceRepository.ts:96-100` — `count where status in [ABSENT, ABSENT_JUSTIFIED]` | `ABSENT+ABSENT_JUSTIFIED` (exclut LATE) | `schoolId, studentId, academicPeriodId` |
| T3 | Liste élèves classe | `backend/src/application/classe/ListerElevesClasseUseCase.ts:51-71` — `68: filter PRESENT\|\|LATE` ; `69: taux=round(presents/total*100) else 100` | `(PRESENT+LATE)/total else 100` | `schoolId, classId, studentId[]` |
| T4 | Performance enseignant | `backend/src/infrastructure/http/controllers/StatisticsController.ts:228-234` — `233: filter PRESENT\|\|LATE` / `total *10000/100` | `(PRESENT+LATE)/total` 2 déc, `null` si 0 | `schoolId, teacherId, classIds[]` |
| T5 | Attendance stats (référence correcte, NE PAS TOUCHER) | `backend/src/infrastructure/http/controllers/AttendanceController.ts:258` — `(present+late)/total` | `(PRESENT+LATE)/total` string `%` | `schoolId + filtres classId/studentId/dateDebut/dateFin` + RBAC STUDENT/PARENT |
| T6 | Vue parent 30j (référence, NE PAS TOUCHER) | `backend/src/infrastructure/persistence/prisma/PrismaParentRepository.ts:88-94` — `tauxPresence=(PRESENT+LATE)/total` + `tauxPonctualite=PRESENT/total` | Deux taux séparés, 30j | `parentUserId, schoolId` |
| T7 | Copilot teacher | `backend/src/infrastructure/assistant/catalog/teacherActionCatalog.ts:253-266` — `264: PRESENT\|\|LATE` | `(PRESENT+LATE)/total` début mois | `schoolId, classId, teacherId` |
| T8 | Copilot student | `backend/src/infrastructure/assistant/catalog/studentActionCatalog.ts:92-113` — `107: PRESENT\|\|LATE` | `(PRESENT+LATE)/total` début mois | `schoolId, studentId` |
| T9 | Copilot parent | `backend/src/infrastructure/assistant/catalog/parentActionCatalog.ts:119-146` — `140: PRESENT\|\|LATE` | `(PRESENT+LATE)/total` début mois | `schoolId, studentId (enfant)` |
| T10 | Dashboard global `avgAttendance` | `backend/src/infrastructure/persistence/prisma/PrismaDashboardQueryRepository.ts:18-21` — `count PRESENT+LATE / total` | `(PRESENT+LATE)/total` | `schoolId, role` |
| T11 | Alerte seuil absences 30j | `backend/src/application/finance/VerifierSeuilAbsencesUseCase.ts:18` + `PrismaPresenceRepository:91` `countAbsencesGrouped` | `count >= threshold(3)` sur 30j | `schoolId` |
| T12 | Indice santé composante assiduité | `backend/src/domain/rules/IndiceSanteRules.ts:69` + `PrismaSanteEleveRepository.ts:42` | `presents/total` (déjà avant fix, mais à vérifier si doit inclure LATE — **à trancher**, hors scope v1) | `schoolId, studentId, academicYearId` |

### 2.2 `moyenne_generale` — 7 consommateurs (hors reportCard déjà caché)

| # | Consommateur | Fichier:ligne actuel | Formule | Dimensions |
|---|---|---|---|---|
| M1 | Moteur central | `backend/src/domain/rules/GradingEngine.ts:77` — `calculateAverageScoreOn20` | `Σ(score*coeff??1)/Σ(coeff??1)` else `Σ/n`, filtre `isAbsentGrade`, clamp 0-20 | `grades[], hasCoefficientBySubject, excludeAbsentGrades` |
| M2 | Moyenne élève + rang API | `backend/src/application/grade/CalculerMoyenneUseCase.ts:48` + `PrismaNoteRepository.ts:72` `findClassmatesAverages` | `M1(LOCKED, excludeAbsent)` + rang `groupBy _avg` desc | `schoolId, studentId, classId, sequenceId` |
| M3 | Liste élèves classe | `backend/src/application/classe/ListerElevesClasseUseCase.ts:59` — `calculateAverageScoreOn20(...,true,true)` | M1 | `schoolId, classId, studentId[]` |
| M4 | Copilot `calculerMoyennesClasseSequence` | `backend/src/infrastructure/assistant/catalog/catalogShared.ts:212` + `teacherActionCatalog.ts:172` + `adminAcademicGradeActions.ts:165` | `Σ(avg*coeff)/Σ(coeff)` groupBy student | `classId, sequenceId` (+ `coefficient=1` forcé en mono-matière) |
| M5 | Conseil — moyennes par classe | `backend/src/infrastructure/persistence/prisma/PrismaClassCouncilRepository.ts:155` `obtenirMoyennesElevesParClasse` | `Σ(avg*coeff)/Σ(coeff)` round2 | `classId, academicPeriodId` |
| M6 | Stats "moyenne" simple (HORS SCOPE v1) | `backend/src/infrastructure/http/controllers/StatisticsController.ts:52,107,224` + `DepartmentController.ts:173` | `Σ/n` simple (ignore coeff) `ponytail: simple avg` | `classId/subjectId/level/teacherId` — **NE PAS TOUCHER** (contrainte prompt) |
| M7 | Bulletin cache + Inngest (déjà caché) | `backend/src/application/reportCard/GenererBulletinUseCase.ts:124` + `GenererBulletinsInngestUseCase.ts:113` (inline dupliqué) → `ReportCard.generalAverage` | M1 | `schoolId, classId, academicPeriodId` — **ne pas couvrir** (colonne dédiée) |

### 2.3 Classement Groupe A / Groupe B

**Groupe A — basculable SANS changement visible (veut juste la valeur actuelle)**

| Consommateur | Pourquoi Groupe A | Ordre de migration suggéré |
|---|---|---|
| T3 `ListerElevesClasseUseCase` | Valeur actuelle, pas de format spécial, RBAC déjà `schoolId+classId` en UseCase. Retour `number` (100 si 0) déjà aligné. | **1er** — 1 seul endpoint `GET /classes/:id/students`, faible trafic, testable avec `useCachedFetch` déjà présent côté PP |
| T4 `StatisticsController.teacherPerformance` taux | Valeur actuelle, `null` si 0 déjà géré côté front `SectionStatistics`. | **2e** — 1 endpoint isolé, peu de trafic |
| T7-T9 Copilot (3) | Valeurs actuelles, pas de RBAC supplémentaire (scopé `ctx.userId/schoolId`), pas de format `%` string, fenêtre début mois fixe. | **3e** — 3 occurrences identiques, factorisables en un seul `GetMetric` avec dimensions `classId/studentId` |
| M3 `ListerElevesClasseUseCase` moyenne | Même UseCase que T3, même dimensions, même cache key préfixe. | **Avec T3** — mutualiser le `GetMetric` pour les deux métriques sur la même clé `classId` |
| M2 `CalculerMoyenneUseCase` | Valeur actuelle + rang ; rang dépend de `findClassmatesAverages` mais moyenne = `moyenne_generale`. | **4e** — endpoint `GET /grades/average/:studentId` à trafic modéré |
| M4 Copilot moyennes | Même motif que T7-T9, fenêtre séquence courante. | **Avec T7-T9** |

**Groupe B — contrainte particulière (ne pas basculer aveuglément)**

| Consommateur | Contrainte précise | Stratégie proposée |
|---|---|---|
| T1 `PrismaPresenceRepository.getStatistiquesEleve` | Appelé par `GenererBulletinUseCase:228` pour `absenceCount` + `taux` bulletin ; **ne doit pas passer par un cache TTL** (bulletin = document figé). La valeur `tauxPresence` y est informative mais `joursAbsent` est **persisté** dans `reportCard`. | **Exception documentée :** ne pas migrer T1 vers `MetricCache`. Garder lecture directe. Le futur `MetricDefinition` ne couvre que les lectures "valeur actuelle", pas la génération de document. |
| T2 `countAbsencesEtRetards` | Utilisé pour `absenceCount` Inngest (`GenererBulletinsInngestUseCase:135`) — même contrainte document figé. | Idem T1 — **ne pas migrer**. |
| T5 `AttendanceController:258` | Déjà correct, **ne pas toucher** (consigne). Mais si un jour cache : RBAC fin `STUDENT→own, PARENT→childIds, ADMIN→all` + filtres `classId/studentId/dateDebut/dateFin` variables → clé composite très large, invalidation difficile. Format retour `string "85%"` vs `number` ailleurs. | **Reporter** — laisser tel quel en v1, couvrir plus tard avec une clé `attendance/stats` dédiée si besoin. |
| T6 `PrismaParentRepository` | Déjà correct, **ne pas toucher**. Deux métriques séparées `tauxPresence` + `tauxPonctualite` sur même requête 30j — le cache devrait stocker les deux atomiquement ou pas du tout. | **Reporter** — ne pas migrer en v1. |
| T10 `DashboardQueryRepository` | `avgAttendance` branché par `role` (ADMIN/TEACHER/STUDENT) + `pendingGrades/badges` mélangés. Cache par `role` risquerait de servir une valeur ADMIN à un STUDENT si clé mal scopée. | **Groupe B** — exiger clé `dashboard:stats:${schoolId}:${role}:${userId}` et TTL court (voir §3.3). |
| T11 `VerifierSeuilAbsences` | Cron `finance` — seuil `SchoolConfig.absenceAlertThreshold` variable par école, window 30j glissante, envoie email/SMS. Un cache TTL masquerait un dépassement. | **Ne pas cacher** — laisser à la volée ou cache 0 (DESTRUCTIF). |
| T12 Indice santé assiduité | Part de `healthScore` (25%) — si `taux_presence` passe par cache, le cron santé 02:00 lirait une valeur potentiellement périmée. | **Ne pas migrer** en v1 — l'indice santé reste lecture directe 30j pour la phase 2 versionnage. |
| M1 `GradingEngine` | Fonction pure — ne doit jamais être cachée elle-même, seul son **résultat agrégé** par dimensions peut l'être. | Ne pas wrapper `calculateAverageScoreOn20` directement, wrapper `GetMetric('moyenne_generale', dimensions)`. |
| M5 `PrismaClassCouncilRepository` | Utilisé pour `classAverage/highest/lowest/successRate` du PDF conseil — document figé comme bulletin, mais moins critique (PDF régénérable). | **Reporter** — laisser à la volée en v1, couvrir en v2 si cache conseil. |
| M6 Stats simple avg | **Hors scope v1** (consigne explicite). Formule `Σ/n` divergente de M1 — ne pas unifier sans décision Tech Lead. | **Ne pas migrer**. |
| M7 Bulletin/Inngest | Déjà cache matérialisé `ReportCard` — **ne pas dupliquer**. | **Ne pas migrer**. |

---

## Partie 3 — Proposition de design v1

### 3.1 Schéma Prisma proposé (pseudo-code, PAS de fichier modifié)

**Option A — Table cache générique clé/valeur (recommandée pour v1, sans trancher)**

```prisma
// pseudo-code Prisma — ne pas appliquer avant revue Tech Lead
model MetricCache {
  id          String   @id @default(cuid())
  schoolId    String
  metricKey   String   // 'taux_presence' | 'moyenne_generale' — enum en TS, String en DB pour extensibilité
  dimensions  Json     // { classId?: string, studentId?: string, teacherId?: string, academicPeriodId?: string, sequenceId?: string, dateRange?: { from: string, to: string } }
  dimensionsHash String // hash stable de dimensions (ex. sha256 JSON trié) — pour index unique rapide
  value       Float    // valeur calculée (0-100 pour taux, 0-20 pour moyenne)
  computedAt  DateTime @default(now())
  expiresAt   DateTime // computedAt + TTL (voir §3.3)

  school      School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)

  @@unique([schoolId, metricKey, dimensionsHash])
  @@index([schoolId, metricKey, expiresAt])
  @@index([expiresAt]) // pour job de purge TTL
}

model MetricDefinition {
  key           String   @id // 'taux_presence' | 'moyenne_generale'
  displayName   String   // 'Taux de présence' — i18n côté front, pas en DB
  description   String?  // ' (PRESENT+LATE)/total — post-fix 4f7a9b9'
  dimensions    String[] // ['schoolId', 'classId?', 'studentId?', 'dateRange?'] — schéma valide
  formulaRef    String   // 'PrismaPresenceRepository.getStatistiquesEleve | GradingEngine.calculateAverageScoreOn20' — doc, pas DSL
  defaultTtlMs  Int      // 300000 (5min) — voir §3.3
  enabled       Boolean  @default(true)

  @@map("metric_definition")
}
```

**Justification champ par champ :**
- `schoolId` en premier — isolation multi-tenant systématique, index partiel par école.
- `metricKey` String (pas enum Prisma) — ajouter `indice_sante` en phase 2 sans migration d'enum.
- `dimensions` Json — les 2 métriques n'ont pas les mêmes dimensions (`taux_presence` : `dateRange`/`classId`/`teacherId` ; `moyenne_generale` : `sequenceId`/`academicPeriodId`/`hasCoefficientBySubject`). Un Json évite une table par métrique.
- `dimensionsHash` — `@@unique` sur Json impossible ; hash stable (clés triées) permet `upsert` par clé composite sans scan.
- `value Float` — suffit pour 0-100 et 0-20 ; pas de `Decimal`-  `).
).
 ` ( ```` — valeur calculée pure, pas de `mention`/`rank` mélangés (ceux restent dans `reportCard`).
- `expiresAt` — TTL fixe (voir §3.3) + purge par job ; pas d'invalidation immédiate obligatoire en v1.
- `MetricDefinition` séparée — registre paramétrable (dimensions valides, TTL, enabled) sans redéployer ; `formulaRef` est une **référence doc** vers le code TS, pas une formule en base (décision Tech Lead : pas de DSL).

**Option B — Colonnes dédiées par métrique (alternative, non recommandée pour v1)**

```prisma
// pseudo-code — alternative à trancher par Tech Lead
model SchoolMetricCache {
  schoolId    String
  classId     String?
  studentId   String?
  // ... une colonne par métrique
  tauxPresence Float?
  moyenneGenerale Float?
  computedAt  DateTime
  expiresAt   DateTime
  @@unique([schoolId, classId, studentId])
}
```

| Critère | Option A (KV générique `MetricCache`) | Option B (colonnes dédiées) |
|---|---|---|
| **Extensibilité** | Ajouter `indice_sante` = 1 ligne `MetricDefinition` + 1 entrée `MetricCache` par dimension — 0 migration | Ajouter 1 métrique = 1 colonne + migration |
| **Requêtage** | `findUnique where schoolId+metricKey+hash` — 1 index unique, générique | `findMany where schoolId+classId` — plus simple SQL, pas de hash |
| **Lisibilité** | `dimensions` Json opaque, hash à maintenir | Colonnes explicites, typées |
| **Invalidation** | `deleteMany where metricKey='taux_presence' AND schoolId=? AND dimensionsHash in [...]` — fine mais Json | `update where schoolId+classId set tauxPresence=null` — plus direct |
| **Risque** | Hash collision (négligeable sha256), Json non requêtable en SQL pur | Explosion colonnes si 10 métriques phase 2, migrations fréquentes |

**Recommandation de l'auditeur (sans trancher) :** Option A pour v1 — les 2 métriques ont des dimensions disjointes et la phase 2 (`indice_sante` composite) l'exigera. **Question ouverte pour Tech Lead :** accepter le Json+hash ou préférer la clarté de colonnes dédiées quitte à migrer à chaque métrique ?

### 3.2 Forme du registry — interface TypeScript exacte proposée

```ts
// backend/src/domain/reporting/MetricRegistry.ts — port (domain)
export type MetricKey = 'taux_presence' | 'moyenne_generale';

export interface MetricDimensions {
  schoolId: string;                 // toujours requis — isolation tenant
  classId?: string;
  studentId?: string;
  teacherId?: string;               // taux_presence enseignant (StatisticsController)
  academicPeriodId?: string;        // moyenne_generale par période
  sequenceId?: string;              // moyenne_generale par séquence
  dateRange?: { from: string; to: string }; // taux_presence window (copilot début mois, parent 30j, AttendanceController filtres)
  // moyenne_generale only
  hasCoefficientBySubject?: boolean;
  excludeAbsentGrades?: boolean;     // toujours true pour moyenne_generale (isAbsentGrade)
}

export interface MetricDefinition {
  key: MetricKey;
  dimensions: (keyof MetricDimensions)[]; // dimensions valides — ex. taux_presence: ['schoolId','classId','studentId','teacherId','dateRange']
  defaultTtlMs: number;
  enabled: boolean;
  formulaRef: string; // 'GradingEngine.calculateAverageScoreOn20' | 'PrismaPresenceRepository.getStatistiquesEleve'
}

export interface MetricComputeFn {
  (dimensions: MetricDimensions, ctx: { prisma: PrismaClient }): Promise<number>;
}

export interface MetricRegistryPort {
  getDefinition(key: MetricKey): MetricDefinition | undefined;
  getComputeFn(key: MetricKey): MetricComputeFn;
  validateDimensions(key: MetricKey, dims: MetricDimensions): void; // throw si dimension manquante/invalide
}

// backend/src/domain/reporting/MetricDefinitions.ts — registre statique v1 (pas en DB encore)
export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  taux_presence: {
    key: 'taux_presence',
    dimensions: ['schoolId', 'classId', 'studentId', 'teacherId', 'dateRange', 'academicPeriodId'],
    defaultTtlMs: 5 * 60 * 1000,
    enabled: true,
    formulaRef: 'PrismaPresenceRepository.getStatistiquesEleve + AttendanceController pattern (PRESENT+LATE)/total — fix 4f7a9b9',
  },
  moyenne_generale: {
    key: 'moyenne_generale',
    dimensions: ['schoolId', 'classId', 'studentId', 'sequenceId', 'academicPeriodId', 'hasCoefficientBySubject', 'excludeAbsentGrades'],
    defaultTtlMs: 5 * 60 * 1000,
    enabled: true,
    formulaRef: 'GradingEngine.calculateAverageScoreOn20 — hasCoefficientBySubject + excludeAbsentGrades=true',
  },
};

// backend/src/application/reporting/GetMetricUseCase.ts — orchestration cache+calcul (application)
export interface GetMetricCommand {
  key: MetricKey;
  dimensions: MetricDimensions;
  forceRefresh?: boolean;
}
export class GetMetricUseCase {
  constructor(
    private readonly cache: MetricCachePort, // infrastructure/cache/MetricCache.ts
    private readonly registry: MetricRegistryPort,
  ) {}
  async execute(cmd: GetMetricCommand): Promise<{ value: number; fromCache: boolean; computedAt: Date }> {
    this.registry.validateDimensions(cmd.key, cmd.dimensions);
    if (!cmd.forceRefresh) {
      const hit = await this.cache.get(cmd.key, cmd.dimensions);
      if (hit && hit.expiresAt > new Date()) return { value: hit.value, fromCache: true, computedAt: hit.computedAt };
    }
    const fn = this.registry.getComputeFn(cmd.key);
    const value = await fn(cmd.dimensions, { prisma: this.cache.prisma });
    await this.cache.set(cmd.key, cmd.dimensions, value);
    return { value, fromCache: false, computedAt: new Date() };
  }
}

// backend/src/domain/ports/cache/MetricCachePort.ts — port cache (domain)
export interface MetricCachePort {
  prisma: PrismaClient;
  get(key: MetricKey, dims: MetricDimensions): Promise<{ value: number; computedAt: Date; expiresAt: Date } | null>;
  set(key: MetricKey, dims: MetricDimensions, value: number): Promise<void>;
  invalidate(key: MetricKey, dims: Partial<MetricDimensions>): Promise<number>; // par préfixe, retourne nb supprimés
  invalidateBySchool(schoolId: string): Promise<number>;
}
```

**Choix justifiés :**
- `MetricKey` union stricte (pas `string`) — seules 2 valeurs autorisées en v1, extensible en phase 2.
- `MetricDimensions` unique (pas un générique par métrique) — les 2 métriques partagent `schoolId`/`classId`/`studentId` ; sur-validation évitée par `MetricDefinition.dimensions` (liste blanche).
- `formulaRef` doc-string, pas DSL — les formules restent du code TS (`GradingEngine`, `PrismaPresenceRepository` corrigé), le registry ne fait que router.
- `forceRefresh` — pour les jobs critiques (cron santé, génération bulletin) qui ne doivent pas lire un cache périmé.
- `MetricCachePort.invalidate` par préfixe — nécessaire pour l'invalidation événementielle (§3.3) sans connaître le `dimensionsHash`.

### 3.3 Stratégie de cache et invalidation

**Recommandation v1 : TTL fixe court (5 minutes) + purge lazy, sans invalidation événementielle immédiate.**

| Option | Mécanisme | Avantages | Inconvénients |
|---|---|---|---|
| **TTL fixe (recommandé)** | `expiresAt = now + 5min` ; `get` vérifie `expiresAt > now` sinon `miss` ; job nightly `deleteMany where expiresAt < now` (purge) | Simple, pas de hook dans chaque `EnregistrerPresence`/`ModifierNote` ; tolère les écritures concurrentes ; `putCachedData` frontend reste source offline | Valeur potentiellement périmée jusqu'à 5min après une écriture (ex. PP saisit une présence → taux de `ListerElevesClasse` reste ancien 5min) |
| **Invalidation événementielle** | `EnregistrerPresenceUseCase` → `metricCache.invalidate('taux_presence', {schoolId, classId, studentId})` ; `VerrouillerNote` → `invalidate('moyenne_generale', {schoolId, classId, sequenceId})` | Fraîcheur immédiate | Couplage : chaque UseCase d'écriture doit connaître le cache ; invalidation par `classId` doit purger toutes les clés `studentId` de la classe (préfixe, pas exact) ; risque d'oublis ; plus de code |

**Pourquoi TTL 5 minutes :**
- Aligné sur `rbacCache.ts` `ECRITURE: 2min` / `LECTURE: 10min` — les métriques sont de l'**écriture fréquente** (présences quotidiennes, notes par séquence) mais **lecture très fréquente** (dashboards). 5min est le compromis `ECRITURE×2.5`.
- Trafic : `StatisticsController` et `ListerElevesClasse` sont appelés à chaque montage de page (pas de polling). Un TTL 5min divise les `count/groupBy` par ~10 sans impacter l'UX (un PP qui vient de saisir une présence et rafraîchit la page verra l'ancienne valeur 5min — acceptable, le bouton `refetch` de `useCachedFetch` peut forcer `forceRefresh:true`).
- Alternative TTL 2min (ECRITURE) trop court (peu de gain), 10min (LECTURE) trop long pour un taux qui bouge chaque jour.

**Invalidation minimale à prévoir quand même :**
- `MetricCache.invalidateBySchool(schoolId)` — pour `CloturerAnneeUseCase` ou `supprimerAvecCascade` (suppression classe) — sinon un cache d'une année clôturée survivrait.
- Pas d'invalidation par `Attendance`/`Grade` en v1 — ajouter en phase 2 si le TTL s'avère insuffisant (mesure via logs `fromCache`).

**Compromis de l'option non retenue (événementielle) :** si le Tech Lead préfère la fraîcheur immédiate, il faut alors **documenter exhaustivement** les 4 UseCases d'écriture qui doivent invalider (`EnregistrerPresence`, `EnregistrerPresenceEnMasse`, `SaisirNote`/`ModifierNote`/`VerrouillerNotes`, `PointerPresenceEnseignant`) et accepter le couplage. Le TTL reste en fallback (double sécurité).

### 3.4 Compatibilité avec le futur versionnage (phase 2, indice santé)

Le design v1 n'active pas l'historique, mais il le **prépare sans sur-design** :

1. **`MetricCache` n'est pas historisé** — c'est un cache TTL volatile (une seule valeur par `dimensionsHash`). L'historique phase 2 sera une **table séparée** `MetricHistory { id, schoolId, metricKey, dimensionsHash, value, computedAt, period }` avec `@@index([schoolId, metricKey, computedAt])`, jamais mélangée au cache.
2. **Registry extensible** — ajouter `indice_sante` = 1 entrée `MetricDefinition` (`dimensions: ['schoolId','studentId','academicYearId']`) + 1 `MetricComputeFn` qui compose `taux_presence` + `moyenne_generale` + `PrismaSanteEleveRepository` — aucun changement de schéma `MetricCache`.
3. **`MetricDefinition.dimensions` liste blanche** permet d'ajouter des dimensions temporelles (`computedAt`, `academicPeriodId`) pour l'historique sans toucher aux 2 métriques v1.
4. **`StudentProfile.healthScore` et `ReportCard.generalAverage` restent des colonnes dédiées** — le futur `MetricHistory` ne les remplace pas, il les **complète** pour les métriques qui aujourd'hui n'ont aucun historique (taux, moyennes par séquence). Aucune réécriture du cache v1 nécessaire pour passer à l'historique.

### 3.5 Plan de migration des consommateurs

**Ordre Groupe A d'abord (sans changement visible) :**

1. **T3 + M3 `ListerElevesClasseUseCase`** — 1 UseCase, 2 métriques, 1 endpoint `GET /classes/:id/students`, déjà `useCachedFetch` côté PP. Migrer les deux `tauxPresence` et `moyenne` en un seul `GetMetric` batch (2 appels `GetMetricUseCase` parallèles) — testable, faible trafic, bénéfice immédiat (supprime `findByClasseEtEleves` + `findValideesParClasseEtEleves` à chaque montage).
2. **T4 `StatisticsController.teacherPerformance` taux** — 1 endpoint isolé, 1 `useCachedFetch` déjà. Migrer seul.
3. **T7-T9 + M4 Copilot (6 tools)** — 6 occurrences identiques, même fenêtre `début mois` / `séquence courante`. Migrer en un seul `GetMetric` avec `dateRange` / `sequenceId` — factorisation des 3+2 duplications d'un coup (mais garder 3 définitions d'actions séparées, seule la lecture `prisma.attendance.findMany` est remplacée par `GetMetric`).
4. **M2 `CalculerMoyenneUseCase`** — endpoint `GET /grades/average/:studentId` + rang. Migrer `moyenne_generale` seule, **garder `findClassmatesAverages` pour le rang** (le rang n'est pas une métrique `MetricDefinition` en v1).
5. **T10 `DashboardQueryRepository.avgAttendance`** — dashboard global. Migrer en dernier (Groupe B, clé par `role`).

**Groupe B — comment gérer :**

- **T1, T2, T11, T12, M1, M5, M7** — **exception documentée `// MetricCache: not applicable — document figé / cron sensible`** + `forceRefresh:true` si un jour appel via `GetMetric`. Ne pas migrer en v1.
- **T5, T6, T10** — **reporter** avec commentaire `// TODO MetricDefinition phase 2 — clé composite large / deux métriques atomiques`. Si le Tech Lead veut les couvrir en v1, exiger une spec RBAC précise pour la clé.
- **Adaptateur minimal pour Groupe B si migration forcée :** `LegacyMetricAdapter` qui expose `getTauxPresenceLegacy(dims)` → `GetMetric` si `dims` simple, sinon fallback `prisma.attendance.count` direct + log `metric_fallback`. Éviter un adaptateur générique non testé.

### 3.6 Risques et questions ouvertes pour le Tech Lead

> **Ne pas coder avant d'avoir tranché ces points. Chaque question liste les options sans recommandation fermée.**

1. **Schéma : KV générique (Option A) vs colonnes dédiées (Option B) — §3.1.** Option A = extensible sans migration, Json opaque. Option B = lisibilité SQL, migrations à chaque métrique. **Question :** accepter le `dimensions Json + hash` ou préférer la clarté relationnelle quitte à migrer ?

2. **TTL 5min vs 2min vs 10min — §3.3.** 5min est proposé comme compromis `rbacCache` ECRITURE/LECTURE. **Question :** le PP qui vient de saisir une présence et rafraîchit `SectionProfesseurPrincipal` doit-il voir la nouvelle valeur immédiatement (alors TTL 5min est trop long) ou est-ce acceptable ?

3. **Invalidation événementielle en plus du TTL ?** TTL seul suffit pour v1, mais un `EnregistrerPresence` suivi d'un `GET /classes/:id/students` dans la même minute servira l'ancien taux 5min. **Question :** ajouter `metricCache.invalidate('taux_presence', {schoolId, classId})` dans `EnregistrerPresenceUseCase` dès v1, ou attendre la mesure `fromCache` ?

4. **Persistance du cache : Map mémoire vs `MetricCache` table Prisma ?** Map mémoire = 0 migration, perdu au restart, pas de purge SQL. Table Prisma = persistant, purge par `deleteMany expiresAt`, mais 1 `upsert` + 1 `findUnique` par lecture (latence). **Question :** v1 en **mémoire seule** (comme `CarteScolaireScrapingAdapter` cache 4h) suffit-il, ou faut-il persister pour survivre au restart ?

5. **Clé `taux_presence` : faut-il distinguer `taux_presence` vs `taux_ponctualite` ?** `PrismaParentRepository:88` expose déjà deux taux séparés. Le cache `taux_presence` ne doit pas écraser `taux_ponctualite`. **Question :** créer 2 clés `taux_presence` + `taux_ponctualite` dès v1, ou laisser `taux_ponctualite` hors `MetricDefinition` (lecture directe parent uniquement) ?

6. **Moyenne : `hasCoefficientBySubject` et `excludeAbsentGrades` doivent-ils être des dimensions ou des constantes v1 ?** Aujourd'hui `excludeAbsentGrades=true` partout pour `moyenne_generale`, `hasCoefficientBySubject` dépend de l'école. **Question :** les exposer comme dimensions (clé plus longue, cache plus fragmenté) ou les figer à `true` en v1 et les paramétrer en phase 2 ?

7. **Groupe B — couvrir `AttendanceController:258` et `DashboardQueryRepository` dès v1 ?** Clés larges (`dateDebut/dateFin` libres, `role` branché). **Question :** les inclure dans le scope v1 (avec clé `attendance/stats:${schoolId}:${hash(filters)}`) ou les reporter explicitement à la phase 2 ?

8. **T12 santé assiduité — doit-elle lire `taux_presence` via `MetricCache` ou rester directe ?** Si le cron santé lit un `taux_presence` en cache TTL 5min, il lirait une valeur potentiellement périmée pour `healthScore`. **Question :** le cron santé doit-il `forceRefresh:true` ou bypasser `MetricCache` ?

9. **Observabilité :** faut-il logger `metric_hit` / `metric_miss` + `fromCache` dès v1 pour mesurer le gain avant/après, ou attendre la phase 2 ?

10. **Emplacement `MetricCache` :** `backend/src/infrastructure/cache/MetricCache.ts` (nouveau dossier `cache/`) vs `backend/src/infrastructure/persistence/prisma/PrismaMetricCacheRepository.ts` (si persistant) vs `backend/src/lib/cache/` (inexistant). **Question :** valider l'arborescence avant création.

---

## Contraintes respectées

- Aucun fichier de code créé/modifié, aucun `schema.prisma` touché, aucune migration.
- Aucune UI admin de création de métrique dynamique, aucune 3ᵉ métrique, aucun versionnage actif.
- Formules restent du code TS (`GradingEngine`, `PrismaPresenceRepository` corrigé) — pas de DSL.

*Fin de proposition — en attente revue Tech Lead.*
