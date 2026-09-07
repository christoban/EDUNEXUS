import type { UserRole } from '@domain/types/enums';

export function canManageEnrollment(params: {
  role: UserRole | string;
  staffPermissions?: readonly string[];
}): boolean {
  if (params.role === 'ADMIN') return true;
  return params.role === 'STAFF' && (params.staffPermissions?.includes('MANAGE_ENROLLMENT') ?? false);
}