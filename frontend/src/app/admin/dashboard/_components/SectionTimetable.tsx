'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string }
interface TimetableSlot {
  id: string; dayOfWeek: number; startTime: string; endTime: string
  room: string | null; kind: string
  subject: { id: string; name: string } | null
  teacher: { id: string; firstName: string; lastName: string } | null
}
interface Timetable {
  id: string; classId: string; status: string
  class: { id: string; name: string }
  slots: TimetableSlot[]
}
interface PeriodeGrille {
  ordre: number; debut: string; fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'; duree: number
}

const DAY_NAME: Record<string, string> = {
  LUNDI: 'Lundi', MARDI: 'Mardi', MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi', VENDREDI: 'Vendredi', SAMEDI: 'Samedi',
}
const DAY_MAP: Record<string, number> = {
  LUNDI: 1, MARDI: 2, MERCREDI: 3, JEUDI: 4, VENDREDI: 5, SAMEDI: 6,
}

const SUBJECT_PALETTES = [
  { bg: 'rgba(5,150,105,0.10)', border: '#059669', text: '#047857' },
  { bg: 'rgba(37,99,235,0.09)', border: '#2563eb', text: '#1d4ed8' },
  { bg: 'rgba(217,119,6,0.09)', border: '#d97706', text: '#b45309' },
  { bg: 'rgba(139,92,246,0.09)', border: '#7c3aed', text: '#6d28d9' },
  { bg: 'rgba(236,72,153,0.09)', border: '#db2777', text: '#be185d' },
  { bg: 'rgba(20,184,166,0.09)', border: '#0d9488', text: '#0f766e' },
]
function subjectColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length]
}

