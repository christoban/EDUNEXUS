'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem {
  id: string; name: string; level: string | null; filiere: string | null; serie: string | null
  capacity: number
  professorPrincipal: { id: string; firstName: string; lastName: string } | null
  _count: { students: number }
}

interface SchoolInfo {
  id: string
  subsystem: string
  hasPEBSFrancophone: boolean
  hasPEBSAnglophone: boolean
}

interface Teacher { id: string; firstName: string; lastName: string }
interface SubGroup { id: string; name: string }
interface StudentItem { id: string; firstName: string; lastName: string; studentProfile?: { id: string } | null }

const SECOND_CYCLE_SERIES = [
  { value: 'A4-Allemand', label: 'A4 – Allemand' },
  { value: 'A4-Arabe', label: 'A4 – Arabe' },
  { value: 'A4-Chinois', label: 'A4 – Chinois' },
  { value: 'A4-Espagnol', label: 'A4 – Espagnol' },
  { value: 'A', label: 'A' },
  { value: 'C', label: 'C' },
  { value: 'D', label: 'D' },
  { value: 'TI', label: 'TI' },
]

const FILIERE_OPTIONS = [
  { value: 'Scientifique', label: 'Scientifique' },
  { value: 'Littéraire', label: 'Littéraire' },
  { value: 'Technique', label: 'Technique' },
]

function serieToFiliere(serie: string): string {
  if (/^A4/.test(serie)) return 'Littéraire'
  if (serie === 'A') return 'Littéraire'
  if (serie === 'C' || serie === 'D') return 'Scientifique'
  if (serie === 'TI') return 'Technique'
  return ''
}

function isCollegLevel(level: string, name: string): boolean {
  const src = (level || name).trim()
  return /^[3456](e|ème|e\s|$)/i.test(src)
}

function inferFromName(name: string): { filiere: string; serie: string } {
  const n = name.trim()
  const a4Match = n.match(/A4[-\s](\w+)/i)
  if (a4Match) return { filiere: 'Littéraire', serie: `A4-${a4Match[1]}` }
  if (/\bA4\b/i.test(n)) return { filiere: 'Littéraire', serie: 'A4' }
  if (/\bTI\b/.test(n)) return { filiere: 'Technique', serie: 'TI' }
  if (/^(Tle|Terminale|1[eèê]re?|Première)\s/i.test(n)) {
    if (/\bC$/i.test(n)) return { filiere: 'Scientifique', serie: 'C' }
    if (/\bD$/i.test(n)) return { filiere: 'Scientifique', serie: 'D' }
  }
  return { filiere: '', serie: '' }
}

function getLevelBadge(name: string): { bg: string; color: string; label: string } {
  const u = name.toUpperCase()
  if (u.startsWith('6') || u.startsWith('5') || u.startsWith('4')) return { bg: '#dbeafe', color: '#1e40af', label: 'Collège' }
  if (u.startsWith('3')) return { bg: '#ede9fe', color: '#5b21b6', label: 'BEPC' }
  if (u.startsWith('2NDE') || u.startsWith('2')) return { bg: '#ffedd5', color: '#9a3412', label: 'Lycée' }
  if (u.startsWith('1')) return { bg: '#ffedd5', color: '#9a3412', label: 'Lycée' }
  if (u.startsWith('TLE') || u.startsWith('T ') || u.startsWith('T.')) return { bg: '#fee2e2', color: '#991b1b', label: 'BAC' }
  return { bg: '#f1f5f9', color: '#475569', label: name.split(' ')[0] ?? '' }
}

const EMPTY_FORM = { name: '', level: '', filiere: '', serie: '', capacity: '40', loading: false, error: '' }
const EMPTY_PP   = { open: false, classId: '', className: '', teacherSearch: '', teachers: [] as Teacher[], selected: null as Teacher | null, loading: false, error: '' }
const EMPTY_MOD  = { open: false, classId: '', name: '', level: '', filiere: '', serie: '', capacity: '', loading: false, error: '' }
const EMPTY_SG   = { open: false, classId: '', className: '', subgroups: [] as SubGroup[], newName: '', creating: false, error: '' }
const EMPTY_ASSIGN = { open: false, subGroupId: '', subGroupName: '', classId: '', students: [] as StudentItem[], selected: new Set<string>(), loading: false, submitting: false, error: '' }

