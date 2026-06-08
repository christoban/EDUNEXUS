export type AdminSection =
  | 'dashboard' | 'users' | 'classes' | 'subjects'
  | 'attendance' | 'grades' | 'bulletins' | 'timetable'
  | 'council' | 'academic-year' | 'finance' | 'ai' | 'settings'

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}
