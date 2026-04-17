import type { UserRole } from "@/types";

export type SidebarIconKey =
  | "LayoutDashboard"
  | "School"
  | "GraduationCap"
  | "Users"
  | "Settings2"
  | "Wallet";

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
      { title: "Dashboard", url: "/dashboard" },
      { title: "Activities Log", url: "/activities-log" },
    ],
  },
  {
    title: "Academics",
    icon: "School",
    items: [
      { title: "Classes", url: "/classes" },
      { title: "Subjects", url: "/subjects" },
      { title: "Timetable", url: "/timetable" },
      { title: "Attendance", url: "/attendance" },
    ],
  },
  {
    title: "Learning (LMS)",
    icon: "GraduationCap",
    items: [
      { title: "Exams", url: "/lms/exams" },
      { title: "Report Cards", url: "/lms/report-cards" },
    ],
  },
  {
    title: "People",
    icon: "Users",
    items: [
      { title: "Students", url: "/users/students" },
      { title: "Teachers", url: "/users/teachers" },
      { title: "Parents", url: "/users/parents" },
      { title: "Admins", url: "/users/admins" },
    ],
  },
  {
    title: "System",
    icon: "Settings2",
    items: [
      { title: "School Configuration", url: "/settings/configuration" },
      { title: "Manage Subjects", url: "/settings/subjects" },
      { title: "Academic Years", url: "/settings/academic-years" },
      { title: "Email History", url: "/settings/email-history" },
      { title: "Roles & Permissions", url: "/settings/roles" },
    ],
  },
  {
    title: "Finance",
    icon: "Wallet",
    items: [
      { title: "Plans de Frais", url: "/finance/fee-plans" },
      { title: "Facturation", url: "/finance/invoices" },
      { title: "Paiements", url: "/finance/payments" },
      { title: "Depenses", url: "/finance/expenses" },
      { title: "Relances", url: "/finance/reminders" },
    ],
  },
  {
    title: "Parent Portal",
    icon: "LayoutDashboard",
    items: [
      { title: "My Children", url: "/parent/dashboard" },
      { title: "Settings", url: "/parent/settings" },
    ],
  },
];

export const ROUTE_ROLE_POLICY: Array<{ path: string; roles: UserRole[] }> = [
  { path: "/dashboard", roles: ["admin", "teacher", "student"] },
  { path: "/activities-log", roles: ["admin"] },
  { path: "/users/students", roles: ["admin"] },
  { path: "/users/teachers", roles: ["admin"] },
  { path: "/users/parents", roles: ["admin"] },
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
