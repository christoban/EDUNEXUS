# EDUNEXUS - Phase 0 - Matrice regles officielles vs regles terrain

Date: 2026-04-17
But: separer ce qui est implementable immediatement de ce qui doit etre confirme en entretiens.

## 1. Regles officielles (implementation immediate)

| Regle | Source | Type | Action |
|---|---|---|---|
| FR et EN coexistent legalement au Cameroun | Loi 98/004 | Officielle | Implementer architecture multi-section |
| FR secondaire: 6 sequences / 3 trimestres | Cadre MINESEC | Officielle | Implementer SEQUENCES_6 + mapping trimestre |
| EN secondaire: 3 terms | Cadre anglophone officiel | Officielle | Implementer TERMS_3 |
| FR secondaire note sur /20 | Pratique officielle majoritaire | Officielle | OVER_20 par defaut |
| EN secondaire note en % ou grades | Pratique officielle | Officielle | PERCENT/GRADES_AE configurables |
| Passage FR par defaut a 10/20 | Regle courante | Officielle | passThreshold par defaut 10 |
| Passage EN par defaut a 40% | Regle courante | Officielle | passThreshold par defaut 40 |
| Technique existe comme filiere distincte | MINESEC DESTP | Officielle | SubSystems techniques dedies |

## 2. Regles terrain (confirmation requise)

| Regle | Variabilite | Risque si hardcode | Strategie |
|---|---|---|---|
| Coefficients exacts par matiere/filiere | Elevee | Mauvais calcul bulletin | Stockage configurable par ecole |
| Regles absences dans moyenne | Elevee | Injustice/contestation | Option de politique configurable |
| Workflow de validation des notes | Elevee | Rejet utilisateur | Workflow parametrable par role |
| Delais et processus corrections bulletin | Elevee | Blocage operationnel | Module corrections + audit |
| Templates bulletin exacts | Elevee | Non-conformite ecole | Templates par section |
| Gestion impayes vs acces bulletin | Moyenne | Conflit direction/parent | Politique finance parametrable |

## 3. Regles mixtes (officielles + adaptation locale)

| Regle | Noyau fixe | Partie configurable |
|---|---|---|
| Notation FR secondaire | score sur 20 | coefficients, appreciations, mentions |
| Notation EN secondaire | terms + %/grades | echelle precise A-E, bornes exactes |
| Primaire FR | competence possible | mensuel vs trimestriel |
| Technique FR/EN | filiere technique dediee | coefficient pratiques/TP |

## 4. Politique de validation

1. Regle officielle: implementer directement.
2. Regle locale: exiger confirmation terrain dans 3 ecoles minimum.
3. Regle locale critique non confirmee: livrer en option desactivee.
4. Toute exception unique: conserver en parametre local, jamais en logique globale.

## 5. Critere de sortie Phase 0

1. Liste des regles officielles figee.
2. Liste des regles terrain a confirmer figee.
3. Aucun blocage technique du MVP par manque de donnee terrain.
