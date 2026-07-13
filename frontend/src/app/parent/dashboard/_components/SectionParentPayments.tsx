'use client'
import { useState, useEffect, useCallback } from 'react'
import { Book, AlertTriangle, Smartphone, Check, Circle, CreditCard, Search } from 'lucide-react'
import type { Toast } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: Toast['type']) => void
}

interface Child { studentId: string; prenom: string; nom: string }

interface Payment { id: string; amount: number; status: string; paidAt: string | null; method: string }
interface Invoice {
  id: string; amount: number; currency: string; status: string
  dueDate: string | null; createdAt: string; description: string | null
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string; amount: number } | null
  payments: Payment[]
}

function invStatus(tf: (k: string) => string): Record<string, { bg: string; color: string; label: string }> {
  return {
    PENDING:   { bg: 'var(--amber-light)', color: 'var(--amber)', label: tf('invoice_status.PENDING')  },
    PAID:      { bg: 'var(--green-light)', color: 'var(--green)', label: tf('invoice_status.PAID')     },
    OVERDUE:   { bg: 'var(--red-light)', color: 'var(--red)', label: tf('invoice_status.OVERDUE')   },
    CANCELLED: { bg: 'var(--bg2)', color: 'var(--text2)', label: tf('invoice_status.CANCELLED') },
    PARTIAL:   { bg: 'var(--blue-light)', color: 'var(--blue)', label: tf('invoice_status.PARTIAL')   },
  }
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

export default function SectionParentPayments({ onToast }: Props) {
  const t = useT('parent')
  const tf = useT('finance')
  const tc = useT('common')
  const isOnline = useOnlineStatus()

  const [children, setChildren]     = useState<Child[]>([])
  const [invoices, setInvoices]     = useState<Invoice[]>([])
  const [childFilter, setChildFilter] = useState('')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [minesecConcerned, setMinesecConcerned] = useState(false)
  const [guideOpen, setGuideOpen]   = useState(false)

  // ── Modal paiement ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState<{
    open: boolean; invoiceId: string; amount: number; label: string
    method: 'MTN_MOMO' | 'ORANGE_MONEY'; phone: string; loading: boolean; error: string
  }>({ open: false, invoiceId: '', amount: 0, label: '', method: 'MTN_MOMO', phone: '', loading: false, error: '' })

  const fetchChildren = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' })
      const d = await res.json()
      if (d.success) setChildren(d.data || [])
    } catch { /* silencieux */ }
  }, [t, tf, tc])

  const fetchInvoices = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (childFilter) params.set('studentId', childFilter)
      const res = await fetchApi(`/api/v2/parent/invoices?${params}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || tf('errors.server_error'))
      setInvoices(d.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorLoad'))
    } finally { setLoading(false) }
  }, [childFilter])

  useEffect(() => { fetchChildren() }, [fetchChildren])
  useEffect(() => { fetchInvoices() }, [fetchInvoices])
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchApi('/api/v2/school/me', { credentials: 'include' })
        const d = await res.json()
        setMinesecConcerned(Boolean(d?.data?.minesecSchoolCode))
      } catch { /* silencieux */ }
    })()
  }, [])

  const openModal = (inv: Invoice) => {
    const paidAmt = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
    const remaining = Math.max(0, inv.amount - paidAmt)
    setModal({
      open: true, invoiceId: inv.id, amount: remaining,
      label: inv.feePlan?.name ?? inv.description ?? 'Facture',
      method: 'MTN_MOMO', phone: '', loading: false, error: '',
    })
  }

  const submitPayment = async () => {
    if (!modal.phone.trim()) { setModal(m => ({ ...m, error: t('payments.phoneRequired') })); return }
    setModal(m => ({ ...m, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/parent/pay', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: modal.invoiceId, method: modal.method, phoneNumber: modal.phone }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || tf('errors.generic_error'))
      onToast(t('payments.paymentInitiated'), 'success')
      setModal(m => ({ ...m, open: false }))
      fetchInvoices()
    } catch (err) {
      setModal(m => ({ ...m, error: err instanceof Error ? err.message : tf('errors.generic_error'), loading: false }))
    }
  }

  if (!isOnline) return <OfflineEmptyState message={t('payments.offlineMessage')} />

  const unpaid = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE' || i.status === 'PARTIAL')
  const totalDu = unpaid.reduce((s, i) => {
    const paid = i.payments.filter(p => p.status === 'PAID').reduce((ss, p) => ss + p.amount, 0)
    return s + Math.max(0, i.amount - paid)
  }, 0)

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>{t('payments.title')}</div>
          <div style={sSub}>{t('payments.subtitle')}</div>
        </div>
        {children.length > 0 && (
          <select value={childFilter} onChange={e => setChildFilter(e.target.value)} style={sSelect}>
            <option value="">{t('payments.allChildren')}</option>
            {children.map(c => <option key={c.studentId} value={c.studentId}>{c.prenom} {c.nom}</option>)}
          </select>
        )}
      </div>

      {/* Guide MINESEC — uniquement si l'école utilise le système national cartescolaire.cm */}
      {minesecConcerned && (
        <div style={{ background: 'var(--blue-light)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 14, padding: '16px 22px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: 'var(--blue)', display: 'flex', alignItems: 'center' }}><Book size={22} strokeWidth={2} /></span>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--blue)' }}>{t('minesecGuide.title')}</div>
                <div style={{ fontSize: 14, color: 'var(--blue)', marginTop: 2 }}>{t('minesecGuide.intro')}</div>
              </div>
            </div>
            <button onClick={() => setGuideOpen(o => !o)}
              style={{ padding: '7px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--blue)', border: '1.5px solid var(--blue)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {guideOpen ? t('minesecGuide.hide') : t('minesecGuide.show')}
            </button>
          </div>

          {guideOpen && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(37,99,235,0.2)' }}>
              <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--text2)', fontSize: 14, lineHeight: 1.7 }}>
                <li>{t('minesecGuide.step1')}</li>
                <li>{t('minesecGuide.step2')}</li>
                <li>{t('minesecGuide.step3')}</li>
                <li>{t('minesecGuide.step4')}</li>
              </ol>

              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginTop: 14, marginBottom: 6 }}>{t('minesecGuide.operatorsTitle')}</div>
              <div style={{ fontSize: 14, color: 'var(--text2)' }}>{t('minesecGuide.operatorsList')}</div>

              <div style={{ fontSize: 14, color: 'var(--text2)', marginTop: 12, fontStyle: 'italic' }}>{t('minesecGuide.receiptNote')}</div>

              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8 }}>{t('minesecGuide.examNote')}</div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <a href="https://cartescolaire.cm/pay-fees" target="_blank" rel="noopener noreferrer"
                  style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'var(--blue)', color: 'white', textDecoration: 'none' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CreditCard size={14} strokeWidth={2} /> {t('minesecGuide.payLink')}</span>
                </a>
                <a href="https://cartescolaire.cm/verify-payment" target="_blank" rel="noopener noreferrer"
                  style={{ padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 700, background: 'var(--surface)', color: 'var(--blue)', border: '1.5px solid var(--blue)', textDecoration: 'none' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Search size={14} strokeWidth={2} /> {t('minesecGuide.verifyLink')}</span>
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerte si factures impayées */}
      {unpaid.length > 0 && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 14, padding: '16px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ color: 'var(--amber)', display: 'flex', alignItems: 'center' }}><AlertTriangle size={22} strokeWidth={2} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--amber)' }}>
              {t('payments.pendingPayment').replace('{count}', String(unpaid.length))}
            </div>
            <div style={{ fontSize: 15, color: 'var(--amber)', marginTop: 3 }}>
              {t('payments.remainingDue').replace('{amount}', fmtCFA(totalDu))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text3)' }}>{tc('status.loading')}</div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--red)', fontWeight: 700 }}>{error}</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Smartphone size={44} strokeWidth={2} /></div>
            <div style={{ fontSize: 17 }}>{t('payments.noInvoices')}</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{[tf('table_headers.student'), t('payments.libelle'), tf('table_headers.amount'), tf('table_headers.paid'), t('payments.remaining'), tf('table_headers.status'), tf('table_headers.actions')].map(h => (
                <th key={h} style={thSt}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const INV_STATUS = invStatus(tf)
                const st = INV_STATUS[inv.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: inv.status }
                const paid = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
                const remaining = Math.max(0, inv.amount - paid)
                const canPay = (inv.status === 'PENDING' || inv.status === 'OVERDUE' || inv.status === 'PARTIAL') && remaining > 0
                return (
                  <tr key={inv.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                      {inv.student.firstName} {inv.student.lastName}
                    </td>
                    <td style={tdSt}>{inv.feePlan?.name ?? inv.description ?? '—'}</td>
                    <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{fmtCFA(inv.amount)}</td>
                    <td style={{ ...tdSt, fontWeight: 700, color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                      {paid > 0 ? fmtCFA(paid) : '—'}
                    </td>
                    <td style={{ ...tdSt, fontWeight: 700, color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>
                      {remaining > 0 ? fmtCFA(remaining) : <Check size={16} strokeWidth={2.5} />}
                    </td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={tdSt}>
                      {canPay && (
                        <button style={{ ...btnPay, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => openModal(inv)}><Smartphone size={14} strokeWidth={2} /> {t('payments.payButton')}</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal paiement */}
      {modal.open && (
        <div onClick={() => !modal.loading && setModal(m => ({ ...m, open: false }))}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 18, padding: '32px 36px', width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {t('payments.modalTitle')}
            </div>
            <div style={{ fontSize: 15, color: 'var(--text3)', marginBottom: 22 }}>{modal.label}</div>

            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '14px 18px', marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)' }}>{t('payments.amountToPay')}</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)' }}>{fmtCFA(modal.amount)}</span>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>{t('payments.operator')}</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              {(['MTN_MOMO', 'ORANGE_MONEY'] as const).map(m => (
                <button key={m} onClick={() => setModal(s => ({ ...s, method: m }))}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', borderColor: modal.method === m ? 'var(--green)' : 'var(--border)', background: modal.method === m ? 'var(--green-light)' : 'white', color: modal.method === m ? 'var(--green)' : 'var(--text3)', transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Circle size={10} fill={m === 'MTN_MOMO' ? 'var(--amber)' : 'var(--orange)'} stroke="none" />
                  {m === 'MTN_MOMO' ? 'MTN MoMo' : 'Orange Money'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>{t('payments.phoneLabel')}</div>
            <input
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 15, border: '1.5px solid var(--border)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 18, outline: 'none' }}
              type="tel" placeholder={t('payments.phonePlaceholder')} value={modal.phone}
              onChange={e => setModal(m => ({ ...m, phone: e.target.value }))} />

            {modal.error && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{modal.error}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(m => ({ ...m, open: false }))} disabled={modal.loading}
                style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {tc('actions.cancel')}
              </button>
              <button onClick={submitPayment} disabled={modal.loading}
                style={{ flex: 2, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: modal.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: modal.loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {modal.loading ? t('payments.initiating') : <><Smartphone size={16} strokeWidth={2} /> {t('payments.confirmPayment')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const sSelect: React.CSSProperties = { padding: '9px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'inherit', cursor: 'pointer' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 16, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
const btnPay: React.CSSProperties = { padding: '6px 14px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
