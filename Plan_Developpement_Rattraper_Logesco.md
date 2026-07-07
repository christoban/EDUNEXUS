# PLAN DE DÉVELOPPEMENT COMPLET — Phase « Rattraper Logesco »
## EduNexus — De l'état actuel à la parité fonctionnelle

> **Date :** 30 juin 2026
> **Base :** Audit fonctionnel EduNexus du 30/06/2026 (Claude Sonnet 4.6 via Claude Code)
> **Référence concurrentielle :** Logesco School Pro — 13 modules (analyse complète logesco.org)
> **Objectif de cette phase :** atteindre une couverture fonctionnelle équivalente à Logesco sur les modules logiciels. Le module Contrôle d'Accès physique (badges/bornes) est **hors périmètre** de cette phase — justification en section 1.
> **Méthode :** chaque tâche précise le modèle de données à créer/étendre, les endpoints à construire, les écrans frontend concernés, et un critère de fin (Definition of Done) vérifiable. Rien n'est laissé à l'interprétation au moment de l'exécution.

---

## SOMMAIRE

- Section 0 — Principes de la phase
- Section 1 — Vue d'ensemble et périmètre
- Section 2 — Phase A : Compléter l'existant (semaines 1-6)
- Section 3 — Phase B : Visibilité et automatisation (semaines 7-13)
- Section 4 — Phase C : Modules à construire (semaines 14-21)
- Section 5 — Phase D : Fiabilité opérationnelle (semaines 22-23)
- Section 6 — Calendrier récapitulatif
- Section 7 — Definition of Done globale
- Section 8 — Après la parité

---

# SECTION 0 — PRINCIPES DE LA PHASE

1. **Rien de nouveau qui n'existe pas déjà chez Logesco.** Cette phase ne sert qu'à atteindre la parité. Les idées de différenciation (transparence APEE, IA, mode offline avancé, GCE, etc.) restent gelées jusqu'à la fin de cette phase, sauf si elles sont déjà partiellement câblées dans l'existant (auquel cas on les laisse telles quelles, on ne les développe pas davantage ici).
2. **On termine un module avant d'en commencer un autre dans la même phase**, sauf dépendance technique explicite signalée.
3. **Chaque tâche se termine par un livrable testable** : un endpoint qui répond, un PDF qui se génère, un écran qui s'affiche avec données réelles — pas un "ça devrait marcher en théorie".
4. **La numérotation des modules (M1 à M13) reprend celle de l'audit et de l'analyse Logesco**, pour que les deux documents restent croisables à tout moment.

---

# SECTION 1 — VUE D'ENSEMBLE ET PÉRIMÈTRE

## 1.1 État de départ (rappel de l'audit)

| # | Module | % actuel | Phase de traitement |
|---|---|---|---|
| 1 | Administration et Paramétrages | 70 % | A (complément ciblé) |
| 2 | Planification et Emploi du Temps | 55 % | A puis B |
| 3 | Contrôle d'Accès (physique) | 5 % | **Hors périmètre** |
| 4 | Gestion de la Scolarité | 55 % | A |
| 5 | Intendance et Comptabilité | 50 % | A |
| 6 | Notes et Examens | 65 % | A |
| 7 | Rapports & Statistiques | 20 % | B |
| 8 | Discipline Scolaire | 40 % | A |
| 9 | Publipostages et Communications | 35 % | B |
| 10 | Rapports et États (impressions) | 35 % | A |
| 11 | Sécurité & Sauvegarde des Données | 45 % | D |
| 12 | Gestion des Ressources Humaines | 10 % | C |
| 13 | Gestion de la Pédagogie | 5 % | C |

## 1.2 Pourquoi le Contrôle d'Accès physique est mis hors périmètre

