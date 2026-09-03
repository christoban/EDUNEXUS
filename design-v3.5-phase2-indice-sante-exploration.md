# Design V3.5 — Phase 2 : Exploration historisation indice santé

> **Date :** 2026-09-03 — lecture seule, chiffres réels `zekoulabia_dev` (1 école) / `zekoulabia_test` (12 écoles)
> **Références :** `audit-v3.5-reporting-candidates.md §C1`, `design-v3.5-metric-definition.md §3.4`, fix V3.5-bis (`5b6149c`)

---

## Partie 1 — Mécanisme actuel re-vérifié

### 1.1 Flux cron nocturne (fichier:ligne exact)

```
health.ts:15  computeStudentHealthScores  — cron "0 2 * * *"
  → step "compute-all-schools" → CalculerScoresSanteUseCase:17 execute()
    → healthJobsRepository.findActiveSchools()          :19
    → healthJobsRepository.getSchoolConfig(school.id)   :22  (aiAlertsEnabled, aiRiskThreshold 50/30)
    → healthJobsRepository.findCurrentAcademicYear      :27
    → healthJobsRepository.findStudentIdsForSchool      :30
    → boucle students:
        calculerIndice.calculerScoreSeulement(userId, school.id, year.id) :34
          → SanteEleveRepository.getDonneesSante        :81  (PrismaSanteEleveRepository.ts:12)
          → IndiceSanteRules.calculerComposantesSante   :86
          → SanteEleveRepository.sauvegarderScore       :87  (studentProfile.update healthScore)
        → events ai/alert.critical|warning|positive selon seuils :42-49
  → inngest.send(events)                                :22 (health.ts)

health.ts:27  handleCritical/Warning/Positive (event ai/alert.*)
  → GererAlertesSanteUseCase.handleCritical/Warning/Positive
    → IA genererConseilPersonnalise + healthJobsRepository.createRecommendation → StudentRecommendation (HEALTH_CRITICAL/WARNING/POSITIVE, recipientRole PARENT/STUDENT/TEACHER)
    → notifierParents / notifierPersonnelDirect (censeurs VALIDATE_GRADES, orientation si ≥2 critical sur 60j)
```

