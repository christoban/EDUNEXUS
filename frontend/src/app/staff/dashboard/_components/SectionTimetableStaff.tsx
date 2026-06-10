'use client'
import { useState, useEffect } from 'react'

interface TimePeriod { id: string; startTime: string; endTime: string; label: string; type: 'CLASS' | 'BREAK' | 'ACTIVITY' }
interface ClassItem { id: string; name: string }
interface AcademicYear { id: string; name: string }
interface SubjectItem { id: string; name: string }
interface TeacherItem { id: string; firstName: string; lastName: string }
interface TimetableSlot {
  id: string; dayOfWeek: number; startTime: string; endTime: string; room: string | null; kind: string
  subject: { id: string; name: string } | null
  teacher: { id: string; firstName: string; lastName: string } | null
}
interface ModalState {
  mode: 'add' | 'edit'; dayOfWeek: number; startTime: string; endTime: string
  kind: string; subjectId: string; teacherId: string; room: string; slotId?: string
}
interface Props { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const LS_KEY = 'edunexus_time_periods'
const KIND_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  CLASS:    { bg: 'linear-gradient(135deg,rgba(5,150,105,0.11),rgba(5,150,105,0.05))', border: '#059669', text: '#047857' },
  BREAK:    { bg: '#f5f3ef', border: '#d4c8b8', text: '#a89478' },
  ACTIVITY: { bg: 'rgba(217,119,6,0.09)', border: '#d97706', text: '#b45309' },
  TD:       { bg: 'rgba(37,99,235,0.08)', border: '#2563eb', text: '#1d4ed8' },
}
let _pid = 0
const uid = () => `p${++_pid}`

