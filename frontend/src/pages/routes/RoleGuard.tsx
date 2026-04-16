import { Navigate } from "react-router";
import { useAuth } from "@/hooks/AuthProvider";
import type { UserRole } from "@/types";
import { getRoleHomePath } from "@/lib/roleAccess";
import { getAllowedRolesForPath } from "@/lib/accessPolicy";

interface Props {
  path?: string;
  allowedRoles?: UserRole[];
  children: React.ReactNode;
}

export default function RoleGuard({ path, allowedRoles, children }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const resolvedAllowedRoles =
    (path ? getAllowedRolesForPath(path) : undefined) || allowedRoles || [];

  if (!resolvedAllowedRoles.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return <>{children}</>;
}
