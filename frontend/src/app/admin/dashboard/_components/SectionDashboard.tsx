'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { GraduationCap, Presentation, CheckCircle2, FileText, RefreshCw, AlertTriangle, Users, User, ScrollText } from 'lucide-react'

interface Props {
  onNav: (s: string) => void
  onInvite: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface DashStats {
  totalStudents: number
  totalTeachers: number
  activeExams: number
  avgAttendance: string
  recentActivity: string[]
}

export default function SectionDashboard({ onNav, onInvite, onToast }: Props) {
  const t = useT('admin')
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/dashboard/stats', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setStats(data.stats)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const kpi = stats ? [
    { icon: <GraduationCap size={22} strokeWidth={2} />, bg: 'var(--blue-light)', val: String(stats.totalStudents), label: t('dashboard.kpi.students'),  trendBg: 'var(--green-light)', trendColor: 'var(--green)', nav: 'users' },
    { icon: <Presentation size={22} strokeWidth={2} />, bg: 'var(--amber-light)', val: String(stats.totalTeachers), label: t('dashboard.kpi.teachers'),       trendBg: 'var(--amber-light)', trendColor: 'var(--amber)', nav: 'users' },
    { icon: <CheckCircle2 size={22} strokeWidth={2} />,   bg: 'var(--green-light)', val: stats.avgAttendance,          label: t('dashboard.kpi.attendance_rate'), trendBg: 'var(--green-light)', trendColor: 'var(--green)' },
    { icon: <FileText size={22} strokeWidth={2} />,   bg: 'var(--orange-light)', val: String(stats.activeExams),    label: t('dashboard.kpi.active_exams'),   trendBg: 'var(--orange-light)', trendColor: 'var(--orange)' },
  ] : []

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>
            {t('dashboard.overview_title')}
          </div>
          <div style={{ fontSize: 17, color: 'var(--text3)', marginTop: 3 }}>{t('dashboard.overview_subtitle')}</div>
        </div>
        <button
          onClick={() => { fetchStats(); onToast(t('dashboard.refreshing'), 'info') }}
          style={btnSecSm}
        ><span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={15} strokeWidth={2} />{t('dashboard.refresh')}</span></button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ background: 'var(--red-light)', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <AlertTriangle size={22} strokeWidth={2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 16 }}>{error}</div>
          </div>
          <button onClick={fetchStats}
            style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14 }}>
            {t('dashboard.retry')}
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && stats && (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
            {kpi.map((k, i) => (
              <div key={i}
                onClick={() => k.nav && onNav(k.nav)}
                style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '22px 26px', cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
                onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{k.val}</div>
                <div style={{ fontSize: 16, color: 'var(--text3)', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* 2 colonnes */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>

            {/* Activité récente */}
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{t('dashboard.recent_activity_title')}</span>
              </div>
              <div style={{ padding: '18px 22px' }}>
                {stats.recentActivity.length === 0 ? (
                  <div style={{ fontSize: 16, color: 'var(--text3)', textAlign: 'center', padding: '20px 0' }}>
                    {t('dashboard.no_recent_activity')}
                  </div>
                ) : (
                  stats.recentActivity.map((act, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < stats.recentActivity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                      <span style={{ fontSize: 15, color: 'var(--text2)', fontWeight: 600 }}>{act}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions rapides */}
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{t('dashboard.quick_actions_title')}</span>
              </div>
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: <FileText size={16} strokeWidth={2} />, label: t('dashboard.quick_actions.pending_grades'),    nav: 'grades'    },
                  { icon: <ScrollText size={16} strokeWidth={2} />, label: t('dashboard.quick_actions.generate_reports'),   nav: 'bulletins' },
                  { icon: <Users size={16} strokeWidth={2} />, label: t('dashboard.quick_actions.manage_classes'),   nav: 'classes'   },
                  { icon: <User size={16} strokeWidth={2} />, label: t('dashboard.quick_actions.invite_user'), action: onInvite },
                ].map((btn, i) => (
                  <button key={i}
                    onClick={() => btn.action ? btn.action() : onNav(btn.nav!)}
                    style={{ width: '100%', padding: '10px 20px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}
                    onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)' })}
                    onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                  >
                    <span>{btn.icon}</span> {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const btnSecSm: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800,
  background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)',
  cursor: 'pointer', fontFamily: 'inherit',
}
