# Plan d'implémentation V1 — Brique Orientation Scolaire ZekoulABia

> Périmètre : système francophone uniquement, aucune IA générative. Moteur de règles et de scores, entièrement déterministe et vérifiable. Couvre les deux points de bascule réels du 1er et 2e cycle francophone (voir section 1).

---

## 1. Objectif exact de cette V1

### 1.1 Deux points de bascule, un seul mécanisme générique

Correction importante par rapport à une première version de ce plan : il n'existe **pas de filière TI ni D en Seconde**. Les filières disponibles en Seconde sont **A (littéraire), SES, et C (scientifique)** — selon ce que propose l'établissement. TI et D n'apparaissent qu'**à l'issue de la Seconde C**, comme choix pour l'entrée en Première.

La V1 couvre donc **les deux points de bascule**, avec le **même moteur générique**, paramétré différemment selon le point :

| Point de bascule | Élèves concernés | Pistes possibles |
|---|---|---|
| **Checkpoint 1 — Fin de 3ème** | Tous les élèves de 3ème | A, SES, C |
| **Checkpoint 2 — Fin de Seconde C** | Élèves actuellement en Seconde C uniquement | Rester en **C**, ou aller en **D**, ou aller en **TI** |

Ce n'est pas deux fonctionnalités séparées à coder deux fois — c'est **un seul moteur de règles paramétrable par point de bascule** (les pistes possibles et les matières pertinentes changent, la mécanique de calcul de tendance/score/confiance reste la même). Concrètement, un `OrientationCheckpointType` (enum) distingue les deux, et une table de configuration (pas du code en dur) définit, pour chaque type, les pistes possibles et les matières pertinentes — ce qui permet aussi d'ajouter un futur 3ème point de bascule plus tard sans réécrire le moteur.

### 1.2 Le dernier mot appartient toujours à l'élève

Point essentiel, à construire dans le workflow dès la V1, pas ajouté après coup : le système **propose**, le conseiller **valide ou ajuste**, mais c'est **l'élève qui décide en dernier ressort** — exactement comme tu l'as vécu toi-même. Le mécanisme complet :

