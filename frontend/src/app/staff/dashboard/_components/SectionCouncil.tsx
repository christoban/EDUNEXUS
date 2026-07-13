'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { CheckCircle2, RotateCcw, Scale, AlertTriangle, GraduationCap } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface CouncilSession {
  id: string
  status: 'OPEN' | 'LOCKED'
  createdAt: string
  validatedAt: string | null
  class: { id: string; name: string }
  academicPeriod: { id: string; name: string }
  _count: { decisions: number }
}

interface Decision {
  studentId: string
  decision: string
  observations: string | null
  student: { id: string; firstName: string; lastName: string }
}

interface SessionDetail {
  id: string
  status: string
  class: { id: string; name: string }
  academicPeriod: { id: string; name: string }
  presidedBy: { id: string; firstName: string; lastName: string } | null
  decisions: Decision[]
}

type DecisionValue = 'PASS' | 'REPEAT' | 'DELIBERATION'

const DEC_COLOR: Record<string, { color: string; bg: string }> = {
  PASS:         { color: 'var(--green)', bg: 'var(--green-light)' },
  REPEAT:       { color: 'var(--red)', bg: 'var(--red-light)' },
  DELIBERATION: { color: 'var(--amber)', bg: 'var(--amber-light)' },
}

const DEC_LABEL: Record<string, { icon: React.ReactNode; text: string }> = {
  PASS:         { icon: <CheckCircle2 size={14} strokeWidth={2} />, text: 'Admis(e)' },
  REPEAT:       { icon: <RotateCcw size={14} strokeWidth={2} />, text: 'Redoublant(e)' },
  DELIBERATION: { icon: <Scale size={14} strokeWidth={2} />, text: 'En délibération' },
}

