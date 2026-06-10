'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { logoutUser } from '@/lib/userAuth'
import StudentSidebar from './_components/StudentSidebar'
import StudentToast from './_components/StudentToast'
import SectionStudentDashboard from './_components/SectionStudentDashboard'
import SectionStudentGrades from './_components/SectionStudentGrades'
import SectionStudentBulletins from './_components/SectionStudentBulletins'
import SectionStudentTimetable from './_components/SectionStudentTimetable'
import SectionStudentAttendance from './_components/SectionStudentAttendance'
import type { StudentSection, Toast, UserInfo } from './_types'

let toastId = 0

const TITLES: Record<StudentSection, string> = {
  dashboard:  'Tableau de bord',
  grades:     'Mes notes',
  bulletins:  'Mes bulletins',
  timetable:  'Mon emploi du temps',
  attendance: 'Mes présences',
}

export default function StudentDashboard() {
  const [section, setSection] = useState<StudentSection>('dashboard')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetch('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setSchoolInfo(d.data) })
      .catch(() => {})
    fetch('/api/v2/users/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setUser(d.data) })
      .catch(() => {})
  }, [])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const sProps = { onToast: showToast, user }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f7f3ee', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
      <StudentSidebar current={section} onChange={setSection} schoolName={schoolInfo?.name} logoUrl={schoolInfo?.logoUrl} onLogout={logoutUser} user={user} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{ height: 68, background: 'white', borderBottom: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>
            {TITLES[section]}
          </div>
          <span style={{ background: '#f0ebe3', border: '1px solid #e8e0d4', borderRadius: 20, padding: '4px 14px', fontSize: 15, fontWeight: 700, color: '#a89478' }}>
            Trimestre 2 · Séquence 3
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} color="#6b5c45" />
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#dc2626', borderRadius: '50%', border: '2px solid white' }} />
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'hidden', background: '#f7f3ee' }}>
          {section === 'dashboard'  && <SectionStudentDashboard onNav={s => setSection(s as StudentSection)} {...sProps} />}
          {section === 'grades'     && <SectionStudentGrades {...sProps} />}
          {section === 'bulletins'  && <SectionStudentBulletins {...sProps} />}
          {section === 'timetable'  && <SectionStudentTimetable {...sProps} />}
          {section === 'attendance' && <SectionStudentAttendance {...sProps} />}
        </main>
      </div>

      <StudentToast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
