# Arborescence du Frontend EDUNEXUS

```
frontend/
├── .env
├── .gitignore
├── @/
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
│   ├── apple-touch-icon.svg
│   ├── favicon.svg
│   ├── fonts.css
│   ├── icons.svg
│   ├── masked-icon.svg
│   ├── pwa-192x192.svg
│   └── pwa-512x512.svg
│
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── App.css
    ├── index.css
    ├── sw.ts
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
    │   ├── ai/
    │   │   └── AIChatbot.tsx
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
    │   ├── offline/
    │   │   ├── OfflineBanner.tsx
    │   │   ├── OfflineStatus.tsx
    │   │   └── SyncReport.tsx
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
    │   ├── superadmin/
    │   │   └── SensitiveDialog.tsx
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
    │   ├── useOnlineStatus.ts
    │   ├── useSmsDeliveryStatus.ts
    │   └── useUILanguage.ts
    │
    ├── lib/
    │   ├── accessPolicy.ts
    │   ├── api.ts
    │   ├── i18n.ts
    │   ├── masterRoutes.ts
    │   ├── offlineDB.ts
    │   ├── offlineQueue.ts
    │   ├── offlineSync.ts
    │   ├── roleAccess.ts
    │   ├── socket.ts
    │   └── utils.ts
    │
    ├── pages/
    │   ├── Dashboard.tsx
    │   ├── Home.tsx
    │   ├── Login.tsx
    │   ├── Offline.tsx
    │   │
    │   ├── academics/
    │   │   ├── Attendance.tsx
    │   │   ├── Classes.tsx
    │   │   ├── Subjects.tsx
    │   │   └── Timetable.tsx
    │   │
    │   ├── admin/
    │   │   ├── Absences.tsx
    │   │   ├── Classes.tsx
    │   │   ├── Dashboard.tsx
    │   │   ├── GradeStatus.tsx
    │   │   ├── ReportCards.tsx
    │   │   ├── Settings.tsx
    │   │   ├── Subjects.tsx
    │   │   ├── Users.tsx
    │   │   └── YearEnd.tsx
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
    │   │   └── MasterLogin.tsx
    │   │
    │   ├── onboarding/
    │   │   ├── OnboardingConfirmation.tsx
    │   │   └── SchoolOnboarding.tsx
    │   │
    │   ├── parent/
    │   │   ├── ChildDetails.tsx
    │   │   ├── ParentDashboard.tsx
    │   │   ├── ParentSettings.tsx
    │   │   ├── Payments.tsx
    │   │   └── ReportCards.tsx
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
    │   ├── staff/
    │   │   ├── Cautions.tsx
    │   │   ├── ClassCouncil.tsx
    │   │   ├── Finance.tsx
    │   │   ├── GradeValidation.tsx
    │   │   └── TimetableEditor.tsx
    │   │
    │   ├── student/
    │   │   └── ReportCards.tsx
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
    │   │   ├── superadmin.css
    │   │   ├── SuperAdminRequests.tsx
    │   │   └── SuperAdminSecurity.tsx
    │   │
    │   ├── teacher/
    │   │   ├── AIInsights.tsx
    │   │   ├── Attendance.tsx
    │   │   └── Grades.tsx
    │   │
    │   └── users/
    │       └── index.tsx
    │
    └── styles/
        └── superadmin-theme.css
```

## Résumé

- **Nombre de fichiers:** ~175 (hors node_modules)
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
  - Mode hors-ligne (offline) avec IndexedDB et file de synchronisation
  - PWA (service worker, icônes)
  - Composants UI modernes (shadcn/ui + Radix)
  - Pages d'accueil (Hero, Programs, Stats, Footer)
  - Pages admin (tableau de bord, absences, classes, matières, utilisateurs, bulletins, fin d'année)
  - Pages finance (dépenses, plans de frais, factures, paiements, relances)
  - Portail parent (enfants, tableau de bord, paramètres, paiements, bulletins)
  - Portail enseignant (présences, notes, insights IA)
  - Portail staff (conseil de classe, cautions, validation des notes, éditeur EDT, finance)
  - Portail étudiant (bulletins)
  - Onboarding des écoles (invitation, activation, confirmation)
  - Pages master (sécurité, email, écoles, login, détail)
  - Formulaires avec validation (React Hook Form + Zod)
  - Chatbot IA intégré
