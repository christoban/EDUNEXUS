# EDUNEXUS - Analyse complète du système

Date: 2026-04-16

Ce document décrit le dépôt tel qu'il existe aujourd'hui. L'objectif est simple: qu'un lecteur technique comprenne rapidement ce que fait le système, où se trouvent les responsabilités, ce qui est réellement en place, ce qui reste partiel, et où sont les points d'attention.

## 1. Résumé exécutif

EDUNEXUS est une plateforme scolaire full-stack qui mélange trois blocs principaux:

1. Un noyau de gestion scolaire classique: utilisateurs, classes, matières, année académique, paramètres d'école, journal d'activité.
2. Un noyau LMS: examens, génération IA des examens et des emplois du temps, soumission des copies, correction automatique, consultation des résultats.
3. Une couche d'expérience métier: dashboards par rôle, traduction FR/EN, logique bilingue, modules finance, parent, emails et SMS.

Le projet n'est pas un simple squelette. Le cœur métier académique est déjà réel et branché. En revanche, certains sous-domaines restent plus ou moins matures selon les fichiers: l'architecture existe, mais la profondeur fonctionnelle n'est pas homogène partout.

## 2. Ce que le système fait vraiment

### 2.1 Authentification et autorisations

- Authentification JWT.
- Stockage du token dans un cookie httpOnly côté backend et usage local du token côté frontend dans certains cas.
- RBAC par rôle: admin, teacher, student, parent.
- Guards frontend et backend pour limiter l'accès aux routes.

### 2.2 Gestion scolaire

- Gestion des utilisateurs.
- Gestion des années académiques.
- Gestion des classes et des matières.
- Affectation des enseignants aux matières.
- Liaison des élèves à leur classe.

### 2.3 LMS / Académique avancé

- Génération d'emplois du temps assistée par IA.
- Génération d'examens assistée par IA.
- Soumission des examens côté étudiant.
- Calcul automatique des résultats.
- Consultation des bulletins / report cards selon l'état des données.

### 2.4 Communication et reporting

- Journal d'activité.
- Historique d'emails.
- Services email et SMS présents.
- Génération de documents PDF sur certains flux.

### 2.5 Expérience utilisateur

- UI moderne React + Vite.
- Navigation par rôle.
- Traduction FR/EN.
- Logique de langue de l'utilisateur et de l'école.

## 3. Arborescence mentale du projet

Le dépôt est organisé en deux applications principales:

- backend: API Express + MongoDB + Inngest + génération PDF + services de notifications.
- frontend: SPA React avec routing, gestion de session, pages métier et composants réutilisables.

Les fichiers racine servent surtout au packaging et à la documentation.

## 4. Fichiers racine

| Fichier | Rôle |
|---|---|
| [package.json](package.json) | Dépendance racine légère; sert surtout de support au workspace, avec `nodemailer` déclaré ici. |
| [README.md](README.md) | Présentation produit générale du projet. |
| [README_AUDIT_SYSTEME.md](README_AUDIT_SYSTEME.md) | Audit technique plus ancien et plus critique du dépôt. |
| [SYSTEME_ANALYSE_COMPLETE.md](SYSTEME_ANALYSE_COMPLETE.md) | Ce document: vue consolidée et lisible de tout le système. |

## 5. Backend: ce que fait chaque fichier important

### 5.1 Point d'entrée et configuration

| Fichier | Rôle |
|---|---|
| [backend/package.json](backend/package.json) | Scripts backend, dépendances Express/Mongoose/Inngest/AI/PDF/email. |
| [backend/src/server.ts](backend/src/server.ts) | Démarrage de l'API Express, middleware globaux, montage des routes, gestion d'erreurs, endpoint de santé. |
| [backend/src/config/db.ts](backend/src/config/db.ts) | Connexion MongoDB via Mongoose. |

### 5.2 Middleware

| Fichier | Rôle |
|---|---|
| [backend/src/middleware/auth.ts](backend/src/middleware/auth.ts) | Protection JWT et vérification des rôles. |
| [backend/src/middleware/validate.ts](backend/src/middleware/validate.ts) | Validation des payloads côté API à partir de schémas. |
| [backend/src/middleware/rateLimit.ts](backend/src/middleware/rateLimit.ts) | Limitation de débit sur les endpoints sensibles. |

### 5.3 Contrôleurs métier

