'use client'
import { useState, useEffect, useCallback } from 'react'
import { CalendarClock, Plus, X, Zap, Loader2, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface AcademicEvent {
  id: string
  type: string
  category: 'FIXED_DATE' | 'MANUAL_TRIGGER' | 'SLIDING_WINDOW'
  title: string
  description: string | null
  targetRoles: string[]
  openDate: string | null
  closeDate: string | null
  status: 'UPCOMING' | 'ACTIVE' | 'CLOSED'
  createdBy?: { firstName: string; lastName: string }
}

const EVENT_TYPES = ['RENTREE_6E_5E', 'MIGRATION_BILINGUE', 'CHOIX_LV2', 'CLOTURE_ANNEE', 'AUTRE']
const ROLES = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT']

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  UPCOMING: { bg: 'var(--blue-light)', color: 'var(--blue)' },
  ACTIVE: { bg: 'var(--green-light)', color: 'var(--green)' },
  CLOSED: { bg: 'var(--bg2)', color: 'var(--text3)' },
}
const CATEGORY_COLOR: Record<string, { bg: string; color: string }> = {
  FIXED_DATE: { bg: 'var(--purple-light)', color: 'var(--purple)' },
  MANUAL_TRIGGER: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  SLIDING_WINDOW: { bg: 'var(--teal-light)', color: 'var(--teal)' },
}

