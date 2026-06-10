'use client'
import { useState, useEffect, useCallback } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface StudentResult { id: string; firstName: string; lastName: string }
interface DisciplineRecord {
  id: string; type: string; reason: string; status: string
  startDate: string | null; endDate: string | null; createdAt: string
  student: { id: string; firstName: string; lastName: string }
  decidedBy: { id: string; firstName: string; lastName: string }
}

const TYPE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  WARNING_ORAL:         { label: 'Avertissement oral',    bg: '#fef3c7', color: '#92400e' },
  WARNING_WRITTEN:      { label: 'Avertissement écrit',   bg: '#fef3c7', color: '#92400e' },
  TEMP_EXCLUSION:       { label: 'Exclusion temporaire',  bg: '#fee2e2', color: '#991b1b' },
  COUNCIL_DECISION:     { label: 'Décision du conseil',   bg: '#ede9fe', color: '#5b21b6' },
  PERMANENT_EXCLUSION:  { label: 'Exclusion définitive',  bg: '#fecaca', color: '#7f1d1d' },
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:   { bg: '#fee2e2', color: '#991b1b', label: '⚡ Active'  },
  LIFTED:   { bg: '#d1fae5', color: '#065f46', label: '✓ Levée'   },
  APPEALED: { bg: '#dbeafe', color: '#1e40af', label: '⚖️ Contestée' },
}

interface FormState {
  open: boolean; loading: boolean; error: string
  studentSearch: string; studentResults: StudentResult[]; selectedStudent: StudentResult | null
  type: string; reason: string; startDate: string; endDate: string
}

const EMPTY_FORM: FormState = {
  open: false, loading: false, error: '',
  studentSearch: '', studentResults: [], selectedStudent: null,
  type: 'WARNING_ORAL', reason: '', startDate: '', endDate: '',
}

