export type StaffSection =
  | 'dashboard' | 'council' | 'grades' | 'timetable'
  | 'attendance' | 'finance' | 'cautions' | 'discipline'
  | 'library' | 'orientation'

export interface SessionUser {
  userId: string
  role: string
  nomComplet: string
  firstName: string
  permissions: string[]
}

export interface Toast {
  id: number
  msg: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export const SECTION_TITLES: Record<StaffSection, string> = {
  dashboard:   'Tableau de bord',
  council:     'Conseil de classe',
  grades:      'Validation des notes',
  timetable:   'Emploi du temps',
  attendance:  'Présences',
  finance:     'Mobile Money',
  cautions:    'Cautions',
  discipline:  'Discipline',
  library:     'Bibliothèque',
  orientation: 'Orientation',
}

export const PERM_TO_SECTION: { perm: string; section: StaffSection }[] = [
  { perm: 'MANAGE_CLASS_COUNCIL', section: 'council'     },
  { perm: 'VALIDATE_GRADES',      section: 'grades'      },
  { perm: 'MANAGE_TIMETABLE',     section: 'timetable'   },
  { perm: 'MANAGE_ATTENDANCE',    section: 'attendance'  },
  { perm: 'MANAGE_FINANCE',       section: 'finance'     },
  { perm: 'VALIDATE_PAYMENTS',    section: 'finance'     },
  { perm: 'MANAGE_FINANCE',       section: 'cautions'    },
  { perm: 'VALIDATE_PAYMENTS',    section: 'cautions'    },
  { perm: 'MANAGE_DISCIPLINE',    section: 'discipline'  },
  { perm: 'MANAGE_LIBRARY',       section: 'library'     },
  { perm: 'MANAGE_ORIENTATION',   section: 'orientation' },
]

export function getSectionsFromPermissions(permissions: string[]): Set<StaffSection> {
  const set = new Set<StaffSection>(['dashboard'])
  for (const { perm, section } of PERM_TO_SECTION) {
    if (permissions.includes(perm)) set.add(section)
  }
  return set
}
