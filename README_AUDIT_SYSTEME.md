# Audit Technique EDUNEXUS (Backend + Plateforme)

Date: 2026-04-14  
Portée: audit du repository actuel (backend prioritaire, frontend en support)  
Objectif: savoir exactement ce qui est fait, ce qui est partiel, ce qui manque pour atteindre une plateforme school management + LMS de niveau production.

---

## 1) Synthèse Exécutive

EDUNEXUS a un socle solide pour un MVP avancé: authentification JWT par cookie, RBAC, gestion des utilisateurs/classes/matières/années académiques, génération IA des emplois du temps et examens via Inngest, soumissions d’examens et résultats étudiants.

Le système n’est pas encore "production-grade" au sens complet du texte cible: plusieurs modules annoncés n’existent pas encore dans ce dépôt (emails transactionnels, bulletins, expérience parent complète, attendance réel, finance réel, recherche globale centralisée, paramètres système étendus).

Conclusion opérationnelle:
- Le noyau Academics + LMS (Exam/Timetable) est implémenté et fonctionnel.
- Le noyau Governance/Reporting/Communication (emails, report cards, parent portal) reste à construire.
- Certaines incohérences produit et sécurité doivent encore être durcies avant un usage réel en école.

---

## 2) État des Capacités (Implémenté / Partiel / Manquant)

## 2.1 Backend Core

| Capacité | État | Preuves code |
|---|---|---|
| Auth JWT cookie + middleware protect/authorize | Implémenté | backend/src/middleware/auth.ts, backend/src/utils/generateToken.ts |
| API Express + middlewares sécurité de base | Implémenté | backend/src/server.ts (helmet, cors, cookieParser) |
| Connexion MongoDB | Implémenté | backend/src/config/db.ts |
| RBAC (admin/teacher/student/parent) | Implémenté | backend/src/models/user.ts, backend/src/middleware/auth.ts |
| Logs d’activité (audit trail) | Implémenté (partiel sur gouvernance) | backend/src/models/activitieslog.ts, backend/src/controllers/activitieslog.ts |

## 2.2 Académique

| Capacité | État | Preuves code |
|---|---|---|
| CRUD Academic Years | Implémenté | backend/src/controllers/academicYear.ts |
| CRUD Classes + pagination + recherche | Implémenté | backend/src/controllers/class.ts |
| CRUD Subjects + pagination + recherche | Implémenté | backend/src/controllers/subject.ts |
| Synchronisation matière ↔ enseignants | Implémenté | backend/src/controllers/subject.ts, backend/src/controllers/user.ts |

## 2.3 Timetable IA

| Capacité | État | Preuves code |
|---|---|---|
| Génération asynchrone Inngest | Implémenté | backend/src/inngest/functions.ts |
| Endpoint génération + suivi de statut | Implémenté | backend/src/controllers/timetable.ts, backend/src/models/timetableGeneration.ts |
| Normalisation settings (jours, périodes, pause) | Implémenté | backend/src/controllers/timetable.ts, backend/src/inngest/functions.ts |
| Visualisation UI timetable | Implémenté | frontend/src/pages/academics/Timetable.tsx, frontend/src/components/timetable/TimetableGrid.tsx |

## 2.4 LMS Examens

| Capacité | État | Preuves code |
|---|---|---|
| Génération IA d’examens (Inngest) | Implémenté | backend/src/controllers/exam.ts, backend/src/inngest/functions.ts |
| Publication/Dépublication, suppression | Implémenté | backend/src/controllers/exam.ts, backend/src/routes/exam.ts |
| Soumission étudiante asynchrone + auto-correction | Implémenté | backend/src/controllers/exam.ts, backend/src/inngest/functions.ts, backend/src/models/submission.ts |
| Consultation résultat étudiant | Implémenté | backend/src/controllers/exam.ts (getExamResult) |
| Règles d’accès enseignant par matière | Implémenté (récemment durci) | backend/src/controllers/exam.ts |

## 2.5 Dashboard & UX rôle

| Capacité | État | Preuves code |
|---|---|---|
| Dashboard admin/teacher/student | Implémenté (partiel sur données) | backend/src/controllers/dashboard.ts, frontend/src/pages/Dashboard.tsx |
| Stats teacher (classes, soumissions, next class) | Implémenté (à valider métier) | backend/src/controllers/dashboard.ts |
| Stats student (exam à venir, assignments) | Implémenté partiel | backend/src/controllers/dashboard.ts |
| Widget AI insight | Mock (non branché backend) | frontend/src/components/dashboard/ai-insight-widget.tsx |

## 2.6 Fonctionnalités annoncées mais absentes / incomplètes