Ce module suppose du matériel (badges RFID, bornes biométriques) que la quasi-totalité des établissements camerounais ciblés par EduNexus ne possèdent pas. Construire ce module maintenant immobiliserait du temps de développement sur une fonctionnalité que peu de clients pourront utiliser à court terme, alors que les 12 autres modules sont 100 % logiciel et bénéficient à chaque établissement dès le premier jour. **Décision : ce module est reporté à une phase ultérieure, déclenchée uniquement si un client signe avec du matériel de contrôle d'accès déjà en place.**

## 1.3 Logique de séquencement des 4 phases

- **Phase A** complète ce qui est déjà entre 50 % et 70 % — c'est le rapport effort/résultat le plus favorable, car la fondation (modèles de données, architecture) existe déjà.
- **Phase B** s'attaque à ce qui est visible immédiatement en démonstration (graphes, messages de masse, génération d'emploi du temps) — c'est ce qui convainc un directeur d'école qui compare visuellement avec Logesco.
- **Phase C** construit les deux modules entiers manquants (Pédagogie, RH) — gros chantiers mais bien délimités, sans ambiguïté sur ce qu'il faut livrer.
- **Phase D** sécurise la production (sauvegarde, export) — peu visible en démo, mais indispensable avant tout déploiement réel chez un client.

---

# SECTION 2 — PHASE A : COMPLÉTER L'EXISTANT
### Semaines 1 à 6 — Objectif : faire passer 5 modules au-dessus de 75 %

## A.1 — Documents de scolarité (Module 4)    {fait}
**Semaines 1-2**

**Quoi faire :** générer en PDF les trois documents que toute école réclame dès l'inscription. Documents bruts à imprimer — signature et cachet physiques apposés manuellement par le Proviseur/Directeur après impression, pas de signature ni cachet image automatique à ce stade (décision validée).

- **Certificat de scolarité** : nom, matricule, classe, année scolaire, statut, QR code de vérification anti-falsification (voir ci-dessous).
- **Carte d'identité scolaire** : recto (photo, nom, matricule, classe, validité) / verso (règlement résumé, contact urgence), QR code de vérification.
- **Lettre de transfert / sortie définitive** : motif, date, dernière classe fréquentée, moyenne générale du dernier trimestre.

**⚠️ Point de parité confirmé (non optionnel) — QR code anti-falsification :** Logesco appose un QR code anti-falsification sur ses bulletins depuis 2017-2018 (matricule, moyenne, séquence/trimestre encodés ; un bulletin modifié après impression est détecté à la lecture du QR). C'est un argument de vente direct chez les directeurs d'école. EduNexus doit avoir l'équivalent pour être à parité, sur : le certificat de scolarité, la carte scolaire, et les bulletins déjà existants (`ReportCard` — à ajouter rétroactivement à cette tâche). Le tableau d'honneur et le PV (tâche A.3) restent des documents d'affichage interne et n'ont pas besoin de QR code.

Fonctionnement : génération d'un identifiant unique par document (UUID ou hash signé), encodage en QR dans le PDF, page de vérification publique `GET /verify/:documentId` qui affiche les données clés du document (élève, classe, date, statut) pour confirmer son authenticité sans exposer de données sensibles supplémentaires.

**Modèles de données :** `StudentProfile` a déjà matricule, classe, statut — vérifier si `photoUrl` existe, sinon l'ajouter. Nouveau modèle léger `VerifiableDocument` (id unique, type [CERTIFICATE/CARD/TRANSFER_LETTER/REPORT_CARD], studentId, generatedAt, dataSnapshot) pour soutenir la page de vérification.

**Endpoints à créer :**
- `GET /api/v2/students/:id/certificat` → PDF certificat de scolarité avec QR
- `GET /api/v2/students/:id/carte` → PDF carte recto/verso avec QR
- `GET /api/v2/students/:id/lettre-transfert` → PDF lettre de transfert (uniquement si `status` = TRANSFERRED ou LEFT)
- `GET /api/v2/verify/:documentId` → page/endpoint public de vérification (sans authentification, données minimales)
- Mise à jour du générateur de bulletins existant (`ReportCardController`/`PdfKitBulletinService`) pour y ajouter le QR

