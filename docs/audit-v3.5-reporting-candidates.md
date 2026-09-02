# Audit V3.5 — Candidats Reporting Engine mature

> **Date :** 2026-09-01
> **Périmètre :** `backend/src`, `backend/prisma/schema.prisma`, `frontend/src`
> **Mode :** lecture seule — aucune modification de code, aucune migration, aucun modèle MetricDefinition créé
> **Règle Tech Lead rappelée :** pas de moteur générique de métriques tant que 2-3 cas d'usage réels existants n'ont pas été identifiés. Ce rapport liste les candidats ; **le choix final des 2-3 cas retenus pour concevoir MetricDefinition revient au Tech Lead, pas à l'auditeur.**

---

## Méthodologie

- Recherche exhaustive par `grep` sur les familles prioritaires demandées + exploration plus large (tous les `count/aggregate/groupBy`, tous les `count/SUM/reduce`, tous les endpoints `stats/summary/dashboard/rapport/report/overview/index`).
- 5 chantiers d'exploration en parallèle : (A) notes/moyennes/GradingEngine, (B) présence/assiduité, (C) finance/paiements, (D) santé/suivi/détection, (E) dashboards/stats/rapports ministériels.
- Chaque métrique listée séparément même si dupliquée (consigne stricte). Ligne `fichier:ligne` = ligne de la **définition ou du calcul**, pas de l'import.
- Si doute sur le caractère "métrique" → inclus avec note **"à trancher par Tech Lead"**.

---

## Tableau récapitulatif

| # | Nom fonctionnel | Fichier:ligne (calcul) | Cache / Stockage | Consommateurs (nb) |
|---|---|---|---|---|
| A1 | Moyenne générale pondérée centrale | `backend/src/domain/rules/GradingEngine.ts:77` | Non — pur à la volée | 7 call-sites |
| A2 | Moyenne séquence (single/triple/weighted) | `backend/src/domain/rules/GradingEngine.ts:128` | Non → persistée `Note.sequenceAverage` | 1 UC |
| A3 | Moyenne générale élève + rang (API) | `backend/src/application/grade/CalculerMoyenneUseCase.ts:48` + `backend/src/infrastructure/persistence/prisma/PrismaNoteRepository.ts:72` | Non — à la volée | 1 endpoint |
| A4 | Moyenne générale bulletin + rang + mention (cache) | `backend/src/application/reportCard/GenererBulletinUseCase.ts:124` | **Oui** — `reportCard.generalAverage, rank, mention, totalStudents` | 3 endpoints + Inngest + PDF |
| A5 | Moyenne générale Inngest (formule dupliquée) | `backend/src/application/reportCard/GenererBulletinsInngestUseCase.ts:113` | **Oui** — `reportCard` via upsert | 1 job Inngest |
| A6 | Moyennes camarades de classe (`findClassmatesAverages`) | `backend/src/infrastructure/persistence/prisma/PrismaNoteRepository.ts:72` | Non — `groupBy _avg` DB | 1 UC |
| A7 | Moyennes groupées par période (`groupMoyennesPourPeriode`) | `backend/src/infrastructure/persistence/prisma/PrismaNoteRepository.ts:294` | Non — `groupBy _avg` DB | 1 job Inngest + rapport conseil |
| A8 | Moyennes classe/séquence (copilot `calculerMoyennesClasseSequence`) | `backend/src/infrastructure/assistant/catalog/catalogShared.ts:212` | Non | 2 tools copilot |
| A9 | Moyennes élèves par classe (conseil) | `backend/src/infrastructure/persistence/prisma/PrismaClassCouncilRepository.ts:155` | Non | 1 UC → PDF |
| A10 | Statistiques évolution / comparaison / performance (avg simple) | `backend/src/infrastructure/http/controllers/StatisticsController.ts:52,107,224` + `DepartmentController.ts:173` | Non | 4 endpoints stats |
| A11 | Mention (seuils bulletin) | `backend/src/domain/entities/Bulletin.ts:61` + `backend/src/infrastructure/pdf/report-card/BulletinPdfHelpers.ts:4` | **Oui** — `reportCard.mention` + recalcul fallback | PDF + UC |
| B1 | Taux de présence élève — bulletin (`PRESENT/total`) | `backend/src/infrastructure/persistence/prisma/PrismaPresenceRepository.ts:120` | Non | Bulletin (absenceCount) |
| B2 | Taux de présence — endpoint `attendance/stats` (`(PRESENT+LATE)/total`) | `backend/src/infrastructure/http/controllers/AttendanceController.ts:258` | Non | 8 dashboards frontend |
| B3 | Taux de présence parent 30j + taux ponctualité | `backend/src/infrastructure/persistence/prisma/PrismaParentRepository.ts:88` | Non | Vue parent + suivi |
| B4 | Taux de présence — liste élèves classe | `backend/src/application/classe/ListerElevesClasseUseCase.ts:51` | Non | 1 endpoint classe |
| B5 | Taux de présence — performance enseignant | `backend/src/infrastructure/http/controllers/StatisticsController.ts:228` | Non | 1 endpoint stats |
| B6 | Taux de présence — copilot (3 occurrences) | `backend/src/infrastructure/assistant/catalog/teacherActionCatalog.ts:253` + `studentActionCatalog.ts:92` + `parentActionCatalog.ts:119` | Non | 3 tools copilot |
| B7 | Composante assiduité de l'indice santé (25%) | `backend/src/domain/rules/IndiceSanteRules.ts:69` | Non → agrégée dans `StudentProfile.healthScore` | Indice santé |
| B8 | Nombre d'absences bulletin (`absenceCount`) | `backend/src/domain/entities/Bulletin.ts:62` + `PrismaPresenceRepository.ts:87` | **Oui** — `reportCard.absenceCount` | Bulletin PDF |
| B9 | Alerte seuil absences 30j (cron) | `backend/src/application/finance/VerifierSeuilAbsencesUseCase.ts:18` | Non | Cron → email/SMS |
| C1 | Indice de santé scolaire — score 0-100 (5 composantes) | `backend/src/domain/rules/IndiceSanteRules.ts:9` + `PrismaSanteEleveRepository.ts:11` | **Oui** — `StudentProfile.healthScore` | Cron 02:00 + 3 vues + IA |
| C2 | Chute de moyenne par matière (Δ ≥ 3 pts) | `backend/src/application/grade/DetecterChuteMoyenneUseCase.ts:109` | Non — `StudentRecommendation` créée | 2 jobs Inngest + digest PP |
| C3 | Détection risque ponctuel (`riskScore` 0-100) | `backend/src/infrastructure/http/controllers/AIController.ts:494` | Non | 1 endpoint `risk-detection` |
| C4 | Prédiction risque — RULES (`100 - healthScore`) | `backend/src/infrastructure/services/ai/RulesBasedPredictionService.ts:30` | Non | Comparaison (non prod) |
| C5 | Prédiction risque — TabPFN (HTTP ML) | `backend/src/infrastructure/services/ai/TabPfnPredictionService.ts:46` | Non | Comparaison (non prod) |
| D1 | Total payé par facture (SUM SUCCESS) | `backend/src/infrastructure/persistence/prisma/PrismaFactureRepository.ts:57` | Non | Webhook + cash + alertes |
| D2 | Revenus par période (par méthode) | `backend/src/infrastructure/persistence/prisma/PrismaPaiementRepository.ts:49` | Non | KPI groupe |
| D3 | Solde APEE (`collectes - dépenses`) | `backend/src/infrastructure/persistence/prisma/PrismaApeeRepository.ts:62` | Non | 2 endpoints APEE |
| D4 | Taux de recouvrement MINESEC | `frontend/src/app/admin/dashboard/_components/SectionSchoolPayments.tsx:85` | Non — calcul frontend | Dashboard MINESEC |
| D5 | Agrégation PaiementMinesec / PaiementEtablissement (`groupBy status`) | `backend/src/infrastructure/persistence/prisma/PrismaPaiementMinesecRepository.ts:124,134` | Non | 2 endpoints dashboard |
| D6 | Total dépenses école | `backend/src/infrastructure/persistence/prisma/PrismaDepenseRepository.ts:33` | Non | Intendant |
| D7 | Élèves en retard de paiement | `backend/src/infrastructure/persistence/prisma/PrismaFactureRepository.ts:64` | Non | Copilot + dashboard |
| D8 | Revenus école / effectifs / taux absentéisme (groupe) | `backend/src/infrastructure/persistence/prisma/PrismaGroupeScolaireQueryRepository.ts:108` | Non | Dashboard groupe |
| E1 | Dashboard global (totalStudents, avgAttendance, badges) | `backend/src/infrastructure/persistence/prisma/PrismaDashboardQueryRepository.ts:18,28` | Non → front `useCachedFetch` IndexedDB | 4 dashboards (ADMIN/TEACHER/STUDENT/STAFF) |
| E2 | Évolution des moyennes par séquence | `backend/src/infrastructure/http/controllers/StatisticsController.ts:13` | Non → front cache IndexedDB | SectionStatistics |
| E3 | Comparaison des classes (moyenne par classe) | `backend/src/infrastructure/http/controllers/StatisticsController.ts:74` | Non → front cache | SectionStatistics |
| E4 | Répartition élèves (genre/niveau/paiement) | `backend/src/infrastructure/http/controllers/StatisticsController.ts:137` | Non → front cache | SectionStatistics |
| E5 | Performance enseignant (heures, séances, taux, moyennes) | `backend/src/infrastructure/http/controllers/StatisticsController.ts:191` | Non → front cache | SectionStatistics |
| E6 | Statistiques orientation (fiches, risque, entretiens) | `backend/src/infrastructure/persistence/prisma/PrismaOrientationRepository.ts:436` | Non | Dashboard orientation |
| E7 | Progression programme (chapitres, % attendu/réel) | `backend/src/application/pedagogie/CalculerProgressionProgrammeUseCase.ts:48` | Non | 1 endpoint pédagogie |
| E8 | Alertes retard programme (seuil 15%) | `backend/src/application/pedagogie/CalculerProgressionProgrammeUseCase.ts:112` | Non | 1 endpoint alertes |
| E9 | Rapport pédagogie (groupBy enseignant→classe→matière) | `backend/src/application/pedagogie/GenererRapportPedagogieUseCase.ts:44` | Non | 1 endpoint rapports |
| E10 | Rapport conseil de classe (classAverage, successRate, highest/lowest) | `backend/src/application/classCouncil/GenererRapportConseilUseCase.ts:30` | Non | 2 endpoints PDF |
| E11 | Digest quotidien Professeur Principal (critiques/vigilances/chutes) | `backend/src/application/sante/EnvoyerDigestProfPrincipalUseCase.ts:16` | Non | Cron 02:30 → PUSH |
| E12 | Vue conseil — préparation (effectif, promus, surveiller, discipline, forte baisse) | `backend/src/application/classCouncil/PreparerVueConseilClasseUseCase.ts:56` | Non | Vue conseil UI |
| E13 | Campagne statistique MINESEC / MINEDUB (XLS/PDF, complétude) | `backend/src/application/statisticalCampaign/GenererDeclarationStatistiqueMinesecUseCase.ts:35` + `GenererRapportSyntheseMinedubUseCase.ts:37` | **Oui** — `storage/statistical-submissions/*.xls` + `storage/minedub-reports/*.pdf` + `supplement` JSONB | 8 + 5 endpoints |

