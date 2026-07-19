export type AdminSection =
  | 'dashboard' | 'users' | 'classes' | 'subjects'
  | 'attendance' | 'grades' | 'bulletins' | 'timetable'
  | 'council' | 'academic-year' | 'finance' | 'ai' | 'statistics' | 'communications' | 'settings'
  | 'pedagogie' | 'rh' | 'lv2-choice' | 'entrance-exams' | 'pebs-exams' | 'matricules' | 'school-payments' | 'eleve-onboarding' | 'minesec-stats' | 'minedub-stats' | 'notifications'

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}