**Frontend :** bouton « Générer document » dans la fiche élève (`SectionUsers`), menu déroulant des 3 documents. Page publique simple de vérification (hors dashboard, accessible sans connexion).

**Definition of Done :** les trois PDF se génèrent depuis l'interface admin pour un élève réel de la base, s'ouvrent correctement, contiennent les bonnes données dynamiques (pas de placeholder), et le QR code de chacun renvoie vers une page de vérification fonctionnelle. Les bulletins existants portent également un QR vérifiable.

---

## A.2 — Import Excel des notes (Module 6)    {fait}
**Semaine 3**

**Quoi faire :** permettre à un enseignant d'uploader un fichier Excel rempli hors-ligne plutôt que de saisir note par note en ligne.

**Existant à réutiliser :** le template Excel de saisie existe déjà via `TemplateController`. `SaisirNoteUseCase` et `draftEnMasse` existent déjà côté logique métier.

**Endpoint à créer :**
- `POST /api/v2/grades/import` (multipart/form-data) → parse le fichier (lib `xlsx` ou `exceljs`), valide chaque ligne (matricule existe, note dans la plage autorisée selon la séquence), appelle `draftEnMasse` en interne, retourne un rapport (X lignes importées, Y erreurs avec détail ligne par ligne).

**Frontend :** dans `SectionTeacherGrades`, bouton « Importer depuis Excel », affichage du rapport d'import avec lignes en erreur surlignées.

**Definition of Done :** un enseignant peut télécharger le template, le remplir pour une classe de 40 élèves, l'importer, voir les notes apparaître en statut DRAFT, et corriger les éventuelles erreurs signalées sans devoir tout ressaisir.

---

## A.3 — Tableau d'honneur et PV de délibération PDF (Module 10)       {fait}
**Semaine 4**

