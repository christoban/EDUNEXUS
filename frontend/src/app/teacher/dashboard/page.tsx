'use client'

import { useState, useCallback, useEffect } from 'react'
import { Bell, Search } from 'lucide-react'
import { logoutUser } from '@/lib/userAuth'
import TeacherSidebar from './_components/TeacherSidebar'
import TeacherToast from './_components/TeacherToast'
import SectionTeacherDashboard from './_components/SectionTeacherDashboard'
import SectionTeacherClasses from './_components/SectionTeacherClasses'
import SectionTeacherAttendance from './_components/SectionTeacherAttendance'
import SectionTeacherGrades from './_components/SectionTeacherGrades'

import SectionTeacherTimetable from './_components/SectionTeacherTimetable'
import SectionOfflineStatus from './_components/SectionOfflineStatus'
import SectionProfesseurPrincipal from './_components/SectionProfesseurPrincipal'
import SectionAppreciationsPP from './_components/SectionAppreciationsPP'
import SectionDepartementAP from './_components/SectionDepartementAP'
import SectionCahierDeTexte from './_components/SectionCahierDeTexte'
import type { TeacherSection, Toast, UserInfo } from './_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import SectionMonProfilRH from '@/components/SectionMonProfilRH'
import { useT } from '@/lib/i18n'

let toastId = 0

const PLACEHOLDERS: Partial<Record<TeacherSection, { icon: string }>> = {
  bulletins: { icon: '📄' },
  resources: { icon: '📦' },
}

export default function TeacherDashboard() {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const TITLES: Record<TeacherSection, string> = {
    dashboard:           tnav('pageTitle.teacher_dashboard'),
    classes:             tnav('pageTitle.teacher_classes'),
    attendance:          tnav('pageTitle.teacher_attendance'),
    grades:              tnav('pageTitle.teacher_grades'),
    bulletins:           tnav('pageTitle.teacher_bulletins'),
    timetable:           tnav('pageTitle.teacher_timetable'),
    resources:           tnav('pageTitle.teacher_resources'),
    sync:                tnav('pageTitle.teacher_sync'),
    'pp-classe':         tnav('pageTitle.teacher_ppClasse'),
    'pp-appreciations':  tnav('pageTitle.teacher_ppAppreciations'),
    'ap-departement':    tnav('pageTitle.teacher_apDepartement'),
    'cahier-de-texte':   tnav('pageTitle.teacher_cahierDeTexte'),
    'mon-profil-rh':     tnav('sidebar.monProfilRH'),
  }
  const [section, setSection] = useState<TeacherSection>('dashboard')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [pendingGrades, setPendingGrades] = useState<number>(0)
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const { pendingCount } = useSyncQueue()

  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setSchoolInfo(d.data) }).catch(() => {})
    fetchApi('/api/v2/users/me', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setUser(d.data) }).catch(() => {})
    fetchApi('/api/v2/grades?validationStatus=SUBMITTED&limit=1', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.pagination) setPendingGrades(d.pagination.total ?? 0) }).catch(() => {})
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
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
      <TeacherSidebar current={section} onChange={setSection} schoolName={schoolInfo?.name} logoUrl={schoolInfo?.logoUrl} onLogout={logoutUser} user={user} pendingGrades={pendingGrades} pendingCount={pendingCount} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <header style={{ height: 68, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {TITLES[section]}
          </div>
          <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 14px', fontSize: 15, fontWeight: 700, color: 'var(--text3)' }}>
            Trimestre 2 · Séquence 3
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input placeholder={tcommon('actions.search') + '...'} style={{ background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px 8px 34px', fontSize: 15, fontWeight: 600, color: 'var(--text)', outline: 'none', width: 260, fontFamily: 'inherit' }} />
            </div>
            <button onClick={() => setChangePwdOpen(true)} title={tcommon('auth.changePassword')}
              style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}>
              🔐
            </button>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} color="var(--text2)" />
              <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: 'var(--red)', borderRadius: '50%', border: '2px solid white' }} />
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
          {section === 'dashboard'  && <SectionTeacherDashboard onNav={s => setSection(s as TeacherSection)} {...sProps} />}
          {section === 'classes'    && <SectionTeacherClasses onNav={s => setSection(s as TeacherSection)} {...sProps} />}
          {section === 'attendance' && <SectionTeacherAttendance {...sProps} />}
          {section === 'grades'     && <SectionTeacherGrades {...sProps} />}

          {section === 'timetable'  && <SectionTeacherTimetable {...sProps} />}
          {section === 'sync'       && <SectionOfflineStatus onToast={showToast} />}
          {section === 'pp-classe' && (() => {
            const cls = user?.classesProfessorPrincipal?.[0]
            return cls ? <SectionProfesseurPrincipal user={user!} classeId={cls.id} classeNom={cls.name} /> : null
          })()}
          {section === 'pp-appreciations' && (() => {
            const cls = user?.classesProfessorPrincipal?.[0]
            return cls ? <SectionAppreciationsPP user={user!} classeId={cls.id} /> : null
          })()}
          {section === 'ap-departement' && (() => {
            const dept = user?.headedDepartments?.[0]
            return dept ? <SectionDepartementAP user={user!} departementId={dept.id} departementNom={dept.name} /> : null
          })()}
          {section === 'cahier-de-texte' && <SectionCahierDeTexte user={user} onToast={showToast} />}
          {section === 'mon-profil-rh' && <SectionMonProfilRH onToast={showToast} />}
          {Object.entries(PLACEHOLDERS).map(([key, val]) =>
            section === key ? (
              <div key={key} style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center', maxWidth: 400 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>{val.icon}</div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                    {TITLES[key as TeacherSection]}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500 }}>
                    Section en cours de développement
                  </div>
                </div>
              </div>
            ) : null
          )}
        </main>
      </div>

      <TeacherToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
    </div>
  )
}