| Fichier | Rôle |
|---|---|
| [backend/src/controllers/user.ts](backend/src/controllers/user.ts) | Auth, profil, CRUD utilisateurs, affectations liées aux rôles et aux classes/matières. |
| [backend/src/controllers/academicYear.ts](backend/src/controllers/academicYear.ts) | CRUD des années académiques et définition de l'année active. |
| [backend/src/controllers/class.ts](backend/src/controllers/class.ts) | Gestion des classes, capacités, enseignants, élèves et matières associées. |
| [backend/src/controllers/subject.ts](backend/src/controllers/subject.ts) | Gestion des matières et de leurs affectations enseignants. |
| [backend/src/controllers/timetable.ts](backend/src/controllers/timetable.ts) | Création, lecture et orchestration des emplois du temps. |
| [backend/src/controllers/exam.ts](backend/src/controllers/exam.ts) | Gestion des examens, génération IA, publication, soumission et résultats. |
| [backend/src/controllers/dashboard.ts](backend/src/controllers/dashboard.ts) | Agrégations pour les dashboards par rôle. |
| [backend/src/controllers/attendance.ts](backend/src/controllers/attendance.ts) | Logique de présence/absence. |
| [backend/src/controllers/reportCard.ts](backend/src/controllers/reportCard.ts) | Bulletin / report card, lecture et génération PDF selon les flux disponibles. |
| [backend/src/controllers/finance.ts](backend/src/controllers/finance.ts) | Domaine finance: frais, factures, paiements, dépenses, relances et reçus. |
| [backend/src/controllers/parent.ts](backend/src/controllers/parent.ts) | Vue et actions liées au rôle parent. |
| [backend/src/controllers/search.ts](backend/src/controllers/search.ts) | Recherche transversale. |
| [backend/src/controllers/activitieslog.ts](backend/src/controllers/activitieslog.ts) | Consultation du journal d'activité. |
| [backend/src/controllers/schoolSettings.ts](backend/src/controllers/schoolSettings.ts) | Paramètres globaux de l'école: nom, slogan, logo, langue, mode scolaire. |
| [backend/src/controllers/emailLog.ts](backend/src/controllers/emailLog.ts) | Historique des emails envoyés. |
| [backend/src/controllers/ai.ts](backend/src/controllers/ai.ts) | Entrées liées aux fonctions IA ou aux assistants. |

### 5.4 Routes

| Fichier | Rôle |
|---|---|
| [backend/src/routes/user.ts](backend/src/routes/user.ts) | Routes d'authentification et de gestion utilisateurs. |
| [backend/src/routes/academicYear.ts](backend/src/routes/academicYear.ts) | Routes des années académiques. |
| [backend/src/routes/class.ts](backend/src/routes/class.ts) | Routes des classes. |
| [backend/src/routes/subject.ts](backend/src/routes/subject.ts) | Routes des matières. |
| [backend/src/routes/timetable.ts](backend/src/routes/timetable.ts) | Routes des emplois du temps et de leur génération. |
| [backend/src/routes/exam.ts](backend/src/routes/exam.ts) | Routes des examens et soumissions. |
| [backend/src/routes/dashboard.ts](backend/src/routes/dashboard.ts) | Routes de statistiques dashboard. |
| [backend/src/routes/attendance.ts](backend/src/routes/attendance.ts) | Routes de présence. |
| [backend/src/routes/reportCard.ts](backend/src/routes/reportCard.ts) | Routes des bulletins et exports PDF. |
| [backend/src/routes/finance.ts](backend/src/routes/finance.ts) | Routes finance. |
| [backend/src/routes/parent.ts](backend/src/routes/parent.ts) | Routes parent. |
| [backend/src/routes/search.ts](backend/src/routes/search.ts) | Routes de recherche. |
| [backend/src/routes/activitieslog.ts](backend/src/routes/activitieslog.ts) | Routes journal d'activité. |
| [backend/src/routes/schoolSettings.ts](backend/src/routes/schoolSettings.ts) | Routes paramètres d'école. |
| [backend/src/routes/emailLog.ts](backend/src/routes/emailLog.ts) | Routes historique emails. |
| [backend/src/routes/ai.ts](backend/src/routes/ai.ts) | Routes IA / assistants. |

### 5.5 Modèles MongoDB

