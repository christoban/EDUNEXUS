# PLAN DE CONCEPTION — V2.5 Étape 3 : les 4 contraintes douces dans l'objectif CP-SAT

> Document de conception validé le 2026-08-21. Il remplace le plan d'implémentation général
> pour ce qui concerne l'Étape 3 (soft constraints DANS le solveur). Le reste du chantier V2.5
> (solutions multiples, explicatifs, réparation auto, what-if, événement) est détaillé ailleurs.

---

## 1. La fonction objectif

### 1.1 Formule unique

Un **seul** `model.maximize(...)` assemblé à partir de termes, jamais de recalcul post-solve :

```
score =  Σ_séances  POIDS_SALLE_HABITUELLE × [séance en salle habituelle]     (existant, +10)
       − POIDS_TROU_CASE          × Σ(T,j)  trous[T][j]                        (5 / case vide)
       − POIDS_TROIS_CONSECUTIFS  × Σ(T,j,i) tri[T][j][i]                      (15 / triplet)
       − POIDS_DESEQUILIBRE       × (maxJours − minJours)                     (2 / case d'écart)
       − POIDS_VOLUME_JOUR        × Σ(T,j) surplus[T][j]                      (3 / case au-delà du plafond)
```

Assemblage : une liste de `(expression, coefficient)` remplie au fil des contraintes actives,
puis **un** appel `model.maximize(weightedSum(exprs, coeffs))`. Si aucun terme (aucune option +
pas de salle habituelle) → **pas d'objectif du tout** (comportement actuel préservé : 1ʳᵉ solution).

`scoreObjectif` retourné = `solver.objectiveValue()`, **jamais retouché**.

### 1.2 Unités : tout en « cases », pas en minutes — décision de conception assumée

Le plan originel proposait des poids par minute (1/min équilibrage, 2/min volume). **Déviation
assumée, pour une raison de calibration bloquante** : `POIDS_SALLE_HABITUELLE = 10` est gelé par
les 14 tests existants (ils assertent des scores). Or avec 1 point/minute, un déséquilibre de
2 séances (120 min) vaudrait 120 points — le solveur sacrifierait **toutes** les salles habituelles
pour équilibrer la semaine. L'échelle des nouvelles pénalités doit rester comparable à 10.

