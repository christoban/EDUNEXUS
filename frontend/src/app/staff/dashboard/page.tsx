'use client'

import { useState, useCallback, useEffect } from 'react'
import type { StaffSection, SessionUser, Toast } from './_types'
import { getSectionsFromPermissions } from './_types'

import StaffSidebar     from './_components/StaffSidebar'
import StaffTopbar      from './_components/StaffTopbar'
import StaffToast       from './_components/StaffToast'
import SectionStaffDashboard   from './_components/SectionStaffDashboard'
import SectionCouncil          from './_components/SectionCouncil'
import SectionGradeValidation  from './_components/SectionGradeValidation'
import SectionAttendanceStaff  from './_components/SectionAttendanceStaff'
import SectionGrilleHoraire    from './_components/SectionGrilleHoraire'
import SectionAffectations     from './_components/SectionAffectations'
import SectionTimetableStaff   from './_components/SectionTimetableStaff'
import SectionFinanceStaff     from './_components/SectionFinanceStaff'
import SectionCautions         from './_components/SectionCautions'
import SectionDiscipline       from './_components/SectionDiscipline'
import SectionLibrary          from './_components/SectionLibrary'
import SectionOrientation      from './_components/SectionOrientation'
import SectionDepartementsStaff from './_components/SectionDepartementsStaff'
import SectionMonProfilRH from '@/components/SectionMonProfilRH'
import { fetchApi } from '@/lib/fetchApi'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ChangePasswordModal from '@/components/ChangePasswordModal'

let toastId = 0

export default function StaffDashboard() {
  const [section, setSection]           = useState<StaffSection>('dashboard')
  const [toasts, setToasts]             = useState<Toast[]>([])
  const [sessionUser, setSessionUser]   = useState<SessionUser | null>(null)
  const [allowedSections, setAllowedSections] = useState<Set<StaffSection>>(new Set(['dashboard', 'mon-profil-rh']))
  const [schoolName, setSchoolName]     = useState<string | undefined>(undefined)
  const [logoUrl,    setLogoUrl]        = useState<string | null>(null)
  const [changePwdOpen, setChangePwdOpen] = useState(false)

  // Lecture session depuis localStorage (stockée au login)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const user = JSON.parse(raw) as SessionUser
        setSessionUser(user)
        setAllowedSections(getSectionsFromPermissions(user.permissions ?? []))
      }
    } catch { /* silencieux — données absentes ou corrompues */ }
  }, [])

  // Infos école depuis l'API
  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setSchoolName(d.data.name); setLogoUrl(d.data.logoUrl ?? null) } })
      .catch(() => {})
  }, [])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const navTo = useCallback((s: StaffSection) => {
    if (allowedSections.has(s)) setSection(s)
  }, [allowedSections])

  const can = (s: StaffSection) => allowedSections.has(s)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>

      <StaffSidebar
        current={section}
        onChange={navTo}
        allowedSections={allowedSections}
        sessionUser={sessionUser}
        schoolName={schoolName}
        logoUrl={logoUrl}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <StaffTopbar section={section} onChangePassword={() => setChangePwdOpen(true)} />

        <main style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>

          {section === 'dashboard' && (
            <SectionStaffDashboard
              sessionUser={sessionUser}
              allowedSections={allowedSections}
              onNav={navTo}
              onToast={showToast}
            />
          )}

          {section === 'council' && can('council') && (
            <SectionCouncil onToast={showToast} />
          )}

          {section === 'grades' && can('grades') && (
            <SectionGradeValidation onToast={showToast} />
          )}

          {section === 'attendance' && can('attendance') && (
            <SectionAttendanceStaff onToast={showToast} />
          )}

          {section === 'grille-horaire' && can('grille-horaire') && (
            <SectionGrilleHoraire onToast={showToast} />
          )}

          {section === 'affectations' && can('affectations') && (
            <SectionAffectations onToast={showToast} />
          )}

          {section === 'timetable' && can('timetable') && (
            <SectionTimetableStaff onToast={showToast} />
          )}

          {section === 'finance' && can('finance') && (
            <SectionFinanceStaff onToast={showToast} sessionUser={sessionUser} />
          )}

          {section === 'cautions' && can('cautions') && (
            <SectionCautions onToast={showToast} />
          )}

          {section === 'discipline' && can('discipline') && (
            <SectionDiscipline onToast={showToast} />
          )}

          {section === 'library' && can('library') && (
            <SectionLibrary onToast={showToast} />
          )}

          {section === 'orientation' && can('orientation') && (
            <SectionOrientation onToast={showToast} />
          )}

          {section === 'departements' && can('departements') && (
            <SectionDepartementsStaff onToast={showToast} />
          )}

          {section === 'mon-profil-rh' && <SectionMonProfilRH onToast={showToast} />}

        </main>
      </div>

      <StaffToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
    </div>
  )
}