| Fichier | Rôle |
|---|---|
| [backend/src/models/user.ts](backend/src/models/user.ts) | Utilisateur, rôles, préférences de langue, liaison parent/enfant, classe, matières. |
| [backend/src/models/academicYear.ts](backend/src/models/academicYear.ts) | Année académique. |
| [backend/src/models/class.ts](backend/src/models/class.ts) | Classe et relations avec enseignants, élèves et matières. |
| [backend/src/models/subject.ts](backend/src/models/subject.ts) | Matière et affectation aux enseignants. |
| [backend/src/models/attendance.ts](backend/src/models/attendance.ts) | Enregistrements de présence. |
| [backend/src/models/exam.ts](backend/src/models/exam.ts) | Examen et questions intégrées. |
| [backend/src/models/examGeneration.ts](backend/src/models/examGeneration.ts) | Suivi de génération d'examens. |
| [backend/src/models/submission.ts](backend/src/models/submission.ts) | Soumission d'un étudiant à un examen. |
| [backend/src/models/timetable.ts](backend/src/models/timetable.ts) | Emploi du temps final. |
| [backend/src/models/timetableGeneration.ts](backend/src/models/timetableGeneration.ts) | Suivi de génération d'emploi du temps. |
| [backend/src/models/reportCard.ts](backend/src/models/reportCard.ts) | Bulletin / report card de synthèse. |
| [backend/src/models/grade.ts](backend/src/models/grade.ts) | Note ou agrégat de note. |
| [backend/src/models/feePlan.ts](backend/src/models/feePlan.ts) | Plan de frais. |
| [backend/src/models/invoice.ts](backend/src/models/invoice.ts) | Facture scolaire. |
| [backend/src/models/payment.ts](backend/src/models/payment.ts) | Paiement enregistré. |
| [backend/src/models/expense.ts](backend/src/models/expense.ts) | Dépense. |
| [backend/src/models/emailLog.ts](backend/src/models/emailLog.ts) | Historique d'email. |
| [backend/src/models/activitieslog.ts](backend/src/models/activitieslog.ts) | Journal d'activité. |
| [backend/src/models/schoolSettings.ts](backend/src/models/schoolSettings.ts) | Paramètres globaux de l'école. |

### 5.6 Inngest / jobs asynchrones

| Fichier | Rôle |
|---|---|
| [backend/src/inngest/index.ts](backend/src/inngest/index.ts) | Initialisation du client Inngest. |
| [backend/src/inngest/functions.ts](backend/src/inngest/functions.ts) | Fonctions asynchrones: génération d'emploi du temps, génération d'examens, correction, autres workflows différés. |

### 5.7 Services, utils et validation

| Fichier | Rôle |
|---|---|
| [backend/src/services/emailService.ts](backend/src/services/emailService.ts) | Envoi d'emails. |
| [backend/src/services/smsService.ts](backend/src/services/smsService.ts) | Envoi de SMS. |
| [backend/src/utils/generateToken.ts](backend/src/utils/generateToken.ts) | Génération des JWT. |
| [backend/src/utils/activitieslog.ts](backend/src/utils/activitieslog.ts) | Helper de création d'entrée d'activité. |
| [backend/src/utils/emailTemplates.ts](backend/src/utils/emailTemplates.ts) | Templates d'emails transactionnels. |
| [backend/src/utils/reporting.ts](backend/src/utils/reporting.ts) | Aides à la génération de rapports et de PDF. |
| [backend/src/utils/languageHelper.ts](backend/src/utils/languageHelper.ts) | Résolution de langue selon école, rôle, section et préférence utilisateur. |
| [backend/src/utils/schoolSettings.ts](backend/src/utils/schoolSettings.ts) | Lecture et normalisation des paramètres d'école. |
| [backend/src/validation/schemas.ts](backend/src/validation/schemas.ts) | Schémas de validation d'entrée pour les payloads API. |

### 5.8 Script utilitaire

| Fichier | Rôle |
|---|---|
| [backend/src/scripts/seed-week4.ts](backend/src/scripts/seed-week4.ts) | Script de seed / initialisation de données de test. |

## 6. Frontend: ce que fait chaque fichier important

### 6.1 Entrée de l'application

| Fichier | Rôle |
|---|---|
| [frontend/package.json](frontend/package.json) | Scripts frontend, dépendances React/Vite/Tailwind/Router/UI. |
| [frontend/src/main.tsx](frontend/src/main.tsx) | Point d'entrée React; charge le router, le thème, le toaster et le provider d'authentification. |
| [frontend/src/App.tsx](frontend/src/App.tsx) | Template Vite de démonstration, conservé comme fichier de starter; il n'est pas le vrai shell fonctionnel de l'app. |
| [frontend/src/index.css](frontend/src/index.css) | Styles globaux. |
| [frontend/src/App.css](frontend/src/App.css) | Styles hérités du template Vite. |
| [frontend/src/types.ts](frontend/src/types.ts) | Types TypeScript partagés côté UI. |

