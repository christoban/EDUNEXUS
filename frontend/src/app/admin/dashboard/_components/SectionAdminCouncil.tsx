'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface CouncilSession {
  id: string; status: 'OPEN' | 'LOCKED'; createdAt: string; validatedAt: string | null
  class: { id: string; name: string }; academicPeriod: { id: string; name: string }
  _count: { decisions: number }
}

interface Decision {
  studentId: string; decision: string; observations: string | null
  student: { id: string; firstName: string; lastName: string }
}

interface SessionDetail {
  id: string; status: string
  class: { id: string; name: string }; academicPeriod: { id: string; name: string }
  presidedBy: { id: string; firstName: string; lastName: string } | null
  decisions: Decision[]
}

const DEC_COLOR: Record<string, { color: string; bg: string }> = {
  PASS:         { color: '#059669', bg: '#d1fae5' },
  REPEAT:       { color: '#dc2626', bg: '#fee2e2' },
  DELIBERATION: { color: '#d97706', bg: '#fef3c7' },
}

const DEC_LABEL: Record<string, string> = {
  PASS: '✅ Admis(e)', REPEAT: '↩️ Redoublant(e)', DELIBERATION: '⚖️ En délibération',
}

export default function SectionAdminCouncil({ onToast }: Props) {
  const [sessions, setSessions]           = useState<CouncilSession[]>([])
  const [selected, setSelected]           = useState<SessionDetail | null>(null)
  const [loading, setLoading]             = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [locking, setLocking]             = useState(false)

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

  const lockSession = async () => {
    if (!selected) return
    if (!confirm('Verrouiller ce conseil ? Aucune modification ne sera possible après.')) return
    setLocking(true)
    try {
      const res = await fetchApi(`/api/v2/class-councils/${selected.id}/lock`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Conseil de classe verrouillé', 'success')
      setSelected(prev => prev ? { ...prev, status: 'LOCKED' } : null)
      fetchSessions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de verrouillage', 'error')
    } finally { setLocking(false) }
  }

  const openCount   = sessions.filter(s => s.status === 'OPEN').length
  const lockedCount = sessions.filter(s => s.status === 'LOCKED').length

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Conseil de classe</div>
          <div style={sSub}>{openCount} ouvert{openCount > 1 ? 's' : ''} · {lockedCount} verrouillé{lockedCount > 1 ? 's' : ''}</div>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span><span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={fetchSessions} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🎓</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucun conseil de classe</div>
          <div style={{ fontSize: 16, color: '#a89478' }}>Les sessions seront créées par le personnel.</div>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '340px 1fr' : 'repeat(3,1fr)', gap: 18, alignItems: 'start' }}>
          {/* Liste */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {sessions.map(s => (
              <div key={s.id} onClick={() => openSession(s.id)}
                style={{ background: selected?.id === s.id ? '#f0fdf4' : 'white', borderRadius: 14, border: `1.5px solid ${selected?.id === s.id ? '#059669' : '#e8e0d4'}`, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }) }}
                onMouseLeave={e => { if (selected?.id !== s.id) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#e8e0d4', boxShadow: 'none' }) }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209' }}>{s.class.name}</div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: s.status === 'LOCKED' ? '#d1fae5' : '#dbeafe', color: s.status === 'LOCKED' ? '#065f46' : '#1e40af' }}>
                    {s.status === 'LOCKED' ? '🔒 Verrouillé' : '📖 Ouvert'}
                  </span>
                </div>
                <div style={{ fontSize: 14, color: '#a89478', fontWeight: 600 }}>{s.academicPeriod.name}</div>
                <div style={{ fontSize: 13, color: '#a89478', marginTop: 4 }}>{s._count.decisions} décision{s._count.decisions !== 1 ? 's' : ''}</div>
              </div>
            ))}
          </div>

          {/* Détail */}
          {selected && (
            <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
              {loadingDetail ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                  <div style={{ width: 28, height: 28, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                </div>
              ) : (
                <>
                  <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>
                      🗳️ {selected.class.name} · {selected.academicPeriod.name}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {selected.status !== 'LOCKED' && (
                        <button style={btnPrim} onClick={lockSession} disabled={locking}>
                          {locking ? '⏳…' : '🔒 Verrouiller'}
                        </button>
                      )}
                      <button style={btnSec} onClick={() => window.open(`/api/v2/class-councils/${selected.id}/report`, '_blank')}>📄 PDF</button>
                      <button style={{ ...btnSec, fontSize: 14 }} onClick={() => setSelected(null)}>✕</button>
                    </div>
                  </div>

                  {selected.status === 'LOCKED' && (
                    <div style={{ background: '#d1fae5', borderBottom: '1px solid #e8e0d4', padding: '10px 22px', fontSize: 14, fontWeight: 700, color: '#065f46' }}>
                      🔒 Ce conseil est verrouillé.
                    </div>
                  )}

                  {selected.decisions.length === 0 ? (
                    <div style={{ padding: '40px 22px', textAlign: 'center', color: '#a89478' }}>Aucun élève dans cette session.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>{['Élève', 'Décision', 'Observation'].map(h => (
                          <th key={h} style={thSt}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {selected.decisions.map(d => {
                          const dc = DEC_COLOR[d.decision] ?? DEC_COLOR.PASS
                          return (
                            <tr key={d.studentId}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                              <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{d.student.firstName} {d.student.lastName}</td>
                              <td style={tdSt}>
                                <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: dc.bg, color: dc.color }}>
                                  {DEC_LABEL[d.decision] ?? d.decision}
                                </span>
                              </td>
                              <td style={tdSt}><span style={{ fontSize: 15, color: '#a89478' }}>{d.observations || '—'}</span></td>
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

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 16px', fontSize: 16, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