export default function SectionTimetable({ onToast }: Props) {
  const [classes, setClasses]           = useState<ClassItem[]>([])
  const [classId, setClassId]           = useState('')
  const [timetable, setTimetable]       = useState<Timetable | null>(null)
  const [squelette, setSquelette]       = useState<PeriodeGrille[]>([])
  const [joursActifs, setJoursActifs]   = useState<string[]>(['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
  const [loading, setLoading]           = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [publishing, setPublishing]     = useState(false)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
    ]).then(([classData, configData]) => {
      setClasses(classData.data || [])
      if (configData.data) {
        setSquelette(configData.data.squelette || [])
        setJoursActifs(configData.data.config?.joursActifs || ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
      }
    }).catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  const fetchTimetable = useCallback(async (cid?: string) => {
    const id = cid ?? classId
    if (!id) return
    setLoading(true); setError(null)
    try {
      const res = await fetchApi(`/api/v2/timetables?classId=${id}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      const list: Timetable[] = data.data || []
      setTimetable(list[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [classId])

  const handleClassChange = (newId: string) => {
    setClassId(newId); setTimetable(null); setError(null)
    if (newId) fetchTimetable(newId)
  }

  const handlePublish = async () => {
    if (!timetable) return
    setPublishing(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/publish`, {
        method: 'PUT', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Emploi du temps publié — visible par enseignants, élèves et parents !', 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de publication', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const slots = timetable?.slots ?? []
  const slotMap = new Map<string, TimetableSlot>()
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.startTime}`, s)

  const joursNumeriques = joursActifs.map(j => DAY_MAP[j]).filter(Boolean)

  // Quand pas de grille config, fallback sur les temps des slots
  const hasGridConfig = squelette.length > 0
  const fallbackTimes = hasGridConfig ? [] : Array.from(new Set(slots.map(s => s.startTime))).sort()

  const totalCours  = slots.filter(s => s.kind === 'CLASS').length
  const remplis     = slots.filter(s => s.kind === 'CLASS' && s.subject).length
  const pct         = totalCours > 0 ? Math.round(remplis / totalCours * 100) : 0

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={sTitle}>Emploi du temps</div>
          <div style={sSub}>
            {timetable
              ? `${timetable.class.name} — ${remplis}/${totalCours} créneaux remplis · ${timetable.status === 'PUBLISHED' ? '✅ Publié' : '📝 Brouillon (élaboré par le Censeur)'}`
              : 'Sélectionnez une classe pour consulter son emploi du temps'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={classId} onChange={e => handleClassChange(e.target.value)} style={selectSt} disabled={loadingClasses}>
            <option value="">{loadingClasses ? 'Chargement…' : 'Sélectionner une classe'}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {timetable && timetable.status !== 'PUBLISHED' && (
            <button style={btnPrim} onClick={handlePublish} disabled={publishing}>
              {publishing
                ? <><span style={spinInline} />Publication…</>
                : '✅ Valider et publier'}
            </button>
          )}
        </div>
      </div>

      {/* Bandeau info rôle */}
      <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: '#1e40af' }}>
        <strong>Vue Proviseur (lecture seule)</strong> — L'élaboration et le remplissage de l'EDT est effectué par le <strong>Censeur des Études</strong> dans son espace. Vous pouvez ici <strong>valider et publier</strong> un EDT finalisé, le rendant visible aux enseignants, élèves et parents.
      </div>

      {/* Chargement */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Erreur */}
      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span>
          <span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={() => fetchTimetable()} style={btnSec}>Réessayer</button>
        </div>
      )}

      {/* Pas de classe */}
      {!loading && !error && !classId && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🗓️</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Sélectionnez une classe</div>
          <div style={{ fontSize: 15, color: '#a89478' }}>Choisissez une classe pour afficher son emploi du temps.</div>
        </div>
      )}

      {/* Classe sélectionnée, pas d'EDT */}
      {!loading && !error && classId && !timetable && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucun emploi du temps</div>
          <div style={{ fontSize: 15, color: '#a89478' }}>Le Censeur n'a pas encore élaboré l'emploi du temps pour cette classe.</div>
        </div>
      )}

      {/* Grille lecture seule */}
      {!loading && !error && timetable && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          {/* Barre progression */}
          <div style={{ background: '#f8f5f0', borderBottom: '1px solid #e8e0d4', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45', whiteSpace: 'nowrap' }}>{remplis}/{totalCours} créneaux</span>
            <div style={{ flex: 1, background: '#e8e0d4', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#059669' : '#d97706', transition: 'width 0.3s', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? '#059669' : '#d97706' }}>{pct}%</span>
            {timetable.status === 'PUBLISHED' && (
              <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', fontWeight: 700, borderRadius: 20, padding: '3px 10px' }}>✅ Publié</span>
            )}
            {timetable.status !== 'PUBLISHED' && timetable.status === 'DRAFT' && (
              <span style={{ fontSize: 12, background: '#fef9c3', color: '#713f12', fontWeight: 700, borderRadius: 20, padding: '3px 10px' }}>📝 Brouillon</span>
            )}
          </div>

          {slots.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>
              Le squelette a été généré mais aucun créneau n'a encore été rempli par le Censeur.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ ...thSt, width: 100 }}>Horaire</th>
                    {(hasGridConfig ? joursActifs : ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']).map(j => (
                      <th key={j} style={thSt}>{DAY_NAME[j] ?? j}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasGridConfig ? (
                    squelette.map((periode, idx) => {
                      if (periode.type !== 'COURS') {
                        const isPetite = periode.type === 'PETITE_PAUSE'
                        return (
                          <tr key={`pause-${idx}`}>
                            <td colSpan={joursActifs.length + 1}
                              style={{ textAlign: 'center', padding: '5px 12px', background: isPetite ? '#fef9f0' : '#fef3e2', borderTop: '1px solid #e8e0d4', borderBottom: '1px solid #e8e0d4', fontSize: 12, fontWeight: 700, color: isPetite ? '#b45309' : '#92400e' }}>
                              {isPetite ? '☕ Petite pause' : '🍽️ Grande pause'} — {periode.debut} à {periode.fin}
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={`cours-${periode.debut}`}>
                          <td style={{ padding: '8px 10px', background: '#f8f5f0', fontSize: 13, fontWeight: 800, color: '#a89478', textAlign: 'center', border: '1px solid #e8e0d4', whiteSpace: 'nowrap' }}>
                            {periode.debut}<br /><span style={{ fontSize: 11 }}>{periode.fin}</span>
                          </td>
                          {joursActifs.map(jour => {
                            const slot = slotMap.get(`${DAY_MAP[jour]}-${periode.debut}`)
                            const col = slot?.subject ? subjectColor(slot.subject.id) : null
                            return (
                              <td key={jour} style={{ padding: 0, border: '1px solid #e8e0d4', verticalAlign: 'top', minWidth: 110, height: 64 }}>
                                {slot?.subject ? (
                                  <div style={{ padding: '8px 10px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: col!.text, lineHeight: 1.2 }}>{slot.subject.name}</div>
                                    <div style={{ fontSize: 11, color: '#a89478', marginTop: 2 }}>
                                      {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: '#f59e0b' }}>Sans enseignant</span>}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ height: '100%', background: '#fafaf9' }} />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  ) : (
                    fallbackTimes.map(time => (
                      <tr key={time}>
                        <td style={{ padding: '8px 10px', background: '#f8f5f0', fontSize: 13, fontWeight: 800, color: '#a89478', textAlign: 'center', border: '1px solid #e8e0d4', whiteSpace: 'nowrap' }}>
                          {time}
                        </td>
                        {[1,2,3,4,5].map(d => {
                          const slot = slotMap.get(`${d}-${time}`)
                          const col = slot?.subject ? subjectColor(slot.subject.id) : null
                          return (
                            <td key={d} style={{ padding: 0, border: '1px solid #e8e0d4', verticalAlign: 'top', minWidth: 110, height: 64 }}>
                              {slot?.subject ? (
                                <div style={{ padding: '8px 10px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: col!.text }}>{slot.subject.name}</div>
                                  <div style={{ fontSize: 11, color: '#a89478', marginTop: 2 }}>
                                    {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ height: '100%' }} />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const sTitle:    React.CSSProperties = { fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub:      React.CSSProperties = { fontSize: 16, color: '#a89478', marginTop: 3 }
const btnPrim:   React.CSSProperties = { padding: '10px 18px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnSec:    React.CSSProperties = { padding: '9px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt:  React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt:      React.CSSProperties = { padding: '10px 8px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', border: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.5px' }
const spinInline: React.CSSProperties = { display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle' }