### 6.2 Hooks / contexte / état applicatif

| Fichier | Rôle |
|---|---|
| [frontend/src/hooks/AuthProvider.tsx](frontend/src/hooks/AuthProvider.tsx) | Contexte global de session: bootstrap du profil utilisateur et de l'année académique. |
| [frontend/src/hooks/useUILanguage.ts](frontend/src/hooks/useUILanguage.ts) | Résolution de la langue d'interface selon l'utilisateur et la configuration d'école. |
| [frontend/src/hooks/use-mobile.ts](frontend/src/hooks/use-mobile.ts) | Détection d'un affichage mobile. |
| [frontend/src/hooks/use-toast.ts](frontend/src/hooks/use-toast.ts) | Helper de toasts. |

### 6.3 Bibliothèques frontend

| Fichier | Rôle |
|---|---|
| [frontend/src/lib/api.ts](frontend/src/lib/api.ts) | Client Axios central avec token, interception des erreurs et redirection login. |
| [frontend/src/lib/i18n.ts](frontend/src/lib/i18n.ts) | Dictionnaire FR/EN et helper de traduction. |
| [frontend/src/lib/roleAccess.ts](frontend/src/lib/roleAccess.ts) | Détermine les chemins accessibles par rôle. |
| [frontend/src/lib/accessPolicy.ts](frontend/src/lib/accessPolicy.ts) | Politique d'accès aux menus et routes. |
| [frontend/src/lib/utils.ts](frontend/src/lib/utils.ts) | Utilitaires génériques frontend. |

### 6.4 Routing

| Fichier | Rôle |
|---|---|
| [frontend/src/pages/routes/router.tsx](frontend/src/pages/routes/router.tsx) | Définition des routes publiques et protégées. |
| [frontend/src/pages/routes/PrivateRoutes.tsx](frontend/src/pages/routes/PrivateRoutes.tsx) | Guard principal des routes protégées. |
| [frontend/src/pages/routes/RoleGuard.tsx](frontend/src/pages/routes/RoleGuard.tsx) | Guard de rôles pour une page ou un chemin donné. |

### 6.5 Pages principales

| Fichier | Rôle |
|---|---|
| [frontend/src/pages/Home.tsx](frontend/src/pages/Home.tsx) | Page d'accueil publique / marketing / accès rapide selon la structure de route. |
| [frontend/src/pages/Login.tsx](frontend/src/pages/Login.tsx) | Page de connexion. |
| [frontend/src/pages/Dashboard.tsx](frontend/src/pages/Dashboard.tsx) | Dashboard principal après authentification. |

### 6.6 Pages académiques

| Fichier | Rôle |
|---|---|
| [frontend/src/pages/academics/Classes.tsx](frontend/src/pages/academics/Classes.tsx) | Gestion des classes. |
| [frontend/src/pages/academics/Subjects.tsx](frontend/src/pages/academics/Subjects.tsx) | Gestion des matières. |
| [frontend/src/pages/academics/Timetable.tsx](frontend/src/pages/academics/Timetable.tsx) | Génération et consultation des emplois du temps. |
| [frontend/src/pages/academics/Attendance.tsx](frontend/src/pages/academics/Attendance.tsx) | Présence / absence. |

### 6.7 Pages LMS

| Fichier | Rôle |
|---|---|
| [frontend/src/pages/lms/Exams.tsx](frontend/src/pages/lms/Exams.tsx) | Listing et gestion des examens. |
| [frontend/src/pages/lms/Exam.tsx](frontend/src/pages/lms/Exam.tsx) | Passation d'un examen ou consultation détaillée selon le rôle. |
| [frontend/src/pages/lms/ReportCards.tsx](frontend/src/pages/lms/ReportCards.tsx) | Consultation des bulletins / report cards. |

### 6.8 Pages finance

