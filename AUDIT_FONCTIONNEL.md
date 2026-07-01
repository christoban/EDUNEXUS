# AUDIT FONCTIONNEL EDUNEXUS — Comparaison Logesco School Pro
> Date : 30 juin 2026 · Analysé par Claude Sonnet 4.6  
> Stack : Bun/Express/TypeScript/Prisma/PostgreSQL + Next.js 19/React/Tailwind  
> Architecture : Hexagonale (domain / application / infrastructure)

---

## VUE D'ENSEMBLE RAPIDE

| Tranche | Modules |
|---|---|
| **≥ 70 % complet** | 1 module |
| **30 – 70 % complet** | 8 modules |
| **< 30 % complet** | 4 modules |

---

## MODULE 1 — Administration et Paramétrages

**État : Partiellement fait (~70 %)**

### Ce qui existe concrètement
- **Structure école** : modèle `School` complet (nom, sous-domaine, région, ville, plan, statut, type, sous-système, ownership, logoUrl). `SchoolConfig` (formule de notes, seuil de passage, gradeWeights). `SchoolSettings` (timezone, locale, devise). `SchoolNotificationSettings`.
- **Sections/cycles** : modèle `Section` (FR/EN) avec `gradingSystem` (OUT_OF_20 / OUT_OF_100). `Class` avec level, série, filière, section, professorPrincipalId.
- **Départements / matières** : `Department`, `Subject` (coefficient, heuresParSemaine, subjectType THEORETICAL/PRACTICAL/MIXED), `TeachingAssignment`, `TeacherSubject`, `SubjectCoefficient`, `ClassSubjectOverride`.
- **Années / périodes / séquences** : `AcademicYear`, `AcademicPeriod` (trimestre/term), `AcademicSequence` (DS / COMPOSITION / CLASS_TEST / TERMINAL_EXAM / UA).
- **17 templates officiels MINESEC** : Lycée FR, CES, Privé FR, Lycée Technique, CETIC, SAR_SM, CFM, Primaire FR, Maternelle, GHS EN, GSS EN, Privé EN, Primaire EN, Nursery, Lycée Bilingue, Primaire Bilingue, Complexe Scolaire.
- **Coefficients officiels** : `BacCoefficient` (par série/niveau/matière), `CycleCoefficient`, `AnglophoneSubjectLoad`.
- **Sous-groupes TP** : `ClassSubGroup`, `StudentSubGroupAssignment`.
- **Configuration générale** : endpoints PATCH `/api/v2/school/me`, GET/PATCH `/api/v2/schools/:id/structure`, sync-subjects, notification-settings, security-settings.
- **Frontend** : `SectionSettings`, `SectionClasses`, `SectionSubjects`, `SectionAffectations`, `admin/configuration/page.tsx`.

