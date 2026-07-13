'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Wallet, Pencil, CheckCircle2, Loader2, Circle } from 'lucide-react'

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
  const t = useT('finance')
  const getInvStatus = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      PENDING:    { bg: 'var(--amber-light)', color: 'var(--amber)', label: t('invoice_status.PENDING') },
      PAID:       { bg: 'var(--green-light)', color: 'var(--green)', label: t('invoice_status.PAID') },
      OVERDUE:    { bg: 'var(--red-light)', color: 'var(--red)', label: t('invoice_status.OVERDUE') },
      CANCELLED:  { bg: 'var(--bg2)', color: 'var(--text2)', label: t('invoice_status.CANCELLED') },
      PARTIAL:    { bg: 'var(--blue-light)', color: 'var(--blue)', label: t('invoice_status.PARTIAL') },
    }
    return styles[status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: status }
  }
  const FEE_TYPE_LABEL: Record<string, string> = {
    TUITION:      t('fee_type.TUITION'),
    REGISTRATION: t('fee_type.REGISTRATION'),
    EXAM:         t('fee_type.EXAM'),
    UNIFORM:      t('fee_type.UNIFORM'),
    TRANSPORT:    t('fee_type.TRANSPORT'),
    CAUTION:      t('fee_type.CAUTION'),
    OTHER:        t('fee_type.OTHER'),
  }

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.server_error'))
      setPlans(data.data || [])
    } catch (err) { setError(err instanceof Error ? err.message : t('errors.generic_error')) }
    finally { setLoading(false) }
  }, [])

  const fetchInvoices = useCallback(async (pg = page) => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ limit: '20', page: String(pg) })
      if (invStatus) params.set('status', invStatus)
      const res = await fetchApi(`/api/v2/finance/invoices?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.server_error'))
      setInvoices(data.data || [])
      setPag(data.pagination ?? { total: 0, page: pg, pages: 1 })
    } catch (err) { setError(err instanceof Error ? err.message : t('errors.generic_error')) }
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
    if (!planForm.name.trim() || !planForm.amount) { setPlanForm(f => ({ ...f, error: t('errors.name_and_amount_required') })); return }
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
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))
      onToast(t('toasts.plan_created').replace('{name}', planForm.name), 'success')
      setCreateOpen(false); setPlanForm(EMPTY_PLAN); fetchPlans()
    } catch (err) {
      setPlanForm(f => ({ ...f, error: err instanceof Error ? err.message : t('errors.generic_error'), loading: false }))
    }
  }

  // ── Modifier plan (désactivé — route backend non disponible) ───────────
  const openModPlan = (_plan: FeePlan) => {
    onToast(t('toasts.feature_coming_soon'), 'info')
  }

  const submitModPlan = async () => {
    if (!modPlan.name.trim() || !modPlan.amount) { setModPlan(f => ({ ...f, error: t('errors.name_and_amount_required') })); return }
    setModPlan(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/finance/fee-plans/${modPlan.planId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modPlan.name.trim(), amount: parseFloat(modPlan.amount), feeType: modPlan.feeType, description: modPlan.description || undefined, dueDate: modPlan.dueDate || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))
      onToast(t('toasts.plan_modified'), 'success')
      setModPlan(EMPTY_MOD_PLAN); fetchPlans()
    } catch (err) {
      setModPlan(f => ({ ...f, error: err instanceof Error ? err.message : t('errors.generic_error'), loading: false }))
    }
  }

  // ── Générer factures en masse ────────────────────────────────────────────
  const openBulk = async (plan: FeePlan) => {
    const years = await fetchYearsForBulk()
    setBulkForm({ open: true, planId: plan.id, planName: plan.name, academicYearId: years[0]?.id ?? '', loading: false, error: '', years })
  }

  const submitBulk = async () => {
    if (!bulkForm.academicYearId) { setBulkForm(f => ({ ...f, error: t('errors.select_year') })); return }
    setBulkForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/finance/invoices/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feePlanId: bulkForm.planId, academicYearId: bulkForm.academicYearId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))
      onToast(t('toasts.invoices_generated').replace('{count}', String(data.count ?? 0)), 'success')
      setBulkForm(EMPTY_BULK); setTab('invoices'); fetchInvoices(1)
    } catch (err) {
      setBulkForm(f => ({ ...f, error: err instanceof Error ? err.message : t('errors.generic_error'), loading: false }))
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
      setInvoiceForm(f => ({ ...f, error: t('errors.select_student_and_plan') })); return
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
        let errMsg = data.message || t('errors.server_error')
        if (res.status === 409)
          errMsg = t('errors.payment_in_progress')
        else if (res.status === 422 && code === 'SEUIL_LEGAL_DEPASSE')
          errMsg = t('errors.legal_threshold_exceeded')
        else if (res.status === 403 && code === 'SEPARATION_ORDONNATEUR')
          errMsg = t('errors.separation_ordinator')
        setInvoiceForm(f => ({ ...f, error: errMsg, loading: false })); return
      }
      onToast(t('toasts.invoice_created'), 'success')
      setInvoiceOpen(false); setInvoiceForm(EMPTY_INVOICE)
      if (tab === 'invoices') fetchInvoices(1)
    } catch (err) {
      setInvoiceForm(f => ({ ...f, error: err instanceof Error ? err.message : t('errors.generic_error'), loading: false }))
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
          <div style={sTitle}>{t('title')}</div>
          <div style={sSub}>{t('subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ padding: '10px 18px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'var(--surface)', color: 'var(--green)', border: '1.5px solid rgba(5,150,105,0.35)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={openInvoiceModal}>{t('actions.create_invoice')}</button>
          <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('actions.new_plan')}</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg2)', padding: 5, borderRadius: 12, marginBottom: 22, width: 'fit-content' }}>
        {(['plans', 'invoices'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            style={{ padding: '8px 20px', borderRadius: 9, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: tab === tabKey ? 'white' : 'transparent', color: tab === tabKey ? 'var(--text)' : 'var(--text3)', boxShadow: tab === tabKey ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}>
            {tabKey === 'plans' ? t('tabs.plans') : t('tabs.invoices')}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={16} strokeWidth={2} />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={() => tab === 'plans' ? fetchPlans() : fetchInvoices(page)}
            style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            {t('actions.retry')}
          </button>
        </div>
      )}

      {/* Plans de frais */}
      {!loading && !error && tab === 'plans' && (
        <>
          {plans.length === 0 ? (
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Wallet size={52} strokeWidth={1.5} /></div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('empty_states.no_plans_title')}</div>
              <div style={{ fontSize: 16, color: 'var(--text3)', marginBottom: 22 }}>
                {t('empty_states.no_plans_description')}
              </div>
              <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('empty_states.no_plans_action')}</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              {plans.map((plan) => (
                <div key={plan.id} style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 22, transition: 'all 0.15s' }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                      {plan.name}
                    </div>
                    <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700, flexShrink: 0, marginLeft: 8 }}>
                      {FEE_TYPE_LABEL[plan.feeType] ?? plan.feeType}
                    </span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--green)', marginBottom: 8 }}>
                    {fmtCFA(plan.amount)}
                  </div>
                  {plan.description && (
                    <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>{plan.description}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    {plan.level && (
                      <span style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '2px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                        {t('badges.level').replace('{level}', plan.level)}
                      </span>
                    )}
                    {plan.isRefundable && (
                      <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                        {t('badges.refundable')}
                      </span>
                    )}
                    {plan.dueDate && (
                      <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '2px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                        {t('badges.due_date').replace('{date}', new Date(plan.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }))}
                      </span>
                    )}
                  </div>
                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                    <button style={btnSecSm} onClick={() => openBulk(plan)}>{t('actions.generate_invoices')}</button>
                    <button style={btnSecSm} onClick={() => openModPlan(plan)}><Pencil size={14} strokeWidth={2} /></button>
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
              { icon: <Wallet size={20} strokeWidth={2} />, label: t('kpi.total_billed'),        val: fmtCFA(totalAmount),   bg: 'var(--blue-light)' },
              { icon: <CheckCircle2 size={20} strokeWidth={2} />, label: t('kpi.total_collected'),      val: fmtCFA(paidAmount),    bg: 'var(--green-light)' },
              { icon: <Loader2 size={20} strokeWidth={2} />, label: t('kpi.pending'),             val: String(pendingCount),  bg: 'var(--amber-light)' },
              { icon: <Circle size={12} fill="var(--red)" stroke="none" />, label: t('kpi.overdue'),             val: String(overdueCount),  bg: 'var(--red-light)' },
            ].map((k, i) => (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '18px 20px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 10 }}>{k.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{k.val}</div>
                <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <select value={invStatus} onChange={e => setInvStatus(e.target.value)} style={filterSt}>
                <option value="">{t('filters.all_statuses')}</option>
                <option value="PENDING">{t('filters.pending')}</option>
                <option value="PAID">{t('filters.paid')}</option>
                <option value="OVERDUE">{t('filters.overdue')}</option>
                <option value="PARTIAL">{t('filters.partial')}</option>
                <option value="CANCELLED">{t('filters.cancelled')}</option>
              </select>
              <button style={btnPrim} onClick={() => { setPage(1); fetchInvoices(1) }}>{t('actions.filter')}</button>
              <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>
                {t('totals.factures').replace('{count}', String(pag.total))} · {t('totals.page_info').replace('{page}', String(pag.page)).replace('{pages}', String(pag.pages))}
              </span>
            </div>

            {invoices.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 17 }}>
                {invStatus ? t('empty_states.no_invoices_with_status').replace('{status}', getInvStatus(invStatus).label) : t('empty_states.no_invoices')}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{[t('table_headers.student'), t('table_headers.plan'), t('table_headers.amount'), t('table_headers.status'), t('table_headers.paid'), t('table_headers.date'), t('table_headers.actions')].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const st = getInvStatus(inv.status)
                    const paid = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
                    return (
                      <tr key={inv.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                            {inv.student.firstName} {inv.student.lastName}
                          </div>
                        </td>
                        <td style={tdStyle}>{inv.feePlan?.name ?? '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>{fmtCFA(inv.amount)}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                            {paid > 0 ? fmtCFA(paid) : '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {new Date(inv.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </td>
                        <td style={tdStyle}>
                          <button style={btnSecSm} onClick={() => onToast(`Facture ${inv.id.slice(0,8)} — ${inv.status}`, 'info')}>
                            {t('actions.view')}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            {pag.pages > 1 && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 8 }}>
                <button style={btnSecSm} disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); fetchInvoices(p) }}>{t('pagination.previous')}</button>
                <span style={{ padding: '6px 14px', fontSize: 15, fontWeight: 700, color: 'var(--text2)' }}>
                  {page} / {pag.pages}
                </span>
                <button style={btnSecSm} disabled={page >= pag.pages}
                  onClick={() => { const p = page + 1; setPage(p); fetchInvoices(p) }}>{t('pagination.next')}</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal créer plan ── */}
      {createOpen && (
        <ModalOverlay onClose={() => { setCreateOpen(false); setPlanForm(EMPTY_PLAN) }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 22 }}>{t('modals.create_fee_plan.title')}</div>
          <div style={sLb}>{t('modals.create_fee_plan.name_label')}</div>
          <input style={sIn} placeholder={t('modals.create_fee_plan.name_placeholder')} value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLb}>{t('modals.create_fee_plan.amount_label')}</div>
              <input style={sIn} type="number" min="0" placeholder={t('modals.create_fee_plan.amount_placeholder')} value={planForm.amount} onChange={e => setPlanForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <div style={sLb}>{t('modals.create_fee_plan.type_label')}</div>
              <select style={sIn} value={planForm.feeType} onChange={e => setPlanForm(f => ({ ...f, feeType: e.target.value }))}>
                {FEE_TYPES.map(t => <option key={t} value={t}>{FEE_TYPE_LABEL[t] ?? t}</option>)}
              </select>
            </div>
          </div>
          <div style={sLb}>{t('modals.create_fee_plan.description_label')}</div>
          <input style={sIn} placeholder={t('modals.create_fee_plan.description_placeholder')} value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} />
          <div style={sLb}>{t('modals.create_fee_plan.due_date_label')}</div>
          <input style={sIn} type="date" value={planForm.dueDate} onChange={e => setPlanForm(f => ({ ...f, dueDate: e.target.value }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <input type="checkbox" id="refund" checked={planForm.isRefundable} onChange={e => setPlanForm(f => ({ ...f, isRefundable: e.target.checked }))} />
            <label htmlFor="refund" style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{t('modals.create_fee_plan.refundable_label')}</label>
          </div>
          {planForm.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{planForm.error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setCreateOpen(false); setPlanForm(EMPTY_PLAN) }}>{t('actions.cancel')}</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: planForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: planForm.loading ? 0.7 : 1 }} onClick={submitCreatePlan} disabled={planForm.loading}>
              {planForm.loading ? t('loading.creating') : t('actions.create_plan')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal modifier plan ── */}
      {modPlan.open && (
        <ModalOverlay onClose={() => setModPlan(EMPTY_MOD_PLAN)}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 22 }}>{t('modals.edit_fee_plan.title')}</div>
          <div style={sLb}>{t('modals.edit_fee_plan.name_label')}</div>
          <input style={sIn} value={modPlan.name} onChange={e => setModPlan(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLb}>{t('modals.edit_fee_plan.amount_label')}</div>
              <input style={sIn} type="number" min="0" value={modPlan.amount} onChange={e => setModPlan(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <div style={sLb}>{t('modals.edit_fee_plan.type_label')}</div>
              <select style={sIn} value={modPlan.feeType} onChange={e => setModPlan(f => ({ ...f, feeType: e.target.value }))}>
                {FEE_TYPES.map(t => <option key={t} value={t}>{FEE_TYPE_LABEL[t] ?? t}</option>)}
              </select>
            </div>
          </div>
          <div style={sLb}>{t('modals.edit_fee_plan.description_label')}</div>
          <input style={sIn} value={modPlan.description} onChange={e => setModPlan(f => ({ ...f, description: e.target.value }))} />
          <div style={sLb}>{t('modals.edit_fee_plan.due_date_label')}</div>
          <input style={sIn} type="date" value={modPlan.dueDate} onChange={e => setModPlan(f => ({ ...f, dueDate: e.target.value }))} />
          {modPlan.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{modPlan.error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setModPlan(EMPTY_MOD_PLAN)}>{t('actions.cancel')}</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: modPlan.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: modPlan.loading ? 0.7 : 1 }} onClick={submitModPlan} disabled={modPlan.loading}>
              {modPlan.loading ? t('loading.saving') : t('actions.save')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal créer facture individuelle ── */}
      {invoiceOpen && (
        <ModalOverlay onClose={() => { setInvoiceOpen(false); setInvoiceForm(EMPTY_INVOICE) }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 22 }}>{t('modals.create_invoice.title')}</div>
          {invModalLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <div style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
            </div>
          ) : (
            <>
              <div style={sLb}>{t('modals.create_invoice.student_label')}</div>
              <select style={sIn} value={invoiceForm.studentId} onChange={e => setInvoiceForm(f => ({ ...f, studentId: e.target.value }))}>
                <option value="">{t('modals.create_invoice.student_placeholder')}</option>
                {invStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}{s.studentProfile?.class ? ` — ${s.studentProfile.class.name}` : ''}
                  </option>
                ))}
              </select>
              <div style={sLb}>{t('modals.create_invoice.plan_label')}</div>
              <select style={sIn} value={invoiceForm.feePlanId} onChange={e => setInvoiceForm(f => ({ ...f, feePlanId: e.target.value }))}>
                <option value="">{t('modals.create_invoice.plan_placeholder')}</option>
                {invPlans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmtCFA(p.amount)}</option>
                ))}
              </select>
              <div style={sLb}>{t('modals.create_invoice.description_label')}</div>
              <input style={sIn} placeholder={t('modals.create_invoice.description_placeholder')} value={invoiceForm.description} onChange={e => setInvoiceForm(f => ({ ...f, description: e.target.value }))} />
            </>
          )}
          {invoiceForm.error && (
            <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 10, lineHeight: 1.5 }}>
              {invoiceForm.error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => { setInvoiceOpen(false); setInvoiceForm(EMPTY_INVOICE) }}>{t('actions.cancel')}</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: invoiceForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: invoiceForm.loading ? 0.7 : 1 }}
              onClick={submitInvoice} disabled={invoiceForm.loading || invModalLoading}>
              {invoiceForm.loading ? t('loading.creating') : t('actions.create_invoice_action')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal générer factures ── */}
      {bulkForm.open && (
        <ModalOverlay onClose={() => setBulkForm(EMPTY_BULK)}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('modals.bulk_generate.title')}</div>
          <div style={{ fontSize: 15, color: 'var(--text3)', marginBottom: 22 }}>{bulkForm.planName}</div>
          <div style={sLb}>{t('modals.bulk_generate.year_label')}</div>
          <select style={sIn} value={bulkForm.academicYearId} onChange={e => setBulkForm(f => ({ ...f, academicYearId: e.target.value }))}>
            <option value="">{t('modals.bulk_generate.year_placeholder')}</option>
            {bulkForm.years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <div style={{ background: 'var(--amber-light)', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: 'var(--amber)', fontWeight: 600, marginBottom: 16 }}>
            {t('modals.bulk_generate.warning')}
          </div>
          {bulkForm.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{bulkForm.error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setBulkForm(EMPTY_BULK)}>{t('actions.cancel')}</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: bulkForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: bulkForm.loading ? 0.7 : 1 }} onClick={submitBulk} disabled={bulkForm.loading}>
              {bulkForm.loading ? t('loading.generating') : t('actions.generate')}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '6px 14px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 16, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, padding: '32px 36px', width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}

const sLb: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }
const sIn: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }
