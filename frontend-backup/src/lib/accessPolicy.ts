import type { UserRole } from "@/types";

export type SidebarIconKey =
  | "LayoutDashboard"
  | "School"
  | "GraduationCap"
  | "Users"
  | "Settings2"
  | "Wallet"
  | "Brain";

export interface SidebarNavItemPolicy {
  title: string;
  url: string;
}

export interface SidebarNavSectionPolicy {
  title: string;
  icon: SidebarIconKey;
  items: SidebarNavItemPolicy[];
}

export const SIDEBAR_NAV_POLICY: SidebarNavSectionPolicy[] = [
  {
    title: "Dashboard",
    icon: "LayoutDashboard",
    items: [
      { title: "Tableau de bord", url: "/admin/dashboard" },
      { title: "Journal d'activités", url: "/activities-log" },
    ],
  },
  {
    title: "Académique",
    icon: "School",
    items: [
      { title: "Classes", url: "/admin/classes" },
      { title: "Matières", url: "/admin/subjects" },
      { title: "Emploi du temps", url: "/staff/timetable" },
      { title: "Présence", url: "/admin/absences" },
    ],
  },
  {
    title: "IA & Insights",
    icon: "Brain",
    items: [
      { title: "IA & Insights", url: "/teacher/ai-insights" },
    ],
  },
  {
    title: "Notes & Bulletins",
    icon: "GraduationCap",
    items: [
      { title: "Statut des notes", url: "/admin/grades" },
      { title: "Validation des notes", url: "/staff/grade-validation" },
      { title: "Bulletins scolaires", url: "/admin/report-cards" },
      { title: "Conseil de classe", url: "/staff/class-council" },
    ],
  },
  {
    title: "Personnes",
    icon: "Users",
    items: [
      { title: "Élèves", url: "/users/students" },
      { title: "Enseignants", url: "/users/teachers" },
      { title: "Parents", url: "/users/parents" },
      { title: "Personnel", url: "/users/staff" },
    ],
  },
  {
    title: "Système",
    icon: "Settings2",
    items: [
      { title: "Paramètres école", url: "/admin/settings" },
      { title: "Années scolaires", url: "/settings/academic-years" },
      { title: "Fin d'année", url: "/admin/year-end" },
    ],
  },
  {
    title: "Finance",
    icon: "Wallet",
    items: [
      { title: "Plans de frais", url: "/finance/fee-plans" },
      { title: "Facturation", url: "/finance/invoices" },
      { title: "Paiements", url: "/finance/payments" },
      { title: "Dépenses", url: "/finance/expenses" },
      { title: "Vue globale", url: "/staff/finance" },
      { title: "Cautions", url: "/staff/cautions" },
    ],
  },
  {
    title: "Finances",
    icon: "Wallet",
    items: [
      { title: "Mes paiements", url: "/parent/payments" },
    ],
  },
];

export const ROUTE_ROLE_POLICY: Array<{ path: string; roles: UserRole[] }> = [
  { path: "/dashboard", roles: ["admin", "teacher", "student"] },
  { path: "/admin/dashboard", roles: ["admin"] },
  { path: "/admin/users", roles: ["admin"] },
  { path: "/admin/classes", roles: ["admin"] },
  { path: "/admin/subjects", roles: ["admin"] },
  { path: "/admin/settings", roles: ["admin"] },
  { path: "/admin/grades", roles: ["admin"] },
  { path: "/admin/report-cards", roles: ["admin"] },
  { path: "/admin/absences", roles: ["admin"] },
  { path: "/admin/year-end", roles: ["admin"] },
  { path: "/teacher/grades", roles: ["teacher", "admin"] },
  { path: "/teacher/attendance", roles: ["teacher", "admin"] },
  { path: "/staff/timetable", roles: ["staff", "admin"] },
  { path: "/staff/class-council", roles: ["staff", "admin"] },
  { path: "/staff/grade-validation", roles: ["staff", "admin"] },
  { path: "/parent/report-cards", roles: ["parent"] },
  { path: "/student/report-cards", roles: ["student"] },
  { path: "/activities-log", roles: ["admin"] },
  { path: "/users/students", roles: ["admin"] },
  { path: "/users/teachers", roles: ["admin"] },
  { path: "/users/parents", roles: ["admin"] },
  { path: "/users/staff", roles: ["admin"] },
  { path: "/users/admins", roles: ["admin"] },
  { path: "/classes", roles: ["admin"] },
  { path: "/subjects", roles: ["admin"] },
  { path: "/timetable", roles: ["admin", "teacher", "student", "parent"] },
  { path: "/attendance", roles: ["admin", "teacher", "student", "parent"] },
  { path: "/lms/exams", roles: ["admin", "teacher", "student"] },
  { path: "/lms/exams/:id", roles: ["admin", "teacher", "student"] },
  { path: "/lms/report-cards", roles: ["admin", "teacher", "student"] },
  { path: "/settings/school", roles: ["admin"] },
  { path: "/settings/configuration", roles: ["admin"] },
  { path: "/settings/subjects", roles: ["admin"] },
  { path: "/settings/academic-years", roles: ["admin"] },
  { path: "/settings/email-history", roles: ["admin"] },
  { path: "/settings/roles", roles: ["admin"] },
  { path: "/finance/fee-plans", roles: ["admin"] },
  { path: "/finance/invoices", roles: ["admin"] },
  { path: "/finance/payments", roles: ["admin"] },
  { path: "/finance/expenses", roles: ["admin"] },
  { path: "/finance/reminders", roles: ["admin"] },
  { path: "/staff/finance", roles: ["admin", "staff"] },
  { path: "/staff/cautions", roles: ["admin", "staff"] },
  { path: "/teacher/ai-insights", roles: ["teacher", "admin"] },
  { path: "/parent/payments", roles: ["parent"] },
  { path: "/parent/dashboard", roles: ["parent"] },
  { path: "/parent/settings", roles: ["parent"] },
  { path: "/parent/children/:childId", roles: ["parent"] },
];

const normalizePath = (path: string) => {
  if (!path) return "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.replace(/\/+$/, "") || "/";
};

const doesPathMatchPattern = (pattern: string, currentPath: string) => {
  const patternParts = normalizePath(pattern).split("/").filter(Boolean);
  const currentParts = normalizePath(currentPath).split("/").filter(Boolean);

  if (patternParts.length !== currentParts.length) {
    return false;
  }

  return patternParts.every((segment, index) => {
    if (segment.startsWith(":")) {
      return true;
    }

    return segment === currentParts[index];
  });
};

export const getAllowedRolesForPath = (path: string) => {
  const normalized = normalizePath(path);
  const match = ROUTE_ROLE_POLICY.find((rule) =>
    doesPathMatchPattern(rule.path, normalized)
  );

  return match?.roles;
};

export const canAccessPath = (role: UserRole, path: string) => {
  const allowedRoles = getAllowedRolesForPath(path);

  if (!allowedRoles) {
    return false;
  }

  return allowedRoles.includes(role);
};
