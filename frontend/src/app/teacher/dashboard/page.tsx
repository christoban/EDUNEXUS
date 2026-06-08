'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bell, Search } from 'lucide-react'
import TeacherSidebar from './_components/TeacherSidebar'
import TeacherToast from './_components/TeacherToast'
import SectionTeacherDashboard from './_components/SectionTeacherDashboard'
import SectionTeacherClasses from './_components/SectionTeacherClasses'
import SectionTeacherAttendance from './_components/SectionTeacherAttendance'
import SectionTeacherGrades from './_components/SectionTeacherGrades'
import SectionTeacherExams from './_components/SectionTeacherExams'
import SectionTeacherTimetable from './_components/SectionTeacherTimetable'
import type { TeacherSection, Toast } from './_types'

let toastId = 0

const TITLES: Record<TeacherSection, string> = {
  dashboard:  'Tableau de bord',
  classes:    'Mes classes',
  attendance: 'Présences',
  grades:     'Notes',
  bulletins:  'Bulletins',
  timetable:  'Emploi du temps',
  exams:      'Examens',
  resources:  'Ressources',
}

const PLACEHOLDERS: Partial<Record<TeacherSection, { icon: string }>> = {
  bulletins: { icon: '📄' },
  resources: { icon: '📦' },
}

export default function TeacherDashboard() {
  const [section, setSection] = useState<TeacherSection>('dashboard')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)

  useEffect(() => {
    fetch('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setSchoolInfo(d.data) })
      .catch(() => {})
  }, [])

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
      <TeacherSidebar current={section} onChange={setSection} schoolName={schoolInfo?.name} logoUrl={schoolInfo?.logoUrl} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{ height: 68, background: 'white', borderBottom: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>
            {TITLES[section]}
          </div>
          <span style={{ background: '#f0ebe3', border: '1px solid #e8e0d4', borderRadius: 20, padding: '4px 14px', fontSize: 15, fontWeight: 700, color: '#a89478' }}>
            Trimestre 2 · Séquence 3
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#a89478' }} />
              <input placeholder="Rechercher..." style={{ background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px 8px 34px', fontSize: 15, fontWeight: 600, color: '#1a1209', outline: 'none', width: 260, fontFamily: 'inherit' }} />
            </div>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} color="#6b5c45" />
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#dc2626', borderRadius: '50%', border: '2px solid white' }} />
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main style={{ flex: 1, overflow: 'hidden', background: '#f7f3ee' }}>
          {section === 'dashboard'  && <SectionTeacherDashboard onNav={s => setSection(s as TeacherSection)} {...sProps} />}
          {section === 'classes'    && <SectionTeacherClasses onNav={s => setSection(s as TeacherSection)} {...sProps} />}
          {section === 'attendance' && <SectionTeacherAttendance {...sProps} />}
          {section === 'grades'     && <SectionTeacherGrades {...sProps} />}
          {section === 'exams'      && <SectionTeacherExams {...sProps} />}
          {section === 'timetable'  && <SectionTeacherTimetable {...sProps} />}
          {Object.entries(PLACEHOLDERS).map(([key, val]) =>
            section === key ? (
              <div key={key} style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: 48, textAlign: 'center', maxWidth: 400 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>{val.icon}</div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>
                    {TITLES[key as TeacherSection]}
                  </div>
                  <div style={{ fontSize: 14, color: '#a89478', fontWeight: 500 }}>
                    Section en cours de développement
                  </div>
                </div>
              </div>
            ) : null
          )}
        </main>
      </div>

      <TeacherToast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