1. Le moteur calcule une proposition, le conseiller la valide (ou l'ajuste) → statut `PROPOSEE_A_L_ELEVE`.
2. L'élève reçoit une notification avec la proposition et un **délai de réponse défini** (ex. 15 jours, configurable par établissement).
3. Des rappels sont envoyés à l'approche de l'échéance (mécanisme de job planifié, cohérent avec les rappels déjà utilisés ailleurs dans ZekoulABia pour les paiements).
4. Deux issues possibles à l'échéance :
   - **L'élève a répondu** (confirmé la proposition, ou choisi une autre piste parmi celles proposées) → statut `VALIDEE_ELEVE`, la piste retenue est celle qu'il a choisie.
   - **L'élève n'a pas répondu dans le délai** → statut `VALIDEE_PAR_DEFAUT`, la piste retenue est celle initialement proposée/validée par le conseiller.
5. Dans les deux cas, une fois le statut final atteint, le processus normal de passage de classe de ZekoulABia (déjà existant) migre l'élève vers la classe correspondant à la piste retenue à la rentrée suivante — l'orientation n'est pas un module séparé du passage de classe, elle **alimente** la donnée que le passage de classe utilise déjà.

### 1.3 Le déclenchement événementiel — comment ça s'active

Cette brique combine un élément **permanent** (les notes, déjà ancrées séquence après séquence) et un élément **événementiel** (l'orientation, qui n'a de sens qu'à un moment précis de l'année). Le mécanisme :

1. **Une fenêtre d'orientation**, configurable par établissement (ex. mars-mai), définit la période pendant laquelle le système "écoute" les événements pertinents — pas une date unique de bascule globale.
2. **À l'intérieur de cette fenêtre, le déclenchement se fait élève par élève, pas en bloc pour toute la classe** : dès qu'une donnée significative arrive pour un élève éligible (le conseiller enregistre son test psychotechnique, ou — si l'établissement n'en fait pas, voir section 4.2 — dès que ses notes du trimestre en cours sont complètes), `GenererRecommandationOrientationUseCase` se déclenche immédiatement pour cet élève précis.
3. Le résultat arrive dans la file du conseiller (`CALCULEE`) — jamais envoyé directement à l'élève sans passage humain. Le conseiller peut valider plusieurs élèves à la suite en lot ; ce n'est pas pensé comme un frein, juste comme une vérification avant qu'une proposition à l'allure officielle n'arrive chez une famille.
4. **L'absence de test psychotechnique et le droit de l'élève à valider/changer sont deux axes indépendants.** Un élève sans test (absent le jour du test, ou établissement n'en faisant pas du tout) reçoit quand même une proposition calculée sur ses seules notes, et garde, comme n'importe quel autre élève, le dernier mot sur la piste retenue (section 1.2). L'absence de test influence seulement la donnée d'entrée du calcul et, le cas échéant, le niveau de confiance affiché (section 4.4) — jamais le droit de valider.
5. **Filet de sécurité** : un tableau de bord conseiller liste, à l'approche de la fermeture de la fenêtre, les élèves du checkpoint sans recommandation encore calculée — pour qu'aucun élève ne soit oublié.

### 1.4 Ce que la V1 ne fait toujours PAS

- Pas de flux anglophone (Form 5 → Lower Sixth / Arts-Sciences) — V2.
- Pas d'IA générative pour rédiger l'explication — gabarits texte uniquement (templates), pas de modèle de langage.
- Pas de suivi longitudinal des résultats réels post-orientation — V3.
- Pas de vue "agrégée établissement" pour l'admin — peut attendre V2.

---

## 2. Qui gère cette brique — RBAC

**Seul le conseiller d'orientation** gère l'orientation — pas le censeur, pas le proviseur, pas l'admin. C'est sa fonction propre dans l'établissement (formation DIPCO dédiée), et ZekoulABia doit respecter cette séparation plutôt que la diluer sur d'autres rôles.

**Point d'incertitude assumé, réglé par une configuration plutôt qu'un choix figé dans le code** : il est très probable que chaque établissement secondaire dispose d'un conseiller d'orientation, mais ce n'est pas garanti à 100 % (petit établissement, poste vacant temporairement). Plutôt que de trancher maintenant, la V1 prévoit un **paramètre par établissement** — `hasDedicatedOrientationCounselor` (booléen, `true` par défaut) — sur le modèle `SchoolTenantConfig` déjà existant. Si un établissement n'a effectivement personne dans ce rôle un jour, l'admin peut basculer ce paramètre et désigner temporairement qui a accès (lui-même ou le censeur) — mais **ce n'est jamais le comportement par défaut**, seulement une échappatoire explicite et traçable pour un cas exceptionnel. Rien à développer en plus pour la V1 au-delà de ce simple paramètre booléen — la logique d'accès vérifie ce paramètre avant de vérifier le rôle.

`PsychotechnicalTestResult` et `OrientationRecommendation` restent, dans tous les cas, invisibles par défaut aux enseignants et aux autres élèves.

---

## 3. Modèle de données (ajouts Prisma)

```prisma
enum OrientationCheckpointType {
  FIN_TROISIEME       // Checkpoint 1 : 3ème -> Seconde (A / SES / C)
  FIN_SECONDE_C        // Checkpoint 2 : Seconde C -> Première (C / D / TI)
}

// Configuration de la bascule : quelles pistes sont possibles, quelles matières comptent.
// Table de configuration, pas du code en dur — permet d'ajuster ou d'ajouter
// un futur checkpoint sans toucher au moteur de règles.
model OrientationCheckpointConfig {
  id              String   @id @default(cuid())
  schoolId        String   // scoping par établissement (tenant) : cette config varie d'un lycée à l'autre
  school          School   @relation(fields: [schoolId], references: [id])
  type            OrientationCheckpointType
  possibleTracks  Json     // ex. ["A", "SES", "C"] ou ["C", "D", "TI"]
  relevantSubjects Json    // matières déterminantes et poids utilisés pour ce checkpoint précis
  psychotechnicalTestRequired Boolean @default(false)
  // false = cet établissement ne fait pas de test à ce checkpoint : le calcul repose
  // entièrement sur les matières déterminantes (voir section 4.2). true = le test
  // existe ici et s'ajoute au calcul. Ce champ est une configuration normale par
  // établissement, pas un indicateur de donnée manquante — à ne jamais confondre
  // avec un élève isolé qui aurait raté un test dans un établissement qui en fait.

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

  // Champs à confirmer avec un vrai conseiller d'orientation avant de figer (voir section 8)
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

  desiredTrack      String?  // valeur libre parmi les pistes possibles du checkpoint
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
  counselorFinalTrack String?  // piste validée/ajustée par le conseiller avant proposition à l'élève

  status            RecommendationStatus @default(CALCULEE)

  // Le workflow de décision finale (section 1.2)
  proposedAt        DateTime?  // moment où la proposition part vers l'élève
  responseDeadline  DateTime?  // date limite de réponse de l'élève
  remindersSentAt   Json?      // historique des rappels envoyés
  studentChosenTrack String?   // piste effectivement choisie par l'élève (peut différer de counselorFinalTrack)
  finalizedAt       DateTime?
  finalTrack        String?    // la piste réellement retenue, celle que le passage de classe utilisera

  @@index([studentProfileId, checkpointType])
}

enum ConfidenceLevel {
  ELEVEE
  MOYENNE
  FAIBLE
}

enum RecommendationStatus {
  CALCULEE               // le moteur a produit un résultat
  VALIDEE_CONSEILLER     // le conseiller a validé/ajusté, prêt à envoyer à l'élève
  PROPOSEE_A_L_ELEVE     // notification envoyée, en attente de réponse ou d'échéance
  VALIDEE_ELEVE          // l'élève a répondu et choisi
  VALIDEE_PAR_DEFAUT     // délai écoulé sans réponse, piste du conseiller retenue par défaut
}
```

---

## 4. Le moteur de règles et de scores — algorithme détaillé

### 4.1 Étape 1 — Calcul de la tendance par matière

Pour les matières définies dans `OrientationCheckpointConfig.relevantSubjects` du checkpoint concerné :

```
tendance_matière = moyenne_pondérée(
  notes_des_N_derniers_trimestres,
  poids_croissant_avec_la_récence
)
```

Normalisée sur 0-100 pour l'agrégation.

### 4.2 Étape 2 — Agrégation en un score par piste, selon le checkpoint

**Checkpoint 1 (fin de 3ème) — pistes A / SES / C :**

```
score_C   = 0.5 * moyenne(maths, physique, svt)      + 0.3 * scientificAptitude + 0.2 * signal_aspiration
score_A   = 0.5 * moyenne(français, histoire_geo, langues) + 0.3 * literaryAptitude   + 0.2 * signal_aspiration
score_SES = 0.4 * moyenne(maths, histoire_geo, français)   + 0.3 * moyenne(scientificAptitude, literaryAptitude) + 0.3 * signal_aspiration
```

**Checkpoint 2 (fin de Seconde C) — pistes C / D / TI :**

Ce checkpoint concerne uniquement des élèves déjà en Seconde C — la question n'est plus "scientifique ou littéraire" mais "quelle spécialisation scientifique". Le terrain montre que **les établissements ne procèdent pas tous de la même façon** : certains font passer un test psychotechnique dédié à ce stade (portant sur des sous-dimensions plus fines — aptitude abstraite/mathématique pure vs aptitude appliquée/technique), d'autres n'en font aucun et s'appuient uniquement sur l'analyse des matières déterminantes par filière. La V1 doit donc gérer les deux cas, pilotés par le champ `psychotechnicalTestRequired` de `OrientationCheckpointConfig` — jamais un choix unique imposé à tous les établissements.

**Le socle, valable pour tous les établissements** (matières déterminantes, sans test) :

```
score_C_base  = 0.7 * moyenne(maths, physique)               + 0.3 * signal_aspiration
score_D_base  = 0.7 * moyenne(maths, svt, physique)          + 0.3 * signal_aspiration
score_TI_base = 0.5 * moyenne(maths, physique) + 0.2 * signal_intérêt_informatique_déclaré + 0.3 * signal_aspiration
```

**Si `psychotechnicalTestRequired = true` pour cet établissement**, le test s'ajoute et les poids du socle se recalibrent pour lui faire de la place (le total reste 100 %) :

```
score_C  = 0.6 * moyenne(maths, physique)     + 0.4 * moyenne(scientificAptitude, signal_aspiration)
score_D  = 0.6 * moyenne(maths, svt, physique) + 0.4 * moyenne(scientificAptitude, signal_aspiration)
score_TI = 0.5 * moyenne(maths, physique)      + 0.2 * signal_intérêt_informatique_déclaré + 0.3 * technicalAptitude
```

**Si `psychotechnicalTestRequired = false`**, c'est `score_*_base` qui est utilisé directement — ce n'est jamais traité comme une donnée manquante ni comme une confiance dégradée (voir 4.4), puisque c'est le fonctionnement normal et attendu de cet établissement, pas un accident.

> Ces poids restent des points de départ configurables (stockés dans `OrientationCheckpointConfig`, pas en dur), à ajuster après le premier retour de terrain (section 8).

### 4.3 Étape 3 — Sélection des pistes finales

Trier les scores du checkpoint concerné par ordre décroissant, retenir celles dépassant un seuil minimal (ex. 55/100) — jamais forcer un nombre fixe de pistes. Générer la justification par gabarit texte (pas d'IA générative en V1), par exemple :
> "Piste {piste} : tendance {en hausse|stable|en baisse} en {matières}, {avec confirmation du test psychotechnique|sur la base des matières déterminantes de cet établissement}, {alignée sur|différente de} l'aspiration déclarée."

### 4.4 Étape 4 — Calcul du niveau de confiance

Principe central : la confiance se calcule par rapport à ce que **cet établissement** attend normalement, pas par rapport à un idéal absolu identique pour tous.

```
si dataDepthMonths >= 36 → ELEVEE
sinon si dataDepthMonths >= 12 → MOYENNE
sinon → FAIBLE (message explicite recommandant de s'appuyer davantage sur l'entretien humain)

Ajustement supplémentaire, uniquement si psychotechnicalTestRequired = true pour cet établissement :
  si le test est absent pour cet élève précis → dégrader la confiance d'un cran
  (accident isolé dans un établissement qui fait normalement le test)

Si psychotechnicalTestRequired = false pour cet établissement :
  l'absence de test n'affecte jamais la confiance — c'est le fonctionnement
  normal et attendu de cet établissement, pas une donnée manquante.
```

---

## 5. Cas d'usage (architecture hexagonale)

| Cas d'usage | Rôle autorisé | Description |
|---|---|---|
| `SaisirResultatTestPsychotechniqueUseCase` | Conseiller d'orientation (ou fallback configuré, section 2) | Enregistre le résultat pour un élève, sur un checkpoint donné |
| `SaisirAspirationsEleveUseCase` | Élève (auto-saisie) | Enregistre l'aspiration pour le checkpoint en cours |
| `GenererRecommandationOrientationUseCase` | Job planifié (Inngest) ou déclenché par le conseiller | Exécute le moteur (section 4), statut `CALCULEE` |
| `ValiderRecommandationConseillerUseCase` | Conseiller d'orientation | Ajuste si besoin, passe à `VALIDEE_CONSEILLER` |
| `ProposerRecommandationEleveUseCase` | Conseiller d'orientation | Envoie la notification à l'élève, fixe `responseDeadline`, statut `PROPOSEE_A_L_ELEVE` |
| `RelancerElevesEnAttenteUseCase` | Job planifié (Inngest) | Envoie les rappels à l'approche de l'échéance |
| `ChoisirPisteEleveUseCase` | Élève | L'élève confirme ou choisit une autre piste parmi celles proposées, statut `VALIDEE_ELEVE` |
| `FinaliserParDefautUseCase` | Job planifié (Inngest) | À l'échéance sans réponse, statut `VALIDEE_PAR_DEFAUT`, `finalTrack` = piste du conseiller |
| `ListerElevesAOrienterUseCase` | Conseiller d'orientation | Liste les élèves du checkpoint en cours n'ayant pas encore de recommandation finalisée |

Le job de passage de classe déjà existant dans ZekoulABia doit être étendu pour lire `OrientationRecommendation.finalTrack` (quand il existe pour l'élève et le checkpoint concerné) au moment de déterminer la classe de destination à la rentrée suivante.

---

## 6. Écrans nécessaires (V1)

1. **Écran conseiller — Liste des élèves à orienter**, filtrable par checkpoint (fin de 3ème / fin de Seconde C).
2. **Écran conseiller — Fiche de recommandation d'un élève** : tendance par matière, saisie/consultation du test psychotechnique, aspiration déclarée, pistes calculées avec justification, validation, puis bouton "Proposer à l'élève".
3. **Formulaire élève — Saisie de l'aspiration**, propre à chaque checkpoint.
4. **Écran élève — Proposition reçue** : présentation des pistes proposées, bouton pour confirmer ou choisir une autre piste parmi celles proposées, compte à rebours visible jusqu'à l'échéance.
5. **Écran parent** (lecture seule) : miroir de l'écran élève, sans possibilité de choisir à sa place — cohérent avec le principe que la décision finale appartient à l'élève.

---

## 7. Découpage en tâches de développement (ordre suggéré)

1. Modèles Prisma (section 3) + migration + `OrientationCheckpointConfig` initialisée par établissement, avec `psychotechnicalTestRequired` réglé selon la pratique réelle de chaque lycée (à demander à l'admin/conseiller à la configuration initiale de l'établissement).
2. RBAC : rôle `CONSEILLER_ORIENTATION` + paramètre `hasDedicatedOrientationCounselor` sur `SchoolTenantConfig`.
3. `SaisirResultatTestPsychotechniqueUseCase` + écran de saisie (checkpoint 1 d'abord).
4. `SaisirAspirationsEleveUseCase` + formulaire élève.
5. Moteur de règles (section 4) comme service pur, testé unitairement avec des jeux de données fictifs pour les deux checkpoints séparément.
6. `GenererRecommandationOrientationUseCase` + job Inngest planifié.
7. Écran conseiller (liste + fiche + validation + proposition à l'élève).
8. Workflow de décision finale : `ProposerRecommandationEleveUseCase`, `RelancerElevesEnAttenteUseCase`, `ChoisirPisteEleveUseCase`, `FinaliserParDefautUseCase`, écran élève de confirmation.
9. Extension du job de passage de classe existant pour lire `finalTrack`.
10. Tests de bout en bout couvrant : les deux checkpoints, les trois niveaux de confiance, le cas "élève répond" et le cas "délai écoulé sans réponse".

---

## 8. Tâche de terrain obligatoire avant de figer le moteur

Les poids des scores (section 4.2) et les champs précis du test psychotechnique — y compris la distinction plus fine nécessaire pour le checkpoint 2 (C/D/TI) — restent une **hypothèse de travail, pas une donnée confirmée**. Avant de considérer le moteur comme calibré : faire relire cette section à un vrai conseiller d'orientation (DIPCO), en particulier sur la façon dont il distingue concrètement, à l'oral, un profil D d'un profil TI aujourd'hui — cette distinction n'est pas encore assez précise dans ce document pour être codée telle quelle sans validation humaine directe.

---

## 9. Critère de fin de V1 (definition of done)

- Un conseiller d'orientation peut saisir un test psychotechnique et voir une recommandation générée automatiquement, pour les deux checkpoints (fin de 3ème et fin de Seconde C).
- Le moteur fonctionne correctement à la fois pour un établissement avec test (`psychotechnicalTestRequired = true`) et pour un établissement sans test (`false`), sans dégrader artificiellement la confiance dans ce second cas.
- Le déclenchement se fait élève par élève dans la fenêtre d'orientation, sans attendre un traitement global de toute la classe.
- Le workflow complet fonctionne de bout en bout : proposition → notification élève → délai → rappels → validation par l'élève OU validation par défaut à l'échéance.
- Le passage de classe existant utilise bien `finalTrack` pour orienter l'élève vers la bonne classe à la rentrée.
- Aucune donnée d'orientation n'est visible par un enseignant ou par défaut à un rôle autre que le conseiller d'orientation (ou le fallback explicitement configuré).
- Le moteur de scoring est entièrement testé unitairement, sans dépendance à un modèle d'IA générative.
