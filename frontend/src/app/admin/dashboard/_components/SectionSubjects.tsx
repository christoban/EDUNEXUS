'use client'
import { useState, useEffect, useCallback } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface SubjectItem {
  id: string; name: string; code: string | null; coefficient: number
  hoursPerWeek: number; subjectType: string
  teacherSubjects: { teacherProfile: { user: { id: string; firstName: string; lastName: string } } }[]
}

interface Teacher { id: string; firstName: string; lastName: string }

const TYPE_LABEL: Record<string, string> = {
  THEORETICAL: 'Cours magistral', PRACTICAL: 'TP + Cours', MIXED: 'Mixte',
}

const COEFF_SERIES = ['A4', 'A', 'C', 'D', 'TI']
const COEFF_LEVELS = ['2nde', '1ère', 'Tle']

const EMPTY_CREATE = { name: '', code: '', coefficient: '1', hoursPerWeek: '2', subjectType: 'THEORETICAL', loading: false, error: '' }
const EMPTY_MOD    = { open: false, subjectId: '', name: '', code: '', coefficient: '', hoursPerWeek: '', subjectType: '', loading: false, error: '' }
const EMPTY_ASSIGN = { open: false, subjectId: '', subjectName: '', teacherSearch: '', teachers: [] as Teacher[], selected: null as Teacher | null, loading: false, error: '' }
const EMPTY_COEFF = { open: false, subjectId: '', subjectName: '', loading: false, error: '' }

