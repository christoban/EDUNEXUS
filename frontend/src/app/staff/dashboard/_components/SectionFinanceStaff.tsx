'use client'
import { useState, useEffect, useCallback } from 'react'
import type { SessionUser } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  sessionUser?: SessionUser | null
}

interface Payment { id: string; amount: number; status: string; paidAt: string | null; method: string }
interface InvoiceItem {
  id: string; amount: number; currency: string; status: string; dueDate: string | null; createdAt: string
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string; amount: number } | null
  payments: Payment[]
}
interface Pagination { total: number; page: number; pages: number }

const INV_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:    { bg: '#fee2e2', color: '#991b1b', label: 'Impayé'     },
  PARTIAL:    { bg: '#fef3c7', color: '#92400e', label: 'Partiel'    },
  PAID:       { bg: '#d1fae5', color: '#065f46', label: '✓ Payé'     },
  OVERDUE:    { bg: '#fecaca', color: '#7f1d1d', label: 'En retard'  },
  CANCELLED:  { bg: '#f1f5f9', color: '#475569', label: 'Annulé'     },
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

const DEPENSE_CATEGORIES = ['Fournitures', 'Entretien', 'Électricité / Eau', 'Carburant', 'Communication', 'Frais bancaires', 'Salaires', 'Événements', 'Divers']
const EMPTY_DEP = { label: '', amount: '', category: '', date: '' }

