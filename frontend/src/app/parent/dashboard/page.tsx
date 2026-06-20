'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { logoutUser } from '@/lib/userAuth'
import ParentSidebar from './_components/ParentSidebar'
import ParentToast from './_components/ParentToast'
import SectionParentChildren from './_components/SectionParentChildren'
import SectionParentGrades from './_components/SectionParentGrades'
import SectionParentAttendance from './_components/SectionParentAttendance'
import SectionParentPayments from './_components/SectionParentPayments'
import SectionParentTimetable from './_components/SectionParentTimetable'
import SectionParentSettings from './_components/SectionParentSettings'
import SectionParentLibrary from './_components/SectionParentLibrary'
import type { ParentSection, Toast } from './_types'
import { fetchApi } from '@/lib/fetchApi'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { db } from '@/lib/offline/db'

let toastId = 0

const TITLES: Record<ParentSection, string> = {
  children:   'Mes enfants',
  grades:     'Bulletins & Notes',
  attendance: 'Présences',
  payments:   'Paiements Mobile Money',
  timetable:  'Emploi du temps',
  settings:   'Paramètres',
  library:    'Lectures',
}

interface UserInfo { id: string; firstName: string; lastName: string; role: string }
interface SchoolInfo { name: string; logoUrl: string | null }

export default function ParentDashboard() {
  const [section, setSection] = useState<ParentSection>('children')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [user, setUser] = useState<UserInfo | null>(null)
  const [school, setSchool] = useState<SchoolInfo | null>(null)

  useEffect(() => {
    fetchApi('/api/v2/users/me', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setUser(d.data) }).catch(() => {})
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setSchool(d.data) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user || !navigator.onLine) return
    const uid = user.id
    ;(async () => {
      try {
        const childrenRes = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
        if (!childrenRes.success) return
        const children = childrenRes.data
        const now = Date.now()
        await db.cachedData.put({ key: `parent:children:${uid}`, data: children, cachedAt: now })
        await db.cachedData.put({ key: `parent:attendance:${uid}`, data: children, cachedAt: now })
        const rcRes = await fetchApi('/api/v2/report-cards', { credentials: 'include' }).then(r => r.json())
        await db.cachedData.put({ key: `parent:grades:${uid}`, data: { children, bulletins: rcRes.reportCards ?? [] }, cachedAt: now })
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

  const sProps = { onToast: showToast }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f7f3ee', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
      <ParentSidebar current={section} onChange={setSection} onLogout={logoutUser} user={user} school={school} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{ height: 68, background: 'white', borderBottom: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>
            {TITLES[section]}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} color="#6b5c45" />
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#dc2626', borderRadius: '50%', border: '2px solid white' }} />
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'hidden', background: '#f7f3ee' }}>
          {section === 'children'   && <SectionParentChildren onNav={s => setSection(s as ParentSection)} {...sProps} userId={user?.id} />}
          {section === 'grades'     && <SectionParentGrades {...sProps} userId={user?.id} />}
          {section === 'attendance' && <SectionParentAttendance {...sProps} userId={user?.id} />}
          {section === 'payments'   && <SectionParentPayments {...sProps} />}
          {section === 'timetable'  && <SectionParentTimetable {...sProps} userId={user?.id} />}
          {section === 'settings'   && <SectionParentSettings />}
          {section === 'library'    && <SectionParentLibrary userId={user?.id} />}
        </main>
      </div>

      <ParentToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
    </div>
  )
}
