// Remplacer le contenu entier de src/lib/roleAccess.ts par :

import type { UserRole } from "@/types";

export const getRoleHomePath = (role?: UserRole | string | null): string => {
  const r = String(role || "").toLowerCase();
  switch (r) {
    case "admin":
      return "/admin/dashboard";
    case "teacher":
      return "/teacher/grades";
    case "staff":
      return "/staff/timetable";
    case "parent":
      return "/parent/dashboard";
    case "student":
      return "/student/report-cards";
    default:
      return "/dashboard";
  }
};