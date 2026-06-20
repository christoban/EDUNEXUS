'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface GridConfig {
  heureDebut: string; dureePeriode: number
  periodesAvantP1: number; dureePetitePause: number
  periodesAvantP2: number; dureeGrandePause: number
  periodesApresP2: number; joursActifs: string[]
}

interface Assignment {
  subjectId: string; subjectName: string; coefficient: number
  currentTeacherId: string | null; currentTeacherName: string | null
  eligibleTeachers: { id: string; name: string }[]
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const DAY_NAME: Record<string, string> = {
  LUNDI: 'Lundi', MARDI: 'Mardi', MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi', VENDREDI: 'Vendredi', SAMEDI: 'Samedi',
}
const DAY_MAP: Record<string, number> = {
  LUNDI: 1, MARDI: 2, MERCREDI: 3, JEUDI: 4, VENDREDI: 5, SAMEDI: 6,
}

// Palette de couleurs par matière (hash stable)
const SUBJECT_PALETTES = [
  { bg: 'rgba(5,150,105,0.10)', border: '#059669', text: '#047857' },
  { bg: 'rgba(37,99,235,0.09)', border: '#2563eb', text: '#1d4ed8' },
  { bg: 'rgba(217,119,6,0.09)', border: '#d97706', text: '#b45309' },
  { bg: 'rgba(139,92,246,0.09)', border: '#7c3aed', text: '#6d28d9' },
  { bg: 'rgba(236,72,153,0.09)', border: '#db2777', text: '#be185d' },
  { bg: 'rgba(20,184,166,0.09)', border: '#0d9488', text: '#0f766e' },
  { bg: 'rgba(239,68,68,0.09)', border: '#dc2626', text: '#b91c1c' },
  { bg: 'rgba(251,146,60,0.09)', border: '#ea580c', text: '#c2410c' },
]
function subjectColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length]
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function SectionTimetable({ onToast }: Props) {
  const [classes, setClasses]             = useState<ClassItem[]>([])
  const [classId, setClassId]             = useState('')
  const [timetable, setTimetable]         = useState<Timetable | null>(null)
  const [gridConfig, setGridConfig]       = useState<GridConfig | null>(null)
  const [squelette, setSquelette]         = useState<PeriodeGrille[]>([])
  const [assignments, setAssignments]     = useState<Assignment[]>([])
  const [loading, setLoading]             = useState(false)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [generating, setGenerating]       = useState(false)
  const [publishing, setPublishing]       = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  // Modal
  const [modalSlot, setModalSlot]         = useState<TimetableSlot | null>(null)
  const [modalSubjectId, setModalSubjectId] = useState('')
  const [modalTeacherId, setModalTeacherId] = useState('')
  const [modalTeacherName, setModalTeacherName] = useState('')
  const [saving, setSaving]               = useState(false)
  const [conflictMsg, setConflictMsg]     = useState<string | null>(null)
  const conflictTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Charger classes et config grille au montage
  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
    ]).then(([classData, configData]) => {
      setClasses(classData.data || [])
      if (configData.data) {
        setGridConfig(configData.data.config)
        setSquelette(configData.data.squelette)
      }
    }).catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  // Charger EDT + affectations quand classId change
  const fetchTimetable = useCallback(async (cid?: string) => {
    const id = cid ?? classId
    if (!id) return
    try {
      setLoading(true); setError(null)
      const [tmRes, assRes] = await Promise.all([
        fetchApi(`/api/v2/timetables?classId=${id}`, { credentials: 'include' }),
        fetchApi(`/api/v2/teaching-assignments?classId=${id}`, { credentials: 'include' }),
      ])
      const tmData  = await tmRes.json()
      const assData = await assRes.json()
      if (!tmRes.ok) throw new Error(tmData.message || 'Erreur chargement EDT')
      const list: Timetable[] = tmData.data || []
      setTimetable(list[0] ?? null)
      setAssignments(assData.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [classId])

  const handleClassChange = (newClassId: string) => {
    setClassId(newClassId)
    setTimetable(null)
    setError(null)
    if (newClassId) fetchTimetable(newClassId)
  }

  const handleGenerate = async () => {
    if (!classId) return
    setGenerating(true)
    try {
      const res = await fetchApi('/api/v2/timetables/generate-skeleton', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      })
      const data = await res.json()
      if (!res.ok) {
        // EDT déjà existant → charger
        if (res.status === 409 && data.data?.timetableId) { fetchTimetable(); return; }
        throw new Error(data.message || 'Erreur génération')
      }
      onToast('Squelette généré !', 'success')
      setTimetable(data.data)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur génération', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handlePublish = async () => {
    if (!timetable) return
    setPublishing(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/publish`, {
        method: 'PUT', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur publication')
      onToast('Emploi du temps publié !', 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de publication', 'error')
    } finally {
      setPublishing(false)
    }
  }

  // ─── Modal ─────────────────────────────────────────────────────────────────
  const openModal = (slot: TimetableSlot) => {
    setModalSlot(slot)
    setModalSubjectId(slot.subject?.id ?? '')
    setModalTeacherId(slot.teacher?.id ?? '')
    setModalTeacherName(slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '')
    setConflictMsg(null)
  }

  const handleSubjectSelect = (subjectId: string) => {
    setModalSubjectId(subjectId)
    setConflictMsg(null)
    if (!subjectId) { setModalTeacherId(''); setModalTeacherName(''); return; }
    const aff = assignments.find(a => a.subjectId === subjectId)
    setModalTeacherId(aff?.currentTeacherId ?? '')
    setModalTeacherName(aff?.currentTeacherName ?? (aff?.currentTeacherId ? '(enseignant assigné)' : 'Non assigné'))
  }

  const handleSaveSlot = async () => {
    if (!modalSlot) return
    setSaving(true); setConflictMsg(null)
    try {
      // Vérification conflit avant envoi
      if (modalTeacherId) {
        const chkRes = await fetchApi(
          `/api/v2/timetables/check-conflict?teacherId=${modalTeacherId}&dayOfWeek=${modalSlot.dayOfWeek}&startTime=${encodeURIComponent(modalSlot.startTime)}&excludeSlotId=${modalSlot.id}`,
          { credentials: 'include' }
        )
        const chkData = await chkRes.json()
        if (chkData.data?.hasConflict) {
          setConflictMsg(`⚠️ Conflit : cet enseignant est déjà en cours dans la classe ${chkData.data.conflictClass} à ce créneau.`)
          setSaving(false); return
        }
      }

      const res = await fetchApi(`/api/v2/timetables/slots/${modalSlot.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: modalSubjectId || null,
          teacherId: modalTeacherId || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'CONFLIT_HORAIRE') { setConflictMsg(`⚠️ ${data.message}`); return; }
        if (data.code === 'VOLUME_AP_DEPASSE') { setConflictMsg(`⚠️ ${data.message}`); return; }
        throw new Error(data.message || 'Erreur sauvegarde')
      }

      // Mettre à jour le slot dans l'état local
      setTimetable(prev => prev ? {
        ...prev,
        slots: prev.slots.map(s => s.id === modalSlot.id ? { ...s, ...data.data } : s),
      } : prev)

      setModalSlot(null)
      onToast('Créneau mis à jour', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClearSlot = async () => {
    if (!modalSlot) return
    setSaving(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/slots/${modalSlot.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: null, teacherId: null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setTimetable(prev => prev ? {
        ...prev,
        slots: prev.slots.map(s => s.id === modalSlot.id ? { ...s, subject: null, teacher: null } : s),
      } : prev)
      setModalSlot(null)
      onToast('Créneau vidé', 'info')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ─── Construction de la grille ─────────────────────────────────────────────
  const slots = timetable?.slots ?? []
  const slotMap = new Map<string, TimetableSlot>()
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.startTime}`, s)

  const joursActifs = gridConfig?.joursActifs ?? ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
  const joursNumeriques = joursActifs.map(j => DAY_MAP[j]).filter(Boolean)

  // Calcul du remplissage
  const totalCours = slots.filter(s => s.kind === 'CLASS').length
  const remplis    = slots.filter(s => s.kind === 'CLASS' && s.subject).length
  const pct        = totalCours > 0 ? Math.round(remplis / totalCours * 100) : 0

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        .tt-cell-hover:hover { background: rgba(5,150,105,0.05) !important; cursor: pointer; }
        .tt-cell-filled:hover { opacity: 0.88; cursor: pointer; }
      `}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={sTitle}>Emploi du temps</div>
          <div style={sSub}>
            {timetable
              ? `${timetable.class.name} — ${remplis}/${totalCours} créneaux remplis (${pct}%) · ${timetable.status === 'PUBLISHED' ? '✅ Publié' : '📝 Brouillon'}`
              : gridConfig ? 'Sélectionnez une classe pour afficher son emploi du temps' : '⚠️ Grille horaire non configurée'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select value={classId} onChange={e => handleClassChange(e.target.value)} style={selectSt} disabled={loadingClasses}>
            <option value="">{loadingClasses ? 'Chargement…' : 'Sélectionner une classe'}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {timetable && timetable.status !== 'PUBLISHED' && (
            <button style={btnPrim} onClick={handlePublish} disabled={publishing}>
              {publishing ? <Spinner /> : '📤 Valider et publier'}
            </button>
          )}
        </div>
      </div>

      {/* Grille non configurée */}
      {!gridConfig && !loadingClasses && (
        <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 14, padding: '18px 22px', marginBottom: 20, fontSize: 14, color: '#92400e' }}>
          <strong>Grille horaire non configurée.</strong> Rendez-vous dans <strong>Grille horaire</strong> pour définir les horaires de la journée scolaire avant de créer des emplois du temps.
        </div>
      )}

      {/* Chargement */}
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div style={spinnerStyle} /></div>}

      {/* Erreur */}
      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span>
          <span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={() => fetchTimetable()} style={btnSec}>Réessayer</button>
        </div>
      )}

      {/* Aucune classe */}
      {!loading && !error && !classId && (
        <EmptyState icon="🗓️" title="Sélectionnez une classe" sub="Choisissez une classe pour afficher ou créer son emploi du temps." />
      )}

      {/* Classe sélectionnée, pas d'EDT */}
      {!loading && !error && classId && !timetable && gridConfig && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>📅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucun emploi du temps</div>
          <div style={{ fontSize: 15, color: '#a89478', marginBottom: 28 }}>
            Générez le squelette de l'emploi du temps à partir de la grille horaire configurée.<br />
            Vous pourrez ensuite remplir chaque créneau avec une matière et un enseignant.
          </div>
          <button style={{ ...btnPrim, fontSize: 17, padding: '13px 28px' }} onClick={handleGenerate} disabled={generating}>
            {generating ? <><Spinner /> Génération…</> : '✨ Générer le squelette'}
          </button>
        </div>
      )}

      {/* Grille EDT */}
      {!loading && !error && timetable && squelette.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          {/* Barre de progression */}
          <div style={{ background: '#f8f5f0', borderBottom: '1px solid #e8e0d4', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45', whiteSpace: 'nowrap' }}>
              {remplis}/{totalCours} créneaux
            </span>
            <div style={{ flex: 1, background: '#e8e0d4', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#059669' : '#d97706', transition: 'width 0.3s', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? '#059669' : '#d97706' }}>{pct}%</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={{ ...thSt, width: 100 }}>Horaire</th>
                  {joursActifs.map(j => <th key={j} style={thSt}>{DAY_NAME[j] ?? j}</th>)}
                </tr>
              </thead>
              <tbody>
                {squelette.map((periode, idx) => {
                  if (periode.type !== 'COURS') {
                    // Ligne pause
                    const isPetite = periode.type === 'PETITE_PAUSE'
                    return (
                      <tr key={`pause-${idx}`}>
                        <td colSpan={joursActifs.length + 1}
                          style={{ textAlign: 'center', padding: '5px 12px', background: isPetite ? '#fef9f0' : '#fef3e2', borderTop: '1px solid #e8e0d4', borderBottom: '1px solid #e8e0d4', fontSize: 12, fontWeight: 700, color: isPetite ? '#b45309' : '#92400e', letterSpacing: '0.5px' }}>
                          {isPetite ? '☕' : '🍽️'} {isPetite ? 'Petite pause' : 'Grande pause'} — {periode.debut} à {periode.fin} ({periode.duree} min)
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={`cours-${periode.debut}`}>
                      <td style={{ padding: '8px 10px', background: '#f8f5f0', fontSize: 13, fontWeight: 800, color: '#a89478', textAlign: 'center', border: '1px solid #e8e0d4', whiteSpace: 'nowrap' }}>
                        {periode.debut}<br /><span style={{ fontSize: 11, fontWeight: 600 }}>{periode.fin}</span>
                      </td>
                      {joursActifs.map(jour => {
                        const dayNum = DAY_MAP[jour]
                        const slot = slotMap.get(`${dayNum}-${periode.debut}`)
                        const filled = !!(slot?.subject)
                        const col = slot?.subject ? subjectColor(slot.subject.id) : null

                        return (
                          <td key={jour}
                            style={{ padding: 0, border: '1px solid #e8e0d4', verticalAlign: 'top', minWidth: 120, height: 68 }}
                            onClick={() => slot && openModal(slot)}>
                            {slot ? (
                              filled ? (
                                <div className="tt-cell-filled"
                                  style={{ padding: '8px 10px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: col!.text, lineHeight: 1.2 }}>{slot.subject!.name}</div>
                                  <div style={{ fontSize: 11, color: '#a89478', marginTop: 2 }}>
                                    {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: '#f59e0b' }}>Sans enseignant</span>}
                                  </div>
                                </div>
                              ) : (
                                <div className="tt-cell-hover"
                                  style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                                  <span style={{ fontSize: 20, color: '#d4c8b8' }}>+</span>
                                </div>
                              )
                            ) : (
                              <div style={{ height: '100%', background: '#fafaf9' }} />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal saisie créneau */}
      {modalSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) setModalSlot(null) }}>
          <div style={{ background: 'white', borderRadius: 18, padding: '28px 30px', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 21, fontWeight: 700, color: '#1a1209', marginBottom: 4 }}>
              Remplir le créneau
            </div>
            <div style={{ fontSize: 13, color: '#a89478', marginBottom: 22 }}>
              {['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][modalSlot.dayOfWeek]} · {modalSlot.startTime}–{modalSlot.endTime}
            </div>

            {conflictMsg && (
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
                {conflictMsg}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={labelSt}>Matière</label>
              <select value={modalSubjectId} onChange={e => handleSubjectSelect(e.target.value)} style={inputSt}>
                <option value="">— Sélectionner une matière —</option>
                {assignments.map(a => (
                  <option key={a.subjectId} value={a.subjectId}>
                    {a.subjectName} {a.coefficient > 0 ? `(coeff. ${a.coefficient})` : ''}
                    {a.currentTeacherId ? '' : ' ⚠️'}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelSt}>Enseignant <span style={{ fontWeight: 400, color: '#b8a898' }}>(déterminé par les affectations)</span></label>
              <div style={{ ...inputSt, background: '#f8f5f0', color: modalTeacherId ? '#1a1209' : '#c4b8a4', pointerEvents: 'none' as const }}>
                {modalTeacherId ? modalTeacherName : 'Sera déterminé par les affectations pédagogiques'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {modalSlot.subject && (
                <button style={{ ...btnSec, color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }} onClick={handleClearSlot} disabled={saving}>
                  Vider
                </button>
              )}
              <button style={btnSec} onClick={() => setModalSlot(null)} disabled={saving}>Annuler</button>
              <button style={btnPrim} onClick={handleSaveSlot} disabled={saving || !modalSubjectId}>
                {saving ? <><Spinner /> Sauvegarde…</> : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Petits composants ────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 16, color: '#a89478' }}>{sub}</div>
    </div>
  )
}

function Spinner() {
  return (
    <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle', marginRight: 6 }} />
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const sTitle:   React.CSSProperties = { fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub:     React.CSSProperties = { fontSize: 16, color: '#a89478', marginTop: 3 }
const btnPrim:  React.CSSProperties = { padding: '10px 18px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }
const btnSec:   React.CSSProperties = { padding: '9px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt:     React.CSSProperties = { padding: '10px 8px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', border: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.5px' }
const labelSt:  React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 7 }
const inputSt:  React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #d4c8b8', fontSize: 15, fontWeight: 600, color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'white' }
const spinnerStyle: React.CSSProperties = { width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }
