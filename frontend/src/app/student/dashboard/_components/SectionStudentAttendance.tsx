'use client'
import { useState, useEffect, useCallback } from 'react'
import type { UserInfo } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

interface WeeklyStat {
  week: string
  present: number
  absent: number
  late: number
  excused: number
}

export default function SectionStudentAttendance({ onToast, user }: Props) {
  const [stats, setStats] = useState<{ total: number; present: number; absent: number; late: number; excused: number; attendanceRate: string } | null>(null)
  const [weekly, setWeekly] = useState<WeeklyStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const [statsRes, recordsRes] = await Promise.all([
        fetch('/api/v2/attendance/stats', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/v2/attendance?limit=100', { credentials: 'include' }).then(r => r.json()),
      ])

      if (statsRes.stats) {
        setStats({
          total: statsRes.stats.total || 0,
          present: statsRes.stats.present || 0,
          absent: statsRes.stats.absent || 0,
          late: statsRes.stats.late || 0,
          excused: statsRes.stats.excused || 0,
          attendanceRate: statsRes.stats.attendanceRate || '0%',
        })
      }

      if (recordsRes.records?.length) {
        const weeks: Record<string, WeeklyStat> = {}
        recordsRes.records.forEach((r: any) => {
          const d = new Date(r.date)
          const startOfWeek = new Date(d)
          startOfWeek.setDate(d.getDate() - d.getDay() + 1)
          const weekKey = startOfWeek.toISOString().slice(0, 10)
          if (!weeks[weekKey]) {
            weeks[weekKey] = { week: weekKey, present: 0, absent: 0, late: 0, excused: 0 }
          }
          if (r.status === 'PRESENT') weeks[weekKey].present++
          else if (r.status === 'ABSENT') weeks[weekKey].absent++
          else if (r.status === 'LATE') weeks[weekKey].late++
          else if (r.status === 'EXCUSED') weeks[weekKey].excused++
        })

        const sorted = Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week))
        const fmt = (d: string) => {
          const date = new Date(d + 'T00:00:00')
          const end = new Date(date)
          end.setDate(date.getDate() + 4)
          return `${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
        }
        setWeekly(sorted.map(w => ({ ...w, week: fmt(w.week) })))
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

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

  const rateNum = stats ? Number(stats.attendanceRate.replace('%', '')) : 0

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Mes présences</div>
        <div style={sSub}>Suivi de votre assiduité</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
        {[
          { icon: '✅', bg: '#d1fae5', val: `${rateNum}%`, label: 'Taux de présence', color: '#065f46' },
          { icon: '✗',  bg: '#fee2e2', val: String(stats?.absent || 0), label: 'Absences',    color: '#991b1b' },
          { icon: '~',  bg: '#fef3c7', val: String(stats?.late || 0),   label: 'Retards',          color: '#92400e' },
          { icon: 'E',  bg: '#dbeafe', val: String(stats?.excused || 0),   label: 'Excusés',          color: '#1e40af' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: s.color, marginBottom: 12 }}>{s.icon}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: 16, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {weekly.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '18px 22px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#1a1209', marginBottom: 18 }}>📊 Évolution hebdomadaire</div>
          {weekly.map((w, i) => {
            const total = w.present + w.absent + w.late + w.excused
            const pct = total > 0 ? Math.round((w.present + w.late) / total * 100) : 100
            return (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#6b5c45', marginBottom: 6 }}>
                  <span>{w.week}</span>
                  <span style={{ color: pct >= 100 ? '#059669' : '#dc2626', fontWeight: 900 }}>
                    {pct >= 100 ? '100% présent' : `${100 - pct}% absent`}
                  </span>
                </div>
                <div style={{ display: 'flex', height: 8, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ flex: w.present + w.late, background: '#059669', borderRadius: pct < 100 ? '8px 0 0 8px' : 8 }} />
                  {(w.absent + w.excused) > 0 && <div style={{ flex: w.absent + w.excused, background: '#dc2626', borderRadius: '0 8px 8px 0' }} />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!stats && weekly.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucune donnée de présence</div>
          <div style={{ fontSize: 14, color: '#a89478' }}>Les données apparaîtront une fois saisies par vos enseignants</div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
