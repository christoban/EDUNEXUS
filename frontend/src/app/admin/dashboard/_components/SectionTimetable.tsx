'use client'
import { useState, useEffect, useCallback } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string }
interface TimetableSlot {
  id: string; dayOfWeek: number; startTime: string; endTime: string; room: string | null; kind: string
  subject: { id: string; name: string } | null
  teacher: { id: string; firstName: string; lastName: string } | null
}
interface Timetable {
  id: string; classId: string; status: string
  class: { id: string; name: string }
  slots: TimetableSlot[]
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const DAY_IDX = [1, 2, 3, 4, 5, 6]
const KIND_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  CLASS:    { bg: 'linear-gradient(135deg,rgba(5,150,105,0.11),rgba(5,150,105,0.05))', border: '#059669', text: '#047857' },
  BREAK:    { bg: '#f5f3ef', border: '#d4c8b8', text: '#a89478' },
  ACTIVITY: { bg: 'rgba(217,119,6,0.09)', border: '#d97706', text: '#b45309' },
  TD:       { bg: 'rgba(37,99,235,0.08)', border: '#2563eb', text: '#1d4ed8' },
}

function buildGrid(slots: TimetableSlot[]): Map<string, TimetableSlot> {
  const map = new Map<string, TimetableSlot>()
  for (const s of slots) map.set(`${s.dayOfWeek}-${s.startTime}`, s)
  return map
}
function uniqueTimes(slots: TimetableSlot[]): string[] {
  return Array.from(new Set(slots.map(s => s.startTime))).sort()
}

export default function SectionTimetable({ onToast }: Props) {
  const [classes, setClasses]       = useState<ClassItem[]>([])
  const [classId, setClassId]       = useState('')
  const [timetable, setTimetable]   = useState<Timetable | null>(null)
  const [loading, setLoading]       = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    fetch('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setClasses(d.data || []))
      .catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  const fetchTimetable = useCallback(async () => {
    if (!classId) { onToast('Sélectionnez une classe', 'info'); return }
    try {
      setLoading(true); setError(null)
      const res = await fetch(`/api/v2/timetables?classId=${classId}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      const list: Timetable[] = data.data || []
      setTimetable(list[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [classId, onToast])

  const handlePublish = async () => {
    if (!timetable) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/v2/timetables/${timetable.id}/publish`, {
        method: 'PUT', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Emploi du temps publié !', 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de publication', 'error')
    } finally {
      setPublishing(false)
    }
  }

  const slots = timetable?.slots ?? []
  const grid  = buildGrid(slots)
  const times = uniqueTimes(slots)
  const activeDays = DAY_IDX.filter(d => slots.some(s => s.dayOfWeek === d))
  const displayDays = activeDays.length > 0 ? activeDays : DAY_IDX.slice(0, 5)

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={sTitle}>Emploi du temps</div>
          <div style={sSub}>
            {timetable
              ? `${timetable.class.name} — ${slots.length} créneaux · ${timetable.status === 'PUBLISHED' ? '✅ Publié' : '📝 Brouillon (élaboré par le Censeur)'}`
              : 'Sélectionnez une classe pour consulter son emploi du temps'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select value={classId} onChange={e => setClassId(e.target.value)} style={selectSt} disabled={loadingClasses}>
            <option value="">{loadingClasses ? 'Chargement…' : 'Sélectionner une classe'}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button style={btnSec} onClick={fetchTimetable} disabled={!classId || loading}>
            🔍 Charger
          </button>
          {timetable && timetable.status !== 'PUBLISHED' && (
            <button style={btnPrim} onClick={handlePublish} disabled={publishing}>
              {publishing
                ? <><span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle', marginRight: 6 }} />Publication…</>
                : '📤 Valider et publier'}
            </button>
          )}
        </div>
      </div>

      {/* Notice rôles */}
      <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 22, fontSize: 13, color: '#047857' }}>
        <strong>Rôles :</strong> L'élaboration de l'EDT (ajout de créneaux, attribution des enseignants) est effectuée par le <strong>Censeur des Études</strong> dans son tableau de bord. Le Proviseur consulte et <strong>publie</strong> l'EDT une fois validé.
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
          <button onClick={fetchTimetable} style={{ padding: '7px 16px', borderRadius: 9, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
            Réessayer
          </button>
        </div>
      )}

      {/* Aucune classe sélectionnée */}
      {!loading && !error && !classId && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🗓️</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Sélectionnez une classe</div>
          <div style={{ fontSize: 16, color: '#a89478' }}>Choisissez une classe pour consulter son emploi du temps.</div>
        </div>
      )}

      {/* Classe sélectionnée, pas encore d'EDT */}
      {!loading && !error && classId && !timetable && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucun emploi du temps</div>
          <div style={{ fontSize: 16, color: '#a89478' }}>
            Le Censeur n'a pas encore élaboré l'emploi du temps pour cette classe.
          </div>
        </div>
      )}

      {/* Grille (lecture seule) */}
      {!loading && !error && timetable && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          {slots.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>
              L'emploi du temps existe mais aucun créneau n'a encore été ajouté par le Censeur.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ ...thSt, width: 120 }}>Horaire</th>
                    {displayDays.map(d => <th key={d} style={thSt}>{DAYS[d - 1]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {times.map(time => (
                    <tr key={time}>
                      <td style={{ padding: '10px 12px', background: '#f0ebe3', fontSize: 14, fontWeight: 800, color: '#a89478', textAlign: 'center', border: '1px solid #e8e0d4', whiteSpace: 'nowrap' }}>
                        {time}
                      </td>
                      {displayDays.map(d => {
                        const slot = grid.get(`${d}-${time}`)
                        const kc = slot ? (KIND_COLORS[slot.kind] ?? KIND_COLORS.CLASS) : null
                        return (
                          <td key={d} style={{ padding: 0, border: '1px solid #e8e0d4', verticalAlign: 'top', minWidth: 130, height: 72 }}>
                            {slot ? (
                              <div style={{ padding: 10, height: '100%', background: kc!.bg, borderLeft: `3px solid ${kc!.border}`, boxSizing: 'border-box' }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: kc!.text }}>{slot.subject?.name ?? '(sans matière)'}</div>
                                <div style={{ fontSize: 12, color: '#a89478', marginTop: 2 }}>
                                  {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : 'Non assigné'}
                                </div>
                                {slot.room && <div style={{ fontSize: 11, color: '#c4b8a4', marginTop: 2 }}>Salle {slot.room}</div>}
                                {slot.endTime && <div style={{ fontSize: 11, color: '#d4c8b8', marginTop: 2 }}>{time}–{slot.endTime}</div>}
                              </div>
                            ) : (
                              <div style={{ height: '100%', background: 'transparent' }} />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Légende */}
      {timetable && slots.length > 0 && (
        <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
          {Object.entries({ CLASS: 'Cours', ACTIVITY: 'Activité', TD: 'TD/TP', BREAK: 'Pause' }).map(([k, lbl]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#a89478' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: KIND_COLORS[k].border, opacity: 0.8 }} />
              {lbl}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub:   React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 18px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec:  React.CSSProperties = { padding: '9px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 10px', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#a89478', background: '#f0ebe3', border: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.5px' }
