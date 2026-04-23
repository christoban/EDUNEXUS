# Documentation Technique - Frontend EDUNEXUS

## Vue d'Ensemble

Le frontend EDUNEXUS est une application React (Vite + TypeScript + TailwindCSS). Elle offre l'interface pour:
- Master Admin (super admin)
- Administrateurs d'écoles
- Enseignants
- Parents
- Élèves

---

## Structure des Répertoires

```
frontend/
├── src/
│   ├── pages/              # Pages principales
│   │   ├── superadmin/      # Dashboard Super Admin
│   │   ├── master/          # Pages Master Admin
│   │   ├── onboarding/     # Inscription école
│   │   ├── academics/      # Matières, classes, présences
│   │   ├── finance/        # Finance
│   │   ├── lms/             # Examens, bulletins
│   │   ├── parent/          # Interface parents
│   │   ├── settings/        # Configuration
│   │   ├── users/           # Gestion utilisateurs
│   │   └── routes/          # Router
│   ├── components/         # Composants React
│   │   ├── ui/              # Composants UI (shadcn)
│   │   ├── global/          # Composants globaux
│   │   ├── dashboard/       # Widgets dashboard
│   │   ├── sidebar/         # Navigation
│   │   ├── auth/            # Authentification
│   │   └── ...
│   ├── lib/                 # Utilitaires
│   ├── hooks/               # React Hooks
│   ├── assets/              # Images, icons
│   ├── App.tsx              # App principal
│   ├── main.tsx             # Point d'entrée
│   └── index.css            # Styles globaux
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

---

## Détail par Dossier

### 1. `src/pages/` - Pages

#### `pages/superadmin/` (Nouveau Dashboard Super Admin)

| Fichier | Route | Description |
|---------|-------|-------------|
| `DashboardSuperAdmin.tsx` | `/superadmin` | Tableau de bord principal |
| `SchoolsTable.tsx` | `/superadmin/schools` | Liste des écoles |
| `InviteSchoolForm.tsx` | `/superadmin/invite` | Formulaire invitation |
| `SchoolOnboardingForm.tsx` | /onboarding | Formulaire école |
| `ProtectedSuperAdmin.tsx` | - | Guard-protection |
| `AuditLog.tsx` | - | Journal d'audit |

#### `pages/master/` (Master Admin Existant)

| Fichier | Route | Description |
|---------|-------|-------------|
| `MasterLogin.tsx` | `/x9-private-master-entry` | Login Master |
| `MasterSchools.tsx` | `/master/schools` | Liste écoles |
| `MasterSchoolDetail.tsx` | `/master/schools/:id` | Détail école |
| `MasterSecurity.tsx` | `/master/security` | Sécurité MFA |
| `MasterEmailHistory.tsx` | `/master/email-history` | Historique emails |
| `MasterDecoy.tsx` | `/master/login` | Page de camouflage |

#### `pages/onboarding/`

| Fichier | Route | Description |
|---------|-------|-------------|
| `SchoolOnboarding.tsx` | `/onboarding/school` | Inscription nouvelle école |
| `SchoolInvite.tsx` | `/onboarding/invite/:token` | Activation lien |
| `SchoolOnboardingRequests.tsx` | `/master/onboarding/requests` | Demandes en attente |

#### `pages/academics/`

| Fichier | Route | Description |
|---------|-------|-------------|
| `Classes.tsx` | `/classes` | Gestion classes |
| `Subjects.tsx` | `/subjects` | Matières |
| `Attendance.tsx` | `/attendance` | Présences |
| `Timetable.tsx` | `/timetable` | Emploi du temps |

#### `pages/finance/`

| Fichier | Route | Description |
|---------|-------|-------------|
| `FeePlans.tsx` | `/finance/fee-plans` | Plans de frais |
| `Payments.tsx` | `/finance/payments` | Paiements |
| `Invoices.tsx` | `/finance/invoices` | Factures |
| `Expenses.tsx` | `/finance/expenses` | Dépenses |
| `OverdueAndReminders.tsx` | `/finance/reminders` | Relances |

#### `pages/lms/`

| Fichier | Route | Description |
|---------|-------|-------------|
| `Exams.tsx` | `/lms/exams` | Examens |
| `Exam.tsx` | `/lms/exams/:id` | Détail examen |
| `ReportCards.tsx` | `/lms/report-cards` | Bulletins |

#### `pages/parent/`

| Fichier | Route | Description |
|---------|-------|-------------|
| `ParentDashboard.tsx` | `/parent/dashboard` | Dashboard parent |
| `ChildDetails.tsx` | `/parent/children/:id` | Détails enfant |
| `ParentSettings.tsx` | `/parent/settings` | Paramètres |

#### `pages/settings/`

| Fichier | Route | Description |
|---------|-------|-------------|
| `Subjects.tsx` | `/settings/subjects` | Matières |
| `SchoolConfiguration.tsx` | `/settings/configuration` | Config école |
| `academic-year.tsx` | `/settings/academic-years` | Année scolaire |
| `EmailHistory.tsx` | `/settings/email-history` | Historique emails |

#### `pages/routes/`

| Fichier | Rôle |
|---------|------|
| `router.tsx` | Définition des routes React |
| `PrivateRoutes.tsx` | Routes protégées |
| `RoleGuard.tsx` | Guard par rôle |

#### Autres Pages

| Fichier | Route | Description |
|---------|-------|-------------|
| `Home.tsx` | `/` | Page d'accueil publique |
| `Login.tsx` | `/login` | Connexion école |
| `Dashboard.tsx` | `/dashboard` | Dashboard principal |
| `users/index.tsx` | `/users/*` | Gestion utilisateurs |

---

### 2. `src/components/` - Composants

#### `components/ui/` (Library shadcn)

Composants prêt-à-utiliser:
- Button, Card, Dialog, Dropdown
- Table, Tabs, Badge, Avatar
- Input, Select, Form, Toast
- Modal, Sheet, Drawer
- Et beaucoup d'autres...

#### `components/global/`

| Fichier | Description |
|---------|-------------|
| `Modal.tsx` | Modal réutilisable |
| `CustomInput.tsx` | Input personnalisé |
| `CustomSelect.tsx` | Select personnalisé |
| `CustomPagination.tsx` | Pagination |
| `Search.tsx` | Barre de recherche |

#### `components/sidebar/`

| Fichier | Description |
|---------|-------------|
| `AppSidebar.tsx` | Sidebar principale |
| `nav-main.tsx` | Navigation principale |
| `team-switcher.tsx` | Changement d'école |
| `ThemeToogle.tsx` | Toggle thème |

#### `components/dashboard/`

| Fichier | Description |
|---------|-------------|
| `dashboard-stats.tsx` | Widget stats |
| `ai-insight-widget.tsx` | Widget IA |
| `parent-dashboard.tsx` | Dashboard parent |

#### `components/auth/`

| Fichier | Description |
|---------|-------------|
| `UniversalUserForm.tsx` | Formulaire utilisateur |

---

### 3. `src/lib/` - Utilitaires

| Fichier | Description |
|---------|-------------|
| `api.ts` | Client API (axios) |
| `masterRoutes.ts` | Chemins Master |
| `roleAccess.ts` | Permissions par rôle |
| `accessPolicy.ts` | Politiques d'accès |
| `i18n.ts` | Internationalisation |
| `socket.ts` | WebSocket client |
| `utils.ts` | Fonctions utilitaires |

---

### 4. `src/hooks/` - React Hooks

| Fichier | Description |
|---------|-------------|
| `AuthProvider.tsx` | Contexte auth |
| `use-mobile.ts` | Détection mobile |
| `use-toast.ts` | Notifications toast |

---

## Routes API

| Préfixe | Auth | Description |
|--------|-----|-------------|
| `/` | Public | Home |
| `/login` | Public | Connexion |
| `/x9-private-master-entry` | Master | Login Master |
| `/superadmin` | Master | Dashboard Super Admin |
| `/dashboard` | JWT | Dashboard principal |
| `/classes` | JWT | Classes |
| `/subjects` | JWT | Matières |
| `/attendance` | JWT | Présences |
| `/timetable` | JWT | EDT |
| `/lms/exams` | JWT | Examens |
| `/lms/report-cards` | JWT | Bulletins |
| `/parent/dashboard` | JWT | Parent |
| `/finance/*` | JWT | Finance |
| `/settings/*` | JWT | Configuration |

---

## Authentification

| Type | Méthode | Stockage |
|------|--------|----------|
| École | JWT Cookie | httpOnly |
| Master | Password + MFA | Session |
| API Key | Bearer Token | LocalStorage |

---

## Stack Technique

- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: TailwindCSS + shadcn/ui
- **State**: React Context
- **HTTP**: Axios
- **Forms**: React Hook Form
- **Router**: React Router 6
- **Icons**: Lucide React

---

## Variables d'Environnement

```
VITE_API_URL=http://localhost:3000
VITE_MASTER_LOGIN_PATH=/x9-private-master-entry
```

---

## Modifications Récentes

- Ajout dossier `pages/superadmin/` avec nouveau dashboard
- Ajout routes `/superadmin`, `/superadmin/schools`, `/superadmin/invite`
- Modification `router.tsx` pour nouvelles routes
- Modification `MasterLogin.tsx` pour redirection vers `/superadmin`
- Création `superadmin.css` pour styles
- Ajout import CSS dans `DashboardSuperAdmin.tsx`

---

## Accès au Dashboard Super Admin

```
1. Aller sur: http://localhost:5173/x9-private-master-entry
2. Se connecter avec credentials Master
3. Redirection automatique vers /superadmin
```

---

## Arborescence Complète des Fichiers Clés

```
frontend/src/
├── pages/
│   ├── superadmin/
│   │   ├── DashboardSuperAdmin.tsx   ← NOUVEAU
│   │   ├── SchoolsTable.tsx           ← NOUVEAU
│   │   ├── InviteSchoolForm.tsx        ← NOUVEAU
│   │   ├── SchoolOnboardingForm.tsx   ← NOUVEAU
│   │   ├── ProtectedSuperAdmin.tsx     ← NOUVEAU
│   │   ├── AuditLog.tsx                ← NOUVEAU
│   │   └── superadmin.css               ← NOUVEAU
│   ├── master/
│   │   ├── MasterLogin.tsx
│   │   ├── MasterSchools.tsx
│   │   ├── MasterSchoolDetail.tsx
│   │   ├── MasterSecurity.tsx
│   │   ├── MasterEmailHistory.tsx
│   │   └── MasterDecoy.tsx
│   ├── onboarding/
│   │   ├── SchoolOnboarding.tsx
│   │   ├── SchoolInvite.tsx
│   │   └── SchoolOnboardingRequests.tsx
│   ├── routes/
│   │   ├── router.tsx                  ← MODIFIÉ
│   │   ├── PrivateRoutes.tsx
│   │   └── RoleGuard.tsx
│   ├── academics/
│   │   ├── Classes.tsx
│   │   ├── Subjects.tsx
│   │   ├── Attendance.tsx
│   │   └── Timetable.tsx
│   ├── finance/
│   │   ├── FeePlans.tsx
│   │   ├── Payments.tsx
│   │   ├── Invoices.tsx
│   │   ├── Expenses.tsx
│   │   └── OverdueAndReminders.tsx
│   ├── lms/
│   │   ├── Exams.tsx
│   │   ├── Exam.tsx
│   │   └── ReportCards.tsx
│   ├── parent/
│   │   ├── ParentDashboard.tsx
│   │   ├── ChildDetails.tsx
│   │   └── ParentSettings.tsx
│   ├── settings/
│   │   ├── Subjects.tsx
│   │   ├── SchoolConfiguration.tsx
│   │   ├── academic-year.tsx
│   │   └── EmailHistory.tsx
│   ├── Home.tsx
│   ├── Login.tsx
│   └── Dashboard.tsx
├── components/
│   ├── ui/                    # 50+ composants shadcn
│   ├── global/
│   ├── sidebar/
│   ├── dashboard/
│   ├── auth/
│   ├── subjects/
│   ├── classes/
│   ├── users/
│   ├── timetable/
│   └── lms/
├── lib/
│   ├── api.ts
│   ├── masterRoutes.ts
│   ├── roleAccess.ts
│   └── ...
├── hooks/
│   ├── AuthProvider.tsx
│   └── use-mobile.ts
├── App.tsx                    ← PAS utilisé (c'est router.tsx)
├── main.tsx                   ← Point d'entrée
��── index.css                  ← Styles globaux (Tailwind)
```