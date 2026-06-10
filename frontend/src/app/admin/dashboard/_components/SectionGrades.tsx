'use client'
import { useState, useEffect, useCallback } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string }
interface SubjectItem { id: string; name: string }

interface GradeItem {
  id: string
  sequenceAverage: number | null
  validationStatus: string
  student: { id: string; firstName: string; lastName: string }
  subject: { id: string; name: string; code: string | null }
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT:     { bg: '#f1f5f9', color: '#475569', label: 'Brouillon'     },
  SUBMITTED: { bg: '#fef3c7', color: '#92400e', label: 'En attente'    },
  VALIDATED: { bg: '#d1fae5', color: '#065f46', label: '✓ Validée'     },
  LOCKED:    { bg: '#d1fae5', color: '#065f46', label: '🔒 Verrouillée' },
  REJECTED:  { bg: '#fee2e2', color: '#991b1b', label: '✕ Rejetée'     },
}

export default function SectionGrades({ onToast }: Props) {
  const [classes, setClasses]     = useState<ClassItem[]>([])
  const [subjects, setSubjects]   = useState<SubjectItem[]>([])
  const [grades, setGrades]       = useState<GradeItem[]>([])
  const [loading, setLoading]     = useState(false)
  const [filtersReady, setFiltersReady] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [classId, setClassId]     = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [status, setStatus]       = useState('SUBMITTED')

  // Charger classes + matières au montage
  useEffect(() => {
    Promise.all([
      fetch('/api/v2/classes',  { credentials: 'include' }).then(r => r.json()),
      fetch('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
    ]).then(([cd, sd]) => {
      setClasses(cd.data  || [])
      setSubjects(sd.data || [])
    }).catch(() => {}).finally(() => setFiltersReady(true))
  }, [])

  const fetchGrades = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (classId)   params.set('classId', classId)
      if (subjectId) params.set('subjectId', subjectId)
      if (status)    params.set('validationStatus', status)
      const res = await fetch(`/api/v2/grades?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setGrades(data.grades || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [classId, subjectId, status])

  const handleValidate = async (gradeId: string) => {
    try {
      const res = await fetch(`/api/v2/grades/${gradeId}/validate`, {
        method: 'PATCH', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Note validée avec succès', 'success')
      fetchGrades()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de validation', 'error')
    }
  }

  const handleBulkValidate = async () => {
    if (!classId) { onToast('Sélectionnez une classe', 'info'); return }
    const pending = grades.filter(g => g.validationStatus === 'SUBMITTED')
    if (pending.length === 0) { onToast('Aucune note en attente', 'info'); return }
    let ok = 0
    for (const g of pending) {
      try {
        const res = await fetch(`/api/v2/grades/${g.id}/validate`, { method: 'PATCH', credentials: 'include' })
        if (res.ok) ok++
      } catch { /* continue */ }
    }
    onToast(`${ok}/${pending.length} note${ok > 1 ? 's' : ''} validée${ok > 1 ? 's' : ''}`, ok > 0 ? 'success' : 'error')
    fetchGrades()
  }

  const pendingCount = grades.filter(g => g.validationStatus === 'SUBMITTED').length

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Notes</div>
          <div style={sSub}>Consultation et validation des notes</div>
        </div>
        {pendingCount > 0 && (
          <div style={{ background: '#fef3c7', border: '1.5px solid rgba(217,119,6,0.25)', borderRadius: 12, padding: '8px 16px', fontSize: 15, fontWeight: 700, color: '#92400e' }}>
            ⚠️ {pendingCount} note{pendingCount > 1 ? 's' : ''} en attente
          </div>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        {/* Filtres */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <select value={classId} onChange={e => setClassId(e.target.value)} style={filterSelect} disabled={!filtersReady}>
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)} style={filterSelect} disabled={!filtersReady}>
            <option value="">Toutes les matières</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} style={filterSelect}>
            <option value="">Tous les statuts</option>
            <option value="SUBMITTED">En attente</option>
            <option value="VALIDATED">Validées</option>
            <option value="DRAFT">Brouillons</option>
            <option value="REJECTED">Rejetées</option>
            <option value="LOCKED">Verrouillées</option>
          </select>
          <button style={btnPrim} onClick={fetchGrades} disabled={loading}>
            {loading ? '⏳' : '🔍'} Charger
          </button>
          {pendingCount > 0 && (
            <button style={{ ...btnSec, color: '#059669', borderColor: '#059669', marginLeft: 'auto' }} onClick={handleBulkValidate}>
              ✅ Valider tout ({pendingCount})
            </button>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ {error}</span>
            <button onClick={fetchGrades}
              style={{ padding: '5px 12px', borderRadius: 8, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && grades.length === 0 && (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#a89478', fontSize: 17 }}>
            Sélectionnez des filtres puis cliquez sur « Charger »
          </div>
        )}

        {!loading && !error && grades.length > 0 && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Élève', 'Matière', 'Note /20', 'Statut', 'Actions'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {grades.map((grade) => {
                  const st = STATUS_STYLE[grade.validationStatus] ?? STATUS_STYLE.DRAFT
                  return (
                    <tr key={grade.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>
                        {grade.student.firstName} {grade.student.lastName}
                      </td>
                      <td style={tdStyle}>{grade.subject.name}</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 20, fontWeight: 900,
                          color: (grade.sequenceAverage ?? 0) < 10 ? '#dc2626' : '#059669',
                        }}>
                          {grade.sequenceAverage != null ? grade.sequenceAverage.toFixed(1) : '—'}
                        </span>
                        <span style={{ fontSize: 14, color: '#a89478', marginLeft: 4 }}>/20</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: st.bg, color: st.color }}>
                          {st.label}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {grade.validationStatus === 'SUBMITTED' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              style={{ ...btnSecSm, color: '#059669', borderColor: 'rgba(5,150,105,0.5)' }}
                              onClick={() => handleValidate(grade.id)}>
                              ✓ Valider
                            </button>
                            <button
                              style={{ ...btnSecSm, color: '#dc2626', borderColor: 'rgba(220,38,38,0.4)' }}
                              onClick={() => onToast('Saisissez un motif de rejet dans le module notes', 'info')}>
                              ✕
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e8e0d4' }}>
              <span style={{ fontSize: 14, color: '#a89478', fontWeight: 600 }}>
                {grades.length} note{grades.length > 1 ? 's' : ''} — dont {pendingCount} en attente
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '5px 12px', borderRadius: 8, fontSize: 14, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const filterSelect: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
