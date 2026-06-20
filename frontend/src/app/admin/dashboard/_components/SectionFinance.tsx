'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface FeePlan {
  id: string; name: string; amount: number; currency: string
  feeType: string; level: string | null; description: string | null
  isRefundable: boolean; dueDate: string | null; createdAt: string
}

interface Payment { id: string; amount: number; status: string; paidAt: string | null }
interface InvoiceItem {
  id: string; amount: number; currency: string; status: string
  dueDate: string | null; createdAt: string; description: string | null
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string } | null
  payments: Payment[]
}

interface Pagination { total: number; page: number; pages: number }

const INV_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:    { bg: '#fef3c7', color: '#92400e', label: 'En attente'  },
  PAID:       { bg: '#d1fae5', color: '#065f46', label: '✓ Payée'     },
  OVERDUE:    { bg: '#fee2e2', color: '#991b1b', label: 'En retard'   },
  CANCELLED:  { bg: '#f1f5f9', color: '#475569', label: 'Annulée'     },
  PARTIAL:    { bg: '#dbeafe', color: '#1e40af', label: 'Partielle'   },
}

const FEE_TYPE_LABEL: Record<string, string> = {
  TUITION:      'Scolarité',
  REGISTRATION: 'Inscription',
  EXAM:         'Examen',
  UNIFORM:      'Uniforme',
  TRANSPORT:    'Transport',
  CAUTION:      'Caution',
  OTHER:        'Autre',
}

