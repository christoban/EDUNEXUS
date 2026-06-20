# EDUNEXUS — ANALYSE SYSTÈME POUR DIAGRAMMES UML
### Présoutenance — Ndzana Christophe
> SaaS de gestion scolaire pour le système éducatif camerounais

---

## TABLE DES MATIÈRES

1. [Présentation du système](#1-présentation-du-système)
2. [Acteurs du système](#2-acteurs-du-système)
3. [Diagramme de cas d'utilisation](#3-diagramme-de-cas-dutilisation)
4. [Modèles de données — Diagramme de classes](#4-modèles-de-données--diagramme-de-classes)
5. [Enums et types](#5-enums-et-types)
6. [Diagrammes de séquence — Flux métier](#6-diagrammes-de-séquence--flux-métier)
7. [Architecture technique — Diagramme de composants](#7-architecture-technique--diagramme-de-composants)
8. [Endpoints API complets](#8-endpoints-api-complets)
9. [Interfaces utilisateur par rôle](#9-interfaces-utilisateur-par-rôle)
10. [Spécificités métier camerounaises](#10-spécificités-métier-camerounaises)

---

## 1. PRÉSENTATION DU SYSTÈME

EduNexus est une plateforme SaaS multi-tenant de gestion scolaire conçue pour les établissements scolaires camerounais. Elle couvre l'intégralité de la vie scolaire : de l'onboarding de l'établissement jusqu'aux paiements Mobile Money, en passant par la gestion académique, administrative et pédagogique.

### Modules fonctionnels du système

| Module | Description |
|--------|-------------|
| **Authentification multi-rôles** | JWT HS512, cookies httpOnly, authentification 3 facteurs pour SuperAdmin (mdp + OTP email + TOTP) |
| **Onboarding établissement** | Processus d'inscription en 4 étapes avec activation automatique de toute la structure |
| **Dashboard SuperAdmin (Master)** | Gestion du cycle de vie des établissements, plans d'abonnement, logs d'audit |
| **Dashboard Admin (Proviseur)** | 13 sections de gestion complète de l'établissement |
| **Dashboard Staff (Censeur, Intendant, etc.)** | Permissions granulaires — 28 droits distincts selon le rôle du personnel |
| **Dashboard Enseignant** | Saisie des notes, présences, consultation EDT |
| **Dashboard Élève** | Notes, bulletins, emploi du temps, présences, examens en ligne |
| **Dashboard Parent** | Suivi des enfants, paiements Mobile Money |
| **Gestion des utilisateurs** | CRUD complet + import Excel (jusqu'à 500 élèves en masse) + invitation par email |
| **Gestion des classes** | CRUD, professeur principal, sous-groupes TP/LV2 |
| **Gestion des matières** | CRUD, coefficients BAC officiels MINESEC par série |
| **Affectations pédagogiques** | Association Matière ↔ Enseignant ↔ Classe (unicité garantie) |
| **Système de notes** | Workflow saisie → soumission → validation → rejet, notes en masse |
| **Génération de bulletins PDF** | 6 templates MINESEC, calcul automatique moyennes, rangs, mentions |
| **Présences** | Enregistrement absences/retards, justifications, par période Matin/Après-midi |
| **Emploi du temps** | Configuration grille horaire, génération squelette, remplissage case par case, détection conflits, limite AP 14h/semaine |
| **Conseil de classe** | Sessions, décisions PASS/REPEAT/DELIBERATION, verrouillage, rapport |
| **Finance** | Plans de frais, factures, paiements MTN MoMo + Orange Money via CampPay, cautions, dépenses |
| **Discipline** | 5 types de sanctions, levée de sanctions, historique |
| **Orientation scolaire** | Fiches, entretiens, tests d'aptitude, recommandations de séries, suivi |
| **Bibliothèque** | Catalogue livres, emprunts, retours, gestion des disponibilités |
| **IA Santé scolaire** | Score de santé par élève, détection de risques, génération commentaires bulletins, chat pédagogique |
| **Année scolaire** | Création, trimestres, séquences, calendrier scolaire, clôture + promotion automatique des élèves |
| **Messagerie interne** | Conversations entre utilisateurs, modération |
| **Annonces** | Ciblées par rôle (admin, enseignants, élèves, parents) |
| **Recherche globale** | Multi-entités (élèves, enseignants, classes, matières) |
| **Logs d'audit** | Traçabilité complète (emails, activités, actions sensibles master) |
| **Paramètres école** | Profil, logo, timezone, locale, notifications, sous-domaine |
| **Import Excel** | Élèves + enseignants avec création automatique des comptes parents |
| **Examens en ligne** | Publication d'examens, soumissions d'élèves |
| **Mode hors-ligne** | Synchronisation IndexedDB, indicateur visuel de connectivité, résolution de conflits |
| **Notifications SMS** | Alertes transactionnelles via Techsoft (absences, paiements, bulletins) |

---

## 2. ACTEURS DU SYSTÈME

### 2.1 Vue d'ensemble des acteurs

```
                        ┌─────────────────────────────────┐
                        │        SYSTÈME EDUNEXUS          │
                        └─────────────────────────────────┘
                                        │
          ┌─────────────────────────────┼──────────────────────────────┐
          │                             │                              │
  ┌───────────────┐           ┌─────────────────┐            ┌─────────────────┐
  │  Acteurs      │           │  Acteurs        │            │  Systèmes       │
  │  Plateforme   │           │  Établissement  │            │  Externes       │
  └───────────────┘           └─────────────────┘            └─────────────────┘
         │                             │                              │
  ┌──────────┐              ┌──────────┬──────────────┐      ┌───────────────┐
  │MasterUser│              │  Admin   │    Staff     │      │   CampPay     │
  │(SuperAdm)│              │(Provisr) │  (Censeur,   │      │(MTN+Orange)   │
  └──────────┘              └──────────│  Intendant,  │      └───────────────┘
                                       │  Document.,  │      ┌───────────────┐
                            ┌──────────│  Orientat.)  │      │   Gemini AI   │
                            │Teacher   └──────────────┘      └───────────────┘
                            │(Enseignt)                      ┌───────────────┐
                            ├──────────                      │  Email SMTP   │
                            │Student                         └───────────────┘
                            │(Élève)                         ┌───────────────┐
                            └──────────                      │ SMS Techsoft  │
                             Parent                          └───────────────┘
```

### 2.2 Description détaillée des acteurs

#### ACTEUR 1 — MasterUser (SuperAdmin Plateforme)
- **Rôles possibles** : `SUPER_ADMIN`, `PLATFORM_ADMIN`, `SCHOOL_MANAGER`, `SUPPORT`
- **Authentification** : 3 facteurs — Mot de passe → OTP Email → TOTP (optionnel)
- **Accès** : Dashboard `/master/dashboard`
- **Restrictions** : Actions sensibles protégées par `requireMasterSensitiveAuth` + rate limiting + restriction IP
- **Responsabilités** :
  - Cycle de vie des écoles (inviter, approuver, rejeter, suspendre, réactiver, supprimer)
  - Gestion des plans d'abonnement (DISCOVERY/STANDARD/PREMIUM)
  - Consultation des logs d'audit et emails
  - Assignation d'écoles à des School Managers

#### ACTEUR 2 — Admin (Proviseur / Directeur d'établissement)
- **Rôle** : `ADMIN`
- **Authentification** : JWT standard (email + mdp)
- **Accès** : Dashboard `/admin/dashboard` (13 sections)
- **Responsabilités** :
  - Gestion complète de l'établissement
  - Création/modification/suppression utilisateurs (CRUD + import Excel)
  - Gestion des classes, matières, coefficients
  - Configuration de l'année scolaire (périodes, séquences)
  - Génération et envoi des bulletins
  - Publication de l'emploi du temps (validation finale)
  - Gestion financière (plans de frais, factures, paiements Mobile Money)
  - Validation finale des recommandations d'orientation
  - Configuration des paramètres de l'école

#### ACTEUR 3 — Staff (Personnel d'encadrement)
- **Rôle** : `STAFF`
- **Sous-types selon permissions** :
  - **Censeur** : MANAGE_TIMETABLE, VALIDATE_GRADES, MANAGE_CLASS_COUNCIL
  - **Intendant** : MANAGE_FINANCE, VALIDATE_PAYMENTS, GENERATE_REPORTS
  - **Documentaliste** : MANAGE_LIBRARY
  - **Conseiller d'orientation** : MANAGE_ORIENTATION
  - **Chef de département** : VIEW_DEPARTMENT_GRADES, SUPERVISE_DEPARTMENT_TEACHERS, VALIDATE_DEPARTMENT_TIMETABLE
  - **Animateur Pédagogique (AP)** : GENERATE_PEDAGOGICAL_REPORTS, MANAGE_CE_REPORTS, volume horaire ≤ 14h/semaine
- **28 permissions disponibles** :
  `MANAGE_TIMETABLE`, `VALIDATE_GRADES`, `MANAGE_EXAMS`, `SUPERVISE_TEACHERS`,
  `MANAGE_ATTENDANCE`, `MANAGE_DISCIPLINE`, `MANAGE_INCIDENTS`, `MANAGE_FINANCE`,
  `VALIDATE_PAYMENTS`, `GENERATE_REPORTS`, `MANAGE_ATELIERS`, `MANAGE_PRACTICAL_GRADES`,
  `MANAGE_INTERNSHIPS`, `MANAGE_STAGE_CONVENTIONS`, `MANAGE_WORKSHOP_STOCK`,
  `VIEW_DEPARTMENT_GRADES`, `SUPERVISE_DEPARTMENT_TEACHERS`, `VALIDATE_DEPARTMENT_TIMETABLE`,
  `GENERATE_DEPARTMENT_REPORTS`, `VIEW_SUPERVISED_GRADES`, `SUPERVISE_LESSON_PLANS`,
  `GENERATE_PEDAGOGICAL_REPORTS`, `MANAGE_CE_REPORTS`, `MANAGE_PEDAGOGICAL_BRIEF`,
  `MANAGE_CLASS_COUNCIL`, `MANAGE_CATCHUP_REQUESTS`, `MANAGE_PATRIMOINE`,
  `MANAGE_DEGRADATIONS`, `MANAGE_LIBRARY`, `MANAGE_ORIENTATION`
- **Mapping permissions → sections visibles** :
  - MANAGE_TIMETABLE → grille-horaire, affectations, timetable
  - VALIDATE_GRADES → grades
  - MANAGE_ATTENDANCE → attendance
  - MANAGE_CLASS_COUNCIL → council
  - MANAGE_FINANCE / VALIDATE_PAYMENTS → finance, cautions
  - MANAGE_DISCIPLINE → discipline
  - MANAGE_LIBRARY → library
  - MANAGE_ORIENTATION → orientation

#### ACTEUR 4 — Teacher (Enseignant)
- **Rôle** : `TEACHER`
- **Accès** : Dashboard `/teacher/dashboard`
- **Contraintes** : Si `supervisedSubjectIds.length > 0` → Animateur Pédagogique → max 14h/semaine EDT
- **Responsabilités** :
  - Saisir et soumettre les notes (DS1, DS2, Composition)
  - Prendre les présences des élèves
  - Consulter son emploi du temps
  - Formuler des demandes de cours de rattrapage

#### ACTEUR 5 — Student (Élève)
- **Rôle** : `STUDENT`
- **Accès** : Dashboard `/student/dashboard`
- **Responsabilités** :
  - Consulter ses notes, bulletins, emploi du temps, présences
  - Passer des examens en ligne

#### ACTEUR 6 — Parent
- **Rôle** : `PARENT`
- **Accès** : Dashboard `/parent/dashboard`
- **Isolation** : Accès uniquement aux données de ses propres enfants (vérification `ParentStudent`)
- **Responsabilités** :
  - Suivre les résultats et présences de ses enfants
  - Payer les frais scolaires (MTN MoMo / Orange Money)
  - Consulter les bulletins
  - Recevoir des notifications SMS (absences, paiements, bulletins)

---

## 3. DIAGRAMME DE CAS D'UTILISATION

### 3.1 Cas d'utilisation du MasterUser

```
MasterUser
│
├── UC01 : Se connecter (3 facteurs : mdp + OTP email + TOTP)
├── UC02 : Gérer MFA (setup, activer, désactiver, codes récupération)
├── UC03 : Changer mot de passe (avec OTP email)
├── UC04 : Inviter une école (email d'invitation + SchoolInvite)
├── UC05 : Approuver une école (PENDING → APPROVED)
├── UC06 : Rejeter une école (avec motif)
├── UC07 : Suspendre une école (blocage accès)
├── UC08 : Réactiver une école (SUSPENDED → ACTIVE)
├── UC09 : Supprimer une école (suppression en cascade)
├── UC10 : Annuler une approbation (APPROVED → PENDING)
├── UC11 : Réexaminer un dossier rejeté (REJECTED → PENDING)
├── UC12 : Changer le plan d'abonnement (DISCOVERY/STANDARD/PREMIUM)
├── UC13 : Renvoyer une invitation d'école
├── UC14 : Synchroniser les matières d'un template
├── UC15 : Consulter les logs d'audit
├── UC16 : Consulter les logs d'emails
└── UC17 : Consulter la liste des écoles (filtres par statut)
```

### 3.2 Cas d'utilisation de l'Admin

```
Admin
│
├── [Gestion Compte]
│   ├── UC18 : Se connecter
│   └── UC19 : Se déconnecter
│
├── [Configuration Initiale]
│   ├── UC20 : Compléter l'onboarding (formulaire 4 étapes)
│   └── UC21 : Activer l'établissement (crée toute la structure automatiquement)
│
├── [Utilisateurs]
│   ├── UC22 : Créer un utilisateur (enseignant/élève/parent/staff)
│   ├── UC23 : Importer des utilisateurs depuis Excel
│   ├── UC24 : Modifier un utilisateur
│   ├── UC25 : Supprimer un utilisateur
│   ├── UC26 : Inviter un utilisateur par email
│   ├── UC27 : Transférer un élève vers un autre établissement
│   └── UC28 : Désigner un Animateur Pédagogique (AP)
│
├── [Classes]
│   ├── UC29 : Créer une classe
│   ├── UC30 : Modifier une classe
│   ├── UC31 : Supprimer une classe
│   ├── UC32 : Assigner un Professeur Principal
│   ├── UC33 : Créer un sous-groupe TP/LV2
│   └── UC34 : Affecter des élèves à un sous-groupe
│
├── [Matières]
│   ├── UC35 : Créer une matière
│   ├── UC36 : Modifier une matière
│   ├── UC37 : Assigner/retirer une matière d'un enseignant
│   └── UC38 : Définir les coefficients par série BAC
│
├── [Affectations Pédagogiques]
│   └── UC39 : Affecter un enseignant à une matière dans une classe
│
├── [Année Scolaire]
│   ├── UC40 : Créer une année scolaire (avec trimestres et séquences)
│   ├── UC41 : Définir le trimestre courant
│   ├── UC42 : Définir la séquence courante
│   ├── UC43 : Mettre à jour le calendrier (vacances, dates)
│   ├── UC44 : Vérifier les prérequis de clôture
│   └── UC45 : Clôturer l'année scolaire (promotion automatique des élèves)
│
├── [Emploi du Temps]
│   ├── UC46 : Configurer la grille horaire
│   ├── UC47 : Générer le squelette EDT d'une classe
│   └── UC48 : Publier l'emploi du temps (DRAFT → PUBLISHED)
│
├── [Notes]
│   ├── UC49 : Valider une note soumise
│   ├── UC50 : Rejeter une note (avec motif)
│   └── UC51 : Valider toutes les notes en bloc
│
├── [Bulletins]
│   ├── UC52 : Générer les bulletins d'une classe (PDF)
│   ├── UC53 : Envoyer les bulletins aux parents (email + SMS)
│   └── UC54 : Exporter les bulletins en ZIP
│
├── [Finance]
│   ├── UC55 : Créer un plan de frais
│   ├── UC56 : Générer une facture (individuelle)
│   ├── UC57 : Générer des factures en masse (par classe)
│   ├── UC58 : Initier un paiement Mobile Money (MTN/Orange)
│   ├── UC59 : Rembourser une caution
│   └── UC60 : Enregistrer une dépense
│
├── [Conseil de Classe]
│   ├── UC61 : Créer une session de conseil
│   ├── UC62 : Ajouter des décisions (PASS/REPEAT/DELIBERATION)
│   ├── UC63 : Valider des décisions en bloc
│   └── UC64 : Verrouiller la session
│
├── [Orientation]
│   └── UC65 : Valider une recommandation de série
│
├── [Paramètres]
│   ├── UC66 : Modifier le profil de l'école
│   ├── UC67 : Mettre à jour le logo
│   ├── UC68 : Modifier les paramètres (timezone, locale, notifications)
│   └── UC69 : Configurer le sous-domaine de l'établissement
│
└── [IA]
    ├── UC70 : Consulter la santé scolaire des élèves
    └── UC71 : Générer une analyse IA
```

### 3.3 Cas d'utilisation du Staff

```
Staff (selon permissions)
│
├── [Censeur — MANAGE_TIMETABLE]
│   ├── UC72 : Configurer la grille horaire
│   ├── UC73 : Gérer les affectations pédagogiques
│   ├── UC74 : Remplir l'emploi du temps case par case
│   └── UC75 : Vérifier les conflits d'enseignant
│
├── [Censeur — VALIDATE_GRADES]
│   ├── UC76 : Valider les notes soumises
│   └── UC77 : Rejeter des notes avec motif
│
├── [Censeur — MANAGE_CLASS_COUNCIL]
│   ├── UC78 : Présider un conseil de classe
│   ├── UC79 : Enregistrer les décisions par élève
│   ├── UC80 : Valider les décisions en bloc
│   └── UC81 : Verrouiller la session
│
├── [Responsable Présences — MANAGE_ATTENDANCE]
│   ├── UC82 : Enregistrer les absences et retards
│   └── UC83 : Justifier une absence
│
├── [Intendant — MANAGE_FINANCE]
│   ├── UC84 : Créer des factures
│   ├── UC85 : Enregistrer un paiement Mobile Money
│   ├── UC86 : Gérer les cautions (rembourser)
│   └── UC87 : Enregistrer une dépense
│
├── [Disciplinaire — MANAGE_DISCIPLINE]
│   ├── UC88 : Créer une sanction disciplinaire
│   └── UC89 : Lever une sanction
│
├── [Documentaliste — MANAGE_LIBRARY]
│   ├── UC90 : Gérer le catalogue (CRUD livres)
│   ├── UC91 : Enregistrer un emprunt
│   └── UC92 : Enregistrer un retour
│
├── [Conseiller d'orientation — MANAGE_ORIENTATION]
│   ├── UC93 : Créer une fiche d'orientation
│   ├── UC94 : Planifier et réaliser des entretiens
│   ├── UC95 : Administrer des tests d'aptitude
│   ├── UC96 : Proposer une recommandation de série
│   └── UC97 : Ajouter un suivi
│
└── [Tout Staff — GENERATE_REPORTS]
    ├── UC98 : Générer les bulletins d'une classe
    └── UC99 : Exporter les bulletins en ZIP
```

### 3.4 Cas d'utilisation de l'Enseignant

```
Teacher
│
├── UC100 : Saisir une note (DS1/DS2/Composition)
├── UC101 : Saisir des notes en masse (brouillon)
├── UC102 : Soumettre des notes pour validation
├── UC103 : Modifier une note (avant soumission)
├── UC104 : Prendre les présences d'une classe
├── UC105 : Justifier une absence
├── UC106 : Consulter son emploi du temps
├── UC107 : Consulter ses classes
└── UC108 : Faire une demande de cours de rattrapage
```

### 3.5 Cas d'utilisation de l'Élève

```
Student
│
├── UC109 : Consulter ses notes par séquence
├── UC110 : Consulter ses bulletins
├── UC111 : Télécharger un bulletin en PDF
├── UC112 : Consulter ses présences/absences
├── UC113 : Consulter son emploi du temps
└── UC114 : Passer un examen en ligne
```

### 3.6 Cas d'utilisation du Parent

```
Parent
│
├── UC115 : Consulter la liste de ses enfants
├── UC116 : Consulter les notes d'un enfant
├── UC117 : Consulter les présences d'un enfant
├── UC118 : Consulter le bulletin d'un enfant
├── UC119 : Consulter l'emploi du temps d'un enfant
├── UC120 : Consulter les factures impayées
├── UC121 : Payer des frais scolaires (MTN MoMo / Orange Money)
└── UC122 : Recevoir des notifications SMS (absences, bulletins, paiements)
```

---

## 4. MODÈLES DE DONNÉES — DIAGRAMME DE CLASSES

### 4.1 Entités principales et leurs relations

```
MasterUser
├── id : String (PK)
├── email : String (unique)
├── passwordHash : String
├── name : String
├── role : MasterUserRole
├── assignedSchoolIds : String[]
├── isActive : Boolean
├── isSuperAdmin : Boolean
├── mfaEnabled : Boolean
├── mfaSecret : String?
├── loginEmailOtpHash : String?
├── loginEmailOtpExpiresAt : DateTime?
├── loginEmailOtpAttempts : Int
└── Relations :
    ├── auditLogs : MasterAuthAudit[]
    └── schoolInvites : SchoolInvite[]

SchoolInvite
├── id : String (PK)
├── email : String
├── schoolName : String
├── token : String (unique)
├── plan : PlanType
├── status : InviteStatus
├── expiresAt : DateTime
├── schoolId : String? (FK → School)
├── invitedByMasterId : String (FK → MasterUser)
└── notes : String?

School
├── id : String (PK)
├── name : String
├── subdomain : String (unique)
├── type : SchoolType
├── plan : PlanType
├── status : SchoolStatus
├── city : String
├── region : String
├── address : String?
├── phone : String?
├── email : String?
├── logoUrl : String?
├── subsystem : SchoolSubsystem
├── educationType : EducationType
├── ownership : SchoolOwnership
├── features : Json
├── saturdaySchedule : Boolean
├── contractEnd : DateTime?
├── templateCode : String?
├── onboardingConfig : Json?
└── Relations :
    ├── users : User[]
    ├── classes : Class[]
    ├── subjects : Subject[]
    ├── academicYears : AcademicYear[]
    ├── sections : Section[]
    ├── schoolConfig : SchoolConfig?
    ├── schoolSettings : SchoolSettings?
    ├── timetables : Timetable[]
    ├── timetableGridConfig : TimetableGridConfig?
    ├── feePlans : FeePlan[]
    ├── invoices : Invoice[]
    ├── reportCards : ReportCard[]
    ├── attendance : Attendance[]
    ├── grades : Grade[]
    ├── classCouncilSessions : ClassCouncilSession[]
    ├── disciplineRecords : DisciplineRecord[]
    ├── orientationFiches : FicheOrientation[]
    ├── books : Book[]
    └── announcements : Announcement[]

SchoolConfig
├── id : String (PK)
├── schoolId : String (unique, FK → School)
├── ds1Weight : Float (1)
├── ds2Weight : Float (1)
├── compositionWeight : Float (2)
├── classTestWeight : Float?
├── terminalExamWeight : Float?
├── moderatorUserId : String?
├── aiRiskThreshold : Float (0.7)
├── bulletinTemplate : BulletinTemplate
├── gradesPerTerm : Int (2)
├── sequenceCalculationMode : String
├── legalMaxContributionFirstCycle : Float (7500)
├── legalMaxContributionSecondCycle : Float (10000)
├── termsPerYear : Int (3)
├── maxAbsences : Int (15)
├── smsEnabled : Boolean
├── offlineModeEnabled : Boolean
├── aiAlertsEnabled : Boolean
├── messageModeration : Boolean
├── schoolLanguageMode : SectionLanguage (FR)
├── attendanceLateAsAbsence : Boolean
├── bulletinBlockOnUnpaidFees : Boolean
├── councilPassMark : Float (10)
├── passMark : Float (10)
└── absenceAlertThreshold : Int (3)

User
├── id : String (PK)
├── schoolId : String (FK → School)
├── role : UserRole
├── email : String?
├── phone : String?
├── passwordHash : String
├── firstName : String
├── lastName : String
├── avatarUrl : String?
├── isActive : Boolean
├── refreshTokenVersion : Int (0)
├── lastLogin : DateTime?
├── Contraintes : unique(schoolId, email), unique(schoolId, phone)
└── Relations :
    ├── studentProfile : StudentProfile?
    ├── teacherProfile : TeacherProfile?
    ├── parentProfile : ParentProfile?
    ├── staffProfile : StaffProfile?
    ├── timetableSlots : TimetableSlot[] (as teacher)
    ├── teachingAssignments : TeachingAssignment[]
    ├── grades : Grade[]
    ├── attendances : Attendance[]
    ├── messages : Message[]
    └── bookLoans : BookLoan[]

StudentProfile
├── id : String (PK)
├── userId : String (unique, FK → User)
├── matricule : String?
├── dateOfBirth : DateTime?
├── gender : String?
├── classId : String? (FK → Class)
├── exitYear : Int?
├── studentStatus : StudentStatus
├── healthScore : Float?
└── Relations :
    ├── class : Class?
    ├── parents : ParentStudent[]
    └── subGroupAssignments : StudentSubGroupAssignment[]

TeacherProfile
├── id : String (PK)
├── userId : String (unique, FK → User)
├── specialization : String[]
├── supervisedSubjectIds : String[] (non vide = Animateur Pédagogique)
└── Relations :
    └── teacherSubjects : TeacherSubject[]

ParentProfile
├── id : String (PK)
└── userId : String (unique, FK → User)

ParentStudent  [TABLE PIVOT]
├── parentProfileId : String (FK → ParentProfile)
└── studentProfileId : String (FK → StudentProfile)
    Contrainte : unique(parentProfileId, studentProfileId)

StaffProfile
├── id : String (PK)
├── schoolId : String (FK → School)
├── userId : String (unique, FK → User)
├── title : String?
└── sectionId : String? (FK → Section)

StaffPermission
├── id : String (PK)
├── staffProfileId : String (FK → StaffProfile)
├── permission : StaffPermissionType
└── Contrainte : unique(staffProfileId, permission)

Section
├── id : String (PK)
├── schoolId : String (FK → School)
├── name : String
├── code : SectionLanguage (FR/EN)
├── gradingSystem : GradingSystem
├── isActive : Boolean
└── passmark : Float (10)

Class
├── id : String (PK)
├── schoolId : String (FK → School)
├── name : String
├── level : String?
├── sectionId : String? (FK → Section)
├── capacity : Int?
├── filiere : String?
├── serie : String?
├── professorPrincipalId : String? (FK → User)
└── Relations :
    ├── students : StudentProfile[]
    ├── subGroups : ClassSubGroup[]
    ├── timetables : Timetable[]
    ├── grades : Grade[]
    ├── teachingAssignments : TeachingAssignment[]
    └── councilSessions : ClassCouncilSession[]

Subject
├── id : String (PK)
├── schoolId : String (FK → School)
├── name : String
├── code : String?
├── coefficient : Float (1)
├── hoursPerWeek : Int?
├── subjectType : SubjectType
└── Relations :
    ├── grades : Grade[]
    ├── teacherSubjects : TeacherSubject[]
    ├── timetableSlots : TimetableSlot[]
    ├── teachingAssignments : TeachingAssignment[]
    └── subjectCoefficients : SubjectCoefficient[]

TeacherSubject  [TABLE PIVOT]
├── id : String (PK)
├── teacherProfileId : String (FK → TeacherProfile)
└── subjectId : String (FK → Subject)
    Contrainte : unique(teacherProfileId, subjectId)

TeachingAssignment
├── id : String (PK)
├── classId : String (FK → Class)
├── subjectId : String (FK → Subject)
├── teacherId : String (FK → User)
├── schoolId : String
└── Contrainte : unique(classId, subjectId)

SubjectCoefficient
├── id : String (PK)
├── schoolId : String (FK → School)
├── subjectId : String (FK → Subject)
├── classLevel : String
├── serieCode : String?
├── coefficient : Float
└── Contrainte : unique(schoolId, subjectId, classLevel, serieCode)

BacCoefficient
├── id : String (PK)
├── subjectName : String
├── serie : String
├── niveau : String
├── coefficient : Float
├── groupe : String?
├── source : String
└── isOfficialMinesec : Boolean

AcademicYear
├── id : String (PK)
├── schoolId : String (FK → School)
├── name : String
├── startDate : DateTime
├── endDate : DateTime
├── isCurrent : Boolean
└── status : AcademicYearStatus
└── Relations :
    ├── periods : AcademicPeriod[]
    ├── timetables : Timetable[]
    └── studentPromotions : StudentPromotion[]

AcademicPeriod
├── id : String (PK)
├── academicYearId : String (FK → AcademicYear)
├── name : String
├── type : PeriodType
├── orderIndex : Int
├── startDate : DateTime
├── endDate : DateTime
└── isCurrent : Boolean
└── Relations :
    ├── sequences : AcademicSequence[]
    ├── attendances : Attendance[]
    └── classCouncilSessions : ClassCouncilSession[]

AcademicSequence
├── id : String (PK)
├── academicPeriodId : String (FK → AcademicPeriod)
├── schoolId : String
├── name : String
├── type : SequenceType
├── orderIndex : Int
├── startDate : DateTime?
├── endDate : DateTime?
├── isCurrent : Boolean
└── Contrainte : unique(academicPeriodId, orderIndex)

Grade
├── id : String (PK)
├── schoolId : String (FK → School)
├── studentId : String (FK → User)
├── subjectId : String (FK → Subject)
├── classId : String (FK → Class)
├── academicYearId : String (FK → AcademicYear)
├── sequenceId : String (FK → AcademicSequence)
├── sequenceScore : Float?
├── classTestScore : Float?
├── terminalExamScore : Float?
├── theoreticalScore : Float?
├── practicalScore : Float?
├── professionalAttitude : Float?
├── oralScore : Float?
├── selfDevelopmentScore : Float?
├── coefficient : Float
├── maxValue : Float (20)
├── sequenceAverage : Float?
├── validationStatus : GradeValidationStatus
├── validatedById : String? (FK → User)
├── validatedAt : DateTime?
├── rejectionReason : String?
├── isOfflineSync : Boolean
└── Contrainte : unique(studentId, subjectId, sequenceId)

Attendance
├── id : String (PK)
├── schoolId : String (FK → School)
├── studentId : String (FK → User)
├── classId : String (FK → Class)
├── academicPeriodId : String (FK → AcademicPeriod)
├── date : DateTime
├── status : AttendanceStatus
├── period : AttendancePeriod
├── recordedById : String (FK → User)
├── subjectId : String? (FK → Subject)
├── teacherId : String? (FK → User)
├── isOfflineSync : Boolean
└── syncedAt : DateTime?

ReportCard
├── id : String (PK)
├── schoolId : String (FK → School)
├── studentId : String (FK → User)
├── academicYearId : String (FK → AcademicYear)
├── academicPeriodId : String (FK → AcademicPeriod)
├── generalAverage : Float?
├── rank : Int?
├── mention : String?
├── isGenerated : Boolean
├── pdfUrl : String?
├── absenceCount : Int (0)
├── aiComment : String?
├── classMasterComment : String?
├── conductGrade : Float?
├── template : BulletinTemplate
├── totalStudents : Int?
├── validationStatus : ReportCardStatus
├── sectionId : String? (FK → Section)
└── Contrainte : unique(studentId, academicPeriodId)
└── Relations :
    └── subjectLines : ReportCardSubjectLine[]

ReportCardSubjectLine
├── id : String (PK)
├── reportCardId : String (FK → ReportCard)
├── subjectId : String (FK → Subject)
├── subjectName : String
├── coefficient : Float
├── seq1Score → seq6Score : Float?
├── compositionScore : Float?
├── theoreticalScore : Float?
├── practicalScore : Float?
├── professionalAttitude : Float?
├── oralScore : Float?
├── selfDevelopmentScore : Float?
├── subjectAverage : Float?
├── weightedScore : Float?
├── subjectRank : Int?
├── teacherComment : String?
└── competenceLabel : String?

Timetable
├── id : String (PK)
├── schoolId : String (FK → School)
├── classId : String (FK → Class)
├── academicYearId : String (FK → AcademicYear)
├── status : TimetableStatus
├── generatedByAI : Boolean
└── Contrainte : unique(schoolId, classId, academicYearId)
└── Relations :
    └── slots : TimetableSlot[]

TimetableSlot
├── id : String (PK)
├── timetableId : String (FK → Timetable)
├── subjectId : String? (FK → Subject)
├── teacherId : String? (FK → User)
├── dayOfWeek : Int (1=Lundi…6=Samedi)
├── startTime : String (HH:MM)
├── endTime : String (HH:MM)
├── room : String?
├── kind : SlotKind
└── subGroupId : String? (FK → ClassSubGroup)

TimetableGridConfig
├── id : String (PK)
├── schoolId : String (unique, FK → School)
├── heureDebut : String (HH:MM)
├── dureePeriode : Int (minutes)
├── periodesAvantP1 : Int
├── dureePetitePause : Int
├── periodesAvantP2 : Int
├── dureeGrandePause : Int
├── periodesApresP2 : Int
└── joursActifs : String[]

FeePlan
├── id : String (PK)
├── schoolId : String (FK → School)
├── sectionId : String? (FK → Section)
├── name : String
├── amount : Float
├── currency : String (XAF)
├── feeType : FeeType
├── level : String?
├── isRefundable : Boolean
└── dueDate : DateTime?

Invoice
├── id : String (PK)
├── schoolId : String (FK → School)
├── studentId : String (FK → User)
├── feePlanId : String (FK → FeePlan)
├── amount : Float
├── currency : String
├── dueDate : DateTime?
└── status : InvoiceStatus
└── Relations :
    └── payments : Payment[]

Payment
├── id : String (PK)
├── schoolId : String (FK → School)
├── invoiceId : String (FK → Invoice)
├── studentId : String (FK → User)
├── amount : Float
├── method : PaymentMethod
├── status : PaymentStatus
├── campayRef : String?
├── campayStatus : String?
├── operatorRef : String?
├── phoneNumber : String?
├── webhookData : Json?
└── cautionStatus : CautionStatus?

Expense
├── id : String (PK)
├── schoolId : String (FK → School)
├── label : String
├── amount : Float
├── currency : String
├── category : String
├── date : DateTime
└── createdById : String (FK → User)

ClassCouncilSession
├── id : String (PK)
├── schoolId : String (FK → School)
├── classId : String (FK → Class)
├── academicPeriodId : String (FK → AcademicPeriod)
├── presidedById : String (FK → User)
├── status : CouncilStatus
└── validatedAt : DateTime?
└── Relations :
    └── decisions : ClassCouncilDecision[]

ClassCouncilDecision
├── id : String (PK)
├── sessionId : String (FK → ClassCouncilSession)
├── studentId : String (FK → User)
├── decision : CouncilDecision
└── observations : String?

DisciplineRecord
├── id : String (PK)
├── schoolId : String (FK → School)
├── studentId : String (FK → User)
├── type : DisciplineType
├── reason : String
├── decidedById : String (FK → User)
├── startDate : DateTime
├── endDate : DateTime?
└── status : DisciplineStatus

FicheOrientation
├── id : String (PK)
├── studentId : String (FK → User)
├── schoolId : String (FK → School)
├── academicYearId : String (FK → AcademicYear)
├── conseillerId : String (FK → User)
├── status : OrientationStatus
├── riskLevel : NiveauRisque
└── mainConcern : TypePreoccupation?
└── Relations :
    ├── entretiens : EntretienOrientation[]
    ├── tests : TestAptitude[]
    ├── recommandation : RecommandationSerie?
    └── suivis : SuiviOrientation[]

EntretienOrientation
├── id : String (PK)
├── ficheOrientationId : String (FK → FicheOrientation)
├── date : DateTime
├── type : TypeEntretien
├── motif : MotifEntretien
└── status : StatutEntretien

TestAptitude
├── id : String (PK)
├── ficheOrientationId : String (FK → FicheOrientation)
├── type : TypeTest
├── datePassage : DateTime
├── resultats : Json?
└── scoreGlobal : Float?

RecommandationSerie
├── id : String (PK)
├── ficheOrientationId : String (unique, FK → FicheOrientation)
├── studentId : String (FK → User)
├── serieActuelle : String
├── serieRecommandee : String
├── justification : String?
└── status : StatutRecommandation

Book
├── id : String (PK)
├── schoolId : String (FK → School)
├── title : String
├── author : String?
├── isbn : String?
├── quantity : Int
├── available : Int
└── category : String?

BookLoan
├── id : String (PK)
├── schoolId : String (FK → School)
├── bookId : String (FK → Book)
├── studentId : String (FK → User)
├── borrowedAt : DateTime
├── dueDate : DateTime?
├── returnedAt : DateTime?
└── status : LoanStatus

ClassSubGroup
├── id : String (PK)
├── classId : String (FK → Class)
└── name : String

StudentSubGroupAssignment  [PIVOT]
├── studentProfileId : String (FK → StudentProfile)
└── subGroupId : String (FK → ClassSubGroup)

ClassPromotion
├── id : String (PK)
├── schoolId : String (FK → School)
├── fromClassId : String (FK → Class)
├── toClassId : String (FK → Class)
└── academicYearId : String (FK → AcademicYear)

StudentPromotion
├── id : String (PK)
├── schoolId : String (FK → School)
├── studentId : String (FK → User)
├── fromClassId : String (FK → Class)
├── toClassId : String (FK → Class)
├── academicYearId : String (FK → AcademicYear)
├── promotedById : String (FK → User)
└── promotedAt : DateTime

Notification
├── id : String (PK)
├── schoolId : String (FK → School)
├── userId : String (FK → User)
├── type : NotificationType
├── title : String
├── body : String
├── metadata : Json?
├── isRead : Boolean
└── channel : NotificationChannel

Announcement
├── id : String (PK)
├── schoolId : String (FK → School)
├── title : String
├── content : String
├── targetRoles : UserRole[]
├── isPinned : Boolean
├── authorId : String (FK → User)
└── expiresAt : DateTime?

OfflineQueue
├── id : String (PK)
├── schoolId : String (FK → School)
├── userId : String (FK → User)
├── entityType : String
├── entityData : Json
├── status : SyncStatus
├── conflictReason : String?
└── syncedAt : DateTime?

SmsLog
├── id : String (PK)
├── schoolId : String (FK → School)
├── recipientPhone : String
├── recipientId : String? (FK → User)
├── message : String
├── status : SmsStatus
├── provider : String (TECHSOFT)
├── providerRef : String?
└── sentAt : DateTime

SchoolTemplate
├── id : String (PK)
├── code : String (unique)
├── name : String
├── subsystem : SchoolSubsystem
├── educationType : EducationType
├── level : SchoolLevel
├── ownership : SchoolOwnership
└── config : Json
```

### 4.2 Relations clés entre entités (synthèse)

| Relation | Type | Description |
|----------|------|-------------|
| School → User | 1..* | Un établissement possède plusieurs utilisateurs |
| User → StudentProfile | 1..0..1 | Un élève a exactement un profil élève |
| User → TeacherProfile | 1..0..1 | Un enseignant a exactement un profil enseignant |
| User → ParentProfile | 1..0..1 | Un parent a un profil parent |
| User → StaffProfile | 1..0..1 | Un staff a un profil avec permissions |
| ParentProfile ↔ StudentProfile | M..N | Via ParentStudent (plusieurs enfants, plusieurs parents) |
| Class → StudentProfile | 1..* | Une classe contient plusieurs élèves |
| TeacherProfile ↔ Subject | M..N | Via TeacherSubject (matières enseignées) |
| TeachingAssignment | 1 | Exactement un enseignant par matière par classe |
| AcademicYear → AcademicPeriod | 1..3 | 3 trimestres par année |
| AcademicPeriod → AcademicSequence | 1..2 | 2 séquences par trimestre (DS1, DS2) |
| Grade | unique(student, subject, sequence) | Une note par élève par matière par séquence |
| Timetable | unique(school, class, year) | Un EDT par classe par année |
| ReportCard | unique(student, period) | Un bulletin par élève par trimestre |
| Invoice → Payment | 1..* | Une facture peut avoir plusieurs paiements partiels |
| FicheOrientation → RecommandationSerie | 1..0..1 | Au plus une recommandation par fiche |

---

## 5. ENUMS ET TYPES

### Tableau complet des enums

| Enum | Valeurs |
|------|---------|
| **MasterUserRole** | SUPER_ADMIN, PLATFORM_ADMIN, SCHOOL_MANAGER, SUPPORT |
| **UserRole** | ADMIN, STAFF, TEACHER, PARENT, STUDENT |
| **SchoolType** | PRESCHOOL, PRIMARY, SECONDARY, MULTI |
| **PlanType** | DISCOVERY, STANDARD, PREMIUM |
| **SchoolStatus** | DRAFT, PENDING, APPROVED, ACTIVE, REJECTED, SUSPENDED |
| **InviteStatus** | PENDING, USED, EXPIRED |
| **SchoolSubsystem** | FRANCOPHONE, ANGLOPHONE, BILINGUAL |
| **EducationType** | GENERAL, TECHNICAL, PROFESSIONAL, MIXED |
| **SchoolOwnership** | PUBLIC, PRIVATE_SECULAR, PRIVATE_FAITH |
| **SectionLanguage** | FR, EN |
| **GradingSystem** | OUT_OF_20, OUT_OF_100 |
| **AcademicYearStatus** | ACTIVE, ARCHIVED |
| **PeriodType** | TRIMESTER, TERM |
| **SequenceType** | DS, COMPOSITION, CLASS_TEST, TERMINAL_EXAM |
| **GradeValidationStatus** | DRAFT, SUBMITTED, VALIDATED, LOCKED, REJECTED |
| **ReportCardStatus** | DRAFT, GENERATED, SENT |
| **BulletinTemplate** | FR_SECONDARY, EN_SECONDARY, TECHNICAL_FR, PRIMARY, ANNUAL, MONTHLY |
| **SubjectType** | THEORETICAL, PRACTICAL, MIXED |
| **StudentStatus** | ACTIVE, GRADUATED, LEFT, TRANSFERRED |
| **FeeType** | TUITION, APEE_PTA, EXAM, UNIFORM, CAUTION, WORKSHOP, INSCRIPTION, DEVELOPMENT_LEVY, SPORTS_LEVY |
| **PaymentMethod** | CASH, MTN_MOMO, ORANGE_MONEY, BANK_TRANSFER, EXPRESS_UNION |
| **PaymentStatus** | PENDING, SUCCESS, FAILED, REFUNDED |
| **InvoiceStatus** | PENDING, PARTIAL, PAID, OVERDUE, CANCELLED |
| **CautionStatus** | HELD, REFUNDED, PERMANENTLY_HELD |
| **TimetableStatus** | DRAFT, PUBLISHED |
| **SlotKind** | CLASS, BREAK, ACTIVITY, TD |
| **AttendancePeriod** | MORNING, AFTERNOON |
| **AttendanceStatus** | PRESENT, ABSENT, LATE |
| **DisciplineType** | WARNING_ORAL, WARNING_WRITTEN, TEMP_EXCLUSION, COUNCIL_DECISION, PERMANENT_EXCLUSION |
| **DisciplineStatus** | ACTIVE, LIFTED, APPEALED |
| **CouncilStatus** | OPEN, VALIDATED, LOCKED |
| **CouncilDecision** | PASS, REPEAT, DELIBERATION |
| **SyncStatus** | PENDING, SYNCED, CONFLICT, REJECTED |
| **NotificationType** | ACADEMIC, ATTENDANCE, COMMUNICATION, FINANCIAL, AI_ALERT, POSITIVE, SYSTEM |
| **NotificationChannel** | PUSH, SMS, EMAIL, IN_APP |
| **OrientationStatus** | OUVERTE, EN_COURS, CLOSE, TRANSFEREE |
| **NiveauRisque** | FAIBLE, MOYEN, ELEVE, CRITIQUE |
| **TypePreoccupation** | SCOLAIRE, COMPORTEMENTAL, FAMILIAL, PROFESSIONNEL, SANTE, AUTRE |
| **TypeEntretien** | INDIVIDUEL, GROUPE, AVEC_PARENT |
| **MotifEntretien** | ORIENTATION_GENERALE, DIFFICULTE_SCOLAIRE, CHOIX_FILIERE_BAC, PROJET_PROFESSIONNEL, PROBLEME_COMPORTEMENT, DEMANDE_ELEVE, DEMANDE_PARENT, DEMANDE_ENSEIGNANT |
| **StatutEntretien** | PLANIFIE, REALISE, ANNULE, REPORTE |
| **TypeTest** | COGNITIF, INTERETS_PROFESSIONNELS, PERSONNALITE, PSYCHOTECHNIQUE |
| **StatutRecommandation** | PROPOSEE, VALIDEE_ADMIN, ACCEPTEE_PARENT, REFUSEE_PARENT, TRANSMISE_DRES |
| **LoanStatus** | ACTIVE, RETURNED, OVERDUE |
| **SmsStatus** | PENDING, SENT, FAILED, DELIVERED |

---

## 6. DIAGRAMMES DE SÉQUENCE — FLUX MÉTIER

### Flux 1 : Inscription et activation d'une école

```
MasterUser          System           Admin           École(School)
    │                  │                │                  │
    │ Inviter école    │                │                  │
    │─────────────────>│                │                  │
    │ POST /master/schools/invite       │                  │
    │                  │ SchoolInvite créé                 │
    │                  │────────────────────────────────>  │
    │                  │ Email envoyé →│                   │
    │                  │──────────────>│                   │
    │                  │                │ Reçoit lien       │
    │                  │                │ /onboarding/[tok] │
    │                  │                │ Étape 1 : Infos école
    │                  │                │ Étape 2 : Compte admin
    │                  │                │ Étape 3 : Structure
    │                  │                │ Étape 4 : Soumission
    │                  │<───────────────│                   │
    │                  │ POST /onboarding/:token/complete   │
    │                  │ School(PENDING) créée              │
    │                  │────────────────────────────────>  │
    │                  │                │                   │
    │ Voir école PENDING               │                   │
    │<─────────────────│                │                   │
    │ POST /master/schools/:id/approve  │                   │
    │─────────────────>│                │                   │
    │                  │ School → APPROVED                  │
    │                  │────────────────────────────────>  │
    │                  │ Email → Admin  │                   │
    │                  │──────────────>│                   │
    │                  │                │ Connexion + redirection
    │                  │                │ /admin/configuration
    │                  │                │ POST /schools/:id/activate
    │                  │<───────────────│                   │
    │                  │ AcademicYear créée                │
    │                  │ Classes créées (depuis onboarding) │
    │                  │ Matières créées (depuis template)  │
    │                  │ Formules MINESEC configurées       │
    │                  │ School → ACTIVE                    │
    │                  │────────────────────────────────>  │
    │                  │ Redirection → /admin/dashboard     │
```

### Flux 2 : Workflow complet des notes

```
Teacher           Admin/Staff         System           Student
   │                  │                  │                │
   │ Saisir note      │                  │                │
   │ POST /grades     │                  │                │
   │─────────────────────────────────>  │                │
   │                  │                  │ Grade DRAFT    │
   │ Soumettre note   │                  │                │
   │ PATCH /grades/:id/submit           │                │
   │─────────────────────────────────>  │                │
   │                  │                  │ Grade SUBMITTED│
   │                  │                  │                │
   │                  │ Valider note      │                │
   │                  │ PATCH /grades/:id/validate        │
   │                  │─────────────────>│                │
   │                  │                  │ Grade VALIDATED│
   │                  │                  │                │
   │ [Si rejet]       │                  │                │
   │                  │ Rejeter + motif  │                │
   │                  │ PATCH /grades/:id/reject          │
   │                  │─────────────────>│                │
   │                  │                  │ Grade REJECTED │
   │ Notification rejet                 │                │
   │<─────────────────────────────────  │                │
   │ Corriger et resoumettre            │                │
   │─────────────────────────────────>  │                │
```

### Flux 3 : Génération et envoi des bulletins

```
Admin/Staff           System          PDF Service        Parent
    │                    │                 │                │
    │ Vérifier pré-requis│                 │                │
    │ GET /report-cards/check/:classId     │                │
    │───────────────────>│                 │                │
    │ [OK] Tous notes validées             │                │
    │<───────────────────│                 │                │
    │ Générer bulletins  │                 │                │
    │ POST /report-cards/generate          │                │
    │───────────────────>│                 │                │
    │                    │ Calculer moyennes               │
    │                    │ Calculer rangs                  │
    │                    │ Déterminer mentions MINESEC      │
    │                    │ Générer commentaire IA           │
    │                    │───────────────>│                │
    │                    │                │ PDF généré     │
    │                    │<───────────────│                │
    │                    │ ReportCard stocké (PDF URL)      │
    │ Envoyer bulletins  │                 │                │
    │ POST /report-cards/send              │                │
    │───────────────────>│                 │                │
    │                    │─────────────────────────────────>
    │                    │                 │ Email + PDF    │
    │                    │                 │ SMS notif.     │
    │                    │                 │ au parent      │
```

### Flux 4 : Paiement Mobile Money

```
Parent            Admin/Staff        CampPay         System
   │                  │                 │               │
   │ Voir factures    │                 │               │
   │ GET /parent/invoices               │               │
   │─────────────────────────────────────────────────> │
   │ [Liste factures impayées]                         │
   │<───────────────────────────────────────────────── │
   │                  │                 │               │
   │ Payer (MTN MoMo) │                 │               │
   │ POST /parent/pay │                 │               │
   │─────────────────────────────────────────────────> │
   │                  │                 │               │ Initier paiement
   │                  │                 │<──────────────│
   │                  │                 │               │
   │                  │ [Client paie sur téléphone]     │
   │                  │                 │               │
   │                  │                 │ Webhook reçu  │
   │                  │                 │───────────────>
   │                  │                 │ POST /finance/payments/webhook/campay
   │                  │                 │               │
   │                  │                 │               │ Payment → SUCCESS
   │                  │                 │               │ Invoice → PAID
   │ Notification confirmée (push + SMS)               │
   │<────────────────────────────────────────────────── │
```

### Flux 5 : Workflow Emploi du Temps (Art. 36 Décret 2001/041)

```
Admin (Config)    Staff/Censeur      System           Users
     │                 │                │               │
     │ Configurer grille               │               │
     │ POST /timetable-grid-config     │               │
     │─────────────────────────────>  │               │
     │                 │                │               │
     │                 │ Affecter enseignants           │
     │                 │ POST /teaching-assignments     │
     │                 │─────────────>  │               │
     │                 │                │               │
     │                 │ Générer squelette              │
     │                 │ POST /timetables/generate-skeleton
     │                 │─────────────>  │               │
     │                 │                │ Créneaux vides│
     │                 │ Remplir case par case          │
     │                 │ PATCH /timetables/slots/:id    │
     │                 │─────────────>  │               │
     │                 │                │ Vérif conflit │
     │                 │                │ Vérif AP 14h  │
     │                 │ [Répéter pour toutes les cases]│
     │                 │                │               │
     │ Publier EDT     │                │               │
     │ PUT /timetables/:id/publish      │               │
     │─────────────────────────────>  │               │
     │                 │                │ PUBLISHED     │
     │                 │                │───────────────>
     │                 │                │  Visible par  │
     │                 │                │  enseignants  │
     │                 │                │  élèves       │
     │                 │                │  parents      │
```

### Flux 6 : Orientation scolaire

```
Conseiller (Staff)   Admin            System         Parent
       │               │                 │               │
       │ Créer fiche   │                 │               │
       │ POST /orientation/fiches        │               │
       │─────────────────────────────> │               │
       │               │                 │ FicheOrientation(OUVERTE)
       │               │                 │               │
       │ Planifier entretien             │               │
       │ POST /fiches/:id/entretiens    │               │
       │─────────────────────────────> │               │
       │               │                 │ EntretienOrientation
       │               │                 │               │
       │ Administrer test               │               │
       │ POST /fiches/:id/tests         │               │
       │─────────────────────────────> │               │
       │               │                 │ TestAptitude  │
       │               │                 │               │
       │ Proposer série recommandée     │               │
       │ POST /fiches/:id/recommandation-serie          │
       │─────────────────────────────> │               │
       │               │                 │ RecommandationSerie(PROPOSEE)
       │               │                 │               │
       │               │ Valider recommandation         │
       │               │ PATCH /recommandations/:id/valider
       │               │─────────────> │               │
       │               │                 │ VALIDEE_ADMIN │
       │               │                 │───────────────>
       │               │                 │               │ Notifié
       │               │                 │               │ ACCEPTEE_PARENT
       │               │                 │               │ ou REFUSEE_PARENT
```

### Flux 7 : Authentification 3 facteurs (MasterUser)

```
MasterUser           Backend           Email/TOTP
    │                   │                  │
    │ POST /master/auth/login             │
    │ (email + password)│                  │
    │──────────────────>│                  │
    │                   │ Vérifier IP      │
    │                   │ Vérifier rate limit
    │                   │ Valider mdp      │
    │                   │──────────────────>
    │                   │                  │ OTP Email envoyé
    │                   │<──────────────────│
    │ Réception OTP email                  │
    │<──────────────────│                  │
    │                   │                  │
    │ POST /master/auth/verify-otp        │
    │ (code OTP 6 chiffres)               │
    │──────────────────>│                  │
    │                   │ Vérifier OTP + expiration
    │                   │ 3 tentatives max │
    │                   │                  │
    │ [Si MFA activé]   │                  │
    │ POST /master/auth/verify-mfa        │
    │ (code TOTP 6 chiffres)              │
    │──────────────────>│                  │
    │                   │ Vérifier TOTP    │
    │                   │                  │
    │ master_jwt cookie  │                 │
    │<──────────────────│                  │
    │ Accès dashboard master              │
```

### Flux 8 : Synchronisation hors-ligne

```
User (mobile)        IndexedDB          System (online)
     │                    │                   │
     │ [Perte connexion]  │                   │
     │ Indicateur Hors-ligne affiché          │
     │                    │                   │
     │ Action (note/présence)                 │
     │───────────────────>│                   │
     │                    │ Stocké localement │
     │                    │ status: PENDING    │
     │ [Connexion rétablie]                   │
     │                    │                   │
     │ Sync déclenchée   │                   │
     │───────────────────>│                   │
     │                    │ Envoyer données →  │
     │                    │───────────────────>│
     │                    │                   │ Résoudre conflits
     │                    │<───────────────────│
     │                    │ status: SYNCED     │
     │ Indicateur Online  │                   │
```

---

## 7. ARCHITECTURE TECHNIQUE — DIAGRAMME DE COMPOSANTS

### 7.1 Stack technique

| Couche | Technologie | Version |
|--------|-------------|---------|
| **Backend Runtime** | Bun | v1.x |
| **Framework Web** | Express.js | v4 |
| **ORM** | Prisma | v6.19.3 |
| **Base de données** | PostgreSQL | 15+ |
| **Auth** | JWT (HS512) | jsonwebtoken |
| **Frontend** | Next.js (App Router) | v16.2.7 |
| **React** | React | v19 |
| **Style** | Tailwind CSS | v3 |
| **Paiements** | CampPay | MTN MoMo + Orange Money |
| **IA** | Google Gemini | - |
| **Jobs async** | Inngest | - |
| **Email** | SMTP transactionnel | - |
| **SMS** | Techsoft | - |
| **Offline** | IndexedDB (navigateur) | - |

### 7.2 Architecture hexagonale (Backend)

```
backend/src/
├── domain/                        ← DOMAINE (centre)
│   ├── entities/                  ← Entités métier pures
│   ├── errors/                    ← Erreurs domaine
│   │   ├── ConflitHoraireError    ← Conflit EDT
│   │   └── VolumeHoraireAPError   ← Limite 14h AP
│   └── repositories/              ← Interfaces (ports)
│
├── application/                   ← CAS D'UTILISATION
│   ├── academicYear/             ← 5 use cases
│   ├── ai/                       ← 1 use case
│   ├── attendance/               ← 1 use case
│   ├── class/                    ← 6 use cases
│   ├── classCouncil/             ← 1 use case
│   ├── finance/                  ← 7 use cases
│   ├── grade/                    ← 5 use cases
│   ├── masterAdmin/              ← 7 use cases
│   ├── orientation/              ← 7 use cases
│   ├── parent/                   ← 2 use cases
│   ├── reportCard/               ← 2 use cases
│   ├── school/                   ← 2 use cases
│   └── user/                     ← 4 use cases
│
└── infrastructure/               ← ADAPTATEURS
    ├── config/
    │   └── hexagonal.bootstrap.ts ← Point d'entrée, IoC, routes inline
    ├── http/
    │   ├── controllers/           ← Contrôleurs HTTP
    │   └── routes/                ← Définitions de routes Express
    ├── middleware/
    │   ├── auth.ts                ← requireAuth, requireRole
    │   └── authMultiTenant.ts     ← protectMaster, sensitiveAuth
    ├── persistence/prisma/        ← Implémentations repositories
    └── services/
        ├── JwtTokenService        ← Génération/vérification JWT HS512
        ├── EmailService           ← Envoi emails transactionnels
        └── SmsService             ← Envoi SMS via Techsoft
```

### 7.3 Sécurité multi-tenant

```
Chaque requête utilisateur :
  1. Cookie access_token (httpOnly, sécurisé)
  2. JWT décodé → { userId, schoolId, role, permissions[], refreshTokenVersion }
  3. Toutes les queries Prisma filtrent par schoolId
  4. Isolation totale entre établissements
  5. refreshTokenVersion pour invalidation à distance

MasterUser :
  1. Cookie master_jwt (HS512, secret distinct)
  2. Restriction IP pour login
  3. Rate limiting par endpoint
  4. OTP Email requis pour actions sensibles
  5. TOTP optionnel (2FA supplémentaire)
```

### 7.4 Flux de données Frontend ↔ Backend

```
Navigateur (Next.js)
    │
    │ HTTP Request + Cookie access_token
    │
    ▼
Express.js (Port 5000)
    │
    ├── requireAuth() → Vérifie JWT → inject req.user
    ├── requireRole() → Vérifie role dans whitelist
    │
    ├── Use Case Layer → Logique métier pure
    │
    └── Prisma Client → PostgreSQL (Port 5432)
                               │
                          Données filtrées
                          par schoolId
                          (Multi-tenant)
```

### 7.5 Diagramme de déploiement

```
┌─────────────────────────────────────────────────────────────┐
│                        INTERNET                             │
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
   │   Navigateur │   │  Application │   │ Services externes│
   │  Next.js SSR │   │  Mobile PWA  │   │                  │
   │  (Vercel/CDN)│   │  (IndexedDB) │   │  CampPay API     │
   └──────────────┘   └──────────────┘   │  Gemini AI API   │
          │                    │          │  Email SMTP      │
          └──────────┬─────────┘          │  SMS Techsoft    │
                     │                   └──────────────────┘
                     ▼                            │
          ┌──────────────────┐                    │
          │  API Express.js  │←───────────────────┘
          │  (Bun Runtime)   │  Webhooks (CampPay)
          └──────────────────┘
                     │
          ┌──────────────────┐
          │   PostgreSQL     │
          │   (Prisma ORM)   │
          └──────────────────┘
                     │
          ┌──────────────────┐
          │   Inngest        │
          │ (Jobs async /    │
          │  notifications)  │
          └──────────────────┘
```

---

## 8. ENDPOINTS API COMPLETS

### Routes Publiques (sans authentification)

| Méthode | Path | Description |
|---------|------|-------------|
| GET | /api/v2/public/schools | Liste des écoles actives (pour page login) |
| POST | /api/v2/public/contact-request | Formulaire de contact |
| POST | /api/v2/public/demo-request | Demande de démo |
| GET | /api/v2/onboarding/invite/:token | Valider token d'invitation |
| POST | /api/v2/onboarding/invite/:token/complete | Finaliser onboarding |
| POST | /api/v2/onboarding/preview-structure | Prévisualiser structure classes |
| POST | /api/v2/finance/payments/webhook/campay | Webhook paiement CampPay |

### Authentification Utilisateurs

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| POST | /api/v2/users/auth/login | - | Connexion (cookies httpOnly) |
| POST | /api/v2/users/auth/logout | Connecté | Déconnexion |
| POST | /api/v2/users/auth/refresh | - | Rafraîchir access token |
| GET | /api/v2/users/auth/invite/validate | - | Valider lien invitation |
| POST | /api/v2/users/auth/invite/complete | - | Finaliser invitation |

### Authentification Master (3 facteurs)

| Méthode | Path | Protection | Description |
|---------|------|-----------|-------------|
| POST | /api/v2/master/auth/login | IP + rate | Login (email + mdp) |
| POST | /api/v2/master/auth/verify-otp | rate | Vérifier OTP email |
| POST | /api/v2/master/auth/verify-mfa | rate | Vérifier TOTP |
| POST | /api/v2/master/auth/resend-otp | rate | Renvoyer OTP |
| GET | /api/v2/master/auth/me | master | Infos compte |
| GET | /api/v2/master/auth/mfa-status | master | Statut MFA |
| POST | /api/v2/master/auth/mfa/setup | master | Initier TOTP |
| POST | /api/v2/master/auth/mfa/enable | master + sensitive | Activer TOTP |
| POST | /api/v2/master/auth/mfa/disable | master + sensitive | Désactiver TOTP |
| POST | /api/v2/master/auth/mfa/regen-codes | master + sensitive | Régénérer codes |
| POST | /api/v2/master/auth/password-change/initiate | master + sensitive | Initier changement mdp |
| POST | /api/v2/master/auth/change-password | master | Changer mdp |
| POST | /api/v2/master/auth/logout | master | Déconnexion |
| GET | /api/v2/master/auth/logs | master | Logs d'audit |

### Gestion des Écoles (Master)

| Méthode | Path | Protection | Description |
|---------|------|-----------|-------------|
| GET | /api/v2/master/schools | master | Lister toutes les écoles |
| GET | /api/v2/master/schools/:id | master | Détail d'une école |
| GET | /api/v2/master/email-logs | master | Logs emails |
| POST | /api/v2/master/schools/invite | master + sensitive | Inviter une école |
| POST | /api/v2/master/schools/:id/approve | master + sensitive | Approuver |
| POST | /api/v2/master/schools/:id/reject | master + sensitive | Rejeter |
| POST | /api/v2/master/schools/:id/suspend | master + sensitive | Suspendre |
| POST | /api/v2/master/schools/:id/reactivate | master + sensitive | Réactiver |
| POST | /api/v2/master/schools/:id/cancel-approval | master + sensitive | Annuler approbation |
| POST | /api/v2/master/schools/:id/reexamine | master + sensitive | Réexaminer |
| POST | /api/v2/master/schools/:id/resend-invite | master + sensitive | Renvoyer invitation |
| POST | /api/v2/master/schools/:id/sync-subjects | master | Sync matières template |
| PATCH | /api/v2/master/schools/:id/plan | master | Changer plan |
| DELETE | /api/v2/master/schools/:id | master + sensitive | Supprimer |

### Utilisateurs

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/users | Auth | Lister utilisateurs (paginé, filtré) |
| GET | /api/v2/users/me | Auth | Mes infos |
| POST | /api/v2/users | ADMIN | Créer utilisateur |
| PUT | /api/v2/users/:id | Auth | Modifier utilisateur |
| DELETE | /api/v2/users/:id | ADMIN | Supprimer utilisateur |
| POST | /api/v2/users/import | ADMIN | Import Excel |
| POST | /api/v2/users/students/:id/transfer | ADMIN | Transférer élève |
| PATCH | /api/v2/users/:id/ap-designation | ADMIN | Désigner AP |

### École

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/school/me | Auth | Infos de l'école |
| PATCH | /api/v2/school/logo | ADMIN | Mettre à jour logo |
| PATCH | /api/v2/school/profile | ADMIN | Modifier profil |
| GET | /api/v2/schools/:id/configuration/preview | Auth | Aperçu config |
| POST | /api/v2/schools/:id/activate | ADMIN | Activer établissement |

### Classes

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/classes | Auth | Lister classes |
| POST | /api/v2/classes | ADMIN | Créer classe |
| PUT | /api/v2/classes/:id | ADMIN | Modifier classe |
| DELETE | /api/v2/classes/:id | ADMIN | Supprimer classe |
| PATCH | /api/v2/classes/:id/professor-principal | ADMIN | Assigner PP |
| POST | /api/v2/classes/:id/subgroups | ADMIN | Créer sous-groupe |
| POST | /api/v2/classes/subgroups/:subGroupId/students | ADMIN | Affecter élèves |

### Matières

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/subjects | Auth | Lister matières |
| POST | /api/v2/subjects | ADMIN | Créer matière |
| PUT | /api/v2/subjects/:id | ADMIN | Modifier matière |
| POST | /api/v2/subjects/teachers/:teacherId/assign | ADMIN | Assigner enseignant |
| POST | /api/v2/subjects/:id/coefficients | ADMIN | Définir coefficients BAC |

### Affectations Pédagogiques

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/teaching-assignments | Auth | Lister affectations |
| POST | /api/v2/teaching-assignments | ADMIN/STAFF | Créer/modifier affectation |

### Notes

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/grades | Auth | Lister notes (filtrées) |
| GET | /api/v2/grades/pending | Auth | Notes en attente |
| GET | /api/v2/grades/status/:classId | Auth | Statut par classe |
| GET | /api/v2/grades/average/:studentId | Auth | Moyenne élève |
| POST | /api/v2/grades | TEACHER | Saisir note |
| POST | /api/v2/grades/draft | TEACHER | Notes en masse (brouillon) |
| POST | /api/v2/grades/submit | TEACHER | Soumettre en masse |
| PUT | /api/v2/grades/:id | TEACHER | Modifier note |
| PATCH | /api/v2/grades/:id/submit | TEACHER | Soumettre une note |
| PATCH | /api/v2/grades/:id/validate | ADMIN/STAFF | Valider |
| PATCH | /api/v2/grades/:id/reject | ADMIN/STAFF | Rejeter |
| POST | /api/v2/grades/bulk-validate | ADMIN/STAFF | Valider en bloc |

### Présences

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/attendance | Auth | Lister présences |
| GET | /api/v2/attendance/stats | Auth | Statistiques |
| POST | /api/v2/attendance | TEACHER/ADMIN/STAFF | Enregistrer |
| PATCH | /api/v2/attendance/:id/justify | ADMIN/STAFF | Justifier absence |

### Bulletins

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/report-cards | Auth | Lister bulletins |
| GET | /api/v2/report-cards/my | STUDENT | Mes bulletins |
| GET | /api/v2/report-cards/check/:classId | Auth | Vérifier avant génération |
| GET | /api/v2/report-cards/:id/pdf | Auth | Télécharger PDF |
| POST | /api/v2/report-cards/generate | ADMIN/STAFF | Générer bulletins |
| POST | /api/v2/report-cards/send | ADMIN/STAFF | Envoyer aux parents |
| POST | /api/v2/report-cards/export/:classId | ADMIN/STAFF | Exporter ZIP |

### Emploi du Temps

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/timetables | Auth | Lister EDTs |
| POST | /api/v2/timetables/generate-skeleton | ADMIN/STAFF | Générer squelette |
| GET | /api/v2/timetables/check-conflict | Auth | Vérifier conflit |
| PATCH | /api/v2/timetables/slots/:slotId | ADMIN/STAFF | Remplir créneau |
| POST | /api/v2/timetables/manual | ADMIN/STAFF | Créer EDT manuellement |
| POST | /api/v2/timetables/:id/slots | ADMIN/STAFF | Ajouter créneau |
| PUT | /api/v2/timetables/:id/slots/:slotId | ADMIN/STAFF | Modifier créneau |
| PUT | /api/v2/timetables/:id/publish | ADMIN | Publier EDT |
| POST | /api/v2/timetables/catchup-requests | TEACHER | Demande rattrapage |

### Grille Horaire Config

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/timetable-grid-config | Auth | Obtenir config |
| POST | /api/v2/timetable-grid-config | ADMIN/STAFF | Enregistrer config |

### Année Scolaire

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/academic-years | Auth | Lister années |
| POST | /api/v2/academic-years | ADMIN | Créer année |
| PATCH | /api/v2/academic-years/periods/:id/set-current | ADMIN | Trimestre courant |
| PATCH | /api/v2/academic-years/sequences/:id/set-current | ADMIN | Séquence courante |
| POST | /api/v2/academic-years/:id/pre-close-check | ADMIN | Vérifier clôture |
| POST | /api/v2/academic-years/:id/close | ADMIN | Clôturer année |
| PUT | /api/v2/academic-years/:id/calendar | ADMIN | Mettre à jour calendrier |

### Finance

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/finance/fee-plans | ADMIN/STAFF | Lister plans de frais |
| POST | /api/v2/finance/fee-plans | ADMIN | Créer plan |
| GET | /api/v2/finance/invoices | ADMIN/STAFF | Lister factures |
| POST | /api/v2/finance/invoices | ADMIN/STAFF | Créer facture |
| POST | /api/v2/finance/invoices/bulk | ADMIN/STAFF | Factures en masse |
| POST | /api/v2/finance/payments/mobile | ADMIN/STAFF | Paiement Mobile Money |
| POST | /api/v2/finance/payments/caution/:id/rembourser | ADMIN/STAFF | Rembourser caution |
| POST | /api/v2/finance/expenses | ADMIN/STAFF | Enregistrer dépense |

### Parent

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/parent/children | PARENT | Mes enfants |
| GET | /api/v2/parent/invoices | PARENT | Factures enfants |
| POST | /api/v2/parent/pay | PARENT | Payer Mobile Money |

### Conseil de Classe

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/class-councils | Auth | Lister sessions |
| POST | /api/v2/class-councils | ADMIN/STAFF | Créer session |
| GET | /api/v2/class-councils/:id | Auth | Détail session |
| POST | /api/v2/class-councils/:id/decisions | ADMIN/STAFF | Ajouter décision |
| POST | /api/v2/class-councils/:id/decisions/bulk | ADMIN/STAFF | Décisions en bloc |
| POST | /api/v2/class-councils/:id/lock | ADMIN/STAFF | Verrouiller |
| GET | /api/v2/class-councils/:id/report | Auth | Rapport conseil |

### Discipline

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/discipline | ADMIN/STAFF | Lister sanctions |
| POST | /api/v2/discipline | ADMIN/STAFF | Créer sanction |
| PATCH | /api/v2/discipline/:id/lift | ADMIN/STAFF | Lever sanction |

### Bibliothèque

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/library/books | ADMIN/STAFF | Catalogue |
| POST | /api/v2/library/books | ADMIN/STAFF | Ajouter livre |
| PATCH | /api/v2/library/books/:id | ADMIN/STAFF | Modifier livre |
| GET | /api/v2/library/loans | ADMIN/STAFF | Emprunts actifs |
| POST | /api/v2/library/loans | ADMIN/STAFF | Enregistrer emprunt |
| PATCH | /api/v2/library/loans/:id/return | ADMIN/STAFF | Retourner livre |

### Orientation

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/orientation/stats | Auth | Statistiques |
| GET | /api/v2/orientation/fiches | ADMIN/STAFF | Lister fiches |
| POST | /api/v2/orientation/fiches | STAFF | Créer fiche |
| GET | /api/v2/orientation/fiches/:id | Auth | Détail fiche |
| POST | /api/v2/orientation/fiches/:id/entretiens | STAFF | Ajouter entretien |
| PATCH | /api/v2/orientation/entretiens/:id | STAFF | Modifier entretien |
| POST | /api/v2/orientation/fiches/:id/tests | STAFF | Ajouter test |
| POST | /api/v2/orientation/fiches/:id/recommandation-serie | STAFF | Recommandation série |
| PATCH | /api/v2/orientation/recommandations/:id/valider | ADMIN | Valider recommandation |
| POST | /api/v2/orientation/fiches/:id/suivis | STAFF | Ajouter suivi |

### Intelligence Artificielle

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| POST | /api/v2/ai/generate-insight | Auth | Générer analyse |
| GET | /api/v2/ai/students-health | Auth | Santé scolaire |
| POST | /api/v2/ai/bulletin-comment | Auth | Commentaire bulletin |
| POST | /api/v2/ai/chat | Auth | Chat pédagogique |
| GET | /api/v2/ai/risk-detection/:studentId | Auth | Détection risque |

### Notifications & SMS

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/notifications | Auth | Mes notifications |
| PATCH | /api/v2/notifications/:id/read | Auth | Marquer lue |
| POST | /api/v2/sms/send | ADMIN/STAFF | Envoyer SMS manuel |
| GET | /api/v2/sms/logs | ADMIN | Logs SMS |

### Dashboard & Utilitaires

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| GET | /api/v2/dashboard/stats | Auth | Statistiques générales |
| GET | /api/v2/dashboard/admin-badges | ADMIN | Badges sidebar |
| GET | /api/v2/search/global | ADMIN | Recherche globale |
| GET | /api/v2/school-settings | Auth | Paramètres école |
| PUT | /api/v2/school-settings | ADMIN | Modifier paramètres |
| GET | /api/v2/templates/import-eleves | ADMIN | Template Excel élèves |
| GET | /api/v2/templates/import-enseignants | ADMIN | Template Excel enseignants |
| GET | /api/v2/activities | ADMIN | Journal activités |
| GET | /api/v2/email-logs | ADMIN | Logs emails |

### Hors-ligne & Synchronisation

| Méthode | Path | Rôle | Description |
|---------|------|------|-------------|
| POST | /api/v2/offline/sync | Auth | Synchroniser données offline |
| GET | /api/v2/offline/conflicts | Auth | Conflits de synchronisation |
| PATCH | /api/v2/offline/conflicts/:id/resolve | Auth | Résoudre un conflit |

---

## 9. INTERFACES UTILISATEUR PAR RÔLE

### 9.1 Landing Page (`/`)
- Présentation de la plateforme EduNexus
- Description des fonctionnalités par module
- Présentation des plans tarifaires (DISCOVERY / STANDARD / PREMIUM)
- Formulaire de demande de démo / contact

### 9.2 Login Page (`/login`)
- Sélecteur d'établissement (dropdown searchable)
- Sélecteur de rôle (5 rôles)
- Saisie email + mot de passe
- Redirection conditionnelle selon rôle :
  - ADMIN → /admin/dashboard
  - STAFF → /staff/dashboard
  - TEACHER → /teacher/dashboard
  - STUDENT → /student/dashboard
  - PARENT → /parent/dashboard

### 9.3 Onboarding (`/onboarding/[token]`)
**4 étapes :**
1. Informations école (nom, subdomain, sous-système FR/EN/BILINGUE, type, statut juridique, ville, région, logo)
2. Compte administrateur (prénom, nom, email, mot de passe)
3. Configuration structure scolaire (niveaux 1er cycle, classes/niveau, LV2, filières 2e cycle, filières techniques)
4. Confirmation et soumission

### 9.4 Configuration Page (`/admin/configuration`)
**4 étapes :**
1. Récapitulatif école approuvée
2. Aperçu des classes à créer (avec aperçu du template)
3. Vérification finale
4. Activation → génération automatique de toute la structure

### 9.5 Dashboard Admin (`/admin/dashboard`)

| Section | Fonctionnalités clés |
|---------|---------------------|
| **Tableau de bord** | KPIs (élèves, enseignants, classes, paiements), alertes rapides |
| **Utilisateurs** | CRUD complet, filtres par rôle, import Excel, invitation, transfert élèves, désignation AP |
| **Classes** | CRUD, assignation PP, sous-groupes TP |
| **Matières** | CRUD, coefficients BAC par série, assignation à enseignants |
| **Présences** | Vue historique, statistiques par classe |
| **Notes** | Validation/rejet des notes soumises, validation en bloc |
| **Bulletins** | Génération PDF, envoi emails + SMS, export ZIP par classe |
| **Emploi du temps** | Lecture seule + bouton "Valider et publier" |
| **Conseil de classe** | Création sessions, décisions PASS/REPEAT/DELIBERATION, verrouillage |
| **Année scolaire** | Création, trimestres, séquences, calendrier, clôture + promotion |
| **Finance** | Plans de frais, factures, paiements Mobile Money, cautions, dépenses |
| **IA Santé scolaire** | Scores de santé élèves, détection risques, commentaires bulletins |
| **Paramètres** | Profil école, logo, timezone, locale, sous-domaine, notifications SMS |

### 9.6 Dashboard Staff (`/staff/dashboard`)

Sections affichées selon les permissions du membre du personnel :

| Section | Permission requise | Fonctionnalités |
|---------|-------------------|-----------------|
| **Tableau de bord** | Tous | KPIs adaptés aux permissions |
| **Grille horaire** | MANAGE_TIMETABLE | Config heures/pauses/jours, aperçu en temps réel |
| **Affectations** | MANAGE_TIMETABLE | Assigner enseignants aux matières par classe |
| **Emploi du temps** | MANAGE_TIMETABLE | Remplissage interactif (case par case, conflit auto-détecté) |
| **Validation notes** | VALIDATE_GRADES | Valider/rejeter notes soumises |
| **Présences** | MANAGE_ATTENDANCE | Enregistrement absences/retards, justifications |
| **Conseil de classe** | MANAGE_CLASS_COUNCIL | Sessions, décisions, verrouillage |
| **Mobile Money** | MANAGE_FINANCE | Factures, paiements, initier paiement MoMo |
| **Cautions** | MANAGE_FINANCE | Gestion des cautions (remboursement) |
| **Discipline** | MANAGE_DISCIPLINE | Sanctions (5 types), levée de sanctions |
| **Bibliothèque** | MANAGE_LIBRARY | Catalogue livres, emprunts, retours |
| **Orientation** | MANAGE_ORIENTATION | Fiches, entretiens, tests, recommandations séries |

### 9.7 Dashboard Enseignant (`/teacher/dashboard`)

| Section | Fonctionnalités |
|---------|-----------------|
| **Tableau de bord** | KPIs (classes, notes à soumettre) |
| **Mes classes** | Liste des classes affectées, élèves |
| **Présences** | Prise d'appel, justification absence |
| **Notes** | Saisie DS1/DS2/Composition, soumission pour validation |
| **Emploi du temps** | Consultation de son EDT publié |

### 9.8 Dashboard Élève (`/student/dashboard`)

| Section | Fonctionnalités |
|---------|-----------------|
| **Tableau de bord** | Vue d'ensemble personnalisée |
| **Mes notes** | Consultation par séquence, par matière |
| **Mes bulletins** | Accès aux bulletins, téléchargement PDF |
| **Emploi du temps** | EDT de sa classe |
| **Mes présences** | Historique absences/retards |
| **Examens** | Passage d'examens en ligne |

### 9.9 Dashboard Parent (`/parent/dashboard`)

| Section | Fonctionnalités |
|---------|-----------------|
| **Mes enfants** | Liste des enfants rattachés |
| **Bulletins & Notes** | Consultation des résultats par enfant |
| **Présences** | Absences/retards de ses enfants |
| **Emploi du temps** | EDT de la classe de l'enfant |
| **Paiements** | Factures impayées, paiement Mobile Money (MTN/Orange) |
| **Notifications** | Alertes SMS reçues (absences, bulletins, paiements) |

### 9.10 Dashboard Master (`/master/dashboard`)

| Section | Fonctionnalités |
|---------|-----------------|
| **Vue d'ensemble** | KPIs : écoles actives/en attente/invitées/nouvelles/suspendues |
| **Gestion des écoles** | Liste avec filtres, recherche, toutes les actions de cycle de vie |
| **Logs d'audit** | Journal complet des actions sensibles |

**Actions disponibles par école :**
- Voir détails (SlideOver latéral)
- Approuver / Rejeter / Suspendre / Réactiver / Supprimer
- Changer plan d'abonnement
- Renvoyer invitation

---

## 10. SPÉCIFICITÉS MÉTIER CAMEROUNAISES

### 10.1 Système scolaire camerounais

| Caractéristique | Détail |
|----------------|--------|
| **Sous-systèmes** | Francophone / Anglophone / Bilingue |
| **Cycle primaire** | 6 années (SIL/CP/CE1/CE2/CM1/CM2) |
| **Collège (1er cycle)** | 4 années : 6ème → 3ème |
| **Lycée (2ème cycle)** | 3 années : 2nde → Tle avec séries |
| **Enseignement technique** | CETIC, CFM, Lycée Technique |
| **Monnaie** | XAF (Franc CFA) |
| **Fuseau horaire** | Africa/Douala (UTC+1) |

### 10.2 Séries BAC camerounaises

| Catégorie | Séries |
|-----------|--------|
| **Lettres (FR)** | A1 (Philosophie), A2 (Anglais), A3 (Espagnol), A4 (Arabe), A5 (Latin-Grec), ABI (Bilingue) |
| **Sciences (FR)** | C (Maths+Physique), D (Maths+SVT), E (Technologie) |
| **Technique (FR)** | F (Technique industrielle), G (Technique commerciale), H (Informatique) |
| **Anglophone** | Arts, Sciences, Commercial, Technical |

### 10.3 Formule de calcul des notes MINESEC

```
Note séquence = DS1 (coeff 1) + DS2 (coeff 1) + Composition (coeff 2)
Moyenne séquence = somme(note × coefficient) / somme(coefficients)
Moyenne générale = (Moy_Seq1 + Moy_Seq2 + Moy_Comp) / 4  [pour un trimestre]
```

### 10.4 Mentions MINESEC (sur 20)

| Mention | Plage |
|---------|-------|
| Excellent | ≥ 16/20 |
| Très Bien | ≥ 14/20 |
| Bien | ≥ 12/20 |
| Assez Bien | ≥ 10/20 |
| Passable | = 10/20 (note de passage) |
| Insuffisant | < 10/20 |

### 10.5 Templates d'établissement (17)

```
LYCEE_FR, CES_FR, PRIVE_FR, LYCEE_TECHNIQUE_FR, CETIC,
LYCEE_BILINGUE, GHS_EN (Government High School),
GSS_EN (Government Secondary School), PRIVE_EN,
PRIMARY_EN, PRIMAIRE_FR, PRIMARY_BILINGUAL,
MATERNELLE_FR, NURSERY_EN, CFM (Centre de Formation),
SAR_SM (Section Artisanale Rurale), COMPLEXE_SCOLAIRE
```

### 10.6 Textes réglementaires respectés

| Texte | Application dans EduNexus |
|-------|--------------------------|
| Arrêté N°92/22 MINESEC (17 Mars 2022) | Coefficients BAC officiels par série |
| Décret N° 2001/041 (10 Fév 2001, Art. 36) | Censeur élabore EDT, Proviseur publie |
| Loi contribution APEE | Max 7 500 XAF (1er cycle), 10 000 XAF (2e cycle) |
| Limite AP | Max 14h/semaine pour Animateurs Pédagogiques |

### 10.7 Paiements Mobile Money (spécifique Cameroun)

| Opérateur | Méthode | Via |
|-----------|---------|-----|
| MTN Cameroun | MTN Mobile Money (MoMo) | CampPay API |
| Orange Cameroun | Orange Money | CampPay API |
| Express Union | Virement EU | Manuel |
| Banques | Virement bancaire | Manuel |
| Caisse | Espèces | Manuel |

---

## ANNEXE — INVENTAIRE USE CASES (résumé pour diagramme)

| # | Acteur | Cas d'utilisation | Module |
|---|--------|------------------|--------|
| UC01-17 | MasterUser | Gestion plateforme et cycle de vie écoles | Plateforme |
| UC18-21 | Admin | Connexion + onboarding + activation | Auth/Config |
| UC22-28 | Admin | Gestion utilisateurs | Users |
| UC29-34 | Admin | Gestion classes | Classes |
| UC35-38 | Admin | Gestion matières | Subjects |
| UC39 | Admin/Staff | Affectations pédagogiques | Timetable |
| UC40-45 | Admin | Gestion année scolaire | Academic |
| UC46-48 | Admin/Staff | Emploi du temps (config + publication) | Timetable |
| UC49-51 | Admin/Staff | Validation des notes | Grades |
| UC52-54 | Admin/Staff | Bulletins | Report Cards |
| UC55-60 | Admin/Staff | Finance | Finance |
| UC61-64 | Admin/Staff | Conseil de classe | Council |
| UC65 | Admin | Validation orientation | Orientation |
| UC66-69 | Admin | Paramètres école | Settings |
| UC70-71 | Admin | IA Santé scolaire | AI |
| UC72-75 | Staff (Censeur) | Emploi du temps (élaboration) | Timetable |
| UC76-77 | Staff (Censeur) | Validation notes | Grades |
| UC78-81 | Staff (Censeur) | Conseil de classe | Council |
| UC82-83 | Staff | Présences | Attendance |
| UC84-87 | Staff (Intendant) | Finance | Finance |
| UC88-89 | Staff | Discipline | Discipline |
| UC90-92 | Staff (Docum.) | Bibliothèque | Library |
| UC93-97 | Staff (Orient.) | Orientation | Orientation |
| UC98-99 | Staff | Génération bulletins | Report Cards |
| UC100-108 | Teacher | Notes + présences + EDT + rattrapage | Teaching |
| UC109-114 | Student | Consultation + examens | Learning |
| UC115-122 | Parent | Suivi enfants + paiements + SMS | Parent |

---

*Document d'analyse système pour présoutenance EDUNEXUS*
*Architecture : Bun/Express/Prisma/PostgreSQL · Next.js/React 19/Tailwind*
*Ndzana Christophe — SaaS de gestion scolaire pour le Cameroun*
