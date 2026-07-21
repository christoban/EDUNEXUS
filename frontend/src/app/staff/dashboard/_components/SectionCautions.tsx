'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Lock, Loader2 } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface Payment { id: string; amount: number; status: string; paidAt: string | null }
interface CautionInvoice {
  id: string; amount: number; status: string; createdAt: string
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string } | null
  payments: Payment[]
}

const STATUS_LABEL: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: 'var(--amber-light)', color: 'var(--amber)' },
  PAID:      { bg: 'var(--green-light)', color: 'var(--green)' },
  CANCELLED: { bg: 'var(--red-light)', color: 'var(--red)' },
  PARTIAL:   { bg: 'var(--amber-light)', color: 'var(--amber)' },
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

export default function SectionCautions({ onToast }: Props) {
  const t = useT('staff')
  const [cautions, setCautions] = useState<CautionInvoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchCautions = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetchApi('/api/v2/finance/invoices?feeType=CAUTION&limit=50', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setCautions(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCautions() }, [fetchCautions])

  const handleRemboursement = async (caution: CautionInvoice) => {
    const cautionPayment = caution.payments.find(p => p.status !== 'PAID')
    if (!cautionPayment) {
      onToast(t('cautions.noEligiblePayment'), 'error')
      return
    }
    if (!confirm(t('cautions.refundConfirm', { firstName: caution.student.firstName, lastName: caution.student.lastName, amount: fmtCFA(caution.amount) }))) return
    setActionId(caution.id)
    try {
      const res = await fetchApi(`/api/v2/finance/payments/caution/${cautionPayment.id}/rembourser`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REMBOURSER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('cautions.refundSuccess', { firstName: caution.student.firstName, lastName: caution.student.lastName }), 'success')
      fetchCautions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de remboursement', 'error')
    } finally {
      setActionId(null)
    }
  }

  const handleRetention = async (caution: CautionInvoice) => {
    if (!confirm(t('cautions.retainConfirm', { firstName: caution.student.firstName, lastName: caution.student.lastName }))) return
    const cautionPayment = caution.payments.find(p => p.status !== 'PAID')
    if (!cautionPayment) { onToast(t('cautions.noPaymentFound'), 'error'); return }
    setActionId(caution.id)
    try {
      const res = await fetchApi(`/api/v2/finance/payments/caution/${cautionPayment.id}/rembourser`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RETENIR_DEFINITIVEMENT' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('cautions.retainSuccess'), 'success')
      fetchCautions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setActionId(null)
    }
  }

  const heldCount   = cautions.filter(c => c.status === 'PENDING' || c.status === 'PARTIAL').length
  const totalAmount = cautions.filter(c => c.status === 'PENDING' || c.status === 'PARTIAL').reduce((s, c) => s + c.amount, 0)

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>{t('cautions.title')}</div>
          <div style={sSub}>{t('cautions.subtitle')}</div>
        </div>
        <button style={btnSec} onClick={fetchCautions}>{t('cautions.refresh')}</button>
      </div>

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 22 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{t('cautions.kpiPending')}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--amber)' }}>{heldCount}</div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{t('cautions.kpiTotalAmount')}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{fmtCFA(totalAmount)}</div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{t('cautions.kpiTotalCautions')}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--text2)' }}>{cautions.length}</div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={16} strokeWidth={2} /></span><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchCautions} style={btnRetry}>{t('cautions.retry')}</button>
        </div>
      )}

      {!loading && !error && cautions.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14, display: 'flex', justifyContent: 'center' }}><Lock size={52} strokeWidth={2} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('cautions.noCautionsTitle')}</div>
          <div style={{ fontSize: 16, color: 'var(--text3)' }}>{t('cautions.noCautionsDesc')}</div>
        </div>
      )}

      {!loading && !error && cautions.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
              <thead>
                <tr>{[
                  t('cautions.tableHeaderStudent'),
                  t('cautions.tableHeaderAmount'),
                  t('cautions.tableHeaderPlan'),
                  t('cautions.tableHeaderDate'),
                  t('cautions.tableHeaderStatus'),
                  t('cautions.tableHeaderActions'),
                ].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {cautions.map((c) => {
                  const st = STATUS_LABEL[c.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                  const statusLabelKey = c.status === 'PENDING' ? 'statusHeldf' : c.status === 'PAID' ? 'statusRefunded' : c.status === 'CANCELLED' ? 'statusRetained' : 'statusPartial'
                  const isHeld = c.status === 'PENDING' || c.status === 'PARTIAL'
                  return (
                    <tr key={c.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                        {c.student.firstName} {c.student.lastName}
                      </td>
                      <td style={{ ...tdSt, fontWeight: 700 }}>{fmtCFA(c.amount)}</td>
                      <td style={tdSt}>{c.feePlan?.name ?? 'Caution'}</td>
                      <td style={tdSt}>{new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td style={tdSt}>
                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: st.bg, color: st.color }}>
                          {t(`cautions.${statusLabelKey}`)}
                        </span>
                      </td>
                      <td style={tdSt}>
                        {isHeld && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => handleRemboursement(c)}
                              disabled={actionId === c.id}>
                              {actionId === c.id ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : t('cautions.refund')}
                            </button>
                            <button
                              style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => handleRetention(c)}
                              disabled={actionId === c.id}>
                              {t('cautions.retain')}
                            </button>
                          </div>
                        )}
                        {!isHeld && (
                          <span style={{ fontSize: 14, color: 'var(--text3)', fontStyle: 'italic' }}>
                            {c.status === 'PAID' ? t('cautions.refunded') : t('cautions.processed')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thSt: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 14px', fontSize: 15, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