Donc : `volJour`, `écart` et `surplus` sont modélisés **en nombre de cases** (chaque case occupée
compte 1, pas sa durée en minutes). Conséquences :
- tout est entier (CP-SAT exige un objectif entier — pas de coefficients fractionnaires) ;
- grille homogène (le cas aujourd'hui) : 1 case ≡ `dureeCase` minutes, l'équivalence est exacte ;
- l'option `volumeMaxEnseignantParJour` (en minutes, ex. 360) est convertie **avant** le modèle :
  `capCases = cap / dureeCase` (garde : non-entier → arrondi inférieur).

Hiérarchie résultante : **15 (3 d'affilée) > 10 (salle habituelle) > 5 (trou) > 3 (survolume/jour)
> 2 (déséquilibre)**. Lecture : forcer un enseignant à 3h consécutives coûte plus cher que de
perdre sa salle habituelle ; un trou coûte la moitié d'une salle habituelle ; le déséquilibre est
le mal le plus toléré. Tous surchargeables via `contraintes.poids?`.

### 1.3 L'astuce « inégalité ≥ » (à documenter dans le code)

`trous` et `surplus` sont des **minima que le solveur pousse vers le bas** (on maximise). Il suffit
donc de poser `trous ≥ last − first + 1 − nbCases` et `surplus ≥ volT[T][j] − capCases` : à
l'optimum, chacun vaut exactement `max(0, expr)`. Pas besoin de `addMaxEquality` (plus coûteux), et
pas de valeur négative parasite (cas enseignant absent du jour : `first = k`, `last = −1` →
expression négative → bornée à 0).

Même logique pour `tri` (triplet reifié) : `tri ≥ pres_i + pres_{i+1} + pres_{i+2} − 2` — la
pénalité pousse `tri` à 0 sauf triplet plein. **Comportement attendu et assumé** : une série de
4 cases consécutives déclenche 2 triplets qui se chevauchent → pénalité doublée (plus c'est long,
plus ça coûte).

---

## 2. Variables `y` et `pres` — nommage et organisation

### 2.1 Définitions

```
y[e][c]      = « l'exigence e occupe la case c » (salle quelconque)
pres[T][c]   = « l'enseignant T enseigne à la case c »
```

Construction par agrégation, **avec alias systématique** :

```
pour chaque (e, c) :  xs = toutes les x[e][c][s]
  · 1 seule x        → y[e][c] EST cette x (aucune variable nouvelle)
  · plusieurs x      → y = newBoolVar("y_{e}_{c}") ; addEquality(y, Σ xs)
                        (légal car la contrainte dure « conflit classe »
                         garantit Σ xs ≤ 1)

pres[T][c] : même technique sur les y[e][c] des e de T
             (légal car « conflit enseignant » garantit Σ ≤ 1)
             alias si un seul y sous-jacent
```

**Pourquoi c'est correct** : l'égalité d'agrégation ne peut pas « fusionner » deux placements
interdits, puisque les contraintes dures homologues garantissent déjà l'exclusivité. On ne fait
que projeter.

**Pourquoi l'alias** : sur une vraie grille (30 séances × 40 cases × salles), créer une variable
booléenne par (e,c) et par (T,c) quand une seule sous-variable existe gonfle le modèle pour rien.
L'alias garde `y`/`pres` quasi gratuits en pratique.

### 2.2 Structures de données

```
y    : BoolVar|null  dense [exigences.length][grille.length]   (null = impossible)
pres : Map<teacherId, (BoolVar|null)[]> indexée par caseIdx     (null = impossible)
```

- `y` en tableau dense : `e` et `c` sont des entiers consécutifs, l'indexation directe est la plus
  lisible pour les boucles des contraintes.
- `pres` en `Map<teacherId, ...>` : le teacherId est un cuid (string), la Map évite la table de
  correspondance parallèle.
- `null` pour « impossible » plutôt que variable constante fausse : une seule convention, vérifiée
  au même endroit.

### 2.3 Pré-calcul : regroupement par jour

```
casesParJour : Map<dayOfWeek, number[]>   // indices de cases triés par heure
```

Construit une fois depuis `grille`. **Précondition** : la grille est triée par `(dayOfWeek,
startTime)` — le use case la produit déjà triée ; l'adaptateur le vérifie (sort défensif ou
assertion). Toutes les contraintes douces itèrent sur `casesParJour`, jamais sur `grille`
directement — c'est ce qui rend « adjacent » et « consécutif » non ambigus.

### 2.4 Répartition des fichiers

| Fichier | Contenu | Pourquoi |
|---|---|---|
| `SchedulingSolverPort.ts` (domaine) | `ContraintesDoucesOptions`, constantes `POIDS_*` | Le contrat et les poids par défaut sont métier ; le domaine ne connaît pas OR-Tools |
| `contraintesDouces.ts` (infrastructure) | `construireY()`, `construirePres()`, 4 fonctions `penaliteXxx()` pures, `assemblerObjectif()` | Chaque fonction prend `{model, grille, casesParJour, y, pres, options}` et retourne des termes `LinearExprLike` + métadonnées. L'adaptateur reste < 500 lignes |
| `ORToolsWasmAdapter.ts` | Orchestration : hard constraints → y/pres → pénalités → objectif unique → solve | Le collage seulement |

Leçon du précédent échec (à ne pas reproduire) : imports — `LinearExprLike` et `BoolVar` en
**type-only** depuis `or-tools-wasm/cp-sat` ; `ExigenceSeance`/`CaseGrille` depuis le **port**,
pas depuis `@domain/entities`.

### 2.5 Nettoyage du port (dans la même étape)

Suppression des 6 champs morts (`volumeHoraireMax`, `deuxCoursConsécutifs`, `trouEnseignant`,
`equilibrioSemaine`, `solutionsMultiples`, `explainTexte`) et de `explicatifs?` en sortie —
remplacés par `contraintes?: ContraintesDoucesOptions` (nommage français : `equilibrageSemaine`,
pas `equilibrioSemaine`). `solutionsMultiples` et `explicatifs` reviendront aux étapes 6-7 avec
leur vraie sémantique.

```ts
interface ContraintesDoucesOptions {
  trouEnseignant?: boolean;              // défaut false
  troisCoursConsecutifs?: boolean;       // défaut false
  equilibrageSemaine?: boolean;          // défaut false
  volumeMaxEnseignantParJour?: number;   // minutes ; absent = désactivé
  poids?: { trou?: number; troisConsecutifs?: number;
            desequilibre?: number; volumeJour?: number };
}
```

---

## 3. Stratégie de test

### 3.1 Principes

1. **Un test par contrainte, assertion sur `seances`** — jamais sur `scoreObjectif` seul. C'est LE
   critère que la tentative précédente a manqué : un score modifié ne prouve rien si l'horaire est
   identique.
2. **Chaque test a sa contre-épreuve** : le même scénario, drapeau OFF, où l'on affirme le
   comportement **opposé** (le trou existe, les 3 d'affilée existent, l'écart dépasse le seuil).
   Sans contre-épreuve, un test « compacte » pourrait passer par hasard si le solveur aurait
   compacté de toute façon.
3. **Les 14 tests existants restent intouchés** — drapeaux absents = comportement identique,
   preuve de non-régression. Ils sont la garantie que le refactor (y/pres, objectif unique) ne
   change rien quand rien n'est demandé.
4. **Perf** : chaque test solveur < 2 s (risque §7 — les y/pres multiplient les booléens, il faut
   le vérifier empiriquement sur les plus gros scénarios).

### 3.2 Fixtures types

```
grille : 5 jours (LUNDI→VENDREDI) × 4 cases d'1 h (08:00–12:00)
salles : 1 salle NORMAL (les tests doux n'ont pas besoin de variantes de salle ;
         pas de salleHabituelleId → l'objectif ne contient QUE la pénalité testée,
         aucune interaction avec le poids salle habituelle)
```

Point de conception important : **isoler chaque pénalité**. Si la salle habituelle reste active
pendant le test du trou, un échec pourrait venir d'une interaction entre les deux termes. Chaque
test d'une contrainte = son drapeau seul, tous les autres OFF.

### 3.3 Scénario par scénario

**T1 — Trou enseignant → compacte**
```
1 enseignant T, 4 séances. LUNDI = 4 cases mais la case 3 pré-occupée pour T
(occupationExistante) → T ne peut occuper que 3 cases le lundi, + les 3 autres jours libres.
OFF : T place ses séances sur 1, 2, 4 → trou en 3.        [contre-épreuve : affirmer le trou]
ON  : pour chaque jour où T enseigne : dernierIdx − premierIdx + 1 − nbSéancesDuJour == 0
      (aucun trou) — et les 4 séances sont bien toutes là (le drapeau ne supprime rien).
```

**T2 — Trois cours consécutifs → jamais 3 d'affilée**
```
1 enseignant T, 5 séances, LUNDI à VENDREDI × 2 cases. MARDI/MERCREDI/JEUDI : cases pré-occupées
pour T → seul le lundi (4 cases) reste extensible.
OFF : le solveur empile 3+ cases consécutives le lundi.   [contre-épreuve : un jour ≥ 3 consécutifs]
ON  : pour chaque jour : aucune fenêtre de 3 cases consécutives toutes occupées par T.
```

**T3 — Équilibrage semaine → écart borné**
```
10 séances, 2 enseignants (5 chacun), grille 5 jours × 4 cases. Pré-occuper pour TOUTE la classe
les cases de mardi→vendredi → lundi (4) + quelques mardi restent → concentration.
OFF : max−min ≥ 3 cases d'écart.                          [contre-épreuve]
ON  : max(minutes/jour) − min(minutes/jour) ≤ 2 cases — 10 séances / 5 jours = 2/jour
      exactement, l'équilibre parfait est l'optimum vérifiable.
```
Piège de conception : l'équilibrage compte la charge de la **classe** (tous enseignants
confondus), pas par enseignant.

