'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Calendar, Star, ChevronRight, Loader2, Pencil, FolderOpen, X, Lock, Save, Check } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface AcademicSequence {
  id: string; name: string; type: string; orderIndex: number
  startDate: string | null; endDate: string | null; isCurrent: boolean
}
interface AcademicPeriod {
  id: string; name: string; type: string; orderIndex: number
  startDate: string; endDate: string; isCurrent: boolean
  sequences: AcademicSequence[]
}
interface AcademicYear {
  id: string; name: string
  startDate: string; endDate: string
  isCurrent: boolean; status: string
  periods: AcademicPeriod[]
}

type PStatus = 'done' | 'active' | 'pending'

interface CalSequence {
  id?: string; name: string; type: string; orderIndex: number; startDate: string; endDate: string
}
interface CalPeriode {
  id?: string; name: string; type: 'TRIMESTER' | 'SEMESTER'; orderIndex: number
  startDate: string; endDate: string; sequences: CalSequence[]
}

const STATUS_BADGE: Record<PStatus, { bg: string; color: string }> = {
  done:    { bg: 'var(--green-light)', color: 'var(--green)' },
  active:  { bg: 'var(--amber-light)', color: 'var(--amber)' },
  pending: { bg: 'var(--bg2)', color: 'var(--text2)' },
}