| Capacité annoncée | État actuel |
|---|---|
| Bulletins / report cards automatiques | Non implémenté |
| Envoi d’emails (NodeMailer / templates) | Non implémenté |
| Emails utilisateurs depuis People | Non implémenté |
| Dashboard parent dédié (enfants, notes, suivi) | Non implémenté |
| Attendance réel (présence/absence) | Non implémenté (valeurs mock) |
| Recherche globale admin centralisée | Non implémenté (recherche par module uniquement) |
| Finance (fees/expenses/salary) fonctionnel | Non implémenté (liens UI sans pages/back) |
| Assignments et Study Materials complets | Non implémenté (liens UI non câblés) |

---

## 3) Focus Politique d’Accès (ce qui est maintenant conforme)

Politique cible exprimée:
- Admin gère les matières.
- Enseignant consulte ses matières, ne crée/modifie/supprime pas les matières.
- Enseignant agit sur examens uniquement de ses matières.

État code:
- Subjects CRUD backend réservé admin: OK.
- Listing subjects enseignant limité à ses matières: OK.
- UI subjects enseignant en lecture seule (pas create/edit/delete): OK.
- Exams enseignant filtrés par matières enseignées: OK.

Point de vigilance:
- Vérifier en tests E2E que chaque endpoint retourne bien 403 sur tous les scénarios hors policy.

---

## 4) Incohérences / risques visibles aujourd’hui

## P0 (à traiter immédiatement)
- Route register protégée (`/api/users/register`) par auth/roles.
  - Effet: onboarding initial contraint et workflow d’inscription atypique.
  - Fichier: backend/src/routes/user.ts
- Absence de validation centralisée des payloads (zod/joi) sur plusieurs endpoints sensibles (exam/timetable/user).
  - Effet: robustesse API limitée, erreurs runtime possibles.

## P1 (important court terme)
- Attendance affiché en mock (`94.5%`, `98%`) dans dashboard.
  - Effet: métriques trompeuses.
  - Fichier: backend/src/controllers/dashboard.ts
- Logs d’activité consultables par teacher globalement.
  - Effet: visibilité potentiellement trop large (gouvernance).
  - Fichier: backend/src/routes/activitieslog.ts, backend/src/controllers/activitieslog.ts
- Plusieurs entrées de sidebar pointent vers des routes non implémentées (attendance, finance, materials, assignments, settings/roles).
  - Effet: incohérence UX.

## P2 (qualité production)
- Pas de rate limiting sur login/register.
- Pas de gestion fine d’observabilité (metrics, tracing, alerting).
- Pas de versionnement API.

---

## 5) Ce qui est déjà bien avancé (à conserver)

- Architecture TypeScript full-stack cohérente.
- Séparation models/controllers/routes propre.
- Inngest bien utilisé pour opérations lourdes (exam gen, timetable gen, submission grading).
- Pagination et recherche présentes sur modules clés.
- UX role-based déjà en place sur plusieurs écrans.

---

## 6) Écart exact vs texte objectif ("vrai système production")

Le texte cible décrit une plateforme complète avec workflows réels (emails, bulletins, parents, attendance, global search, finance, paramètres système étendus).

État réel du dépôt:
- Couverture forte: Auth/RBAC, Academics CRUD, Timetable IA, Exams IA + soumission.
- Couverture faible/absente: reporting académique (bulletins), communication (email), portail parent, attendance réel, finance, recherche globale transversale.

Donc: le projet est avancé mais pas encore au niveau de la promesse "production complete school ERP+LMS".

---

## 7) Backlog Priorisé Recommandé

## Phase 1 (Stabilisation MVP réel)
- Ajouter validation de schémas d’entrée (zod/joi) sur tous endpoints write.
- Corriger stratégie register/onboarding (publique contrôlée ou setup admin first-run).
- Ajouter rate limiting auth.
- Restreindre logs enseignants à leurs propres actions.
- Nettoyer sidebar selon routes réellement disponibles.

## Phase 2 (Fonctionnalités cœur manquantes)
- Implémenter Attendance model + APIs + UI.
- Implémenter Assignments et Materials (ou retirer provisoirement du menu).
- Ajouter recherche globale admin multi-modules.

## Phase 3 (Fonctionnalités premium / Patreon)
- Implémenter service email (NodeMailer/Provider) + templates.
- Implémenter Grade/Bulletin models + génération en background (Inngest).
- Intégrer envoi bulletin et affichage bulletin dashboard étudiant.
- Implémenter portail parent (vue enfant, notes, examens, attendance).

---

## 8) Checklist "Done vs Remaining"

