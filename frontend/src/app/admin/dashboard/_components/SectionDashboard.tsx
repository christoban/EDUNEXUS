'use client'
import { useState, useEffect, useCallback } from 'react'

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
  const [stats, setStats] = useState<DashStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/v2/dashboard/stats', { credentials: 'include' })
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
    { icon: '👨‍🎓', bg: '#dbeafe', val: String(stats.totalStudents), label: 'Élèves inscrits',  trendBg: '#d1fae5', trendColor: '#065f46', nav: 'users' },
    { icon: '👨‍🏫', bg: '#fef3c7', val: String(stats.totalTeachers), label: 'Enseignants',       trendBg: '#fef3c7', trendColor: '#92400e', nav: 'users' },
    { icon: '✅',   bg: '#d1fae5', val: stats.avgAttendance,          label: 'Taux de présence', trendBg: '#d1fae5', trendColor: '#065f46' },
    { icon: '📝',   bg: '#ffedd5', val: String(stats.activeExams),    label: 'Examens actifs',   trendBg: '#ffedd5', trendColor: '#9a3412' },
  ] : []

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }}>
            Vue d&apos;ensemble
          </div>
          <div style={{ fontSize: 17, color: '#a89478', marginTop: 3 }}>Tableau de bord administrateur</div>
        </div>
        <button
          onClick={() => { fetchStats(); onToast('Actualisation en cours…', 'info') }}
          style={btnSecSm}
        >🔄 Actualiser</button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ background: '#fee2e2', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: 16 }}>{error}</div>
          </div>
          <button onClick={fetchStats}
            style={{ padding: '7px 16px', borderRadius: 9, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14 }}>
            Réessayer
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
                style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px', cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
                onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
                </div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{k.val}</div>
                <div style={{ fontSize: 16, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* 2 colonnes */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>

            {/* Activité récente */}
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>📋 Activité récente</span>
              </div>
              <div style={{ padding: '18px 22px' }}>
                {stats.recentActivity.length === 0 ? (
                  <div style={{ fontSize: 16, color: '#a89478', textAlign: 'center', padding: '20px 0' }}>
                    Aucune activité récente
                  </div>
                ) : (
                  stats.recentActivity.map((act, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < stats.recentActivity.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                      <span style={{ fontSize: 15, color: '#6b5c45', fontWeight: 600 }}>{act}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions rapides */}
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
              <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>⚡ Actions rapides</span>
              </div>
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { icon: '📝', label: 'Notes en attente',    nav: 'grades'    },
                  { icon: '📄', label: 'Générer bulletins',   nav: 'bulletins' },
                  { icon: '👥', label: 'Gérer les classes',   nav: 'classes'   },
                  { icon: '👤', label: 'Inviter utilisateur', action: onInvite },
                ].map((btn, i) => (
                  <button key={i}
                    onClick={() => btn.action ? btn.action() : onNav(btn.nav!)}
                    style={{ width: '100%', padding: '10px 20px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}
                    onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' })}
                    onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' })}
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
  background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8',
  cursor: 'pointer', fontFamily: 'inherit',
}