export default function SectionTimetableStaff({ onToast }: Props) {
  const [view, setView]     = useState<'setup' | 'select' | 'grid'>('setup')

  // ── Étape 0 ───────────────────────────────────────────────────────────────
  const [periods, setPeriods] = useState<TimePeriod[]>([])
  const [draft, setDraft]     = useState({ startTime: '', endTime: '', label: '', type: 'CLASS' as TimePeriod['type'] })
  const [draftErr, setDraftErr] = useState('')

  // ── Étape 1 ───────────────────────────────────────────────────────────────
  const [classes, setClasses]   = useState<ClassItem[]>([])
  const [years, setYears]       = useState<AcademicYear[]>([])
  const [classId, setClassId]   = useState('')
  const [yearId, setYearId]     = useState('')
  const [loadingOpen, setLoadingOpen] = useState(false)

  // ── Étape 2 ───────────────────────────────────────────────────────────────
  const [timetableId, setTimetableId] = useState('')
  const [slots, setSlots]     = useState<TimetableSlot[]>([])
  const [showSat, setShowSat] = useState(false)
  const [published, setPublished] = useState(false)
  const [selectedClass, setSelectedClass] = useState('')

  // ── Étape 3 ───────────────────────────────────────────────────────────────
  const [modal, setModal]         = useState<ModalState | null>(null)
  const [subjects, setSubjects]   = useState<SubjectItem[]>([])
  const [teachers, setTeachers]   = useState<TeacherItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [modalErr, setModalErr]   = useState('')

  // Mount — charger périodes depuis localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const p: TimePeriod[] = JSON.parse(raw)
        if (p.length > 0) { setPeriods(p); setView('select') }
      }
    } catch { /* ignore */ }
  }, [])

  // View select — charger classes + années
  useEffect(() => {
    if (view !== 'select') return
    Promise.all([
      fetch('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
    ]).then(([c, y]) => {
      setClasses(c.data ?? [])
      const yrs: AcademicYear[] = y.data ?? []
      setYears(yrs)
      if (yrs.length > 0 && !yearId) setYearId(yrs[0].id)
    }).catch(() => {})
  }, [view])

  // Modal ouverte — charger matières
  useEffect(() => {
    if (!modal || subjects.length > 0) return
    fetch('/api/v2/subjects', { credentials: 'include' })
      .then(r => r.json()).then(d => setSubjects(d.data ?? []))
      .catch(() => {})
  }, [modal])

  // Modal ouverte — charger enseignants
  useEffect(() => {
    if (!modal || teachers.length > 0) return
    fetch('/api/v2/users?role=TEACHER&limit=100', { credentials: 'include' })
      .then(r => r.json()).then(d => setTeachers(d.data ?? []))
      .catch(() => {})
  }, [modal])

  // ── Période helpers ────────────────────────────────────────────────────────
  const addPeriod = () => {
    if (!draft.startTime || !draft.endTime) { setDraftErr('Heure début et fin obligatoires'); return }
    if (draft.startTime >= draft.endTime) { setDraftErr('L\'heure de fin doit être après le début'); return }
    const label = draft.label.trim() || (
      draft.type === 'BREAK' ? 'Pause' :
      draft.type === 'ACTIVITY' ? 'Activité' :
      `Période ${periods.filter(p => p.type === 'CLASS').length + 1}`
    )
    setPeriods(prev => [...prev, { id: uid(), ...draft, label }])
    setDraft({ startTime: '', endTime: '', label: '', type: 'CLASS' })
    setDraftErr('')
  }

  const removePeriod = (id: string) => setPeriods(prev => prev.filter(p => p.id !== id))
  const movePeriod = (idx: number, dir: -1 | 1) => {
    const arr = [...periods]
    const t = idx + dir
    if (t < 0 || t >= arr.length) return
    ;[arr[idx], arr[t]] = [arr[t], arr[idx]]
    setPeriods(arr)
  }
  const savePeriods = () => {
    if (periods.length === 0) { onToast('Ajoutez au moins une période', 'error'); return }
    localStorage.setItem(LS_KEY, JSON.stringify(periods))
    setView('select')
  }

  // ── Ouvrir EDT ─────────────────────────────────────────────────────────────
  const openEDT = async () => {
    if (!classId || !yearId) { onToast('Sélectionnez une classe et une année scolaire', 'info'); return }
    setLoadingOpen(true)
    try {
      const r1 = await fetch('/api/v2/timetables/manual', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, academicYearId: yearId }),
      })
      const d1 = await r1.json()
      if (!r1.ok) throw new Error(d1.message || 'Erreur')
      const tid: string = d1.data.timetableId
      setTimetableId(tid)

      const r2 = await fetch(`/api/v2/timetables?classId=${classId}`, { credentials: 'include' })
      const d2 = await r2.json()
      const tt = (d2.data ?? []).find((t: any) => t.id === tid)
      const existing: TimetableSlot[] = tt?.slots ?? []
      setSlots(existing)
      setPublished(tt?.status === 'PUBLISHED')
      setSelectedClass(classes.find(c => c.id === classId)?.name ?? '')
      if (existing.some(s => s.dayOfWeek === 6)) setShowSat(true)
      setView('grid')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setLoadingOpen(false)
    }
  }

  // ── Grid ───────────────────────────────────────────────────────────────────
  const gridMap = new Map<string, TimetableSlot>()
  for (const s of slots) gridMap.set(`${s.dayOfWeek}-${s.startTime}`, s)
  const displayDays = showSat ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]

  // ── Modal ──────────────────────────────────────────────────────────────────
  const openAdd = (dayOfWeek: number, p: TimePeriod) => {
    if (published) { onToast('Cet EDT est publié et ne peut plus être modifié.', 'error'); return }
    setModal({ mode: 'add', dayOfWeek, startTime: p.startTime, endTime: p.endTime, kind: 'CLASS', subjectId: '', teacherId: '', room: '' })
    setModalErr('')
  }
  const openEdit = (s: TimetableSlot) => {
    if (published) { onToast('Cet EDT est publié et ne peut plus être modifié.', 'error'); return }
    setModal({ mode: 'edit', dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, kind: s.kind || 'CLASS', subjectId: s.subject?.id ?? '', teacherId: s.teacher?.id ?? '', room: s.room ?? '', slotId: s.id })
    setModalErr('')
  }
  const setMF = <K extends keyof ModalState>(k: K, v: ModalState[K]) =>
    setModal(m => m ? { ...m, [k]: v } : null)

  const submitSlot = async () => {
    if (!modal || !timetableId) return
    setSubmitting(true); setModalErr('')
    const body: Record<string, unknown> = {
      dayOfWeek: Number(modal.dayOfWeek),
      startTime: modal.startTime,
      endTime:   modal.endTime,
      ...(modal.kind      ? { kind:      modal.kind }      : {}),
      ...(modal.subjectId ? { subjectId: modal.subjectId } : {}),
      ...(modal.teacherId ? { teacherId: modal.teacherId } : {}),
      ...(modal.room      ? { room:      modal.room }      : {}),
    }
    try {
      const isEdit = modal.mode === 'edit' && !!modal.slotId
      const url = isEdit
        ? `/api/v2/timetables/${timetableId}/slots/${modal.slotId}`
        : `/api/v2/timetables/${timetableId}/slots`
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 422) { onToast(data.message || 'EDT publié — lecture seule.', 'error'); setModal(null); return }
        setModalErr(data.message || 'Erreur')
        return
      }
      const subObj = subjects.find(s => s.id === modal.subjectId)
      const tchObj = teachers.find(t => t.id === modal.teacherId)
      if (isEdit) {
        setSlots(prev => prev.map(s => s.id === modal.slotId ? {
          ...s,
          dayOfWeek: Number(modal.dayOfWeek), startTime: modal.startTime, endTime: modal.endTime,
          kind: modal.kind, room: modal.room || null,
          subject:  subObj ? { id: subObj.id, name: subObj.name } : s.subject,
          teacher:  tchObj ? { id: tchObj.id, firstName: tchObj.firstName, lastName: tchObj.lastName } : s.teacher,
        } : s))
      } else {
        setSlots(prev => [...prev, {
          id: data.data.creneauId,
          dayOfWeek: Number(modal.dayOfWeek), startTime: modal.startTime, endTime: modal.endTime,
          kind: modal.kind, room: modal.room || null,
          subject:  subObj ? { id: subObj.id, name: subObj.name } : null,
          teacher:  tchObj ? { id: tchObj.id, firstName: tchObj.firstName, lastName: tchObj.lastName } : null,
        }])
        if (Number(modal.dayOfWeek) === 6) setShowSat(true)
      }
      onToast(isEdit ? 'Créneau modifié' : 'Créneau ajouté', 'success')
      setModal(null)
    } catch (err) {
      setModalErr(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        .edt-cell:hover { background: #f0ebe3 !important; color: #a89478 !important; }
        .edt-slot:hover { filter: brightness(0.94); }
        .edt-period-row:hover { background: #faf7f4; }
      `}</style>

      {/* ── ÉTAPE 0 : Configurer les créneaux types ────────────────────────── */}
      {view === 'setup' && (
        <div style={{ maxWidth: 680 }}>
          <div style={sTitle}>Configurer les horaires</div>
          <div style={sSub}>Définissez la liste ordonnée des périodes de votre établissement.</div>

          {/* Liste des périodes */}
          {periods.length > 0 && (
            <div style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 14, overflow: 'hidden', marginTop: 22, marginBottom: 18 }}>
              {periods.map((p, i) => (
                <div key={p.id} className="edt-period-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderBottom: i < periods.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 4 }}>
                    <button onClick={() => movePeriod(i, -1)} disabled={i === 0} style={btnArrow}>▲</button>
                    <button onClick={() => movePeriod(i, 1)} disabled={i === periods.length - 1} style={btnArrow}>▼</button>
                  </div>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: p.type === 'BREAK' ? '#d4c8b8' : p.type === 'ACTIVITY' ? '#d97706' : '#059669',
                    flexShrink: 0,
                  }} />
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1209', minWidth: 90 }}>{p.startTime} – {p.endTime}</div>
                  <div style={{ fontSize: 14, color: p.type === 'BREAK' ? '#a89478' : '#1a1209', flex: 1 }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: '#a89478', padding: '2px 8px', background: '#f5f3ef', borderRadius: 6 }}>
                    {p.type === 'BREAK' ? 'Pause' : p.type === 'ACTIVITY' ? 'Activité' : 'Cours'}
                  </div>
                  <button onClick={() => removePeriod(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 16, padding: 4, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Formulaire ajout période */}
          <div style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 14, padding: '18px 20px', marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1a1209', marginBottom: 14 }}>+ Ajouter une période</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={fLb}>Début</label>
                <input type="time" value={draft.startTime} onChange={e => setDraft(d => ({ ...d, startTime: e.target.value }))} style={{ ...fIn, width: 110 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={fLb}>Fin</label>
                <input type="time" value={draft.endTime} onChange={e => setDraft(d => ({ ...d, endTime: e.target.value }))} style={{ ...fIn, width: 110 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={fLb}>Type</label>
                <select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value as TimePeriod['type'] }))} style={{ ...fIn, width: 130 }}>
                  <option value="CLASS">Cours</option>
                  <option value="BREAK">Pause</option>
                  <option value="ACTIVITY">Activité</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 160 }}>
                <label style={fLb}>Libellé (facultatif)</label>
                <input
                  type="text" placeholder="ex: Période 1, Petite pause…"
                  value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                  style={{ ...fIn, width: '100%' }}
                  onKeyDown={e => e.key === 'Enter' && addPeriod()}
                />
              </div>
              <button onClick={addPeriod} style={{ ...btnPrim, height: 38, alignSelf: 'flex-end', whiteSpace: 'nowrap' }}>+ Ajouter</button>
            </div>
            {draftErr && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{draftErr}</div>}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={savePeriods} style={btnPrim} disabled={periods.length === 0}>
              Enregistrer et ouvrir la grille →
            </button>
            {periods.length === 0 && (
              <div style={{ fontSize: 13, color: '#a89478', alignSelf: 'center' }}>Ajoutez au moins une période pour continuer.</div>
            )}
          </div>
        </div>
      )}

      {/* ── ÉTAPE 1 : Sélectionner la classe ─────────────────────────────── */}
      {view === 'select' && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
            <div style={sTitle}>Emploi du temps</div>
          </div>
          <div style={sSub}>Sélectionnez la classe et l'année scolaire pour ouvrir la grille.</div>

          <div style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 16, padding: '28px 28px', marginTop: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={fLb}>Classe</label>
                <select value={classId} onChange={e => setClassId(e.target.value)} style={{ ...fIn, fontSize: 15 }}>
                  <option value="">Sélectionner une classe…</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={fLb}>Année scolaire</label>
                <select value={yearId} onChange={e => setYearId(e.target.value)} style={{ ...fIn, fontSize: 15 }}>
                  <option value="">Sélectionner une année…</option>
                  {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <button onClick={openEDT} style={btnPrim} disabled={!classId || !yearId || loadingOpen}>
                {loadingOpen
                  ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle', marginRight: 7 }} />Ouverture…</>
                  : '🗓️ Ouvrir l\'EDT'}
              </button>
            </div>
          </div>
          <button onClick={() => setView('setup')} style={{ marginTop: 14, background: 'none', border: 'none', color: '#a89478', fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
            ↩ Reconfigurer les horaires
          </button>
        </div>
      )}

      {/* ── ÉTAPE 2 : La grille visuelle ─────────────────────────────────── */}
      {view === 'grid' && (
        <div>
          {/* En-tête */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={sTitle}>EDT — {selectedClass}</div>
              <div style={sSub}>
                {slots.length} créneau{slots.length !== 1 ? 'x' : ''} ·{' '}
                {published ? '✅ Publié' : '📝 Brouillon'}
                {published && <span style={{ color: '#b45309', fontWeight: 700 }}> · Lecture seule</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Toggle samedi */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none', fontSize: 14, color: '#6b5c45', fontWeight: 700 }}>
                <div
                  onClick={() => setShowSat(v => !v)}
                  style={{
                    width: 38, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer',
                    background: showSat ? '#059669' : '#d4c8b8', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3, left: showSat ? 19 : 3, width: 16, height: 16,
                    borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </div>
                Samedi
              </label>
              <button onClick={() => { setView('select'); setSlots([]); setTimetableId('') }} style={btnSec}>
                ← Changer de classe
              </button>
            </div>
          </div>

          {/* Grille */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            {periods.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#a89478' }}>
                Aucune période configurée. <button onClick={() => setView('setup')} style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', fontSize: 'inherit' }}>Configurer les horaires</button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={{ ...thSt, width: 120 }}>Horaire</th>
                      {displayDays.map(d => (
                        <th key={d} style={thSt}>{DAYS[d - 1]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(p => {
                      const isBreak = p.type === 'BREAK'
                      return (
                        <tr key={p.id}>
                          {/* Colonne horaire */}
                          <td style={{
                            padding: '8px 12px', fontSize: 12, fontWeight: 800, color: '#a89478',
                            textAlign: 'center', border: '1px solid #e8e0d4', whiteSpace: 'nowrap',
                            background: isBreak ? '#f5f3ef' : '#f0ebe3',
                          }}>
                            <div>{p.startTime}</div>
                            <div style={{ fontSize: 11, color: '#c4b8a4' }}>{p.endTime}</div>
                            {isBreak && <div style={{ fontSize: 10, marginTop: 2, color: '#b8a990' }}>{p.label}</div>}
                          </td>
                          {/* Cellules */}
                          {displayDays.map(d => {
                            const slot = gridMap.get(`${d}-${p.startTime}`)
                            const kc = slot ? (KIND_COLORS[slot.kind] ?? KIND_COLORS.CLASS) : null
                            return (
                              <td key={d} style={{
                                padding: 0, border: '1px solid #e8e0d4', verticalAlign: 'top',
                                minWidth: 120, height: 64,
                                background: isBreak ? '#f9f7f4' : undefined,
                              }}>
                                {isBreak ? (
                                  // Cellule pause — non cliquable
                                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ fontSize: 11, color: '#c4b8a4' }}>{p.label}</div>
                                  </div>
                                ) : slot ? (
                                  // Cellule occupée
                                  <div
                                    className="edt-slot"
                                    onClick={() => openEdit(slot)}
                                    style={{
                                      padding: '8px 10px', height: '100%', cursor: 'pointer',
                                      background: kc!.bg, borderLeft: `3px solid ${kc!.border}`,
                                      boxSizing: 'border-box',
                                    }}
                                  >
                                    <div style={{ fontSize: 13, fontWeight: 800, color: kc!.text, lineHeight: 1.2 }}>
                                      {slot.subject?.name ?? '(sans matière)'}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#a89478', marginTop: 2 }}>
                                      {slot.teacher
                                        ? `${slot.teacher.firstName.slice(0, 1)}. ${slot.teacher.lastName}`
                                        : 'Non assigné'}
                                    </div>
                                    {slot.room && <div style={{ fontSize: 10, color: '#c4b8a4', marginTop: 1 }}>Salle {slot.room}</div>}
                                  </div>
                                ) : (
                                  // Cellule vide
                                  <div
                                    className="edt-cell"
                                    onClick={() => openAdd(d, p)}
                                    style={{
                                      height: '100%', display: 'flex', alignItems: 'center',
                                      justifyContent: 'center', cursor: 'pointer',
                                      color: '#e0d8ce', fontSize: 22, fontWeight: 300,
                                    }}
                                  >+</div>
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
            )}
          </div>

          {/* Légende */}
          <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
            {Object.entries({ CLASS: 'Cours', ACTIVITY: 'Activité', TD: 'TD/TP' }).map(([k, lbl]) => {
              const c = KIND_COLORS[k]
              return (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#a89478' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: c.border, opacity: 0.8 }} />
                  {lbl}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ÉTAPE 3 : Modale ajout / modification ────────────────────────── */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => !submitting && setModal(null)}>
          <div style={{
            background: 'white', borderRadius: 18, padding: '28px 30px', width: '100%', maxWidth: 480,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 20 }}>
              {modal.mode === 'add' ? '+ Ajouter un créneau' : '✏️ Modifier le créneau'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Jour */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={fLb}>Jour</label>
                <select value={modal.dayOfWeek} onChange={e => setMF('dayOfWeek', Number(e.target.value))} style={fIn}>
                  {[1, 2, 3, 4, 5, 6].map(d => (
                    <option key={d} value={d}>{DAYS[d - 1]}</option>
                  ))}
                </select>
              </div>

              {/* Heures */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                  <label style={fLb}>Début</label>
                  <input type="time" value={modal.startTime} onChange={e => setMF('startTime', e.target.value)} style={fIn} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
                  <label style={fLb}>Fin</label>
                  <input type="time" value={modal.endTime} onChange={e => setMF('endTime', e.target.value)} style={fIn} />
                </div>
              </div>

              {/* Type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <label style={fLb}>Type</label>
                <select value={modal.kind} onChange={e => setMF('kind', e.target.value)} style={fIn}>
                  <option value="CLASS">Cours</option>
                  <option value="BREAK">Pause</option>
                  <option value="ACTIVITY">Activité</option>
                  <option value="TD">TD / TP</option>
                </select>
              </div>

              {/* Matière — masquée si BREAK */}
              {modal.kind !== 'BREAK' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={fLb}>Matière</label>
                  <select value={modal.subjectId} onChange={e => setMF('subjectId', e.target.value)} style={fIn}>
                    <option value="">— Aucune —</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}

              {/* Enseignant — masqué si BREAK */}
              {modal.kind !== 'BREAK' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={fLb}>Enseignant</label>
                  <select value={modal.teacherId} onChange={e => setMF('teacherId', e.target.value)} style={fIn}>
                    <option value="">— Aucun —</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                  </select>
                </div>
              )}

              {/* Salle — masquée si BREAK */}
              {modal.kind !== 'BREAK' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <label style={fLb}>Salle (facultatif)</label>
                  <input
                    type="text" placeholder="ex: Salle B2, Labo Physique…"
                    value={modal.room} onChange={e => setMF('room', e.target.value)}
                    style={fIn}
                  />
                </div>
              )}

              {/* Erreur dans la modale */}
              {modalErr && (
                <div style={{ background: '#fee2e2', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '11px 14px', color: '#dc2626', fontSize: 14, fontWeight: 600 }}>
                  ⚠ {modalErr}
                </div>
              )}

              {/* Boutons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={submitSlot} style={btnPrim} disabled={submitting}>
                  {submitting
                    ? <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle', marginRight: 7 }} />Enregistrement…</>
                    : modal.mode === 'add' ? 'Enregistrer' : 'Modifier'}
                </button>
                <button onClick={() => setModal(null)} style={btnSec} disabled={submitting}>Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub:   React.CSSProperties = { fontSize: 16, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec:  React.CSSProperties = { padding: '9px 18px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnArrow: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#a89478', fontSize: 10, padding: '1px 3px', lineHeight: 1 }
const fLb: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b5c45' }
const fIn: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 9, padding: '8px 12px', fontSize: 14, color: '#1a1209', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }
const thSt: React.CSSProperties = { padding: '10px 10px', textAlign: 'center', fontSize: 12, fontWeight: 800, color: '#a89478', background: '#f0ebe3', border: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.5px' }
