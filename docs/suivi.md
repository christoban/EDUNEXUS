# Suivi — Reste à faire (Roadmap V0 → V3)

> **Source** : `docs/AUDIT_ROADMAP.md` — révision du **2026-08-21** (après clôture V2.5 : 662 tests verts, `tsc` 0).
> **Légende statut** : ⬜ ABSENT · 🟠 PARTIEL · 🟡 FAIT NON TESTÉ
> **Légende faisabilité** : ✅ **Muse Spark** (exécutante — je peux le faire, Faible/Moyenne, pattern existant) · ⚠️ **Tech Lead humain / Claude Code** (Élevée/Très élevée — décision produit/archi/sécurité, ou hardware)
> **Note** : la section F « Incohérences de la roadmap » a été retirée — 4 incohérences corrigées dans `AUDIT_ROADMAP.md` (V1.7, V0.6, §1 n°99 et n°103).

---

## A. Fonctionnalités ABSENTES (⬜) — à construire de zéro

| # | Section | Détail | Faisabilité |
|---|---|---|---|
| V2.2 | Configuration intelligente (« config locale > template ») | Rien n'existe (`configLocal`, `resolveConfig`, `override`… introuvables). Lié à V0.4 : pas de terrain car le template n'est jamais ré-appliqué. | ⚠️ Tech Lead — YAGNI : ne pas construire de moteur générique sans 2-3 cas réels |
| V2.15 | Tâches administratives | Aucun modèle `Task`/`Tache`, aucun fichier applicatif. | ✅ Muse Spark — 1 table `Task` minimale (lazy), à préciser les champs |
| V3.5 | Reporting Engine mature (métriques versionnées) | Aucun `MetricDefinition`, aucun cache/agrégation de métriques paramétrables. | ⚠️ Tech Lead — moteur générique interdit sans 2-3 cas (I) |
| V3.9 | Tests de bout en bout (e2e) | Aucun `playwright.config`/`cypress.config` ; `playwright` en dépendance mais jamais importé ; 0 des 5 scénarios e2e demandés. | ✅ Muse Spark (scaffold) / ⚠️ Humain (choix des 5 scénarios) |

---

## B. Fonctionnalités PARTIELLES (🟠) — à compléter

| # | Manque précis | Faisabilité |
|---|---|---|
| V0.1 | 6 use cases importent l'infrastructure directement ; certains prennent `PrismaClient` en constructeur ; aucun outil (`dependency-cruiser`/`ESLint boundaries`) ne verrouille l'hexagonal. | ✅ Muse Spark quand le port existe déjà / ⚠️ Tech Lead si nouveau port à créer |
| V0.4 | Pas de `TemplateVersion`/`TemplateConfiguration` ; **aucune ré-application de template** (donc la règle « jamais écraser un override » est sans objet). | ⚠️ Tech Lead — changement de flux transverse |
| V1.1 | Pas de « profil académique » unifié (forces/faiblesses) au-delà du `healthScore`. | ⚠️ Tech Lead — spec produit manquante (qu'est-ce qu'un profil ?) |
| V1.4 | Mapping de colonnes figé en dur ; pas d'étape « Correction » ; scope limité à STUDENT/TEACHER (pas personnel/parents/classes). | ⚠️ Tech Lead — étape « Correction » = décision produit |
| V1.6 | **Absents** : `AssessmentParticipation`, `AssessmentScope`, `HarmonizedAssessmentSession`, `InvigilationPolicy`, `Assessment Calendar` par rôle, `Assessment Workload`. Grade et Attendance **jamais croisés** (7/20 d'un absent = 7/20 d'un présent). | ⚠️ Tech Lead — 6 modèles à spécifier MINESEC |
| V2.4 | LV2/PEBS en **double écriture** (`lv2SubjectId`/`pebsFiliere` restent source de vérité) — à unifier. | ⚠️ Tech Lead — unification = risque de perte de données |
| V2.11 | Présence enseignants : **aucun QR/GPS/photo** dans le schéma ; pas de gate de présence avant saisie du cahier de textes. | ⚠️ Tech Lead / Humain — hardware dérive, besoin calibration physique |
| V2.12 | **Aucun moteur de routage par urgence** (canal codé en dur) ; pas de suivi envoyé/reçu/lu/confirmé (seul `isRead`). | ⚠️ Tech Lead — matrice urgence→canal à spécifier |
| V2.14 | Recensement MINESEC : ~**6 feuilles sur 17** couvertes. | ✅ Muse Spark — ajouter des feuilles (copier `xlsEngine.ts`) |
| V3.1 | Cache miroir RBAC **absent** ; dépendance graduée par opération **absente** ; `db.messages` **non purgé** au logout. | ✅ Muse Spark pour `db.messages` (1 ligne) / ⚠️ Tech Lead pour cache RBAC gradué |
| V3.3 | Confirmation utilisateur obligatoire = **2 actions sur ~54** seulement ; le reste s'exécute sans confirmation (undo a posteriori). | ⚠️ Tech Lead — généraliser = décision sécurité transverse |
| V3.4 | « Forces/faiblesses par matière » = simple détection de chute, pas une vue consolidée. | ⚠️ Tech Lead — vue à spécifier |
| V3.8 | Neon PITR = **6h de rétention** (plan gratuit), très sous le minimum. | ⚠️ Humain — décision infra/coût (changer de plan Neon) |
| V3.10 | `seed.ts` ne peuple **aucune donnée réelle** ; scripts `generate-*.mjs` couvrent **1 seule famille de template** sur les 4 demandées. | ✅ Muse Spark — étendre `seed.ts` (1 famille → 4) |

---

## C. Fait mais NON TESTÉ (🟡) — prioritaires en couverture

> Tous ces tests suivent un pattern déjà dans le repo (`InMemory*Repository`, `User.reconstituer`). C'est ma zone la plus sûre.

| # | Use cases / zones non testés | Faisabilité |
|---|---|---|
| V0.3 | `VerifierMfaConnexionUseCase`, `VerifyMfaUseCase`, `VerifyGroupOwnerMfaUseCase`. | ✅ Muse Spark — fait (17 tests) |
| V0.6 | `ActiverEtablissementUseCase` (~1000 lignes) — le cœur du jalon V0. | ✅ Muse Spark — mais fichier sensible (500 l. → split si besoin) |
| V1.1 | `TransfererEleveUseCase` + 4 use cases d'onboarding. | ✅ Muse Spark |
| V1.3 | Permissions, `CareerEvent`, congés (`LeaveRequest`/`LeaveBalance`), `MissionOrder`. | ✅ Muse Spark |
| V1.4 | `ImporterUtilisateursUseCase` (439 lignes). | ✅ Muse Spark |
| V1.8 | `EnvoyerBulletinsUseCase`, export ZIP, `ReportCardController.ts` (628 lignes). | ✅ Muse Spark |
| V1.10 | Babillard : pas de « catégorie » ni tracking de lecture. | ✅ Muse Spark |
| V2.1 | `ActiverEtablissementUseCase` (1073 l.), `ConfigurerEtablissementUseCase`, `ImporterUtilisateursUseCase`. | ✅ Muse Spark |
| V2.6 | Pipeline événementiel Inngest — **aucun test** sur le pipeline. | ✅ Muse Spark |
| V2.7 | Cas `DELIBERATION` (traité comme `PASS`) + intégration orientation (`findClasseCibleOrientation`). | ✅ Muse Spark |
| V2.8 | LV2 **et** PEBS — **aucun test**. | ✅ Muse Spark |
| V2.9 | Tout le module orientation — **aucun test**. | ✅ Muse Spark |
| V2.10 | `CalculerAdmissionConcoursUseCase` non testé. | ✅ Muse Spark |
| V2.13 | APEE — **zéro test**. | ✅ Muse Spark — fait (8 tests) |
| V2.14 | Recensement MINESEC — **aucun test**. | ✅ Muse Spark |
| V3.1 | Aucun test frontend (pas de script `test` dans `frontend/package.json`). | ✅ Muse Spark (scaffold vitest) |
| V3.3 | `AssistantController`, catalogues d'actions, RBAC/anti-hallucination — **zéro test** (seule la journalisation en aval est testée). | ✅ Muse Spark pour RBAC (mocker Groq) / ⚠️ Tech Lead pour `/execute` non déterministe |
| V3.4 | `CreerActionSuiviEleveUseCase` (escalade) non testé. | ✅ Muse Spark |
| V3.8 | MFA et backups (hors rotation) non testés. | ✅ Muse Spark |