**Effet du fix V3.5-bis sur la composante notes (35%) :** Oui. `PrismaSanteEleveRepository.getDonneesSante` appelle `calculateAverageScoreOn20` pour `moyenneGenerale` (`:32`) et pour `moyennesPrecedentes` (`:78`) avec `hasCoefficientBySubject` désormais résolu via `resolveHasCoefficientForClass(school, level)` (classe de l'élève via `enrollment → class.level`). Avant fix, `true` figé ; après fix, `FR_PRIMAIRE/EN_PRIMAIRE/MATERNELLE/CAP` → `false` (moyenne simple), `FR_GENERAL_SEC/FR_TECHNIQUE` → `true`. Avec 0 note en base, l'effet est nul mesurable, mais la composante notes du score changera pour les écoles primaires dès qu'il y a des notes.

`IndiceSanteRules.calculerComposantesSante:67` et `PrismaSanteEleveRepository:32,78` appellent bien `calculateAverageScoreOn20` (pas une autre voie) — la correction s'y propage.

### 1.2 Aucune table d'historique n'existe

```bash
grep -r "HealthScoreHistory|MetricHistory|StudentHealthSnapshot" backend --include="*.ts" backend/prisma --include="*.prisma"
# 0 résultat

grep -n "healthScore" backend/prisma/schema.prisma
# 687:  healthScore  Int?  @default(75)  — StudentProfile, une seule colonne
```

**Vérification finale :** `StudentProfile.healthScore` est écrasé chaque nuit par `sauvegarderScore:144` (`studentProfile.update {healthScore: score}`). Aucune table `HealthScoreHistory`, `MetricHistory` ou `StudentHealthSnapshot` n'existe. Le design v1 §3.4 qui esquissait `MetricHistory` générique n'a jamais été implémenté.

### 1.3 Le score composite contient déjà une mémoire temporelle

`IndiceSanteRules.ts:49 calculerTendance(moyennes: number[])` :

```ts
if (moyennes.length < 2) return 50;
let tendance = 50;
for (i=1..len-1) { diff = moyennes[i]-moyennes[i-1];
  if (diff>=2) tendance+=25; else if (diff>=0.5) tendance+=10;
  else if (diff<=-2) tendance-=25; else if (diff<0) tendance-=10; }
return clamp(tendance,0,100);
```

Pondération `0.20` du score final (`POIDS_INDICE_SANTE.tendance:23`).

`moyennesPrecedentes` est calculée par `PrismaSanteEleveRepository:59-88` : 3 dernières `AcademicPeriod` de l'année (`take:3, orderIndex asc`), chaque période → `moyennesPrecedentes.push(calculateAverageScoreOn20(notesPeriode))`. C'est déjà **3 points temporels** reconstitués à chaque nuit **sans historiser le score final** : on recalcule depuis les notes brutes (`Grade`) et les présences brutes, pas depuis des snapshots `healthScore`.

**Nuance :** historiser le `healthScore` final dupliquerait une information déjà reconstituable pour la composante tendance, mais pas pour les 4 autres composantes (notes courante, assiduité 30j, sanctions année, paiements) qui dépendent aussi du temps mais ne sont pas historisées. Un snapshot `healthScore` figerait le composite, pas ses entrées.

---

## Partie 2 — Besoins réels des 5 consommateurs

| # | Consommateur | Fichier:ligne | Ce qu'il fait aujourd'hui | Besoin d'historique temporel ? | Conclusion |
|---|--------------|---------------|---------------------------|--------------------------------|------------|
| 1 | `AIController.getStudentsHealth` (ADMIN/VALIDATE_GRADES, vue d'ensemble) | `AIController.ts:128` | `findStudentsByClass(schoolId, classId)` → `healthScore ??75` → `alertLevel` + `summary {critical,warning,recommendation,good,excellent}` | **Non** — affiche la valeur **courante** par élève, 5 catégories instantanées. Aucun `trend`, courbe ou champ `previousScore` dans la réponse. Frontend `SectionAdminAI` / dashboard admin : KPI instantané. | **Valeur courante uniquement** |
| 2 | `AIController.getAtRiskStudentsForTeacher` (PP) | `AIController.ts:166` (`findStudentsByClasses(ppClassIds, {healthScoreLte: warningThreshold})` :215) | `healthScore <= warningThreshold` (50) pour PP, sinon chutes `SUBJECT_DROP` 30j | **Non** — filtre seuil absolu sur valeur courante, pas de comparaison `hier vs aujourd'hui`. | **Valeur courante** |
| 3 | `AIController.getHealthTracking` (PARENT/STUDENT, "30j") | `AIController.ts:324` | `findStudentHealthScores(studentIds)` → `healthScore` **courant** + `findStudentRecommendations({HEALTH_CRITICAL/WARNING/POSITIVE})` (dernier conseil) + `findStudentRecommendations({CONVOCATION, since:30j})` (`:362-381`). Le "30j" porte sur **la convocation** (fenêtre d'affichage), pas sur le score. **Aucun `tendance` calculé ici** ; la tendance est dans `IndiceSanteRules` (3 périodes de notes, pas 30j de scores). Si des snapshots existaient, on pourrait afficher une courbe, mais le code actuel **recalcule tout depuis les brutes** (`getDonneesSante` sur 30j présences + 3 périodes notes) à chaque nuit, pas depuis des `healthScore` historisés. | **Non aujourd'hui** — le nom `health-tracking` suggère un suivi, mais l'implémentation est **ponctuelle** (dernier score + dernier conseil). Un historique permettrait une courbe parent, mais **aucune demande frontend** n'affiche une telle courbe. | **Valeur courante + dernier conseil** ; historique = évolution cosmétique, pas besoin métier démontré |
| 4 | `GererAlertesSanteUseCase` (notifs parents/censeurs/orientation) | `GererAlertesSanteUseCase.ts:85,122,153` | `handleCritical/Warning/Positive` déclenchés par **seuil absolu** `score <= critical(30)` / `warning(50)` / `tendancePositive(>=75)` — pas par `score - previousScore`. Seule la détection de **risque persistant** pour orientation (`64-83`) fait `countCriticalRecommendations(studentId, depuis 60j) >=2` → compte des `StudentRecommendation` sur 60j, pas des `healthScore`. **Aucune comparaison `hier vs aujourd'hui`**. | **Non** — besoin actuel = seuil, pas dégradation. *Si* on voulait détecter `chute de 10 points en 7 jours`, il faudrait un historique, mais ce besoin n'existe pas dans le code. | **Seuil absolu** ; historique = détection de dégradation **non demandée** |
| 5 | Copilot `lister_eleves_a_risque` | `adminHrCommRiskActions.ts` (via `AIContextQueryRepository.findStudentsByClass` + filtre `healthScore`) | Valeur courante pour lister les élèves à risque dans le chat | **Non** | **Valeur courante** |

**Conclusion Partie 2 : 5/5 consommateurs utilisent la valeur courante.** Aucun ne lit une série temporelle `healthScore` ni ne compare `score(t)` vs `score(t-1)`. La seule "mémoire" existante est comptage de `StudentRecommendation` sur 60j (orientation) et `moyennesPrecedentes` (3 périodes de notes) — tous deux reconstituables sans historiser le score.

---

## Partie 3 — Volumétrie et rétention

### 3.1 Volume théorique

```sql
-- zekoulabia_dev: 1 école, 0 élève actif, 0 Grade, 0 ReportCard
-- zekoulabia_test: 12 écoles FRANCOPHONE GENERAL, 2 élèves actifs, 0 Grade, 0 ReportCard
SELECT COUNT(*) FROM "StudentProfile" WHERE "studentStatus"='ACTIVE';
-- dev: 0, test: 2
```

| Hypothèse | Lignes / jour | Lignes / an (365j) |
|-----------|---------------|--------------------|
| 1 école, 500 élèves, 1 snapshot quotidien | 500 | **182 500** (~0.18M) |
| 100 écoles, 500 élèves chacune, quotidien | 50 000 | **18 250 000** (~18M) |
| 100 écoles, hebdomadaire (52/an) | 500 → 50 000 / semaine | **2 600 000** (~2.6M) |

*Estimation à partir d'une classe complète : non, `Class.capacity` n'est pas fiable (40 par défaut, mais `StudentProfile` est vide). Estimation 500/école = hypothèse moyenne secondaire (12 classes × 40).*

À titre de comparaison, `Grade` est vide en dev/test, mais en prod une école de 500 élèves × 8 matières × 6 séquences = 24 000 notes/an — le volume `healthScore` quotidien (182k/an/école) est **7× supérieur** aux notes.

### 3.2 Politique de rétention existante

- **Logs :** `SchoolSettings.logRetentionDays Int @default(90)` (`schema.prisma:473`) — 90 jours pour `ActivitiesLog`/`EmailLog`/`SmsLog`.
- **Présences :** pas de purge, `Attendance` conservé indéfiniment (utilisé pour 30j glissants).
- **Notes :** conservées indéfiniment (bulletins).
- **Précédent le plus proche :** `logRetentionDays 90j` pourrait servir de référence pour un historique `healthScore` à vocation d'alerte (pas d'archive légale comme les bulletins, qui eux sont conservés).

**Aucune rétention n'est décidée pour `healthScore`.** Si on historise, 90 jours (comme les logs) vs 1 an (année scolaire) vs indéfini (comme les notes) sont les 3 options à trancher.

---

## Partie 4 — Proposition (sans implémenter)

### 4.1 Vrai historique multi-snapshot ou simple `healthScorePrecedent` ?

**Une colonne `healthScorePrecedent` (avant-dernière valeur) suffit pour TOUS les besoins réels identifiés :**
- Les 5 consommateurs n'ont besoin que de la valeur courante.
- La seule détection de dégradation qui pourrait un jour exister (`score chute de X points`) se ferait sur `score - previousScore` d'un cron à l'autre — une seule valeur précédente suffit, pas une série.
- `tendance` (20% du score) est déjà calculée depuis 3 périodes de notes, pas depuis des scores — historiser le score n'apporterait rien à cette composante.

**Un vrai historique (courbe parent, audit) est cosmétique** : il permettrait d'afficher une courbe d'évolution dans `getHealthTracking`, mais aucune maquette, ticket ou demande utilisateur ne le prévoit. Construire une table `HealthScoreSnapshot` quotidienne pour afficher une courbe que personne n'a demandée est la sur-ingénierie qu'on a évitée pour `taux_presence`/`moyenne_generale` (cache TTL simple vs table générique).

**Ne présuppose pas :** si le besoin de courbe parent devient réel, il faudra un vrai historique, mais aujourd'hui ce n'est pas démontré.

### 4.2 Table dédiée `HealthScoreSnapshot` vs générique `MetricHistory`

| Critère | `HealthScoreSnapshot` dédiée (`studentId, schoolId, score, composantes Json, computedAt`) | `MetricHistory` générique (`metricKey, dimensions Json, value, computedAt`) |
|---------|---------------------------------------------------------------|---------------------------------------------------------------|
| **Extensibilité** | Ne sert que `healthScore` — si `taux_presence`/`moyenne_generale` veulent aussi un historique, il faut une 2ᵉ table | Réutilisable pour toute métrique sans migration |
| **Requêtage** | `WHERE studentId + ORDER BY computedAt` — index simple, lisible | `WHERE metricKey='healthScore' AND dimensions @> '{"studentId":"..."}'` — Json, hash, moins lisible |
| **Coût** | 1 table, 1 index, pas de hash | Générique = Json + `dimensionsHash`, comme `MetricCache` mais persistant |
| **Choix v1 §3.4** | Le design v1 §3.4 esquissait `MetricHistory` générique pour `healthScore` alors qu'un historique `healthScore` n'est même pas nécessaire — même erreur que `MetricCache` générique si on l'avait fait en KV au lieu de colonnes dédiées (`reportCard`, `healthScore`). |

**Sans trancher :** si un vrai historique s'avère nécessaire, `HealthScoreSnapshot` dédiée est plus simple et plus proche de `reportCard`/`healthScore` (colonnes dédiées, pas KV). `MetricHistory` générique n'a d'intérêt que si 2+ métriques demandent un historique simultanément — ce qui n'est pas le cas (taux/moyenne n'en demandent pas).

### 4.3 Fréquence et rétention (si historique il y a)

| Question | Option | Avantage | Inconvénient |
|----------|--------|----------|--------------|
| **Fréquence** | Quotidien (cron 02:00) | Granularité max, simple (même rythme que le calcul actuel) | 182k lignes/an/école, 18M pour 100 écoles |
| | Hebdomadaire | 7× moins de volume, suffisant pour une courbe parent (tendance lente) | Perte de détection de dégradation rapide (chute en 3 jours non vue) |
| **Rétention** | 90 jours (comme `logRetentionDays`) | Cohérent avec les logs, purge simple `DELETE WHERE computedAt < now-90d` | Perte de l'année complète pour audit |
| | 1 an (année scolaire) | Garde toute l'année en cours, purge à la clôture | 182k/école/an conservés |
| | Indéfini (comme `Grade`/`ReportCard`) | Aucune purge, historique complet | 18M pour 100 écoles sur 5 ans = 90M lignes |

**Sans trancher :** avec 0 donnée aujourd'hui et 500 élèves/école, le quotidien est acceptable (182k/an/école < `Grade` 24k × 7). L'hebdomadaire divise par 7 sans perdre beaucoup pour un score qui bouge lentement (notes par séquence, pas par jour). La rétention 90j est le précédent le plus proche.

---

*Fin — en attente décision Tech Lead : faut-il un historique, et si oui, snapshot dédié ou générique, quotidien ou hebdomadaire, 90j/1an/indéfini.*

