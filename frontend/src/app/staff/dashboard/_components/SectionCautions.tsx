'use client'
import { useState, useEffect, useCallback } from 'react'

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

const STATUS_LABEL: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: '#fef3c7', color: '#92400e', label: 'Caution HELD'       },
  PAID:      { bg: '#d1fae5', color: '#065f46', label: '✓ Remboursée'        },
  CANCELLED: { bg: '#fee2e2', color: '#991b1b', label: '🔒 Retenue définit.' },
  PARTIAL:   { bg: '#fef3c7', color: '#92400e', label: 'Partielle'           },
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

export default function SectionCautions({ onToast }: Props) {
  const [cautions, setCautions] = useState<CautionInvoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchCautions = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/v2/finance/invoices?feeType=CAUTION&limit=50', { credentials: 'include' })
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
      onToast('Aucun paiement de caution éligible', 'error')
      return
    }
    if (!confirm(`Rembourser la caution de ${caution.student.firstName} ${caution.student.lastName} (${fmtCFA(caution.amount)}) ?`)) return
    setActionId(caution.id)
    try {
      const res = await fetch(`/api/v2/finance/payments/caution/${cautionPayment.id}/rembourser`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REMBOURSER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Caution de ${caution.student.firstName} ${caution.student.lastName} remboursée`, 'success')
      fetchCautions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de remboursement', 'error')
    } finally {
      setActionId(null)
    }
  }

  const handleRetention = async (caution: CautionInvoice) => {
    if (!confirm(`Retenir définitivement la caution de ${caution.student.firstName} ${caution.student.lastName} ? Action irréversible.`)) return
    const cautionPayment = caution.payments.find(p => p.status !== 'PAID')
    if (!cautionPayment) { onToast('Aucun paiement de caution trouvé', 'error'); return }
    setActionId(caution.id)
    try {
      const res = await fetch(`/api/v2/finance/payments/caution/${cautionPayment.id}/rembourser`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RETENIR_DEFINITIVEMENT' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Caution retenue définitivement`, 'success')
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
          <div style={sTitle}>Gestion des cautions</div>
          <div style={sSub}>Dépôts de garantie · HELD → Remboursement ou rétention</div>
        </div>
        <button style={btnSec} onClick={fetchCautions}>🔄 Rafraîchir</button>
      </div>

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 22 }}>
          <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Cautions en attente</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#92400e' }}>{heldCount}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Montant total</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1209' }}>{fmtCFA(totalAmount)}</div>
          </div>
          <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '18px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Total cautions</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#6b5c45' }}>{cautions.length}</div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span><span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={fetchCautions} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && cautions.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🔒</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucune caution enregistrée</div>
          <div style={{ fontSize: 16, color: '#a89478' }}>Les cautions seront visibles ici une fois créées.</div>
        </div>
      )}

      {!loading && !error && cautions.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Élève', 'Montant', 'Plan', 'Date dépôt', 'Statut', 'Actions'].map(h => (
                <th key={h} style={thSt}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {cautions.map((c) => {
                const st = STATUS_LABEL[c.status] ?? { bg: '#f1f5f9', color: '#475569', label: c.status }
                const isHeld = c.status === 'PENDING' || c.status === 'PARTIAL'
                return (
                  <tr key={c.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>
                      {c.student.firstName} {c.student.lastName}
                    </td>
                    <td style={{ ...tdSt, fontWeight: 700 }}>{fmtCFA(c.amount)}</td>
                    <td style={tdSt}>{c.feePlan?.name ?? 'Caution'}</td>
                    <td style={tdSt}>{new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={tdSt}>
                      {isHeld && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#d1fae5', color: '#065f46', border: '1px solid rgba(5,150,105,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                            onClick={() => handleRemboursement(c)}
                            disabled={actionId === c.id}>
                            {actionId === c.id ? '⏳' : '✅ Rembourser'}
                          </button>
                          <button
                            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                            onClick={() => handleRetention(c)}
                            disabled={actionId === c.id}>
                            🔒 Retenir
                          </button>
                        </div>
                      )}
                      {!isHeld && (
                        <span style={{ fontSize: 14, color: '#a89478', fontStyle: 'italic' }}>
                          {c.status === 'PAID' ? 'Remboursée' : 'Traitée'}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thSt: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 14px', fontSize: 15, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
