# Arborescence du Frontend EDUNEXUS

```
frontend/
├── .env
├── .gitignore
├── ARBORESCENCE.md
├── README.md
├── bun.lock
├── components.json
├── eslint.config.js
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
│
├── public/
│   ├── favicon.svg
│   ├── fonts.css
│   └── icons.svg
│
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── index.css
    ├── types.ts
    ├── vite-env.d.ts
    │
    ├── assets/
    │   ├── hero.png
    │   ├── react.svg
    │   └── vite.svg
    │
    ├── components/
    │   ├── academic-year/
    │   │   ├── AcademicYearForm.tsx
    │   │   ├── academic-year-table.tsx
    │   │   └── schema.ts
    │   │
    │   ├── auth/
    │   │   └── UniversalUserForm.tsx
    │   │
    │   ├── classes/
    │   │   ├── ClassForm.tsx
    │   │   ├── ClassTable.tsx
    │   │   └── schema.ts
    │   │
    │   ├── dashboard/
    │   │   ├── ai-insight-widget.tsx
    │   │   ├── dashboard-stats.tsx
    │   │   └── parent-dashboard.tsx
    │   │
    │   ├── global/
    │   │   ├── CustomAlert.tsx
    │   │   ├── CustomAutocompleteSelect.tsx
    │   │   ├── CustomInput.tsx
    │   │   ├── CustomMultiSelect.tsx
    │   │   ├── CustomPagination.tsx
    │   │   ├── CustomSelect.tsx
    │   │   ├── Modal.tsx
    │   │   └── Search.tsx
    │   │
    │   ├── home/
    │   │   ├── Footer.tsx
    │   │   ├── Hero.tsx
    │   │   ├── Navbar.tsx
    │   │   ├── Programs.tsx
    │   │   └── Stats.tsx
    │   │
    │   ├── lms/
    │   │   ├── ExamGenerator.tsx
    │   │   └── ExamRadio.tsx
    │   │
    │   ├── provider/
    │   │   └── theme.tsx
    │   │
    │   ├── sidebar/
    │   │   ├── AppSidebar.tsx
    │   │   ├── nav-main.tsx
    │   │   ├── nav-user.tsx
    │   │   ├── SuperAdminNavbar.tsx
    │   │   ├── team-switcher.tsx
    │   │   └── ThemeToogle.tsx
    │   │
    │   ├── subjects/
    │   │   ├── schema.ts
    │   │   ├── SubjectForm.tsx
    │   │   └── SubjectTable.tsx
    │   │
    │   ├── timetable/
    │   │   ├── GeneratorControls.tsx
    │   │   └── TimetableGrid.tsx
    │   │
    │   ├── ui/
    │   │   ├── accordion.tsx
    │   │   ├── alert.tsx
    │   │   ├── alert-dialog.tsx
    │   │   ├── aspect-ratio.tsx
    │   │   ├── avatar.tsx
    │   │   ├── badge.tsx
    │   │   ├── breadcrumb.tsx
    │   │   ├── button.tsx
    │   │   ├── button-group.tsx
    │   │   ├── calendar.tsx
    │   │   ├── card.tsx
    │   │   ├── carousel.tsx
    │   │   ├── chart.tsx
    │   │   ├── checkbox.tsx
    │   │   ├── collapsible.tsx
    │   │   ├── command.tsx
    │   │   ├── context-menu.tsx
    │   │   ├── dialog.tsx
    │   │   ├── drawer.tsx
    │   │   ├── dropdown-menu.tsx
    │   │   ├── empty.tsx
    │   │   ├── field.tsx
    │   │   ├── form.tsx
    │   │   ├── hover-card.tsx
    │   │   ├── input.tsx
    │   │   ├── input-group.tsx
    │   │   ├── input-otp.tsx
    │   │   ├── item.tsx
    │   │   ├── kbd.tsx
    │   │   ├── label.tsx
    │   │   ├── menubar.tsx
    │   │   ├── multi-select.tsx
    │   │   ├── navigation-menu.tsx
    │   │   ├── pagination.tsx
    │   │   ├── popover.tsx
    │   │   ├── progress.tsx
    │   │   ├── radio-group.tsx
    │   │   ├── resizable.tsx
    │   │   ├── scroll-area.tsx
    │   │   ├── select.tsx
    │   │   ├── separator.tsx
    │   │   ├── sheet.tsx
    │   │   ├── sidebar.tsx
    │   │   ├── skeleton.tsx
    │   │   ├── slider.tsx
    │   │   ├── sonner.tsx
    │   │   ├── spinner.tsx
    │   │   ├── switch.tsx
    │   │   ├── table.tsx
    │   │   ├── tabs.tsx
    │   │   ├── textarea.tsx
    │   │   ├── toggle.tsx
    │   │   ├── toggle-group.tsx
    │   │   └── tooltip.tsx
    │   │
    │   └── users/
    │       ├── UserDialog.tsx
    │       └── UserTable.tsx
    │
    ├── hooks/
    │   ├── AuthProvider.tsx
    │   ├── use-mobile.ts
    │   ├── use-toast.ts
    │   ├── useMasterAuth.tsx
    │   ├── useSmsDeliveryStatus.ts
    │   └── useUILanguage.ts
    │
    ├── lib/
    │   ├── accessPolicy.ts
    │   ├── api.ts
    │   ├── i18n.ts
    │   ├── masterRoutes.ts
    │   ├── roleAccess.ts
    │   ├── socket.ts
    │   └── utils.ts
    │
    ├── pages/
    │   ├── Dashboard.tsx
    │   ├── Home.tsx
    │   ├── Login.tsx
    │   │
    │   ├── academics/
    │   │   ├── Attendance.tsx
    │   │   ├── Classes.tsx
    │   │   ├── Subjects.tsx
    │   │   └── Timetable.tsx
    │   │
    │   ├── admin/
    │   │   └── hub/
    │   │       ├── page.tsx
    │   │       └── components/
    │   │           ├── EtablissementTable.tsx
    │   │           ├── SearchBar.tsx
    │   │           └── StatCard.tsx
    │   │
    │   ├── finance/
    │   │   ├── Expenses.tsx
    │   │   ├── FeePlans.tsx
    │   │   ├── Invoices.tsx
    │   │   ├── OverdueAndReminders.tsx
    │   │   └── Payments.tsx
    │   │
    │   ├── lms/
    │   │   ├── Exam.tsx
    │   │   ├── Exams.tsx
    │   │   └── ReportCards.tsx
    │   │
    │   ├── master/
    │   │   ├── MasterDecoy.tsx
    │   │   ├── MasterEmailHistory.tsx
    │   │   ├── MasterEntry.tsx
    │   │   ├── MasterLogin.tsx
    │   │   ├── MasterSchoolDetail.tsx
    │   │   ├── MasterSchools.tsx
    │   │   └── MasterSecurity.tsx
    │   │
    │   ├── onboarding/
    │   │   ├── OnboardingConfirmation.tsx
    │   │   ├── SchoolActivate.tsx
    │   │   ├── SchoolInvite.tsx
    │   │   ├── SchoolJoin.tsx
    │   │   ├── SchoolOnboarding.tsx
    │   │   └── SchoolOnboardingRequests.tsx
    │   │
    │   ├── parent/
    │   │   ├── ChildDetails.tsx
    │   │   ├── ParentDashboard.tsx
    │   │   └── ParentSettings.tsx
    │   │
    │   ├── routes/
    │   │   ├── PrivateRoutes.tsx
    │   │   ├── RoleGuard.tsx
    │   │   └── router.tsx
    │   │
    │   ├── settings/
    │   │   ├── academic-year.tsx
    │   │   ├── EmailHistory.tsx
    │   │   ├── SchoolConfiguration.tsx
    │   │   └── Subjects.tsx
    │   │
    │   ├── superadmin/
    │   │   ├── AuditLog.tsx
    │   │   ├── DashboardSuperAdmin.tsx
    │   │   ├── InviteModal.tsx
    │   │   ├── InviteSchoolForm.tsx
    │   │   ├── ProtectedSuperAdmin.tsx
    │   │   ├── SchoolDetailPage.tsx
    │   │   ├── SchoolOnboardingForm.tsx
    │   │   ├── SchoolsTable.tsx
    │   │   └── superadmin.css
    │   │
    │   └── users/
    │       └── index.tsx
    │
    └── styles/
        └── superadmin-theme.css
```

