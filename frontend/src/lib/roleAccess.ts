import type { UserRole } from "@/types";

export const getRoleHomePath = (role?: UserRole | null) => {
  if (role === "parent") return "/parent/dashboard";
  return "/dashboard";
};
