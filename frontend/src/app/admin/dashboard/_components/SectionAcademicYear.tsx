'use client'
import { useState, useEffect, useCallback } from 'react'

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

const STATUS_BADGE: Record<PStatus, { bg: string; color: string; label: string }> = {
  done:    { bg: '#d1fae5', color: '#065f46', label: '✓ Terminé'  },
  active:  { bg: '#fef3c7', color: '#92400e', label: '⏳ En cours' },
  pending: { bg: '#f1f5f9', color: '#475569', label: 'À venir'    },
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
      const res = await fetch('/api/v2/academic-years', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      const list: AcademicYear[] = data.data || []
      setYears(list)
      // Ouvrir automatiquement les périodes de l'année courante
      const current = list.find(y => y.isCurrent)
      if (current) {
        setOpenPeriods(new Set(current.periods.map(p => p.id)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchYears() }, [fetchYears])

  const togglePeriod = (id: string) => {
    setOpenPeriods(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleClose = async (yearId: string) => {
    if (!confirm('Clôturer cette année ? Cette action est irréversible.')) return
    setClosingId(yearId)
    try {
      const checkRes = await fetch(`/api/v2/academic-years/${yearId}/pre-close-check`, { method: 'POST', credentials: 'include' })
      const checkData = await checkRes.json()
      if (!checkRes.ok) throw new Error(checkData.message || 'Vérification échouée')
      const closeRes = await fetch(`/api/v2/academic-years/${yearId}/close`, { method: 'POST', credentials: 'include' })
      const closeData = await closeRes.json()
      if (!closeRes.ok) throw new Error(closeData.message || 'Clôture échouée')
      onToast('Année scolaire clôturée', 'success')
      fetchYears()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de clôture', 'error')
    } finally {
      setClosingId(null)
    }
  }

  const handleSetCurrent = async (periodId: string) => {
    setSettingCurrentId(periodId)
    try {
      const res = await fetch(`/api/v2/academic-years/periods/${periodId}/set-current`, {
        method: 'PATCH', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Trimestre actif mis à jour', 'success')
      fetchYears()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSettingCurrentId(null)
    }
  }

  const handleSetSequenceCurrent = async (sequenceId: string) => {
    setSettingSequenceId(sequenceId)
    try {
      const res = await fetch(`/api/v2/academic-years/sequences/${sequenceId}/set-current`, {
        method: 'PATCH', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Séquence active mise à jour', 'success')
      fetchYears()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSettingSequenceId(null)
    }
  }

  const submitCreate = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      setForm(f => ({ ...f, error: 'Nom, date de début et date de fin obligatoires' })); return
    }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch('/api/v2/academic-years', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), startDate: form.startDate, endDate: form.endDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Année scolaire "${form.name}" créée`, 'success')
      setCreateOpen(false); setForm(EMPTY_YEAR); fetchYears()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
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
        setCalForm(f => ({ ...f, error: 'Veuillez remplir tous les champs obligatoires des périodes.' })); return
      }
      if (p.startDate >= p.endDate) {
        setCalForm(f => ({ ...f, error: `Les dates de "${p.name}" sont invalides : la date de début doit être avant la date de fin.` })); return
      }
      for (const s of p.sequences) {
        if (!s.name.trim() || !s.type.trim()) {
          setCalForm(f => ({ ...f, error: 'Veuillez remplir le nom et le type de toutes les séquences.' })); return
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
      const res = await fetch(`/api/v2/academic-years/${calForm.yearId}/calendar`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        let errMsg = data.message || 'Erreur serveur'
        if (res.status === 422 && (errMsg.toLowerCase().includes('archiv')))
          errMsg = 'Cette année est archivée et ne peut plus être modifiée.'
        else if (res.status === 422)
          errMsg = "Les dates d'une période sont invalides : la date de début doit être avant la date de fin."
        setCalForm(f => ({ ...f, error: errMsg, loading: false })); return
      }
      onToast('Calendrier mis à jour', 'success')
      setCalForm(EMPTY_CAL); fetchYears()
    } catch (err) {
      setCalForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
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
          <div style={sTitle}>Année scolaire</div>
          <div style={sSub}>Gestion des années, périodes et séquences</div>
        </div>
        <button style={btnPrim} onClick={() => setCreateOpen(true)}>+ Nouvelle année</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <span>⚠️</span>
          <span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={fetchYears}
            style={{ padding: '7px 16px', borderRadius: 9, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && years.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucune année scolaire</div>
          <div style={{ fontSize: 16, color: '#a89478', marginBottom: 22 }}>Créez votre première année scolaire.</div>
          <button style={btnPrim} onClick={() => setCreateOpen(true)}>+ Créer une année</button>
        </div>
      )}

      {!loading && !error && currentYear && (
        <>
          {/* Bannière année courante */}
          <div style={{
            background: 'linear-gradient(135deg,#1a2e1e 0%,#243b29 60%,#1a3520 100%)',
            borderRadius: 20, padding: '32px 36px', marginBottom: 22,
            border: '1.5px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)', fontSize: 100, opacity: 0.04, color: 'white', pointerEvents: 'none' }}>★</div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
                  Année en cours
                </div>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 44, fontWeight: 700, color: 'white', lineHeight: 1 }}>
                  {currentYear.name}
                </div>
                <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', marginTop: 8, fontWeight: 600 }}>
                  {fmtDate(currentYear.startDate)} → {fmtDate(currentYear.endDate)}
                </div>
              </div>
              {currentSeq && (
                <span style={{ background: '#fef3c7', color: '#92400e', padding: '6px 16px', borderRadius: 20, fontSize: 14, fontWeight: 800, alignSelf: 'flex-start', marginTop: 8 }}>
                  ⏳ {currentSeq.name} en cours
                </span>
              )}
            </div>

            {currentPeriod && (
              <div style={{ display: 'flex', gap: 28 }}>
                {[
                  { label: 'Période en cours', value: currentPeriod.name },
                  { label: 'Type', value: currentPeriod.type === 'TRIMESTER' ? '3 Trimestres' : '2 Semestres' },
                  currentSeq ? { label: 'Séquence', value: currentSeq.name } : null,
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
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginBottom: 22 }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>
                📅 Calendrier scolaire — {currentYear.name}
              </span>
              <button style={btnSecSm} onClick={() => openCalendar(currentYear)}>✏️ Modifier le calendrier</button>
            </div>

            {currentYear.periods.length === 0 ? (
              <div style={{ padding: '30px 22px', color: '#a89478', textAlign: 'center' }}>
                Aucune période configurée
              </div>
            ) : (
              currentYear.periods.map((period) => {
                const ps = getPStatus(period.isCurrent, period.startDate, period.endDate)
                const badge = STATUS_BADGE[ps]
                const open = openPeriods.has(period.id)
                return (
                  <div key={period.id} style={{ borderBottom: '1px solid #e8e0d4' }}>
                    <div
                      onClick={() => togglePeriod(period.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', cursor: 'pointer', userSelect: 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f7f3ee'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <span style={{ fontSize: 14, color: '#a89478', transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>▶</span>
                      <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209', flex: 1 }}>{period.name}</span>
                      <span style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>
                        {fmtDate(period.startDate)} → {fmtDate(period.endDate)}
                      </span>
                      <span style={{ background: badge.bg, color: badge.color, padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                        {badge.label}
                      </span>
                      {!period.isCurrent && (
                        <button
                          style={btnSecSm}
                          onClick={e => { e.stopPropagation(); handleSetCurrent(period.id) }}
                          disabled={settingCurrentId === period.id}>
                          {settingCurrentId === period.id ? '⏳' : 'Définir comme actif'}
                        </button>
                      )}
                    </div>

                    {open && period.sequences.length > 0 && (
                      <div style={{ padding: '0 22px 20px 22px' }}>
                        <div style={{ borderLeft: '3px solid #e8e0d4', marginLeft: 10, paddingLeft: 22, display: 'flex', flexDirection: 'column' }}>
                          {period.sequences.map((seq, si) => {
                            const ss = getPStatus(seq.isCurrent, seq.startDate ?? period.startDate, seq.endDate ?? period.endDate)
                            const sb = STATUS_BADGE[ss]
                            return (
                              <div key={seq.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', position: 'relative', borderBottom: si < period.sequences.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                                <div style={{ position: 'absolute', left: -30, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, borderRadius: '50%', background: ss === 'done' ? '#059669' : ss === 'active' ? '#d97706' : '#d4c8b8', border: '2px solid white', boxShadow: ss === 'active' ? '0 0 0 4px rgba(217,119,6,0.18)' : 'none' }} />
                                <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1209', minWidth: 120 }}>{seq.name}</span>
                                <span style={{ fontSize: 15, color: '#a89478', fontWeight: 600, flex: 1 }}>
                                  {seq.startDate ? `${fmtDate(seq.startDate)} → ${fmtDate(seq.endDate)}` : 'Dates non définies'}
                                </span>
                                <span style={{ background: sb.bg, color: sb.color, padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                                  {sb.label}
                                </span>
                                {!seq.isCurrent && (
                                  <button
                                    style={btnSecSm}
                                    onClick={e => { e.stopPropagation(); handleSetSequenceCurrent(seq.id) }}
                                    disabled={settingSequenceId === seq.id}>
                                    {settingSequenceId === seq.id ? '⏳' : 'Définir comme active'}
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
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginBottom: 22 }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>🗂️ Historique des années</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Année', 'Du', 'Au', 'Statut', 'Actions'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {historyYears.map((y) => (
                <tr key={y.id}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                  <td style={tdStyle}>
                    <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 800, color: '#1a1209' }}>{y.name}</div>
                  </td>
                  <td style={tdStyle}>{fmtDate(y.startDate)}</td>
                  <td style={tdStyle}>{fmtDate(y.endDate)}</td>
                  <td style={tdStyle}>
                    <span style={{ background: y.status === 'CLOSED' ? '#f1f5f9' : '#d1fae5', color: y.status === 'CLOSED' ? '#475569' : '#065f46', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                      {y.status === 'CLOSED' ? 'Archivée' : y.status}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={btnSecSm} onClick={() => onToast(`Archives ${y.name}`, 'info')}>📂 Voir</button>
                      <button style={btnSecSm} onClick={() => openCalendar(y)}>📅 Calendrier</button>
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
        <div style={{ background: 'white', borderRadius: 18, border: '2px solid rgba(220,38,38,0.2)', overflow: 'hidden' }}>
          <div style={{ padding: '20px 26px', background: '#fee2e2', borderBottom: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>Zone de danger — Actions irréversibles</div>
          </div>
          <div style={{ padding: '22px 26px' }}>
            <p style={{ fontSize: 17, color: '#6b5c45', marginBottom: 20, lineHeight: 1.7 }}>
              La clôture de l&apos;année est définitive. Toutes les données seront archivées et l&apos;accès sera verrouillé.
              Assurez-vous que tous les bulletins ont été générés et validés avant de procéder.
            </p>
            <button
              style={{ padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: '#fee2e2', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: closingId ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: closingId ? 0.6 : 1 }}
              onClick={() => handleClose(currentYear.id)}
              disabled={!!closingId}>
              {closingId ? '⏳ Clôture en cours…' : `🔒 Clôturer l'année ${currentYear.name}`}
            </button>
          </div>
        </div>
      )}

      {/* ── Modal calendrier scolaire ── */}
      {calForm.open && (
        <div onClick={() => setCalForm(EMPTY_CAL)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 720, maxWidth: '96vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 4 }}>Calendrier scolaire</div>
            <div style={{ fontSize: 15, color: '#a89478', marginBottom: 24 }}>{calForm.yearName}</div>

            {calForm.periodes.map((p, pi) => (
              <div key={pi} style={{ border: '1.5px solid #e8e0d4', borderRadius: 12, padding: 18, marginBottom: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontWeight: 800, color: '#1a1209', fontSize: 16 }}>Période {pi + 1}</span>
                  <button onClick={() => remPeriode(pi)} style={{ padding: '4px 10px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Supprimer</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10 }}>
                  <div>
                    <div style={sLb}>Nom *</div>
                    <input style={sIn} value={p.name} onChange={e => updP(pi, 'name', e.target.value)} placeholder="Trimestre 1" />
                  </div>
                  <div>
                    <div style={sLb}>Type *</div>
                    <select style={sIn} value={p.type} onChange={e => updP(pi, 'type', e.target.value)}>
                      <option value="TRIMESTER">Trimestre</option>
                      <option value="SEMESTER">Semestre</option>
                    </select>
                  </div>
                  <div>
                    <div style={sLb}>Ordre</div>
                    <input style={sIn} type="number" min={1} value={p.orderIndex} onChange={e => updP(pi, 'orderIndex', parseInt(e.target.value) || 1)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <div style={sLb}>Date début *</div>
                    <input style={sIn} type="date" value={p.startDate} onChange={e => updP(pi, 'startDate', e.target.value)} />
                  </div>
                  <div>
                    <div style={sLb}>Date fin *</div>
                    <input style={sIn} type="date" value={p.endDate} onChange={e => updP(pi, 'endDate', e.target.value)} />
                  </div>
                </div>

                <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px dashed #e8e0d4' }}>
                  <div style={{ fontWeight: 800, color: '#6b5c45', fontSize: 14, marginBottom: 10 }}>Séquences</div>
                  {p.sequences.map((seq, si) => (
                    <div key={si} style={{ background: '#f9f6f1', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: '1px solid #f0ebe3' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ fontWeight: 700, color: '#6b5c45', fontSize: 14 }}>Séquence {si + 1}</span>
                        <button onClick={() => remSeq(pi, si)} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✕</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px', gap: 8 }}>
                        <div>
                          <div style={sLb}>Nom *</div>
                          <input style={{ ...sIn, marginBottom: 0 }} value={seq.name} onChange={e => updS(pi, si, 'name', e.target.value)} placeholder="Devoir 1" />
                        </div>
                        <div>
                          <div style={sLb}>Type *</div>
                          <input style={{ ...sIn, marginBottom: 0 }} value={seq.type} onChange={e => updS(pi, si, 'type', e.target.value)} placeholder="DS1" />
                        </div>
                        <div>
                          <div style={sLb}>Ordre</div>
                          <input style={{ ...sIn, marginBottom: 0 }} type="number" min={1} value={seq.orderIndex} onChange={e => updS(pi, si, 'orderIndex', parseInt(e.target.value) || 1)} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                        <div>
                          <div style={sLb}>Début (optionnel)</div>
                          <input style={{ ...sIn, marginBottom: 0 }} type="date" value={seq.startDate} onChange={e => updS(pi, si, 'startDate', e.target.value)} />
                        </div>
                        <div>
                          <div style={sLb}>Fin (optionnel)</div>
                          <input style={{ ...sIn, marginBottom: 0 }} type="date" value={seq.endDate} onChange={e => updS(pi, si, 'endDate', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button style={btnSecSm} onClick={() => addSeq(pi)}>+ Ajouter une séquence</button>
                </div>
              </div>
            ))}

            <button style={{ ...btnSecSm, width: '100%', marginBottom: 22 }} onClick={addPeriode}>+ Ajouter une période</button>

            {calForm.error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 9, padding: '10px 14px', fontSize: 13, fontWeight: 600, marginBottom: 14, lineHeight: 1.5 }}>{calForm.error}</div>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setCalForm(EMPTY_CAL)}>Annuler</button>
              <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: calForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: calForm.loading ? 0.7 : 1 }} onClick={submitCalendar} disabled={calForm.loading}>
                {calForm.loading ? '⏳ Enregistrement…' : '💾 Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal créer une année ── */}
      {createOpen && (
        <ModalOverlay onClose={() => { setCreateOpen(false); setForm(EMPTY_YEAR) }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>
            Créer une année scolaire
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Nom *</div>
          <input
            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }}
            placeholder="Ex: 2025-2026" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Date de début *</div>
              <input type="date"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }}
                value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }}>Date de fin *</div>
              <input type="date"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }}
                value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          {form.error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{form.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => { setCreateOpen(false); setForm(EMPTY_YEAR) }}>Annuler</button>
            <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: form.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: form.loading ? 0.7 : 1 }}
              onClick={submitCreate} disabled={form.loading}>
              {form.loading ? 'Création…' : 'Créer'}
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
const btnSecSm: React.CSSProperties = { padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 20px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '15px 20px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }

const sLb: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 4, display: 'block' }
const sIn: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10, outline: 'none' }

function toDateInput(d: string | null): string {
  if (!d) return ''
  try { return new Date(d).toISOString().slice(0, 10) }
  catch { return '' }
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 460, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}