function fmtCFA(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

const FEE_TYPES = ['TUITION','REGISTRATION','EXAM','UNIFORM','TRANSPORT','CAUTION','OTHER']

const EMPTY_PLAN = { name: '', amount: '', feeType: 'TUITION', description: '', dueDate: '', isRefundable: false, loading: false, error: '' }
const EMPTY_MOD_PLAN = { open: false, planId: '', name: '', amount: '', feeType: '', description: '', dueDate: '', loading: false, error: '' }
const EMPTY_BULK = { open: false, planId: '', planName: '', academicYearId: '', loading: false, error: '', years: [] as { id: string; name: string }[] }
const EMPTY_INVOICE = { studentId: '', feePlanId: '', description: '', loading: false, error: '' }

export default function SectionFinance({ onToast }: Props) {
  const [tab, setTab] = useState<'plans' | 'invoices'>('plans')
  const [plans, setPlans]       = useState<FeePlan[]>([])
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [pag, setPag]           = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [invStatus, setInvStatus] = useState('')
  const [page, setPage]         = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [planForm, setPlanForm]     = useState(EMPTY_PLAN)
  const [modPlan, setModPlan]       = useState(EMPTY_MOD_PLAN)
  const [bulkForm, setBulkForm]         = useState(EMPTY_BULK)
  const [invoiceOpen, setInvoiceOpen]   = useState(false)
  const [invoiceForm, setInvoiceForm]   = useState(EMPTY_INVOICE)
  const [invStudents, setInvStudents]   = useState<{ id: string; firstName: string; lastName: string; studentProfile?: { class?: { name: string } } | null }[]>([])
  const [invPlans, setInvPlans]         = useState<{ id: string; name: string; amount: number }[]>([])
  const [invModalLoading, setInvModalLoading] = useState(false)

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setPlans(data.data || [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') }
    finally { setLoading(false) }
  }, [])

  const fetchInvoices = useCallback(async (pg = page) => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ limit: '20', page: String(pg) })
      if (invStatus) params.set('status', invStatus)
      const res = await fetchApi(`/api/v2/finance/invoices?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setInvoices(data.data || [])
      setPag(data.pagination ?? { total: 0, page: pg, pages: 1 })
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') }
    finally { setLoading(false) }
  }, [page, invStatus])

  useEffect(() => {
    if (tab === 'plans') fetchPlans()
    else fetchInvoices(1)
  }, [tab])  // eslint-disable-line react-hooks/exhaustive-deps

  const fetchYearsForBulk = async () => {
    try {
      const res = await fetchApi('/api/v2/academic-years', { credentials: 'include' })
      const d = await res.json()
      return (d.data || []) as { id: string; name: string }[]
    } catch { return [] }
  }

  // ── Créer plan ──────────────────────────────────────────────────────────
  const submitCreatePlan = async () => {
    if (!planForm.name.trim() || !planForm.amount) { setPlanForm(f => ({ ...f, error: 'Nom et montant obligatoires' })); return }
    setPlanForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/finance/fee-plans', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planForm.name.trim(),
          amount: parseFloat(planForm.amount),
          feeType: planForm.feeType,
          description: planForm.description.trim() || undefined,
          dueDate: planForm.dueDate || undefined,
          isRefundable: planForm.isRefundable,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Plan "${planForm.name}" créé`, 'success')
      setCreateOpen(false); setPlanForm(EMPTY_PLAN); fetchPlans()
    } catch (err) {
      setPlanForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Modifier plan (désactivé — route backend non disponible) ───────────
  const openModPlan = (_plan: FeePlan) => {
    onToast('Fonctionnalité à venir', 'info')
  }

  const submitModPlan = async () => {
    if (!modPlan.name.trim() || !modPlan.amount) { setModPlan(f => ({ ...f, error: 'Nom et montant obligatoires' })); return }
    setModPlan(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/finance/fee-plans/${modPlan.planId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modPlan.name.trim(), amount: parseFloat(modPlan.amount), feeType: modPlan.feeType, description: modPlan.description || undefined, dueDate: modPlan.dueDate || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Plan modifié', 'success')
      setModPlan(EMPTY_MOD_PLAN); fetchPlans()
    } catch (err) {
      setModPlan(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Générer factures en masse ────────────────────────────────────────────
  const openBulk = async (plan: FeePlan) => {
    const years = await fetchYearsForBulk()
    setBulkForm({ open: true, planId: plan.id, planName: plan.name, academicYearId: years[0]?.id ?? '', loading: false, error: '', years })
  }

  const submitBulk = async () => {
    if (!bulkForm.academicYearId) { setBulkForm(f => ({ ...f, error: 'Sélectionnez une année scolaire' })); return }
    setBulkForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/finance/invoices/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feePlanId: bulkForm.planId, academicYearId: bulkForm.academicYearId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`${data.count ?? 'Factures'} factures générées`, 'success')
      setBulkForm(EMPTY_BULK); setTab('invoices'); fetchInvoices(1)
    } catch (err) {
      setBulkForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Créer facture individuelle ───────────────────────────────────────────
  const openInvoiceModal = async () => {
    setInvoiceOpen(true); setInvoiceForm(EMPTY_INVOICE); setInvModalLoading(true)
    try {
      const [sRes, pRes] = await Promise.all([
        fetchApi('/api/v2/users?role=STUDENT', { credentials: 'include' }),
        fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' }),
      ])
      const [sData, pData] = await Promise.all([sRes.json(), pRes.json()])
      setInvStudents(sData.data || [])
      setInvPlans(pData.data || [])
    } catch {}
    finally { setInvModalLoading(false) }
  }

  const submitInvoice = async () => {
    if (!invoiceForm.studentId || !invoiceForm.feePlanId) {
      setInvoiceForm(f => ({ ...f, error: 'Veuillez sélectionner un élève et un plan de frais.' })); return
    }
    setInvoiceForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const body: Record<string, string> = { studentId: invoiceForm.studentId, feePlanId: invoiceForm.feePlanId }
      if (invoiceForm.description.trim()) body.description = invoiceForm.description.trim()
      const res = await fetchApi('/api/v2/finance/invoices', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const code = data.code || ''
        let errMsg = data.message || 'Erreur serveur'
        if (res.status === 409)
          errMsg = 'Un paiement est déjà en cours pour cet élève.'
        else if (res.status === 422 && code === 'SEUIL_LEGAL_DEPASSE')
          errMsg = '⚠ La contribution légale camerounaise serait dépassée pour cet élève. Vérifiez le montant du plan de frais.'
        else if (res.status === 403 && code === 'SEPARATION_ORDONNATEUR')
          errMsg = "⚠ Violation de la règle ordonnateur/comptable. L'ordonnateur ne peut pas être le comptable."
        setInvoiceForm(f => ({ ...f, error: errMsg, loading: false })); return
      }
      onToast('Facture créée avec succès', 'success')
      setInvoiceOpen(false); setInvoiceForm(EMPTY_INVOICE)
      if (tab === 'invoices') fetchInvoices(1)
    } catch (err) {
      setInvoiceForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // KPIs from invoices data
  const totalAmount    = invoices.reduce((s, i) => s + i.amount, 0)
  const paidAmount     = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0)
  const pendingCount   = invoices.filter(i => i.status === 'PENDING').length
  const overdueCount   = invoices.filter(i => i.status === 'OVERDUE').length

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Finance</div>
          <div style={sSub}>Plans de frais · Factures · Paiements Mobile Money</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '10px 18px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'white', color: '#059669', border: '1.5px solid rgba(5,150,105,0.35)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={openInvoiceModal}>🧾 Créer une facture</button>
          <button style={btnPrim} onClick={() => setCreateOpen(true)}>+ Nouveau plan</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f0ebe3', padding: 5, borderRadius: 12, marginBottom: 22, width: 'fit-content' }}>
        {(['plans', 'invoices'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '8px 20px', borderRadius: 9, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: tab === t ? 'white' : 'transparent', color: tab === t ? '#1a1209' : '#a89478', boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}>
            {t === 'plans' ? '📋 Plans de frais' : '🧾 Factures'}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span>
          <span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={() => tab === 'plans' ? fetchPlans() : fetchInvoices(page)}
            style={{ padding: '7px 16px', borderRadius: 9, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            Réessayer
          </button>
        </div>
      )}

      {/* Plans de frais */}
      {!loading && !error && tab === 'plans' && (
        <>
          {plans.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 14 }}>💰</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucun plan de frais</div>
              <div style={{ fontSize: 16, color: '#a89478', marginBottom: 22 }}>
                Créez des plans de frais pour pouvoir générer des factures.
              </div>
              <button style={btnPrim} onClick={() => setCreateOpen(true)}>+ Créer un plan</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {plans.map((plan) => (
                <div key={plan.id} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 22, transition: 'all 0.15s' }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: '#1a1209', lineHeight: 1.3 }}>
                      {plan.name}
                    </div>
                    <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                      {FEE_TYPE_LABEL[plan.feeType] ?? plan.feeType}
                    </span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#059669', marginBottom: 8 }}>
                    {fmtCFA(plan.amount)}
                  </div>
                  {plan.description && (
                    <div style={{ fontSize: 14, color: '#a89478', marginBottom: 10, lineHeight: 1.5 }}>{plan.description}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {plan.level && (
                      <span style={{ background: '#f0ebe3', color: '#6b5c45', padding: '2px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                        Niveau {plan.level}
                      </span>
                    )}
                    {plan.isRefundable && (
                      <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                        Remboursable
                      </span>
                    )}
                    {plan.dueDate && (
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                        Échéance {new Date(plan.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div style={{ paddingTop: 12, borderTop: '1px solid #e8e0d4', display: 'flex', gap: 8 }}>
                    <button style={btnSecSm} onClick={() => openBulk(plan)}>🧾 Générer factures</button>
                    <button style={btnSecSm} onClick={() => openModPlan(plan)}>✏️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Factures */}
      {!loading && !error && tab === 'invoices' && (
        <>
          {/* KPIs factures (sur la page courante) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { icon: '💰', label: 'Total facturé',        val: fmtCFA(totalAmount),   bg: '#dbeafe' },
              { icon: '✅', label: 'Montant encaissé',      val: fmtCFA(paidAmount),    bg: '#d1fae5' },
              { icon: '⏳', label: 'En attente',            val: String(pendingCount),  bg: '#fef3c7' },
              { icon: '🔴', label: 'En retard',             val: String(overdueCount),  bg: '#fee2e2' },
            ].map((k, i) => (
              <div key={i} style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '18px 20px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 10 }}>{k.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1209' }}>{k.val}</div>
                <div style={{ fontSize: 14, color: '#a89478', fontWeight: 600, marginTop: 4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10, alignItems: 'center' }}>
              <select value={invStatus} onChange={e => setInvStatus(e.target.value)} style={filterSt}>
                <option value="">Tous les statuts</option>
                <option value="PENDING">En attente</option>
                <option value="PAID">Payées</option>
                <option value="OVERDUE">En retard</option>
                <option value="PARTIAL">Partielles</option>
                <option value="CANCELLED">Annulées</option>
              </select>
              <button style={btnPrim} onClick={() => { setPage(1); fetchInvoices(1) }}>Filtrer</button>
              <span style={{ marginLeft: 'auto', fontSize: 14, color: '#a89478', fontWeight: 600 }}>
                {pag.total} facture{pag.total > 1 ? 's' : ''} · Page {pag.page}/{pag.pages}
              </span>
            </div>

            {invoices.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478', fontSize: 17 }}>
                Aucune facture{invStatus ? ` avec le statut « ${INV_STATUS[invStatus]?.label ?? invStatus} »` : ''}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Élève', 'Plan', 'Montant', 'Statut', 'Payé', 'Date', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
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
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, color: '#1a1209' }}>
                            {inv.student.firstName} {inv.student.lastName}
                          </div>
                        </td>
                        <td style={tdStyle}>{inv.feePlan?.name ?? '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>{fmtCFA(inv.amount)}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: paid > 0 ? '#059669' : '#a89478' }}>
                            {paid > 0 ? fmtCFA(paid) : '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {new Date(inv.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td style={tdStyle}>
                          <button style={btnSecSm} onClick={() => onToast(`Facture ${inv.id.slice(0,8)} — ${inv.status}`, 'info')}>
                            👁 Voir
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {pag.pages > 1 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'center', gap: 8 }}>
                <button style={btnSecSm} disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); fetchInvoices(p) }}>← Préc.</button>
                <span style={{ padding: '6px 14px', fontSize: 15, fontWeight: 700, color: '#6b5c45' }}>
                  {page} / {pag.pages}
                </span>
                <button style={btnSecSm} disabled={page >= pag.pages}
                  onClick={() => { const p = page + 1; setPage(p); fetchInvoices(p) }}>Suiv. →</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal créer plan ── */}
      {createOpen && (
        <ModalOverlay onClose={() => { setCreateOpen(false); setPlanForm(EMPTY_PLAN) }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>Créer un plan de frais</div>
          <div style={sLb}>Nom *</div>
          <input style={sIn} placeholder="Ex: Scolarité 2025-2026 — 3ème" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLb}>Montant (FCFA) *</div>
              <input style={sIn} type="number" min="0" placeholder="75000" value={planForm.amount} onChange={e => setPlanForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <div style={sLb}>Type</div>
              <select style={sIn} value={planForm.feeType} onChange={e => setPlanForm(f => ({ ...f, feeType: e.target.value }))}>
                {FEE_TYPES.map(t => <option key={t} value={t}>{FEE_TYPE_LABEL[t] ?? t}</option>)}
              </select>
            </div>
          </div>
          <div style={sLb}>Description</div>
          <input style={sIn} placeholder="Optionnel" value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} />
          <div style={sLb}>Date d&apos;échéance</div>
          <input style={sIn} type="date" value={planForm.dueDate} onChange={e => setPlanForm(f => ({ ...f, dueDate: e.target.value }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <input type="checkbox" id="refund" checked={planForm.isRefundable} onChange={e => setPlanForm(f => ({ ...f, isRefundable: e.target.checked }))} />
            <label htmlFor="refund" style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}>Remboursable (caution)</label>
          </div>
          {planForm.error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{planForm.error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setCreateOpen(false); setPlanForm(EMPTY_PLAN) }}>Annuler</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: planForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: planForm.loading ? 0.7 : 1 }} onClick={submitCreatePlan} disabled={planForm.loading}>
              {planForm.loading ? 'Création…' : 'Créer le plan'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal modifier plan ── */}
      {modPlan.open && (
        <ModalOverlay onClose={() => setModPlan(EMPTY_MOD_PLAN)}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>Modifier le plan</div>
          <div style={sLb}>Nom *</div>
          <input style={sIn} value={modPlan.name} onChange={e => setModPlan(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLb}>Montant *</div>
              <input style={sIn} type="number" min="0" value={modPlan.amount} onChange={e => setModPlan(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <div style={sLb}>Type</div>
              <select style={sIn} value={modPlan.feeType} onChange={e => setModPlan(f => ({ ...f, feeType: e.target.value }))}>
                {FEE_TYPES.map(t => <option key={t} value={t}>{FEE_TYPE_LABEL[t] ?? t}</option>)}
              </select>
            </div>
          </div>
          <div style={sLb}>Description</div>
          <input style={sIn} value={modPlan.description} onChange={e => setModPlan(f => ({ ...f, description: e.target.value }))} />
          <div style={sLb}>Échéance</div>
          <input style={sIn} type="date" value={modPlan.dueDate} onChange={e => setModPlan(f => ({ ...f, dueDate: e.target.value }))} />
          {modPlan.error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{modPlan.error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setModPlan(EMPTY_MOD_PLAN)}>Annuler</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: modPlan.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: modPlan.loading ? 0.7 : 1 }} onClick={submitModPlan} disabled={modPlan.loading}>
              {modPlan.loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal créer facture individuelle ── */}
      {invoiceOpen && (
        <ModalOverlay onClose={() => { setInvoiceOpen(false); setInvoiceForm(EMPTY_INVOICE) }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>Créer une facture</div>
          {invModalLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 30, height: 30, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
            </div>
          ) : (
            <>
              <div style={sLb}>Élève *</div>
              <select style={sIn} value={invoiceForm.studentId} onChange={e => setInvoiceForm(f => ({ ...f, studentId: e.target.value }))}>
                <option value="">Sélectionner un élève…</option>
                {invStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}{s.studentProfile?.class ? ` — ${s.studentProfile.class.name}` : ''}
                  </option>
                ))}
              </select>
              <div style={sLb}>Plan de frais *</div>
              <select style={sIn} value={invoiceForm.feePlanId} onChange={e => setInvoiceForm(f => ({ ...f, feePlanId: e.target.value }))}>
                <option value="">Sélectionner un plan…</option>
                {invPlans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmtCFA(p.amount)}</option>
                ))}
              </select>
              <div style={sLb}>Description (optionnel)</div>
              <input style={sIn} placeholder="Ex : Frais de scolarité trimestre 1" value={invoiceForm.description} onChange={e => setInvoiceForm(f => ({ ...f, description: e.target.value }))} />
            </>
          )}
          {invoiceForm.error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>
              {invoiceForm.error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => { setInvoiceOpen(false); setInvoiceForm(EMPTY_INVOICE) }}>Annuler</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: invoiceForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: invoiceForm.loading ? 0.7 : 1 }}
              onClick={submitInvoice} disabled={invoiceForm.loading || invModalLoading}>
              {invoiceForm.loading ? 'Création…' : 'Créer la facture'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal générer factures ── */}
      {bulkForm.open && (
        <ModalOverlay onClose={() => setBulkForm(EMPTY_BULK)}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>Générer les factures</div>
          <div style={{ fontSize: 15, color: '#a89478', marginBottom: 22 }}>{bulkForm.planName}</div>
          <div style={sLb}>Année scolaire *</div>
          <select style={sIn} value={bulkForm.academicYearId} onChange={e => setBulkForm(f => ({ ...f, academicYearId: e.target.value }))}>
            <option value="">Sélectionner…</option>
            {bulkForm.years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <div style={{ background: '#fef3c7', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#92400e', fontWeight: 600, marginBottom: 16 }}>
            ⚠️ Une facture sera générée pour chaque élève inscrit. Cette action peut être annulée facture par facture.
          </div>
          {bulkForm.error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{bulkForm.error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setBulkForm(EMPTY_BULK)}>Annuler</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: bulkForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: bulkForm.loading ? 0.7 : 1 }} onClick={submitBulk} disabled={bulkForm.loading}>
              {bulkForm.loading ? 'Génération…' : '🧾 Générer'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '6px 14px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 16, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}

const sLb: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }
const sIn: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }
