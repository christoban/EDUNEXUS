# Plan d'implémentation — ZekoulABia V1
## Brique Orientation Scolaire + Infrastructure Prédictive
### Document destiné à Claude Code — contient tout ce qui a été validé, prêt à exécuter

---

## 0. Contexte pour l'agent qui va exécuter ce plan

**Stack existant** : Bun + Express.js + TypeScript + Prisma + PostgreSQL (Neon), architecture hexagonale (Ports & Adapters), frontend Next.js, jobs asynchrones via Inngest, notifications SMS via Techsoft, paiements via CampPay (MTN MoMo + Orange Money), IA conversationnelle via Groq derrière un port `IAService` (`backend/src/domain/ports/services/IAService.ts`) déjà en place et éprouvé (copilot Admin avec catalogue d'actions RBAC).

**Ce document couvre deux briques distinctes, indépendantes l'une de l'autre** (aucune dépendance d'ordre, peuvent être développées en parallèle) :
- **Partie A** — la brique Orientation Scolaire (moteur de règles, sans IA, sans ML).
- **Partie B** — l'infrastructure prédictive (`PredictionService`, adapter TabPFN v2), qui servira à terme l'Orientation, le risque d'impayé et la détection des élèves à risque.

**Recommandation de séquencement si une seule personne développe** : commencer par la Partie A (périmètre complètement bouclé, valeur utilisateur immédiate). La Partie B peut suivre ou être menée en parallèle si les ressources le permettent.

**Principe transversal aux deux parties, non négociable** : aucune IA générative et aucun modèle prédictif ne pilote de décision réelle communiquée à une famille sans validation humaine préalable (conseiller d'orientation pour la Partie A ; cycle de validation sur données réelles pour la Partie B). Ce document ne demande à aucun moment d'installer ou de configurer un modèle de langage open source — le port `IAService` existant suffit à garantir la migration future, rien à construire de plus sur ce point précis.

---

# PARTIE A — BRIQUE ORIENTATION SCOLAIRE (V1)

## A.1 Objectif exact

Produire, pour chaque élève concerné, une fiche d'analyse d'orientation consultable par le conseiller d'orientation, combinant tendance de notes réelles, résultat du test psychotechnique (si l'établissement en fait un), et aspirations déclarées — pour aboutir à 2-3 pistes de filière recommandées, jamais un verdict fermé.

### A.1.1 Deux points de bascule, un seul mécanisme générique

Il n'existe **pas** de filière TI ni D en Seconde. Les filières disponibles en Seconde sont **A (littéraire), SES, et C (scientifique)**. TI et D n'apparaissent qu'à l'issue de la Seconde C, comme choix d'entrée en Première.

| Point de bascule | Élèves concernés | Pistes possibles |
|---|---|---|
| **Checkpoint 1 — Fin de 3ème** | Tous les élèves de 3ème | A, SES, C |
| **Checkpoint 2 — Fin de Seconde C** | Élèves actuellement en Seconde C uniquement | Rester **C**, ou aller en **D**, ou aller en **TI** |

Un seul moteur générique, paramétré différemment selon le point de bascule via un `OrientationCheckpointType` (enum) et une table de configuration (pas du code en dur) définissant, pour chaque type, les pistes possibles et les matières pertinentes — pour pouvoir ajouter un futur point de bascule sans réécrire le moteur.

### A.1.2 Le dernier mot appartient toujours à l'élève

Le système propose, le conseiller valide ou ajuste, mais c'est l'élève qui décide en dernier ressort :

1. Le moteur calcule une proposition, le conseiller la valide (ou l'ajuste) → statut `PROPOSEE_A_L_ELEVE`.
2. L'élève reçoit une notification avec un délai de réponse défini (configurable par établissement, ex. 15 jours).
3. Des rappels sont envoyés à l'approche de l'échéance.
4. Deux issues à l'échéance : l'élève a répondu (confirmé ou choisi une autre piste parmi celles proposées) → `VALIDEE_ELEVE` ; l'élève n'a pas répondu → `VALIDEE_PAR_DEFAUT`, la piste du conseiller est retenue.
5. Le processus normal de passage de classe (déjà existant) migre l'élève vers la classe correspondant à la piste retenue à la rentrée suivante — l'orientation alimente la donnée que le passage de classe utilise déjà, ce n'est pas un module séparé.

### A.1.3 Le déclenchement événementiel — comment ça s'active

Élément permanent (notes, ancrées séquence après séquence) + élément événementiel (l'orientation, ponctuelle) :

1. Une **fenêtre d'orientation**, configurable par établissement (ex. mars-mai), définit la période d'écoute — pas une date unique de bascule globale.
2. À l'intérieur de cette fenêtre, le déclenchement se fait **élève par élève**, pas en bloc : dès qu'une donnée significative arrive pour un élève éligible (le conseiller enregistre son test psychotechnique, ou — si l'établissement n'en fait pas — dès que ses notes du trimestre en cours sont complètes), le calcul se déclenche immédiatement pour cet élève précis.
3. Le résultat arrive dans la file du conseiller (`CALCULEE`), jamais envoyé directement à l'élève sans passage humain. Le conseiller peut valider plusieurs élèves en lot.
4. **L'absence de test psychotechnique et le droit de l'élève à valider/changer sont deux axes indépendants.** Un élève sans test reçoit quand même une proposition calculée sur ses seules notes, et garde le dernier mot comme n'importe quel autre élève.
5. **Filet de sécurité** : un tableau de bord conseiller liste, à l'approche de la fermeture de la fenêtre, les élèves sans recommandation encore calculée.

### A.1.4 Ce que la V1 ne fait toujours PAS

- Pas de flux anglophone (Form 5 → Lower Sixth / Arts-Sciences) — V2.
- Pas d'IA générative pour rédiger l'explication — gabarits texte uniquement (templates), pas de modèle de langage.
- Pas de suivi longitudinal des résultats réels post-orientation — V3.
- Pas de vue "agrégée établissement" pour l'admin — peut attendre V2.
- Pas de modèle ML/TabPFN pour cette brique en V1 — le moteur de règles suffit et n'a pas le problème de démarrage à froid des modèles entraînés (voir Partie B).

## A.2 Qui gère cette brique — RBAC

**Seul le conseiller d'orientation** gère l'orientation — pas le censeur, pas le proviseur, pas l'admin par défaut. Un paramètre par établissement `hasDedicatedOrientationCounselor` (booléen, `true` par défaut, sur `SchoolTenantConfig`) permet, à titre d'échappatoire explicite et traçable, de désigner un rôle de repli si un établissement précis n'a effectivement personne dans ce rôle — jamais le comportement par défaut.

`PsychotechnicalTestResult` et `OrientationRecommendation` restent invisibles par défaut aux enseignants et aux autres élèves.

## A.3 Modèle de données (ajouts Prisma)

```prisma
enum OrientationCheckpointType {
  FIN_TROISIEME       // Checkpoint 1 : 3ème -> Seconde (A / SES / C)
  FIN_SECONDE_C        // Checkpoint 2 : Seconde C -> Première (C / D / TI)
}

// Configuration par établissement : quelles pistes sont possibles, quelles matières comptent,
// et si le test psychotechnique est utilisé à ce checkpoint dans cet établissement.
model OrientationCheckpointConfig {
  id              String   @id @default(cuid())
  schoolId        String
  school          School   @relation(fields: [schoolId], references: [id])
  type            OrientationCheckpointType
  possibleTracks  Json     // ex. ["A", "SES", "C"] ou ["C", "D", "TI"]
  relevantSubjects Json    // matières déterminantes et poids pour ce checkpoint
  psychotechnicalTestRequired Boolean @default(false)
  // false = cet établissement ne fait pas de test à ce checkpoint : le calcul repose
  // entièrement sur les matières déterminantes. true = le test existe et s'ajoute au
  // calcul. Configuration normale par établissement, jamais un indicateur de donnée
  // manquante — à ne pas confondre avec un élève isolé sans test dans un établissement
  // qui en fait normalement.

  @@unique([schoolId, type])
}

// Résultat du test psychotechnique officiel, saisi par le conseiller d'orientation
model PsychotechnicalTestResult {
  id                String   @id @default(cuid())
  studentProfileId  String
  studentProfile    StudentProfile @relation(fields: [studentProfileId], references: [id])
  checkpointType    OrientationCheckpointType

  testDate          DateTime
  administeredById  String
  administeredBy    User     @relation(fields: [administeredById], references: [id])

  // Champs à confirmer avec un vrai conseiller d'orientation avant de figer (voir A.8)
  scientificAptitude   Int
  literaryAptitude     Int
  technicalAptitude    Int
  notes                String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([studentProfileId, checkpointType])
}

// Aspirations déclarées par l'élève lui-même
model StudentAspiration {
  id                String   @id @default(cuid())
  studentProfileId  String
  studentProfile    StudentProfile @relation(fields: [studentProfileId], references: [id])
  checkpointType    OrientationCheckpointType

  desiredTrack      String?
  careerInterest    String?
  submittedAt       DateTime @default(now())

  @@unique([studentProfileId, checkpointType])
}

model OrientationRecommendation {
  id                String   @id @default(cuid())
  studentProfileId  String
  studentProfile    StudentProfile @relation(fields: [studentProfileId], references: [id])
  checkpointType    OrientationCheckpointType

  generatedAt       DateTime @default(now())
  dataDepthMonths   Int
  confidenceLevel   ConfidenceLevel

  suggestedTracks   Json     // [{ track: "C", score: 82, justification: [...] }, ...]

  reviewedById      String?
  reviewedBy        User?    @relation(fields: [reviewedById], references: [id])
  counselorNotes    String?
  counselorFinalTrack String?

  status            RecommendationStatus @default(CALCULEE)

  proposedAt        DateTime?
  responseDeadline  DateTime?
  remindersSentAt   Json?
  studentChosenTrack String?
  finalizedAt       DateTime?
  finalTrack        String?   // la piste réellement retenue, celle que le passage de classe utilisera

  @@index([studentProfileId, checkpointType])
}

enum ConfidenceLevel {
  ELEVEE
  MOYENNE
  FAIBLE
}

enum RecommendationStatus {
  CALCULEE
  VALIDEE_CONSEILLER
  PROPOSEE_A_L_ELEVE
  VALIDEE_ELEVE
  VALIDEE_PAR_DEFAUT
}
```

## A.4 Le moteur de règles et de scores — algorithme détaillé

### A.4.1 Étape 1 — Tendance par matière

Pour les matières définies dans `OrientationCheckpointConfig.relevantSubjects` :

```
tendance_matière = moyenne_pondérée(
  notes_des_N_derniers_trimestres,
  poids_croissant_avec_la_récence
)
```
Normalisée sur 0-100.

### A.4.2 Étape 2 — Score par piste, selon le checkpoint

**Checkpoint 1 (fin de 3ème) — pistes A / SES / C :**

```
score_C   = 0.5 * moyenne(maths, physique, svt)      + 0.3 * scientificAptitude + 0.2 * signal_aspiration
score_A   = 0.5 * moyenne(français, histoire_geo, langues) + 0.3 * literaryAptitude   + 0.2 * signal_aspiration
score_SES = 0.4 * moyenne(maths, histoire_geo, français)   + 0.3 * moyenne(scientificAptitude, literaryAptitude) + 0.3 * signal_aspiration
```

**Checkpoint 2 (fin de Seconde C) — pistes C / D / TI, test optionnel :**

Socle valable pour tous les établissements (sans test) :
```
score_C_base  = 0.7 * moyenne(maths, physique)               + 0.3 * signal_aspiration
score_D_base  = 0.7 * moyenne(maths, svt, physique)          + 0.3 * signal_aspiration
score_TI_base = 0.5 * moyenne(maths, physique) + 0.2 * signal_intérêt_informatique_déclaré + 0.3 * signal_aspiration
```

Si `psychotechnicalTestRequired = true` pour cet établissement, le test s'ajoute et les poids se recalibrent :
```
score_C  = 0.6 * moyenne(maths, physique)     + 0.4 * moyenne(scientificAptitude, signal_aspiration)
score_D  = 0.6 * moyenne(maths, svt, physique) + 0.4 * moyenne(scientificAptitude, signal_aspiration)
score_TI = 0.5 * moyenne(maths, physique)      + 0.2 * signal_intérêt_informatique_déclaré + 0.3 * technicalAptitude
```

Si `psychotechnicalTestRequired = false`, c'est `score_*_base` qui est utilisé directement — jamais traité comme une confiance dégradée.

> Ces poids sont des points de départ configurables (stockés dans `OrientationCheckpointConfig`, pas en dur), à ajuster après retour de terrain (A.8).

### A.4.3 Étape 3 — Sélection des pistes finales

Trier les scores par ordre décroissant, retenir celles dépassant un seuil minimal (ex. 55/100) — jamais forcer un nombre fixe de pistes. Justification par gabarit texte (pas d'IA générative) :
> "Piste {piste} : tendance {en hausse|stable|en baisse} en {matières}, {avec confirmation du test psychotechnique|sur la base des matières déterminantes de cet établissement}, {alignée sur|différente de} l'aspiration déclarée."

### A.4.4 Étape 4 — Niveau de confiance (dégradation contextuelle, pas absolue)

```
si dataDepthMonths >= 36 → ELEVEE
sinon si dataDepthMonths >= 12 → MOYENNE
sinon → FAIBLE

Ajustement, uniquement si psychotechnicalTestRequired = true pour cet établissement :
  si le test est absent pour cet élève précis → dégrader la confiance d'un cran (accident isolé)

Si psychotechnicalTestRequired = false pour cet établissement :
  l'absence de test n'affecte jamais la confiance — fonctionnement normal de cet établissement.
```

## A.5 Cas d'usage (architecture hexagonale)

| Cas d'usage | Rôle autorisé | Description |
|---|---|---|
| `SaisirResultatTestPsychotechniqueUseCase` | Conseiller d'orientation (ou fallback configuré) | Enregistre le résultat pour un élève, sur un checkpoint donné |
| `SaisirAspirationsEleveUseCase` | Élève | Enregistre l'aspiration pour le checkpoint en cours |
| `GenererRecommandationOrientationUseCase` | Job planifié (Inngest) ou déclenché par le conseiller | Exécute le moteur (A.4), statut `CALCULEE` |
| `ValiderRecommandationConseillerUseCase` | Conseiller d'orientation | Ajuste si besoin, passe à `VALIDEE_CONSEILLER` |
| `ProposerRecommandationEleveUseCase` | Conseiller d'orientation | Envoie la notification à l'élève, fixe `responseDeadline`, statut `PROPOSEE_A_L_ELEVE` |
| `RelancerElevesEnAttenteUseCase` | Job planifié (Inngest) | Rappels à l'approche de l'échéance |
| `ChoisirPisteEleveUseCase` | Élève | Confirme ou choisit une autre piste, statut `VALIDEE_ELEVE` |
| `FinaliserParDefautUseCase` | Job planifié (Inngest) | À l'échéance sans réponse, statut `VALIDEE_PAR_DEFAUT` |
| `ListerElevesAOrienterUseCase` | Conseiller d'orientation | Liste les élèves du checkpoint sans recommandation finalisée |

Étendre le job de passage de classe déjà existant pour lire `OrientationRecommendation.finalTrack` au moment de déterminer la classe de destination à la rentrée suivante.

## A.6 Écrans nécessaires (V1)

1. Écran conseiller — Liste des élèves à orienter, filtrable par checkpoint.
2. Écran conseiller — Fiche de recommandation d'un élève (tendance par matière, saisie/consultation du test, aspiration, pistes calculées, validation, bouton "Proposer à l'élève").
3. Formulaire élève — Saisie de l'aspiration.
4. Écran élève — Proposition reçue, confirmation ou choix d'une autre piste, compte à rebours jusqu'à l'échéance.
5. Écran parent (lecture seule) — miroir de l'écran élève, sans pouvoir choisir à sa place.

## A.7 Découpage en tâches de développement (ordre suggéré)

1. Modèles Prisma (A.3) + migration + `OrientationCheckpointConfig` initialisée par établissement, avec `psychotechnicalTestRequired` réglé selon la pratique réelle de chaque lycée.
2. RBAC : rôle `CONSEILLER_ORIENTATION` + paramètre `hasDedicatedOrientationCounselor` sur `SchoolTenantConfig`.
3. `SaisirResultatTestPsychotechniqueUseCase` + écran de saisie (checkpoint 1 d'abord).
4. `SaisirAspirationsEleveUseCase` + formulaire élève.
5. Moteur de règles (A.4) comme service pur, testé unitairement avec des jeux de données fictifs pour les deux checkpoints.
6. `GenererRecommandationOrientationUseCase` + job Inngest planifié (fenêtre d'orientation, déclenchement élève par élève).
7. Écran conseiller (liste + fiche + validation + proposition à l'élève).
8. Workflow de décision finale : `ProposerRecommandationEleveUseCase`, `RelancerElevesEnAttenteUseCase`, `ChoisirPisteEleveUseCase`, `FinaliserParDefautUseCase`, écran élève de confirmation.
9. Extension du job de passage de classe existant pour lire `finalTrack`.
10. Tests de bout en bout : deux checkpoints, trois niveaux de confiance, test présent/absent, réponse élève/délai écoulé.

## A.8 Tâche de terrain obligatoire avant de figer le moteur

Les poids des scores (A.4.2) et les champs précis du test psychotechnique — en particulier la distinction D vs TI au checkpoint 2 — restent une hypothèse de travail, pas une donnée confirmée. Faire relire cette section à un vrai conseiller d'orientation (DIPCO) avant de considérer le moteur comme calibré.

## A.9 Definition of done — Partie A

- Un conseiller peut saisir un test et voir une recommandation générée automatiquement, pour les deux checkpoints.
- Le moteur fonctionne pour un établissement avec test et sans test, sans dégrader artificiellement la confiance dans le second cas.
- Le déclenchement se fait élève par élève dans la fenêtre d'orientation.
- Le workflow complet fonctionne de bout en bout : proposition → notification → délai → rappels → validation élève OU validation par défaut.
- Le passage de classe existant utilise `finalTrack` pour orienter l'élève vers la bonne classe.
- Aucune donnée d'orientation visible par un enseignant ou un rôle non autorisé.
- Moteur de scoring entièrement testé unitairement, sans dépendance à un modèle d'IA générative.

---

# PARTIE B — INFRASTRUCTURE PRÉDICTIVE (V1)

## B.1 Objectif

Poser un port `PredictionService` (même logique que `IAService`), et construire dès maintenant un adapter **TabPFN v2** pour les tâches de classification supervisée (risque élève, risque d'impayé, et à terme l'orientation) — sans jamais faire piloter de décision réelle par ses prédictions tant qu'un cycle complet de résultats connus n'a pas validé sa fiabilité.

```typescript
interface PredictionService {
  predireRisqueEleve(features: EleveFeatures): Promise<RiskScore>
  predireRisqueImpaye(features: PaiementFeatures): Promise<RiskScore>
  recommanderSerieOrientation(features: OrientationFeatures): Promise<TrackScores>
}
```

## B.2 Ce qui reste actif en V1 vs ce qui est en test

- **L'adapter à seuils/règles** déjà en place pour les élèves à risque (`SchoolConfig.aiRiskThreshold`, `StudentRecommendation`) reste actif et pilote les vraies décisions/notifications — rien n'y change.
- **L'adapter TabPFN v2**, construit et testé en parallèle sur les données réelles disponibles (aussi limitées soient-elles), mais **ne pilote aucune décision réelle** tant que sa fiabilité n'est pas vérifiée sur un cycle complet de résultats connus.
- Le jour où l'adapter TabPFN aura fait ses preuves, on bascule lequel des deux adapters "compte" pour de vrai — sans toucher aux use cases qui appellent le port.

## B.3 TabPFN v2 — ce qu'il faut respecter précisément

- **Version exacte à utiliser : `ModelVersion.V2`**, explicitement figée dans le code — jamais la version par défaut du paquet `tabpfn` (qui installe aujourd'hui v3, sous licence non-commerciale). Confirmer ce point dans le code de configuration du modèle avant tout déploiement.
- **Attribution obligatoire** dans la documentation technique du projet (Prior Labs License, Apache 2.0 + attribution).
- Adapté aux volumes réels de ZekoulABia (jusqu'à 10 000 lignes / 500 variables, performant sur petits jeux de données — l'échelle d'un établissement).
- CPU suffisant pour des prédictions calculées en tâche de fond (nuit), GPU non indispensable à ce stade.
- Microservice Python (FastAPI ou Flask) séparé, appelé en HTTP par le backend Express — pattern d'intégration standard, pas de réécriture du backend existant.

## B.4 Ce que TabPFN v2 remplace, et ce qu'il ne remplace pas

- **Remplace** : CatBoost/XGBoost/LightGBM pour toutes les tâches de classification supervisée (risque élève, risque impayé, orientation) — un seul outil au lieu de trois.
- **Ne remplace pas** : Isolation Forest (détection d'anomalies, non supervisé) et K-Means (regroupement de profils, non supervisé) — problèmes différents, à garder séparément pour une itération ultérieure (Phase 3 du plan long terme), pas de priorité immédiate en V1.

## B.5 Le principe non négociable, indépendant de l'outil choisi

Une prédiction (TabPFN ou autre) n'a de sens que si elle s'appuie sur des exemples réels avec un résultat déjà connu (l'élève signalé a-t-il vraiment échoué ? le paiement signalé a-t-il vraiment fini en impayé ?). Ce jeu de données n'existe pas encore chez ZekoulABia à l'échelle nécessaire. Tant que ce n'est pas le cas :
- Le pipeline TabPFN peut être construit, testé, et validé sur les données réelles déjà disponibles.
- Ses résultats restent isolés d'un environnement de test — jamais branchés aux notifications réelles envoyées aux familles ou aux conseillers.

## B.6 Découpage en tâches de développement

1. Définir le port `PredictionService` (interface TypeScript) dans la couche domaine.
2. Créer le microservice Python (FastAPI) avec TabPFN v2 explicitement figé (`ModelVersion.V2`).
3. Endpoint `/predict/risque-eleve`, `/predict/risque-impaye`, `/predict/orientation` (ce dernier reste secondaire tant que la Partie A avance en parallèle avec son propre moteur de règles).
4. Adapter TypeScript qui appelle ce microservice via HTTP, implémentant `PredictionService`.
5. Tests sur données réelles déjà disponibles (aussi limitées soient-elles), en environnement isolé.
6. Tableau de bord interne (admin technique) comparant, pour les cas où un résultat réel est déjà connu, la prédiction TabPFN à la réalité — pour construire progressivement la preuve de fiabilité nécessaire avant bascule en production.

## B.7 Definition of done — Partie B

- Le port `PredictionService` existe, avec l'adapter à seuils/règles actif en production pour le risque élève (inchangé) et un adapter TabPFN v2 fonctionnel en environnement de test.
- La version du modèle TabPFN est explicitement figée sur V2, attribution en place.
- Aucune prédiction TabPFN ne pilote une notification réelle envoyée à une famille ou un conseiller.
- Le microservice Python est isolé de la base de données réelle en écriture — lecture seule pour l'entraînement/inférence, jamais d'écriture directe dans les tables métier.

---

## Note finale pour l'agent

Les deux parties peuvent être développées dans n'importe quel ordre ou en parallèle. Si un choix doit être fait pour prioriser, commencer par la Partie A (Orientation), qui a un périmètre plus complètement bouclé et une valeur utilisateur directe et immédiate. La Partie B est une brique d'infrastructure qui prépare l'avenir (Phase 3 du plan long terme du projet) sans encore livrer de décision automatisée en production.
