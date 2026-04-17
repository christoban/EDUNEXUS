# EDUNEXUS - Phase 0 - Specification fonctionnelle courte

Date: 2026-04-17
Source de verite fonctionnelle: EDUNEXUS_ANALYSE_SYSTEME_EDUCATIF_CAMEROUN.html
Statut: VALIDE POUR IMPLEMENTATION

## 1. Perimetre MVP verrouille

Le MVP couvre le coeur pedagogique camerounais avec moteur configurable:

1. School multi-tenant
2. Section par langue/cycle
3. SubSystem parametrable
4. AcademicPeriod parametrable
5. Grade normalise (scoreOn20)
6. Bulletin par section/periode

## 2. Invariants metier (non negociables)

1. Un tenant (School) peut porter plusieurs sections.
2. Chaque class appartient a une section.
3. Chaque section pointe vers un SubSystem.
4. Le calcul de moyenne est base sur scoreOn20, quel que soit le systeme d'affichage.
5. Les regles de periode (6 sequences, 3 terms, 9 mensuels) viennent du SubSystem/Section, pas de hardcode global.
6. Les bulletins sont generes par periode + section.
7. Les regles officielles sont implementees d'abord; les variantes locales restent parametrables.

## 3. Les 7 SubSystems cibles (ambiguite = 0)

1. FR_GENERAL_SEC
- Usage: CES, LEG, section francophone secondaire general
- Grading: OVER_20
- PeriodType: SEQUENCES_6
- Coefficients: true
- Seuil de passage par defaut: 10/20

2. FR_PRIMAIRE
- Usage: primaire francophone
- Grading: COMPETENCY_ANA (ou OVER_20 selon etablissement)
- PeriodType: TERMS_3 ou MONTHLY_9
- Coefficients: false (par defaut)

3. FR_TECHNIQUE_SEC
- Usage: CETIC, lycee technique section FR
- Grading: OVER_20
- PeriodType: SEQUENCES_6
- Coefficients: true (souvent renforces sur matieres pro)

4. EN_GENERAL_SEC
- Usage: GSS, GHS secondaire general EN
- Grading: PERCENT ou GRADES_AE
- PeriodType: TERMS_3
- Coefficients: false (par defaut)
- Seuil de passage par defaut: 40%

5. EN_PRIMAIRE
- Usage: primaire anglophone
- Grading: PERCENT ou GRADES_AE
- PeriodType: TERMS_3
- Coefficients: false

6. EN_TECHNIQUE_SEC
- Usage: GTC/GTHS EN technique
- Grading: PERCENT ou OVER_20 selon politique ecole
- PeriodType: TERMS_3
- Coefficients: false (par defaut)

7. MATERNELLE
- Usage: maternelle FR/EN
- Grading: COMPETENCY_ANA
- PeriodType: TERMS_3 (ou adaptation ecole)
- Coefficients: false

## 4. Hors scope MVP (Phase > 3)

1. Toutes les exceptions locales ultra-specifiques d'un etablissement unique
2. Regles complexes de sanctions automatises
3. Personnalisation avancee de templates PDF par pixel

## 5. Definition of Done - Phase 0

1. Les 7 SubSystems sont definis sans ambiguite
2. Les invariants metier sont documentes et acceptes
3. Le perimetre MVP est gelé
4. Les elements terrain restants sont identifies comme parametrage, pas blocage architecture
