# EduNexus/ZekoulABia — Interopérabilité statistique MINEDUB (préscolaire/primaire)

**Statut : proposition à valider — aucune ligne de code écrite pour ce chantier.**
**Date : 13 juillet 2026**

---

## 0. Avertissement, à ne jamais perdre de vue

Contrairement à MINESEC, **aucun questionnaire officiel téléchargeable n'existe pour le MINEDUB**. Confirmé par recherche directe sur `minedub.cm` et `ins-cameroun.cm` : le ministère publie uniquement les **résultats agrégés** (Annuaires Statistiques annuels, co-publiés avec l'Institut National de la Statistique), jamais le formulaire de collecte brut.

Ce document propose donc un **format de travail non officiel, reconstitué** à partir :
- de la note méthodologique publiée dans les Annuaires Statistiques (qui décrit la structure du dispositif, sans montrer le formulaire) ;
- du contenu réel de plus de 470 tableaux de données de l'Annuaire 2020/2021 (téléchargé et analysé — chaque tableau révèle indirectement quelles variables le questionnaire a dû capturer pour pouvoir les produire) ;
- du glossaire officiel d'abréviations de ce même document (diplômes, statuts, états des locaux — vocabulaire réel, pas inventé).

**Ce n'est PAS le vrai questionnaire.** Objectif assumé : donner à l'admin d'une école primaire/maternelle un support de préparation structuré et un pré-remplissage automatique de ce qu'EduNexus sait déjà — jamais présenté comme un document officiel à soumettre tel quel. Quand un vrai questionnaire sera obtenu (contact DPPC/MINEDUB), ce mapping devra être entièrement revu selon la méthode appliquée à MINESEC (fichier réel comme template, jamais l'inverse).

Sources consultées :
- Annuaire Statistique 2020/2021 MINEDUB (co-édité INS/MINEDUB) — `ins-cameroun.cm`, note méthodologique + 474 tableaux + glossaire
- Annuaire Statistique 2021/2022 MINEDUB — `ins-cameroun.cm`

---

## 1. Ce que la note méthodologique confirme (texte exact)

> "Les informations sont collectées par système d'enseignement. **Quatre types de questionnaires** sont utilisés, correspondant aux quatre systèmes d'enseignement relevant du Ministère de l'Éducation de Base. Il s'agit des outils de collecte pour **le préscolaire, le primaire, les CEBNF et les CAF**."
>
> "Les questionnaires du recensement scolaire au MINEDUB couvrent tous les ordres d'enseignement (public, privé et communautaire). Ils font ressortir des items relatifs à **l'identification de l'École/Structure, aux effectifs des élèves et du personnel enseignant, aux infrastructures, aux équipements, aux commodités, aux manuels scolaires et aux résultats des examens et concours**."

La saisie se fait via une application appelée **StatEduc2** (SIGE, développée avec l'appui de l'Institut de Statistique de l'UNESCO), dont l'interface "épouse les structures des différents questionnaires" — confirmant que les 8 catégories ci-dessus sont fiables, même si la mise en page exacte des cellules ne l'est pas.

### 1.1 Décision de périmètre proposée : CEBNF et CAF hors MVP

**CEBNF** (Centre d'Éducation de Base Non Formelle) et **CAF** (Centre d'Alphabétisation Fonctionnelle) sont des structures d'éducation non formelle / alphabétisation d'adultes — un type d'établissement structurellement différent des écoles privées/publiques classiques que ZekoulABia sert aujourd'hui (pas de "classes" au sens SIL→CM2, pas le même modèle pédagogique). **Recommandation : exclure CEBNF/CAF du périmètre immédiat**, se concentrer sur Préscolaire + Primaire, qui correspondent directement à `SchoolType.PRESCHOOL` / `SchoolType.PRIMARY` déjà modélisés dans EduNexus. À confirmer avec toi avant de trancher définitivement.

---

## 2. Alignement déjà existant côté EduNexus (bonne nouvelle)

Vérifié dans le code actuel :
- `SchoolType` enum : `PRESCHOOL`, `PRIMARY`, `SECONDARY`, `MULTI` — déjà prévu
- `PRIMARY_LEVELS` (`SerieBAC.ts`) : `SIL, CP, CE1, CE2, CM1, CM2` (+ variantes anglophones `Class1`...`Class6`)
- `PRESCHOOL_LEVELS` : `PS, MS, GS, PreNursery, Nursery1, Nursery2` (+ variantes `Petite/Moyenne/Grande section`)

Ces niveaux correspondent bien à la nomenclature réelle MINEDUB confirmée par le glossaire (`SIL` = Section d'Initiation à la Lecture, `CP` = Cours Préparatoire, `PS` = Petite Section, `CM2` = Cours Moyen 2ème année). **Aucun nouveau niveau de classe à ajouter.**

Ce qui reste à vérifier avant de coder : l'étendue réelle du module Primaire/Préscolaire d'EduNexus aujourd'hui (gestion élèves/classes/personnel y est-elle aussi mature que pour le secondaire, ou minimaliste ?) — nécessaire pour évaluer combien de champs seront réellement Catégorie A_AUTO vs C_MANUAL.

---

## 3. Structure proposée — Questionnaire PRIMAIRE (priorité 1)

### 3.1 Section Identification (inféré, Catégorie A/C mixte comme MINESEC)

| Champ | Source proposée | Catégorie |
|---|---|---|
| Nom école, région, département, arrondissement, ville/quartier | `School` | A_AUTO |
| Sous-système (francophone/anglophone) | `School.subsystem` | A_AUTO |
| Ordre d'enseignement (public/privé laïc/catholique/protestant/islamique/communautaire) | `School.ownership` — **gap potentiel** : catégories MINEDUB plus fines que `SchoolOwnership` actuel (`PUBLIC/PRIVATE_SECULAR/PRIVATE_FAITH`) ne distingue pas catholique/protestant/islamique | B_PARTIAL ou nouveau champ à discuter |
| Zone d'implantation (urbaine/rurale) | Aucun champ actuel — **gap confirmé** | C_MANUAL (formulaire complémentaire) |

### 3.2 Section Effectifs élèves (Catégorie A_AUTO, comme ESG pour MINESEC)

D'après les tableaux réels (répartition par année d'études/région/sexe/âge, tableaux 3-60) :
- Par niveau (SIL→CM2) × sexe — directement dérivable de `StudentProfile` + `Class.level`
- Par âge spécifique — même logique que `resolveEsgFields`/`AGE_ROWS` déjà construite pour MINESEC, réutilisable telle quelle avec les niveaux primaires
- Redoublants par niveau/sexe — dérivable si `StudentProfile` a un flag de redoublement (**à vérifier** — existe-t-il dans le modèle actuel ?)
- **Catégories vulnérables** (confirmées par tableaux 50-60, vocabulaire réel du glossaire) : élèves réfugiés, élèves déplacés internes, élèves vivant avec un handicap (par type de handicap) — **gap confirmé**, aucun champ actuel dans `StudentProfile` ne capture ce statut → C_MANUAL déclaratif au niveau école (comptage global) tant qu'un champ dédié n'existe pas par élève

### 3.3 Section Personnel enseignant (Catégorie B_PARTIAL, même limite que MINESEC)

Confirmé par tableaux 232-254 + glossaire : répartition par **statut** (fonctionnaire/contractuel/communautaire — le mot "Communautaire" apparaît explicitement dans les données réelles comme catégorie de statut, à ne pas confondre avec "école communautaire"), **qualifié vs non-qualifié**, avec diplômes réels du glossaire :
- Diplômes profesionnels primaire : `CAPIEMP`, `CAPIEG`, `CAPI`, `CAPIET`, `CAPIA` (Instituteurs Adjoints), `CAPIAEG`, `CAPIAET`
- Mêmes limites déjà rencontrées côté MINESEC : `EmployeeFile.diplomes/typeContrat` existent mais en texte libre, pas de garantie de conformité au vocabulaire officiel ci-dessus → même traitement proposé (meilleur effort + avertissement)

### 3.4 Section Infrastructures (Catégorie C_MANUAL intégrale, comme MINESEC)

**Structure réelle confirmée** (table 83/84 extraite du document réel, vocabulaire exact) :

| LOCAL (type) | Dur | Semi-dur | Provisoire | — chaque matériau décliné Bon / Assez bon / Mauvais état |
|---|---|---|---|---|
| Salles de classe occupées | | | | |
| Salles de classe non occupées | | | | |
| Salle informatique | | | | |
| Logement de fonction | | | | |
| Magasins | | | | |
| Toilettes ou latrines | | | | |

Différence notable avec MINESEC : **3 catégories de matériau** (Dur/Semi-dur/Provisoire) au lieu de 2 (Définitif/Provisoire) — donc 9 valeurs par type de local (3 matériaux × 3 états) plutôt que 6. Structure du formulaire complémentaire à adapter en conséquence si confirmé.

### 3.5 Sections Équipements / Commodités / Manuels scolaires

Confirmées comme sections distinctes par les titres de tableaux réels (équipement des salles de classe, commodités par type/région, manuels essentiels élèves ET enseignants séparément, par discipline). Détail fin des types de commodités et d'équipements pas encore extrait ligne à ligne — à faire en phase 2 si ce chantier est validé.

### 3.6 Section Résultats examens (CEP/FSLC)

Déjà partiellement pertinent : EduNexus gère déjà des concours/examens côté secondaire (`entranceExam`) — logique réutilisable pour le CEP (Certificat d'Études Primaires) si EduNexus gère un jour les résultats CEP en primaire.

---

## 4. Approche technique — différente de MINESEC sur un point clé

**Pas de vrai fichier à copier.** Puisqu'aucun template officiel n'existe, l'approche "on écrit dans une copie du vrai fichier" ne s'applique pas ici. Deux options :

**Option A — Construire un vrai fichier `.xlsx` de toutes pièces** (recommandée) : générer avec `xlsx`/`exceljs` (déjà en dépendance) un classeur structuré selon les sections ci-dessus, avec un bandeau visible et non-ambigu du type *"Document de travail ZekoulABia — non officiel, basé sur la structure publique des Annuaires Statistiques MINEDUB — à vérifier auprès de votre IAEB avant transmission"*. Même moteur de génération (`GenererDeclarationStatistiqueXxxUseCase`) que MINESEC, juste un `ministry: 'MINEDUB'` et un template généré par nos soins plutôt que téléchargé.

**Option B — Rapport PDF de synthèse** (plus simple, moins ambitieux) : pas un "questionnaire", juste un document imprimable présentant les données déjà connues, organisées selon les 8 catégories — l'admin le lit et reporte manuellement dans le vrai questionnaire papier remis par l'IAEB. Cohérent avec la recommandation d'origine du document stratégique (section 4.4).

**Recommandation : commencer par l'Option B** (rapport de synthèse, beaucoup plus rapide à livrer, zéro risque de faire croire à un document officiel) puis migrer vers l'Option A si la demande client le justifie.

---

## 5. Ce qu'il reste à trancher avec toi avant tout code

1. **Périmètre** : Primaire seul pour commencer (recommandé), ou Primaire + Préscolaire ensemble ?
2. **CEBNF/CAF** : confirmé hors MVP ?
3. **Format de sortie** : rapport PDF de synthèse (rapide, sans ambiguïté) ou vrai fichier Excel reconstitué (plus proche de l'expérience MINESEC, plus risqué en termes de perception "officielle") ?
4. **Zone rurale/urbaine et ordre d'enseignement détaillé (catholique/protestant/islamique)** : ajouter ces champs à `School`, ou les traiter uniquement dans le formulaire complémentaire (comme MINESEC) sans toucher au modèle central ?
5. **Statut de redoublement élève** : existe-t-il déjà un champ quelque part dans `StudentProfile` ou faut-il l'ajouter ?
6. Faut-il que j'aille plus loin dans l'extraction (détail fin des équipements/commodités/manuels, ligne par ligne) avant de coder, ou ce niveau de détail suffit-il pour démarrer l'implémentation ?

---

*Fin du document.*