> **Total : 37 métriques distinctes** (dont 8 duplications explicites de la même formule avec des variations).

---

## Fiches détaillées

### A1 — Moyenne générale pondérée centrale

1. **Nom :** Moyenne générale pondérée sur 20 (moteur central)
2. **Fichier:ligne :** `backend/src/domain/rules/GradingEngine.ts:77` — `export const calculateAverageScoreOn20`
3. **Formule :** `Σ(scoreOn20 × coefficient ?? 1) / Σ(coefficient ?? 1)` si `hasCoefficientBySubject=true`, sinon `Σ(scoreOn20) / n` ; filtre `isAbsentGrade` si `excludeAbsentGrades=true` ; clamp 0-20, 2 décimales. Note : `?? 1` (pas `|| 1`) pour préserver `coefficient=0` explicite.
4. **Paramètres :** `grades: {scoreOn20, percentage, coefficient?, isAbsentGrade?}[]`, `hasCoefficientBySubject: boolean`, `excludeAbsentGrades?: boolean`
5. **Mode :** Recalculée à la volée à chaque appel — fonction pure, aucun cache, aucune persistance
6. **Fréquence :** À la demande (chaque lecture/calcul)
7. **Consommateurs :** 7 call-sites : `CalculerMoyenneUseCase.ts:48`, `GenererBulletinUseCase.ts:124`, `ListerElevesClasseUseCase.ts:60`, `PrismaSanteEleveRepository.ts:32,78`, `teacherActionCatalog.ts:172`, `studentActionCatalog.ts:66`, `adminAcademicGradeActions.ts:165`
8. **Versionnage :** Non — seule la valeur courante ; historique via bulletins `reportCard` successifs si besoin

---

### A2 — Moyenne séquence

1. **Nom :** Moyenne de séquence par matière (single/triple/weighted)
2. **Fichier:ligne :** `backend/src/domain/rules/GradingEngine.ts:128` — `export function calculerMoyenneSequence`
3. **Formule :** Selon `mode` : `weighted` → `0.3×classTest + 0.7×terminalExam` ; `triple` → `(DS1+DS2+Compo×2)/4` ; `single` → `sequenceScore` sinon `(theoretical+practical)/2` sinon fallback weighted ; clamp `0..maxValue`
4. **Paramètres :** `SequenceAverageInput {sequenceScore, classTestScore, terminalExamScore, theoreticalScore, practicalScore, seq1Score, seq2Score, compositionScore, maxValue}`, `mode='single'|'triple'|'weighted'`
5. **Mode :** À la volée puis **persistée** dans `Note.sequenceAverage` (`grade.sequenceAverage`) lors de `ModifierNoteUseCase.ts:69`
6. **Fréquence :** À chaque édition de note
7. **Consommateurs :** `ModifierNoteUseCase` → `Note` → tous les agrégats en aval ; tests `GradingEngine`
8. **Versionnage :** Non — la note garde la dernière valeur `sequenceAverage` ; historique non conservé

---

### A3 — Moyenne générale élève + rang (API à la volée)

1. **Nom :** Moyenne générale et rang d'un élève dans sa classe
2. **Fichier:ligne :** `backend/src/application/grade/CalculerMoyenneUseCase.ts:48` + `backend/src/infrastructure/persistence/prisma/PrismaNoteRepository.ts:72` (`findClassmatesAverages`)
3. **Formule :** `average = calculateAverageScoreOn20(notes LOCKED filtrées isAbsentGrade, true, true)` ; `rank = position (1-indexed) dans findClassmatesAverages trié desc`
4. **Paramètres :** `schoolId, studentId, classId, sequenceId`
5. **Mode :** À la volée — `groupBy _avg(sequenceAverage)` DB puis tri JS
6. **Fréquence :** À chaque `GET /api/v2/grades/average/:studentId?classId=&sequenceId=`
7. **Consommateurs :** Endpoint `GET /api/v2/grades/average/:studentId` (`GradeLectureController.ts:104`, `grade.routes.ts:16`, `requireAuth`) — utilisé par frontend notes/bulletins et potentiellement IA
8. **Versionnage :** Non — valeur instantanée ; le bulletin fige la version officielle

---

### A4 — Moyenne générale bulletin + rang + mention (cache matérialisé)

1. **Nom :** Bulletin — moyenne générale, rang, effectif, mention
2. **Fichier:ligne :** `backend/src/application/reportCard/GenererBulletinUseCase.ts:124` (calcul) + `backend/src/domain/entities/Bulletin.ts:61` (`definirResultats`) + `backend/src/infrastructure/persistence/prisma/PrismaBulletinRepository.ts:427` (`upsertBulletin`)
3. **Formule :** Pour chaque élève : `moyenne = calculateAverageScoreOn20(notes LOCKED, true, true)` ; toutes moyennes triées desc → `rang = index+1` ; `mention` via seuils FR/EN/APC (voir A11) ; `totalStudents` = taille classe
4. **Paramètres :** `schoolId, classId, academicYearId, academicPeriodId` ; génération par classe/période
5. **Mode :** **Cache matérialisé** — `reportCard.generalAverage, rank, totalStudents, mention` + `reportCardLine {coefficient, subjectAverage, weightedScore}` en DB Prisma. Source de vérité pour l'affichage.
6. **Fréquence :** Généré via `PublierBulletinsClasseUseCase` (propose/apply) ou job Inngest `reportcard/generate` (event-driven depuis `grade/locked`). Jamais recalculé automatiquement ensuite.
7. **Consommateurs :** `GET /api/v2/report-cards/my?yearId=` (STUDENT), `GET /api/v2/report-cards?yearId=&periodId=&classId=` (ADMIN/STAFF), `GET /api/v2/report-cards/:id/pdf` (STUDENT/PARENT/ADMIN → `PdfKitBulletinService` + `BulletinPdfHelpers`), `POST /api/v2/report-cards/export/:classId` (ZIP), `ReportCardController.ts:257,374` (email)
8. **Versionnage :** **Oui** — un `reportCard` par `(studentId, academicPeriodId)` ; l'historique est conservé (toutes périodes). Pas de versionnage intra-période (écrasé si régénéré).

---

### A5 — Moyenne générale Inngest (formule dupliquée)

1. **Nom :** Moyenne générale bulletin via Inngest (duplication de A4)
2. **Fichier:ligne :** `backend/src/application/reportCard/GenererBulletinsInngestUseCase.ts:113` — `totalWeighted = Σ avg×coeff ; totalCoeff = Σ coeff ; generalAverage = totalWeighted/totalCoeff`
3. **Formule :** `avg par matière = Σ scores / n` puis `generalAverage = Σ(avg×coefficient ?? 1) / Σ(coefficient ?? 1)` — **formule inline dupliquée**, n'appelle PAS `calculateAverageScoreOn20`
4. **Paramètres :** `schoolId, studentId, sequenceIds[]`, `academicYearId`
5. **Mode :** À la volée puis **cache** `reportCard` via `upsertBulletin` + `upsertLigneMatiere` (même table que A4)
6. **Fréquence :** Event `reportcard/generate` (déclenché après verrouillage notes)
7. **Consommateurs :** Job Inngest `Generate-Report-Cards` (`reportCards.ts:45`), orchestration bulletin automatique
8. **Versionnage :** Oui — même table `reportCard` (upsert)
9. **Note duplication :** Divergence de maintenance avec A1/A4 — **à trancher par Tech Lead** si unification souhaitée

---

### A6 — Moyennes camarades de classe (`findClassmatesAverages`)