## Déjà fait
- Auth JWT + RBAC
- Users/classes/subjects/academic-years CRUD
- Timetable IA + statut de génération
- Exams IA + publication + soumission + résultats
- Activity logs de base
- Dashboards rôle (admin/teacher/student) partiels

## Reste à faire
- Attendance réel
- Emails transactionnels
- Bulletins/report cards + envoi email + affichage élève
- Parent experience complète
- Global search transversale admin
- Finance et pages liées
- Durcissement sécurité/validation/observabilité

---

## 9) Notes Patreon (important)

Tu as raison: dans ce dépôt, les éléments présentés comme "Patreon" (emails utilisateurs, génération bulletins, envoi bulletins, bulletin sur dashboard élève) ne sont pas implémentés aujourd’hui.

Il faut les considérer comme backlog de développement, pas comme fonctionnalités disponibles.

---

## 10) Verdict Final

EDUNEXUS est une base sérieuse et crédible pour un LMS scolaire moderne, avec des briques IA déjà opérationnelles. Pour atteindre l’objectif "vrai système de gestion scolaire production-grade", le travail restant est surtout sur les workflows académiques critiques (attendance, bulletins), la communication (email), le portail parent et le durcissement sécurité/qualité.

---

## 11) Matrice "Promesse du texte" vs État Réel

| Promesse cible | État |
|---|---|
| Contrôle d’accès strict par rôles (élève, enseignant, admin, parent) | Partiellement atteint (parent peu exploité) |
| Dashboard spécifique par rôle | Atteint partiel (données partiellement mock) |
| Génération intelligente d’emploi du temps (IA) | Atteint |
| Création automatisée d’examens (IA) | Atteint |
| Jobs de fond (examens, bulletins, emails) | Atteint partiel (examens/timetable oui, bulletins/emails non) |
| Journaux d’audit complets | Atteint partiel |
| Recherche globale admin | Non atteint |
| Pagination sur toutes les tables clés | Atteint majoritairement |
| Composants UI réutilisables et sensibles aux rôles | Atteint partiel |
| Type safety full-stack TypeScript | Atteint majoritairement |
| API sécurisées et prêtes prod (validation/autorisation) | Partiel (autorisation oui, validation à renforcer) |
| Intégration Inngest backend | Atteint |
| Landing page moderne + thème clair/sombre/système | Atteint partiel |
| Auth email/password + app protégée | Atteint |
| Élève: prochain examen, devoirs, dernier bulletin sur dashboard | Partiel (bulletin absent) |
| Admin: stats école + activité récente | Atteint |
| Logs détaillés (quoi/quand/qui) avec table paginée et searchable | Partiel (search globale logs limitée) |
| Classes CRUD + rapports | Partiel (CRUD oui, rapports dédiés non) |
| Subjects CRUD complet | Atteint (admin) |
| Bulletins auto en background + envoi mail | Non atteint |
| Timetable: affichage instantané si existant | Atteint |
| LMS complet: examens à venir/en cours pour étudiants | Atteint partiel |
| Teacher/Admin: publier/supprimer exams + voir bonnes réponses | Atteint |
| Student: passer exam, soumettre, évaluation async, résultat détaillé | Atteint majoritairement |
| People: gestion élèves/enseignants/parents/admins | Atteint partiel |
| Envoi d’emails utilisateurs depuis le système | Non atteint |
| Paramètres système admin complets | Partiel |
| Stack MERN + TS + JWT cookie | Atteint |
| Gemini AI + AI SDK | Atteint |
| NodeMailer + templates pro | Non atteint |
| Patreon: emails + bulletins + dashboard bulletin élève | Non atteint dans ce repo |

---

## 12) Plan de Sprint (8 semaines) avec estimations

Objectif: passer de l’état actuel à une version pré-production exploitable en établissement réel.

## Semaine 1 - Sécurité API et gouvernance minimale
- Backend:
  - Ajouter validation des payloads (zod/joi) sur users, classes, subjects, exams, timetable.
  - Ajouter rate limiting sur login/register et endpoints sensibles.
  - Corriger/valider le flux d’onboarding (`register` policy explicite).
- Frontend:
  - Masquer les routes non implémentées de la sidebar (finance, attendance, assignments/materials) tant qu’inactives.
- Livrables:
  - 0 endpoint write sans validation.
  - Politique d’accès documentée endpoint par endpoint.

## Semaine 2 - Attendance réel (fin du mock)
- Backend:
  - Créer `Attendance` model (student, class, date, status, markedBy).
  - Endpoints: marquer présence, lister présence par élève/classe/date.
- Frontend:
  - Page Attendance (admin/teacher saisie, student/parent lecture).
  - Dashboard branché sur données réelles attendance.
