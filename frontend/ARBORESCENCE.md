# Arborescence du Frontend EDUNEXUS

```
frontend/
├── .env
├── bun.lock
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── components.json
├── index.html
├── eslint.config.js
├── .gitignore
│
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── index.css
    ├── types.ts
    │
    ├── styles/
    │   └── superadmin-theme.css
    │
    ├── lib/
    │   ├── api.ts
    │   ├── i18n.ts
    │   ├── accessPolicy.ts
    │   ├── masterRoutes.ts
    │   ├── roleAccess.ts
    │   ├── socket.ts
    │   └── utils.ts
    │
    ├── hooks/
    │   ├── AuthProvider.tsx
    │   ├── use-mobile.ts
    │   ├── use-toast.ts
    │   ├── useUILanguage.ts
    │   ├── useMasterAuth.tsx
    │   └── useSmsDeliveryStatus.ts
    │
    ├── components/
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
    │   ├── auth/
    │   │   └── UniversalUserForm.tsx
    │   │
    │   ├── academic-year/
    │   │   ├── AcademicYearForm.tsx
    │   │   ├── academic-year-table.tsx
    │   │   └── schema.ts
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
    │   │   ├── team-switcher.tsx
    │   │   ├── SuperAdminNavbar.tsx
    │   │   └── ThemeToogle.tsx
    │   │
    │   ├── subjects/
    │   │   ├── SubjectForm.tsx
    │   │   ├── SubjectTable.tsx
    │   │   └── schema.ts
    │   │
    │   ├── timetable/
    │   │   ├── GeneratorControls.tsx
    │   │   └── TimetableGrid.tsx
    │   │
    │   └── users/
    │       ├── UserDialog.tsx
    │       └── UserTable.tsx
    │
    ├── pages/
    │   ├── routes/
    │   │   ├── PrivateRoutes.tsx
    │   │   ├── RoleGuard.tsx
    │   │   └── router.tsx
    │   │
    │   ├── superadmin/
    │   │   ├── AuditLog.tsx
    │   │   ├── DashboardSuperAdmin.tsx
    │   │   ├── InviteSchoolForm.tsx
    │   │   ├── ProtectedSuperAdmin.tsx
    │   │   ├── SchoolOnboardingForm.tsx
    │   │   ├── SchoolsTable.tsx
    │   │   └── superadmin.css
    │   │
    │   ├── master/
    │   │   ├── MasterSchoolDetail.tsx
    │   │   ├── MasterSchools.tsx
    │   │   └── MasterSecurity.tsx
    │   │
    │   ├── onboarding/
    │   │   ├── SchoolInvite.tsx
    │   │   ├── SchoolOnboarding.tsx
    │   │   └── SchoolOnboardingRequests.tsx
    │   │
    │   ├── parent/
    │   │   ├── ChildDetails.tsx
    │   │   ├── ParentDashboard.tsx
    │   │   └── ParentSettings.tsx
    │   │
    │   ├── settings/
    │   │   ├── EmailHistory.tsx
    │   │   ├── SchoolConfiguration.tsx
    │   │   ├── Subjects.tsx
    │   │   └── academic-year.tsx
    │   │
    │   └── users/
    │       └── index.tsx
    │
    └── @/
        └── components/
            └── ui/
                ├── badge.tsx
                ├── button.tsx
                ├── dialog.tsx
                ├── multi-select.tsx
                ├── popover.tsx
                └── ...
```

## Résumé

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
  - Formulaires avec validation (React Hook Form + Zod)
- **Architecture:** Composants React + Pages + Hooks + Lib utils + UI components