1. **Nom :** Moyennes de tous les élèves d'une classe pour une séquence (DB aggregation)
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaNoteRepository.ts:72` + port `backend/src/domain/ports/repositories/NoteRepository.ts:51`
3. **Formule :** `groupBy studentId → _avg(sequenceAverage) where status=LOCKED AND isAbsentGrade=false ORDER BY _avg DESC`
4. **Paramètres :** `classId, sequenceId, schoolId`
5. **Mode :** À la volée — agrégation DB Prisma
6. **Fréquence :** À chaque appel `CalculerMoyenneUseCase`
7. **Consommateurs :** `CalculerMoyenneUseCase.ts:62` (rang), tests `InMemoryNoteRepository.ts:105`
8. **Versionnage :** Non

---

### A7 — Moyennes groupées par période (`groupMoyennesPourPeriode`)

1. **Nom :** Moyennes groupées par élève pour un ensemble de périodes
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaNoteRepository.ts:294` + port `NoteRepository.ts:90`
3. **Formule :** `groupBy studentId → _avg(sequenceAverage) where isAbsentGrade=false`
4. **Paramètres :** `schoolId, classId, academicYearId, sequenceIds[]`
5. **Mode :** À la volée — agrégation DB
6. **Fréquence :** À chaque `GenererBulletinsInngestUseCase.ts:117` (pour rang) et `GenererRapportConseil`
7. **Consommateurs :** Inngest bulletin + rapport conseil
8. **Versionnage :** Non

---

### A8 — Moyennes classe/séquence (copilot `calculerMoyennesClasseSequence`)

1. **Nom :** Moyennes pondérées de tous les élèves d'une classe pour une séquence (copilot)
2. **Fichier:ligne :** `backend/src/infrastructure/assistant/catalog/catalogShared.ts:212` + consommateurs `teacherActionCatalog.ts:172`, `adminAcademicGradeActions.ts:165,193`
3. **Formule :** `moyenne = Σ(sequenceAverage × coefficient) / Σ(coefficient)` groupBy `studentId` ; variantes copilot forcent `coefficient=1` pour moyennes mono-matière
4. **Paramètres :** `classId, sequenceId`
5. **Mode :** À la volée — `findMany` grades + reduce JS
6. **Fréquence :** À chaque invocation copilot (`moyenne_ma_classe_matiere`, `compter_eleves_sous_moyenne`, `classement_classes`)
7. **Consommateurs :** Assistant IA (2 tools enseignant + 2 tools admin) — `filterCatalogForUser` RBAC
8. **Versionnage :** Non

---

### A9 — Moyennes élèves par classe (conseil)

