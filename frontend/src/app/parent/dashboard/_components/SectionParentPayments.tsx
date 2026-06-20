'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Toast } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineEmptyState from '@/components/OfflineEmptyState'

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

const INV_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: '#fef3c7', color: '#92400e', label: 'En attente'  },
  PAID:      { bg: '#d1fae5', color: '#065f46', label: '✓ Payée'     },
  OVERDUE:   { bg: '#fee2e2', color: '#991b1b', label: 'En retard'   },
  CANCELLED: { bg: '#f1f5f9', color: '#475569', label: 'Annulée'     },
  PARTIAL:   { bg: '#dbeafe', color: '#1e40af', label: 'Partielle'   },
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

export default function SectionParentPayments({ onToast }: Props) {
  const isOnline = useOnlineStatus()

  const [children, setChildren]     = useState<Child[]>([])
  const [invoices, setInvoices]     = useState<Invoice[]>([])
  const [childFilter, setChildFilter] = useState('')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)

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
  }, [])

  const fetchInvoices = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (childFilter) params.set('studentId', childFilter)
      const res = await fetchApi(`/api/v2/parent/invoices?${params}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur serveur')
      setInvoices(d.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally { setLoading(false) }
  }, [childFilter])

  useEffect(() => { fetchChildren() }, [fetchChildren])
  useEffect(() => { fetchInvoices() }, [fetchInvoices])

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
    if (!modal.phone.trim()) { setModal(m => ({ ...m, error: 'Numéro de téléphone obligatoire' })); return }
    setModal(m => ({ ...m, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/parent/pay', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: modal.invoiceId, method: modal.method, phoneNumber: modal.phone }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast('Paiement initié — confirmez sur votre téléphone', 'success')
      setModal(m => ({ ...m, open: false }))
      fetchInvoices()
    } catch (err) {
      setModal(m => ({ ...m, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  if (!isOnline) return <OfflineEmptyState message="Les informations de paiement nécessitent une connexion internet pour rester à jour." />

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
          <div style={sTitle}>Paiements Mobile Money</div>
          <div style={sSub}>Frais scolaires · MTN MoMo &amp; Orange Money</div>
        </div>
        {children.length > 0 && (
          <select value={childFilter} onChange={e => setChildFilter(e.target.value)} style={sSelect}>
            <option value="">Tous les enfants</option>
            {children.map(c => <option key={c.studentId} value={c.studentId}>{c.prenom} {c.nom}</option>)}
          </select>
        )}
      </div>

      {/* Alerte si factures impayées */}
      {unpaid.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 14, padding: '16px 22px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#92400e' }}>
              {unpaid.length} paiement{unpaid.length > 1 ? 's' : ''} en attente
            </div>
            <div style={{ fontSize: 15, color: '#d97706', marginTop: 3 }}>
              Montant restant dû : {fmtCFA(totalDu)}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#a89478' }}>Chargement…</div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{error}</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#a89478' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>📱</div>
            <div style={{ fontSize: 17 }}>Aucune facture trouvée</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Élève', 'Libellé', 'Montant', 'Payé', 'Reste dû', 'Statut', 'Actions'].map(h => (
                <th key={h} style={thSt}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const st = INV_STATUS[inv.status] ?? { bg: '#f1f5f9', color: '#475569', label: inv.status }
                const paid = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
                const remaining = Math.max(0, inv.amount - paid)
                const canPay = (inv.status === 'PENDING' || inv.status === 'OVERDUE' || inv.status === 'PARTIAL') && remaining > 0
                return (
                  <tr key={inv.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>
                      {inv.student.firstName} {inv.student.lastName}
                    </td>
                    <td style={tdSt}>{inv.feePlan?.name ?? inv.description ?? '—'}</td>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{fmtCFA(inv.amount)}</td>
                    <td style={{ ...tdSt, fontWeight: 700, color: paid > 0 ? '#059669' : '#a89478' }}>
                      {paid > 0 ? fmtCFA(paid) : '—'}
                    </td>
                    <td style={{ ...tdSt, fontWeight: 700, color: remaining > 0 ? '#dc2626' : '#059669' }}>
                      {remaining > 0 ? fmtCFA(remaining) : '✓'}
                    </td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={tdSt}>
                      {canPay && (
                        <button style={btnPay} onClick={() => openModal(inv)}>📱 Payer</button>
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
            style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>
              Payer par Mobile Money
            </div>
            <div style={{ fontSize: 15, color: '#a89478', marginBottom: 22 }}>{modal.label}</div>

            <div style={{ background: '#f0ebe3', borderRadius: 12, padding: '14px 18px', marginBottom: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#6b5c45' }}>Montant à payer</span>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#059669' }}>{fmtCFA(modal.amount)}</span>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Opérateur</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
              {(['MTN_MOMO', 'ORANGE_MONEY'] as const).map(m => (
                <button key={m} onClick={() => setModal(s => ({ ...s, method: m }))}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', borderColor: modal.method === m ? '#059669' : '#e8e0d4', background: modal.method === m ? '#d1fae5' : 'white', color: modal.method === m ? '#065f46' : '#6b7280', transition: 'all 0.12s' }}>
                  {m === 'MTN_MOMO' ? '🟡 MTN MoMo' : '🟠 Orange Money'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Numéro de téléphone *</div>
            <input
              style={{ width: '100%', padding: '11px 14px', borderRadius: 10, fontSize: 15, border: '1.5px solid #e8e0d4', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 18, outline: 'none' }}
              type="tel" placeholder="Ex: 677000000" value={modal.phone}
              onChange={e => setModal(m => ({ ...m, phone: e.target.value }))} />

            {modal.error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{modal.error}</div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(m => ({ ...m, open: false }))} disabled={modal.loading}
                style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={submitPayment} disabled={modal.loading}
                style={{ flex: 2, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: modal.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: modal.loading ? 0.7 : 1 }}>
                {modal.loading ? 'Initiation…' : '📱 Confirmer le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const sSelect: React.CSSProperties = { padding: '9px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#374151', fontFamily: 'inherit', cursor: 'pointer' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 16, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
const btnPay: React.CSSProperties = { padding: '6px 14px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