## Résumé

- **Nombre de fichiers:** ~160 (hors node_modules)
- **Technologies:** React 19, TypeScript, Vite (Rolldown), Tailwind CSS 4, Shadcn UI (Radix), React Router 7, React Hook Form, Zod, Axios, Socket.io-client, Recharts, date-fns, Lucide React, Sonner
- **Fonctionnalités:**
  - Authentification multi-rôles (admin, teacher, student, parent, superadmin, master)
  - Dashboard admin/parent avec statistiques et IA
  - Gestion des écoles (superadmin, master)
  - Gestion des utilisateurs, classes, matières, périodes académiques
  - Génération et affichage d'emploi du temps
  - Système LMS (ExamGenerator, ExamRadio)
  - Gestion des bulletins et notes
  - Thèmes (dark/light) et internationalisation (i18n)
  - WebSocket temps réel (Socket.io)
  - Composants UI modernes (shadcn/ui + Radix)
  - Pages d'accueil (Hero, Programs, Stats, Footer)
  - Hub admin avec tableau de bord des établissements
  - Pages finance (dépenses, plans de frais, factures, paiements, relances)
  - Portail parent (enfants, tableau de bord, paramètres)
  - Onboarding complet des écoles (invitation, activation, confirmation)
  - Pages master (sécurité, email, écoles, login, détail)
  - Formulaires avec validation (React Hook Form + Zod)