1. **Nom :** Moyennes pondérées pour le rapport de conseil de classe
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaClassCouncilRepository.ts:155` — `obtenirMoyennesElevesParClasse`
3. **Formule :** `Σ(sequenceAverage × coefficient) / Σ(coefficient)` arrondi 2 décimales, par élève
4. **Paramètres :** `classId, academicPeriodId`
5. **Mode :** À la volée
6. **Fréquence :** À chaque `GenererRapportConseilUseCase.ts:30` (`GET /api/v2/class-councils/:id/report`)
7. **Consommateurs :** PDF conseil (`ClassCouncilReportPdfRenderer.ts:36`) → `classAverage, highestAverage, lowestAverage, successRate`
8. **Versionnage :** Non — le PDF est généré à la demande, non historisé en DB

---

### A10 — Statistiques simple average (évolution / comparaison / performance)

1. **Nom :** Moyennes simple (`Σ/n`) pour les 4 endpoints statistiques
2. **Fichier:ligne :** `backend/src/infrastructure/http/controllers/StatisticsController.ts:52` (grades-evolution), `:107` (classes-comparison), `:224` (teacher-performance), `DepartmentController.ts:173` (department performance)
3. **Formule :** `moyenne = Σ(sequenceAverage ou values) / n`, `round 2 décimales` — **ignore les coefficients** (commentaire `ponytail: simple avg` assumé, `n < 200` par classe)
4. **Paramètres :** `classId/subjectId/studentId` (evolution), `level` (comparison), `teacherId` (performance), `departmentId` (department)
5. **Mode :** À la volée — `findMany` + reduce JS ; aucun `aggregate avg` Prisma
6. **Fréquence :** À chaque `GET /api/v2/statistics/*` — audité `evolution_moyenne_generale`, `classement_classes`
7. **Consommateurs :** `SectionStatistics.tsx:48-114` (4 `useCachedFetch` IndexedDB : `admin:stats-evolution:{class}:{subject}`, `admin:stats-comparison:{level}`, `admin:stats-distribution:{criteria}`, `admin:stats-teacher:{id}`) + `DepartmentController`
8. **Versionnage :** Non — recalculé à chaque appel ; front met en cache IndexedDB jusqu'au refresh manuel
9. **Note duplication :** Divergence avec A1 (pondéré) — même donnée, formule différente — **à trancher par Tech Lead**

---

### A11 — Mention

1. **Nom :** Mention du bulletin (Excellent / Très Bien / Bien / ...)
2. **Fichier:ligne :** `backend/src/infrastructure/pdf/report-card/BulletinPdfHelpers.ts:4,15,24,31` + `backend/src/domain/entities/Bulletin.ts:61` + duplications `GenererBulletinUseCase.ts:167` + `GenererBulletinsInngestUseCase.ts:126`
3. **Formule :** Seuils sur `generalAverage` : FR `18/16/14/12/10/8/6` (Excellent→Médiocre), EN `18/16/14/12/10` (Excellent→Poor), APC `18/15/11` (Expert/ECA/NA) ; dispatch par `template`+`langue` (`getMention`)
4. **Paramètres :** `generalAverage, template, langue`
5. **Mode :** Pur à la volée + **cache** `reportCard.mention` ; fallback `getMention()` si `mention` null (`ReportCardController.ts:257`)
6. **Fréquence :** À chaque génération de bulletin ; recalcul fallback à l'affichage si besoin
7. **Consommateurs :** PDF bulletin, `ReportCardController`, Inngest
8. **Versionnage :** Oui — via `reportCard` (même historisation que A4) ; **3 duplications** de la table de seuils

---

### B1 — Taux de présence élève (bulletin, `PRESENT` seul)

1. **Nom :** Taux de présence pour bulletin
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaPresenceRepository.ts:120` — `getStatistiquesEleve`
3. **Formule :** `tauxPresence = total>0 ? round((count(PRESENT)/total)*100) : 100` ; `LATE` **exclu** du numérateur
4. **Paramètres :** `studentId, academicPeriodId` (toutes périodes)
5. **Mode :** À la volée — `findMany Attendance`
6. **Fréquence :** À chaque génération de bulletin
7. **Consommateurs :** `GenererBulletinUseCase.ts:228` → `Bulletin.definirResultats({absenceCount})` ; `GenererBulletinsInngestUseCase.ts:135` ; `InMemoryPresenceRepository.ts:112` (tests)
8. **Versionnage :** Non — `absenceCount` est le seul vestige persisté (voir B8)

---

### B2 — Taux de présence endpoint `attendance/stats` (`PRESENT+LATE`)

1. **Nom :** Taux de présence global (tous dashboards)
2. **Fichier:ligne :** `backend/src/infrastructure/http/controllers/AttendanceController.ts:258` — `attendanceRate = total ? round(((present+late)/total)*100)+"%": "0%"`
3. **Formule :** `(PRESENT + LATE) / total × 100` — `LATE` **compté comme présent** ; retourne string avec `%`
4. **Paramètres :** `schoolId` (RBAC), filtres `classId?, studentId?, dateDebut?, dateFin?` via `countByFiltre` ; `STUDENT` force `studentId=userId`, `PARENT` force `childIds`
5. **Mode :** À la volée — 4 `countByFiltre` parallèles, **aucun cache serveur** ; front `useCachedFetch` ponctuel (Staff/Student)
6. **Fréquence :** À chaque `GET /api/v2/attendance/stats`
7. **Consommateurs :** 8 dashboards : `SectionDashboard`, `SectionAdminAttendance`, `SectionTeacherDashboard`, `SectionTeacherClasses`, `SectionTeacherAttendance`, `SectionStudentDashboard`, `SectionStudentAttendance`, `SectionAttendanceStaff`, `SectionStaffDashboard` ; RBAC filtré côté controller
8. **Versionnage :** Non
9. **Note divergence :** Formule différente de B1/B4/B5/B6 — **à trancher par Tech Lead** (faut-il unifier `LATE` inclus/exclu ?)

---

### B3 — Taux de présence parent 30j + taux ponctualité

1. **Nom :** Taux de présence et ponctualité d'un enfant (vue parent)
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaParentRepository.ts:64` — `findEnfantsAvecStats:88`
3. **Formule :** `tauxPresence = round(((PRESENT+LATE)/total)*100)` ; `tauxPonctualité = round((PRESENT/total)*100)` — distingués ; commentaire `// Retard ≠ absence au Cameroun : tauxPresence inclut les retards` ; fenêtre **30j glissants**
4. **Paramètres :** `parentUserId, schoolId` ; 4 `count` par enfant
5. **Mode :** À la volée
6. **Fréquence :** À chaque `ObtenirEnfantsUseCase` (dashboard parent)
7. **Consommateurs :** `parent/dashboard/_types.ts:23`, `SectionParentChildren.tsx:155`, `SectionParentAttendance.tsx:96`
8. **Versionnage :** Non

---

### B4 — Taux de présence liste élèves classe

1. **Nom :** Taux de présence par élève dans la liste d'une classe
2. **Fichier:ligne :** `backend/src/application/classe/ListerElevesClasseUseCase.ts:51`
3. **Formule :** `tauxPresence = att.length>0 ? round((filter(PRESENT).length / att.length)*100) : null` — `LATE` exclu, `null` si aucun enregistrement
4. **Paramètres :** `classId, schoolId` → `findByClasseEtEleves`
5. **Mode :** À la volée
6. **Fréquence :** À chaque `GET /api/v2/classes/:id/students` (`ClasseController.ts:244`)
7. **Consommateurs :** `SectionProfesseurPrincipal.tsx:21`
8. **Versionnage :** Non
9. **Note divergence :** Retourne `null` si `total=0` alors que B1/B3 retournent `100` — **à trancher**

---

### B5 — Taux de présence performance enseignant

1. **Nom :** Taux de présence d'un enseignant (statistiques)
2. **Fichier:ligne :** `backend/src/infrastructure/http/controllers/StatisticsController.ts:228` + `PrismaStatisticsQueryRepository.ts:141`
3. **Formule :** `tauxPresence = attendances.length>0 ? round((filter(PRESENT).length / total)*10000)/100 : null` — `LATE` exclu, **2 décimales**
4. **Paramètres :** `teacherId, schoolId, classIds` (via `findTeachingAssignmentsForTeacher`)
5. **Mode :** À la volée
6. **Fréquence :** À chaque `GET /api/v2/statistics/teacher-performance/:teacherId`
7. **Consommateurs :** `SectionStatistics.tsx:250` + tests `statisticsReporting.integration.test.ts:209`
8. **Versionnage :** Non

---

### B6 — Taux de présence copilot (3 duplications)

1. **Nom :** Taux de présence via assistant IA (enseignant / élève / parent)
2. **Fichier:ligne :** `backend/src/infrastructure/assistant/catalog/teacherActionCatalog.ts:253` (`mes_stats_presence_classe`) + `studentActionCatalog.ts:92` (`ma_presence`) + `parentActionCatalog.ts:119` (`presence_mon_enfant`)
3. **Formule :** `taux = round((filter(PRESENT).length / records.length)*10000)/100` — `LATE` exclu ; fenêtre `depuis = début mois courant` par défaut
4. **Paramètres :** `teacherId` ou `studentId=ctx.userId` ou enfants du parent ; scope copilot restreint
5. **Mode :** À la volée
6. **Fréquence :** À chaque invocation copilot
7. **Consommateurs :** Chat IA (3 tools)
8. **Versionnage :** Non
9. **Note :** 3 occurrences identiques — candidate à déduplication

---

### B7 — Composante assiduité de l'indice santé (25%)

1. **Nom :** Score d'assiduité (composante indice santé)
2. **Fichier:ligne :** `backend/src/domain/rules/IndiceSanteRules.ts:69` + `PrismaSanteEleveRepository.ts:42`
3. **Formule :** `(joursPresent / joursTotaux) × 100` où `joursPresent = count(PRESENT)` sur **30j glissants** ; `100` si `joursTotaux=0` ; poids `0.25` dans `score = 0.35×notes + 0.25×assiduité + 0.20×tendance + 0.10×comportement + 0.10×paiements`
4. **Paramètres :** `studentId, schoolId` (30j)
5. **Mode :** À la volée dans `PrismaSanteEleveRepository.getDonneesSante` puis agrégée dans `IndiceSanteRules.calculerComposantesSante`
6. **Fréquence :** Cron `0 2 * * *` (batch nuit) + à la demande `CalculerIndiceSanteUseCase`
7. **Consommateurs :** `IndiceSanteRules` → `healthScore` → cron → `StudentProfile.healthScore`
8. **Versionnage :** Non — seule la dernière valeur `healthScore` persiste

---

### B8 — Nombre d'absences bulletin (`absenceCount`)

1. **Nom :** Nombre d'absences affiché sur le bulletin
2. **Fichier:ligne :** `backend/src/domain/entities/Bulletin.ts:62` + `PrismaPresenceRepository.ts:87` (`countAbsencesEtRetards`)
3. **Formule :** `absenceCount = statsPresence.joursAbsent` (B1) **ou** `count(status IN [ABSENT, LATE])` — **`LATE` compté comme absence pour le bulletin** (divergent de B2/B3 où LATE = présence)
4. **Paramètres :** `schoolId, studentId, academicPeriodId`
5. **Mode :** **Cache** `reportCard.absenceCount` (persisté) — `BulletinRepository.ts:32,129`
6. **Fréquence :** À chaque génération de bulletin
7. **Consommateurs :** `BulletinTemplates.ts:46`, `PdfKitBulletinService.ts:224`, `BulletinPdfHelpers.ts:300` (`Absences : N`)
8. **Versionnage :** Oui — via `reportCard` (même historisation que A4)

---

### B9 — Alerte seuil absences 30j

1. **Nom :** Détection d'élèves dépassant le seuil d'absences (cron)
2. **Fichier:ligne :** `backend/src/application/finance/VerifierSeuilAbsencesUseCase.ts:18` + `PrismaPresenceRepository.ts:91` (`countAbsencesGrouped`)
3. **Formule :** `overThreshold = filter(countAbsencesGrouped(schoolId, since=now-30j) where count ≥ threshold)` ; `threshold = SchoolConfig.absenceAlertThreshold ?? 3`
4. **Paramètres :** `schoolId` (itération `findActiveSchools`)
5. **Mode :** À la volée
6. **Fréquence :** Cron (non localisé précisément — appelé depuis job Inngest `finance`/`maintenance` ; **non localisé** au-delà de `VerifierSeuilAbsencesUseCase`)
7. **Consommateurs :** Email `MANAGE_ATTENDANCE` + `SmsNotificationPort.notifyAbsenceThresholdSms`
8. **Versionnage :** Non

---

### C1 — Indice de santé scolaire (healthScore 0-100)

1. **Nom :** Indice de santé scolaire
2. **Fichier:ligne :** `backend/src/domain/rules/IndiceSanteRules.ts:9` (définition poids + `calculerComposantesSante:66`) + `backend/src/infrastructure/persistence/prisma/PrismaSanteEleveRepository.ts:11` (collecte) + `backend/src/application/ai/CalculerIndiceSanteUseCase.ts:31` (orchestration) — poids `POIDS_INDICE_SANTE:21`
3. **Formule :** `score = round(0.35×(moyenne/20×100) + 0.25×(présents/total×100) + 0.20×tendance(3 périodes : +25 si Δ≥2, +10 si ≥0.5, -25 si ≤-2, -10 si <0, base 50) + 0.10×max(0,100 - sanctions/périodes×20) + 0.10×(règlés/total×100))` ; clamp 0-100 ; niveaux `0-30 CRITIQUE | 31-50 ÉLEVÉ | 51-70 MOYEN | 71-85 STABLE | 86-100 PROGRESSION` ; variante `calculerScoreDepuisTaux` (l.103) pour RULES/TabPFN
4. **Paramètres :** `studentId, schoolId, academicYearId, langue` ; collecte 30j présence, 3 périodes notes LOCKED, sanctions `DisciplineRecord` sur année courante, factures `Invoice`
5. **Mode :** À la volée puis **cache matérialisé** `StudentProfile.healthScore` via `PrismaSanteEleveRepository.sauvegarderScore:129` (`prisma.studentProfile.update`)
6. **Fréquence :** Cron `0 2 * * *` (`health.ts:15` `compute-student-health-scores` → `CalculerScoresSanteUseCase:17`) + à la demande `CalculerIndiceSanteUseCase.execute` (avec IA narrative Groq) ou `calculerScoreSeulement` (batch, sans IA)
7. **Consommateurs :** Cron → events `ai/alert.critical|warning|positive` → `GererAlertesSanteUseCase:89` (notifs parents/censeurs/orientation) ; `AIController.getStudentsHealth:128` (ADMIN/VALIDATE_GRADES, 5 catégories) ; `getAtRiskStudentsForTeacher:162` (PP, `healthScore ≤ warningThreshold`) ; `getHealthTracking:324` (PARENT/STUDENT, 30j) ; `RulesBasedPredictionService:33`, `TabPfnPredictionService:70`, `GroqIAService:58` ; copilot `lister_eleves_a_risque` (`adminHrCommRiskActions.ts:157`)
8. **Versionnage :** **Non** — seule la dernière valeur `healthScore` en DB ; pas d'historique temporel (les tendances sont recalculées depuis les notes, pas depuis des snapshots `healthScore`). **À trancher par Tech Lead** si historisation souhaitée.

---

### C2 — Chute de moyenne par matière (Δ ≥ seuil)

1. **Nom :** Détection de chute de moyenne par matière
2. **Fichier:ligne :** `backend/src/application/grade/DetecterChuteMoyenneUseCase.ts:109` + Inngest `backend/src/infrastructure/inngest/functions/reportCards.ts:81,94`
3. **Formule :** `chute = noteAvant.sequenceAverage - noteActuelle.sequenceAverage` ; si `chute ≥ threshold (SchoolConfig.subjectDropThreshold ?? 3)` et `validationStatus=LOCKED` et `sequenceAverage != null` et `aiAlertsEnabled !== false` et séquence précédente existe (`orderIndex`) → génère `StudentRecommendation` `TEACHER/SUBJECT_DROP` (Groq `genererConseilPersonnalise`) + notif `STUDENT_RISK_ALERT`
4. **Paramètres :** `studentId, subjectId, schoolId, sequenceId` ; lookup `trouverSequencePrecedente` (orderIndex), `TeachingAssignment` pour `teacherId`
5. **Mode :** À la volée — event-driven ; `StudentRecommendation` persistée (30j window pour PP)
6. **Fréquence :** Event `grade/locked` (single) et `grade/locked-batch` (batch agrégé par enseignant) — émis depuis `server.ts:27,167` lors du verrouillage de notes
7. **Consommateurs :** Enseignant notifié IN_APP ; `AIController.getAtRiskStudentsForTeacher:252` (TEACHER non-PP, filtré matière, window 30j) ; `EnvoyerDigestProfPrincipalUseCase:42` (chutes 24h)
8. **Versionnage :** Oui — `StudentRecommendation` historisées (type `SUBJECT_DROP`, 30j) ; pas de table de métrique chute elle-même

---

### C3 — Détection risque ponctuel (`riskScore`)

1. **Nom :** Diagnostic de risque élève à la demande
2. **Fichier:ligne :** `backend/src/infrastructure/http/controllers/AIController.ts:494` — route `backend/src/infrastructure/http/routes/ai.routes.ts:15` `GET /risk-detection/:studentId`
3. **Formule :** `avgGrade = mean(grade.sequenceAverage LOCKED, max 20 notes)` ; `attendanceRate = (total-absent)/total×100` 30j ; `weakSubjects = count(notes < 10)` ; `riskScore = (avgGrade<10?40:avgGrade<12?20:0) + (presence<70?35:presence<85?15:0) + min(25, weakSubjects×5)` ; clamp 0-100 ; `high≥60, medium≥35, low sinon` ; prompt Groq 3 parties + `langueEcole`
4. **Paramètres :** `schoolId, studentId, since30d` ; RBAC `estAutoriseAVoirRisqueEleve` (ADMIN/VALIDATE_GRADES/TEACHER assignment ou PP/PARENT link/STUDENT self)
5. **Mode :** À la volée — live Prisma + Groq temps réel
6. **Fréquence :** À la demande (outil diagnostic ad-hoc)
7. **Consommateurs :** Front `api/v2/ai/risk-detection/:studentId` — ne persiste rien, ne déclenche pas d'alerte
8. **Versionnage :** Non
9. **Note :** Formule **différente** de C1 (inverse santé) — **à trancher par Tech Lead** si unification

---

### C4 — Prédiction risque RULES

1. **Nom :** Prédiction risque élève / impayé / orientation (règles)
2. **Fichier:ligne :** `backend/src/infrastructure/services/ai/RulesBasedPredictionService.ts:29` + port `PredictionService.ts:12` (`RiskScore {score 0-100, niveau FAIBLE/MOYEN/ELEVE/CRITIQUE, source RULES}`)
3. **Formule :** `risqueÉlève = 100 - healthScore(IndiceSanteRules.calculerScoreDepuisTaux)` ; `risqueImpayé = min(100,joursRetard/90×100)×0.6 + (1-tauxRespect)×100×0.4` ; `orientation` heuristique `C=scientifique, A=littéraire, TI=technique×0.8` sur 0-100
4. **Paramètres :** `EleveFeatures`, `PaiementFeatures`, `OrientationFeatures`
5. **Mode :** À la volée — stateless
6. **Fréquence :** À la demande `comparerRisquePredictions` (ADMIN)
7. **Consommateurs :** `AIController.comparerRisquePredictions:543` (`CompareRisquePredictionsUseCase`) — **non branché en production** (seule voie prod = `CalculerIndiceSanteUseCase` direct) — référence comparative
8. **Versionnage :** Non
9. **À trancher par Tech Lead :** Faut-il exposer cette métrique en tant que métrique versionnée ou la laisser comparative ?

---

### C5 — Prédiction risque TabPFN (ML)

1. **Nom :** Prédiction risque via service ML externe TabPFN
2. **Fichier:ligne :** `backend/src/infrastructure/services/ai/TabPfnPredictionService.ts:46` — `POST {TABPFN_SERVICE_URL}/predict/risque-eleve|risque-impaye|orientation` timeout 10s
3. **Formule :** `score = proba(RISQUE)×100` si dataset étiqueté suffisant, sinon `0 FAIBLE` (`insufficient_context`) ; mapping identique C4
4. **Paramètres :** `query_features` (features élève/paiement/orientation) ; `TABPFN_SERVICE_URL` default `localhost:8001`
5. **Mode :** À la volée — HTTP externe, jamais de cache
6. **Fréquence :** À la demande (comparaison)
7. **Consommateurs :** Même `comparerRisquePredictions` ; **ne pilote aucune notification** (B.5)
8. **Versionnage :** Non

---

### D1 — Total payé par facture

1. **Nom :** Montant total payé sur une facture
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaFactureRepository.ts:57` — `calculerTotalPayeAvecSucces`
3. **Formule :** `payment.aggregate _sum(amount) where invoiceId AND status=SUCCESS`
4. **Paramètres :** `factureId`
5. **Mode :** À la volée — aggregate DB
6. **Fréquence :** À chaque `TraiterWebhookCampay`, `EnregistrerPaiementCash`, `ObtenirAlertesSolde`
7. **Consommateurs :** `TraiterWebhookCampayUseCase.ts:33`, `EnregistrerPaiementCashUseCase.ts:58`, `FinanceController` reçu PDF, `ObtenirAlertesSoldeUseCase`
8. **Versionnage :** Non — historique via `Payment` rows

---

### D2 — Revenus par période (par méthode de paiement)

1. **Nom :** Revenus encaissés sur une période
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaPaiementRepository.ts:49` — `getRevenusParPeriode`
3. **Formule :** `findMany SUCCESS where paidAt ∈ [debut,fin] → reduce total + groupBy methode → {total, parMethode, count}`
4. **Paramètres :** `schoolId, debut, fin, status=SUCCESS`
5. **Mode :** À la volée
6. **Fréquence :** À la demande (KPI groupe, reporting)
7. **Consommateurs :** `ObtenirKpisGroupe`, `GroupDashboardController`
8. **Versionnage :** Non

---

### D3 — Solde APEE

1. **Nom :** Solde APEE (collectes - dépenses validées)
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaApeeRepository.ts:62` — `obtenirSolde`
3. **Formule :** `totalCollectes = aggregate SUM COLLECTE` ; `totalDepenses = aggregate SUM DEPENSE valide` ; `solde = collectes - depenses` ; `depensesEnAttente = count DEPENSE non valide`
4. **Paramètres :** `schoolId`
5. **Mode :** À la volée — 2 aggregates + count
6. **Fréquence :** À chaque `GET /api/v2/apee/solde` et `GET /api/v2/apee/rapport.pdf`
7. **Consommateurs :** `APEEController.ts:157,187` + frontend APEE (Admin/Staff/Parent) ; `staffActionCatalog.ts:260` (copilot)
8. **Versionnage :** Non — transactions APEE historisées individuellement

---

### D4 — Taux de recouvrement MINESEC

1. **Nom :** Taux de recouvrement des frais MINESEC
2. **Fichier:ligne :** `frontend/src/app/admin/dashboard/_components/SectionSchoolPayments.tsx:85` — `Math.round((totalPaye/totalAttendu)*100)` sinon `0`
3. **Formule :** `totalPaye / totalAttendu × 100` où `totalPaye = Σ montantPaye`, `totalAttendu = Σ montantAttendu` (backend fournit `_sum` bruts via D5)
4. **Paramètres :** `schoolId, anneeScolaire`
5. **Mode :** **Calcul frontend** à partir des `_sum` backend D5 ; aucun cache serveur
6. **Fréquence :** À chaque `GET /api/v2/paiements-minesec/dashboard/school?anneeScolaire=`
7. **Consommateurs :** Dashboard MINESEC admin (`SectionSchoolPayments`) + cartes `IMPAYE/PAYE/VERIFIE`
8. **Versionnage :** Non — backend agrège l'état courant ; pas de snapshot historique du taux

---

### D5 — Agrégation PaiementMinesec / PaiementEtablissement

1. **Nom :** Agrégation des paiements MINESEC et d'établissement par statut
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaPaiementMinesecRepository.ts:124` (`agregerPaiementsMinesec`) + `:134` (`agregerPaiementsEtablissement`) + `:118` (`compterInscriptionsActives`)
3. **Formule :** `groupBy by status → _count, _sum(montantAttendu, montantPaye)` ; `count inscriptions ACTIVE`
4. **Paramètres :** `schoolId, anneeScolaire`
5. **Mode :** À la volée — `groupBy` DB
6. **Fréquence :** À chaque `GetSchoolPaymentOverviewUseCase.ts:16` et `GetStudentPaymentDashboardUseCase.ts:12`
7. **Consommateurs :** `GET /api/v2/paiements-minesec/dashboard/school`, `GET /api/v2/paiements-minesec/dashboard/student/:studentId`, `paymentAlerts`
8. **Versionnage :** Non

---

### D6 — Total dépenses école

1. **Nom :** Total des dépenses
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaDepenseRepository.ts:33` — `getTotalDepenses`
3. **Formule :** `expense.aggregate _sum(amount) where schoolId [+debut,fin]`
4. **Paramètres :** `schoolId, debut?, fin?`
5. **Mode :** À la volée
6. **Fréquence :** À la demande (Intendant, reporting)
7. **Consommateurs :** `EnregistrerDepenseUseCase`, `FinanceController`, dashboard Intendant
8. **Versionnage :** Non

---

### D7 — Élèves en retard de paiement

1. **Nom :** Liste et totaux des élèves avec factures impayées/retard
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaFactureRepository.ts:64` — `getElevesEnRetard` + `:100` (`aFactureImpayeeBloquante`)
3. **Formule :** `findMany where status IN [PENDING,PARTIAL,OVERDUE] AND dueDate < now → payments SUCCESS → Map studentId {totalDu, totalPaye, solde, nombreFactures}`
4. **Paramètres :** `schoolId`
5. **Mode :** À la volée — `findMany` + reduce JS + Map
6. **Fréquence :** À la demande (copilot, dashboard Intendant — non exposé via API dédiée actuellement)
7. **Consommateurs :** Copilot `eleves_factures_impayees` (`adminFinanceAttendanceActions.ts:150`), `aFactureImpayeeBloquante` (blocage examen/FENASCO), `PrismaSanteEleveRepository:111` (frais pour indice santé)
8. **Versionnage :** Non

---

### D8 — Revenus / effectifs / absentéisme (groupe scolaire)

1. **Nom :** KPI groupe scolaire (revenus cumulés, effectifs, taux réussite, absentéisme)
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaGroupeScolaireQueryRepository.ts:108` — `calculerKpisEcole`
3. **Formule :** `effectifs = count studentProfile` ; `revenus = sum payment SUCCESS` ; `tauxReussite = avg reportCard.generalAverage` ; `tauxAbsenteisme = count attendance status=ABSENT / total`
4. **Paramètres :** `schoolId` (puis agrégé par `schoolIds[]` côté `ObtenirKpisGroupeUseCase`)
5. **Mode :** À la volée
6. **Fréquence :** À chaque dashboard groupe (`ObtenirKpisGroupeUseCase:18`, `ObtenirDetailEcoleGroupeUseCase:19`)
7. **Consommateurs :** `GroupDashboardController` + `group/dashboard/page.tsx`
8. **Versionnage :** Non

---

### E1 — Dashboard global (KPIs + badges)

1. **Nom :** KPIs dashboard et badges admin
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaDashboardQueryRepository.ts:18` (`countAdminStats`) + `:28` (`countAdminBadges`) + controller `DashboardController.ts:15,56` — routes `dashboard.routes.ts:7,8`
3. **Formule :** `totalStudents = count(STUDENT)` ; `totalTeachers = count(TEACHER)` ; `avgAttendance = (PRESENT+LATE)/total×100` ; `pendingGrades = count(DRAFT)` ; `pendingInvoices = count(PENDING|OVERDUE)` ; `recentActivity` = dernières activités
4. **Paramètres :** `schoolId, role, userId` — branche ADMIN/TEACHER/STUDENT
5. **Mode :** À la volée côté serveur ; **cache frontend** `useCachedFetch('admin:dashboard-stats')` IndexedDB (`offline/db.ts` `putCachedData/getCachedData`) — TTL infini jusqu'au refresh manuel ou `isOnline=false` → `fromCache:true` + badge
6. **Fréquence :** À chaque montage `SectionDashboard` / `SectionTeacherDashboard` / `SectionStudentDashboard` / `SectionStaffDashboard` (ou lecture cache si offline)
7. **Consommateurs :** 4 dashboards + `AdminSidebar` badges ; `GET /api/v2/dashboard/stats`, `GET /api/v2/dashboard/admin-badges`
8. **Versionnage :** Non

---

### E2 — Évolution des moyennes par séquence

1. **Nom :** Évolution de la moyenne d'une classe/matière/élève au fil des séquences
2. **Fichier:ligne :** `backend/src/infrastructure/http/controllers/StatisticsController.ts:13` — `gradesEvolution` ; repo `PrismaStatisticsQueryRepository` (findMany + reduce)
3. **Formule :** `moyenne = Σ sequenceAverage / n` (simple, sans coeff) groupBy `sequence.id` → `[{sequenceName, periodName, orderIndex, moyenne, nbNotes}]`
4. **Paramètres :** `schoolId, classId?, subjectId?, studentId?` + `academicYear isCurrent`
5. **Mode :** À la volée ; **cache frontend** `admin:stats-evolution:{class}:{subject}` IndexedDB
6. **Fréquence :** À chaque `GET /api/v2/statistics/grades-evolution` (+ audit `evolution_moyenne_generale`)
7. **Consommateurs :** `SectionStatistics.tsx:79` (LineChart Recharts)
8. **Versionnage :** Non

---

### E3 — Comparaison des classes

1. **Nom :** Moyenne par classe (comparaison inter-classes)
2. **Fichier:ligne :** `backend/src/infrastructure/http/controllers/StatisticsController.ts:74`
3. **Formule :** `moyenne = Σ sequenceAverage / n` par `classId` → `Map classId → {values, students Set}` → `avg`
4. **Paramètres :** `schoolId, level?`
5. **Mode :** À la volée ; cache frontend `admin:stats-comparison:{level}`
6. **Fréquence :** `GET /api/v2/statistics/classes-comparison`
7. **Consommateurs :** `SectionStatistics.tsx:87` (BarChart)
8. **Versionnage :** Non

---

### E4 — Répartition des élèves

1. **Nom :** Répartition des élèves par critère
2. **Fichier:ligne :** `backend/src/infrastructure/http/controllers/StatisticsController.ts:137`
3. **Formule :** 3 branches d'agrégation en mémoire : `gender` → `Map gender→count` ; `level` → `Map level→count` ; `paymentStatus` → `Map status→count` → `[{label, count}]`
4. **Paramètres :** `schoolId, criteria=gender|level|paymentStatus`
5. **Mode :** À la volée ; cache frontend `admin:stats-distribution:{criteria}`
6. **Fréquence :** `GET /api/v2/statistics/students-distribution`
7. **Consommateurs :** `SectionStatistics.tsx:99` (PieChart)
8. **Versionnage :** Non

---

### E5 — Performance enseignant

1. **Nom :** Performance d'un enseignant (heures, séances, taux présence, moyennes par classe)
2. **Fichier:ligne :** `backend/src/infrastructure/http/controllers/StatisticsController.ts:191` + `PrismaStatisticsQueryRepository:141`
3. **Formule :** `heuresPrevuesParSemaine = Σ hoursPerWeek (TeachingAssignment)` ; `seancesEnregistrees = count distinct date×class×subject (CahierDeTexte)` ; `tauxPresence = PRESENT/total×100` (B5) ; `moyennesParClasse = Σ sequenceAverage/n` par `subject×class`
4. **Paramètres :** `teacherId, schoolId`
5. **Mode :** À la volée ; cache frontend `admin:stats-teacher:{id}`
6. **Fréquence :** `GET /api/v2/statistics/teacher-performance/:teacherId`
7. **Consommateurs :** `SectionStatistics.tsx:107`
8. **Versionnage :** Non

---

### E6 — Statistiques orientation

1. **Nom :** Statistiques orientation (fiches, risque, entretiens)
2. **Fichier:ligne :** `backend/src/infrastructure/persistence/prisma/PrismaOrientationRepository.ts:436` — `getStats` + `OrientationController.ts:57` `GET /api/v2/orientation/stats`
3. **Formule :** `fichesOuvertes = count status OUVERTE/EN_COURS` ; `elevesArisqueEleve = count risk=ELEVE` ; `elevesArisqueCritique = count risk=CRITIQUE` ; `entretiensThisMois = count gte debutMois` ; `recommandationsEnAttente = count PROPOSEE` ; `repartitionRisque = groupBy riskLevel`
4. **Paramètres :** `schoolId, academicYearId?`
5. **Mode :** À la volée — 5 counts + groupBy
6. **Fréquence :** À chaque `GET /api/v2/orientation/stats`
7. **Consommateurs :** `SectionOrientation.tsx:833,1686` (ViewDashboard)
8. **Versionnage :** Non — pas de snapshot historique ; **à trancher** si versionnage mensuel souhaité

---

### E7 — Progression programme (pédagogie)

1. **Nom :** Progression du programme par classe/matière
2. **Fichier:ligne :** `backend/src/application/pedagogie/CalculerProgressionProgrammeUseCase.ts:48` — route `pedagogie.routes.ts:35` `GET /api/v2/pedagogie/progression?classId=&subjectId=&academicYearId=`
3. **Formule :** `chapitresTotal = count Programme` ; `chapitresRealises = Set(chapitreId abordés dans CahierDeTexte)` ; `progressionPct = realises/total×100` ; `attenduPct = datePourcentage(startDate,endDate)` ; `retardPct = attendu - progression`
4. **Paramètres :** `schoolId, classId!, subjectId!, academicYearId!`
5. **Mode :** À la volée
6. **Fréquence :** À chaque `GET /pedagogie/progression`
7. **Consommateurs :** Enseignant — cahier de texte progression UI
8. **Versionnage :** Non — état instantané ; **à trancher** si snapshot hebdomadaire utile

---

### E8 — Alertes retard programme

1. **Nom :** Alertes retard programme (seuil paramétrable)
2. **Fichier:ligne :** `backend/src/application/pedagogie/CalculerProgressionProgrammeUseCase.ts:112` — `GET /api/v2/pedagogie/alertes-retard?academicYearId=&seuilPct=15`
3. **Formule :** Pour chaque `programme.findByFilters` + `cahierDeTexte.findByFilters` → `retardPct` (E7) ; si `> seuilPct (défaut 15)` → push `{retardPct, niveau: CRITIQUE si >30 sinon MODERE}` ; tri `b.retardPct - a.retardPct`
4. **Paramètres :** `schoolId, academicYearId?, seuilPct`
5. **Mode :** À la volée — boucle tous programmes
6. **Fréquence :** À chaque `GET /pedagogie/alertes-retard` + potentiellement digest
7. **Consommateurs :** Dashboard admin — alertes
8. **Versionnage :** Non

---

### E9 — Rapport pédagogie

1. **Nom :** Rapport pédagogie groupé enseignant→classe→matière
2. **Fichier:ligne :** `backend/src/application/pedagogie/GenererRapportPedagogieUseCase.ts:44` — `GET /api/v2/pedagogie/rapports?teacherId=&departmentId=&classId=&academicYearId=`
3. **Formule :** `groupBy` mémoire `teacherId → classId → subjectId` → `{rapport: [{teacher, totalSeances, classes: [{class, subjects: [{subject, seances, chapitresAbordees}]}]}], total}`
4. **Paramètres :** `schoolId, teacherId?, departmentId?, classId?` ; RBAC `TEACHER` restreint à `self`
5. **Mode :** À la volée
6. **Fréquence :** À chaque `GET /pedagogie/rapports` (export)
7. **Consommateurs :** Export pédagogie (PDF/CSV)
8. **Versionnage :** Non — généré à la demande, non historisé

---

### E10 — Rapport conseil de classe

1. **Nom :** Statistiques du rapport de conseil (classAverage, successRate, highest/lowest)
2. **Fichier:ligne :** `backend/src/application/classCouncil/GenererRapportConseilUseCase.ts:30` + `PrismaClassCouncilRepository.ts:155` + DTO `RapportConseilData.ts:24`
3. **Formule :** `classAverage = Σ averages / n` ; `highestAverage = max` ; `lowestAverage = min` ; `successRate = (PASS+DELIBERATION)/total×100` ; effectifs issus de `obtenirMoyennesElevesParClasse`
4. **Paramètres :** `sessionId, schoolId` → `session.classId, academicPeriodId`
5. **Mode :** À la volée
6. **Fréquence :** À chaque `GET /api/v2/class-councils/:id/report` et `GET /:id/pv` (PDF) — `require VALIDATE_GRADES`
7. **Consommateurs :** Conseil de classe UI → `ClassCouncilReportPdfRenderer.ts:36` (PDF)
8. **Versionnage :** Non — PDF généré à la demande ; décisions `PASS/REPEAT/DELIBERATION` persistées dans `ClassCouncilDecision` mais pas les stats elles-mêmes

---

### E11 — Digest quotidien Professeur Principal

1. **Nom :** Digest quotidien PP (critiques / vigilances / chutes 24h)
2. **Fichier:ligne :** `backend/src/application/sante/EnvoyerDigestProfPrincipalUseCase.ts:16` + job `health.ts:54` `send-professor-principal-digest` cron `30 2 * * *`
3. **Formule :** Agrégation `Map<ppId, {critiques[], vigilances[], chutes[]}>` : `critiques/vigilances = findStudentsWithHealthScoreLte(warningThreshold) split healthScore≤criticalThreshold` ; `chutes = findTeacherRecommendationsSince(now-24h, TEACHER/SUBJECT_DROP)` ; sections jointes `\n\n`
4. **Paramètres :** `warningThreshold = aiRiskThreshold ?? 50`, `criticalThreshold = aiRiskThresholdCritical ?? 30` par école (`SchoolConfig`) ; window 24h pour chutes
5. **Mode :** À la volée — lectures Prisma jour J, 24h window
6. **Fréquence :** Cron `30 2 * * *` (02:30 UTC) — skip si `aiAlertsEnabled===false` ou 0 section
7. **Consommateurs :** PP notifiés `IN_APP+PUSH urgency NORMAL` ; contient compteurs `Critique (n) / Vigilance (n) / Chutes hier (n)` — **métrique composite quotidienne**
8. **Versionnage :** Non — le digest lui-même n'est pas historisé (notification éphémère) ; les `healthScore` et `StudentRecommendation` sous-jacents sont persistés

---

### E12 — Vue conseil préparation (effectif, promus, surveiller, discipline, forte baisse)

1. **Nom :** Indicateurs de préparation du conseil de classe
2. **Fichier:ligne :** `backend/src/application/classCouncil/PreparerVueConseilClasseUseCase.ts:56`
3. **Formule :** `effectif = count élèves` ; `promusOffice = count(moyenne ≥10 FR /40 EN ET aucune matière <5/25)` ; `aSurveiller = count(alertLevel != null)` ; `casDisciplinaires = count(DisciplineRecord sur période)` ; `enForteBaisse = count(moyPrec - moyCourante ≥3)` ; `decisionsOrientation = count fiches`
4. **Paramètres :** `schoolId, classId, academicPeriodId` ; seuils FR/EN et `alertLevel` dérivé de `healthScore`
5. **Mode :** À la volée — `ObtenirSessionConseilClasseUseCase:19` mapping `critical/warning`
6. **Fréquence :** À chaque `GET /api/v2/class-councils/:id` (vue préparation)
7. **Consommateurs :** Vue conseil UI (censeur/principal)
8. **Versionnage :** Non — `enForteBaisse` utilise les bulletins persistés comme historique implicite

---

### E13 — Campagne statistique MINESEC / MINEDUB

1. **Nom :** Déclaration statistique ministérielle (MINESEC XLS + MINEDUB PDF) + complétude
2. **Fichier:ligne :** `backend/src/application/statisticalCampaign/GenererDeclarationStatistiqueMinesecUseCase.ts:35` + `GenererRapportSyntheseMinedubUseCase.ts:37` + `VerifierCompletudeSupplementUseCase.ts:24` — routes `statisticalCampaign.routes.ts:10,13-15` + `statisticalCampaignMinedub.routes.ts:11-12`
3. **Formule :** **MINESEC :** `resolveAutoFields` (500+ champs) via `StatisticalQueryPort` (effectifs, enseignants, infrastructures, financements) + `supplement C_MANUAL` (`minesecFixedFieldMap.ts`, `minesecManuelsFieldMap.ts`, `minesecEstpGridMap.ts` → mapping 1:1 cellule XLS ↔ `supplementKey`) → XLS via `xlsEngine` + LibreOffice ; **MINEDUB :** PDF non-officiel bandeau jaune + tables `effectifsNiveau SIL→CM2, effectifsAge, personnel, infrastructures, commodites` → `storage/minedub-reports/{schoolId}/` ; **Complétude :** `complet = supplement contient toutes les clés hasTitreFoncier, superficieTerrainM2, infrastructuresDetail...`
4. **Paramètres :** `schoolId, generatedByUserId, anneeScolaire` ; bloque génération si `complet==false`
5. **Mode :** **Cache fichier** — `storage/statistical-submissions/*.xls` (MINESEC) + `storage/minedub-reports/*.pdf` (MINEDUB) ; `supplement` JSONB en DB (`SchoolStatisticalSupplement`)
6. **Fréquence :** À la demande `POST /statistical-campaign/generer` (ADMIN seul) et `POST /statistical-campaign-minedub/generer` ; vérif `GET /completude` ; cron `check-academic-events 0 6 * * *`, `check-orientation-checkpoints 0 7 * * *`
7. **Consommateurs :** Admin/Staff — 8 endpoints MINESEC + 5 MINEDUB ; téléchargements `GET /submissions/:id/download`, `GET /reports/:id/download` (RBAC `schoolId` comparé avant `fs.createReadStream`); **seul cache serveur existant** avec `CarteScolaireScrapingAdapter:51` (`matriculeCache 4h`, `paymentCache 30min`, `Map+expiresAt`)
8. **Versionnage :** **Oui** — `StatisticalSubmission` (MINESEC) et `MinedubReport` historisés par `schoolId` + `anneeScolaire` ; chaque génération crée une nouvelle entrée (pas d'écrasement)

---

## Candidats prioritaires — proposition de classement (ne vaut pas décision)

> **Rappel : le choix final des 2-3 cas retenus pour concevoir `MetricDefinition` (schéma, cache, agrégation paramétrable) revient au Tech Lead, pas à l'auditeur.** Ce qui suit est un classement indicatif selon trois critères demandés : (a) niveau de duplication de code actuel, (b) nombre de consommateurs, (c) besoin visible de paramétrage (période/classe/école variable). Les trois critères sont pondérés ensemble.

### Critère (a) — Duplication actuelle (du plus dupliqué au moins)

| Rang | Métrique(s) | Occurrences | Nature de la duplication |
|---|---|---|---|
| 1 | **Taux de présence** (B1-B6) | 9 implémentations | 4 formules distinctes du même taux : `PRESENT/total` (B1,B4,B5,B6) vs `(PRESENT+LATE)/total` (B2,B3) vs variantes `LATE` compté comme absence bulletin (B8) vs `null` si `total=0` (B4) vs `"0%"` (B2) vs `100` (B1,B3). **Plus forte dette.** |
| 2 | **Moyenne générale pondérée** (A1,A3-A5,A8-A10) | 8+ call-sites + 2 formules inline divergentes | Formule centrale `GradingEngine` dupliquée inline dans `GenererBulletinsInngestUseCase.ts:113` et ignorée (simple `Σ/n`) dans `StatisticsController` (A10) ; `coefficient:1` forcé dans copilot mono-matière |
| 3 | **Mention** (A11) | 4 occurrences | Seuils `18/16/14/12/10/8/6` copiés dans `BulletinPdfHelpers`, `GenererBulletinUseCase`, `GenererBulletinsInngestUseCase`, `domain/academic/reporting.ts` (échelle 0-100 inutilisée) |
| 4 | **Agrégations finance** (D1-D8) | 8 repos + 3 dashboards + copilot | Même `aggregate _sum` répété dans `Facture/Paiement/Apee/Depense/Groupe` avec filtres quasi-identiques (`schoolId`, `status=SUCCESS`) ; totaux page-courante (`SectionFinance:limit 20`) incohérents |
| 5 | **Indice santé vs risque ponctuel** (C1 vs C3) | 2 formules | `C3 riskScore` recalcule un score ad-hoc différent de `C1 healthScore` pour le même élève ; `GroqIAService:46` recalcule aussi un score simplifié divergent |

### Critère (b) — Nombre de consommateurs (du plus consommé au moins)

| Rang | Métrique | Consommateurs comptés |
|---|---|---|
| 1 | **B2 — Taux présence `attendance/stats`** | 8 dashboards + RBAC STUDENT/PARENT filtré + tous rôles |
| 2 | **A1/A4 — Moyenne générale** | 7 call-sites + 5 endpoints bulletins/grades + Inngest + 3 copilots |
| 3 | **C1 — Indice santé** | Cron + 3 vues (`studentsHealth`, `atRisk`, `healthTracking`) + `GererAlertesSante` (parents/censeurs/orientation) + 2 PredictionServices + copilot |
| 4 | **E1 — Dashboard global** | 4 dashboards (ADMIN/TEACHER/STUDENT/STAFF) + sidebar badges |
| 5 | **E2-E5 — Stats pédagogiques** | 4 endpoints + `SectionStatistics` (4 IndexedDB caches) |
| 6 | **C2 — Chute par matière** | 2 jobs Inngest + digest PP + vue `atRisk` non-PP |
| 7 | **D4/D5 — Recouvrement MINESEC** | 2 endpoints dashboard + cartes statut |

### Critère (c) — Besoin visible de paramétrage (période/classe/école variable)

| Rang | Métrique | Paramètres variables observés | Besoin de paramétrage |
|---|---|---|---|
| 1 | **Moyenne générale** (A) | `schoolId, classId, studentId, sequenceId, academicPeriodId, hasCoefficientBySubject, excludeAbsentGrades` — **7 dimensions** | Très élevé — la formule doit varier par école (coeff activé ou non), par période, par classe |
| 2 | **Taux présence** (B) | `schoolId, classId, studentId, dateDebut, dateFin, status (PRESENT/LATE/ABSENT/ABSENT_JUSTIFIED), period MORNING/AFTERNOON` — **7 dimensions** + divergence `LATE` inclus/exclu | Très élevé — besoin d'unifier le paramètre `includeLate` |
| 3 | **Indice santé** (C1) | `schoolId, studentId, academicYearId, seuils aiRiskThreshold/critical (par école), threshold sanctions, window 30j/3 périodes` — **6 dimensions** + seuils configurables `SchoolConfig` | Élevé — seuils par école déjà paramétrés, poids fixes mais pourraient devenir configurables |
| 4 | **Statistiques pédagogiques** (E2-E5) | `level, classId, subjectId, studentId, criteria (gender/level/paymentStatus), teacherId, departmentId` | Élevé — 4 endpoints avec filtres hétérogènes |
| 5 | **Finance** (D) | `schoolId, anneeScolaire, status, paidAt range, methode` | Moyen — surtout `schoolId` + `anneeScolaire` |
| 6 | **Progression programme** (E7-E8) | `classId, subjectId, academicYearId, seuilPct` | Moyen — `seuilPct` paramétrable (défaut 15) |

### Synthèse — 3 candidats les plus pertinents selon la combinaison (a)×(b)×(c)

> **Proposition indicative — ne vaut pas décision. Le Tech Lead tranche.**

| Proposition | Métrique | Pourquoi elle coche les 3 critères | Ce qu'un `MetricDefinition` apporterait |
|---|---|---|---|
| **#1** | **Taux de présence** (B1-B6 + B8) | (a) 9 implémentations, 4 formules divergentes ; (b) 8 dashboards + bulletins + santé + copilot = le plus consommé ; (c) 7 dimensions + paramètre `includeLate` non unifié | Une définition unique `taux_presence` avec dimensions `schoolId, classId, studentId, dateRange, includeLate: boolean, period` + cache `attendanceRate` materialized ou TTL court ; déduplication immédiate |
| **#2** | **Moyenne générale pondérée** (A1 + A4 + A10) | (a) 8 call-sites + 2 duplications inline ; (b) bulletins + grades + santé + 5 endpoints stats + 3 copilots ; (c) 7 dimensions + `hasCoefficientBySubject` par école | Une définition `moyenne_generale` avec `schoolId, classId, studentId, period, hasCoefficient, excludeAbsent` + cache `generalAverage` déjà existant mais éclaté ; unification `GradingEngine` vs `StatisticsController` simple avg |
| **#3** | **Indice de santé scolaire** (C1) | (a) 2 formules concurrentes (C1 vs C3 + Groq divergent) ; (b) cron + 5 vues + alertes + 2 prédictions ; (c) seuils par école + poids + windows 30j/3 périodes déjà configurables | Une définition composite `indice_sante` avec `schoolId, studentId, academicYearId` + 5 sous-métriques versionnées + `healthScore` déjà matérialisé mais sans historique ; historisation temporelle du score |

### Candidats suivants (rang 4-5, à considérer si 2-3 ne suffisent pas)

| Rang | Métrique | Justification |
|---|---|---|
| 4 | **Statistiques pédagogiques** (E2-E5) | 4 endpoints avec agrégation en mémoire `Σ/n` divergente de la pondérée ; `useCachedFetch` IndexedDB côté front uniquement — un cache serveur `MetricDefinition` éviterait les `findMany` répétés |
| 5 | **Agrégations finance / recouvrement** (D1-D5) | 8 repos avec même `aggregate _sum` filtré `schoolId+status` ; `tauxRecouvrement` calculé côté frontend (D4) devrait être côté serveur avec cache |

### Métriques écartées pour V3.5 (mais à garder en tête)

| Métrique | Raison de l'écart |
|---|---|
| `Mention` (A11) | Table de seuils statique, pas d'agrégation — pas besoin d'un moteur paramétrable, une simple unification de la duplication suffit |
| `Prédictions RULES/TabPFN` (C4-C5) | Non branchées en prod, comparatives — prématuré pour un `MetricDefinition` avant de trancher RULES vs ML |
| `Campagne MINESEC/MINEDUB` (E13) | Pipeline de génération XLS/PDF avec cache fichier et `supplement` JSONB — c'est un **moteur de documents**, pas un moteur de métriques agrégées |
| `Digest PP` (E11), `Vue conseil` (E12) | Métriques composites éphémères (agrégation de `healthScore` + `SUBJECT_DROP` sur 24h) — dérivées de C1/C2, pas de métrique primaire |

---

## Limites de l'audit

- **Aucun `MetricDefinition` n'existe** — vérifié par `grep -rn MetricDefinition` (0 résultat hors ce rapport).
- **Aucun cache serveur** sur les métriques listées hors `StudentProfile.healthScore`, `reportCard.*`, `storage/minedub-reports`, et `CarteScolaireScrapingAdapter` (4h/30min) — tout le reste est à la volée.
- **Aucune historisation temporelle** des métriques hors `reportCard` par période et `Payment/PaiementMinesec` rows — les taux et moyennes sont instantanés.
- **i18n :** les noms fonctionnels ci-dessus sont en français comme demandé ; les clés `useT` correspondantes n'ont pas été auditées (hors périmètre).
- **Frontend offline :** 4 endpoints stats + dashboard utilisent `useCachedFetch` IndexedDB (`offline/db.ts`) — c'est du cache **frontend** avec TTL infini jusqu'au refresh manuel, pas du cache serveur.

---

## Fichiers sources consultés (échantillon)

- `backend/src/domain/rules/GradingEngine.ts:23,29,61,77,128`
- `backend/src/domain/rules/IndiceSanteRules.ts:9,21,66,103`
- `backend/src/domain/ports/repositories/NoteRepository.ts:51,90` + `PrismaNoteRepository.ts:72,294`
- `backend/src/infrastructure/persistence/prisma/PrismaPresenceRepository.ts:87,120`
- `backend/src/infrastructure/persistence/prisma/PrismaSanteEleveRepository.ts:11,129`
- `backend/src/infrastructure/persistence/prisma/PrismaParentRepository.ts:64,88`
- `backend/src/infrastructure/persistence/prisma/PrismaDashboardQueryRepository.ts:18,28`
- `backend/src/infrastructure/persistence/prisma/PrismaPaiementRepository.ts:49` + `PrismaFactureRepository.ts:57,64` + `PrismaApeeRepository.ts:62` + `PrismaPaiementMinesecRepository.ts:118,124,134` + `PrismaGroupeScolaireQueryRepository.ts:108` + `PrismaOrientationRepository.ts:436`
- `backend/src/infrastructure/http/controllers/AttendanceController.ts:258` + `StatisticsController.ts:13,74,137,191` + `DashboardController.ts:15,56` + `AIController.ts:128,162,324,494,543`
- `backend/src/application/grade/DetecterChuteMoyenneUseCase.ts:109` + `CalculerMoyenneUseCase.ts:48` + `GenererBulletinUseCase.ts:124,228` + `GenererBulletinsInngestUseCase.ts:113` + `CalculerProgressionProgrammeUseCase.ts:48,112` + `GenererRapportPedagogieUseCase.ts:44` + `GenererRapportConseilUseCase.ts:30` + `PreparerVueConseilClasseUseCase.ts:56` + `EnvoyerDigestProfPrincipalUseCase.ts:16`
- `backend/src/infrastructure/inngest/functions/health.ts:15,27,54` + `reportCards.ts:45,81,94` + `academic.ts:49,77,101`
- `backend/src/infrastructure/services/ai/RulesBasedPredictionService.ts:29` + `TabPfnPredictionService.ts:46` + `GroqIAService.ts:46`
- `frontend/src/app/admin/dashboard/_components/SectionDashboard.tsx:22` + `SectionStatistics.tsx:48` + `SectionSchoolPayments.tsx:85` + `SectionFinance.tsx:249`

---

*Fin du rapport — en attente de la revue du Tech Lead pour le choix des 2-3 cas retenus.*
