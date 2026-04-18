# 🎯 ARCHITECTURE & FLUX E2E VISUEL

## Architecture Globale

```
┌─────────────────────────────────────────────────────────────────┐
│                          NAVIGATEUR                              │
│  ┌──────────────────────────┬───────────────────────────────────┐│
│  │   Frontend React          │  http://localhost:5173            ││
│  │  ┌─────────────────────┐  │                                  ││
│  │  │ /master/login       │  │  Pages principales:              ││
│  │  │ /master/schools     │  │  • Master Login                  ││
│  │  │ /master/email-...   │  │  • Liste écoles                  ││
│  │  │ /login              │  │  • Détail école                  ││
│  │  │ /dashboard          │  │  • Email history                 ││
│  │  │ /onboarding/invite  │  │  • Dashboard école               ││
│  │  └─────────────────────┘  │                                  ││
│  └──────────────────────────┴───────────────────────────────────┘│
└─────────────────────┬────────────────────────────────────────────┘
                      │ HTTP + CORS
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend Express.js (Node/TypeScript)                │
│         http://localhost:5000/api                                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Inngest Functions (Mode DEV)                             │ │
│  │  • generateTimeTable                                       │ │
│  │  • generateExam                                            │ │
│  │  • generateReportCards                                     │ │
│  │  • handleExamSubmission                                    │ │
│  │  (S'exécutent directement dans le serveur)                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──────────────────────────┬─────────────────────────────────┐ │
│  │  Routes Master           │  Routes École                    │ │
│  │  /api/master             │  /api/users                      │ │
│  │  /api/onboarding         │  /api/classes                    │ │
│  │  Auth:  master_jwt       │  /api/exams                      │ │
│  │  DB:    MASTER_MONGO     │  Auth: jwt (école)               │ │
│  │                          │  DB:   MONGO_URL or custom       │ │
│  └──────────────────────────┴─────────────────────────────────┘ │
│                                                                   │
│  Email Service (Nodemailer + Gmail SMTP)                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Évenements:                                                │ │
│  │ • school_invite (à creation/regeneration/resend)          │ │
│  │ • exam_result, report_card_available, payment_reminder    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────┬────────────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌────────────┐
│   MongoDB    │  │   Gmail      │  │  Console   │
│   Atlas      │  │   SMTP       │  │   DevTools │
│              │  │              │  │            │
│ 2 Bases:     │  │ Notifications│  │   Logs     │
│ • Master DB  │  │ Transact'les │  │   Cookies  │
│ • Default DB │  │              │  │            │
│ • School DBs │  │              │  │            │
└──────────────┘  └──────────────┘  └────────────┘
```

---

## Flux E2E: De la Création à l'Utilisation

