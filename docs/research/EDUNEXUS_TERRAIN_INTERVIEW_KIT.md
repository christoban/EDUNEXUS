# EDUNEXUS Terrain Interview Kit (Cameroun)

Version: 1.0
Date: 2026-04-17
Usage: guide terrain product discovery, non-commercial.

## 1) Objectif

Ce document sert a:
- mener des entretiens de 45 a 90 min en etablissement,
- collecter des donnees exploitables pour configurer EDUNEXUS,
- transformer chaque reponse en regles systeme (SubSystem, Section, Periods, Grading, Bulletin).

## 2) Regles d'entretien

1. Chercher les problemes reels, pas les compliments.
2. Demander des preuves concretes: bulletin reel, tableau coefficients, calendrier, recu.
3. Noter les exceptions et les cas limites.
4. Distinguer ce qui est officiel (ministere) de ce qui est local (ecole).
5. Ne pas valider une regle produit sans evidence terrain.

## 3) Fiche de collecte rapide (1 page)

Copier-coller cette fiche pour chaque ecole.

### A. Profil et structure
- Entretien ID:
- Date:
- Ville:
- Type etablissement: Public / Prive / Confessionnel
- Nom etablissement:
- Contact principal:
- Role interlocuteur:
- Cycles presents: Maternelle / Primaire / Sec1 / Sec2 / Technique
- Sections presentes: FR / EN / FR+EN
- Nombre eleves total:
- Nombre eleves FR:
- Nombre eleves EN:
- Nb classes par niveau:

### B. Moteur pedagogique reel
- Mode principal observe: FR_GENERAL / EN_GENERAL / FR_TECH / EN_TECH / FR_PRIMAIRE / EN_PRIMAIRE / MATERNELLE
- Echelle notes: OVER_20 / PERCENT / GRADES_AE / COMPETENCY_ANA
- Periodes: SEQUENCES_6 / TERMS_3 / MONTHLY_9 / MIXED
- Coefficients par matiere: OUI / NON
- Seuil passage:
- Regle absences dans moyenne: OUI / NON / PARTIEL
- Decision fin d'annee: AUTO / CONSEIL / HYBRIDE

### C. Processus bulletin (operationnel)
- Qui saisit les notes:
- Qui valide:
- Delai fin compos -> bulletin:
- Outil actuel: Papier / Excel / Logiciel
- Corrections post-publication: Comment:
- Signatures obligatoires: PP / Chef / Parent
- Champs bulletin obligatoires:

### D. Finance
- Structure frais: annuel / trimestriel / cycle / section
- Registre paiements: papier / numerique / mixte
- Recu: oui/non (format)
- Regle impayes (blocage compo/bulletin):

### E. Digital et contraintes
- Internet administration: stable / moyen / faible
- Equipements enseignants: smartphone / laptop / aucun
- Freins adoption:
- Besoin #1 prioritaire:

### F. Documents collectes (preuves)
- Bulletin type FR
- Bulletin type EN
- Tableau coefficients
- Calendrier scolaire
- Reglement interne passage/redoublement
- Recu paiement type

## 4) Grille de scoring (priorisation)

Score par axe (0-3):
- Douleur process bulletin:
- Complexite multi-section/cycle:
- Pression impayes/finance:
- Capacite d'adoption numerique:
- Disponibilite des donnees (preuves):

Total (0-15):
- 0-5: faible priorite pilote
- 6-10: bon candidat pilote
- 11-15: priorite haute pilote

## 5) Matrice de transformation (reponses -> config EDUNEXUS)

## 5.1 School
- mode:
  - FR seul -> simple_fr
  - EN seul -> simple_en
  - FR+EN -> bilingual
  - multi-cycles + multi-rules -> complex
- cycles[]: derive de la structure observee
- hasMultipleCycles: true si >= 2 cycles

## 5.2 Section
- 1 section par combinaison langue x cycle operationnel
- Exemples:
  - Section Francophone Secondaire
  - Section Anglophone Secondaire
  - Section Francophone Primaire

## 5.3 SubSystem
- FR secondaire general -> FR_GENERAL_SEC
- EN secondaire general -> EN_GENERAL_SEC
- FR primaire -> FR_PRIMAIRE
- EN primaire -> EN_PRIMAIRE
- FR technique -> FR_TECHNIQUE_SEC
- EN technique -> EN_TECHNIQUE_SEC
- Maternelle -> MATERNELLE

## 5.4 AcademicPeriod
- FR secondaire: 6 sequences + mapping trimestre (1-2, 3-4, 5-6)
- EN secondaire: 3 terms
- Primaire FR: 3 terms ou 9 mensuels selon ecole

## 5.5 Grade et ReportCard
- rawScore + maxScore selon moteur
- scoreOn20 toujours calcule pour harmoniser les calculs
- coefficient = valeur matiere si active, sinon 1
- gradeLabel selon moteur (A/B/C..., A/ECA/NA, ou note)

## 6) Regles de validation avant implementation

1. Regle officielle (ministere) -> acceptable immediatement.
2. Regle locale -> necessite confirmation dans 3 ecoles minimum.
3. Exception locale rare -> garder en parametre optionnel, pas en logique globale.
4. Toute regle sans preuve documentaire -> status "A confirmer".

## 7) Checklist de sortie apres chaque entretien

- Fiche completee (sections A-F)
- Pieces collectees listees
- Config EDUNEXUS proposee (School/Sections/SubSystems)
- Gaps blocants identifies
- Risques data identifies
- Decision: Pilote Oui/Non

## 8) Deliverable attendu pour chaque ecole

Generer ce mini rapport (1-2 pages):
- Resume contexte
- Regles pedagogiques detectees
- Mapping config EDUNEXUS
- Ecarts fonctionnels (P0/P1/P2)
- Effort estime
- Recommendation pilote

## 9) MVP recommande (anti sur-ingenierie)

Phase 1:
- FR_GENERAL_SEC uniquement
- Bulletin sequence + trimestriel + annuel
- Coefficients par matiere

Phase 2:
- FR_PRIMAIRE + EN_GENERAL_SEC

Phase 3:
- Technique + complexes multi-cycles

## 10) Notes d'usage terrain

- Toujours demander un exemple reel et recent de bulletin.
- Toujours verifier si les coefficients appliques sont officiels ou internes.
- Toujours documenter les cas "hors norme" separement.
- Toujours capturer le workflow humain (qui fait quoi, quand, et avec quel outil).