export default function SectionCouncil({ onToast }: Props) {
  const t = useT('staff')
  const [sessions, setSessions]   = useState<CouncilSession[]>([])
  const [selected, setSelected]   = useState<SessionDetail | null>(null)
  const [loading, setLoading]     = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<string, { decision: DecisionValue; obs: string }>>({})
  const [saving, setSaving]       = useState(false)
  const [locking, setLocking]     = useState(false)

  // Create modal
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [createClassId, setCreateClassId] = useState('')
  const [createPeriodId, setCreatePeriodId] = useState('')
  const [createError, setCreateError] = useState('')
  const [classList, setClassList] = useState<{ id: string; name: string }[]>([])
  const [periodList, setPeriodList] = useState<{ id: string; name: string }[]>([])
  const [fetchingFormData, setFetchingFormData] = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/class-councils', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const openSession = async (sessionId: string) => {
    setLoadingDetail(true)
    setSelected(null)
    try {
      const res = await fetchApi(`/api/v2/class-councils/${sessionId}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      const sess: SessionDetail = data.session
      setSelected(sess)
      const init: Record<string, { decision: DecisionValue; obs: string }> = {}
      for (const d of sess.decisions) {
        init[d.studentId] = { decision: d.decision as DecisionValue, obs: d.observations ?? '' }
      }
      setDecisions(init)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de chargement', 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  const saveDecisions = async () => {
    if (!selected) return
    setSaving(true)
    try {
      const payload = Object.entries(decisions).map(([studentId, val]) => ({
        studentId,
        decision: val.decision,
        observations: val.obs || undefined,
      }))
      const res = await fetchApi(`/api/v2/class-councils/${selected.id}/decisions/bulk`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisions: payload }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`${data.count} décision${data.count > 1 ? 's' : ''} sauvegardée${data.count > 1 ? 's' : ''}`, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de sauvegarde', 'error')
    } finally {
      setSaving(false)
    }
  }

  const lockSession = async () => {
    if (!selected) return
    if (!confirm(t('council.lockConfirm'))) return
    setLocking(true)
    try {
      const res = await fetchApi(`/api/v2/class-councils/${selected.id}/lock`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Conseil de classe verrouillé', 'success')
      setSelected(prev => prev ? { ...prev, status: 'LOCKED' } : null)
      fetchSessions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de verrouillage', 'error')
    } finally {
      setLocking(false)
    }
  }

  const handleCreateCouncil = async () => {
    if (!createClassId) { setCreateError(t('council.selectClassError')); return }
    if (!createPeriodId) { setCreateError(t('council.selectPeriodError')); return }
    setCreateLoading(true); setCreateError('')
    try {
      const res = await fetchApi('/api/v2/class-councils', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: createClassId, academicPeriodId: createPeriodId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Conseil de classe créé', 'success')
      setCreateOpen(false); fetchSessions()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setCreateLoading(false)
    }
  }

  const downloadReport = () => {
    if (!selected) return
    window.open(`/api/v2/class-councils/${selected.id}/report`, '_blank')
    onToast(t('council.reportDownloading'), 'info')
  }

  const openCount  = sessions.filter(s => s.status === 'OPEN').length
  const lockedCount = sessions.filter(s => s.status === 'LOCKED').length

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>{t('council.title')}</div>
          <div style={sSub}>{t('council.subtitle', { openCount, s: openCount > 1 ? 's' : '', lockedCount, locked: lockedCount > 1 ? 's' : '' })}</div>
        </div>
        <button style={btnPrim} onClick={() => {
          setCreateOpen(true)
          setFetchingFormData(true)
          Promise.all([
            fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
            fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
          ]).then(([cRes, yRes]) => {
            const classes = (cRes.data || []).map((c: any) => ({ id: c.id, name: c.name }))
            setClassList(classes)
            if (classes.length > 0) setCreateClassId(classes[0].id)
            const current = (yRes.data || []).find((y: any) => y.isCurrent) ?? (yRes.data || [])[0]
            const periods = current ? (current.periods || []).map((p: any) => ({ id: p.id, name: p.name })) : []
            setPeriodList(periods)
            if (periods.length > 0) setCreatePeriodId(periods[0].id)
          }).catch(() => onToast('Erreur chargement formulaire', 'error'))
          .finally(() => setFetchingFormData(false))
        }}>{t('council.newCouncil')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={16} strokeWidth={2} /></span><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchSessions} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14, display: 'flex', justifyContent: 'center' }}><GraduationCap size={52} strokeWidth={2} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('council.noSessions')}</div>
          <div style={{ fontSize: 16, color: 'var(--text3)' }}>{t('council.noSessionsDesc')}</div>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '340px 1fr' : 'repeat(3,1fr)', gap: 18, alignItems: 'start' }}>
          {/* Liste des sessions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sessions.map(s => (
              <div key={s.id}
                onClick={() => openSession(s.id)}
                style={{ background: selected?.id === s.id ? 'var(--green-light)' : 'white', borderRadius: 14, border: `1.5px solid ${selected?.id === s.id ? 'var(--green)' : 'var(--border)'}`, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }) }}
                onMouseLeave={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border)', boxShadow: 'none' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{s.class.name}</div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: s.status === 'LOCKED' ? 'var(--green-light)' : 'var(--blue-light)', color: s.status === 'LOCKED' ? 'var(--green)' : 'var(--blue)' }}>
                    {s.status === 'LOCKED' ? t('council.lockedBadge') : t('council.openBadge')}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>{s.academicPeriod.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{t('council.decisionsCount', { count: s._count.decisions, s: s._count.decisions !== 1 ? 's' : '' })}</div>
              </div>
            ))}
          </div>

          {/* Détail session */}
          {selected && (
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              {loadingDetail ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                  <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                </div>
              ) : (
                <>
                  <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>
                      {t('council.deliberationHeader', { className: selected.class.name, periodName: selected.academicPeriod.name })}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selected.status !== 'LOCKED' && (
                        <>
                          <button style={btnSec} onClick={saveDecisions} disabled={saving}>
                            {saving ? t('council.savingDecisions') : t('council.saveDecisions')}
                          </button>
                          <button style={btnPrim} onClick={lockSession} disabled={locking}>
                            {locking ? t('council.locking') : t('council.lock')}
                          </button>
                        </>
                      )}
                      <button style={btnSec} onClick={downloadReport}>{t('council.downloadReport')}</button>
                      <button style={{ ...btnSec, fontSize: 14 }} onClick={() => setSelected(null)}>{t('council.close')}</button>
                    </div>
                  </div>

                  {selected.status === 'LOCKED' && (
                    <div style={{ background: 'var(--green-light)', borderBottom: '1px solid var(--border)', padding: '10px 22px', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                      {t('council.lockedBanner')}
                    </div>
                  )}

                  {selected.decisions.length === 0 ? (
                    <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--text3)' }}>
                      {t('council.noStudents')}
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{[t('council.studentHeader'), t('council.decisionHeader'), t('council.observationHeader')].map(h => (
                          <th key={h} style={thSt}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {selected.decisions.map((d) => {
                          const cur = decisions[d.studentId] ?? { decision: d.decision as DecisionValue, obs: d.observations ?? '' }
                          const dc = DEC_COLOR[cur.decision] ?? DEC_COLOR.PASS
                          return (
                            <tr key={d.studentId}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                              <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                                {d.student.firstName} {d.student.lastName}
                              </td>
                              <td style={tdSt}>
                                {selected.status === 'LOCKED' ? (
                                  <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: dc.bg, color: dc.color, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    {DEC_LABEL[cur.decision] ? <>{DEC_LABEL[cur.decision].icon}{DEC_LABEL[cur.decision].text}</> : cur.decision}
                                  </span>
                                ) : (
                                  <select
                                    value={cur.decision}
                                    onChange={e => setDecisions(p => ({ ...p, [d.studentId]: { ...cur, decision: e.target.value as DecisionValue } }))}
                                    style={{ padding: '7px 10px', border: '1.5px solid var(--border2)', borderRadius: 9, fontSize: 15, fontWeight: 700, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: 'var(--surface)', color: dc.color, minWidth: 180 }}>
                                    <option value="PASS">{t('council.decisionPass')}</option>
                                    <option value="REPEAT">{t('council.decisionRepeat')}</option>
                                    <option value="DELIBERATION">{t('council.decisionDeliberation')}</option>
                                  </select>
                                )}
                              </td>
                              <td style={tdSt}>
                                {selected.status === 'LOCKED' ? (
                                  <span style={{ fontSize: 15, color: 'var(--text3)' }}>{cur.obs || '—'}</span>
                                ) : (
                                  <input type="text"
                                    value={cur.obs}
                                    onChange={e => setDecisions(p => ({ ...p, [d.studentId]: { ...cur, obs: e.target.value } }))}
                                    placeholder={t('council.observationPlaceholder')}
                                    style={{ width: '100%', padding: '7px 10px', border: '1.5px solid var(--border2)', borderRadius: 9, fontSize: 15, fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
                                  />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal créer un conseil */}
      {createOpen && (
        <div onClick={() => !createLoading && setCreateOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, padding: '32px 36px', width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 24 }}>
              {t('council.newCouncilModalTitle')}
            </div>

            {fetchingFormData ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 7, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('council.classLabel')}</div>
                <select
                  value={createClassId}
                  onChange={e => setCreateClassId(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer', marginBottom: 18, boxSizing: 'border-box' }}>
                  <option value="">{t('council.classPlaceholder')}</option>
                  {classList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>

                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 7, letterSpacing: '0.5px', textTransform: 'uppercase' }}>{t('council.periodLabel')}</div>
                <select
                  value={createPeriodId}
                  onChange={e => setCreatePeriodId(e.target.value)}
                  style={{ width: '100%', padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer', marginBottom: 18, boxSizing: 'border-box' }}>
                  <option value="">{t('council.periodPlaceholder')}</option>
                  {periodList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>

                {createError && (
                  <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>
                    {createError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
                    onClick={() => setCreateOpen(false)} disabled={createLoading}>
                    {t('council.cancel')}
                  </button>
                  <button
                    style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: createLoading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: createLoading ? 0.7 : 1 }}
                    onClick={handleCreateCouncil} disabled={createLoading}>
                    {createLoading ? t('council.creating') : t('council.createCouncil')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 16px', fontSize: 16, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
