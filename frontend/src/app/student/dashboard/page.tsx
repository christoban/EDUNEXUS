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
import SectionStudentLibrary from './_components/SectionStudentLibrary'
import type { StudentSection, Toast, UserInfo } from './_types'
import { fetchApi } from '@/lib/fetchApi'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { db } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'

let toastId = 0

export default function StudentDashboard() {
  const tnav = useT('navigation')
  const TITLES: Record<StudentSection, string> = {
    dashboard:  tnav('pageTitle.student_dashboard'),
    grades:     tnav('pageTitle.student_grades'),
    bulletins:  tnav('pageTitle.student_bulletins'),
    timetable:  tnav('pageTitle.student_timetable'),
    attendance: tnav('pageTitle.student_attendance'),
    library:    tnav('pageTitle.student_library'),
  }
  const [section, setSection] = useState<StudentSection>('dashboard')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)

  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setSchoolInfo(d.data) })
      .catch(() => {})
    fetchApi('/api/v2/users/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setUser(d.data) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!user || !navigator.onLine) return
    const uid = user.id
    ;(async () => {
      try {
        const now = Date.now()
        const rcRes = await fetchApi('/api/v2/report-cards/my', { credentials: 'include' }).then(r => r.json())
        if (rcRes.reportCards) await db.cachedData.put({ key: `student:bulletins:${uid}`, data: rcRes.reportCards, cachedAt: now })
        const [statsRes, recordsRes] = await Promise.all([
          fetchApi('/api/v2/attendance/stats', { credentials: 'include' }).then(r => r.json()),
          fetchApi('/api/v2/attendance?limit=100', { credentials: 'include' }).then(r => r.json()),
        ])
        const stats = statsRes.stats ? {
          total: statsRes.stats.total || 0, present: statsRes.stats.present || 0,
          absent: statsRes.stats.absent || 0, late: statsRes.stats.late || 0,
          excused: statsRes.stats.excused || 0, attendanceRate: statsRes.stats.attendanceRate || '0%',
        } : null
        const weeks: Record<string, { week: string; present: number; absent: number; late: number; excused: number }> = {}
        ;(recordsRes.records || []).forEach((r: any) => {
          const d = new Date(r.date), sw = new Date(d)
          sw.setDate(d.getDate() - d.getDay() + 1)
          const k = sw.toISOString().slice(0, 10)
          if (!weeks[k]) weeks[k] = { week: k, present: 0, absent: 0, late: 0, excused: 0 }
          if (r.status === 'PRESENT') weeks[k].present++
          else if (r.status === 'ABSENT') weeks[k].absent++
          else if (r.status === 'LATE') weeks[k].late++
          else if (r.status === 'EXCUSED') weeks[k].excused++
        })
        const fmt = (s: string) => { const d = new Date(s + 'T00:00:00'), e = new Date(d); e.setDate(d.getDate() + 4); return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` }
        const weekly = Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week)).map(w => ({ ...w, week: fmt(w.week) }))
        await db.cachedData.put({ key: `student:attendance:${uid}`, data: { stats, weekly }, cachedAt: now })
      } catch { /* silent */ }
    })()
  }, [user])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const sProps = { onToast: showToast, user }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
      <StudentSidebar current={section} onChange={setSection} schoolName={schoolInfo?.name} logoUrl={schoolInfo?.logoUrl} onLogout={logoutUser} user={user} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{ height: 68, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {TITLES[section]}
          </div>
          <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 14px', fontSize: 15, fontWeight: 700, color: 'var(--text3)' }}>
            Trimestre 2 · Séquence 3
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} color="var(--text2)" />
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: 'var(--red)', borderRadius: '50%', border: '2px solid white' }} />
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
          {section === 'dashboard'  && <SectionStudentDashboard onNav={s => setSection(s as StudentSection)} {...sProps} />}
          {section === 'grades'     && <SectionStudentGrades {...sProps} />}
          {section === 'bulletins'  && <SectionStudentBulletins {...sProps} />}
          {section === 'timetable'  && <SectionStudentTimetable {...sProps} />}
          {section === 'attendance' && <SectionStudentAttendance {...sProps} />}
          {section === 'library'    && <SectionStudentLibrary />}
        </main>
      </div>

      <StudentToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
    </div>
  )
}