export default function SectionAdminAcademicEvents({ onToast }: Props) {
  const t = useT('admin')
  const [events, setEvents] = useState<AcademicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  const [adjustDate, setAdjustDate] = useState('')

  const [form, setForm] = useState({
    type: 'RENTREE_6E_5E', category: 'FIXED_DATE' as AcademicEvent['category'],
    title: '', description: '', targetRoles: ['ADMIN'] as string[],
    openDate: '', closeDate: '',
  })

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/academic-events', { credentials: 'include' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || t('academicEvents.errorLoad'))
      setEvents(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('academicEvents.errorLoad'))
    } finally { setLoading(false) }
  }, [t])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const toggleRole = (role: string) => {
    setForm(f => ({ ...f, targetRoles: f.targetRoles.includes(role) ? f.targetRoles.filter(r => r !== role) : [...f.targetRoles, role] }))
  }

  const submitCreate = async () => {
    if (!form.title.trim()) { onToast(t('academicEvents.toastTitleRequired'), 'warning'); return }
    if (form.category === 'FIXED_DATE' && (!form.openDate || !form.closeDate)) { onToast(t('academicEvents.toastDatesRequired'), 'warning'); return }
    if (form.category === 'SLIDING_WINDOW' && !form.openDate) { onToast(t('academicEvents.toastOpenRequired'), 'warning'); return }

    setSubmitting(true)
    try {
      const res = await fetchApi('/api/v2/academic-events', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          openDate: form.openDate || undefined,
          closeDate: form.closeDate || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('academicEvents.toastCreated'), 'success')
      setFormOpen(false)
      setForm({ type: 'RENTREE_6E_5E', category: 'FIXED_DATE', title: '', description: '', targetRoles: ['ADMIN'], openDate: '', closeDate: '' })
      fetchEvents()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    } finally { setSubmitting(false) }
  }

  const declencher = async (id: string) => {
    try {
      const res = await fetchApi(`/api/v2/academic-events/${id}/trigger`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('academicEvents.toastTriggered'), 'success')
      fetchEvents()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    }
  }

  const ajuster = async (id: string) => {
    if (!adjustDate) return
    try {
      const res = await fetchApi(`/api/v2/academic-events/${id}/window`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closeDate: adjustDate }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message)
      onToast(t('academicEvents.toastAdjusted'), 'success')
      setAdjustingId(null); setAdjustDate('')
      fetchEvents()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academicEvents.errorLoad'), 'error')
    }
  }

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const total = events.length
  const actifs = events.filter(e => e.status === 'ACTIVE').length
  const aVenir = events.filter(e => e.status === 'UPCOMING').length
  const clos = events.filter(e => e.status === 'CLOSED').length

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={sTitle}>{t('academicEvents.title')}</div>
          <div style={sSub}>{t('academicEvents.subtitle')}</div>
        </div>
        <button onClick={() => setFormOpen(true)} style={btnPrim}>
          <Plus size={15} strokeWidth={2.5} /> {t('academicEvents.newEvent')}
        </button>
      </div>

      {!loading && !error && events.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { icon: CalendarClock, value: total, label: t('academicEvents.kpiTotal') },
            { icon: Zap, value: actifs, label: t('academicEvents.kpiActive') },
            { icon: Clock, value: aVenir, label: t('academicEvents.kpiUpcoming') },
            { icon: CheckCircle2, value: clos, label: t('academicEvents.kpiClosed') },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '16px 18px' }}>
              <div style={{ marginBottom: 6 }}><Icon size={22} /></div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{value}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <Loader2 size={28} className="animate-spin" color="var(--green)" />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={18} color="var(--red)" /><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchEvents} style={btnRetry}>{t('academicEvents.retry')}</button>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><CalendarClock size={48} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('academicEvents.emptyTitle')}</div>
          <div style={{ fontSize: 16, color: 'var(--text3)' }}>{t('academicEvents.emptySub')}</div>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {events.map(ev => (
            <div key={ev.id} style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{ev.title}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: CATEGORY_COLOR[ev.category]?.bg, color: CATEGORY_COLOR[ev.category]?.color }}>
                    {t(`academicEvents.category.${ev.category}`)}
                  </span>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: STATUS_COLOR[ev.status]?.bg, color: STATUS_COLOR[ev.status]?.color }}>
                    {t(`academicEvents.status.${ev.status}`)}
                  </span>
                </div>
              </div>
              {ev.description && <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 8 }}>{ev.description}</div>}
              <div style={{ fontSize: 13, color: 'var(--text3)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>{t('academicEvents.opensOn')} {fmt(ev.openDate)}</span>
                <span>{t('academicEvents.closesOn')} {fmt(ev.closeDate)}</span>
                <span>{t('academicEvents.roles')} {ev.targetRoles.join(', ')}</span>
              </div>

              {ev.category === 'MANUAL_TRIGGER' && ev.status === 'UPCOMING' && (
                <button onClick={() => declencher(ev.id)} style={{ ...btnPrim, marginTop: 12 }}>
                  <Zap size={14} /> {t('academicEvents.triggerNow')}
                </button>
              )}

              {ev.category === 'SLIDING_WINDOW' && ev.status === 'ACTIVE' && (
                adjustingId === ev.id ? (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
                    <input type="date" value={adjustDate} onChange={e => setAdjustDate(e.target.value)} style={inputSt} />
                    <button onClick={() => ajuster(ev.id)} style={btnPrim}>{t('academicEvents.save')}</button>
                    <button onClick={() => { setAdjustingId(null); setAdjustDate('') }} style={btnSec}>{t('academicEvents.cancel')}</button>
                  </div>
                ) : (
                  <button onClick={() => setAdjustingId(ev.id)} style={{ ...btnSec, marginTop: 12 }}>{t('academicEvents.adjustWindow')}</button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <div onClick={() => setFormOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: 480, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{t('academicEvents.newEvent')}</div>
              <button onClick={() => setFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelSt}>{t('academicEvents.formTitle')}</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inputFullSt} placeholder={t('academicEvents.formTitlePlaceholder')} />
              </div>
              <div>
                <label style={labelSt}>{t('academicEvents.formType')}</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputFullSt}>
                  {EVENT_TYPES.map(ty => <option key={ty} value={ty}>{t(`academicEvents.type.${ty}`)}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>{t('academicEvents.formCategory')}</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as AcademicEvent['category'] }))} style={inputFullSt}>
                  <option value="FIXED_DATE">{t('academicEvents.category.FIXED_DATE')}</option>
                  <option value="MANUAL_TRIGGER">{t('academicEvents.category.MANUAL_TRIGGER')}</option>
                  <option value="SLIDING_WINDOW">{t('academicEvents.category.SLIDING_WINDOW')}</option>
                </select>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{t(`academicEvents.categoryHint.${form.category}`)}</div>
              </div>
              <div>
                <label style={labelSt}>{t('academicEvents.formDescription')}</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputFullSt, minHeight: 60, resize: 'vertical' }} />
              </div>
              <div>
                <label style={labelSt}>{t('academicEvents.formRoles')}</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROLES.map(role => (
                    <button key={role} type="button" onClick={() => toggleRole(role)}
                      style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: '1.5px solid', fontFamily: 'inherit',
                        background: form.targetRoles.includes(role) ? 'var(--green-light)' : 'white',
                        borderColor: form.targetRoles.includes(role) ? 'var(--green)' : 'var(--border2)',
                        color: form.targetRoles.includes(role) ? 'var(--green)' : 'var(--text2)' }}>
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              {form.category !== 'MANUAL_TRIGGER' && (
                <div>
                  <label style={labelSt}>{t('academicEvents.formOpenDate')}</label>
                  <input type="date" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))} style={inputFullSt} />
                </div>
              )}
              {form.category !== 'MANUAL_TRIGGER' && (
                <div>
                  <label style={labelSt}>{t('academicEvents.formCloseDate')}</label>
                  <input type="date" value={form.closeDate} onChange={e => setForm(f => ({ ...f, closeDate: e.target.value }))} style={inputFullSt} />
                </div>
              )}

              <button onClick={submitCreate} disabled={submitting} style={{ ...btnPrim, justifyContent: 'center', marginTop: 8, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {t('academicEvents.create')}
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
const btnPrim: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnSec: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const labelSt: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 5 }
const inputFullSt: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--border2)', fontSize: 15, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--bg2)', outline: 'none', boxSizing: 'border-box' }
const inputSt: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--border2)', fontSize: 14, fontFamily: 'inherit', color: 'var(--text)', background: 'var(--bg2)', outline: 'none' }
