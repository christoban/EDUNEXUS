'use client'
import { useState, useEffect, useCallback } from 'react'
import { useT } from '@/lib/i18n'
import { fetchApi } from '@/lib/fetchApi'

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

export default function SectionGrades({ onToast }: Props) {
  const t = useT('grades')
  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    DRAFT:     { bg: 'var(--bg2)', color: 'var(--text2)', label: t('status_labels.DRAFT')     },
    SUBMITTED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: t('status_labels.SUBMITTED')    },
    VALIDATED: { bg: 'var(--green-light)', color: 'var(--green)', label: t('status_labels.VALIDATED')     },
    LOCKED:    { bg: 'var(--green-light)', color: 'var(--green)', label: t('status_labels.LOCKED')    },
    REJECTED:  { bg: 'var(--red-light)', color: 'var(--red)', label: t('status_labels.REJECTED')     },
  }
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
      fetchApi('/api/v2/classes',  { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
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
      const res = await fetchApi(`/api/v2/grades?${params}`, { credentials: 'include' })
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
      const res = await fetchApi(`/api/v2/grades/${gradeId}/validate`, {
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
        const res = await fetchApi(`/api/v2/grades/${g.id}/validate`, { method: 'PATCH', credentials: 'include' })
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
          <div style={sTitle}>{t('title')}</div>
          <div style={sSub}>Consultation et validation des notes</div>
        </div>
        {pendingCount > 0 && (
          <div style={{ background: 'var(--amber-light)', border: '1.5px solid rgba(217,119,6,0.25)', borderRadius: 12, padding: '8px 16px', fontSize: 15, fontWeight: 700, color: 'var(--amber)' }}>
            ⚠️ {pendingCount} note{pendingCount > 1 ? 's' : ''} en attente
          </div>
        )}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        {/* Filtres */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
            <option value="SUBMITTED">{t('status_labels.SUBMITTED')}</option>
            <option value="VALIDATED">{t('status_labels.VALIDATED')}</option>
            <option value="DRAFT">{t('status_labels.DRAFT')}</option>
            <option value="REJECTED">{t('status_labels.REJECTED')}</option>
            <option value="LOCKED">{t('status_labels.LOCKED')}</option>
          </select>
          <button style={btnPrim} onClick={fetchGrades} disabled={loading}>
            {loading ? '⏳' : '🔍'} Charger
          </button>
          {pendingCount > 0 && (
            <button style={{ ...btnSec, color: 'var(--green)', borderColor: 'var(--green)', marginLeft: 'auto' }} onClick={handleBulkValidate}>
              ✅ Valider tout ({pendingCount})
            </button>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>⚠️ {error}</span>
            <button onClick={fetchGrades}
              style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && grades.length === 0 && (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 17 }}>
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
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>
                        {grade.student.firstName} {grade.student.lastName}
                      </td>
                      <td style={tdStyle}>{grade.subject.name}</td>
                      <td style={tdStyle}>
                        <span style={{
                          fontSize: 20, fontWeight: 900,
                          color: (grade.sequenceAverage ?? 0) < 10 ? 'var(--red)' : 'var(--green)',
                        }}>
                          {grade.sequenceAverage != null ? grade.sequenceAverage.toFixed(1) : '—'}
                        </span>
                        <span style={{ fontSize: 14, color: 'var(--text3)', marginLeft: 4 }}>/20</span>
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
                              style={{ ...btnSecSm, color: 'var(--green)', borderColor: 'rgba(5,150,105,0.5)' }}
                              onClick={() => handleValidate(grade.id)}>
                              ✓ Valider
                            </button>
                            <button
                              style={{ ...btnSecSm, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.4)' }}
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
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>
                {grades.length} note{grades.length > 1 ? 's' : ''} — dont {pendingCount} en attente
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '5px 12px', borderRadius: 8, fontSize: 14, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSelect: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
