export type ParentSection = 'children' | 'grades' | 'attendance' | 'payments' | 'timetable' | 'settings' | 'library' | 'apee' | 'notifications'

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface ChildWithStats {
  studentId: string
  prenom: string
  nom: string
  classeNom?: string
  classeId?: string
  tauxPresence: number
  tauxPonctualite: number
  joursAbsent: number
  derniereeMention?: string
  dernieereMoyenne?: number
  indiceSante?: number
}

export interface ReportCard {
  id: string
  generalAverage: number | null
  rank: number | null
  mention: string | null
  totalStudents: number | null
  student: { id: string; firstName: string; lastName: string }
  academicPeriod?: { name: string }
}
