'use client'
import { useState, useEffect, useCallback } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const MENTION_LEVELS = [
  { min: 16, label: 'TB' },
  { min: 14, label: 'B' },
  { min: 12, label: 'AB' },
  { min: 10, label: 'P' },
  { min: 0, label: 'I' },
]

const MENTION_COLOR = (m: string): [string, string] => ({
  TB: ['var(--green-light)', 'var(--green)'], B: ['var(--blue-light)', 'var(--blue)'],
  AB: ['var(--amber-light)', 'var(--amber)'], P: ['var(--orange-light)', 'var(--orange)'], I: ['var(--red-light)', 'var(--red)'],
} as Record<string, [string, string]>)[m] ?? ['var(--bg2)', 'var(--text2)']

const NOTE_COLOR = (n: number) => n >= 14 ? 'var(--green)' : n >= 10 ? 'var(--blue)' : 'var(--red)'

function getMention(avg: number): string {
  for (const level of MENTION_LEVELS) {
    if (avg >= level.min) return level.label
  }
  return 'I'
}

const HEALTH_LABEL = (s: number): [string, string, string] =>
  s >= 86 ? ['var(--green-light)', 'var(--green)', 'dashboard.health_high']
  : s >= 71 ? ['var(--blue-light)', 'var(--blue)', 'dashboard.health_medium_high']
  : s >= 51 ? ['var(--amber-light)', 'var(--amber)', 'dashboard.health_medium']
  : ['var(--red-light)', 'var(--red)', 'dashboard.health_low']

export default function SectionStudentDashboard({ onNav, onToast, user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
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
          const dayNames = [tcommon('status.all'), t('timetable.day_monday'), t('timetable.day_tuesday'), t('timetable.day_wednesday'), t('timetable.day_thursday'), t('timetable.day_friday'), tcommon('status.all')]
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
                color: 'var(--green)',
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
      setError(err.message || tcommon('status.error'))
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
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={fetchData}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--sidebar),var(--sidebar2))', borderRadius: 20, padding: '32px 36px', marginBottom: 26, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -50, top: -50, width: 240, height: 240, borderRadius: '50%', background: 'rgba(74,222,128,0.05)', pointerEvents: 'none' }} />
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 30, fontWeight: 700, color: 'white', marginBottom: 8 }}>
            {t('dashboard.greeting').replace('{name}', user?.firstName || tcommon('user.studentFallback'))}
          </div>
          <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
            {className} · {t('dashboard.matricule_label')} {matricule}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ background: mBg, color: mC, padding: '5px 14px', borderRadius: 22, fontSize: 15, fontWeight: 800 }}>
              🏆 {rankDisplay}
            </span>
            <span style={{ background: hBg, color: hC, padding: '5px 14px', borderRadius: 22, fontSize: 15, fontWeight: 800 }}>
              ❤️ {t(hLabel)}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 56, fontWeight: 900, color: 'white', lineHeight: 1 }}>{displayAvg.toFixed(1)}</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{t('dashboard.average_label')}</div>
          <div style={{ marginTop: 10, background: mBg, color: mC, padding: '5px 16px', borderRadius: 22, fontSize: 14, fontWeight: 800, display: 'inline-block' }}>
            {({ TB: t('grades.mention_tb'), B: t('grades.mention_b'), AB: t('grades.mention_ab'), P: t('grades.mention_p'), I: t('grades.mention_i') } as Record<string, string>)[mention] ?? t('grades.mention_i')}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
        {[
          { icon: '📝', bg: 'var(--green-light)', val: `${displayAvg.toFixed(1)}/20`, label: t('dashboard.general_avg_label'),  trend: mention,    tBg: mBg, tC: mC },
          { icon: '🏆', bg: 'var(--blue-light)', val: rank ? `${rank.pos}e` : '—', label: rank ? t('dashboard.rank_label').replace('{total}', String(rank.total)) : t('dashboard.rank_short'), trend: t('dashboard.trend_this_term'), tBg: 'var(--blue-light)', tC: 'var(--blue)' },
          { icon: '✅', bg: 'var(--amber-light)', val: `${attendanceRate}%`, label: t('dashboard.rate_label'), trend: t('dashboard.trend_term'),  tBg: 'var(--green-light)', tC: 'var(--green)' },
          { icon: '📚', bg: 'var(--purple-light)', val: String(subjectCount || '...'),  label: t('dashboard.subjects_label'), trend: t('dashboard.trend_year'), tBg: 'var(--purple-light)', tC: 'var(--purple)' },
        ].map((k, i) => (
          <div key={i}
            style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '22px 26px', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
              <span style={{ fontSize: 14, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: k.tBg, color: k.tC, whiteSpace: 'nowrap' }}>{k.trend}</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 16, color: 'var(--text3)', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{t('dashboard.today_title')}</span>
        </div>
        <div style={{ padding: '16px 22px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {todaySlots.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 15, fontWeight: 600, width: '100%' }}>{t('dashboard.today_empty')}</div>
          ) : todaySlots.map((c, i) => (
            <div key={i} style={{ flex: 1, minWidth: 180, background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${c.color || 'var(--green)'}` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text3)', marginBottom: 5 }}>{c.time}</div>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{c.subject}</div>
              <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }}>{c.teacher}{c.salle ? ` · ${c.salle}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
