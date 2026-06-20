'use client'
import { useState, useEffect, useCallback } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const MENTION_LEVELS = [
  { min: 16, label: 'TB', name: 'Très Bien' },
  { min: 14, label: 'B', name: 'Bien' },
  { min: 12, label: 'AB', name: 'Assez Bien' },
  { min: 10, label: 'P', name: 'Passable' },
  { min: 0, label: 'I', name: 'Insuffisant' },
]

const MENTION_COLOR = (m: string): [string, string] => ({
  TB: ['#d1fae5', '#065f46'], B: ['#dbeafe', '#1e40af'],
  AB: ['#fef3c7', '#92400e'], P: ['#ffedd5', '#9a3412'], I: ['#fee2e2', '#991b1b'],
} as Record<string, [string, string]>)[m] ?? ['#f1f5f9', '#475569']

const NOTE_COLOR = (n: number) => n >= 14 ? '#059669' : n >= 10 ? '#1d4ed8' : '#dc2626'

function getMention(avg: number): string {
  for (const level of MENTION_LEVELS) {
    if (avg >= level.min) return level.label
  }
  return 'I'
}

const HEALTH_LABEL = (s: number): [string, string, string] =>
  s >= 86 ? ['#d1fae5', '#065f46', 'PROGRESSION 📈']
  : s >= 71 ? ['#dbeafe', '#1e40af', 'STABLE ✅']
  : s >= 51 ? ['#fef3c7', '#92400e', 'MOYEN ⚠️']
  : ['#fee2e2', '#991b1b', 'À SURVEILLER 🚨']

