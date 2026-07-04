'use client'
import { useState, useEffect, useCallback } from 'react'
import type { StaffSection, SessionUser } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  sessionUser: SessionUser | null
  allowedSections: Set<StaffSection>
  onNav: (s: StaffSection) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface KpiData {
  pendingGrades: number
  openCouncils: number
  pendingInvoices: number
  attendanceRate: string | null
}

export default function SectionStaffDashboard({ sessionUser, allowedSections, onNav, onToast }: Props) {
  const t = useT('staff')
  const can = (s: StaffSection) => allowedSections.has(s)
  const [kpi, setKpi] = useState<KpiData>({ pendingGrades: 0, openCouncils: 0, pendingInvoices: 0, attendanceRate: null })
  const [loading, setLoading] = useState(true)

  const fetchKpis = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      can('grades')     ? fetchApi('/api/v2/grades/pending',                { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('council')    ? fetchApi('/api/v2/class-councils',                { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('finance')    ? fetchApi('/api/v2/finance/invoices?status=PENDING&limit=1', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('attendance') ? fetchApi('/api/v2/attendance/stats',              { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
    ])

    const [gradesRes, councilRes, financeRes, attendanceRes] = results

    setKpi({
      pendingGrades:   gradesRes.status === 'fulfilled'    && gradesRes.value?.total      != null ? gradesRes.value.total : 0,
      openCouncils:    councilRes.status === 'fulfilled'   && councilRes.value?.sessions  != null ? councilRes.value.sessions.filter((s: any) => s.status !== 'LOCKED').length : 0,
      pendingInvoices: financeRes.status === 'fulfilled'   && financeRes.value?.pagination != null ? financeRes.value.pagination.total : 0,
      attendanceRate:  attendanceRes.status === 'fulfilled' && attendanceRes.value?.stats  != null ? attendanceRes.value.stats.attendanceRate : null,
    })
    setLoading(false)
  }, [allowedSections]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchKpis() }, [fetchKpis])

  const nomAffiche = sessionUser?.firstName ?? 'Staff'

  const kpiCards = [
    can('grades')     && { icon: '📝', bg: 'var(--amber-light)', val: String(kpi.pendingGrades), label: t('dashboard.pendingGrades'),      trend: kpi.pendingGrades > 0 ? t('dashboard.urgent') : t('dashboard.upToDate'), tBg: kpi.pendingGrades > 0 ? 'var(--amber-light)' : 'var(--green-light)', tC: kpi.pendingGrades > 0 ? 'var(--amber)' : 'var(--green)', nav: 'grades'  as StaffSection },
    can('council')    && { icon: '🎓', bg: 'var(--purple-light)', val: String(kpi.openCouncils),   label: t('dashboard.openCouncils'),     trend: t('dashboard.toProcess'),         tBg: 'var(--purple-light)', tC: 'var(--purple)', nav: 'council' as StaffSection },
    can('finance')    && { icon: '📱', bg: 'var(--blue-light)', val: String(kpi.pendingInvoices),label: t('dashboard.pendingPayments'), trend: 'Mobile Money',       tBg: 'var(--blue-light)', tC: 'var(--blue)', nav: 'finance' as StaffSection },
    can('attendance') && { icon: '✅', bg: 'var(--green-light)', val: kpi.attendanceRate ?? '—',  label: t('dashboard.attendanceRate'),     trend: t('dashboard.today'),        tBg: 'var(--green-light)', tC: 'var(--green)', nav: 'attendance' as StaffSection },
  ].filter(Boolean) as { icon: string; bg: string; val: string; label: string; trend: string; tBg: string; tC: string; nav: StaffSection }[]

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>{t('dashboard.greeting')}, {nomAffiche} 👋</div>
          <div style={sSub}>{t('dashboard.subtitle')}</div>
        </div>
        <button style={btnSec} onClick={() => { fetchKpis(); onToast(t('dashboard.refreshing'), 'info') }}>
          🔄 {t('dashboard.refresh')}
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && kpiCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(kpiCards.length, 4)},1fr)`, gap: 18, marginBottom: 22 }}>
          {kpiCards.map((k, i) => (
            <div key={i}
              onClick={() => onNav(k.nav)}
              style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '22px 26px', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
                <span style={{ fontSize: 13, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: k.tBg, color: k.tC, whiteSpace: 'nowrap' }}>{k.trend}</span>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{k.val}</div>
              <div style={{ fontSize: 15, color: 'var(--text3)', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && (can('grades') || can('council') || can('finance')) && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{t('dashboard.quickActions')}</span>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              can('grades')  && kpi.pendingGrades > 0  && { icon: '📝', bg: 'var(--amber-light)', color: 'var(--amber)', border: 'rgba(217,119,6,0.2)',  text: t('dashboard.pendingGradesAlert', { count: kpi.pendingGrades, s: kpi.pendingGrades > 1 ? 's' : '' }), action: () => onNav('grades'),  btn: t('dashboard.validateCTA') },
              can('council') && kpi.openCouncils > 0   && { icon: '🎓', bg: 'var(--purple-light)', color: 'var(--purple)', border: 'rgba(91,33,182,0.2)',  text: t('dashboard.openCouncilsAlert', { count: kpi.openCouncils, s: kpi.openCouncils > 1 ? 's' : '' }), action: () => onNav('council'), btn: t('dashboard.viewCTA') },
              can('finance') && kpi.pendingInvoices > 0 && { icon: '📱', bg: 'var(--red-light)', color: 'var(--red)', border: 'rgba(220,38,38,0.2)', text: t('dashboard.pendingPaymentsAlert', { count: kpi.pendingInvoices, s: kpi.pendingInvoices > 1 ? 's' : '' }), action: () => onNav('finance'), btn: t('dashboard.processCTA') },
            ].filter(Boolean).map((alert, i) => {
              const a = alert as { icon: string; bg: string; color: string; border: string; text: string; action: () => void; btn: string }
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: a.bg, borderRadius: 12, border: `1px solid ${a.border}` }}>
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: a.color }}>{a.text}</span>
                  <button onClick={a.action}
                    style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: a.color, border: `1.5px solid ${a.border}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {a.btn}
                  </button>
                </div>
              )
            })}
            {!can('grades') && !can('council') && !can('finance') && (
              <div style={{ fontSize: 16, color: 'var(--text3)', padding: '8px 0' }}>{t('dashboard.noUrgentActions')}</div>
            )}
          </div>
        </div>
      )}

      {allowedSections.size === 1 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '40px 32px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>{t('dashboard.noSectionAssignedTitle')}</div>
          <div style={{ fontSize: 16, color: 'var(--text3)', lineHeight: 1.7 }}>
            {t('dashboard.noSectionAssignedDesc')}
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
