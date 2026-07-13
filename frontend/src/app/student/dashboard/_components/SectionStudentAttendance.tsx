'use client'
import { useCallback } from 'react'
import { CheckCircle2, X, ClipboardList, BarChart3 } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

interface WeeklyStat { week: string; present: number; absent: number; late: number; excused: number }

interface AttendanceData {
  stats: { total: number; present: number; absent: number; late: number; excused: number; attendanceRate: string } | null
  weekly: WeeklyStat[]
}

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  const t = useT('student')
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      {t('common.offline_badge').replace('{date}', date)}
    </div>
  )
}

export default function SectionStudentAttendance({ onToast, user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const cacheKey = user ? `student:attendance:${user.id}` : ''

  const fetchFn = useCallback(async (): Promise<AttendanceData> => {
    const [statsRes, recordsRes] = await Promise.all([
      fetchApi('/api/v2/attendance/stats', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/attendance?limit=100', { credentials: 'include' }).then(r => r.json()),
    ])

    const stats = statsRes.stats ? {
      total: statsRes.stats.total || 0,
      present: statsRes.stats.present || 0,
      absent: statsRes.stats.absent || 0,
      late: statsRes.stats.late || 0,
      excused: statsRes.stats.excused || 0,
      attendanceRate: statsRes.stats.attendanceRate || '0%',
    } : null

    let weekly: WeeklyStat[] = []
    if (recordsRes.records?.length) {
      const weeks: Record<string, WeeklyStat> = {}
      recordsRes.records.forEach((r: any) => {
        const d = new Date(r.date)
        const startOfWeek = new Date(d)
        startOfWeek.setDate(d.getDate() - d.getDay() + 1)
        const weekKey = startOfWeek.toISOString().slice(0, 10)
        if (!weeks[weekKey]) weeks[weekKey] = { week: weekKey, present: 0, absent: 0, late: 0, excused: 0 }
        if (r.status === 'PRESENT') weeks[weekKey].present++
        else if (r.status === 'ABSENT') weeks[weekKey].absent++
        else if (r.status === 'LATE') weeks[weekKey].late++
        else if (r.status === 'EXCUSED') weeks[weekKey].excused++
      })
      const fmt = (d: string) => {
        const date = new Date(d + 'T00:00:00')
        const end = new Date(date)
        end.setDate(date.getDate() + 4)
        return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
      }
      weekly = Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week)).map(w => ({ ...w, week: fmt(w.week) }))
    }

    return { stats, weekly }
  }, [user])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<AttendanceData>(cacheKey, fetchFn)

  if (!user || loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={refetch}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const stats = data?.stats ?? null
  const weekly = data?.weekly ?? []
  const rateNum = stats ? Number(stats.attendanceRate.replace('%', '')) : 0

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 8 : 26 }}>
        <div style={sTitle}>{t('attendance.title')}</div>
        <div style={sSub}>{t('attendance.subtitle')}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
        {[
          { icon: CheckCircle2, bg: 'var(--green-light)', val: `${rateNum}%`, label: t('attendance.rate_label'), color: 'var(--green)' },
          { icon: X,  bg: 'var(--red-light)', val: String(stats?.absent || 0), label: t('attendance.absences_label'), color: 'var(--red)' },
          { icon: '~',  bg: 'var(--amber-light)', val: String(stats?.late || 0), label: t('attendance.late_label'), color: 'var(--amber)' },
          { icon: 'E',  bg: 'var(--blue-light)', val: String(stats?.excused || 0), label: t('attendance.excused_label'), color: 'var(--blue)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '22px 26px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: s.color, marginBottom: 12 }}>
              {typeof s.icon === 'string' ? s.icon : <s.icon size={20} strokeWidth={2.5} />}
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 16, color: 'var(--text3)', marginTop: 5, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {weekly.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '18px 22px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={17} strokeWidth={2} /> {t('attendance.weekly_evolution')}</div>
          {weekly.map((w, i) => {
            const total = w.present + w.absent + w.late + w.excused
            const pct = total > 0 ? Math.round((w.present + w.late) / total * 100) : 100
            return (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                  <span>{w.week}</span>
                  <span style={{ color: pct >= 100 ? 'var(--green)' : 'var(--red)', fontWeight: 900 }}>
                    {pct >= 100 ? t('attendance.week_present') : t('attendance.week_absent').replace('{pct}', String(100 - pct))}
                  </span>
                </div>
                <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ flex: w.present + w.late, background: 'var(--green)', borderRadius: pct < 100 ? '8px 0 0 8px' : 8 }} />
                  {(w.absent + w.excused) > 0 && <div style={{ flex: w.absent + w.excused, background: 'var(--red)', borderRadius: '0 8px 8px 0' }} />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!stats && weekly.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><ClipboardList size={48} strokeWidth={2} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('attendance.empty_title')}</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>{t('attendance.empty_subtitle')}</div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