**T4 — Volume max/jour par enseignant → plafond respecté**
```
1 enseignant T, 6 séances, plafond 240 min (4 cases) ; grille 5 jours × 4 cases, mais je bloque
1 case sur 4 jours → T n'a que 3 cases/jour partout sauf lundi (4).
OFF : rien n'empêche lundi = 4 cases.                     [contre-épreuve : lundi = 4]
ON  : aucun jour où le total de T > 240 min, ET les 6 séances toutes posées (douce : elle
      répartit, ne supprime pas).
```

**T5 — Non-régression formelle** : scénario moyen avec les 4 drapeaux ON, `seances` comparé au
résultat gelé — anti-dérive silencieuse de l'assemblage d'objectif.

### 3.4 Comment vaincre le non-déterminisme (le vrai risque)

Le risque n°1 : **OFF produise déjà la solution compacte** (le solveur tombe dessus par hasard) —
la contre-épreuve échoue et le test ne prouve plus rien. Parade systématique :
- **sculpter la grille** (cases pré-occupées) pour que la solution « paresseuse » soit exactement
  celle qui viole la contrainte (rôle des blocages dans T1/T2/T4) ;
- si la contre-épreuve reste floue : affirmer à OFF l'**existence** du motif interdit, pas sa
  position exacte ;
