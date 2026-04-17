Parfait. On va faire ça en mode programme d’implémentation par phases, avec des critères de sortie stricts.  
Dès qu’une phase est validée, on enchaîne la suivante jusqu’à couvrir toute la logique coeur du document Cameroun.

**Plan Directeur**
1. Phase 0: Cadrage technique et verrouillage des décisions
2. Phase 1: Modèle de domaine coeur (SubSystem, Section, AcademicPeriod)
3. Phase 2: Moteur de notation unifié et normalisation des scores
4. Phase 3: Bulletins multi-systèmes (FR, EN, primaire, maternelle)
5. Phase 4: Configuration dynamique par établissement
6. Phase 5: Migration des données existantes et compatibilité
7. Phase 6: UX opérationnelle par rôle (admin, enseignant, parent)
8. Phase 7: Intégration cross-modules (attendance, finance, conseils)
9. Phase 8: Tests, pilote terrain, durcissement production

**Phase 0: Cadrage**
1. Objectif:
- Verrouiller le périmètre MVP et les invariants métier issus du document.
2. Livrables:
- Spécification fonctionnelle courte
- Matrice de règles officielles vs règles à valider terrain
- Ordre d’implémentation validé
3. Critère de sortie:
- Plus aucune ambiguïté sur les 7 SubSystems cibles.

**Phase 1: Modèle coeur**
1. Objectif:
- Introduire la structure canonique multi-réalités Cameroun.
2. Livrables:
- Entités SubSystem, Section, AcademicPeriod
- Enrichissement SchoolSettings avec mode simple_fr, simple_en, bilingual, complex
- Liaison classes vers section
3. Critère de sortie:
- Une école peut avoir plusieurs sections avec moteurs différents sans mélange de données.

**Phase 2: Moteur de notation**
1. Objectif:
- Un moteur de calcul unique piloté par configuration.
2. Livrables:
- Normalisation scoreOn20
- Calcul moyenne pondérée ou simple selon hasCoefficientBySubject
- Mapping d’affichage selon gradingScale
3. Critère de sortie:
- Même algorithme pour FR/EN/technique via paramètres, sans duplication de code.

**Phase 3: Bulletins**
1. Objectif:
- Générer des bulletins cohérents selon système.
2. Livrables:
- Templates bulletin FR/EN/primaire/maternelle
- Périodes bulletin et périodes conseil gérées via AcademicPeriod
- Champs obligatoires (rang, stats classe, signatures, absences)
3. Critère de sortie:
- Génération correcte sur cas FR 6 séquences et EN 3 terms.

**Phase 4: Configuration établissement**
1. Objectif:
- Permettre configuration sans redeploiement.
2. Livrables:
- UI admin pour sections, cycles, subsystems, seuils, décisions conseil
- Paramètres coefficients et modèles bulletin
3. Critère de sortie:
- Un admin configure son école sans intervention dev.

**Phase 5: Migration et compatibilité**
1. Objectif:
- Passer du modèle actuel au nouveau sans casser l’existant.
2. Livrables:
- Scripts de migration
- Valeurs par défaut pour écoles déjà créées
- Compatibilité API transitoire
3. Critère de sortie:
- Aucune régression fonctionnelle sur les flux actuels.
4. Implémentation:
- Script de migration phase 5 ajouté dans le backend
- Compatibilité transitoire pour les anciens alias de payload
- Route `school-settings` compatible avec `POST` et `PUT`

**Phase 6: Parcours utilisateurs**
1. Objectif:
- Rendre les parcours métier utilisables au quotidien.
2. Livrables:
- Saisie notes alignée par section/système
- Vue parent cross-section si enfants FR et EN
- Dashboards filtrables par section et cycle
3. Critère de sortie:
- Flux complet de fin de période réalisable sans contournement.
4. Implémentation:
- Dashboard principal filtrable par section et cycle
- Portail parent consolidé avec répartition cross-section
- Générateur d’examens enrichi avec contexte section/système

**Phase 7: Intégration transverse**
1. Objectif:
- Connecter logique coeur avec attendance, finance et décisions.
2. Livrables:
- Règles absences dans calcul selon configuration
- Décisions conseil paramétrables
- Impayés et politique bulletin paramétrable
3. Critère de sortie:
- Cohérence métier inter-modules validée.

**Phase 8: Qualité et pilote**
1. Objectif:
- Sécuriser avant généralisation.
2. Livrables:
- Tests unitaires et intégration sur moteur règles
- Jeux de données pilotes FR, EN, bilingue, complexe
- Guide de déploiement pilote
3. Critère de sortie:
- Pilote prêt sur un premier lot d’écoles.

**Règle de progression entre phases**
1. Chaque phase a une checklist de validation.
2. Pas de phase suivante tant que:
- Tests de la phase courante non verts
- Régression non traitée
- Documentation de phase non mise à jour

**Ordre d’exécution recommandé maintenant**
1. Démarrer immédiatement Phase 0 et Phase 1.
2. Puis enchaîner Phase 2 sans pause.
3. Ensuite Phase 3 pour rendre visible la valeur métier.

Si tu valides ce plan, je commence par exécuter la Phase 0 en concret dans le repo avec:
1. un document de décisions verrouillées,
2. la matrice officielle vs terrain,
3. la checklist de sortie Phase 1 prête pour implémentation.