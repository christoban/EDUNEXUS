export type TeacherSection =
  | 'dashboard' | 'classes' | 'attendance' | 'grades'
  | 'bulletins' | 'timetable' | 'resources' | 'sync'

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface UserInfo {
  id: string
  firstName: string
  lastName: string
  email: string
  role: string
  teacherProfile?: {
    id: string
    specialization: string[]
    teacherSubjects: { subject: { id: string; name: string } }[]
  } | null
}