### Ce qui manque
- Gestion **campus / bâtiments / salles** (aucun modèle `Building`, `Room`, `Campus`)
- Gestion **matériels / inventaire patrimoine** (le `StaffPermissionType.MANAGE_PATRIMOINE` existe mais aucun modèle ni endpoint)
- **Régimes de scolarité** en tranches temporelles (ex. : 3 versements avec dates butoir, taux d'intérêt retard)
- **Configuration des délais de saisie de notes** par séquence avec enforcement automatique
- UI de **gestion des salles** et affectation cours ↔ salle dans l'emploi du temps

### Fichiers concernés
- `backend/prisma/schema.prisma` (models School, SchoolConfig, SchoolSettings, Class, Department, Subject, AcademicYear, AcademicPeriod, AcademicSequence, SubjectCoefficient, ClassSubjectOverride, ClassSubGroup…)
- `backend/prisma/seed.ts` (17 SchoolTemplates, BacCoefficients, CycleCoefficients)
- `backend/src/infrastructure/http/controllers/ClasseController.ts`, `SubjectController.ts`, `AcademicYearController.ts`, `DepartmentController.ts`, `SchoolSettingsController.ts`
- `backend/src/infrastructure/http/routes/classe.routes.ts`, `subject.routes.ts`, `department.routes.ts`, `academicYear.routes.ts`
- `frontend/src/app/admin/dashboard/_components/SectionClasses.tsx`, `SectionSubjects.tsx`, `SectionSettings.tsx`, `SectionAffectations.tsx`
- `frontend/src/app/admin/configuration/page.tsx`

---

## MODULE 2 — Planification et Emploi du Temps

**État : Partiellement fait (~55 %)**

### Ce qui existe concrètement
- **Emploi du temps manuel** : modèles `Timetable` (DRAFT/PUBLISHED) et `TimetableSlot` (dayOfWeek, startTime, endTime, room, subject, teacher, kind: CLASS/BREAK/ACTIVITY/TD).
- **Configuration grille horaire** : `TimetableGridConfig` (heureDebut, dureePeriode, joursActifs). Endpoint POST `/api/v2/timetables/generate-skeleton`.
- **Vérification conflits** : GET `/api/v2/timetables/check-conflict`.
- **Publication** : PUT `/api/v2/timetables/:id/publish`.
- **Demande de cours de rattrapage** : POST `/api/v2/timetables/catchup-requests`.
- **Découpage périodes/séquences** : `AcademicYear`, `AcademicPeriod`, `AcademicSequence` avec endpoints de clôture et mise à jour calendrier.
- **Avancement/redoublement** : `StudentPromotion`, `ClassPromotion`, `ClassCouncilDecision` (PASS/REPEAT/DELIBERATION). POST `/api/v2/academic-years/:id/close`.
- **Superviseurs** : `StaffPermissionType.SUPERVISE_TEACHERS` + `MANAGE_CATCHUP_REQUESTS`.
- **Frontend** : `SectionTimetable`, `SectionGrilleHoraire` (admin + staff).

### Ce qui manque
- **Génération automatique** de l'emploi du temps (contraintes, optimisation) — seul le squelette manuel existe
- **Délais de saisie de notes** par séquence avec verrouillage automatique à la date butoir
- **Délais de paiement** configurables par tranche avec alertes
- Visualisation **semaine/jour** de l'emploi du temps avec drag-and-drop
- Gestion des **suppressions/échanges de cours** avec notification automatique
- Vue emploi du temps **par enseignant** et **par salle**

### Fichiers concernés
- `backend/prisma/schema.prisma` (Timetable, TimetableSlot, TimetableGridConfig, AcademicYear, StudentPromotion, ClassPromotion)
- `backend/src/infrastructure/http/controllers/TimetableController.ts`, `TimetableGridConfigController.ts`, `AcademicYearController.ts`
- `backend/src/infrastructure/http/routes/timetable.routes.ts`, `academicYear.routes.ts`
- `backend/src/application/timetable/`, `backend/src/application/academicYear/`
- `frontend/src/app/admin/dashboard/_components/SectionTimetable.tsx`, `SectionGrilleHoraire.tsx`
- `frontend/src/app/staff/dashboard/_components/SectionTimetableStaff.tsx`
- `frontend/src/app/teacher/dashboard/_components/SectionTeacherTimetable.tsx`

---

## MODULE 3 — Contrôle d'Accès (physique)

**État : Pas commencé (~5 %)**

### Ce qui existe concrètement
- Le suivi des **insolvables** est déductible via `Invoice.status === OVERDUE` et les filtres finance — pas un module dédié.
- Les **plages horaires** de l'emploi du temps existent dans `TimetableSlot` mais dans un but académique, pas de contrôle d'accès physique.
- `StaffPermissionType.MANAGE_INCIDENTS` et `MANAGE_DEGRADATIONS` existent mais sans modèles.

### Ce qui manque
- Modèles **Badge**, **AccessPoint**, **AccessLog**
- Intégration hardware (bornes RFID/biométriques)
- **Historique des accès** (qui est entré, quand, quelle porte)
- **Billets d'entrée/sortie** numériques (lié au module Discipline)
- Tableau de bord insolvables avec blocage d'accès automatique
- Système de **parking / zones**

### Fichiers concernés
- Aucun fichier existant — module à créer entièrement

---

## MODULE 4 — Gestion de la Scolarité

**État : Partiellement fait (~55 %)**

### Ce qui existe concrètement
- **Inscription** : `UserController.register` (POST `/api/v2/users/`), flux d'invitation par token, import Excel (POST `/api/v2/users/import`).
- **Matricules** : `StudentProfile.matricule` avec génération automatique dans l'activation.
- **Familles** : `ParentProfile`, table de jonction `ParentStudent`, portail parent (GET `/api/v2/parent/children`).
- **Transferts** : `UserController.transfer` (POST `/api/v2/users/students/:id/transfer`), `StudentStatus` (ACTIVE/GRADUATED/LEFT/TRANSFERRED).
- **Statuts élèves** : gérés via `StudentProfile.status` et `ClassCouncilDecision`.
- **Frontend** : `SectionUsers`, portail parent `SectionParentChildren`.

### Ce qui manque
- **Pré-inscriptions** (flux distinct avec état EN_ATTENTE, validation admin)
- **Certificats de scolarité** (génération PDF avec QR code ou cachet)
- **Cartes d'identité scolaires** (PDF/image avec photo, matricule, classe)
- **Lettres de transfert / démission** officielles en PDF
- **Gestion des photos d'élèves** (upload, stockage)
- **Dossier élève complet** (historique scolaire, documents, santé) — `StudentProfile.healthScore` existe mais pas de pièces jointes
- **Formulaire de pré-inscription en ligne** public

### Fichiers concernés
- `backend/prisma/schema.prisma` (User, StudentProfile, ParentProfile, ParentStudent)
- `backend/src/infrastructure/http/controllers/UserController.ts`
- `backend/src/infrastructure/http/routes/user.routes.ts`
- `backend/src/application/user/`, `backend/src/application/school/ActiverEtablissementUseCase.ts`
- `frontend/src/app/admin/dashboard/_components/SectionUsers.tsx`
- `frontend/src/app/parent/dashboard/_components/SectionParentChildren.tsx`

---

## MODULE 5 — Intendance et Comptabilité

**État : Partiellement fait (~50 %)**

### Ce qui existe concrètement
- **Plans de frais** : `FeePlan` avec 9 types (TUITION, APEE_PTA, EXAM, UNIFORM, CAUTION, WORKSHOP, INSCRIPTION, DEVELOPMENT_LEVY, SPORTS_LEVY).
- **Factures** : `Invoice` (PENDING/PARTIAL/PAID/OVERDUE/CANCELLED), création individuelle et en masse.
- **Paiements** : `Payment` avec 5 méthodes (CASH, MTN_MOMO, ORANGE_MONEY, BANK_TRANSFER, EXPRESS_UNION), statuts, référence Campay.
- **Mobile Money** : intégration CampPay complète (initier paiement, webhook Campay, confirmation automatique). Paiement parent possible depuis portail.
- **Cautions** : `Payment.cautionStatus` (HELD/REFUNDED/PERMANENTLY_HELD), endpoint de remboursement.
- **Dépenses** : modèle `Expense` avec catégorie.
- **Frontend** : `SectionFinance`, `SectionFinanceStaff`, `SectionCautions`, `SectionParentPayments`.

### Ce qui manque
- **Comptabilité formelle** (plan comptable, journaux débit/crédit, grand livre)
- **Gestion des comptes bancaires** de l'établissement (aucun modèle `BankAccount`)
- **Budget prévisionnel** vs dépenses réelles
- **Rapports financiers** exportables (recettes par période, par type, soldes)
- **Relances automatiques** pour factures en retard (SMS/email schedulé)
- **Reçus de paiement** PDF générés automatiquement
- **Gestion des remises / exonérations**
- **Abonnement** multi-enfants (famille avec plusieurs enfants = réduction)

### Fichiers concernés
- `backend/prisma/schema.prisma` (FeePlan, Invoice, Payment, Expense)
- `backend/src/infrastructure/http/controllers/FinanceController.ts`
- `backend/src/infrastructure/http/routes/finance.routes.ts`
- `backend/src/application/finance/` (8 use cases : CreerPlanFrais, GenererFacture, GenererFacturesEnMasse, InitierPaiementMobileMoney, TraiterWebhookCampay, RembourserCaution, EnregistrerDepense, EnregistrerPaiementCash)
- `backend/src/infrastructure/services/` (CampPay integration)
- `frontend/src/app/admin/dashboard/_components/SectionFinance.tsx`
- `frontend/src/app/staff/dashboard/_components/SectionFinanceStaff.tsx`, `SectionCautions.tsx`
- `frontend/src/app/parent/dashboard/_components/SectionParentPayments.tsx`

---

## MODULE 6 — Notes et Examens

**État : Partiellement fait (~65 %)**

### Ce qui existe concrètement
- **Saisie de notes** : `GradeController.saisir` + `draftEnMasse` + `soumettreEnMasse`. Champs étendus : sequenceScore, classTestScore, terminalExamScore, theoreticalScore, practicalScore, professionalAttitude, oralScore, selfDevelopmentScore.
- **Workflow de validation** : DRAFT → SUBMITTED → VALIDATED → LOCKED → REJECTED. 5 use cases dédiés (Saisir, Soumettre, Valider, Rejeter, ValiderEnBloc).
- **Conseil de classe** : `ClassCouncilSession`, `ClassCouncilDecision` (PASS/REPEAT/DELIBERATION), endpoints complets, verrou avant génération bulletins.
- **Bulletins** : `ReportCard` + `ReportCardSubjectLine`, 6 templates PDF (FR_SECONDARY, EN_SECONDARY, TECHNICAL_FR, PRIMARY, ANNUAL, MONTHLY). Génération → export ZIP → envoi parents.
- **Rangs et moyennes** : calculés dans `GenererBulletinUseCase`, formules configurables (`GradeFormula`, `MentionRule`).
- **Rapport de conseil** : GET `/api/v2/class-councils/:id/report`.
- **Frontend** : `SectionGrades`, `SectionBulletins`, `SectionAdminCouncil`, `SectionTeacherGrades`, `SectionGradeValidation` (staff).

### Ce qui manque
- **Anonymats** pour les compositions (aucun modèle/code d'anonymisation)
- **Import Excel des notes** (le template Excel existe via `TemplateController` mais l'import de notes par fichier n'est pas implémenté)
- **Tableaux d'honneur** (aucun endpoint ni template PDF)
- **PV de délibération** formels (le rapport conseil est partiel)
- **Examens blancs / devoirs maison** distincts des séquences officielles
- Formulaire d'entrée de notes hors ligne avec sync différé (l'`OfflineQueue` existe mais l'UI offline grade-entry n'est pas finalisée)

### Fichiers concernés
- `backend/prisma/schema.prisma` (Grade, GradeFormula, MentionRule, Exam, ReportCard, ReportCardSubjectLine, ClassCouncilSession, ClassCouncilDecision)
- `backend/src/infrastructure/http/controllers/GradeController.ts`, `ReportCardController.ts`, `ClassCouncilController.ts`
- `backend/src/infrastructure/http/routes/grade.routes.ts`, `reportCard.routes.ts`, `classCouncil.routes.ts`
- `backend/src/application/grade/` (5 use cases), `backend/src/application/reportCard/`, `backend/src/application/classCouncil/`
- `backend/src/domain/entities/Bulletin.ts`, `Note.ts`
- `backend/src/utils/reportCards/` (templates PDF, helpers)
- `frontend/src/app/admin/dashboard/_components/SectionGrades.tsx`, `SectionBulletins.tsx`, `SectionAdminCouncil.tsx`
- `frontend/src/app/teacher/dashboard/_components/SectionTeacherGrades.tsx`
- `frontend/src/app/staff/dashboard/_components/SectionGradeValidation.tsx`

---

## MODULE 7 — Rapports & Statistiques

**État : Pas commencé / Partiellement fait (~20 %)**

### Ce qui existe concrètement
- **Statistiques département** : GET `/api/v2/departments/:id/performance` (moyennes, taux de réussite, comparaison enseignants).
- **Données dashboard** : `DashboardController` avec quelques agrégations Prisma.
- **Stats présence** : GET `/api/v2/attendance/stats`.
- **Stats orientation** : GET `/api/v2/orientation/stats`.
- **Logs d'activité** : `ActivitiesLog`, GET `/api/v2/schools/:id/audit-logs`.

### Ce qui manque
- **Graphes d'évolution des moyennes** (par élève, classe, matière sur plusieurs périodes)
- **Comparaisons inter-classes / inter-sections** en PDF ou chart
- **Répartition des élèves** par niveau, genre, statut de paiement
- **Rapport enseignant** (heures effectuées vs prévues, taux présence, résultats élèves)
- **Rapports exportables** (Excel/PDF) par classe, période, département
- **Tableau de bord statistique** dédié avec graphes interactifs
- **Indicateurs de performance scolaire** (taux de réussite global, progression)
- Toute l'**infrastructure de charts** côté frontend (aucune lib de visualisation détectée)

### Fichiers concernés
- `backend/src/infrastructure/http/controllers/DepartmentController.ts`, `DashboardController.ts`
- `backend/src/infrastructure/http/routes/department.routes.ts`, `dashboard.routes.ts`
- `frontend/src/app/admin/dashboard/_components/SectionDashboard.tsx` (existant mais partiel)

---

## MODULE 8 — Discipline Scolaire

**État : Partiellement fait (~40 %)**

### Ce qui existe concrètement
- **Absences** : `Attendance` (PRESENT/ABSENT/LATE/ABSENT_JUSTIFIED), enregistrement par demi-journée (MORNING/AFTERNOON).
- **Justifications** : PATCH `/api/v2/attendance/:id/justify`.
- **Sanctions** : `DisciplineRecord` avec 5 niveaux (WARNING_ORAL, WARNING_WRITTEN, TEMP_EXCLUSION, COUNCIL_DECISION, PERMANENT_EXCLUSION), statuts (ACTIVE/LIFTED/APPEALED).
- **Levée de sanction** : PATCH `/api/v2/discipline/:id/lift`.
- **Frontend** : `SectionDiscipline` (staff), `SectionAdminAttendance`.

### Ce qui manque
- **Incidents** (aucun modèle `Incident` distinct des sanctions)
- **Billets de sortie / d'entrée** numériques
- **Conseil de discipline** formalisé (distinct du conseil de classe) avec PV
- **Notifications automatiques aux parents** lors d'une sanction
- **Seuil d'absences** avec alerte automatique (ex. : > 10 absences injustifiées → signal)
- **Historique disciplinaire** par élève sur plusieurs années
- **Retenues / heures de colle** comme type de sanction
- Frontend de **saisie d'absence en masse** pour une classe entière

### Fichiers concernés
- `backend/prisma/schema.prisma` (Attendance, DisciplineRecord)
- `backend/src/infrastructure/http/controllers/AttendanceController.ts`
- `backend/src/infrastructure/http/routes/attendance.routes.ts`
- Routes inline dans `hexagonal.bootstrap.ts` : GET/POST `/api/v2/discipline`, PATCH `/api/v2/discipline/:id/lift`
- `backend/src/application/attendance/EnregistrerPresenceUseCase.ts`
- `frontend/src/app/staff/dashboard/_components/SectionDiscipline.tsx`
- `frontend/src/app/admin/dashboard/_components/SectionAdminAttendance.tsx`
- `frontend/src/app/teacher/dashboard/_components/SectionTeacherAttendance.tsx`

---

## MODULE 9 — Publipostages et Communications

**État : Partiellement fait (~35 %)**

### Ce qui existe concrètement
- **Messagerie interne** : `Conversation` (PRIVATE/CLASS_CHANNEL/PARENT_CHANNEL/SYSTEM), `Message` avec modération (APPROVED/PENDING/REJECTED), `MessageReadStatus`.
- **Annonces** : `Announcement` épinglables par rôle.
- **Notifications in-app** : `Notification` (ACADEMIC/ATTENDANCE/COMMUNICATION/FINANCIAL/AI_ALERT/POSITIVE/SYSTEM), `NotificationPreference`.
- **Email transactionnel** : `EmailLog`, service Resend intégré (`sendTransactionalEmail`), templates (school_invite, school_pending_notification…).
- **SMS** : `SmsLog`, `SMSController`, `SmsNotificationService` (notification bulletin disponible). `SchoolNotificationSettings` configurable.
- **Notification bulletin** : SMS automatique aux parents après génération bulletins.

### Ce qui manque
- **Publipostage en masse** : envoyer un SMS/email à TOUS les parents d'une classe, d'un niveau, ou de l'école entière
- **Gestionnaire de templates de messages** (personnalisables par l'admin)
- **Messages planifiés** (ex. : rappel paiement scolarité le 1er du mois)
- **Suivi des envois** visible depuis l'interface admin (taux de délivrance, erreurs)
- **Frontend communication** dédié — aucune section de messagerie trouvée dans les dashboards admin/staff
- **Publipostage SMS** de convocation (convocation conseil de classe, réunion parents)
- Intégration **WhatsApp** (très utilisé au Cameroun)

### Fichiers concernés
- `backend/prisma/schema.prisma` (Conversation, Message, MessageReadStatus, Announcement, Notification, NotificationPreference, SmsLog, EmailLog)
- `backend/src/infrastructure/http/controllers/SMSController.ts`
- `backend/src/infrastructure/http/routes/sms.routes.ts`
- `backend/src/infrastructure/services/emailService.ts`, `SmsNotificationService.ts`
- `backend/src/types/email.ts`

---

## MODULE 10 — Rapports et États (Impressions)

**État : Partiellement fait (~35 %)**

### Ce qui existe concrètement
- **6 templates de bulletins** PDF opérationnels : FR_SECONDARY, EN_SECONDARY, TECHNICAL_FR, PRIMARY, ANNUAL, MONTHLY — générés par PdfKit.
- **Export ZIP** de tous les bulletins d'une classe : POST `/api/v2/report-cards/export/:classId`.
- **Téléchargement PDF individuel** : GET `/api/v2/report-cards/:id/pdf`.
- **Commentaire PP** sur bulletin : PATCH `/api/v2/report-cards/:id/comment`.
- `backend/src/utils/reportCards/` avec helpers et templates.

### Ce qui manque
- **Cartes d'identité scolaires** PDF (modèle à créer)
- **Tableaux d'honneur** PDF (liste des meilleurs élèves par classe/niveau)
- **Attestations de scolarité** avec signature et cachet
- **Attestations de résultats** (relevé de notes officiel)
- **Convocations** (examens, réunions) en PDF
- **Impression groupée** avec gestion de file d'attente
- **Éditeur de templates** permettant à l'admin de personnaliser les entêtes
- **Rapport de conseil de classe** PDF complet (PV officiel)
- Template **Lettre de transfert / sortie définitive**

### Fichiers concernés
- `backend/src/infrastructure/http/controllers/ReportCardController.ts`
- `backend/src/infrastructure/http/routes/reportCard.routes.ts`
- `backend/src/application/reportCard/GenererBulletinUseCase.ts`
- `backend/src/utils/reportCards/templates.ts`, `helpers.ts`
- `backend/src/infrastructure/services/PdfKitBulletinService.ts`
- `frontend/src/app/admin/dashboard/_components/SectionBulletins.tsx`
- `frontend/src/app/student/dashboard/_components/SectionStudentBulletins.tsx`
- `frontend/src/app/parent/dashboard/_components/` (bulletins parents)

---

## MODULE 11 — Sécurité & Sauvegarde des Données

**État : Partiellement fait (~45 %)**

### Ce qui existe concrètement
- **RBAC complet** : `UserRole` (5 rôles), `StaffPermissionType` (30+ permissions granulaires), `MasterUserRole` (4 niveaux).
- **Règles métier** : `StaffPermissionRules.ts` (vérification des droits par action).
- **Journal d'activité** : `ActivitiesLog`, `MasterAuthAudit`, `EmailLog`, `SmsLog`. GET `/api/v2/schools/:id/audit-logs`.
- **Authentification** : JWT + cookies httpOnly, rate limiting sur les endpoints sensibles, middleware `requireAuth` + `requireRole`.
- **3FA Master Admin** : `VerifyMfaUseCase` — authentification à 3 facteurs pour les super-admins.
- **Isolation multi-tenant** : toutes les requêtes filtrées par `schoolId`.

### Ce qui manque
- **Sauvegarde automatique** de la base de données (aucun scheduler Inngest ni cron pour dump PostgreSQL)
- **Restauration** depuis une sauvegarde (aucun endpoint ni procédure)
- **Export des données école** (RGPD/export total) — aucun endpoint `GET /api/v2/school/export`
- **Politique de rétention des logs** (suppression automatique des vieux logs)
- **Alertes de sécurité** (tentatives de connexion échouées, connexion depuis nouvelle IP)
- **Signature des PDF** générés (bulletins non signés cryptographiquement)
- **Audit log frontend** visible et filtrable par l'admin

### Fichiers concernés
- `backend/src/domain/rules/StaffPermissionRules.ts`
- `backend/src/infrastructure/http/middlewares/` (requireAuth, requireRole, rateLimiter)
- `backend/prisma/schema.prisma` (ActivitiesLog, MasterAuthAudit, EmailLog, SmsLog)
- `backend/src/application/masterAdmin/VerifyMfaUseCase.ts`
- `backend/src/infrastructure/config/hexagonal.bootstrap.ts` (routes audit)
- `frontend/src/app/master/dashboard/_components/SectionLogs.tsx`

---

## MODULE 12 — Gestion des Ressources Humaines

**État : Pas commencé (~10 %)**

### Ce qui existe concrètement
- **Profils de base** : `TeacherProfile` (spécialisation, supervisedSubjectIds), `StaffProfile` (titre, permissions) — données minimales pour le fonctionnement scolaire, pas un vrai DRH.
- **Permissions staff** : `StaffPermissionType` (30+ types) — autorisations dans le système, non gestion RH.
- **Affectations** : `TeachingAssignment` (enseignant ↔ matière ↔ classe).

### Ce qui manque
- **Dossier personnel complet** (diplômes, expérience, numéro CNPS/CPDM, acte de naissance, contrat)
- **Suivi de carrière** (avancements d'échelon, promotions, mutations)
- **Présences du personnel** (pointage enseignants/admin/technique) — distinct de la présence élèves
- **Gestion des congés/permissions** (demande, validation, solde de congés)
- **Paie** (aucun modèle de salaire)
- **Attestations de travail / bulletins de salaire** PDF
- **Ordres de mission** (déplacement, formation)
- **Évaluation des enseignants** par l'administration
- **Planning des surveillances** (examens, récréations)

### Fichiers concernés
- `backend/prisma/schema.prisma` (TeacherProfile, StaffProfile — à étendre massivement)
- `frontend/src/app/staff/dashboard/_components/SectionAffectations.tsx`
- Module entier à créer : `backend/src/application/hr/`, `backend/src/infrastructure/http/controllers/HRController.ts`

---

## MODULE 13 — Gestion de la Pédagogie

**État : Pas commencé (~5 %)**

### Ce qui existe concrètement
- `StaffPermissionType` contient : `SUPERVISE_LESSON_PLANS`, `MANAGE_PEDAGOGICAL_BRIEF`, `MANAGE_CE_REPORTS`, `GENERATE_PEDAGOGICAL_REPORTS` — les rôles sont définis mais **aucun modèle de données ni endpoint** ne les implémente.
- `SectionDepartementAP.tsx` est listé dans les composants teacher dashboard mais en état **pending / non finalisé**.

### Ce qui manque
- Modèle **Programme** (chapitres/leçons/objectifs par matière et séquence)
- **Cahier de texte numérique** (enseignant saisit ce qui a été fait chaque cours)
- **Suivi de la progression** (planifié vs réalisé)
- **Alertes de retard pédagogique** (classe X est à 60 % du programme en semaine 8/12)
- **Rapports pédagogiques** par enseignant, département, classe
- **Fiches de préparation** de cours (FICHE DE PRÉPARATION MINESEC)
- Frontend dédié pour les enseignants et les AP (Animateurs Pédagogiques)
- Tout le module est à construire de zéro

### Fichiers concernés
- `backend/prisma/schema.prisma` (aucun modèle Pedagogie — à créer entièrement)
- `frontend/src/app/teacher/dashboard/_components/SectionDepartementAP.tsx` (pending)
- Module entier à créer : `backend/src/application/pedagogie/`, modèles Prisma, routes, controllers

---

## RÉSUMÉ GLOBAL

| # | Module | % Complet | Tranche |
|---|---|---|---|
| 1 | Administration et Paramétrages | **70 %** | ≥ 70 % |
| 6 | Notes et Examens | **65 %** | 30–70 % |
| 2 | Planification et Emploi du Temps | **55 %** | 30–70 % |
| 4 | Gestion de la Scolarité | **55 %** | 30–70 % |
| 5 | Intendance et Comptabilité | **50 %** | 30–70 % |
| 11 | Sécurité & Sauvegarde | **45 %** | 30–70 % |
| 8 | Discipline Scolaire | **40 %** | 30–70 % |
| 9 | Publipostages et Communications | **35 %** | 30–70 % |
| 10 | Rapports et États | **35 %** | 30–70 % |
| 7 | Rapports & Statistiques | **20 %** | < 30 % |
| 12 | Gestion des RH | **10 %** | < 30 % |
| 3 | Contrôle d'Accès (physique) | **5 %** | < 30 % |
| 13 | Gestion de la Pédagogie | **5 %** | < 30 % |

**1 module ≥ 70 % · 8 modules 30–70 % · 4 modules < 30 %**

---

## LES 5 CHANTIERS LES PLUS URGENTS

*Objectif : couverture fonctionnelle équivalente à Logesco le plus rapidement possible.*

### 1. Module 4 — Documents scolarité (attestations, certificats, cartes élèves)
**Effort : ~2 semaines · Impact : immédiat et visible**

C'est la demande n°1 des établissements lors des inscriptions. Le modèle `StudentProfile` contient déjà matricule, classe, photo éventuelle. Il suffit de créer des templates PdfKit pour :
- Certificat de scolarité (avec cachet numérique)
- Carte d'identité scolaire (recto/verso avec photo)
- Lettre de transfert

Endpoints : GET `/api/v2/students/:id/certificat`, GET `/api/v2/students/:id/carte`.

### 2. Module 6 — Import Excel des notes
**Effort : ~1 semaine · Impact : adoption par les enseignants**

Le template Excel de saisie existe déjà (`TemplateController`). Il manque seulement l'endpoint d'import qui parse le fichier et appelle `SaisirNoteUseCase` en masse. Sans ça, les enseignants avec 40+ élèves abandonnent la saisie manuelle.

Endpoint : POST `/api/v2/grades/import` (multipart/form-data, Excel → BulkDraftUseCase).

### 3. Module 7 — Tableau de bord statistique avec graphes
**Effort : ~3 semaines · Impact : directement vu par les directeurs**

C'est ce que les directeurs montrent lors des réunions. Logesco a des graphes d'évolution. Il faut :
- Backend : endpoints analytiques (moyennes par période/classe/matière, répartition mentions)
- Frontend : intégrer Recharts ou Chart.js dans `SectionDashboard`

Sans graphes, EduNexus semble "plat" par rapport à la concurrence même si la logique métier est plus avancée.

### 4. Module 9 — Publipostage SMS/email en masse
**Effort : ~1.5 semaine · Impact : fonctionnalité premium très demandée**

L'infrastructure existe (SmsLog, emailService, SchoolNotificationSettings). Il manque :
- Endpoint POST `/api/v2/communications/broadcast` (ciblage par rôle/classe/statut)
- Section frontend dans le dashboard admin/staff avec prévisualisation + confirmation
- Intégration avec les templates de messages

C'est une fonctionnalité que les parents et enseignants voient directement et qui différencie EduNexus.

### 5. Module 10 — Tableau d'honneur + PV de délibération PDF
**Effort : ~1 semaine · Impact : visible à chaque fin de trimestre**

À chaque fin de séquence, les établissements impriment le tableau d'honneur et le PV de délibération. Les données existent déjà dans `ReportCard` et `ClassCouncilSession`. Il suffit de créer les templates PDF PdfKit et les endpoints de génération.

---

## CE QU'EDUNEXUS FAIT MIEUX QUE LOGESCO

### 1. Sous-système anglophone GCE — différenciation unique
Logesco est entièrement francophone. EduNexus est le **seul outil** à implémenter :
- `OLevelSubject` + `ALevelSubject` avec codes officiels GCE Board
- `OLevelGrade` (A→U) + `ALevelGrade` (A→F) — grading britannique complet
- `AnglophoneStreamCombination` (A1-A5 ARTS, S1-S4 SCIENCES)
- Templates PDF EN_SECONDARY et MONTHLY pour les bulletins anglophones
- `Section.gradingSystem` = OUT_OF_100 (anglophone) vs OUT_OF_20 (francophone)
- `SequenceType.CLASS_TEST` + `TERMINAL_EXAM` (structure anglophone)

**Cible : les 8 régions anglophones + les établissements bilingues** — marché absent chez Logesco.

### 2. Mobile Money intégré (CampPay MTN + Orange Money)
Logesco gère la comptabilité mais ne traite pas les paiements mobile en temps réel. EduNexus a :
- Webhook CampPay avec confirmation automatique des paiements
- Initiation paiement MTN MoMo + Orange Money depuis le portail parent
- `Payment.campayRef` pour la traçabilité
- `PaymentMethod.EXPRESS_UNION` (réseau de transfert local)

**Impact : les parents paient depuis leur téléphone sans se déplacer** — différenciation majeure en zone semi-urbaine.

### 3. Rôles réglementaires camerounais
Logesco utilise des rôles génériques (admin, enseignant, comptable). EduNexus modélise la réalité MINESEC :
- **Censeur** (vice-principal, gère discipline et notes)
- **Surveillant Général** (gère présences et discipline terrain)
- **Proviseur / Principal** (validations finales)
- **Animateur Pédagogique (AP)** — rôle `apDesignation` endpoint
- `StaffPermissionType` avec 30+ permissions granulaires correspondant aux attributions légales

### 4. Architecture SaaS multi-école
Logesco est mono-installation. EduNexus est SaaS-natif :
- Multi-tenant par `schoolId` (isolation totale)
- `MasterUser` avec 4 niveaux (SUPER_ADMIN, PLATFORM_ADMIN, SCHOOL_MANAGER, SUPPORT)
- 3FA pour les master admins
- Système d'invitation par token + workflow d'approbation
- Plans d'abonnement (DISCOVERY/STANDARD/PREMIUM) avec `School.plan`
- Suspension/réactivation d'écoles depuis le master dashboard

### 5. Module d'orientation scolaire (inédit)
Logesco n'a pas de module orientation. EduNexus a :
- `FicheOrientation` avec niveau de risque (FAIBLE/MOYEN/ELEVE/CRITIQUE)
- `EntretienOrientation` (individuel/groupe/avec parent)
- `TestAptitude` (cognitif, intérêts professionnels, personnalité, psychotechnique)
- `RecommandationSerie` avec validation parent + admin
- `SuiviOrientation` — suivi longitudinal

**Cible différenciante : lycées qui doivent guider les 3e vers les filières BAC.**

### 6. Coefficients officiels MINESEC embarqués
- `BacCoefficient` : table complète des coefficients BAC par série (A4, C, D, TI…) et niveau (Tle, 1ère…) — source officielle MINESEC
- `CycleCoefficient` : 1er cycle et primaire
- Ces données ne se paramètrent pas — elles sont exactement celles des textes officiels

### 7. Mode offline-first
- `OfflineQueue` avec PENDING/SYNCED/CONFLICT/REJECTED
- `SectionOfflineStatus.tsx` dans le dashboard enseignant
- **Cible : établissements en zones rurales avec coupures internet fréquentes**

### 8. Intelligence Artificielle intégrée
- `CalculerIndiceSanteUseCase` — score de santé scolaire par élève (risque de décrochage)
- `Exam.isAiGenerated` — génération d'examens par IA (Gemini)
- `ReportCard.aiComment` — commentaire AI sur le bulletin
- `Notification.type === AI_ALERT` — alertes automatiques

---

## STACK TECHNIQUE — POINTS DE FORCE CACHÉS

| Aspect | Détail |
|---|---|
| **Architecture** | Hexagonale stricte (domain/application/infrastructure) — maintenable et testable |
| **Tests** | InMemory repositories pour chaque use case — couverture domaine solide |
| **Validation** | DTO layer sur toutes les entrées HTTP |
| **Rate limiting** | Appliqué sur toutes les opérations sensibles (notes, bulletins, paiements) |
| **Erreurs domaine** | Classes d'erreur typées (BulletinBloqueError, ConflitHoraireError, SeparationOrdonnateurError…) |
| **17 templates** | La concurrence ne couvre généralement que 3-5 types d'établissements |
| **Inngest** | Infrastructure jobs asynchrones disponible (non utilisée à grande échelle encore) |

---

*Rapport généré le 30/06/2026 — à mettre à jour à chaque fin de sprint.*
