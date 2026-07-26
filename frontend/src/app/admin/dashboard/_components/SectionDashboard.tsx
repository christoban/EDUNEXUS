'use client'
import { useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { GraduationCap, Presentation, CheckCircle2, FileText, RefreshCw, AlertTriangle, Users, User, ScrollText, Package, Clock } from 'lucide-react'

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

  const fetchStatsFn = useCallback(async (): Promise<DashStats> => {
    const res = await fetchApi('/api/v2/dashboard/stats', { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.stats
  }, [])

  const { data: stats, loading, error, fromCache, cachedAt, refetch: fetchStats } = useCachedFetch<DashStats>('admin:dashboard-stats', fetchStatsFn)

  const kpi = stats ? [
    { icon: <GraduationCap size={22} strokeWidth={2} />, bg: 'var(--blue-light)', val: String(stats.totalStudents), label: t('dashboard.kpi.students'),  trendBg: 'var(--green-light)', trendColor: 'var(--green)', nav: 'users' },
    { icon: <Presentation size={22} strokeWidth={2} />, bg: 'var(--amber-light)', val: String(stats.totalTeachers), label: t('dashboard.kpi.teachers'),       trendBg: 'var(--amber-light)', trendColor: 'var(--amber)', nav: 'users' },
    { icon: <CheckCircle2 size={22} strokeWidth={2} />,   bg: 'var(--green-light)', val: stats.avgAttendance,          label: t('dashboard.kpi.attendance_rate'), trendBg: 'var(--green-light)', trendColor: 'var(--green)' },
    { icon: <FileText size={22} strokeWidth={2} />,   bg: 'var(--orange-light)', val: String(stats.activeExams),    label: t('dashboard.kpi.active_exams'),   trendBg: 'var(--orange-light)', trendColor: 'var(--orange)' },
  ] : []

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
        <div>
          <div className="text-[22px] md:text-[28px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
            {t('dashboard.overview_title')}
          </div>
          <div className="text-[13px] md:text-[17px]" style={{ color: 'var(--text3)', marginTop: 3 }}>{t('dashboard.overview_subtitle')}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Package size={14} strokeWidth={2} /> {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button
          onClick={() => { fetchStats(); onToast(t('dashboard.refreshing'), 'info') }}
          className="inline-flex items-center gap-[6px] cursor-pointer font-nunito flex-shrink-0 rounded-full md:rounded-[10px] px-[14px] py-[9px] md:px-[14px] md:py-[7px] text-[12.5px] md:text-[15px] font-semibold md:font-extrabold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-[var(--bg2)] md:bg-[var(--surface)]"
          style={{ color: 'var(--text2)' }}
        ><RefreshCw size={14} strokeWidth={2} />{t('dashboard.refresh')}</button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Error */}
      {!loading && error && error !== 'OFFLINE_NO_CACHE' && (
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

      {!loading && error === 'OFFLINE_NO_CACHE' && (
        <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 16, padding: '48px 24px', textAlign: 'center', color: 'var(--text3)' }}>
          Aucune donnée en cache — reconnectez-vous pour charger le tableau de bord.
        </div>
      )}

      {/* Content */}
      {!loading && !error && stats && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 18, marginBottom: 22 }}>
            {kpi.map((k, i) => (
              <div key={i}
                onClick={() => k.nav && onNav(k.nav)}
                className="p-4 md:px-[26px] md:py-[22px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]"
                style={{ background: 'var(--surface)', borderRadius: 16, cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
                onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="w-[38px] h-[38px] md:w-12 md:h-12 [&>svg]:w-[18px] [&>svg]:h-[18px] md:[&>svg]:w-[22px] md:[&>svg]:h-[22px]" style={{ borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
                </div>
                <div className="text-[24px] md:text-[36px] font-bold md:font-black" style={{ color: 'var(--text)', lineHeight: 1 }}>{k.val}</div>
                <div className="text-[12.5px] md:text-[16px]" style={{ color: 'var(--text3)', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* 2 colonnes */}
          <div className="grid grid-cols-1 md:[grid-template-columns:2fr_1fr]" style={{ gap: 18 }}>

            {/* Activité récente */}
            <div className="shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden' }}>
              <div className="px-[18px] pt-[18px] pb-2 md:px-[22px] md:py-4 md:border-b md:border-[var(--border)]">
                <span className="text-[15px] md:text-[17px] font-bold md:font-extrabold" style={{ color: 'var(--text)' }}>{t('dashboard.recent_activity_title')}</span>
              </div>
              <div className="px-[18px] pb-[18px] pt-0 md:px-[22px] md:py-[18px]">
                {stats.recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 md:block md:py-5" style={{ color: 'var(--text3)', textAlign: 'center' }}>
                    <Clock size={30} strokeWidth={1.6} className="md:hidden" style={{ color: 'var(--border2)' }} />
                    <span className="text-[13px] md:text-[16px]">{t('dashboard.no_recent_activity')}</span>
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
            <div className="shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', borderRadius: 16, overflow: 'hidden' }}>
              <div className="px-[18px] pt-[18px] pb-2 md:px-[22px] md:py-4 md:border-b md:border-[var(--border)]">
                <span className="text-[15px] md:text-[17px] font-bold md:font-extrabold" style={{ color: 'var(--text)' }}>{t('dashboard.quick_actions_title')}</span>
              </div>
              <div className="px-[10px] pb-[10px] pt-[6px] gap-[6px] md:px-[18px] md:pb-4 md:pt-0 md:gap-[10px]" style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { icon: <FileText size={16} strokeWidth={2} />, label: t('dashboard.quick_actions.pending_grades'),    nav: 'grades'    },
                  { icon: <ScrollText size={16} strokeWidth={2} />, label: t('dashboard.quick_actions.generate_reports'),   nav: 'bulletins' },
                  { icon: <Users size={16} strokeWidth={2} />, label: t('dashboard.quick_actions.manage_classes'),   nav: 'classes'   },
                  { icon: <User size={16} strokeWidth={2} />, label: t('dashboard.quick_actions.invite_user'), action: onInvite },
                ].map((btn, i) => (
                  <button key={i}
                    onClick={() => btn.action ? btn.action() : onNav(btn.nav!)}
                    className="w-full rounded-[12px] md:rounded-[10px] py-[13px] px-[10px] md:py-[10px] md:px-5 text-[14px] md:text-[16px] font-semibold md:font-extrabold gap-[14px] md:gap-2 border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-transparent md:bg-[var(--surface)]"
                    style={{ color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', transition: 'all 0.12s' }}
                    onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)' })}
                    onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                  >
                    <span className="w-[34px] h-[34px] md:w-auto md:h-auto flex items-center justify-center rounded-[10px] md:rounded-none flex-shrink-0 bg-[var(--bg2)] md:bg-transparent">{btn.icon}</span>
                    {btn.label}
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