export default function SectionFinanceStaff({ onToast, sessionUser }: Props) {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [pag, setPag]           = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [page, setPage]         = useState(1)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [payingId, setPayingId]   = useState<string | null>(null)

  const [depenseOpen, setDepenseOpen]       = useState(false)
  const [depenseForm, setDepenseForm]       = useState(EMPTY_DEP)
  const [depenseSending, setDepenseSending] = useState(false)
  const [depenseError, setDepenseError]     = useState<string | null>(null)

  const hasMF = sessionUser?.permissions?.includes('MANAGE_FINANCE') ?? false

  const submitDepense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!depenseForm.label.trim()) { setDepenseError('Le libellé est requis'); return }
    const amt = parseFloat(depenseForm.amount)
    if (!depenseForm.amount || isNaN(amt) || amt <= 0) { setDepenseError('Le montant doit être un nombre positif'); return }
    setDepenseSending(true); setDepenseError(null)
    try {
      const body: Record<string, unknown> = { label: depenseForm.label.trim(), amount: amt }
      if (depenseForm.category.trim()) body.category = depenseForm.category.trim()
      if (depenseForm.date) body.date = depenseForm.date
      const res = await fetch('/api/v2/finance/expenses', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      onToast('Dépense enregistrée avec succès', 'success')
      setDepenseOpen(false)
      setDepenseForm(EMPTY_DEP)
    } catch (err) {
      setDepenseError(err instanceof Error ? err.message : 'Erreur serveur')
    } finally {
      setDepenseSending(false)
    }
  }

  const fetchInvoices = useCallback(async (pg = 1) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(pg) })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/v2/finance/invoices?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setInvoices(data.data || [])
      setPag(data.pagination ?? { total: 0, page: pg, pages: 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { setPage(1); fetchInvoices(1) }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const initiateMobileMoney = async (invoice: InvoiceItem) => {
    const phone = prompt(`Numéro Mobile Money pour ${invoice.student.firstName} ${invoice.student.lastName} (ex: 6XXXXXXXX):`)
    if (!phone?.trim()) return
    setPayingId(invoice.id)
    try {
      const res = await fetch('/api/v2/finance/payments/mobile', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          studentId: invoice.student.id,
          amount: invoice.amount,
          phone: phone.trim(),
          method: phone.startsWith('67') || phone.startsWith('68') ? 'ORANGE_MONEY' : 'MTN_MOMO',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Paiement Mobile Money initié — en attente de confirmation', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur Mobile Money', 'error')
    } finally {
      setPayingId(null)
    }
  }

  const sendReminder = async (invoice: InvoiceItem) => {
    setSendingId(invoice.id)
    try {
      await new Promise(r => setTimeout(r, 600))
      onToast(`Rappel SMS envoyé pour ${invoice.student.firstName} ${invoice.student.lastName}`, 'success')
    } finally {
      setSendingId(null)
    }
  }

  const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0)
  const totalPartial = invoices.filter(i => i.status === 'PARTIAL').reduce((s, i) => s + i.amount, 0)

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Mobile Money — Paiements</div>
          <div style={sSub}>MTN MoMo &amp; Orange Money · Suivi des impayés</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {hasMF && (
            <button style={btnPrim} onClick={() => { setDepenseOpen(true); setDepenseError(null); setDepenseForm(EMPTY_DEP) }}>
              💸 Enregistrer une dépense
            </button>
          )}
          <button style={btnSec} onClick={() => fetchInvoices(page)}>🔄 Rafraîchir</button>
        </div>
      </div>

      {/* KPIs */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 22 }}>
          {[
            { label: 'Total impayé (page)',  val: fmtCFA(totalPending), bg: '#fee2e2', color: '#991b1b' },
            { label: 'Paiements partiels',   val: fmtCFA(totalPartial), bg: '#fef3c7', color: '#92400e' },
            { label: 'Résultats',            val: `${pag.total} facture${pag.total > 1 ? 's' : ''}`, bg: '#f0ebe3', color: '#6b5c45' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '18px 22px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterSt}>
            <option value="">Tous les statuts</option>
            <option value="PENDING">Impayés</option>
            <option value="PARTIAL">Partiels</option>
            <option value="PAID">Payés</option>
            <option value="OVERDUE">En retard</option>
          </select>
          <button style={btnPrim} onClick={() => { setPage(1); fetchInvoices(1) }}>Filtrer</button>
          <span style={{ marginLeft: 'auto', fontSize: 14, color: '#a89478', fontWeight: 600 }}>
            Page {pag.page}/{pag.pages} · {pag.total} total
          </span>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        )}

        {!loading && error && <div style={{ padding: '16px 20px', color: '#dc2626', fontWeight: 700 }}>⚠️ {error}</div>}

        {!loading && !error && invoices.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478' }}>
            Aucune facture trouvée
          </div>
        )}

        {!loading && !error && invoices.length > 0 && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Élève', 'Plan de frais', 'Montant', 'Payé', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = INV_STATUS[inv.status] ?? { bg: '#f1f5f9', color: '#475569', label: inv.status }
                  const paid = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
                  return (
                    <tr key={inv.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>
                        {inv.student.firstName} {inv.student.lastName}
                      </td>
                      <td style={tdSt}>{inv.feePlan?.name ?? '—'}</td>
                      <td style={{ ...tdSt, fontWeight: 700 }}>{fmtCFA(inv.amount)}</td>
                      <td style={tdSt}>
                        <span style={{ fontWeight: 700, color: paid > 0 ? '#059669' : '#a89478' }}>
                          {paid > 0 ? fmtCFA(paid) : '—'}
                        </span>
                      </td>
                      <td style={tdSt}>
                        <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={tdSt}>
                        {(inv.status === 'PENDING' || inv.status === 'PARTIAL') && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#dbeafe', color: '#1e40af', border: '1px solid rgba(29,78,216,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => initiateMobileMoney(inv)}
                              disabled={payingId === inv.id}>
                              {payingId === inv.id ? '⏳' : '📱'}
                            </button>
                            <button
                              style={{ padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#f0ebe3', color: '#6b5c45', border: '1px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => sendReminder(inv)}
                              disabled={sendingId === inv.id}>
                              {sendingId === inv.id ? '⏳' : '📲 SMS'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {pag.pages > 1 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'center', gap: 8 }}>
                <button style={btnSec} disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); fetchInvoices(p) }}>← Préc.</button>
                <span style={{ padding: '6px 12px', fontSize: 14, fontWeight: 700, color: '#6b5c45' }}>{page}/{pag.pages}</span>
                <button style={btnSec} disabled={page >= pag.pages}
                  onClick={() => { const p = page + 1; setPage(p); fetchInvoices(p) }}>Suiv. →</button>
              </div>
            )}
          </>
        )}
      </div>
      {/* ── Modale : Enregistrer une dépense ── */}
      {depenseOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget && !depenseSending) { setDepenseOpen(false) } }}>
          <div style={{ background: 'white', borderRadius: 20, border: '1.5px solid #e8e0d4', width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '22px 28px', borderBottom: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 21, fontWeight: 700, color: '#1a1209' }}>💸 Enregistrer une dépense</div>
              <button onClick={() => !depenseSending && setDepenseOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 22, color: '#a89478', cursor: 'pointer', lineHeight: 1, padding: 4 }}>×</button>
            </div>

            <form onSubmit={submitDepense} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Libellé */}
              <div>
                <label style={fLb}>Libellé <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="text"
                  value={depenseForm.label}
                  onChange={e => setDepenseForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="Ex: Achat de craies, Réparation toiture…"
                  style={fIn}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#059669'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d4c8b8'; (e.currentTarget as HTMLElement).style.background = '#f0ebe3' }}
                />
              </div>

              {/* Montant */}
              <div>
                <label style={fLb}>Montant (FCFA) <span style={{ color: '#dc2626' }}>*</span></label>
                <input
                  type="number"
                  min="1"
                  value={depenseForm.amount}
                  onChange={e => setDepenseForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="Ex: 25000"
                  style={fIn}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#059669'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d4c8b8'; (e.currentTarget as HTMLElement).style.background = '#f0ebe3' }}
                />
              </div>

              {/* Catégorie */}
              <div>
                <label style={fLb}>Catégorie <span style={{ color: '#a89478', fontWeight: 600, fontSize: 12 }}>(optionnel)</span></label>
                <select
                  value={depenseForm.category}
                  onChange={e => setDepenseForm(f => ({ ...f, category: e.target.value }))}
                  style={{ ...fIn, cursor: 'pointer' }}>
                  <option value="">— Sélectionner —</option>
                  {DEPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <label style={fLb}>Date de la dépense <span style={{ color: '#a89478', fontWeight: 600, fontSize: 12 }}>(optionnel)</span></label>
                <input
                  type="date"
                  value={depenseForm.date}
                  onChange={e => setDepenseForm(f => ({ ...f, date: e.target.value }))}
                  style={fIn}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#059669'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d4c8b8'; (e.currentTarget as HTMLElement).style.background = '#f0ebe3' }}
                />
              </div>

              {/* Erreur dans la modale */}
              {depenseError && (
                <div style={{ background: '#fee2e2', border: '1.5px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '10px 14px', color: '#991b1b', fontSize: 14, fontWeight: 700 }}>
                  ⚠️ {depenseError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" onClick={() => setDepenseOpen(false)} disabled={depenseSending} style={btnSec}>
                  Annuler
                </button>
                <button type="submit" disabled={depenseSending}
                  style={{ ...btnPrim, opacity: depenseSending ? 0.7 : 1, cursor: depenseSending ? 'wait' : 'pointer' }}>
                  {depenseSending ? '⏳ Enregistrement…' : '✅ Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '9px 18px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, fontSize: 14, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: '#6b5c45', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 14px', fontSize: 15, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
const fLb: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#6b5c45', marginBottom: 7, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }
const fIn: React.CSSProperties = { width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 11, color: '#1a1209', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }
