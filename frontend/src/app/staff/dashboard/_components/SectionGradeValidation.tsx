'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, CheckCircle2, FileText, Check, X } from 'lucide-react'

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
  const t = useT('staff')
  const [lots, setLots]         = useState<Lot[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [validating, setValidating] = useState<Set<string>>(new Set())
  const [rejectModal, setRejectModal] = useState<RejectModalState>({ open: false, gradeId: '', gradeName: '', motif: '' })

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/grades/pending', { credentials: 'include' })
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
            teacherName: g.recordedBy ? `${g.recordedBy.firstName} ${g.recordedBy.lastName}` : t('gradeValidation.unknownTeacher'),
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
      const res = await fetchApi(`/api/v2/grades/${gradeId}/validate`, { method: 'PATCH', credentials: 'include' })
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
    if (!confirm(t('gradeValidation.confirmValidateLot', { count: lot.grades.length, className: lot.className, subjectName: lot.subjectName }))) return
    const key = `${lot.classId}__${lot.subjectId}`
    setValidating(prev => new Set([...prev, key]))
    try {
      const res = await fetchApi('/api/v2/grades/bulk-validate', {
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
      const res = await fetchApi(`/api/v2/grades/${rejectModal.gradeId}/reject`, {
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
          <div style={sTitle}>{t('gradeValidation.title')}</div>
          <div style={sSub}>{loading ? '…' : t('gradeValidation.subtitle', { total: totalPending, s: totalPending > 1 ? 's' : '', lots: lots.length, lot: lots.length > 1 ? 's' : '' })}</div>
        </div>
        <button style={btnSec} onClick={fetchPending}>{t('gradeValidation.refresh')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={16} strokeWidth={2} /></span><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchPending} style={btnRetry}>Réessayer</button>
        </div>
      )}

      {!loading && !error && lots.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 14, display: 'flex', justifyContent: 'center' }}><CheckCircle2 size={52} strokeWidth={2} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('gradeValidation.allUpToDate')}</div>
          <div style={{ fontSize: 16, color: 'var(--text3)' }}>{t('gradeValidation.noPendingGrades')}</div>
        </div>
      )}

      {!loading && !error && lots.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lots.map((lot) => {
            const lotKey = `${lot.classId}__${lot.subjectId}`
            const isValidatingLot = validating.has(lotKey)
            return (
              <div key={lotKey} style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                {/* Lot header */}
                <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 50, height: 50, borderRadius: 12, background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}><FileText size={22} strokeWidth={2} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{t('gradeValidation.lotHeader', { className: lot.className, subjectName: lot.subjectName })}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 14, color: 'var(--text3)', fontWeight: 600, marginTop: 3 }}>
                      <span>{t('gradeValidation.teacherLabel', { name: lot.teacherName })}</span>
                      <span>{t('gradeValidation.studentsCount', { count: lot.grades.length, s: lot.grades.length > 1 ? 's' : '' })}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={{ padding: '8px 16px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                      onClick={() => validateLot(lot)}
                      disabled={isValidatingLot}>
                      {isValidatingLot ? t('gradeValidation.validating') : t('gradeValidation.validateLot', { count: lot.grades.length })}
                    </button>
                  </div>
                </div>

                {/* Grades table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{[t('gradeValidation.studentHeader'), t('gradeValidation.gradeHeader'), t('gradeValidation.statusHeader'), t('gradeValidation.actionsHeader')].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {lot.grades.map((g) => (
                      <tr key={g.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{g.student.firstName} {g.student.lastName}</td>
                        <td style={tdSt}>
                          <span style={{ fontSize: 18, fontWeight: 900, color: (g.sequenceAverage ?? 0) < 10 ? 'var(--red)' : 'var(--green)' }}>
                            {g.sequenceAverage?.toFixed(1) ?? '—'}
                          </span>
                          <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 3 }}>/20</span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: 'var(--amber-light)', color: 'var(--amber)' }}>
                            {t('gradeValidation.pending')}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 14, fontWeight: 800, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => validateGrade(g.id).then(ok => { if (ok) fetchPending() })}
                              disabled={validating.has(g.id)}>
                              <Check size={14} strokeWidth={2} />
                            </button>
                            <button
                              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 14, fontWeight: 800, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => openRejectModal(g.id, `${g.student.firstName} ${g.student.lastName}`)}>
                              <X size={14} strokeWidth={2} />
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
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, background: 'var(--surface)', borderRadius: 18, padding: '36px 40px', width: 460, boxShadow: '0 24px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
              {t('gradeValidation.rejectTitle')}
            </div>
            <div style={{ fontSize: 15, color: 'var(--text3)', marginBottom: 20 }}>
              {t('gradeValidation.rejectStudent', { name: rejectModal.gradeName })}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>{t('gradeValidation.rejectReasonLabel')}</label>
              <textarea
                value={rejectModal.motif}
                onChange={e => setRejectModal(m => ({ ...m, motif: e.target.value }))}
                placeholder={t('gradeValidation.rejectReasonPlaceholder')}
                rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid var(--border2)', fontSize: 15, fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', color: 'var(--text)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSec} onClick={() => setRejectModal(m => ({ ...m, open: false }))}>{t('gradeValidation.cancel')}</button>
              <button style={{ ...btnPrim, background: 'linear-gradient(135deg,var(--red),var(--red))' }} onClick={submitReject}>
                {t('gradeValidation.rejectButton')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '6px 14px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 16px', fontSize: 16, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