| Fichier | Rôle |
|---|---|
| [frontend/src/pages/finance/FeePlans.tsx](frontend/src/pages/finance/FeePlans.tsx) | Plans de frais. |
| [frontend/src/pages/finance/Invoices.tsx](frontend/src/pages/finance/Invoices.tsx) | Factures. |
| [frontend/src/pages/finance/Payments.tsx](frontend/src/pages/finance/Payments.tsx) | Paiements et reçus. |
| [frontend/src/pages/finance/Expenses.tsx](frontend/src/pages/finance/Expenses.tsx) | Dépenses. |
| [frontend/src/pages/finance/OverdueAndReminders.tsx](frontend/src/pages/finance/OverdueAndReminders.tsx) | Impayés et relances. |

### 6.9 Pages settings / administration

| Fichier | Rôle |
|---|---|
| [frontend/src/pages/settings/academic-year.tsx](frontend/src/pages/settings/academic-year.tsx) | Création et sélection de l'année académique active. |
| [frontend/src/pages/settings/EmailHistory.tsx](frontend/src/pages/settings/EmailHistory.tsx) | Historique des emails. |
| [frontend/src/pages/settings/SchoolSettings.tsx](frontend/src/pages/settings/SchoolSettings.tsx) | Paramètres généraux de l'école: nom, slogan, logo, calendrier, mode linguistique. |
| [frontend/src/pages/settings/Subjects.tsx](frontend/src/pages/settings/Subjects.tsx) | Gestion administrative des matières. |

### 6.10 Pages utilisateurs

| Fichier | Rôle |
|---|---|
| [frontend/src/pages/users/index.tsx](frontend/src/pages/users/index.tsx) | Administration des utilisateurs. |

### 6.11 Portail parent

| Fichier | Rôle |
|---|---|
| [frontend/src/pages/parent/ParentDashboard.tsx](frontend/src/pages/parent/ParentDashboard.tsx) | Tableau de bord parent. |
| [frontend/src/pages/parent/ParentSettings.tsx](frontend/src/pages/parent/ParentSettings.tsx) | Réglages parent. |
| [frontend/src/pages/parent/ChildDetails.tsx](frontend/src/pages/parent/ChildDetails.tsx) | Détail d'un enfant. |

### 6.12 Composants métier

