'use client'
import { useState, useEffect, useCallback } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface GradePending {
  id: string
  sequenceAverage: number | null
  validationStatus: string
  sequenceId: string
  classId: string
  subjectId: string
  student: { id: string; firstName: string; lastName: string }
  subject: { id: string; name: string; code: string | null }
  class: { id: string; name: string }
  recordedBy: { id: string; firstName: string; lastName: string } | null
}

interface Lot {
  classId: string
  className: string
  subjectId: string
  subjectName: string
  teacherName: string
  grades: GradePending[]
  sequenceId: string
}

interface RejectModalState { open: boolean; gradeId: string; gradeName: string; motif: string }

export default function SectionGradeValidation({ onToast }: Props) {
  const [lots, setLots]         = useState<Lot[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [validating, setValidating] = useState<Set<string>>(new Set())
  const [rejectModal, setRejectModal] = useState<RejectModalState>({ open: false, gradeId: '', gradeName: '', motif: '' })

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetch('/api/v2/grades/pending', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')

      const grades: GradePending[] = data.grades || []
      const lotMap = new Map<string, Lot>()
      for (const g of grades) {
        const key = `${g.classId}__${g.subjectId}`
        if (!lotMap.has(key)) {
          lotMap.set(key, {
            classId: g.classId, className: g.class?.name ?? '—',
            subjectId: g.subjectId, subjectName: g.subject?.name ?? '—',
            teacherName: g.recordedBy ? `${g.recordedBy.firstName} ${g.recordedBy.lastName}` : 'Inconnu',
            sequenceId: g.sequenceId,
            grades: [],
          })
        }
        lotMap.get(key)!.grades.push(g)
      }
      setLots(Array.from(lotMap.values()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPending() }, [fetchPending])

  const validateGrade = async (gradeId: string) => {
    setValidating(prev => new Set(prev).add(gradeId))
    try {
      const res = await fetch(`/api/v2/grades/${gradeId}/validate`, { method: 'PATCH', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      return true
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de validation', 'error')
      return false
    } finally {
      setValidating(prev => { const s = new Set(prev); s.delete(gradeId); return s })
    }
  }

  const validateLot = async (lot: Lot) => {
    if (!confirm(`Valider toutes les notes soumises (${lot.grades.length}) pour ${lot.className} — ${lot.subjectName} ?`)) return
    const key = `${lot.classId}__${lot.subjectId}`
    setValidating(prev => new Set([...prev, key]))
    try {
      const res = await fetch('/api/v2/grades/bulk-validate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: lot.classId, sequenceId: lot.sequenceId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`${lot.className} — ${lot.subjectName} : toutes les notes validées`, 'success')
      fetchPending()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de validation', 'error')
    } finally {
      setValidating(prev => { const s = new Set(prev); s.delete(key); return s })
    }
  }

  const openRejectModal = (gradeId: string, name: string) => {
    setRejectModal({ open: true, gradeId, gradeName: name, motif: '' })
  }

  const submitReject = async () => {
    if (!rejectModal.motif.trim()) { onToast('Le motif de rejet est obligatoire', 'error'); return }
    try {
      const res = await fetch(`/api/v2/grades/${rejectModal.gradeId}/reject`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motif: rejectModal.motif }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Note rejetée — enseignant notifié', 'success')
      setRejectModal({ open: false, gradeId: '', gradeName: '', motif: '' })
      fetchPending()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de rejet', 'error')
    }
  }

  const totalPending = lots.reduce((s, l) => s + l.grades.length, 0)

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Validation des notes</div>
          <div style={sSub}>{loading ? '…' : `${totalPending} note${totalPending > 1 ? 's' : ''} en attente · ${lots.length} lot${lots.length > 1 ? 's' : ''}`}</div>
        </div>
        <button style={btnSec} onClick={fetchPending}>🔄 Rafraîchir</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span><span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={fetchPending} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && lots.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Tout est à jour !</div>
          <div style={{ fontSize: 16, color: '#a89478' }}>Aucune note en attente de validation.</div>
        </div>
      )}

      {!loading && !error && lots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lots.map((lot) => {
            const lotKey = `${lot.classId}__${lot.subjectId}`
            const isValidatingLot = validating.has(lotKey)
            return (
              <div key={lotKey} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                {/* Lot header */}
                <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 12, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📝</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1209' }}>{lot.className} — {lot.subjectName}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 14, color: '#a89478', fontWeight: 600, marginTop: 3 }}>
                      <span>👤 {lot.teacherName}</span>
                      <span>👥 {lot.grades.length} élève{lot.grades.length > 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={{ padding: '8px 16px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#d1fae5', color: '#065f46', border: '1px solid rgba(5,150,105,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                      onClick={() => validateLot(lot)}
                      disabled={isValidatingLot}>
                      {isValidatingLot ? '⏳ Validation…' : `✅ Valider le lot (${lot.grades.length})`}
                    </button>
                  </div>
                </div>

                {/* Grades table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Élève', 'Note /20', 'Statut', 'Actions'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {lot.grades.map((g) => (
                      <tr key={g.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{g.student.firstName} {g.student.lastName}</td>
                        <td style={tdSt}>
                          <span style={{ fontSize: 18, fontWeight: 900, color: (g.sequenceAverage ?? 0) < 10 ? '#dc2626' : '#059669' }}>
                            {g.sequenceAverage?.toFixed(1) ?? '—'}
                          </span>
                          <span style={{ fontSize: 13, color: '#a89478', marginLeft: 3 }}>/20</span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: '#fef3c7', color: '#92400e' }}>
                            En attente
                          </span>
                        </td>
                        <td style={tdSt}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 14, fontWeight: 800, background: '#d1fae5', color: '#065f46', border: '1px solid rgba(5,150,105,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => validateGrade(g.id).then(ok => { if (ok) fetchPending() })}
                              disabled={validating.has(g.id)}>
                              ✓
                            </button>
                            <button
                              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 14, fontWeight: 800, background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => openRejectModal(g.id, `${g.student.firstName} ${g.student.lastName}`)}>
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <>
          <div onClick={() => setRejectModal(m => ({ ...m, open: false }))}
            style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)', zIndex: 200 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'white', borderRadius: 18, padding: '36px 40px', width: 460, boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>
              Rejeter la note
            </div>
            <div style={{ fontSize: 15, color: '#a89478', marginBottom: 20 }}>
              Élève : <strong style={{ color: '#6b5c45' }}>{rejectModal.gradeName}</strong>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#6b5c45', marginBottom: 7 }}>Motif de rejet *</label>
              <textarea
                value={rejectModal.motif}
                onChange={e => setRejectModal(m => ({ ...m, motif: e.target.value }))}
                placeholder="Ex : Note incorrecte, erreur de calcul…"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #d4c8b8', fontSize: 15, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: '#1a1209' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSec} onClick={() => setRejectModal(m => ({ ...m, open: false }))}>Annuler</button>
              <button style={{ ...btnPrim, background: 'linear-gradient(135deg,#dc2626,#b91c1c)' }} onClick={submitReject}>
                ✕ Rejeter
              </button>
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
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 16px', fontSize: 16, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