- Livrables:
  - Suppression des valeurs mock `94.5%` et `98%`.

## Semaine 3 - Global Search + durcissement audit logs
- Backend:
  - Endpoint recherche globale admin (users/classes/subjects/exams/activities).
  - Restreindre les logs enseignant à ses propres actions.
- Frontend:
  - Barre de recherche globale admin + résultats paginés.
- Livrables:
  - Recherche transversale opérationnelle avec pagination.

## Semaine 4 - Module Notes/Bulletins (socle)
- Backend:
  - Créer `Grade` model (exam, student, score, maxScore, percentage, subject, period).
  - Créer `ReportCard` model (student, year, period, aggregates, mentions).
  - Job Inngest: génération bulletin par période.
- Frontend:
  - Vue notes élève + vue synthèse admin/teacher.
- Livrables:
  - Bulletin calculable et consultable en base.

## Semaine 5 - Emails transactionnels (socle production)
- Backend:
  - Intégrer NodeMailer (ou provider SMTP) + templates HTML réutilisables.
  - Jobs Inngest: notification résultat exam, notification bulletin disponible.
- Frontend:
  - Historique simple des envois sur page admin.
- Livrables:
  - Emails automatiques fiables sur événements académiques.

## Semaine 6 - Portail Parent (MVP)
- Backend:
  - Lier parent à 1..n élèves (`parentOf` mapping).
  - Endpoints parent: timetable, exams, attendance, report cards des enfants.
- Frontend:
  - Dashboard parent dédié (lecture seule).
- Livrables:
  - Rôle parent réellement utile et exploitable.

## Semaine 7 - Finance scolaire (adapté Cameroun)
- Backend:
  - `FeePlan`, `Invoice`, `Payment`, `Expense` models.
  - Endpoints facturation, encaissement, statut impayés.
  - Prise en charge des canaux de paiement locaux (référence transaction).
- Frontend:
  - Pages finance admin: plans de frais, paiements, relances.
- Livrables:
  - Cycle frais scolaires de base fonctionnel.

## Semaine 8 - Stabilisation pré-production
- Qualité:
  - Tests d’intégration critiques (auth, exams, timetable, attendance, finance).
  - Journalisation d’erreurs centralisée + monitoring basique.
  - Scripts seed + jeux de données de démo réalistes.
- Livrables:
  - Release candidate avec checklist Go/No-Go.

---

## 13) Adaptation Cameroun (priorités fonctionnelles locales)

Cette section adapte les modules restants au contexte réel des établissements au Cameroun.

## 13.1 Finance (priorité locale)
- Devise par défaut: XAF (FCFA), format monétaire local.
- Structure des frais configurable par établissement:
  - Inscription
  - Scolarité (mensuelle/trimestrielle)
  - APEE/PTA
  - Transport
  - Cantine
  - Uniforme / fournitures
  - Frais d’examens blancs / officiels
- Modes d’encaissement à prévoir:
  - Cash caisse
  - Virement bancaire
  - Mobile Money (MTN MoMo, Orange Money) via référence transaction
- États financiers utiles terrain:
  - Élèves en impayé
  - Échéancier par classe
  - Recettes par période
  - Reçus imprimables (PDF)

## 13.2 Calendrier et découpage académique
- Paramétrer périodes selon établissement:
  - Trimestres (courant)
  - Semestres (certains établissements)
- Report cards et moyennes calculées par période paramétrable.

## 13.3 Bilingue FR/EN
- Prévoir i18n FR/EN pour interfaces parents/enseignants.
- Templates email multilingues selon préférence utilisateur.

## 13.4 Contraintes réseau et usage terrain
- Optimiser pages lourdes (pagination stricte, payloads légers).
- Prévoir mode dégradé sur connexions instables (retries et feedback clair).
- Éviter les dépendances fortes au temps réel; privilégier jobs async + polling robuste.

## 13.5 Conformité et exploitation
- Conserver un audit trail exploitable pour contrôle interne.
- Tracer qui a modifié quoi (notes, paiements, rôles).
- Rendre configurables les règles de calcul et les libellés financiers par école.

---

## 14) Definition of Done (DoD) avant déploiement école

- Tous les endpoints write protégés + validés (schémas).
- Aucun rôle n’accède à une donnée hors politique.
- Attendance réel en production (plus aucun mock).
- Bulletins générés et consultables par élève/parent autorisé.
- Emails critiques opérationnels (résultats, bulletins, notifications).
- Module finance XAF opérationnel (facture -> paiement -> reçu -> impayés).
- Dashboards sans route cassée ni widget mock non signalé.
- Logs d’activité filtrés correctement par rôle.