```
┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 0: SETUP INITIAL (Une fois)                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  bun install (backend + frontend)                        │   │
│  │  bun create-admin.ts                                     │   │
│  │  ↓                                                        │   │
│  │  ✅ Super Admin créé:                                    │   │
│  │     Email: admin@edunexus.fr                             │   │
│  │     Motdepasse: SecurePassword123!                       │   │
│  │     Rôle: super_admin                                    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Sauvegarde: MASTER DB (edunexus_master)                        │
│             1 document: MasterUser                               │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 1: SUPER ADMIN LOGIN (Authentification Master)            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Utilisateur: Admin Platform                                     │
│  Rôle: super_admin                                              │
│                                                                   │
│  🔴 URL: http://localhost:5173/master/login                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Form: Email + Password                                  │   │
│  │  POST /api/master/auth/login                            │   │
│  │                                                          │   │
│  │  Backend:                                                │   │
│  │  1. Cherche email dans MASTER DB                        │   │
│  │  2. Vérifie bcrypt password                             │   │
│  │  3. Crée JWT (HS512, 30 jours)                          │   │
│  │  4. Set cookie: master_jwt (httpOnly)                   │   │
│  │                                                          │   │
│  │  Frontend:                                               │   │
│  │  ✅ Cookie master_jwt sauvegardé                         │   │
│  │  ✅ Redirect: /master/schools (liste vide)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  JWT Contenu: { id, email, role, iat, exp }                     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 2: CRÉER UNE ÉCOLE (Super Admin)                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Utilisateur: Super Admin                                        │
│  Rôle: super_admin                                              │
│                                                                   │
│  🔴 URL: http://localhost:5173/master/schools                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Form: Nom, Devise, Type, Email, Téléphone             │   │
│  │  POST /api/master/schools                              │   │
│  │  Headers: Cookie master_jwt                             │   │
│  │                                                          │   │
│  │  Backend:                                                │   │
│  │  1. protectMaster: Vérifie master_jwt                  │   │
│  │  2. authorizeMaster: Vérifie role=super_admin          │   │
│  │  3. Crée document School dans MASTER DB                │   │
│  │  4. logActivity: "Créée l'école" en audit             │   │
│  │  5. Retourne: School._id (UUID)                        │   │
│  │                                                          │   │
│  │  BD Impact:                                              │   │
│  │  ✅ 1 nouveau doc: School                               │   │
│  │  ✅ 1 nouveau doc: ActivitiesLog (audit)               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  État: Lycée créé, status=pending, isActive=true                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 3: GÉNÉRER LIEN INVITATION (Super Admin)                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Utilisateur: Super Admin                                        │
│  Rôle: super_admin                                              │
│                                                                   │
│  🟡 URL: http://localhost:5173/master/schools/<SCHOOL_ID>       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Form: Nom Admin, Email Admin                           │   │
│  │  POST /api/master/schools/:schoolId/invite/regenerate  │   │
│  │                                                          │   │
│  │  Backend:                                                │   │
│  │  1. Génère UUID TOKEN (crypto.randomBytes)             │   │
│  │  2. Crée SchoolInvite doc:                             │   │
│  │     { token, schoolId, requestedAdminEmail, status,    │   │
│  │       expiresAt: +7j }                                  │   │
│  │  3. Construit email HTML bilingual                      │   │
│  │  4. sendTransactionalEmail → Gmail SMTP                │   │
│  │  5. Crée EmailLog doc: { recipient, status, type }     │   │
│  │  6. logActivity: "Généré lien d'invitation"           │   │
│  │                                                          │   │
│  │  BD Impact:                                              │   │
│  │  ✅ 1 doc: SchoolInvite (token pending)                │   │
│  │  ✅ 1 doc: EmailLog (school_invite event)              │   │
│  │  ✅ 1 doc: ActivitiesLog                               │   │
│  │                                                          │   │
│  │  Email Envoyé:                                           │   │
│  │  À: mamadou@ndiayelycee.sn                             │   │
│  │  Sujet: "Invitation EDUNEXUS - Lycée Ndiaye Dakar"     │   │
│  │  Body: "Cliquez ici: http://localhost:5173/onboarding/ │   │
│  │         invite/<TOKEN>"                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  État: Invitation générée, email envoyé, token valide 7 jours   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 4: ADMIN ACCEPTE INVITATION (Rôle: Établissement)         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Utilisateur: Admin école (Mamadou)                             │
│  Rôle: admin (après activation)                                 │
│                                                                   │
│  🟢 URL: http://localhost:5173/onboarding/invite/<TOKEN>        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Page Auto-remplie:                                      │   │
│  │  • Nom: "Mamadou Sall" (de SchoolInvite)               │   │
│  │  • Email: "mamadou@ndiayelycee.sn"                      │   │
│  │                                                          │   │
│  │  Form: Email + Password + Confirm Password             │   │
│  │  POST /api/onboarding/invite/:token/activate           │   │
│  │                                                          │   │
│  │  Backend:                                                │   │
│  │  1. Vérifie token existe & pas expiré                  │   │
│  │  2. Crée User doc dans école DB (pas MASTER)          │   │
│  │  3. Hash password (bcryptjs)                            │   │
│  │  4. Set SchoolInvite.status = "active"                │   │
│  │  5. Set School.onboardingStatus = "active"            │   │
│  │  6. Crée JWT école (avec schoolId)                     │   │
│  │  7. Set cookie: jwt (httpOnly)                         │   │
│  │  8. logActivity: "Admin activé le compte"             │   │
│  │  9. sendEmail: "Bienvenue" (transactionnel)           │   │
│  │                                                          │   │
│  │  BD Impact:                                              │   │
│  │  ✅ 1 doc: User (dans école DB)                         │   │
│  │  ✅ Update: SchoolInvite.status = active               │   │
│  │  ✅ Update: School.onboardingStatus = active           │   │
│  │  ✅ 1 doc: ActivitiesLog                               │   │
│  │  ✅ 1 doc: EmailLog (welcome event)                    │   │
│  │                                                          │   │
│  │  Frontend:                                               │   │
│  │  ✅ Cookie jwt sauvegardé (école)                       │   │
│  │  ✅ Redirect: /dashboard (école)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  État: École ACTIVE et prête à l'usage                          │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 5: SUPER ADMIN GÈRE L'ÉCOLE (Audit & Ops)                │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Utilisateur: Super Admin (Master JWT)                          │
│  Rôle: super_admin                                              │
│                                                                   │
│  🔴 URL: http://localhost:5173/master/schools/<SCHOOL_ID>       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  OPÉRATION 5A: VOIR HISTORIQUE DES ACTIONS              │ │
│  │                                                            │ │
│  │  GET /api/master/schools/:schoolId/activity-logs          │ │
│  │                                                            │ │
│  │  Retourne Array:                                           │ │
│  │  [                                                         │ │
│  │    {action: "Créée l'école", user: "Super Admin"},        │ │
│  │    {action: "Généré lien", user: "Super Admin"},          │ │
│  │    {action: "Admin activé le compte", user: "Mamadou"}    │ │
│  │  ]                                                         │ │
│  │                                                            │ │
│  │  UI: Section "Historique des actions" affichée            │ │
│  │      avec pagination et recherche                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  OPÉRATION 5B: VÉRIFIER STATUT EMAIL                     │ │
│  │                                                            │ │
│  │  GET /api/master/schools/:schoolId/invite/email-status    │ │
│  │                                                            │ │
│  │  Retourne:                                                 │ │
│  │  {                                                         │ │
│  │    recipientEmail: "mamadou@ndiayelycee.sn",             │ │
│  │    status: "sent",                                         │ │
│  │    sentAt: "2026-04-17T10:30:45Z",                       │ │
│  │    providerMessageId: "gmail-msg-id-123"                 │ │
│  │  }                                                         │ │
│  │                                                            │ │
│  │  UI: Section "Dernier envoi email"                        │ │
│  │      avec badge ✅ ENVOYÉ + timestamp                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  OPÉRATION 5C: SUSPENDRE L'ÉCOLE                         │ │
│  │                                                            │ │
│  │  POST /api/master/schools/:schoolId/suspend              │ │
│  │  Body: { reason: "Non paiement Q2 2026" }               │ │
│  │                                                            │ │
│  │  Backend:                                                  │ │
│  │  1. Set School.isActive = false                          │ │
│  │  2. Invalide tous les pending invites                    │ │
│  │  3. logActivity: "Suspendu l'école"                      │ │
│  │     details: "Raison: Non paiement Q2 2026"             │ │
│  │  4. Éventuellement sendEmail: Admin école                │ │
│  │                                                            │ │
│  │  BD Impact:                                                │ │
│  │  ✅ Update: School.isActive = false                      │ │
│  │  ✅ 1 doc: ActivitiesLog (avec raison)                   │ │
│  │                                                            │ │
│  │  UI: Toast "École suspendue"                              │ │
│  │      Bouton devient "Réactiver"                           │ │
│  │      Raison affichée dans ActivitiesLog                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  OPÉRATION 5D: RÉACTIVER L'ÉCOLE                         │ │
│  │                                                            │ │
│  │  POST /api/master/schools/:schoolId/reactivate           │ │
│  │                                                            │ │
│  │  Backend:                                                  │ │
│  │  1. Set School.isActive = true                           │ │
│  │  2. logActivity: "Réactivé l'école"                      │ │
│  │                                                            │ │
│  │  État: École réactive et exploitable à nouveau            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 6: SUPER ADMIN GÈRE INVITATIONS (Regenerate vs Resend)   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Utilisateur: Super Admin                                        │
│  Rôle: super_admin                                              │
│                                                                   │
│  🟡 URL: http://localhost:5173/master/schools/<SCHOOL_ID>       │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CAS 1: REGENERER LIEN (Nouveau token)                  │ │
│  │                                                            │ │
│  │  POST /api/master/schools/:schoolId/invite/regenerate    │ │
│  │                                                            │ │
│  │  Scénario: "L'ancien token a expiré, créer un nouveau"  │ │
│  │                                                            │ │
│  │  Backend:                                                  │ │
│  │  1. Invalide OLD SchoolInvite (status=expired)           │ │
│  │  2. Crée NEW SchoolInvite avec nouveau TOKEN            │ │
│  │  3. sendEmail: Avec NOUVEAU lien                        │ │
│  │  4. logActivity: "Régénéré lien d'invitation"           │ │
│  │  5. sendEmail: "Votre lien d'invitation a été régéné..."│ │
│  │                                                            │ │
│  │  Résultat:                                                 │ │
│  │  ❌ Ancien lien: /onboarding/invite/<OLD_TOKEN>          │ │
│  │     → 404 Not Found (token invalide)                      │ │
│  │  ✅ Nouveau lien: /onboarding/invite/<NEW_TOKEN>         │ │
│  │     → Fonctionne (7 jours valides)                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  CAS 2: RENVOYER EMAIL (Même token)                     │ │
│  │                                                            │ │
│  │  POST /api/master/schools/:schoolId/invite/resend        │ │
│  │                                                            │ │
│  │  Scénario: "Admin n'a pas reçu email, renvoyer SAME token"
│  │                                                            │ │
│  │  Backend:                                                  │ │
│  │  1. Cherche pending SchoolInvite pour l'école            │ │
│  │  2. Vérifie: pas expiré & status=pending                │ │
│  │  3. sendEmail: Avec MÊME token (réutilisable)          │ │
│  │  4. logActivity: "Renvoyé email d'invitation"           │ │
│  │                                                            │ │
│  │  Résultat:                                                 │ │
│  │  ✅ Ancien lien: /onboarding/invite/<SAME_TOKEN>         │ │
│  │     → Fonctionne toujours (7 jours valides)              │ │
│  │  ✅ Nouvel email reçu avec MÊME lien                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  BD Impact Commun:                                               │
│  ✅ 1 doc: EmailLog (school_invite event) à chaque renvoi      │ │
│  ✅ 1 doc: ActivitiesLog pour chaque action                   │ │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 7: SUPER ADMIN CONSULTE HISTORIQUE EMAILS (Master)        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Utilisateur: Super Admin                                        │
│  Rôle: super_admin                                              │
│                                                                   │
│  🟣 URL: http://localhost:5173/master/email-history             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  GET /api/master/email-logs                             │   │
│  │  Query Params:                                           │   │
│  │  ?search=mamadou&status=sent&eventType=school_invite    │   │
│  │  &schoolId=<ID>&page=1                                  │   │
│  │                                                          │   │
│  │  Backend:                                                │   │
│  │  1. Cherche EmailLog avec filtres                      │   │
│  │  2. Retourne Array + pagination                        │   │
│  │                                                          │   │
│  │  Résultat:                                               │   │
│  │  [                                                       │   │
│  │    {                                                     │   │
│  │      recipient: "mamadou@ndiayelycee.sn",              │   │
│  │      subject: "Invitation EDUNEXUS - Lycée...",        │   │
│  │      status: "sent",                                    │   │
│  │      eventType: "school_invite",                        │   │
│  │      sentAt: "2026-04-17T10:30:45Z",                   │   │
│  │      schoolId: "507f1f77bcf86cd799439011"              │   │
│  │    }                                                     │   │
│  │  ]                                                       │   │
│  │                                                          │   │
│  │  UI:                                                     │   │
│  │  ✅ Table avec colonnes: Email, Sujet, Statut, Type    │   │
│  │  ✅ Filtres (Search, School, Status, Type)             │   │
│  │  ✅ Badge "Filtres actifs: 3"                          │   │
│  │  ✅ Bouton "Effacer les filtres"                       │   │
│  │  ✅ Pagination (Prev/Next)                             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  État: Super Admin a visibilité complète sur tous les emails    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ ÉTAPE 8: ADMIN ÉCOLE UTILISE LE DASHBOARD (Rôle: École)         │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Utilisateur: Mamadou (Admin école)                             │
│  Rôle: admin (école)                                             │
│                                                                   │
│  🟢 URL: http://localhost:5173/dashboard                         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Toutes les requêtes ont:                               │   │
│  │  • Cookie: jwt (école)                                  │   │
│  │  • Middleware: protectSchool                            │   │
│  │                                                          │   │
│  │  Middleware Route:                                       │   │
│  │  1. Lit cookie jwt                                      │   │
│  │  2. Extrait schoolId du JWT                            │   │
│  │  3. Route vers SCHOOL_MONGO_URL (pas MASTER)           │   │
│  │  4. Cherche User dans école DB uniquement              │   │
│  │                                                          │   │
│  │  Accès Limité À:                                         │   │
│  │  ✅ Ses propres données (utilisateurs, classes, etc.)  │   │
│  │  ❌ PAS les données d'autres écoles                    │   │
│  │  ❌ PAS les routes master (/api/master/*)              │   │
│  │                                                          │   │
│  │  Fonctionnalités:                                        │   │
│  │  • Créer des classes                                    │   │
│  │  • Ajouter des sujets                                   │   │
│  │  • Générer emploi du temps (Inngest)                   │   │
│  │  • Créer des examens                                    │   │
│  │  • Voir les élèves                                      │   │
│  │  • Générer des bulletins                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  État: École complètement opérationnelle et isolée                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔑 Points Clés d'Architecture

### 1️⃣ Deux Systèmes d'Authentification

| Master (Platform) | École |
|-------------------|-------|
| JWT: `master_jwt` | JWT: `jwt` |
| Base: MASTER_MONGO_URL | Base: MONGO_URL ou custom |
| Routes: `/api/master/*` | Routes: `/api/**` |
| Rôles: super_admin, platform_admin | Rôles: admin, teacher, student |
| Email: admin@edunexus.fr | Email: mamadou@ndiayelycee.sn |
| Accès: Toutes les écoles | Accès: Leur école seulement |

### 2️⃣ Isolation Multi-Tenant

```
                    MASTER DB
            ┌──────────────────────────┐
            │  • MasterUser            │
            │  • School (References)   │
            │  • SchoolInvite          │
            │  • ActivitiesLog (audit) │
            │  • EmailLog              │
            └──────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │ ÉCOLE 1 │       │ ÉCOLE 2 │       │ ÉCOLE N │
    │  Users  │       │  Users  │       │  Users  │
    │ Classes │       │ Classes │       │ Classes │
    │  Exams  │       │  Exams  │       │  Exams  │
    └─────────┘       └─────────┘       └─────────┘

Sécurité:
✅ Middleware vérifie schoolId au JWT
✅ Routeur MongoDB change de base automatiquement
✅ Admin école ne peut voir que SA base
✅ Super admin voit MASTER seulement
```

### 3️⃣ Flux d'Email Transactionnel

```
Event (school_invite)
        │
        ▼
buildSchoolInviteTemplate() ──→ HTML + Subject + Text
        │
        ▼
sendTransactionalEmail(Gmail SMTP)
        │
        ├─→ ✅ Success → EmailLog(status=sent, sentAt)
        │
        └─→ ❌ Failed → EmailLog(status=failed, errorMessage)

Chaque email log:
{ recipientEmail, subject, status, eventType, schoolId,
  sentAt, providerMessageId, errorMessage, metadata }
```

### 4️⃣ Audit Trail Complet

```
Chaque action crée 1 ActivitiesLog:

✅ Créer école
✅ Générer lien
✅ Activer admin
✅ Suspendre
✅ Réactiver
✅ Régénérer
✅ Renvoyer email
✅ Voir email status
✅ Voir historique

Chaque log:
{ userId, action, details, schoolId (si applicable), createdAt }
```

---

## 🎯 État Final Après E2E Complet

```
MASTER DB:
├── MasterUser (1)
│   └── admin@edunexus.fr (super_admin)
├── School (1)
│   └── Lycée Ndiaye Dakar (isActive=true)
├── SchoolInvite (1-N)
│   └── Token pour Mamadou (status=active/pending/expired)
├── ActivitiesLog (5+)
│   ├── Créée l'école
│   ├── Généré lien
│   ├── Suspendu l'école (raison: ...)
│   ├── Réactivé l'école
│   └── Régénéré lien
└── EmailLog (3+)
    ├── school_invite (Generate) ✅
    ├── school_invite (Resend) ✅
    └── school_invite (Regenerate) ✅

ÉCOLE DB (edunexus_lycee_ndiaye):
├── User (1)
│   └── Mamadou Sall (admin)
└── Autres collections vides (prêtes pour école)

FRONTEND STATE:
├── Master JWT: Sauvegardé en cookie
├── École JWT: Sauvegardé en cookie
├── UI État: Dashboard école visible
└── Routes Disponibles:
    ✅ /master/schools (avec édition)
    ✅ /master/email-history (avec filtres)
    ✅ /dashboard (école)
    ✅ /classes, /exams, /timetables (école)

EMAIL AUDIT:
✅ 3+ emails envoyés (Gmail confirme)
✅ Tous tracés dans EmailLog
✅ Consultables dans /master/email-history
```

---

**🚀 Tout est prêt pour le test E2E!**
