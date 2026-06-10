'use client'
import { useState, useEffect, useCallback } from 'react'
import type { StaffSection, SessionUser } from '../_types'

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
  const can = (s: StaffSection) => allowedSections.has(s)
  const [kpi, setKpi] = useState<KpiData>({ pendingGrades: 0, openCouncils: 0, pendingInvoices: 0, attendanceRate: null })
  const [loading, setLoading] = useState(true)

  const fetchKpis = useCallback(async () => {
    setLoading(true)
    const results = await Promise.allSettled([
      can('grades')     ? fetch('/api/v2/grades/pending',                { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('council')    ? fetch('/api/v2/class-councils',                { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('finance')    ? fetch('/api/v2/finance/invoices?status=PENDING&limit=1', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('attendance') ? fetch('/api/v2/attendance/stats',              { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
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
    can('grades')     && { icon: '📝', bg: '#fef3c7', val: String(kpi.pendingGrades), label: 'Notes à valider',      trend: kpi.pendingGrades > 0 ? '⚠️ Urgent' : '✅ À jour', tBg: kpi.pendingGrades > 0 ? '#fef3c7' : '#d1fae5', tC: kpi.pendingGrades > 0 ? '#92400e' : '#065f46', nav: 'grades'  as StaffSection },
    can('council')    && { icon: '🎓', bg: '#ede9fe', val: String(kpi.openCouncils),   label: 'Conseils ouverts',     trend: 'À traiter',         tBg: '#ede9fe', tC: '#5b21b6', nav: 'council' as StaffSection },
    can('finance')    && { icon: '📱', bg: '#dbeafe', val: String(kpi.pendingInvoices),label: 'Paiements en attente', trend: 'Mobile Money',       tBg: '#dbeafe', tC: '#1e40af', nav: 'finance' as StaffSection },
    can('attendance') && { icon: '✅', bg: '#d1fae5', val: kpi.attendanceRate ?? '—',  label: 'Taux de présence',     trend: "Aujourd'hui",        tBg: '#d1fae5', tC: '#065f46', nav: 'attendance' as StaffSection },
  ].filter(Boolean) as { icon: string; bg: string; val: string; label: string; trend: string; tBg: string; tC: string; nav: StaffSection }[]

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Bonjour, {nomAffiche} 👋</div>
          <div style={sSub}>2025–2026 · Espace Staff</div>
        </div>
        <button style={btnSec} onClick={() => { fetchKpis(); onToast('Actualisation en cours…', 'info') }}>
          🔄 Actualiser
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && kpiCards.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(kpiCards.length, 4)},1fr)`, gap: 18, marginBottom: 22 }}>
          {kpiCards.map((k, i) => (
            <div key={i}
              onClick={() => onNav(k.nav)}
              style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
                <span style={{ fontSize: 13, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: k.tBg, color: k.tC, whiteSpace: 'nowrap' }}>{k.trend}</span>
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{k.val}</div>
              <div style={{ fontSize: 15, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && (can('grades') || can('council') || can('finance')) && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>🚨 Actions rapides</span>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              can('grades')  && kpi.pendingGrades > 0  && { icon: '📝', bg: '#fef3c7', color: '#92400e', border: 'rgba(217,119,6,0.2)',  text: `${kpi.pendingGrades} lot${kpi.pendingGrades > 1 ? 's' : ''} de notes en attente de validation`, action: () => onNav('grades'),  btn: 'Valider →' },
              can('council') && kpi.openCouncils > 0   && { icon: '🎓', bg: '#ede9fe', color: '#5b21b6', border: 'rgba(91,33,182,0.2)',  text: `${kpi.openCouncils} conseil${kpi.openCouncils > 1 ? 's' : ''} ouvert${kpi.openCouncils > 1 ? 's' : ''}`, action: () => onNav('council'), btn: 'Voir →' },
              can('finance') && kpi.pendingInvoices > 0 && { icon: '📱', bg: '#fee2e2', color: '#991b1b', border: 'rgba(220,38,38,0.2)', text: `${kpi.pendingInvoices} paiement${kpi.pendingInvoices > 1 ? 's' : ''} Mobile Money en attente`, action: () => onNav('finance'), btn: 'Traiter →' },
            ].filter(Boolean).map((alert, i) => {
              const a = alert as { icon: string; bg: string; color: string; border: string; text: string; action: () => void; btn: string }
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: a.bg, borderRadius: 12, border: `1px solid ${a.border}` }}>
                  <span style={{ fontSize: 22 }}>{a.icon}</span>
                  <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: a.color }}>{a.text}</span>
                  <button onClick={a.action}
                    style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: 'white', color: a.color, border: `1.5px solid ${a.border}`, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {a.btn}
                  </button>
                </div>
              )
            })}
            {!can('grades') && !can('council') && !can('finance') && (
              <div style={{ fontSize: 16, color: '#a89478', padding: '8px 0' }}>Aucune action urgente pour vos permissions actuelles.</div>
            )}
          </div>
        </div>
      )}

      {allowedSections.size === 1 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '40px 32px', textAlign: 'center', maxWidth: 520, margin: '0 auto' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔐</div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 10 }}>Aucune section assignée</div>
          <div style={{ fontSize: 16, color: '#a89478', lineHeight: 1.7 }}>
            Votre compte n&apos;a pas encore de permissions assignées.<br />Contactez l&apos;administrateur de l&apos;établissement.
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
