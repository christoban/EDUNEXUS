'use client'

/**
 * Cache RBAC — lecture typée de localStorage.zekoulabia_user.
 * Source unique du parsing : chaque composant qui a besoin du rôle/permissions de l'utilisateur
 * courant doit passer par ici au lieu de reparser localStorage à sa façon.
 */

export type StaffPermissionType =
  | 'MANAGE_TIMETABLE' | 'VALIDATE_GRADES' | 'MANAGE_EXAMS'
  | 'SUPERVISE_TEACHERS' | 'MANAGE_ATTENDANCE' | 'MANAGE_DISCIPLINE'
  | 'MANAGE_INCIDENTS' | 'MANAGE_FINANCE' | 'VALIDATE_PAYMENTS'
  | 'GENERATE_REPORTS' | 'MANAGE_ATELIERS' | 'MANAGE_PRACTICAL_GRADES'
  | 'MANAGE_INTERNSHIPS' | 'MANAGE_STAGE_CONVENTIONS' | 'MANAGE_WORKSHOP_STOCK'
  | 'VIEW_DEPARTMENT_GRADES' | 'SUPERVISE_DEPARTMENT_TEACHERS'
  | 'VALIDATE_DEPARTMENT_TIMETABLE' | 'GENERATE_DEPARTMENT_REPORTS'
  | 'VIEW_SUPERVISED_GRADES' | 'SUPERVISE_LESSON_PLANS'
  | 'GENERATE_PEDAGOGICAL_REPORTS' | 'MANAGE_CE_REPORTS' | 'MANAGE_PEDAGOGICAL_BRIEF'
  | 'MANAGE_CLASS_COUNCIL' | 'MANAGE_CATCHUP_REQUESTS'
  | 'MANAGE_PATRIMOINE' | 'MANAGE_DEGRADATIONS'
  | 'MANAGE_LIBRARY' | 'MANAGE_ORIENTATION' | 'MANAGE_ENROLLMENT'

export interface CachedUser {
  userId?: string
  role?: string
  nomComplet?: string
  firstName?: string
  permissions?: string[]
}

const STORAGE_KEY = 'zekoulabia_user'

export function getCachedUser(): CachedUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedUser
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function hasPermission(permission: StaffPermissionType): boolean {
  const user = getCachedUser()
  return (user?.permissions ?? []).includes(permission)
}