| Fichier | Rôle |
|---|---|
| [frontend/src/components/auth/UniversalUserForm.tsx](frontend/src/components/auth/UniversalUserForm.tsx) | Formulaire commun login/register ou édition utilisateur selon le type. |
| [frontend/src/components/users/UserTable.tsx](frontend/src/components/users/UserTable.tsx) | Tableau des utilisateurs. |
| [frontend/src/components/users/UserDialog.tsx](frontend/src/components/users/UserDialog.tsx) | Dialog de création/édition utilisateur. |
| [frontend/src/components/academic-year/AcademicYearForm.tsx](frontend/src/components/academic-year/AcademicYearForm.tsx) | Formulaire année académique. |
| [frontend/src/components/academic-year/academic-year-table.tsx](frontend/src/components/academic-year/academic-year-table.tsx) | Tableau des années académiques. |
| [frontend/src/components/academic-year/schema.ts](frontend/src/components/academic-year/schema.ts) | Schéma de validation frontend pour les années académiques. |
| [frontend/src/components/classes/ClassForm.tsx](frontend/src/components/classes/ClassForm.tsx) | Formulaire de classe. |
| [frontend/src/components/classes/ClassTable.tsx](frontend/src/components/classes/ClassTable.tsx) | Tableau des classes. |
| [frontend/src/components/classes/schema.ts](frontend/src/components/classes/schema.ts) | Schéma de validation frontend pour les classes. |
| [frontend/src/components/subjects/SubjectForm.tsx](frontend/src/components/subjects/SubjectForm.tsx) | Formulaire de matière. |
| [frontend/src/components/subjects/SubjectTable.tsx](frontend/src/components/subjects/SubjectTable.tsx) | Tableau des matières. |
| [frontend/src/components/subjects/schema.ts](frontend/src/components/subjects/schema.ts) | Schéma de validation frontend pour les matières. |
| [frontend/src/components/timetable/GeneratorControls.tsx](frontend/src/components/timetable/GeneratorControls.tsx) | Contrôles de génération d'emploi du temps. |
| [frontend/src/components/timetable/TimetableGrid.tsx](frontend/src/components/timetable/TimetableGrid.tsx) | Grille d'affichage de l'emploi du temps. |
| [frontend/src/components/lms/ExamGenerator.tsx](frontend/src/components/lms/ExamGenerator.tsx) | Interface de génération d'examen. |
| [frontend/src/components/lms/ExamRadio.tsx](frontend/src/components/lms/ExamRadio.tsx) | Option de réponse d'examen type radio. |
| [frontend/src/components/dashboard/dashboard-stats.tsx](frontend/src/components/dashboard/dashboard-stats.tsx) | Cartes de statistiques du dashboard. |
| [frontend/src/components/dashboard/ai-insight-widget.tsx](frontend/src/components/dashboard/ai-insight-widget.tsx) | Widget d'insight IA. |
| [frontend/src/components/dashboard/parent-dashboard.tsx](frontend/src/components/dashboard/parent-dashboard.tsx) | Composant de dashboard parent. |
| [frontend/src/components/home/Hero.tsx](frontend/src/components/home/Hero.tsx) | Bloc hero de la page d'accueil. |
| [frontend/src/components/home/Navbar.tsx](frontend/src/components/home/Navbar.tsx) | Barre de navigation de la page d'accueil. |
| [frontend/src/components/home/Programs.tsx](frontend/src/components/home/Programs.tsx) | Section programmes / offres. |
| [frontend/src/components/home/Stats.tsx](frontend/src/components/home/Stats.tsx) | Section chiffres / stats. |
| [frontend/src/components/home/Footer.tsx](frontend/src/components/home/Footer.tsx) | Pied de page. |
| [frontend/src/components/sidebar/AppSidebar.tsx](frontend/src/components/sidebar/AppSidebar.tsx) | Sidebar principale de l'app protégée. |
| [frontend/src/components/sidebar/nav-main.tsx](frontend/src/components/sidebar/nav-main.tsx) | Navigation principale dans la sidebar. |
| [frontend/src/components/sidebar/nav-user.tsx](frontend/src/components/sidebar/nav-user.tsx) | Bloc profil utilisateur dans la sidebar. |
| [frontend/src/components/sidebar/team-switcher.tsx](frontend/src/components/sidebar/team-switcher.tsx) | Sélecteur d'école / contexte. |
| [frontend/src/components/sidebar/ThemeToogle.tsx](frontend/src/components/sidebar/ThemeToogle.tsx) | Basculer thème clair/sombre. |
| [frontend/src/components/global/Search.tsx](frontend/src/components/global/Search.tsx) | Composant de recherche globale. |
| [frontend/src/components/global/Modal.tsx](frontend/src/components/global/Modal.tsx) | Modal générique. |
| [frontend/src/components/global/CustomSelect.tsx](frontend/src/components/global/CustomSelect.tsx) | Select personnalisé. |
| [frontend/src/components/global/CustomPagination.tsx](frontend/src/components/global/CustomPagination.tsx) | Pagination personnalisée. |
| [frontend/src/components/global/CustomMultiSelect.tsx](frontend/src/components/global/CustomMultiSelect.tsx) | Multi-select personnalisé. |
| [frontend/src/components/global/CustomInput.tsx](frontend/src/components/global/CustomInput.tsx) | Input personnalisé. |
| [frontend/src/components/global/CustomAlert.tsx](frontend/src/components/global/CustomAlert.tsx) | Alerte personnalisée. |
| [frontend/src/components/provider/theme.tsx](frontend/src/components/provider/theme.tsx) | Provider thème global. |

### 6.13 UI primitives

Le dossier [frontend/src/components/ui](frontend/src/components/ui) contient les primitives réutilisables de type shadcn/radix: boutons, cards, dialog, select, table, tabs, accordion, alert, avatar, checkbox, dropdown, menu, popover, progress, slider, skeleton, sidebar, sheet, separator, scroll-area, toast, etc.

Ces fichiers ne portent généralement pas de logique métier; ils servent à construire l'interface de manière cohérente.

### 6.14 Assets

Le dossier [frontend/src/assets](frontend/src/assets) contient les ressources statiques: images, icônes et illustrations utilisées par l'UI.

## 7. Données métier et relations principales

Les modèles backend décrivent les entités principales du système:

- User: identité, rôle, préférences de langue, lien parent/enfant, classe, matières.
- AcademicYear: contexte de l'année scolaire active.
- Class: regroupement des élèves et matières.
- Subject: discipline scolaire et enseignants associés.
- Exam: examen généré ou rédigé, lié à une matière, une classe et un enseignant.
- Submission: copie d'étudiant et note calculée.
- Timetable: emploi du temps final publié.
- TimetableGeneration / ExamGeneration: suivi des jobs IA.
- ReportCard / Grade: synthèse de performance et bulletin.
- Attendance: présence/absence.
- FeePlan / Invoice / Payment / Expense: finance scolaire.
- SchoolSettings: paramètres globaux de l'école.
- ActivitiesLog / EmailLog: traçabilité.

