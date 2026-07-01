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
  id: string; classId: string; status: string; generatedByAI: boolean
  class: { id: string; name: string }
  slots: TimetableSlot[]
}
interface PeriodeGrille {
  ordre: number; debut: string; fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'; duree: number
}
interface GenResult {
  classId: string; className: string; timetableId: string; slotsCreated: number; isNew: boolean
}
interface UnplacedItem {
  classId: string; className: string; subjectId: string; subjectName: string
  teacherName: string; explication: string
}
interface GenResults {
  results: GenResult[]
  skipped: { classId: string; className: string; reason: string }[]
  unplaced: UnplacedItem[]
  stats: { classesTraitees: number; classesIgnorees: number; slotsTotal: number; coursNonPlaces: number }
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
  const [classes, setClasses]                 = useState<ClassItem[]>([])
  const [classId, setClassId]                 = useState('')
  const [timetable, setTimetable]             = useState<Timetable | null>(null)
  const [squelette, setSquelette]             = useState<PeriodeGrille[]>([])
  const [joursActifs, setJoursActifs]         = useState<string[]>(['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
  const [loading, setLoading]                 = useState(false)
  const [loadingClasses, setLoadingClasses]   = useState(true)
  const [publishing, setPublishing]           = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  // Auto-generation state
  const [autoGenerating, setAutoGenerating]   = useState(false)
  const [genResults, setGenResults]           = useState<GenResults | null>(null)
  const [showGenPanel, setShowGenPanel]       = useState(false)
  const [confirmReset, setConfirmReset]       = useState(false)

  // Groq adjustment state
  const [adjustInstruction, setAdjustInstruction] = useState('')
  const [adjusting, setAdjusting]             = useState(false)
  const [adjustResult, setAdjustResult]       = useState<{ applied: string[]; errors: string[]; message: string } | null>(null)

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
    setClassId(newId); setTimetable(null); setError(null); setAdjustResult(null); setAdjustInstruction('')
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

  const handleAutoGenerate = async () => {
    setAutoGenerating(true); setGenResults(null); setConfirmReset(false)
    try {
      const res = await fetchApi('/api/v2/timetables/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setGenResults(data.data)
      setShowGenPanel(true)
      const s = data.data.stats
      onToast(
        `${s.classesTraitees} classe(s) générée(s) · ${s.slotsTotal} créneaux placés${s.coursNonPlaces > 0 ? ` · ${s.coursNonPlaces} cours non placés` : ''}`,
        s.coursNonPlaces > 0 ? 'info' : 'success',
      )
      if (classId) fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de génération', 'error')
    } finally {
      setAutoGenerating(false)
    }
  }

  const handleAdjust = async () => {
    if (!timetable || !adjustInstruction.trim()) return
    setAdjusting(true); setAdjustResult(null)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instruction: adjustInstruction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setAdjustResult(data.data)
      if (data.data.applied?.length) {
        onToast(data.data.message, 'success')
        setAdjustInstruction('')
        fetchTimetable()
      } else {
        onToast(data.data.message, 'info')
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur IA', 'error')
    } finally {
      setAdjusting(false)
    }
  }

  const slots = timetable?.slots ?? []
  const slotMap = new Map<string, TimetableSlot>()
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.startTime}`, s)

  const joursNumeriques = joursActifs.map(j => DAY_MAP[j]).filter(Boolean)
  const hasGridConfig = squelette.length > 0
  const fallbackTimes = hasGridConfig ? [] : Array.from(new Set(slots.map(s => s.startTime))).sort()

  const totalCours = slots.filter(s => s.kind === 'CLASS').length
  const remplis    = slots.filter(s => s.kind === 'CLASS' && s.subject).length
  const pct        = totalCours > 0 ? Math.round(remplis / totalCours * 100) : 0

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={sTitle}>Emploi du temps</div>
          <div style={sSub}>
            {timetable
              ? `${timetable.class.name} — ${remplis}/${totalCours} créneaux remplis · ${timetable.status === 'PUBLISHED' ? '✅ Publié' : timetable.generatedByAI ? '🤖 Généré par IA · Brouillon' : '📝 Brouillon'}`
              : 'Sélectionnez une classe ou lancez la génération automatique'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={classId} onChange={e => handleClassChange(e.target.value)} style={selectSt} disabled={loadingClasses}>
            <option value="">{loadingClasses ? 'Chargement…' : 'Sélectionner une classe'}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Bouton génération automatique */}
          {!confirmReset ? (
            <button style={{ ...btnAI, opacity: autoGenerating ? 0.7 : 1 }} disabled={autoGenerating}
              onClick={() => setConfirmReset(true)}>
              {autoGenerating
                ? <><span style={spinInline} />Génération…</>
                : '🤖 Générer automatiquement'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#fff8ed', border: '1.5px solid #f59e0b', borderRadius: 10, padding: '6px 10px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>Écraser les brouillons existants ?</span>
              <button style={{ ...btnPrim, padding: '5px 12px', fontSize: 13 }} onClick={handleAutoGenerate} disabled={autoGenerating}>
                {autoGenerating ? <><span style={spinInline} />…</> : 'Oui, générer'}
              </button>
              <button style={{ ...btnSec, padding: '5px 10px', fontSize: 13 }} onClick={() => setConfirmReset(false)}>Annuler</button>
            </div>
          )}

          {timetable && timetable.status !== 'PUBLISHED' && (
            <button style={btnPrim} onClick={handlePublish} disabled={publishing}>
              {publishing ? <><span style={spinInline} />Publication…</> : '✅ Valider et publier'}
            </button>
          )}
        </div>
      </div>

      {/* Bandeau info rôle */}
      <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
        <strong>Vue Proviseur</strong> — Le remplissage manuel est effectué par le <strong>Censeur</strong> dans son espace. Ici vous pouvez <strong>générer automatiquement</strong> pour toutes les classes, puis <strong>valider et publier</strong>.
      </div>

      {/* Panel résultats génération */}
      {showGenPanel && genResults && (
        <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #d4c8b8', marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: '#f8f5f0', borderBottom: '1px solid #e8e0d4' }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>🤖 Résultats de la génération automatique</span>
              <span style={{ marginLeft: 12, fontSize: 13, color: '#a89478' }}>
                {genResults.stats.classesTraitees} classes · {genResults.stats.slotsTotal} créneaux
                {genResults.stats.coursNonPlaces > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}> · {genResults.stats.coursNonPlaces} cours non placés</span>}
              </span>
            </div>
            <button onClick={() => setShowGenPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#a89478', padding: 4 }}>✕</button>
          </div>

          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Classes générées */}
            {genResults.results.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#059669', marginBottom: 6 }}>✅ Classes générées</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {genResults.results.map(r => (
                    <div key={r.classId} style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700, color: '#166534' }}>
                      {r.className} · {r.slotsCreated} cours
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Classes ignorées */}
            {genResults.skipped.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#d97706', marginBottom: 6 }}>⏭️ Ignorées</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {genResults.skipped.map(s => (
                    <div key={s.classId} style={{ fontSize: 13, color: '#92400e' }}><strong>{s.className}</strong> — {s.reason}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Cours non placés avec explication Groq */}
            {genResults.unplaced.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', marginBottom: 8 }}>❌ Cours impossibles à placer</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {genResults.unplaced.map((u, i) => (
                    <div key={i} style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#991b1b', marginBottom: 4 }}>
                        {u.className} — {u.subjectName} ({u.teacherName})
                      </div>
                      <div style={{ fontSize: 13, color: '#7f1d1d', lineHeight: 1.5 }}>{u.explication}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
          <div style={{ fontSize: 15, color: '#a89478', marginBottom: 24 }}>ou lancez la génération automatique pour créer tous les emplois du temps en une fois.</div>
          <button style={{ ...btnAI, fontSize: 16, padding: '12px 24px' }} disabled={autoGenerating}
            onClick={() => setConfirmReset(true)}>
            {autoGenerating ? <><span style={spinInline} />Génération en cours…</> : '🤖 Générer automatiquement pour toutes les classes'}
          </button>
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
            {timetable.generatedByAI && <span style={{ fontSize: 12, background: '#ede9fe', color: '#5b21b6', fontWeight: 700, borderRadius: 20, padding: '3px 10px' }}>🤖 IA</span>}
            {timetable.status === 'PUBLISHED' && <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', fontWeight: 700, borderRadius: 20, padding: '3px 10px' }}>✅ Publié</span>}
            {timetable.status !== 'PUBLISHED' && <span style={{ fontSize: 12, background: '#fef9c3', color: '#713f12', fontWeight: 700, borderRadius: 20, padding: '3px 10px' }}>📝 Brouillon</span>}
          </div>

          {slots.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>
              Le squelette a été généré mais aucun créneau n'a encore été rempli.
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

      {/* Ajustement IA — visible si EDT DRAFT sélectionné */}
      {timetable && timetable.status !== 'PUBLISHED' && (
        <div style={{ marginTop: 20, background: 'white', borderRadius: 14, border: '1.5px solid #d4c8b8', padding: '18px 20px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1209', marginBottom: 4 }}>🤖 Ajustement en langage naturel (Groq)</div>
          <div style={{ fontSize: 13, color: '#a89478', marginBottom: 12 }}>
            Décrivez un ajustement à apporter en français, ex : "Déplace tous les cours de M. Dupont du lundi au mardi" ou "Mets les mathématiques le matin"
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <textarea
              value={adjustInstruction}
              onChange={e => setAdjustInstruction(e.target.value)}
              placeholder="Votre instruction en français…"
              rows={2}
              style={{ flex: 1, padding: '10px 13px', border: '1.5px solid #d4c8b8', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none', color: '#1a1209' }}
            />
            <button
              style={{ ...btnAI, alignSelf: 'flex-end', opacity: adjusting || !adjustInstruction.trim() ? 0.6 : 1 }}
              disabled={adjusting || !adjustInstruction.trim()}
              onClick={handleAdjust}
            >
              {adjusting ? <><span style={spinInline} />Traitement…</> : '✨ Appliquer'}
            </button>
          </div>

          {adjustResult && (
            <div style={{ marginTop: 12 }}>
              {adjustResult.applied.length > 0 && (
                <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#166534', marginBottom: 4 }}>✅ Modifications appliquées</div>
                  {adjustResult.applied.map((a, i) => <div key={i} style={{ fontSize: 13, color: '#166534' }}>• {a}</div>)}
                </div>
              )}
              {adjustResult.errors.length > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#991b1b', marginBottom: 4 }}>⚠️ Conflits non résolus</div>
                  {adjustResult.errors.map((e, i) => <div key={i} style={{ fontSize: 13, color: '#7f1d1d' }}>• {e}</div>)}
                </div>
              )}
              {adjustResult.applied.length === 0 && adjustResult.errors.length === 0 && (
                <div style={{ fontSize: 13, color: '#a89478', fontStyle: 'italic' }}>{adjustResult.message}</div>
              )}
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
const btnAI:     React.CSSProperties = { padding: '10px 18px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnSec:    React.CSSProperties = { padding: '9px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt:  React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt:      React.CSSProperties = { padding: '10px 8px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', border: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.5px' }
const spinInline: React.CSSProperties = { display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle' }
