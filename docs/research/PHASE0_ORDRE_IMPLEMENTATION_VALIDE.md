# EDUNEXUS - Phase 0 - Ordre d'implementation valide

Date: 2026-04-17
Statut: PRET EXECUTION

## 1. Sequence globale

1. Phase 1 - Modele coeur
2. Phase 2 - Moteur de notation unifie
3. Phase 3 - Bulletins multi-systemes
4. Phase 4 - Configuration dynamique et UI admin
5. Phase 5 - Migration/compatibilite
6. Phase 6 - UX metier par role
7. Phase 7 - Integrations transverses
8. Phase 8 - Tests/pilote

## 2. Why this order

1. Sans modele coeur, tout le reste est fragile.
2. Sans moteur unifie, les bulletins divergent.
3. Sans bulletins, la valeur metier reste invisible.
4. Sans migration, la prod casse.

## 3. Checklists de passage de phase

## 3.1 Gate Phase 1 -> Phase 2
- SubSystem, Section, AcademicPeriod implementes
- Class liee a Section
- API CRUD de base fonctionnelles
- Tests schema/model verts

## 3.2 Gate Phase 2 -> Phase 3
- scoreOn20 calcule pour tous les modes
- moyenne ponderee/simple testee
- formatGrade selon gradingScale valide

## 3.3 Gate Phase 3 -> Phase 4
- Bulletin FR secondaire genere correctement
- Bulletin EN secondaire genere correctement
- Generation par section/periode operationnelle

## 3.4 Gate Phase 4 -> Phase 5
- UI admin configure school/sections/subsystems
- passThreshold, coefficients, templates configurables

## 4. Scope concret Phase 1 (next)

1. Creer model SubSystem
2. Creer model Section
3. Creer model AcademicPeriod
4. Enrichir SchoolSettings (mode + sections + cycles)
5. Ajouter sectionId sur Class
6. Exposer routes/controllers minimums pour ces entites

## 5. Risques identifies et mitigation

1. Sur-ingenierie precoce
- Mitigation: livrer d'abord FR_GENERAL_SEC operationnel

2. Variantes terrain non prevues
- Mitigation: design data-driven, pas hardcode

3. Regressions legacy
- Mitigation: migration progressive + fallback par defaut

## 6. Definition of Done - Phase 0

1. Spec courte publiee
2. Matrice officiel vs terrain publiee
3. Ordre implementation valide publie
4. Ready-for-build de Phase 1 confirme
