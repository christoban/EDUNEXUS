'use client'
import { useState, useEffect, useCallback } from 'react'
import { useT } from '@/lib/i18n'
import { fetchApi } from '@/lib/fetchApi'

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
  publishedCount?: number
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

const DEC_COLOR: Record<string, { color: string; bg: string }> = {
  PASS:         { color: 'var(--green)', bg: 'var(--green-light)' },
  REPEAT:       { color: 'var(--red)', bg: 'var(--red-light)' },
  DELIBERATION: { color: 'var(--amber)', bg: 'var(--amber-light)' },
}

export default function SectionAdminCouncil({ onToast }: Props) {
  const t = useT('grades')
  const DEC_LABEL: Record<string, string> = {
    PASS: t('council.DEC_LABEL.PASS'), REPEAT: t('council.DEC_LABEL.REPEAT'), DELIBERATION: t('council.DEC_LABEL.DELIBERATION'),
  }
  const [sessions, setSessions]           = useState<CouncilSession[]>([])
  const [selected, setSelected]           = useState<SessionDetail | null>(null)
  const [loading, setLoading]             = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all')
  const [publishing, setPublishing]       = useState(false)

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/class-councils', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setSessions(data.sessions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const openSession = async (sessionId: string) => {
    setLoadingDetail(true); setSelected(null)
    try {
      const res = await fetchApi(`/api/v2/class-councils/${sessionId}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setSelected(data.session)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de chargement', 'error')
    } finally { setLoadingDetail(false) }
  }

  const publishBulletins = async (sessionId: string) => {
    setPublishing(true)
    try {
      const res = await fetchApi(`/api/v2/class-councils/${sessionId}/publish-bulletins`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(data.count > 0
        ? `✅ ${data.count} bulletin${data.count > 1 ? 's' : ''} publié${data.count > 1 ? 's' : ''} — SMS envoyés aux parents`
        : 'Aucun bulletin généré à publier pour cette classe',
        data.count > 0 ? 'success' : 'info')
      fetchSessions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de publication', 'error')
    } finally { setPublishing(false) }
  }

  // Derive unique periods from all sessions (not filtered)
  const periodsMap = new Map<string, { id: string; name: string }>()
  sessions.forEach(s => {
    if (!periodsMap.has(s.academicPeriod.id)) periodsMap.set(s.academicPeriod.id, s.academicPeriod)
  })
  const periods = Array.from(periodsMap.values())

  const filteredSessions = selectedPeriodId === 'all'
    ? sessions
    : sessions.filter(s => s.academicPeriod.id === selectedPeriodId)

  // KPIs computed on filteredSessions
  const totalSessions  = filteredSessions.length
  const openCount      = filteredSessions.filter(s => s.status === 'OPEN').length
  const lockedCount    = filteredSessions.filter(s => s.status === 'LOCKED').length
  const publishedCount = filteredSessions.reduce((sum, s) => sum + (s.publishedCount ?? 0), 0)

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={sTitle}>Conseil de classe</div>
          <div style={sSub}>
            {totalSessions} session{totalSessions !== 1 ? 's' : ''} · {openCount} ouvert{openCount !== 1 ? 's' : ''} · {lockedCount} verrouillé{lockedCount !== 1 ? 's' : ''}
          </div>
        </div>
        {periods.length > 0 && (
          <select
            value={selectedPeriodId}
            onChange={e => { setSelectedPeriodId(e.target.value); setSelected(null) }}
            style={{ padding: '8px 14px', border: '1.5px solid var(--border2)', borderRadius: 10, background: 'var(--bg2)', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, color: 'var(--text)', outline: 'none', cursor: 'pointer' }}>
            <option value="all">Tous les trimestres</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* KPI cards */}
      {!loading && !error && sessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {([
            { icon: '📋', value: totalSessions,  label: 'Sessions au total' },
            { icon: '⏳', value: openCount,       label: 'En cours' },
            { icon: '🔒', value: lockedCount,     label: 'Verrouillés' },
            { icon: '📤', value: publishedCount,  label: 'Bulletins publiés' },
          ] as const).map(({ icon, value, label }) => (
            <div key={label} style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '16px 18px' }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{value}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchSessions} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && filteredSessions.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🎓</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Aucun conseil de classe</div>
          <div style={{ fontSize: 16, color: 'var(--text3)' }}>
            {selectedPeriodId !== 'all' ? 'Aucune session pour ce trimestre.' : 'Les sessions seront créées par le personnel.'}
          </div>
        </div>
      )}

      {!loading && !error && filteredSessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '340px 1fr' : 'repeat(3,1fr)', gap: 18, alignItems: 'start' }}>
          {/* Liste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredSessions.map(s => (
              <div key={s.id} onClick={() => openSession(s.id)}
                style={{ background: selected?.id === s.id ? 'var(--green-light)' : 'white', borderRadius: 14, border: `1.5px solid ${selected?.id === s.id ? 'var(--green)' : 'var(--border)'}`, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }) }}
                onMouseLeave={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border)', boxShadow: 'none' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{s.class.name}</div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: s.status === 'LOCKED' ? 'var(--green-light)' : 'var(--blue-light)', color: s.status === 'LOCKED' ? 'var(--green)' : 'var(--blue)' }}>
                    {s.status === 'LOCKED' ? '🔒 Verrouillé' : '📖 Ouvert'}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>{s.academicPeriod.name}</div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>{s._count.decisions} décision{s._count.decisions !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>

          {/* Détail */}
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
                      🗳️ {selected.class.name} · {selected.academicPeriod.name}
                    </span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {selected.status === 'LOCKED' && (
                        <>
                          <button style={btnPrim} onClick={() => publishBulletins(selected.id)} disabled={publishing}>
                            {publishing ? '⏳ Publication…' : '📤 Publier les bulletins'}
                          </button>
                          <button style={{ ...btnSec, fontSize: 14 }}
                            onClick={() => window.open(`/api/v2/class-councils/${selected.id}/pv`, '_blank')}
                            title="Procès-Verbal officiel de la délibération">
                            📋 PV officiel
                          </button>
                          <button style={{ ...btnSec, fontSize: 14 }}
                            onClick={() => window.open(`/api/v2/classes/${selected.class.id}/tableau-honneur?periodId=${selected.academicPeriod.id}`, '_blank')}
                            title="Tableau d'honneur du trimestre">
                            🏆 Tableau d'honneur
                          </button>
                          <button style={{ ...btnSec, fontSize: 14 }}
                            onClick={() => window.open(`/api/v2/classes/${selected.class.id}/tableau-honneur-annuel`, '_blank')}
                            title="Tableau d'honneur annuel (disponible uniquement si tous les conseils sont verrouillés)">
                            🏆 Annuel
                          </button>
                        </>
                      )}
                      <button style={btnSec} onClick={() => window.open(`/api/v2/class-councils/${selected.id}/report`, '_blank')}>📄 Rapport</button>
                      <button style={{ ...btnSec, fontSize: 14 }} onClick={() => setSelected(null)}>✕</button>
                    </div>
                  </div>

                  {selected.status === 'OPEN' && (
                    <div style={{ background: 'var(--orange-light)', borderBottom: '1px solid var(--orange-light)', padding: '10px 22px', fontSize: 14, fontWeight: 700, color: 'var(--orange)' }}>
                      ⏳ En attente du verrouillage par le Censeur
                    </div>
                  )}

                  {selected.status === 'LOCKED' && (
                    <div style={{ background: 'var(--green-light)', borderBottom: '1px solid var(--border)', padding: '10px 22px', fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>
                      🔒 Ce conseil est verrouillé.
                    </div>
                  )}

                  {selected.decisions.length === 0 ? (
                    <div style={{ padding: '40px 22px', textAlign: 'center', color: 'var(--text3)' }}>Aucun élève dans cette session.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['Élève', 'Décision', 'Observation'].map(h => (
                          <th key={h} style={thSt}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {selected.decisions.map(d => {
                          const dc = DEC_COLOR[d.decision] ?? DEC_COLOR.PASS!
                          return (
                            <tr key={d.studentId}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                              <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{d.student.firstName} {d.student.lastName}</td>
                              <td style={tdSt}>
                                <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: dc?.bg, color: dc?.color }}>
                                  {DEC_LABEL[d.decision] ?? d.decision}
                                </span>
                              </td>
                              <td style={tdSt}><span style={{ fontSize: 15, color: 'var(--text3)' }}>{d.observations || '—'}</span></td>
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
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 16px', fontSize: 16, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