**Quoi faire :** générer automatiquement, à la clôture de chaque trimestre, le tableau d'honneur (meilleurs élèves) et le procès-verbal officiel du conseil de classe. Le conseil de classe délibère par trimestre (sur la base des moyennes des séquences qui le composent) — il y a 3 clôtures dans l'année, une par trimestre. À la clôture du 3e trimestre, qui est aussi la clôture de l'année, le système génère en plus le tableau d'honneur annuel (sur la moyenne générale de l'année), au même moment que le tableau d'honneur du 3e trimestre — ce n'est pas une étape séparée ni un événement distinct.

**Existant à réutiliser :** les données sont déjà dans `ReportCard` et `ClassCouncilSession`/`ClassCouncilDecision`.

**Endpoints à créer :**
- `GET /api/v2/classes/:id/tableau-honneur?periodId=` → PDF des 5 ou 10 premiers de la classe sur la moyenne du trimestre concerné (utilisable pour T1, T2, T3) (seuil configurable)
- `GET /api/v2/classes/:id/tableau-honneur-annuel` → PDF sur la moyenne générale de l'année, disponible uniquement une fois le 3e trimestre clôturé
- `GET /api/v2/class-councils/:id/pv` → PDF du PV officiel (présidence, membres présents, décisions PASS/REPEAT/DELIBERATION par élève, observations)

**Frontend :** bouton dans `SectionAdminCouncil` après clôture d'une session de conseil de classe.

**Definition of Done :** après une délibération trimestrielle réelle sur une classe test, le tableau d'honneur du trimestre et le PV se génèrent avec les vraies décisions prises — pour T1, T2 et T3. À la clôture du 3e trimestre, le tableau d'honneur annuel se génère également, calculé sur les 3 trimestres de la classe test.

---

## A.4 — Reçus de paiement et relances automatiques (Module 5)    {fait}
**Semaine 5**

**Quoi faire :** deux livrables indépendants.

1. **Reçu de paiement PDF** automatique à chaque paiement confirmé (cash ou Mobile Money) : numéro de reçu, élève, montant, mode de paiement, solde restant.
   - Endpoint : `GET /api/v2/payments/:id/recu`
   - Déclenchement automatique : email/notification avec le PDF en pièce jointe dès que `Payment.status` passe à CONFIRMED.

2. **Relances automatiques** pour factures `OVERDUE` : job planifié (Inngest, déjà disponible dans la stack) qui scanne les `Invoice` en retard chaque jour/semaine et déclenche un SMS/email de rappel via `SmsNotificationService` existant.
   - Pas de nouveau modèle nécessaire — réutiliser `Invoice.status` et `SchoolNotificationSettings`.

**Definition of Done :** un paiement test génère son reçu PDF immédiatement ; une facture rendue artificiellement en retard déclenche bien une notification automatique sans intervention manuelle.

---

## A.5 — Notifications automatiques discipline + seuil d'absences (Module 8)    {fait}
**Semaine 6**

**Quoi faire :**

1. **Notification parent automatique** à chaque création d'un `DisciplineRecord` : SMS/email immédiat au(x) parent(s) liés via `ParentStudent`.
2. **Seuil d'absences avec alerte** : job (ou trigger applicatif) qui compte les absences non justifiées par élève sur une période glissante, et déclenche une notification au Surveillant Général + parent au-delà d'un seuil configurable par école (`SchoolSettings`, ajouter un champ `unjustifiedAbsenceThreshold`).

**Endpoints/jobs à créer :**
- Hook interne dans le use case de création de `DisciplineRecord` → appel `SmsNotificationService`
- Job planifié (quotidien) : `CheckAbsenceThresholdJob` via Inngest

**Definition of Done :** une sanction créée en test déclenche une notification visible (log SMS/email) ; un élève dépassant artificiellement le seuil d'absences déclenche l'alerte sans intervention manuelle.

---

### Bilan attendu Phase A (fin semaine 6)

| Module | Avant | Après (estimé) |
|---|---|---|
| M4 — Scolarité | 55 % | ~75 % |
| M5 — Intendance | 50 % | ~65 % |
| M6 — Notes et Examens | 65 % | ~80 % |
| M8 — Discipline | 40 % | ~60 % |
| M10 — Rapports et États | 35 % | ~55 % |

---

# SECTION 3 — PHASE B : VISIBILITÉ ET AUTOMATISATION
### Semaines 7 à 13 — Objectif : ce qui se voit en démonstration face à Logesco

## B.1 — Tableau de bord statistique avec graphes (Module 7)    {fait}
**Semaines 7-9 (3 semaines)**

**Quoi faire :** construire l'infrastructure de visualisation de données, totalement absente actuellement côté frontend.

**Backend — endpoints analytiques à créer :**
- `GET /api/v2/statistics/grades-evolution?classId=&subjectId=&studentId=` → série temporelle des moyennes sur les séquences de l'année
- `GET /api/v2/statistics/classes-comparison?level=` → comparaison des moyennes entre classes d'un même niveau
- `GET /api/v2/statistics/students-distribution?criteria=gender|level|paymentStatus` → répartition des effectifs
- `GET /api/v2/statistics/teacher-performance/:teacherId` → heures effectuées vs prévues, taux de présence, moyennes de ses classes (s'appuie sur l'existant `GET /api/v2/departments/:id/performance`, à généraliser par enseignant)

**Frontend :**
- Intégrer **Recharts** (déjà listé dans la stack technique du projet) dans `SectionDashboard`
- Graphes prioritaires : courbe d'évolution des moyennes par classe/séquence, histogramme de répartition des mentions, camembert répartition par statut de paiement
- Page dédiée `SectionStatistics` distincte du dashboard résumé, avec filtres (classe, matière, période)

**Definition of Done :** un admin peut sélectionner une classe et voir, avec de vraies données de la base, l'évolution de la moyenne générale sur les séquences déjà clôturées, sous forme de graphe — pas un tableau de chiffres bruts.

---

## B.2 — Publipostage SMS/email en masse (Module 9)    {fait}
**Semaines 10-11 (1,5 semaine)**

**Quoi faire :** permettre l'envoi d'un message à un groupe ciblé plutôt qu'individuellement.

**Existant à réutiliser :** `SmsLog`, `EmailLog`, `SmsNotificationService`, `SchoolNotificationSettings` existent déjà — il manque la couche de ciblage et l'interface.

**Endpoint à créer :**
- `POST /api/v2/communications/broadcast` — body : `{ target: { role?, classId?, level?, paymentStatus? }, channel: 'SMS' | 'EMAIL' | 'BOTH', message: string, scheduledAt?: date }`
- Résolution du ciblage en interne (ex. : tous les parents de la classe 3eA, ou tous les élèves en retard de paiement) puis envoi en lot via les services existants.

**Frontend :** nouvelle section `SectionCommunications` dans le dashboard admin/staff — formulaire de ciblage, zone de message avec variables (`{nom_eleve}`, `{classe}`, `{solde}`), aperçu avant envoi, historique des envois avec statut de livraison.

**Definition of Done :** un admin envoie un SMS test à tous les parents d'une classe réelle, le message apparaît dans `SmsLog` pour chaque destinataire, et l'historique d'envoi est consultable depuis l'interface.

---

## B.3 — Génération automatique de l'emploi du temps (Module 2)    {fait}
**Semaines 12-15 (4 semaines)**

**Quoi faire :** construire un vrai moteur de génération automatique d'emploi du temps, en 3 couches distinctes.

**Existant à réutiliser :** `Timetable`, `TimetableSlot`, `TimetableGridConfig`, `TeachingAssignment`, l'endpoint `check-conflict` existent déjà.

**Couche 1 — Moteur algorithmique (backtracking + propagation de contraintes)**
C'est le cœur du système. Pas d'IA ici — algorithme pur qui garantit un résultat sans conflit :
- Placement dans l'ordre des cours les plus contraints d'abord (enseignant avec le plus de classes, matière avec le plus d'heures hebdomadaires)
- À chaque placement, propagation immédiate des contraintes dérivées (si un enseignant est placé lundi 8h sur une classe, tous ses autres créneaux lundi 8h sont automatiquement bloqués)
- Si aucun créneau n'est disponible pour un cours : backtracking (retour au placement précédent, tentative d'un autre créneau) jusqu'à trouver une solution valide ou déclarer le cours impossible à placer
- Contraintes obligatoires gérées : unicité enseignant par créneau, unicité classe par créneau, respect du volume horaire hebdomadaire par matière (`Subject.heuresParSemaine`), respect de la grille horaire (`TimetableGridConfig`)

**Couche 2 — Optimisation post-placement (rendre le résultat agréable, pas juste correct)**
Appliquée après le placement, sans risquer de casser les contraintes obligatoires :
- Interdiction de 3 heures consécutives ou plus de la même matière sur une même journée (2 heures consécutives restent autorisées selon le contexte et la matière — c'est le Censeur qui configure les matières concernées, pas une règle universelle)
- Équilibrage de la charge journalière des enseignants (éviter 6h un jour et 1h le lendemain si c'est évitable)
- Placement préférentiel des matières scientifiques lourdes (Maths, Physique, Chimie) en matinée plutôt qu'en fin d'après-midi — configurable par l'établissement

**Couche 3 — IA en surface (groq, déjà dans la stack)**
Groq intervient uniquement après la génération, pour deux fonctions précises :
- **Explication des conflits résiduels en français clair** : si un cours n'a pas pu être placé, Groq génère une explication lisible ("La classe de 3eA n'a pas pu recevoir ses 3h de SVT hebdomadaires car M. Ondoua dépasse déjà son volume maximum. Suggestion : affecter un autre enseignant ou revoir le volume horaire de la matière")
- **Ajustements en langage naturel** : le Censeur peut taper "Déplace tous les cours de M. Minkeng du jeudi au vendredi" — Groq traduit cette instruction en appels API de modification de `TimetableSlot`, sans que l'utilisateur touche au drag-and-drop

**Endpoint à créer :**
- `POST /api/v2/timetables/auto-generate` — lance le moteur backtracking, retourne l'emploi du temps complet en DRAFT + la liste des cours non placés avec leurs raisons
- `POST /api/v2/timetables/:id/adjust` — reçoit une instruction en langage naturel, Groq la traduit en modifications de slots

**Vue par enseignant et par salle** : en plus de la vue par classe existante — simple filtre sur les `TimetableSlot` déjà en base, pas de nouveau modèle.

**Frontend :** bouton « Générer automatiquement » dans `SectionGrilleHoraire`, résultat affiché en DRAFT modifiable par drag-and-drop, cours non placés listés en rouge avec explication Groq, champ texte libre pour ajustements en langage naturel, bouton « Publier » une fois satisfait.

**Definition of Done :** sur un établissement test avec 20+ classes, 30+ enseignants et les volumes horaires réels de chaque matière, la génération produit un emploi du temps complet sans aucun chevauchement enseignant ni classe, avec les règles d'optimisation respectées, les cours impossibles à placer clairement expliqués en français, et au moins un ajustement en langage naturel qui fonctionne correctement de bout en bout.

---

### Bilan attendu Phase B (fin semaine 13)

| Module | Avant Phase B | Après (estimé) |
|---|---|---|
| M2 — Planification | ~55 % (post-A) | ~75 % |
| M7 — Rapports & Statistiques | 20 % | ~70 % |
| M9 — Publipostages | 35 % | ~75 % |

---

# SECTION 4 — PHASE C : MODULES À CONSTRUIRE
### Semaines 14 à 21 — Objectif : combler les deux modules quasiment vides

## C.1 — Module Gestion de la Pédagogie (Module 13)    {fait}
**Semaines 14-17 (4 semaines)**

**Quoi faire :** construire le module de zéro, en s'appuyant sur les permissions déjà définies (`SUPERVISE_LESSON_PLANS`, `MANAGE_PEDAGOGICAL_BRIEF`, `MANAGE_CE_REPORTS`, `GENERATE_PEDAGOGICAL_REPORTS`) qui existent mais n'ont aucune implémentation.

**Nouveaux modèles Prisma :**
- `Programme` (matière, niveau, année scolaire, liste de chapitres)
- `Chapitre` (programme, titre, ordre, volume horaire prévu, séquence cible de fin)
- `CahierDeTexte` (enseignant, classe, matière, date, chapitre lié, contenu réalisé, devoirs donnés)
- `ProgressionSuivi` — vue calculée ou table de cache (chapitres réalisés / chapitres prévus à date) pour alimenter les alertes sans recalcul coûteux à chaque requête

**Endpoints à créer :**
- `POST/GET /api/v2/programmes` — gestion par l'admin/Censeur
- `POST /api/v2/cahier-de-texte` — saisie enseignant après chaque cours
- `GET /api/v2/pedagogie/progression?classId=&subjectId=` — comparaison prévu vs réalisé
- `GET /api/v2/pedagogie/alertes-retard` — classes/matières en retard significatif (seuil configurable, ex. : écart > 15 %)
- `GET /api/v2/pedagogie/rapports?teacherId=|departmentId=|classId=` — pour `GENERATE_PEDAGOGICAL_REPORTS`

**Frontend :**
- Finaliser `SectionDepartementAP.tsx` (déjà listé comme "pending" dans l'audit)
- Nouvel écran enseignant : saisie du cahier de texte après chaque séance
- Nouvel écran Censeur/AP : tableau de bord de progression par classe/matière avec code couleur (à jour / léger retard / retard critique)

**Definition of Done :** un enseignant saisit un cahier de texte réel après un cours, le système met à jour la progression de la classe sur la matière concernée, et le Censeur voit l'alerte si le retard dépasse le seuil.

---

## C.2 — Module Gestion des Ressources Humaines (Module 12)
**Semaines 18-21 (4 semaines)**

**Quoi faire :** construire un vrai module RH, actuellement réduit à des profils minimaux (`TeacherProfile`, `StaffProfile`) sans gestion de carrière. 

**Nouveaux modèles Prisma :**
- `EmployeeFile` (extension de TeacherProfile/StaffProfile) : date de naissance, acte de naissance (upload), diplômes (liste), numéro CNPS, type de contrat, date d'embauche, échelon actuel
- `CareerEvent` (employé, type : PROMOTION/MUTATION/AVANCEMENT_ECHELON/SANCTION, date, observation)
- `StaffAttendance` (employé, date, statut PRESENT/ABSENT/RETARD — distinct de `Attendance` des élèves)
- `LeaveRequest` (employé, type CONGE_ANNUEL/MALADIE/MATERNITE/AUTORISATION, dates début/fin, statut PENDING/APPROVED/REJECTED, validateur)
- `LeaveBalance` (employé, année, solde restant)
- `MissionOrder` (employé, motif, lieu, dates, signataire)

**Endpoints à créer :**
- `GET/POST/PATCH /api/v2/hr/employees/:id/file` — dossier personnel complet
- `POST /api/v2/hr/employees/:id/career-events` — historique de carrière
- `POST /api/v2/hr/attendance` — pointage personnel (saisie manuelle dans un premier temps, pas de biométrie)
- `POST/PATCH /api/v2/hr/leave-requests` — workflow demande/validation de congé
- `GET /api/v2/hr/employees/:id/attestation-travail` — PDF attestation
- `GET /api/v2/hr/employees/:id/certificat-travail` — PDF certificat
- `POST /api/v2/hr/mission-orders` + `GET .../pdf` — ordre de mission

**Frontend :**
- Nouveau contrôleur/section `HRController` côté backend (à créer entièrement, comme noté dans l'audit)
- Nouvel espace admin « Ressources Humaines » : liste du personnel, fiche détaillée par employé, validation des demandes de congé, génération de documents

**Hors périmètre volontaire de cette tâche (à ne pas faire maintenant) :** la paie complète (calcul de salaire, bulletins de paie) — Logesco la mentionne mais c'est un chantier à part entière avec des enjeux légaux/fiscaux qui dépasse la simple parité fonctionnelle d'affichage. **Décision : RH sans paie pour cette phase**, paie traitée comme chantier séparé si un client la demande explicitement.

**Definition of Done :** un dossier employé complet est consultable et modifiable, une demande de congé suit le workflow demande → validation → solde mis à jour, et les trois documents PDF (attestation, certificat, ordre de mission) se génèrent avec de vraies données.

---

### Bilan attendu Phase C (fin semaine 21)

| Module | Avant Phase C | Après (estimé) |
|---|---|---|
| M13 — Pédagogie | 5 % | ~70 % |
| M12 — RH (hors paie) | 10 % | ~65 % |

---

# SECTION 5 — PHASE D : FIABILITÉ OPÉRATIONNELLE
### Semaines 22 à 23 — Objectif : sécuriser avant tout déploiement client réel

## D.1 — Sauvegarde automatique et restauration (Module 11)
**Semaine 22**

**Quoi faire :**
- Job planifié quotidien (Inngest) : dump PostgreSQL automatique, stocké hors site (S3-compatible ou équivalent disponible sur l'infrastructure choisie)
- Conserver un historique glissant (ex. : 30 derniers jours)
- Procédure de restauration documentée + endpoint protégé `POST /api/v2/master/schools/:id/restore` (accessible uniquement MasterUser, avec confirmation à double facteur vu le niveau de risque)

**Definition of Done :** une sauvegarde automatique se déclenche et est vérifiable chaque jour ; un test de restauration sur un environnement de test recharge correctement les données d'une école.

---

## D.2 — Export RGPD / export total des données école (Module 11)
**Semaine 23**

**Quoi faire :**
- `GET /api/v2/school/export` (Admin uniquement) — génère une archive (JSON ou Excel multi-feuilles) de toutes les données de l'école : élèves, notes, finances, personnel — pour conformité et portabilité.
- Politique de rétention des logs : job de purge des `ActivitiesLog`/`EmailLog`/`SmsLog` au-delà d'une durée configurable (éviter la croissance illimitée de la base).

**Definition of Done :** un admin déclenche l'export et reçoit un fichier complet et exploitable de toutes les données de son école.

---

### Bilan attendu Phase D (fin semaine 23)

| Module | Avant | Après (estimé) |
|---|---|---|
| M11 — Sécurité & Sauvegarde | 45 % | ~80 % |

---

# SECTION 6 — CALENDRIER RÉCAPITULATIF

| Semaines | Phase | Contenu |
|---|---|---|
| 1-2 | A | Documents scolarité (certificat, carte, lettre transfert) |
| 3 | A | Import Excel des notes |
| 4 | A | Tableau d'honneur + PV délibération |
| 5 | A | Reçus paiement + relances automatiques |
| 6 | A | Notifications discipline + seuil d'absences |
| 7-9 | B | Tableau de bord statistique avec graphes |
| 10-11 | B | Publipostage SMS/email en masse |
| 12-13 | B | Génération assistée emploi du temps |
| 14-17 | C | Module Pédagogie complet |
| 18-21 | C | Module RH complet (hors paie) |
| 22 | D | Sauvegarde automatique + restauration |
| 23 | D | Export RGPD + rétention des logs |

**Durée totale : 23 semaines, soit environ 5,5 mois** de développement à temps plein, en travail solo.

---

# SECTION 7 — DEFINITION OF DONE GLOBALE

La phase « Rattraper Logesco » est considérée terminée quand :

1. Les 12 modules logiciels (hors Contrôle d'Accès physique) sont tous au-dessus de 60 %, avec au moins 8 d'entre eux au-dessus de 70 %.
2. Chaque document officiel que Logesco met en avant (bulletin, certificat, carte, attestation de travail, tableau d'honneur, PV de délibération) a un équivalent PDF généré automatiquement depuis EduNexus avec de vraies données.
3. Un directeur d'école peut, en une seule démonstration de bout en bout (inscription → notes → bulletin → paiement → communication aux parents → statistiques), retrouver chaque étape qu'il connaît déjà chez un concurrent comme Logesco — sans avoir à dire « ça, ça n'existe pas encore ».
4. La sauvegarde automatique est opérationnelle avant tout déploiement chez un premier client réel — non négociable, indépendamment de l'avancement du reste.

---

# SECTION 8 — APRÈS LA PARITÉ

Une fois cette phase terminée, et seulement à ce moment-là, le travail reprend sur l'axe « Dépasser Logesco » déjà documenté dans *EduNexus_Carte_Complete_V2.md* : transparence financière APEE, journal de présence enseignant temps réel, détection précoce des élèves à risque, sous-système anglophone GCE approfondi, messagerie bidirectionnelle, mode offline renforcé, module orientation scolaire, et le reste de la feuille de route déjà posée.

Ce séquencement strict — parité d'abord, différenciation ensuite — garantit qu'EduNexus n'est jamais présenté à un client ou un jury avec une lacune visible sur ce que la concurrence sait déjà faire.

---

*Document de pilotage — à cocher tâche par tâche au fur et à mesure de l'avancement réel constaté en code, pas en intention.*
*Prochaine mise à jour : fin de Phase A (semaine 6).*





il faut aussi que je gère le concours d'entrée en 6eme et meme le CEPE