export default function SectionDiscipline({ onToast }: Props) {
  const [records, setRecords]   = useState<DisciplineRecord[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [form, setForm]         = useState<FormState>(EMPTY_FORM)
  const [liftingId, setLiftingId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('ACTIVE')

  const fetchRecords = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (typeFilter)   params.set('type', typeFilter)
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/v2/discipline?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setRecords(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [typeFilter, statusFilter])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const searchStudents = async (q: string) => {
    if (q.trim().length < 2) { setForm(f => ({ ...f, studentResults: [] })); return }
    try {
      const res = await fetch(`/api/v2/users?role=STUDENT&search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
      const data = await res.json()
      setForm(f => ({ ...f, studentResults: data.data || [] }))
    } catch { setForm(f => ({ ...f, studentResults: [] })) }
  }

  const submitSanction = async () => {
    const { selectedStudent, type, reason, startDate, endDate } = form
    if (!selectedStudent) { setForm(f => ({ ...f, error: 'Sélectionnez un élève' })); return }
    if (!type || !reason.trim()) { setForm(f => ({ ...f, error: 'Type et motif obligatoires' })); return }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch('/api/v2/discipline', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudent.id, type, reason: reason.trim(), startDate: startDate || undefined, endDate: endDate || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Sanction enregistrée pour ${selectedStudent.firstName} ${selectedStudent.lastName}`, 'success')
      setForm(EMPTY_FORM)
      fetchRecords()
    } catch (err) {
      setForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const liftSanction = async (recordId: string, studentName: string) => {
    if (!confirm(`Lever la sanction de ${studentName} ?`)) return
    setLiftingId(recordId)
    try {
      const res = await fetch(`/api/v2/discipline/${recordId}/lift`, { method: 'PATCH', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Sanction levée', 'success')
      fetchRecords()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setLiftingId(null)
    }
  }

  const needsDates = form.type === 'TEMP_EXCLUSION' || form.type === 'PERMANENT_EXCLUSION'

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Discipline</div>
          <div style={sSub}>{loading ? '…' : `${records.length} sanction${records.length > 1 ? 's' : ''} · filtré${statusFilter ? ` par statut ${statusFilter}` : ''}`}</div>
        </div>
        <button style={btnPrim} onClick={() => setForm(f => ({ ...f, open: true }))}>+ Nouvelle sanction</button>
      </div>

      {/* Filtres */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={filterSt}>
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterSt}>
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Actives</option>
          <option value="LIFTED">Levées</option>
          <option value="APPEALED">Contestées</option>
        </select>
        <button style={btnSec} onClick={fetchRecords}>Filtrer</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span><span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={fetchRecords} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucune sanction enregistrée</div>
          <div style={{ fontSize: 16, color: '#a89478' }}>Utilisez « + Nouvelle sanction » pour créer un dossier de discipline.</div>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Élève', 'Type', 'Motif', 'Date', 'Statut', 'Prononcé par', 'Actions'].map(h => (
                <th key={h} style={thSt}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const tl = TYPE_LABEL[r.type] ?? { label: r.type, bg: '#f1f5f9', color: '#475569' }
                const sb = STATUS_BADGE[r.status] ?? { bg: '#f1f5f9', color: '#475569', label: r.status }
                return (
                  <tr key={r.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>
                      {r.student.firstName} {r.student.lastName}
                    </td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: tl.bg, color: tl.color }}>
                        {tl.label}
                      </span>
                    </td>
                    <td style={tdSt}>
                      <span style={{ fontSize: 14, color: '#6b5c45', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.reason}
                      </span>
                    </td>
                    <td style={tdSt}>{new Date(r.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: sb.bg, color: sb.color }}>
                        {sb.label}
                      </span>
                    </td>
                    <td style={tdSt}>{r.decidedBy.firstName} {r.decidedBy.lastName}</td>
                    <td style={tdSt}>
                      {r.status === 'ACTIVE' && (
                        <button
                          style={{ padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#d1fae5', color: '#065f46', border: '1px solid rgba(5,150,105,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                          onClick={() => liftSanction(r.id, `${r.student.firstName} ${r.student.lastName}`)}
                          disabled={liftingId === r.id}>
                          {liftingId === r.id ? '⏳' : '✓ Lever'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal création sanction */}
      {form.open && (
        <>
          <div onClick={() => setForm(EMPTY_FORM)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'white', borderRadius: 20, padding: '36px 40px', width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>Nouvelle sanction</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Recherche élève */}
              <div>
                <label style={labelSt}>Élève *</label>
                {form.selectedStudent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#d1fae5', borderRadius: 10, border: '1.5px solid rgba(5,150,105,0.3)' }}>
                    <span style={{ fontWeight: 700, color: '#065f46', flex: 1 }}>✓ {form.selectedStudent.firstName} {form.selectedStudent.lastName}</span>
                    <button onClick={() => setForm(f => ({ ...f, selectedStudent: null, studentSearch: '', studentResults: [] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: 16 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      value={form.studentSearch}
                      onChange={e => { setForm(f => ({ ...f, studentSearch: e.target.value })); searchStudents(e.target.value) }}
                      placeholder="Taper le nom de l'élève…"
                      style={inputSt}
                    />
                    {form.studentResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, boxShadow: '0 8px 20px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
                        {form.studentResults.map(s => (
                          <div key={s.id}
                            onClick={() => setForm(f => ({ ...f, selectedStudent: s, studentSearch: '', studentResults: [] }))}
                            style={{ padding: '10px 14px', fontSize: 15, fontWeight: 600, cursor: 'pointer', color: '#1a1209', borderBottom: '1px solid #faf7f2' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0ebe3'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                            {s.firstName} {s.lastName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Type */}
              <div>
                <label style={labelSt}>Type de sanction *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputSt}>
                  {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              {/* Motif */}
              <div>
                <label style={labelSt}>Motif *</label>
                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  rows={3} placeholder="Décrivez la raison de la sanction…"
                  style={{ ...inputSt, resize: 'vertical' }} />
              </div>

              {/* Dates (exclusions) */}
              {needsDates && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelSt}>Date début</label>
                    <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={inputSt} />
                  </div>
                  <div>
                    <label style={labelSt}>Date fin</label>
                    <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={inputSt} />
                  </div>
                </div>
              )}

              {form.error && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 9, fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
                  {form.error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button style={btnSec} onClick={() => setForm(EMPTY_FORM)}>Annuler</button>
                <button style={btnPrim} onClick={submitSanction} disabled={form.loading}>
                  {form.loading ? '⏳ Enregistrement…' : '✓ Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: '#6b5c45', outline: 'none', fontFamily: 'inherit' }
const inputSt: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e8e0d4', fontSize: 15, fontFamily: 'inherit', color: '#1a1209', outline: 'none', background: '#fafaf8', boxSizing: 'border-box' }
const labelSt: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.5px' }
const thSt: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 14px', fontSize: 15, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