- à ON, affirmer l'**invariant** (aucun trou/triplet/dépassement) — toujours vrai quel que soit le
  choix du solveur.

### 3.5 L'objectif unique — test dédié

4 drapeaux ON simultanés + salle habituelle, sur une grille où les optimums ne se contredisent pas.
Assertion : solution satisfait les 4 invariants à la fois. Prouve que `weightedSum` combine sans
qu'un terme n'écrase les autres.

### 3.6 Ce que je ne teste PAS à cette étape (honnêteté)

- **Les poids exacts** : tester `scoreObjectif == 25` gèlerait la calibration. Les invariants sur
  `seances` suffisent.
- **La perf au pire cas** : base de test vide, je mesure chaque test (< 2 s) et je le note.
- **PGCD/durées hétérogènes** : couvert à l'Étape 2 côté use case.

---

## 4. Ordre d'implémentation (sous-étapes vérifiables)

| # | Sous-étape | Vérif immédiate |
|---|---|---|
| 3a | Port : `ContraintesDoucesOptions` + poids, suppression des 6 champs morts | `tsc` 0, 14 tests adaptateur inchangés verts |
| 3b | `contraintesDouces.ts` : `construireY` + `construirePres` + `casesParJour` | idem |
| 3c | Pénalité trou + T1/contre-épreuve | T1 vert |
| 3d | Pénalité triplets + T2 | T2 vert |
| 3e | Pénalité équilibrage + T3 | T3 vert |
| 3f | Pénalité volume/jour + T4 | T4 vert |
| 3g | Objectif unique assemblé + T5 + test 4-drapeaux | suite 100 % verts, `tsc` 0, < 2 s |

---

## 5. Décisions validées (2026-08-21)

1. Unités en **cases** (pas minutes) pour rester calibré sur `POIDS_SALLE_HABITUELLE = 10`.
2. Poids **15 / 10 / 5 / 3 / 2**, hiérarchie lisible, tout surchargeable.
3. Scénarios de test **T1-T5** avec contre-épreuves.