export default function SectionClasses({ onToast }: Props) {
  const [classes, setClasses]         = useState<ClassItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [createOpen, setCreateOpen]   = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [ppForm, setPPForm]           = useState(EMPTY_PP)
  const [modForm, setModForm]         = useState(EMPTY_MOD)
  const [delConfirm, setDelConfirm]   = useState<{ classId: string; className: string } | null>(null)
  const [deleting, setDeleting]       = useState(false)
  const [sgForm, setSgForm]           = useState(EMPTY_SG)
  const [assignForm, setAssignForm]   = useState(EMPTY_ASSIGN)
  const [schoolInfo, setSchoolInfo]   = useState<SchoolInfo | null>(null)

  const fetchClasses = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setClasses(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.data) setSchoolInfo(data.data) })
      .catch(() => {})
  }, [])

  const totalEleves = classes.reduce((s, c) => s + c._count.students, 0)

  // ── Créer une classe ──────────────────────────────────────────────────────
  const submitCreate = async () => {
    if (!form.name.trim()) { setForm(f => ({ ...f, error: 'Nom de la classe obligatoire' })); return }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/classes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          level: form.level || undefined,
          filiere: form.filiere || undefined,
          serie: form.serie || undefined,
          capacity: parseInt(form.capacity) || 40,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Classe ${form.name} créée`, 'success')
      setCreateOpen(false); setForm(EMPTY_FORM)
      fetchClasses()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Modifier une classe ───────────────────────────────────────────────────
  const openMod = (cls: ClassItem) => {
    const college = isCollegLevel(cls.level ?? '', cls.name)
    let filiere = cls.filiere ?? ''
    let serie = cls.serie ?? ''
    if (!college) {
      if (!filiere && !serie) {
        const inferred = inferFromName(cls.name)
        filiere = inferred.filiere
        serie = inferred.serie
      } else if (!filiere && serie) {
        filiere = serieToFiliere(serie)
      }
    }
    setModForm({
      open: true, classId: cls.id, name: cls.name, level: cls.level ?? '',
      filiere, serie,
      capacity: String(cls.capacity), loading: false, error: '',
    })
  }

  const submitMod = async () => {
    if (!modForm.name.trim()) { setModForm(f => ({ ...f, error: 'Nom obligatoire' })); return }
    setModForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/${modForm.classId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modForm.name.trim(),
          level: modForm.level || undefined,
          filiere: modForm.filiere || undefined,
          serie: modForm.serie || undefined,
          capacity: parseInt(modForm.capacity) || 40,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Classe modifiée', 'success')
      setModForm(EMPTY_MOD); fetchClasses()
    } catch (err) {
      setModForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Assigner PP ───────────────────────────────────────────────────────────
  const openPP = async (cls: ClassItem) => {
    setPPForm({ open: true, classId: cls.id, className: cls.name, teacherSearch: '', teachers: [], selected: null, loading: false, error: '' })
    try {
      const res = await fetchApi('/api/v2/users?role=TEACHER&limit=100', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setPPForm(f => ({ ...f, teachers: data.data || [] }))
    } catch { /* silencieux */ }
  }

  const submitPP = async () => {
    if (!ppForm.selected) { setPPForm(f => ({ ...f, error: 'Sélectionnez un enseignant' })); return }
    setPPForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/${ppForm.classId}/professor-principal`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherUserId: ppForm.selected.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`PP assigné : ${ppForm.selected.firstName} ${ppForm.selected.lastName}`, 'success')
      setPPForm(EMPTY_PP); fetchClasses()
    } catch (err) {
      setPPForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  function getFiliereOptions(college: boolean): { value: string; label: string }[] {
    if (!college || !schoolInfo) return []
    const isFR = schoolInfo.subsystem === 'FRANCOPHONE'
    const opts: { value: string; label: string }[] = isFR
      ? [{ value: 'FR_GENERAL', label: 'Général FR' }]
      : [{ value: 'EN_GENERAL', label: 'Général EN' }]
    if (isFR && schoolInfo.hasPEBSFrancophone) opts.push({ value: 'FR_PEBS', label: 'PEBS FR' })
    if (!isFR && schoolInfo.hasPEBSAnglophone) opts.push({ value: 'EN_PEBS', label: 'PEBS EN' })
    return opts
  }

  const filteredTeachers = ppForm.teacherSearch
    ? ppForm.teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(ppForm.teacherSearch.toLowerCase()))
    : ppForm.teachers

  // ── ACTION 1 — Supprimer une classe ───────────────────────────────────────
  const confirmDelete = async () => {
    if (!delConfirm) return
    setDeleting(true)
    try {
      const res = await fetchApi(`/api/v2/classes/${delConfirm.classId}`, {
        method: 'DELETE', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Classe "${delConfirm.className}" supprimée`, 'success')
      setClasses(prev => prev.filter(c => c.id !== delConfirm.classId))
      setDelConfirm(null)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setDeleting(false)
    }
  }

  // ── ACTION 2 — Gérer les sous-groupes ─────────────────────────────────────
  const openSubgroups = (cls: ClassItem) => {
    setSgForm({ open: true, classId: cls.id, className: cls.name, subgroups: [], newName: '', creating: false, error: '' })
  }

  const createSubgroup = async () => {
    if (!sgForm.newName.trim()) { setSgForm(f => ({ ...f, error: 'Nom du sous-groupe obligatoire' })); return }
    setSgForm(f => ({ ...f, creating: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/${sgForm.classId}/subgroups`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sgForm.newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      const newSg: SubGroup = { id: data.data.sousGroupeId, name: sgForm.newName.trim() }
      setSgForm(f => ({ ...f, subgroups: [...f.subgroups, newSg], newName: '', creating: false }))
      onToast(`Sous-groupe "${newSg.name}" créé`, 'success')
    } catch (err) {
      setSgForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', creating: false }))
    }
  }

  // ── ACTION 3 — Assigner des élèves à un sous-groupe ───────────────────────
  const openAssign = async (sg: SubGroup) => {
    setAssignForm({ open: true, subGroupId: sg.id, subGroupName: sg.name, classId: sgForm.classId, students: [], selected: new Set(), loading: true, submitting: false, error: '' })
    try {
      const res = await fetchApi(`/api/v2/users?role=STUDENT&classId=${sgForm.classId}&limit=200`, { credentials: 'include' })
      const data = await res.json()
      setAssignForm(f => ({ ...f, students: data.data ?? [], loading: false }))
    } catch {
      setAssignForm(f => ({ ...f, loading: false, error: 'Erreur de chargement des élèves' }))
    }
  }

  const toggleStudent = (id: string) => {
    setAssignForm(f => {
      const next = new Set(f.selected)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...f, selected: next }
    })
  }

  const submitAssign = async () => {
    if (assignForm.selected.size === 0) { setAssignForm(f => ({ ...f, error: 'Sélectionnez au moins un élève' })); return }
    setAssignForm(f => ({ ...f, submitting: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/classes/subgroups/${assignForm.subGroupId}/students`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentProfileIds: Array.from(assignForm.selected) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Élèves assignés au sous-groupe "${assignForm.subGroupName}"`, 'success')
      setAssignForm(EMPTY_ASSIGN)
    } catch (err) {
      setAssignForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', submitting: false }))
    }
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Classes</div>
          <div style={sSub}>{loading ? '…' : `${classes.length} classe${classes.length > 1 ? 's' : ''} · ${totalEleves} élève${totalEleves > 1 ? 's' : ''}`}</div>
        </div>
        <button style={btnPrim} onClick={() => setCreateOpen(true)}>+ Créer une classe</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}
      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span>
          <span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={fetchClasses} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && classes.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🏫</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucune classe créée</div>
          <div style={{ fontSize: 16, color: '#a89478', marginBottom: 22 }}>Créez votre première classe pour commencer l&apos;année scolaire.</div>
          <button style={btnPrim} onClick={() => setCreateOpen(true)}>+ Créer une classe</button>
        </div>
      )}

      {!loading && !error && classes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {classes.map(cls => {
            const badge = getLevelBadge(cls.name)
            const ppName = cls.professorPrincipal ? `${cls.professorPrincipal.firstName} ${cls.professorPrincipal.lastName}` : 'Non assigné'
            return (
              <div key={cls.id}
                style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 22, transition: 'all 0.15s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)', borderColor: '#d4c8b8' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none', borderColor: '#e8e0d4' })}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: '#1a1209' }}>{cls.name}</div>
                  <span style={{ background: badge.bg, color: badge.color, padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>{badge.label}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 16, color: '#6b5c45', fontWeight: 600, marginBottom: 12 }}>
                  <span>👨‍🎓 <strong style={{ color: '#1a1209' }}>{cls._count.students}</strong> élève{cls._count.students > 1 ? 's' : ''}</span>
                  <span>🪑 Cap. <strong style={{ color: '#1a1209' }}>{cls.capacity}</strong></span>
                </div>
                <div style={{ fontSize: 15, color: '#a89478', fontWeight: 600, marginBottom: 14 }}>
                  🧑‍💼 Prof. principal : <strong style={{ color: cls.professorPrincipal ? '#6b5c45' : '#a89478', fontStyle: cls.professorPrincipal ? 'normal' : 'italic' }}>{ppName}</strong>
                </div>
                <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {cls.filiere && (
                    <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                      {cls.filiere === 'FR_PEBS' ? 'PEBS FR' : cls.filiere === 'EN_PEBS' ? 'PEBS EN' : cls.filiere === 'FR_GENERAL' ? 'Général FR' : cls.filiere === 'EN_GENERAL' ? 'Général EN' : cls.filiere}
                    </span>
                  )}
                  {cls.serie && (
                    <span style={{ background: '#f0ebe3', color: '#6b5c45', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>Série {cls.serie}</span>
                  )}
                </div>
                <div style={{ paddingTop: 12, borderTop: '1px solid #e8e0d4', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button onClick={() => openPP(cls)} style={btnSecSm}>🧑‍💼 PP</button>
                  <button onClick={() => openMod(cls)} style={btnSecSm}>✏️ Modifier</button>
                  <button onClick={() => openSubgroups(cls)} style={btnSecSm}>🔗 Sous-groupes</button>
                  <button onClick={() => setDelConfirm({ classId: cls.id, className: cls.name })} style={{ ...btnSecSm, color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}>🗑️</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal créer ── */}
      {createOpen && (() => {
        const college = isCollegLevel(form.level, form.name)
        return (
        <ModalOverlay onClose={() => { setCreateOpen(false); setForm(EMPTY_FORM) }}>
          <div style={sModalTitle}>Créer une classe</div>
          <div style={sLabel}>Nom de la classe *</div>
          <input style={sInput} placeholder="Ex: Tle D, 3ème B, Form 5 Science" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLabel}>Niveau</div>
              <input style={sInput} placeholder="Ex: Tle, 1ère, 6e" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Filière</div>
              {college ? (
                <select style={sInput} value={form.filiere} onChange={e => setForm(f => ({ ...f, filiere: e.target.value }))}>
                  <option value="">Sélectionner</option>
                  {getFiliereOptions(college).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <select style={sInput} value={form.filiere} onChange={e => setForm(f => ({ ...f, filiere: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {FILIERE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>
            {!college && (
              <div>
                <div style={sLabel}>Série</div>
                <select style={sInput} value={form.serie} onChange={e => {
                  const serie = e.target.value
                  setForm(f => ({ ...f, serie, filiere: f.filiere || serieToFiliere(serie) }))
                }}>
                  <option value="">— Sélectionner —</option>
                  {SECOND_CYCLE_SERIES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <div style={sLabel}>Capacité</div>
              <input style={sInput} type="number" min="1" max="200" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          {form.error && <div style={sError}>{form.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => { setCreateOpen(false); setForm(EMPTY_FORM) }}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={submitCreate} disabled={form.loading}>
              {form.loading ? 'Création…' : 'Créer la classe'}
            </button>
          </div>
        </ModalOverlay>
        )
      })()}

      {/* ── Modal modifier ── */}
      {modForm.open && (() => {
        const college = isCollegLevel(modForm.level, modForm.name)
        return (
        <ModalOverlay onClose={() => setModForm(EMPTY_MOD)}>
          <div style={sModalTitle}>Modifier la classe</div>
          <div style={sLabel}>Nom *</div>
          <input style={sInput} value={modForm.name} onChange={e => setModForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLabel}>Niveau</div>
              <input style={sInput} placeholder="Ex: Tle, 1ère, 6e" value={modForm.level} onChange={e => setModForm(f => ({ ...f, level: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Filière</div>
              {college ? (
                <select style={sInput} value={modForm.filiere} onChange={e => setModForm(f => ({ ...f, filiere: e.target.value }))}>
                  <option value="">Sélectionner</option>
                  {getFiliereOptions(college).map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <select style={sInput} value={modForm.filiere} onChange={e => setModForm(f => ({ ...f, filiere: e.target.value }))}>
                  <option value="">— Sélectionner —</option>
                  {FILIERE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>
            {!college && (
              <div>
                <div style={sLabel}>Série</div>
                <select style={sInput} value={modForm.serie} onChange={e => {
                  const serie = e.target.value
                  setModForm(f => ({ ...f, serie, filiere: f.filiere || serieToFiliere(serie) }))
                }}>
                  <option value="">— Sélectionner —</option>
                  {SECOND_CYCLE_SERIES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <div style={sLabel}>Capacité</div>
              <input style={sInput} type="number" min="1" value={modForm.capacity} onChange={e => setModForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
          {modForm.error && <div style={sError}>{modForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setModForm(EMPTY_MOD)}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: modForm.loading ? 0.7 : 1 }} onClick={submitMod} disabled={modForm.loading}>
              {modForm.loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </ModalOverlay>
        )
      })()}

      {/* ── Modal assigner PP ── */}
      {ppForm.open && (
        <ModalOverlay onClose={() => setPPForm(EMPTY_PP)}>
          <div style={sModalTitle}>Assigner un professeur principal</div>
          <div style={{ fontSize: 15, color: '#a89478', marginBottom: 18 }}>{ppForm.className}</div>
          <div style={sLabel}>Rechercher un enseignant</div>
          <input style={sInput} placeholder="Nom de l'enseignant…" value={ppForm.teacherSearch}
            onChange={e => setPPForm(f => ({ ...f, teacherSearch: e.target.value, selected: null }))} />
          {ppForm.selected && (
            <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
              ✓ {ppForm.selected.firstName} {ppForm.selected.lastName}
            </div>
          )}
          {!ppForm.selected && (
            <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {filteredTeachers.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: '#a89478', fontSize: 14 }}>Aucun enseignant trouvé</div>
              ) : filteredTeachers.map(t => (
                <div key={t.id}
                  onClick={() => setPPForm(f => ({ ...f, selected: t, teacherSearch: `${t.firstName} ${t.lastName}` }))}
                  style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f0ebe3', color: '#1a1209' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf8f5'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                  {t.firstName} {t.lastName}
                </div>
              ))}
            </div>
          )}
          {ppForm.error && <div style={sError}>{ppForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setPPForm(EMPTY_PP)}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: ppForm.loading ? 0.7 : 1 }} onClick={submitPP} disabled={ppForm.loading}>
              {ppForm.loading ? 'Assignation…' : 'Assigner'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── ACTION 1 : Confirmation de suppression ── */}
      {delConfirm && (
        <ModalOverlay onClose={() => !deleting && setDelConfirm(null)}>
          <div style={{ ...sModalTitle, color: '#991b1b' }}>Supprimer la classe</div>
          <div style={{ fontSize: 15, color: '#374151', marginBottom: 24, lineHeight: 1.6 }}>
            Supprimer la classe <strong>{delConfirm.className}</strong> ?<br />
            <span style={{ color: '#dc2626', fontWeight: 600 }}>Cette action est irréversible.</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setDelConfirm(null)} disabled={deleting}>Annuler</button>
            <button
              style={{ ...btnPrim, flex: 1, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', opacity: deleting ? 0.7 : 1 }}
              onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Suppression…' : 'Confirmer la suppression'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── ACTION 2 : Gérer les sous-groupes ── */}
      {sgForm.open && !assignForm.open && (
        <ModalOverlay onClose={() => setSgForm(EMPTY_SG)}>
          <div style={sModalTitle}>Sous-groupes — {sgForm.className}</div>

          {/* Liste des sous-groupes existants */}
          {sgForm.subgroups.length === 0 ? (
            <div style={{ color: '#a89478', fontSize: 14, marginBottom: 18, fontStyle: 'italic' }}>
              Aucun sous-groupe créé pour le moment.
            </div>
          ) : (
            <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, overflow: 'hidden', marginBottom: 18 }}>
              {sgForm.subgroups.map((sg, i) => (
                <div key={sg.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < sgForm.subgroups.length - 1 ? '1px solid #f0ebe3' : 'none', fontSize: 14, color: '#1a1209' }}>
                  <span style={{ fontWeight: 700 }}>🔗 {sg.name}</span>
                  <button onClick={() => openAssign(sg)} style={btnSecSm}>
                    👥 Assigner des élèves
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Créer un nouveau sous-groupe */}
          <div style={sLabel}>Nouveau sous-groupe</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              style={{ ...sInput, marginBottom: 0, flex: 1 }}
              placeholder='Ex: Groupe A, Groupe Bilingue…'
              value={sgForm.newName}
              onChange={e => setSgForm(f => ({ ...f, newName: e.target.value, error: '' }))}
              onKeyDown={e => e.key === 'Enter' && createSubgroup()}
            />
            <button
              style={{ ...btnPrim, whiteSpace: 'nowrap', opacity: sgForm.creating ? 0.7 : 1 }}
              onClick={createSubgroup} disabled={sgForm.creating}>
              {sgForm.creating ? '…' : '+ Créer'}
            </button>
          </div>
          {sgForm.error && <div style={{ ...sError, marginBottom: 12 }}>{sgForm.error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <button style={btnSec2} onClick={() => setSgForm(EMPTY_SG)}>Fermer</button>
          </div>
        </ModalOverlay>
      )}

      {/* ── ACTION 3 : Assigner des élèves à un sous-groupe ── */}
      {assignForm.open && (
        <ModalOverlay onClose={() => setAssignForm(EMPTY_ASSIGN)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button
              onClick={() => setAssignForm(EMPTY_ASSIGN)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a89478', fontSize: 20, padding: 0, lineHeight: 1 }}>
              ←
            </button>
            <div style={sModalTitle}>Assigner des élèves</div>
          </div>
          <div style={{ fontSize: 14, color: '#a89478', marginBottom: 18 }}>
            Sous-groupe : <strong style={{ color: '#6b5c45' }}>{assignForm.subGroupName}</strong>
          </div>

          {assignForm.loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <div style={{ width: 28, height: 28, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
            </div>
          ) : assignForm.students.length === 0 ? (
            <div style={{ color: '#a89478', fontSize: 14, textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
              Aucun élève dans cette classe.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: '#a89478', marginBottom: 8 }}>
                {assignForm.selected.size} élève{assignForm.selected.size !== 1 ? 's' : ''} sélectionné{assignForm.selected.size !== 1 ? 's' : ''}
              </div>
              <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, maxHeight: 260, overflowY: 'auto', marginBottom: 14 }}>
                {assignForm.students.map((s, i) => {
                  const profileId = s.studentProfile?.id ?? s.id
                  return (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: i < assignForm.students.length - 1 ? '1px solid #f0ebe3' : 'none', fontSize: 14, color: '#1a1209' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf8f5'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <input
                        type="checkbox"
                        checked={assignForm.selected.has(profileId)}
                        onChange={() => toggleStudent(profileId)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#059669' }}
                      />
                      {s.firstName} {s.lastName}
                    </label>
                  )
                })}
              </div>
            </>
          )}

          {assignForm.error && <div style={{ ...sError, marginBottom: 12 }}>{assignForm.error}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setAssignForm(EMPTY_ASSIGN)}>Annuler</button>
            <button
              style={{ ...btnPrim, flex: 1, opacity: (assignForm.submitting || assignForm.selected.size === 0) ? 0.6 : 1 }}
              onClick={submitAssign}
              disabled={assignForm.submitting || assignForm.selected.size === 0 || assignForm.loading}>
              {assignForm.submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 480, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const sModalTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }
const sLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }
const sInput: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }
const sError: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec2: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, fontSize: 14, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '7px 16px', borderRadius: 9, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
