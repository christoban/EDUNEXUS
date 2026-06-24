'use client'
import { useState, useEffect } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

export default function SectionTeacherDashboard({ onNav, onToast, user }: Props) {
  const [classCount, setClassCount] = useState<number | null>(null)
  const [studentCount, setStudentCount] = useState<number | null>(null)
  const [pendingGrades, setPendingGrades] = useState<number | null>(null)
  const [attendanceRate, setAttendanceRate] = useState<string | null>(null)
  const [todaySlots, setTodaySlots] = useState<any[]>([])
  const [rejectedGrades, setRejectedGrades] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [classesRes, gradesPendingRes, statsRes, timetableRes, gradesRejectedRes] = await Promise.all([
        fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
        fetchApi(`/api/v2/grades?validationStatus=SUBMITTED`, { credentials: 'include' }).then(r => r.json()),
        fetchApi(`/api/v2/attendance/stats`, { credentials: 'include' }).then(r => r.json()),
        fetchApi(`/api/v2/timetables`, { credentials: 'include' }).then(r => r.json()),
        fetchApi(`/api/v2/grades?validationStatus=REJECTED`, { credentials: 'include' }).then(r => r.json()),
      ])

      if (classesRes.success) {
        setClassCount(classesRes.data.length)
        const total = classesRes.data.reduce((sum: number, c: any) => sum + (c._count?.students || 0), 0)
        setStudentCount(total)
      }
      if (gradesPendingRes.grades) {
        setPendingGrades(gradesPendingRes.pagination?.total || gradesPendingRes.grades.length)
      }
      if (statsRes.stats) {
        setAttendanceRate(statsRes.stats.attendanceRate)
      }
      if (timetableRes.success) {
        const todayIdx = new Date().getDay() - 1 // 0=Lundi, -1=Dimanche (ignoré)
        const teacherProfileId = user?.teacherProfile?.id
        const slots = timetableRes.data.flatMap((t: any) =>
          (t.slots || [])
            .filter((s: any) =>
              s.dayOfWeek === todayIdx && teacherProfileId && s.teacher?.id === teacherProfileId
            )
            .map((s: any) => ({
              time: `${s.startTime}–${s.endTime}`,
              classe: t.class?.name || '',
              subject: s.subject?.name || '',
              salle: s.room || '',
              eleves: 0,
            }))
        )
        setTodaySlots(slots)
      }
      if (gradesRejectedRes.grades) {
        setRejectedGrades(gradesRejectedRes.grades.length)
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [user])

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const KPI_ITEMS = [
    { icon: '🏫', bg: '#d1fae5', val: classCount !== null ? String(classCount) : '...', label: 'Classes assignées', trend: '2025–2026', tBg: '#d1fae5', tC: '#065f46' },
    { icon: '👨‍🎓', bg: '#dbeafe', val: studentCount !== null ? String(studentCount) : '...', label: 'Élèves au total', trend: 'Année en cours', tBg: '#d1fae5', tC: '#065f46' },
    { icon: '📝', bg: '#fef3c7', val: pendingGrades !== null ? String(pendingGrades) : '...', label: 'Notes en attente', trend: '⚠️ Urgent', tBg: '#fef3c7', tC: '#92400e', nav: 'grades' },
    { icon: '✅', bg: '#d1fae5', val: attendanceRate || '...', label: 'Taux de présence', trend: 'Global', tBg: '#d1fae5', tC: '#065f46', nav: 'attendance' },
  ]

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600 }}>Chargement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={fetchData}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
            🔄 Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Bonjour, {user?.firstName || 'Enseignant'} 👋</div>
          <div style={sSub}>{dateStr}</div>
        </div>
        <button style={btnSec} onClick={() => { onToast('Actualisation...', 'info'); fetchData() }}>🔄 Actualiser</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
        {KPI_ITEMS.map((k, i) => (
          <div key={i}
            onClick={() => k.nav && onNav(k.nav)}
            style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px', cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
            onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
              <span style={{ fontSize: 14, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: k.tBg, color: k.tC }}>{k.trend}</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 16, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Rôles spéciaux : Professeur Principal + Animateur Pédagogique ── */}
      {((user?.classesProfessorPrincipal?.length ?? 0) > 0 || (user?.headedDepartments?.length ?? 0) > 0) && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>

          {user?.classesProfessorPrincipal?.map(cls => (
            <div key={cls.id} style={{ flex: '1 1 300px', background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', borderRadius: 16, border: '1.5px solid rgba(5,150,105,0.35)', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(5,150,105,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🏅</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>Professeur Principal</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#064e3b', lineHeight: 1.1 }}>{cls.name}</div>
                {cls._count && (
                  <div style={{ fontSize: 13, color: '#047857', fontWeight: 700, marginTop: 3 }}>{cls._count.students} élève{cls._count.students > 1 ? 's' : ''}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <button onClick={() => onNav('bulletins')}
                  style={{ padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: 'rgba(5,150,105,0.15)', color: '#065f46', border: '1.5px solid rgba(5,150,105,0.3)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  📄 Bulletins
                </button>
                <button onClick={() => onNav('grades')}
                  style={{ padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: 'white', color: '#065f46', border: '1.5px solid rgba(5,150,105,0.3)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  📝 Notes classe
                </button>
              </div>
            </div>
          ))}

          {user?.headedDepartments?.map(dept => (
            <div key={dept.id} style={{ flex: '1 1 300px', background: `linear-gradient(135deg,${dept.color}20,${dept.color}08)`, borderRadius: 16, border: `1.5px solid ${dept.color}55`, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `${dept.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>🎯</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: dept.color, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>Animateur Pédagogique</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1209', lineHeight: 1.1 }}>Dép. {dept.name}</div>
                {dept.subjects && dept.subjects.length > 0 && (
                  <div style={{ fontSize: 12, color: '#6b5c45', fontWeight: 600, marginTop: 3 }}>
                    {dept.subjects.slice(0, 3).map(s => s.name).join(' · ')}{dept.subjects.length > 3 ? ` +${dept.subjects.length - 3}` : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <button onClick={() => onNav('classes')}
                  style={{ padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: `${dept.color}18`, color: dept.color, border: `1.5px solid ${dept.color}40`, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  👥 Mes classes
                </button>
              </div>
            </div>
          ))}

        </div>
      )}

      {/* 2 colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Cours aujourd'hui */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>📅 Mes cours aujourd&apos;hui</span>
            <button style={btnSecSm} onClick={() => onNav('timetable')}>Voir EDT complet</button>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {todaySlots.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#a89478', fontSize: 15, fontWeight: 600 }}>Aucun cours aujourd&apos;hui</div>
            ) : todaySlots.map((c, i) => (
              <div key={i}
                style={{ background: '#f7f3ee', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '16px 18px', cursor: 'pointer', transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', boxShadow: '0 3px 10px rgba(0,0,0,0.06)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#e8e0d4', boxShadow: 'none' })}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#a89478' }}>{c.time}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: '#dbeafe', color: '#1e40af' }}>{c.classe}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1209', marginBottom: 8 }}>{c.subject}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 15, color: '#a89478', fontWeight: 600 }}>
                  <span>📍 {c.salle || 'Salle non définie'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertes */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>🔔 Alertes &amp; actions</span>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rejectedGrades > 0 && (
              <div
                onClick={() => onNav('grades')}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 12, border: '1.5px solid', cursor: 'pointer', background: '#fef2f2', borderColor: 'rgba(220,38,38,0.2)' }}>
                <span style={{ fontSize: 20 }}>🚨</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#991b1b' }}>{rejectedGrades} note{rejectedGrades > 1 ? 's' : ''} rejetée{rejectedGrades > 1 ? 's' : ''}</div>
                  <div style={{ fontSize: 15, color: '#dc2626', fontWeight: 500, marginTop: 3 }}>Corriger et resoumettre</div>
                </div>
              </div>
            )}

            {/* Actions rapides */}
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' })}
                onClick={() => onNav('attendance')}>
                ✅ Saisir les présences du jour
              </button>
              <button style={{ width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' })}
                onClick={() => onNav('grades')}>
                📝 Saisir les notes en attente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '6px 12px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