> **Note** : V0.6 figure ici car la roadmap le laisse en 🟡 malgré les 10 tests d'intégration ajoutés en §3.5 — statut conservé tel quel, à arbitrer si passage en ✅.

---

## D. Écarts d'architecture (§1) — à corriger

| # | Écart | Faisabilité |
|---|---|---|
| 1 | **V0.1 — Fuites hexagonales** : use cases `application` importent des services `infrastructure` ou prennent `PrismaClient` en constructeur (ex. `activerRessourceLiee.ts:15`, `AnalyserDiplomeUseCase.ts:1`, `ActiverEtablissementUseCase.ts:32`). | ✅ Muse Spark si port existe / ⚠️ Tech Lead si nouveau port + container |
| 2 | **V2.6** : `inngest.send()` émis depuis les contrôleurs HTTP, pas depuis une couche « Domain Rule ». | ⚠️ Tech Lead — flux transverse, à valider en revue |
| 3 | **V2.12** : canal de notification codé en dur par l'appelant. | ⚠️ Tech Lead — matrice à spécifier (cf. B V2.12) |
| 4 | **V3.3** : pattern « confirmation obligatoire avant persistence » non généralisé (~54 actions, **2 seulement** confirmées). | ⚠️ Tech Lead — décision sécurité + UX |

---

## E. Les 5 zones risquées (§3) — restes ouverts

| # | Risque | Reste | Faisabilité |
|---|---|---|---|
| 1 | Assistant IA `/execute` | Non couvert (nécessite un **mock du modèle Groq** non déterministe — décision à prendre). | ⚠️ Tech Lead — mock + revue du non-déterminisme |
| 2 | Paiements offline — conflit de version (V3.2) | **Manque de conception**, pas seulement de test. | ⚠️ Tech Lead — conception à faire avant le test |
| 3 | Permissions / isolation / MFA | `authorizeSchool` (RBAC `perm:*`) + les 3 use cases MFA toujours sans test ; isolation démontrée sur **15 routes** (3 + 12). | ✅ Muse Spark (tests) / ⚠️ Tech Lead (RBAC `perm:*` = revue sécurité) |
| 4 | Mentions complémentaires | `middleware/idempotency.ts` (anti-double-exécution) non testée ; `AppliquerTransfertPebsUseCase` non testée ; `ImporterUtilisateursUseCase` non testé. | ✅ Muse Spark |

---

## Synthèse — 3 grands chantiers restants

1. **Couvrir ce qui est construit mais non testé** (§C) — le plus volumineux, à forte valeur : `ActiverEtablissementUseCase`, `ImporterUtilisateursUseCase`, MFA, orientation, LV2/PEBS, concours, APEE, MINESEC, pipeline Inngest, assistant IA. → **✅ Muse Spark** (lot par lot, `tsc` + tests verts).
2. **Compléter les fonctionnalités partielles** (§B) — workflow de validation des frais (V1.11), moteur de routage des notifications (V2.12), moteur de reporting (V3.5), tâches (V2.15), ré-application de template (V0.4/V2.2), présence géolocalisée (V2.11), timeline unifiée (V3.6), e2e (V3.9). → **Mixte** : V1.11/V2.13/V2.14/V3.6/V3.7 = ✅ Muse Spark ; le reste = ⚠️ Tech Lead (spec manquante).
3. **Corriger les écarts d'architecture** (§D) — fuites hexagonales, canal de notification codé en dur, confirmation IA non généralisée. → **⚠️ Tech Lead** (revue transverse).

*Dernière mise à jour : 2026-08-21 — après clôture V2.5. Source : `AUDIT_ROADMAP.md` (F retirée, déjà corrigée). Faisabilité annotée par **Muse Spark** (exécutante) — les lignes ⚠️ nécessitent un arbitrage produit/archi avant implémentation.*
