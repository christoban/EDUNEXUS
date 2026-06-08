export type TeacherSection =
  | 'dashboard' | 'classes' | 'attendance' | 'grades'
  | 'bulletins' | 'timetable' | 'exams' | 'resources'

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}