## 8. Flux utilisateur principaux

### 8.1 Connexion

1. L'utilisateur se connecte sur la page login.
2. Le frontend stocke ou lit le token.
3. Le provider auth charge le profil courant et l'année active.
4. Les routes protégées s'affichent selon le rôle.

### 8.2 Gestion académique

1. L'admin prépare l'année académique.
2. L'admin gère classes et matières.
3. Les enseignants sont rattachés aux matières.
4. Les étudiants sont liés à leur classe.

### 8.3 Emploi du temps

1. L'utilisateur autorisé configure les contraintes.
2. Une tâche Inngest génère le planning.
3. Le planning est sauvegardé et affiché.

### 8.4 Examens

1. L'enseignant crée ou demande une génération IA.
2. L'examen est publié.
3. L'étudiant répond et soumet.
4. Le backend calcule le résultat.
5. Le résultat est consultable.

### 8.5 Paramètres de langue

Le système a une logique de langue importante:

- le mode de l'école peut être francophone, anglophone ou bilingue;
- l'interface tient compte du profil utilisateur et des préférences;
- en mode bilingue, la section et la préférence personnelle prennent plus d'importance;
- les parents gardent leur préférence propre.

## 9. État de maturité par module

### 9.1 Solide et bien présent

- Authentification.
- RBAC.
- Classes.
- Matières.
- Années académiques.
- Emplois du temps IA.
- Examens IA.
- Soumission et correction.
- Dashboard de base.
- Journal d'activité.

### 9.2 Présent mais encore à durcir

- Présence.
- Bulletin / report card.
- Recherche transversale.
- Historique d'emails.
- Paramètres d'école.
- Finance selon le niveau de finalisation métier.
- Portail parent.

### 9.3 À surveiller comme dette technique

- [frontend/src/App.tsx](frontend/src/App.tsx) est un reste de template Vite et n'est pas le vrai shell applicatif.
- Les primitives UI dans [frontend/src/components/ui](frontend/src/components/ui) sont nombreuses et standard; elles alourdissent la surface du dépôt sans ajouter de logique métier.
- Certaines routes ou écrans peuvent exister avant que le backend correspondant soit pleinement mature.

## 10. Ce qu'un professionnel devrait retenir immédiatement

1. La base technique est bonne: TypeScript, séparation front/back, RBAC, MongoDB, Inngest, IA.
2. La logique métier scolaire est sérieuse sur le noyau académique.
3. Le système est plus fort en génération, orchestration et consultation qu'en workflows transactionnels complets.
4. Le point critique reste la cohérence produit entre ce que l'UI expose et ce que le backend garantit réellement.
5. La gouvernance de langue, de rôle et de section est un sujet transversal qui doit rester synchronisé partout.

## 11. Recommandations professionnelles

### Sécurité et robustesse

- Généraliser la validation stricte de toutes les entrées API.
- Conserver un vrai contrôle de débit sur les endpoints sensibles.
- Vérifier chaque route d'administration par un test d'autorisation explicite.

### Produit et cohérence

- Masquer ou désactiver les menus qui ne pointent pas encore vers un flux fini.
- Garder la logique de langue et de mode d'école dans un seul référentiel métier si possible.
- Documenter clairement ce qui est fonctionnel, partiel ou en attente.

### Qualité de maintenance

- Retirer progressivement les fichiers template qui ne servent plus.
- Éviter les doublons de logique entre frontend et backend.
- Stabiliser les modèles avant d'ajouter d'autres modules transverses.

## 12. Verdict final

EDUNEXUS n'est pas un simple prototype. C'est une base déjà utile pour une vraie plateforme scolaire, avec des briques centrales en place. Le meilleur résumé honnête est le suivant:

- le cœur académique et LMS existe déjà;
- la couche de communication, finance, parent et reporting doit encore être consolidée;
- la qualité finale dépend maintenant de la cohérence métier, des validations et de la finition produit.

Si un professionnel lit ce document, il comprendra rapidement où va le système, ce qui marche, ce qui est partiel, et où investir les prochains efforts.