export default function SectionSubjects({ onToast }: Props) {
  const [subjects, setSubjects]         = useState<SubjectItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [openDD, setOpenDD]             = useState<string | null>(null)
  const [search, setSearch]             = useState('')
  const [createOpen, setCreateOpen]     = useState(false)
  const [form, setForm]                 = useState(EMPTY_CREATE)
  const [modForm, setModForm]           = useState(EMPTY_MOD)
  const [assignForm, setAssignForm]     = useState(EMPTY_ASSIGN)
  const [coeffForm, setCoeffForm]       = useState(EMPTY_COEFF)
  const [coeffValues, setCoeffValues]   = useState<Record<string, string>>({})
  const [deletingId, setDeletingId]     = useState<string | null>(null)

  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetch('/api/v2/subjects', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setSubjects(data.data || [])
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchSubjects() }, [fetchSubjects])

  const filtered = subjects.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.code?.toLowerCase().includes(search.toLowerCase()))
  )

  // ── Créer ─────────────────────────────────────────────────────────────────
  const submitCreate = async () => {
    if (!form.name.trim()) { setForm(f => ({ ...f, error: 'Nom obligatoire' })); return }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch('/api/v2/subjects', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim() || undefined,
          coefficient: parseFloat(form.coefficient) || 1,
          hoursPerWeek: parseInt(form.hoursPerWeek) || 2,
          type: form.subjectType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Matière "${form.name}" créée`, 'success')
      setCreateOpen(false); setForm(EMPTY_CREATE); fetchSubjects()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Modifier ──────────────────────────────────────────────────────────────
  const openMod = (sub: SubjectItem) => {
    setOpenDD(null)
    setModForm({ open: true, subjectId: sub.id, name: sub.name, code: sub.code ?? '', coefficient: String(sub.coefficient), hoursPerWeek: String(sub.hoursPerWeek), subjectType: sub.subjectType, loading: false, error: '' })
  }

  const submitMod = async () => {
    if (!modForm.name.trim()) { setModForm(f => ({ ...f, error: 'Nom obligatoire' })); return }
    setModForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/v2/subjects/${modForm.subjectId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: modForm.name.trim(),
          code: modForm.code.trim() || undefined,
          coefficient: parseFloat(modForm.coefficient) || 1,
          hoursPerWeek: parseInt(modForm.hoursPerWeek) || 2,
          type: modForm.subjectType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Matière modifiée', 'success')
      setModForm(EMPTY_MOD); fetchSubjects()
    } catch (err) {
      setModForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Supprimer (désactivé — route backend non disponible) ─────────────────
  const handleDelete = async (_sub: SubjectItem) => {
    setOpenDD(null)
    onToast('Fonctionnalité à venir', 'info')
  }

  // ── Assigner enseignant ───────────────────────────────────────────────────
  const openAssign = async (sub: SubjectItem) => {
    setOpenDD(null)
    setAssignForm({ open: true, subjectId: sub.id, subjectName: sub.name, teacherSearch: '', teachers: [], selected: null, loading: false, error: '' })
    try {
      const res = await fetch('/api/v2/users?role=TEACHER&limit=100', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setAssignForm(f => ({ ...f, teachers: data.data || [] }))
    } catch { /* silencieux */ }
  }

  const openCoeff = (sub: SubjectItem) => {
    setOpenDD(null)
    const values: Record<string, string> = {}
    for (const lvl of COEFF_LEVELS) {
      for (const serie of COEFF_SERIES) {
        values[`${lvl}_${serie}`] = ''
      }
    }
    setCoeffValues(values)
    setCoeffForm({ open: true, subjectId: sub.id, subjectName: sub.name, loading: false, error: '' })
  }

  const submitCoeff = async () => {
    const coefficients: { classLevel: string; serieCode: string; coefficient: number }[] = []
    for (const lvl of COEFF_LEVELS) {
      for (const serie of COEFF_SERIES) {
        const val = coeffValues[`${lvl}_${serie}`]
        if (val && parseFloat(val) > 0) {
          coefficients.push({ classLevel: lvl, serieCode: serie, coefficient: parseFloat(val) })
        }
      }
    }
    if (coefficients.length === 0) {
      setCoeffForm(f => ({ ...f, error: 'Ajoutez au moins un coefficient' })); return
    }
    setCoeffForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/v2/subjects/${coeffForm.subjectId}/coefficients`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coefficients }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Coefficients enregistrés pour ${coeffForm.subjectName}`, 'success')
      setCoeffForm(EMPTY_COEFF)
    } catch (err) {
      setCoeffForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const submitAssign = async () => {
    if (!assignForm.selected) { setAssignForm(f => ({ ...f, error: 'Sélectionnez un enseignant' })); return }
    setAssignForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/v2/subjects/teachers/${assignForm.selected.id}/assign`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: assignForm.subjectId, action: 'ASSIGNER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Enseignant assigné à ${assignForm.subjectName}`, 'success')
      setAssignForm(EMPTY_ASSIGN); fetchSubjects()
    } catch (err) {
      setAssignForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const filteredTeachers = assignForm.teacherSearch
    ? assignForm.teachers.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(assignForm.teacherSearch.toLowerCase()))
    : assignForm.teachers

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Matières</div>
          <div style={sSub}>{loading ? '…' : `${subjects.length} matière${subjects.length > 1 ? 's' : ''} configurée${subjects.length > 1 ? 's' : ''}`}</div>
        </div>
        <button style={btnPrim} onClick={() => setCreateOpen(true)}>+ Créer une matière</button>
      </div>

      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /></div>}

      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span><span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={fetchSubjects} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px' }}>
              <span>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une matière…"
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: '#a89478', fontSize: 17 }}>
              {subjects.length === 0 ? 'Aucune matière configurée' : 'Aucun résultat'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Matière', 'Code', 'Coeff.', 'H/sem.', 'Type', 'Enseignants', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(sub => (
                  <tr key={sub.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209', fontSize: 17 }}>{sub.name}</td>
                    <td style={tdStyle}>
                      {sub.code ? <code style={{ background: '#f0ebe3', padding: '3px 9px', borderRadius: 7, fontSize: 14 }}>{sub.code}</code> : <span style={{ color: '#a89478' }}>—</span>}
                    </td>
                    <td style={tdStyle}><span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 900 }}>×{sub.coefficient}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>{sub.hoursPerWeek}h</td>
                    <td style={tdStyle}>{TYPE_LABEL[sub.subjectType] ?? sub.subjectType}</td>
                    <td style={tdStyle}>
                      <span style={{ background: sub.teacherSubjects.length > 0 ? '#d1fae5' : '#f1f5f9', color: sub.teacherSubjects.length > 0 ? '#065f46' : '#475569', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                        {sub.teacherSubjects.length > 0 ? `${sub.teacherSubjects.length} assigné${sub.teacherSubjects.length > 1 ? 's' : ''}` : 'Non assigné'}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button onClick={() => setOpenDD(openDD === sub.id ? null : sub.id)}
                          style={{ background: 'none', border: '1.5px solid #d4c8b8', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 16, color: '#a89478' }}
                          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669', background: '#d1fae5' })}
                          onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#a89478', background: 'none' })}>
                          {deletingId === sub.id ? '⏳' : '⋯'}
                        </button>
                        {openDD === sub.id && (
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 210, zIndex: 100, overflow: 'hidden' }}>
                            {[
                              { icon: '👥', label: 'Assigner enseignant', action: () => openAssign(sub), danger: false },
                              { icon: '✏️', label: 'Modifier',            action: () => openMod(sub),    danger: false },
                              { icon: '📊', label: 'Coefficients BAC',    action: () => openCoeff(sub),  danger: false },
                              { icon: '🗑', label: 'Supprimer',            action: () => handleDelete(sub), danger: false },
                            ].map((item, j) => (
                              <div key={j} onClick={item.action}
                                style={{ padding: '11px 16px', fontSize: 16, fontWeight: 600, color: item.danger ? '#dc2626' : '#6b5c45', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.danger ? '#fee2e2' : '#f0ebe3'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                                {item.icon} {item.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modal créer ── */}
      {createOpen && (
        <ModalOverlay onClose={() => { setCreateOpen(false); setForm(EMPTY_CREATE) }}>
          <div style={sModalTitle}>Créer une matière</div>
          <div style={sLabel}>Nom *</div>
          <input style={sInput} placeholder="Ex: Mathématiques, Français…" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLabel}>Code</div>
              <input style={sInput} placeholder="Ex: MATH, FR" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Coefficient</div>
              <input style={sInput} type="number" min="0.5" step="0.5" value={form.coefficient} onChange={e => setForm(f => ({ ...f, coefficient: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Heures / semaine</div>
              <input style={sInput} type="number" min="1" value={form.hoursPerWeek} onChange={e => setForm(f => ({ ...f, hoursPerWeek: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Type</div>
              <select style={sInput} value={form.subjectType} onChange={e => setForm(f => ({ ...f, subjectType: e.target.value }))}>
                <option value="THEORETICAL">Cours magistral</option>
                <option value="PRACTICAL">TP + Cours</option>
                <option value="MIXED">Mixte</option>
              </select>
            </div>
          </div>
          {form.error && <div style={sError}>{form.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => { setCreateOpen(false); setForm(EMPTY_CREATE) }}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: form.loading ? 0.7 : 1 }} onClick={submitCreate} disabled={form.loading}>
              {form.loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal modifier ── */}
      {modForm.open && (
        <ModalOverlay onClose={() => setModForm(EMPTY_MOD)}>
          <div style={sModalTitle}>Modifier la matière</div>
          <div style={sLabel}>Nom *</div>
          <input style={sInput} value={modForm.name} onChange={e => setModForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={sLabel}>Code</div>
              <input style={sInput} value={modForm.code} onChange={e => setModForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Coefficient</div>
              <input style={sInput} type="number" min="0.5" step="0.5" value={modForm.coefficient} onChange={e => setModForm(f => ({ ...f, coefficient: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Heures / semaine</div>
              <input style={sInput} type="number" min="1" value={modForm.hoursPerWeek} onChange={e => setModForm(f => ({ ...f, hoursPerWeek: e.target.value }))} />
            </div>
            <div>
              <div style={sLabel}>Type</div>
              <select style={sInput} value={modForm.subjectType} onChange={e => setModForm(f => ({ ...f, subjectType: e.target.value }))}>
                <option value="THEORETICAL">Cours magistral</option>
                <option value="PRACTICAL">TP + Cours</option>
                <option value="MIXED">Mixte</option>
              </select>
            </div>
          </div>
          {modForm.error && <div style={sError}>{modForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setModForm(EMPTY_MOD)}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: modForm.loading ? 0.7 : 1 }} onClick={submitMod} disabled={modForm.loading}>
              {modForm.loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal coefficients BAC ── */}
      {coeffForm.open && (
        <ModalOverlay onClose={() => setCoeffForm(EMPTY_COEFF)}>
          <div style={sModalTitle}>Configurer les coefficients BAC</div>
          <div style={{ fontSize: 15, color: '#a89478', marginBottom: 18 }}>{coeffForm.subjectName}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left' }}>Niveau</th>
                  {COEFF_SERIES.map(s => (
                    <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 70 }}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COEFF_LEVELS.map(lvl => (
                  <tr key={lvl}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>{lvl}</td>
                    {COEFF_SERIES.map(serie => (
                      <td key={serie} style={{ ...tdStyle, textAlign: 'center', padding: '8px 6px' }}>
                        <input type="number" min="0" step="0.5"
                          value={coeffValues[`${lvl}_${serie}`] ?? ''}
                          onChange={e => setCoeffValues(v => ({ ...v, [`${lvl}_${serie}`]: e.target.value }))}
                          placeholder="—"
                          style={{ width: 64, padding: '6px 8px', borderRadius: 8, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', textAlign: 'center', outline: 'none' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {coeffForm.error && <div style={sError}>{coeffForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setCoeffForm(EMPTY_COEFF)}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: coeffForm.loading ? 0.7 : 1 }} onClick={submitCoeff} disabled={coeffForm.loading}>
              {coeffForm.loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal assigner enseignant ── */}
      {assignForm.open && (
        <ModalOverlay onClose={() => setAssignForm(EMPTY_ASSIGN)}>
          <div style={sModalTitle}>Assigner un enseignant</div>
          <div style={{ fontSize: 15, color: '#a89478', marginBottom: 18 }}>{assignForm.subjectName}</div>
          <div style={sLabel}>Rechercher un enseignant</div>
          <input style={sInput} placeholder="Nom de l'enseignant…" value={assignForm.teacherSearch}
            onChange={e => setAssignForm(f => ({ ...f, teacherSearch: e.target.value, selected: null }))} />
          {assignForm.selected && (
            <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
              ✓ {assignForm.selected.firstName} {assignForm.selected.lastName}
            </div>
          )}
          {!assignForm.selected && (
            <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, maxHeight: 200, overflowY: 'auto', marginBottom: 12 }}>
              {filteredTeachers.length === 0
                ? <div style={{ padding: '16px', textAlign: 'center', color: '#a89478', fontSize: 14 }}>Aucun enseignant</div>
                : filteredTeachers.map(t => (
                  <div key={t.id}
                    onClick={() => setAssignForm(f => ({ ...f, selected: t, teacherSearch: `${t.firstName} ${t.lastName}` }))}
                    style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f0ebe3', color: '#1a1209' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#faf8f5'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    {t.firstName} {t.lastName}
                  </div>
                ))}
            </div>
          )}
          {assignForm.error && <div style={sError}>{assignForm.error}</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={{ ...btnSec2, flex: 1 }} onClick={() => setAssignForm(EMPTY_ASSIGN)}>Annuler</button>
            <button style={{ ...btnPrim, flex: 1, opacity: assignForm.loading ? 0.7 : 1 }} onClick={submitAssign} disabled={assignForm.loading}>
              {assignForm.loading ? 'Assignation…' : 'Assigner'}
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
const btnRetry: React.CSSProperties = { padding: '7px 16px', borderRadius: 9, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 16, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