export default function SectionStudentDashboard({ onNav, onToast, user }: Props) {
  const [avgGrade, setAvgGrade] = useState<number | null>(null)
  const [rank, setRank] = useState<{ pos: number; total: number } | null>(null)
  const [attendanceRate, setAttendanceRate] = useState<number>(0)
  const [subjectCount, setSubjectCount] = useState<number>(0)
  const [todaySlots, setTodaySlots] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    const classId = user.studentProfile?.class?.id
    const userId = user.id

    try {
      const [statsRes, ayRes, attRes] = await Promise.all([
        fetchApi('/api/v2/dashboard/stats', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/attendance/stats', { credentials: 'include' }).then(r => r.json()),
      ])

      if (statsRes.stats?.avgGrade && statsRes.stats.avgGrade !== 'N/A') {
        setAvgGrade(Number(statsRes.stats.avgGrade))
      }
      if (attRes.stats?.attendanceRate) {
        setAttendanceRate(Number(attRes.stats.attendanceRate.replace('%', '')))
      }

      let sequenceId = ''
      let currentPeriodName = ''
      if (ayRes.success) {
        const curYear = ayRes.data.find((y: any) => y.isCurrent)
        if (curYear) {
          const curPeriod = curYear.periods?.find((p: any) => p.isCurrent)
          if (curPeriod) {
            currentPeriodName = curPeriod.name
            const curSeq = curPeriod.sequences?.find((s: any) => s.isCurrent)
            if (curSeq) sequenceId = curSeq.id
          }
        }
      }

      if (classId && userId && sequenceId) {
        const [avgRes, ttRes, gradesRes] = await Promise.all([
          fetchApi(`/api/v2/grades/average/${userId}?classId=${classId}&sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json()),
          fetchApi(`/api/v2/timetables?classId=${classId}`, { credentials: 'include' }).then(r => r.json()),
          fetchApi(`/api/v2/grades?sequenceId=${sequenceId}`, { credentials: 'include' }).then(r => r.json()),
        ])

        if (avgRes.average !== undefined) setAvgGrade(avgRes.average)
        if (avgRes.rank !== undefined) setRank({ pos: avgRes.rank, total: avgRes.totalStudents || 0 })

        if (ttRes.success) {
          const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
          const todayIdx = new Date().getDay()
          const slots = ttRes.data.flatMap((t: any) =>
            (t.slots || []).filter((s: any) => s.dayOfWeek === todayIdx)
              .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))
              .slice(0, 3)
              .map((s: any) => ({
                time: s.startTime || '',
                subject: s.subject?.name || '',
                teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : '',
                salle: s.room || '',
                color: '#059669',
              }))
          )
          setTodaySlots(slots)
        }

        if (gradesRes.grades) {
          const uniqueSubjects = new Set(gradesRes.grades.map((g: any) => g.subjectId))
          setSubjectCount(uniqueSubjects.size)
        }
      } else if (statsRes.stats?.avgGrade && statsRes.stats.avgGrade !== 'N/A') {
        const gradeFromStats = Number(statsRes.stats.avgGrade)
        if (!isNaN(gradeFromStats)) setAvgGrade(gradeFromStats)
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  const displayAvg = avgGrade ?? 0
  const mention = getMention(displayAvg)
  const [mBg, mC] = MENTION_COLOR(mention)
  const matricule = user ? `MAT-${user.id.substring(0, 6).toUpperCase()}` : ''
  const indiceSante = Math.round(displayAvg * 3 + attendanceRate * 0.5)
  const [hBg, hC, hLabel] = HEALTH_LABEL(indiceSante)
  const rankDisplay = rank ? `${rank.pos}e / ${rank.total}` : '—'
  const className = user?.studentProfile?.class?.name || ''

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
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ background: 'linear-gradient(135deg,#1a2e1e,#243b29)', borderRadius: 20, padding: '32px 36px', marginBottom: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -50, top: -50, width: 240, height: 240, borderRadius: '50%', background: 'rgba(74,222,128,0.05)', pointerEvents: 'none' }} />
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>
            Bonjour, {user?.firstName || 'Élève'} 👋
          </div>
          <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
            {className} · Matricule : {matricule}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ background: mBg, color: mC, padding: '5px 14px', borderRadius: 22, fontSize: 15, fontWeight: 800 }}>
              🏆 {rankDisplay}
            </span>
            <span style={{ background: hBg, color: hC, padding: '5px 14px', borderRadius: 22, fontSize: 15, fontWeight: 800 }}>
              ❤️ {hLabel}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: 'white', lineHeight: 1 }}>{displayAvg.toFixed(1)}</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>Moyenne générale /20</div>
          <div style={{ marginTop: 10, background: mBg, color: mC, padding: '5px 16px', borderRadius: 22, fontSize: 14, fontWeight: 800, display: 'inline-block' }}>
            {mention === 'TB' ? 'Très Bien' : mention === 'B' ? 'Bien' : mention === 'AB' ? 'Assez Bien' : mention === 'P' ? 'Passable' : 'Insuffisant'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
        {[
          { icon: '📝', bg: '#d1fae5', val: `${displayAvg.toFixed(1)}/20`, label: 'Moyenne générale',  trend: mention,    tBg: mBg, tC: mC },
          { icon: '🏆', bg: '#dbeafe', val: rank ? `${rank.pos}e` : '—', label: rank ? `Rang sur ${rank.total} élèves` : 'Rang', trend: 'Ce trimestre', tBg: '#dbeafe', tC: '#1e40af' },
          { icon: '✅', bg: '#fef3c7', val: `${attendanceRate}%`, label: 'Taux de présence', trend: 'Trimestre',  tBg: '#d1fae5', tC: '#065f46' },
          { icon: '📚', bg: '#ede9fe', val: String(subjectCount || '...'),  label: 'Matières suivies', trend: `Année`, tBg: '#ede9fe', tC: '#5b21b6' },
        ].map((k, i) => (
          <div key={i}
            style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
              <span style={{ fontSize: 14, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: k.tBg, color: k.tC, whiteSpace: 'nowrap' }}>{k.trend}</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 16, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>📅 Prochains cours aujourd&apos;hui</span>
        </div>
        <div style={{ padding: '16px 22px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {todaySlots.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#a89478', fontSize: 15, fontWeight: 600, width: '100%' }}>Aucun cours aujourd&apos;hui</div>
          ) : todaySlots.map((c, i) => (
            <div key={i} style={{ flex: 1, minWidth: 180, background: '#f7f3ee', borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${c.color || '#059669'}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#a89478', marginBottom: 5 }}>{c.time}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>{c.subject}</div>
              <div style={{ fontSize: 14, color: '#a89478', marginTop: 4 }}>{c.teacher}{c.salle ? ` · ${c.salle}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
