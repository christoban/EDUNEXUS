'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logoutUser } from '@/lib/userAuth'
import AdminSidebar from './_components/AdminSidebar'
import AdminTopbar from './_components/AdminTopbar'
import SectionDashboard from './_components/SectionDashboard'
import SectionUsers from './_components/SectionUsers'
import SectionClasses from './_components/SectionClasses'
import SectionSubjects from './_components/SectionSubjects'
import SectionGrades from './_components/SectionGrades'
import SectionBulletins from './_components/SectionBulletins'
import SectionTimetable from './_components/SectionTimetable'
import SectionAcademicYear from './_components/SectionAcademicYear'
import SectionSettings from './_components/SectionSettings'
import SectionFinance from './_components/SectionFinance'
import SectionPlaceholder from './_components/SectionPlaceholder'
import SectionAdminAttendance from './_components/SectionAdminAttendance'
import SectionAdminCouncil from './_components/SectionAdminCouncil'
import SectionAdminAI from './_components/SectionAdminAI'
import AdminToast from './_components/AdminToast'
import type { AdminSection, Toast } from './_types'

let toastId = 0

const SECTION_TITLES: Record<AdminSection, string> = {
  dashboard:       'Tableau de bord',
  users:           'Utilisateurs',
  classes:         'Classes',
  subjects:        'Matières',
  attendance:      'Présences',
  grades:          'Notes',
  bulletins:       'Bulletins',
  timetable:       'Emploi du temps',
  council:         'Conseil de classe',
  'academic-year': 'Année scolaire',
  finance:         'Mobile Money',
  ai:              'IA Santé scolaire',
  settings:        'Paramètres',
}

const PLACEHOLDERS: Partial<Record<AdminSection, { icon: string; desc: string }>> = {
}

interface SchoolInfo { name: string; logoUrl: string | null; subdomain?: string; city?: string; phone?: string; email?: string }

export default function AdminDashboard() {
  const router = useRouter()
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    fetch('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.replace('/login'); return }
        const { status } = d.data as { status: string }
        if (status === 'APPROVED') { router.replace('/admin/configuration'); return }
        if (status !== 'ACTIVE') { router.replace('/login'); return }
        setSchoolInfo(d.data)

        // Toast de bienvenue après activation
        const params = new URLSearchParams(window.location.search)
        if (params.get('activated') === '1') {
          showToast('Votre espace est maintenant actif ! Bienvenue sur EduNexus 🎉', 'success')
          window.history.replaceState(null, '', '/admin/dashboard')
        }
      })
      .catch(() => router.replace('/login'))
  }, [router, showToast])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push('/login')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-nunito),Nunito,sans-serif', background: '#f7f3ee' }}>
      <AdminSidebar current={section} onChange={setSection} schoolName={schoolInfo?.name} logoUrl={schoolInfo?.logoUrl} onLogout={logoutUser} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminTopbar title={SECTION_TITLES[section]} onInvite={() => { setSection('users'); setInviteOpen(true) }} onNavigate={s => setSection(s as AdminSection)} />

        <main style={{ flex: 1, overflow: 'hidden' }}>
          {section === 'dashboard' && (
            <SectionDashboard
              onNav={s => setSection(s as AdminSection)}
              onInvite={() => showToast('Fonctionnalité à venir', 'info')}
              onToast={showToast}
            />
          )}
          {section === 'users'     && <SectionUsers     onToast={showToast} openInviteOnMount={inviteOpen} onInviteMounted={() => setInviteOpen(false)} />}
          {section === 'classes'   && <SectionClasses   onToast={showToast} />}
          {section === 'subjects'  && <SectionSubjects  onToast={showToast} />}
          {section === 'grades'    && <SectionGrades    onToast={showToast} />}
          {section === 'bulletins' && <SectionBulletins onToast={showToast} />}
          {section === 'timetable'      && <SectionTimetable     onToast={showToast} />}
          {section === 'academic-year' && <SectionAcademicYear  onToast={showToast} />}
          {section === 'finance'       && <SectionFinance       onToast={showToast} />}
          {section === 'attendance'    && <SectionAdminAttendance onToast={showToast} />}
          {section === 'council'       && <SectionAdminCouncil  onToast={showToast} />}
          {section === 'ai'            && <SectionAdminAI       onToast={showToast} />}
          {section === 'settings'      && <SectionSettings      onToast={showToast} schoolInfo={schoolInfo} onLogoUpdate={url => setSchoolInfo(s => s ? { ...s, logoUrl: url } : null)} />}
          {Object.entries(PLACEHOLDERS).map(([key, val]) =>
            section === key ? (
              <SectionPlaceholder
                key={key}
                title={SECTION_TITLES[key as AdminSection]}
                icon={val.icon}
                description={val.desc}
                onToast={showToast}
              />
            ) : null
          )}
        </main>
      </div>

      <AdminToast toasts={toasts} onRemove={removeToast} />
    </div>
  )
}