function getPStatus(isCurrent: boolean, startDate: string, endDate: string): PStatus {
  if (isCurrent) return 'active'
  const now = Date.now()
  if (new Date(endDate).getTime() < now) return 'done'
  return 'pending'
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const EMPTY_YEAR = { name: '', startDate: '', endDate: '', loading: false, error: '' }
const EMPTY_CAL = { open: false, yearId: '', yearName: '', periodes: [] as CalPeriode[], loading: false, error: '' }

export default function SectionAcademicYear({ onToast }: Props) {
  const t = useT('admin')
  const [years, setYears]         = useState<AcademicYear[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [openPeriods, setOpenPeriods] = useState<Set<string>>(new Set())
  const [closingId, setClosingId] = useState<string | null>(null)
  const [settingCurrentId, setSettingCurrentId] = useState<string | null>(null)
  const [settingSequenceId, setSettingSequenceId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm]             = useState(EMPTY_YEAR)
  const [calForm, setCalForm]       = useState(EMPTY_CAL)

  const fetchYears = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/academic-years', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.errServer'))
      const list: AcademicYear[] = data.data || []
      setYears(list)
      // Ouvrir automatiquement les périodes de l'année courante
      const current = list.find(y => y.isCurrent)
      if (current) {
        setOpenPeriods(new Set(current.periods.map(p => p.id)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('academic_year.toast.errLoad'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchYears() }, [fetchYears])

  // Rafraîchissement temps réel quand l'assistant IA change la période académique courante.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'academicPeriod') fetchYears()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchYears])

  const togglePeriod = (id: string) => {
    setOpenPeriods(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleClose = async (yearId: string) => {
    if (!confirm(t('academic_year.toast.confirmClose'))) return
    setClosingId(yearId)
    try {
      const checkRes = await fetchApi(`/api/v2/academic-years/${yearId}/pre-close-check`, { method: 'POST', credentials: 'include' })
      const checkData = await checkRes.json()
      if (!checkRes.ok) throw new Error(checkData.message || t('academic_year.toast.checkFailed'))
      const closeRes = await fetchApi(`/api/v2/academic-years/${yearId}/close`, { method: 'POST', credentials: 'include' })
      const closeData = await closeRes.json()
      if (!closeRes.ok) throw new Error(closeData.message || t('academic_year.toast.closeFailed'))
      onToast(t('academic_year.toast.yearClosed'), 'success')
      fetchYears()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academic_year.toast.errClose'), 'error')
    } finally {
      setClosingId(null)
    }
  }

  const handleSetCurrent = async (periodId: string) => {
    setSettingCurrentId(periodId)
    try {
      const res = await fetchApi(`/api/v2/academic-years/periods/${periodId}/set-current`, {
        method: 'PATCH', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.err'))
      onToast(t('academic_year.toast.periodUpdated'), 'success')
      fetchYears()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academic_year.toast.err'), 'error')
    } finally {
      setSettingCurrentId(null)
    }
  }

  const handleSetSequenceCurrent = async (sequenceId: string) => {
    setSettingSequenceId(sequenceId)
    try {
      const res = await fetchApi(`/api/v2/academic-years/sequences/${sequenceId}/set-current`, {
        method: 'PATCH', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.err'))
      onToast(t('academic_year.toast.sequenceUpdated'), 'success')
      fetchYears()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('academic_year.toast.err'), 'error')
    } finally {
      setSettingSequenceId(null)
    }
  }

  const submitCreate = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setForm(f => ({ ...f, error: t('academic_year.toast.requiredFields') })); return
    }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/academic-years', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), startDate: form.startDate, endDate: form.endDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.err'))
      onToast(t('academic_year.toast.yearCreated', { name: form.name }), 'success')
      setCreateOpen(false); setForm(EMPTY_YEAR); fetchYears()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : t('academic_year.toast.err'), loading: false }))
    }
  }

  // ── Calendrier scolaire ─────────────────────────────────────────────────
  const openCalendar = (year: AcademicYear) => {
    setCalForm({
      open: true, yearId: year.id, yearName: year.name, loading: false, error: '',
      periodes: year.periods.map(p => ({
        id: p.id, name: p.name,
        type: p.type as 'TRIMESTER' | 'SEMESTER',
        orderIndex: p.orderIndex,
        startDate: toDateInput(p.startDate),
        endDate: toDateInput(p.endDate),
        sequences: p.sequences.map(s => ({
          id: s.id, name: s.name, type: s.type, orderIndex: s.orderIndex,
          startDate: toDateInput(s.startDate), endDate: toDateInput(s.endDate),
        })),
      })),
    })
  }

  const submitCalendar = async () => {
    for (const p of calForm.periodes) {
      if (!p.name.trim() || !p.startDate || !p.endDate) {
        setCalForm(f => ({ ...f, error: t('academic_year.toast.fillPeriods') })); return
      }
      if (p.startDate >= p.endDate) {
        setCalForm(f => ({ ...f, error: t('academic_year.toast.invalidDates', { name: p.name }) })); return
      }
      for (const s of p.sequences) {
        if (!s.name.trim() || !s.type.trim()) {
          setCalForm(f => ({ ...f, error: t('academic_year.toast.fillSequences') })); return
        }
      }
    }
    setCalForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const body = {
        periodes: calForm.periodes.map(p => ({
          ...(p.id ? { id: p.id } : {}),
          name: p.name.trim(), type: p.type, orderIndex: p.orderIndex,
          startDate: p.startDate, endDate: p.endDate,
          sequences: p.sequences.map(s => ({
            ...(s.id ? { id: s.id } : {}),
            name: s.name.trim(), type: s.type.trim(), orderIndex: s.orderIndex,
            ...(s.startDate ? { startDate: s.startDate } : {}),
            ...(s.endDate ? { endDate: s.endDate } : {}),
          })),
        })),
      }
      const res = await fetchApi(`/api/v2/academic-years/${calForm.yearId}/calendar`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        let errMsg = data.message || t('academic_year.toast.errServer')
        if (res.status === 422 && (errMsg.toLowerCase().includes('archiv')))
          errMsg = t('academic_year.toast.yearArchived')
        else if (res.status === 422)
          errMsg = t('academic_year.toast.invalidPeriodDates')
        setCalForm(f => ({ ...f, error: errMsg, loading: false })); return
      }
      onToast(t('academic_year.toast.calendarUpdated'), 'success')
      setCalForm(EMPTY_CAL); fetchYears()
    } catch (err) {
      setCalForm(f => ({ ...f, error: err instanceof Error ? err.message : t('academic_year.toast.err'), loading: false }))
    }
  }

  const updP = (pi: number, field: string, val: unknown) =>
    setCalForm(f => ({ ...f, periodes: f.periodes.map((p, i) => i === pi ? { ...p, [field]: val } : p) }))

  const updS = (pi: number, si: number, field: string, val: unknown) =>
    setCalForm(f => ({
      ...f,
      periodes: f.periodes.map((p, i) => i !== pi ? p : {
        ...p, sequences: p.sequences.map((s, j) => j !== si ? s : { ...s, [field]: val })
      })
    }))

  const addPeriode = () => setCalForm(f => ({
    ...f,
    periodes: [...f.periodes, { name: '', type: 'TRIMESTER' as const, orderIndex: f.periodes.length + 1, startDate: '', endDate: '', sequences: [] }]
  }))

  const remPeriode = (pi: number) =>
    setCalForm(f => ({ ...f, periodes: f.periodes.filter((_, i) => i !== pi) }))

  const addSeq = (pi: number) => setCalForm(f => ({
    ...f,
    periodes: f.periodes.map((p, i) => i !== pi ? p : {
      ...p, sequences: [...p.sequences, { name: '', type: '', orderIndex: p.sequences.length + 1, startDate: '', endDate: '' }]
    })
  }))

  const remSeq = (pi: number, si: number) => setCalForm(f => ({
    ...f,
    periodes: f.periodes.map((p, i) => i !== pi ? p : { ...p, sequences: p.sequences.filter((_, j) => j !== si) })
  }))

  const currentYear  = years.find(y => y.isCurrent)
  const historyYears = years.filter(y => !y.isCurrent)
  const currentPeriod = currentYear?.periods.find(p => p.isCurrent)
  const currentSeq    = currentPeriod?.sequences.find(s => s.isCurrent)

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>{t('academic_year.title')}</div>
          <div style={sSub}>{t('academic_year.subtitle')}</div>
        </div>
        <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('academic_year.newYear')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <AlertTriangle size={18} strokeWidth={2} />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchYears}
            style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            {t('academic_year.retry')}
          </button>
        </div>
      )}

      {!loading && !error && years.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Calendar size={52} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('academic_year.noYear')}</div>
          <div style={{ fontSize: 16, color: 'var(--text3)', marginBottom: 22 }}>{t('academic_year.noYearHint')}</div>
          <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('academic_year.createYear')}</button>
        </div>
      )}

      {!loading && !error && currentYear && (
        <>
          {/* Bannière année courante */}
          <div style={{
            background: 'linear-gradient(135deg,var(--sidebar) 0%,var(--sidebar2) 60%,var(--sidebar) 100%)',
            borderRadius: 20, padding: '32px 36px', marginBottom: 22,
            border: '1.5px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)', opacity: 0.04, color: 'white', pointerEvents: 'none' }}><Star size={100} fill="white" /></div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                  {t('academic_year.currentYearLabel')}
                </div>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 44, fontWeight: 700, color: 'white', lineHeight: 1 }}>
                  {currentYear.name}
                </div>
                <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', marginTop: 8, fontWeight: 600 }}>
                  {fmtDate(currentYear.startDate)} → {fmtDate(currentYear.endDate)}
                </div>
              </div>
              {currentSeq && (
                <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 800, alignSelf: 'flex-start', marginTop: 8 }}>
                  {t('academic_year.seqInProgress', { name: currentSeq.name })}
                </span>
              )}
            </div>

            {currentPeriod && (
              <div style={{ display: 'flex', gap: 28 }}>
                {[
                  { label: t('academic_year.currentPeriodLabel'), value: currentPeriod.name },
                  { label: t('academic_year.type'), value: currentPeriod.type === 'TRIMESTER' ? t('academic_year.trimesters') : t('academic_year.semesters') },
                  currentSeq ? { label: t('academic_year.sequenceLabel'), value: currentSeq.name } : null,
                ].filter(Boolean).map((m, i) => m && (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>{m.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calendrier scolaire */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden', marginBottom: 22 }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                {t('academic_year.calendarTitle', { name: currentYear.name })}
              </span>
              <button style={btnSecSm} onClick={() => openCalendar(currentYear)}>{t('academic_year.editCalendar')}</button>
            </div>

            {currentYear.periods.length === 0 ? (
              <div style={{ padding: '30px 22px', color: 'var(--text3)', textAlign: 'center' }}>
                {t('academic_year.noPeriod')}
              </div>
            ) : (
              currentYear.periods.map((period) => {
                const ps = getPStatus(period.isCurrent, period.startDate, period.endDate)
                const badge = STATUS_BADGE[ps]
                const open = openPeriods.has(period.id)
                return (
                  <div key={period.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <div
                      onClick={() => togglePeriod(period.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', cursor: 'pointer', userSelect: 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <span style={{ color: 'var(--text3)', transition: 'transform 0.2s', display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}><ChevronRight size={14} /></span>
                      <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{period.name}</span>
                      <span style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600 }}>
                        {fmtDate(period.startDate)} → {fmtDate(period.endDate)}
                      </span>
                      <span style={{ background: badge.bg, color: badge.color, padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                        {t(`academic_year.status.${ps}`)}
                      </span>
                      {!period.isCurrent && (
                        <button
                          style={btnSecSm}
                          onClick={e => { e.stopPropagation(); handleSetCurrent(period.id) }}
                          disabled={settingCurrentId === period.id}>
                          {settingCurrentId === period.id ? <Loader2 size={14} className="animate-spin" /> : t('academic_year.setActive')}
                        </button>
                      )}
                    </div>

                    {open && period.sequences.length > 0 && (
                      <div style={{ padding: '0 22px 20px 22px' }}>
                        <div style={{ borderLeft: '3px solid var(--border)', marginLeft: 10, paddingLeft: 22, display: 'flex', flexDirection: 'column' }}>
                          {period.sequences.map((seq, si) => {
                            const ss = getPStatus(seq.isCurrent, seq.startDate ?? period.startDate, seq.endDate ?? period.endDate)
                            const sb = STATUS_BADGE[ss]
                            return (
                              <div key={seq.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', position: 'relative', borderBottom: si < period.sequences.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                <div style={{ position: 'absolute', left: -30, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, borderRadius: '50%', background: ss === 'done' ? 'var(--green)' : ss === 'active' ? 'var(--amber)' : 'var(--border2)', border: '2px solid white', boxShadow: ss === 'active' ? '0 0 0 4px rgba(217,119,6,0.18)' : 'none' }} />
                                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', minWidth: 120 }}>{seq.name}</span>
                                <span style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600, flex: 1 }}>
                                  {seq.startDate ? `${fmtDate(seq.startDate)} → ${fmtDate(seq.endDate)}` : t('academic_year.noDates')}
                                </span>
                                <span style={{ background: sb.bg, color: sb.color, padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                                  {t(`academic_year.status.${ss}`)}
                                </span>
                                {!seq.isCurrent && (
                                  <button
                                    style={btnSecSm}
                                    onClick={e => { e.stopPropagation(); handleSetSequenceCurrent(seq.id) }}
                                    disabled={settingSequenceId === seq.id}>
                                    {settingSequenceId === seq.id ? <Loader2 size={14} className="animate-spin" /> : t('academic_year.setActiveFem')}
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Historique */}
      {!loading && !error && historyYears.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{t('academic_year.historyTitle')}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{[t('academic_year.thYear'), t('academic_year.thFrom'), t('academic_year.thTo'), t('academic_year.thStatus'), t('academic_year.thActions')].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {historyYears.map((y) => (
                <tr key={y.id}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                  <td style={tdStyle}>
                    <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 800, color: 'var(--text)' }}>{y.name}</div>
                  </td>
                  <td style={tdStyle}>{fmtDate(y.startDate)}</td>
                  <td style={tdStyle}>{fmtDate(y.endDate)}</td>
                  <td style={tdStyle}>
                    <span style={{ background: y.status === 'CLOSED' ? 'var(--bg2)' : 'var(--green-light)', color: y.status === 'CLOSED' ? 'var(--text2)' : 'var(--green)', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                      {y.status === 'CLOSED' ? t('academic_year.archived') : y.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={btnSecSm} onClick={() => onToast(t('academic_year.archivesToast', { name: y.name }), 'info')}>{t('academic_year.view')}</button>
                      <button style={btnSecSm} onClick={() => openCalendar(y)}>{t('academic_year.calendar')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Danger zone — clôture de l'année courante */}
      {!loading && !error && currentYear && (
        <div style={{ background: 'var(--surface)', borderRadius: 18, border: '2px solid rgba(220,38,38,0.2)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 26px', background: 'var(--red-light)', borderBottom: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={22} color="var(--red)" />
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>{t('academic_year.dangerZone')}</div>
          </div>
          <div style={{ padding: '22px 26px' }}>
            <p style={{ fontSize: 17, color: 'var(--text2)', marginBottom: 20, lineHeight: 1.7 }}>
              {t('academic_year.dangerText')}
            </p>
            <button
              style={{ padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'var(--red-light)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: closingId ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: closingId ? 0.6 : 1 }}
              onClick={() => handleClose(currentYear.id)}
              disabled={!!closingId}>
              {closingId ? t('academic_year.closingInProgress') : t('academic_year.closeYear', { name: currentYear.name })}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal calendrier scolaire ── */}
      {calForm.open && (
        <div onClick={() => setCalForm(EMPTY_CAL)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, padding: '32px 36px', width: 720, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('academic_year.calModalTitle')}</div>
            <div style={{ fontSize: 15, color: 'var(--text3)', marginBottom: 24 }}>{calForm.yearName}</div>

            {calForm.periodes.map((p, pi) => (
              <div key={pi} style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: 16 }}>{t('academic_year.periodN', { n: pi + 1 })}</span>
                  <button onClick={() => remPeriode(pi)} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{t('academic_year.delete')}</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10 }}>
                  <div>
                    <div style={sLb}>{t('academic_year.nameReq')}</div>
                    <input style={sIn} value={p.name} onChange={e => updP(pi, 'name', e.target.value)} placeholder={t('academic_year.trimesterPlaceholder')} />
                  </div>
                  <div>
                    <div style={sLb}>{t('academic_year.typeReq')}</div>
                    <select style={sIn} value={p.type} onChange={e => updP(pi, 'type', e.target.value)}>
                      <option value="TRIMESTER">{t('academic_year.trimester')}</option>
                      <option value="SEMESTER">{t('academic_year.semester')}</option>
                    </select>
                  </div>
                  <div>
                    <div style={sLb}>{t('academic_year.order')}</div>
                    <input style={sIn} type="number" min={1} value={p.orderIndex} onChange={e => updP(pi, 'orderIndex', parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={sLb}>{t('academic_year.startDateReq')}</div>
                    <input style={sIn} type="date" value={p.startDate} onChange={e => updP(pi, 'startDate', e.target.value)} />
                  </div>
                  <div>
                    <div style={sLb}>{t('academic_year.endDateReq')}</div>
                    <input style={sIn} type="date" value={p.endDate} onChange={e => updP(pi, 'endDate', e.target.value)} />
                  </div>
                </div>

                <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                  <div style={{ fontWeight: 800, color: 'var(--text2)', fontSize: 14, marginBottom: 10 }}>{t('academic_year.sequences')}</div>
                  {p.sequences.map((seq, si) => (
                    <div key={si} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid var(--bg2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text2)', fontSize: 14 }}>{t('academic_year.sequenceN', { n: si + 1 })}</span>
                        <button onClick={() => remSeq(pi, si)} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center' }}><X size={12} /></button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 8 }}>
                        <div>
                          <div style={sLb}>{t('academic_year.nameReq')}</div>
                          <input style={{ ...sIn, marginBottom: 0 }} value={seq.name} onChange={e => updS(pi, si, 'name', e.target.value)} placeholder={t('academic_year.assignmentPlaceholder')} />
                        </div>
                        <div>
                          <div style={sLb}>{t('academic_year.typeReq')}</div>
                          <input style={{ ...sIn, marginBottom: 0 }} value={seq.type} onChange={e => updS(pi, si, 'type', e.target.value)} placeholder="DS1" />
                        </div>
                        <div>
                          <div style={sLb}>{t('academic_year.order')}</div>
                          <input style={{ ...sIn, marginBottom: 0 }} type="number" min={1} value={seq.orderIndex} onChange={e => updS(pi, si, 'orderIndex', parseInt(e.target.value) || 1)} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                        <div>
                          <div style={sLb}>{t('academic_year.startOptional')}</div>
                          <input style={{ ...sIn, marginBottom: 0 }} type="date" value={seq.startDate} onChange={e => updS(pi, si, 'startDate', e.target.value)} />
                        </div>
                        <div>
                          <div style={sLb}>{t('academic_year.endOptional')}</div>
                          <input style={{ ...sIn, marginBottom: 0 }} type="date" value={seq.endDate} onChange={e => updS(pi, si, 'endDate', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button style={btnSecSm} onClick={() => addSeq(pi)}>{t('academic_year.addSequence')}</button>
                </div>
              </div>
            ))}

            <button style={{ ...btnSecSm, width: '100%', marginBottom: 22 }} onClick={addPeriode}>{t('academic_year.addPeriod')}</button>

            {calForm.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 9, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>{calForm.error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setCalForm(EMPTY_CAL)}>{t('academic_year.cancel')}</button>
              <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: calForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: calForm.loading ? 0.7 : 1 }} onClick={submitCalendar} disabled={calForm.loading}>
                {calForm.loading ? t('academic_year.saving') : t('academic_year.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal créer une année ── */}
      {createOpen && (
        <ModalOverlay onClose={() => { setCreateOpen(false); setForm(EMPTY_YEAR) }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 22 }}>
            {t('academic_year.createYearTitle')}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>{t('academic_year.nameReq')}</div>
          <input
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }}
            placeholder={t('academic_year.yearPlaceholder')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>{t('academic_year.startDateFull')}</div>
              <input type="date"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }}
                value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>{t('academic_year.endDateFull')}</div>
              <input type="date"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }}
                value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          {form.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{form.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => { setCreateOpen(false); setForm(EMPTY_YEAR) }}>{t('academic_year.cancel')}</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: form.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: form.loading ? 0.7 : 1 }}
              onClick={submitCreate} disabled={form.loading}>
              {form.loading ? t('academic_year.creating') : t('academic_year.create')}
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
const btnSecSm: React.CSSProperties = { padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 20px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '15px 20px', fontSize: 17, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

const sLb: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 4, display: 'block' }
const sIn: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10, outline: 'none' }

function toDateInput(d: string | null): string {
  if (!d) return ''
  try { return new Date(d).toISOString().slice(0, 10) }
  catch { return '' }
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, padding: '32px 36px', width: 460, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}
