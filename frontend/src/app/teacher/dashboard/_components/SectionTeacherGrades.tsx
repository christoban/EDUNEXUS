'use client'
import { useState, useEffect } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { db } from '@/lib/offline/db'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

export default function SectionTeacherGrades({ onToast, user }: Props) {
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [sequences, setSequences] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedSequence, setSelectedSequence] = useState('')
  const [grades, setGrades] = useState<any[]>([])
  const [notes, setNotes] = useState<Record<string, number>>({})
  const [observations, setObservations] = useState<Record<string, string>>({})
  const [rejectedGrades, setRejectedGrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [localDraft, setLocalDraft] = useState<{ notes: Record<string, number>; observations: Record<string, string> } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: { line: number; matricule: string; error: string }[]; total: number } | null>(null)

  const { isOnline, addToQueue } = useSyncQueue()

  useEffect(() => {
    if (navigator.onLine) {
      Promise.all([
        fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/grades?validationStatus=REJECTED', { credentials: 'include' }).then(r => r.json()),
      ]).then(async ([clsRes, subRes, ayRes, rejRes]) => {
        if (clsRes.success) {
          setClasses(clsRes.data)
          await db.cachedData.put({ key: 'teacher:classes', data: clsRes.data, cachedAt: Date.now() })
        }
        if (subRes.success) {
          setSubjects(subRes.data)
          await db.cachedData.put({ key: 'teacher:subjects', data: subRes.data, cachedAt: Date.now() })
        }
        if (ayRes.success) {
          const seqs = ayRes.data.flatMap((ay: any) =>
            ay.periods?.flatMap((p: any) =>
              p.sequences?.map((s: any) => ({ ...s, periodName: p.name, academicYearId: ay.id })) || []
            ) || []
          )
          setSequences(seqs)
          await db.cachedData.put({ key: 'teacher:sequences', data: seqs, cachedAt: Date.now() })
        }
        if (rejRes.grades) setRejectedGrades(rejRes.grades)
      }).catch(() => {}).finally(() => setLoading(false))
    } else {
      Promise.all([
        db.cachedData.get('teacher:classes'),
        db.cachedData.get('teacher:subjects'),
        db.cachedData.get('teacher:sequences'),
      ]).then(([clsCache, subCache, seqCache]) => {
        if (clsCache) setClasses(clsCache.data as any[])
        if (subCache) setSubjects(subCache.data as any[])
        if (seqCache) setSequences(seqCache.data as any[])
      }).catch(() => {}).finally(() => setLoading(false))
    }
  }, [])

  const loadGrades = async () => {
    if (!selectedClass || !selectedSubject || !selectedSequence) {
      onToast('Sélectionne classe, matière et séquence', 'warning')
      return
    }
    setLoading(true)
    setError(null)
    const draftKey = `draft:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`
    try {
      if (!isOnline) {
        const cached = await db.cachedData.get(`teacher:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`)
        const draft = await db.cachedData.get(draftKey)
        if (cached) {
          setGrades(cached.data as any[])
          if (draft) {
            setLocalDraft(draft.data as { notes: Record<string, number>; observations: Record<string, string> })
            setShowDraftPrompt(true)
          } else {
            const n: Record<string, number> = {}
            const o: Record<string, string> = {}
            ;(cached.data as any[]).forEach((g: any) => {
              n[g.studentId] = g.sequenceScore ?? 0
              o[g.studentId] = g.observation || ''
            })
            setNotes(n)
            setObservations(o)
          }
        } else {
          setGrades([])
          onToast('Aucune donnée en cache — connexion requise', 'warning')
        }
        return
      }

      const url = `/api/v2/grades?classId=${selectedClass}&subjectId=${selectedSubject}&sequenceId=${selectedSequence}`
      const res = await fetchApi(url, { credentials: 'include' }).then(r => r.json())
      if (res.grades?.length) {
        setGrades(res.grades)
        await db.cachedData.put({ key: `teacher:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`, data: res.grades, cachedAt: Date.now() })
        const draft = await db.cachedData.get(draftKey)
        if (draft) {
          setLocalDraft(draft.data as { notes: Record<string, number>; observations: Record<string, string> })
          setShowDraftPrompt(true)
        } else {
          const n: Record<string, number> = {}
          const o: Record<string, string> = {}
          res.grades.forEach((g: any) => {
            n[g.studentId] = g.sequenceScore ?? g.sequenceAverage ?? 0
            o[g.studentId] = g.observation || ''
          })
          setNotes(n)
          setObservations(o)
        }
      } else {
        const usersRes = await fetchApi(`/api/v2/users?role=STUDENT&classId=${selectedClass}`, { credentials: 'include' }).then(r => r.json())
        if (usersRes.success) {
          const gradesList = usersRes.data.map((u: any) => ({
            studentId: u.id,
            student: { id: u.id, firstName: u.firstName, lastName: u.lastName },
          }))
          setGrades(gradesList)
          await db.cachedData.put({ key: `teacher:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`, data: gradesList, cachedAt: Date.now() })
          const n: Record<string, number> = {}
          usersRes.data.forEach((u: any) => { n[u.id] = 0 })
          setNotes(n)
          setObservations({})
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const saveDraft = async () => {
    if (!selectedClass || !selectedSubject || !selectedSequence) return
    const gradesPayload = Object.entries(notes).map(([studentId, value]) => ({
      studentId, value, observation: observations[studentId] || '',
    }))
    const draftKey = `draft:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`

    if (!isOnline) {
      await db.cachedData.put({ key: draftKey, data: { notes, observations }, cachedAt: Date.now() })
      onToast('Brouillon sauvegardé localement', 'info')
      return
    }

    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/grades/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass, subjectId: selectedSubject, sequenceId: selectedSequence, grades: gradesPayload }),
      }).then(r => r.json())
      if (res.success) {
        onToast('Brouillon sauvegardé', 'info')
        await db.cachedData.delete(draftKey)
      } else {
        onToast(res.message || 'Erreur', 'error')
      }
    } catch (err: any) {
      onToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const submitGrades = async () => {
    if (!selectedClass || !selectedSubject || !selectedSequence) return
    const draftKey = `draft:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`
    const gradesPayload = Object.entries(notes).map(([studentId, value]) => ({
      studentId, value, observation: observations[studentId] || '',
    }))

    if (!isOnline) {
      await addToQueue({
        type: 'GRADE',
        endpoint: '/api/v2/grades/submit',
        method: 'POST',
        payload: { classId: selectedClass, subjectId: selectedSubject, sequenceId: selectedSequence },
      })
      await db.cachedData.delete(draftKey)
      onToast('Soumission mise en file d\'attente — synchronisation à la reconnexion', 'warning')
      return
    }

    setSaving(true)
    try {
      const draftRes = await fetchApi('/api/v2/grades/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass, subjectId: selectedSubject, sequenceId: selectedSequence, grades: gradesPayload }),
      }).then(r => r.json())
      if (!draftRes.success) {
        onToast(draftRes.message || 'Erreur lors de la sauvegarde', 'error')
        return
      }

      const res = await fetchApi('/api/v2/grades/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass, subjectId: selectedSubject, sequenceId: selectedSequence }),
      }).then(r => r.json())
      if (res.success) {
        onToast(`Notes soumises pour validation (${res.data?.count ?? '?'} note(s))`, 'success')
        await db.cachedData.delete(draftKey)
        loadGrades()
      } else {
        onToast(res.message || 'Erreur', 'error')
      }
    } catch (err: any) {
      onToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const downloadTemplate = () => {
    if (!selectedClass || !selectedSubject || !selectedSequence) {
      onToast('Sélectionne classe, matière et séquence avant de télécharger le template', 'warning')
      return
    }
    const url = `/api/v2/grades/template?classId=${selectedClass}&subjectId=${selectedSubject}&sequenceId=${selectedSequence}`
    const a = document.createElement('a')
    a.href = url
    a.click()
  }

  const importFromExcel = async (file: File) => {
    if (!selectedClass || !selectedSubject || !selectedSequence) {
      onToast('Sélectionne classe, matière et séquence avant d\'importer', 'warning')
      return
    }
    setImporting(true)
    setImportResult(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('classId', selectedClass)
    formData.append('subjectId', selectedSubject)
    formData.append('sequenceId', selectedSequence)
    try {
      const res = await fetchApi('/api/v2/grades/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      }).then(r => r.json())
      if (res.success) {
        setImportResult(res)
        onToast(
          `${res.imported} note(s) importée(s)${res.errors.length > 0 ? ` · ${res.errors.length} erreur(s)` : ''}`,
          res.errors.length > 0 ? 'warning' : 'success',
        )
        loadGrades()
      } else {
        onToast(res.message || 'Erreur lors de l\'import', 'error')
      }
    } catch (err: any) {
      onToast(err.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  const validatedCount = grades.filter((g: any) => g.validationStatus === 'VALIDATED' || g.validationStatus === 'LOCKED').length
  const draftCount = grades.filter((g: any) => g.validationStatus === 'DRAFT' || !g.validationStatus).length
  const rejectedCount = grades.filter((g: any) => g.validationStatus === 'REJECTED').length
  const modifiableCount = draftCount + rejectedCount

  if (loading && !grades.length) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600 }}>Chargement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={loadGrades}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
            🔄 Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Notes</div>
          <div style={sSub}>Saisie et soumission des notes</div>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: '#fef3c7', border: '1.5px solid #d97706', borderRadius: 12, padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📶</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#92400e' }}>Mode hors-ligne — brouillons sauvegardés localement, soumissions synchronisées à la reconnexion</span>
        </div>
      )}

      {/* Prompt restauration brouillon */}
      {showDraftPrompt && localDraft && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #d97706', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 22 }}>💾</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e' }}>Brouillon hors-ligne détecté</div>
            <div style={{ fontSize: 13, color: '#b45309', marginTop: 2 }}>Des notes ont été sauvegardées localement. Voulez-vous les restaurer ?</div>
          </div>
          <button onClick={() => { setNotes(localDraft.notes); setObservations(localDraft.observations); setShowDraftPrompt(false) }}
            style={{ padding: '7px 14px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: '#d97706', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            Restaurer
          </button>
          <button onClick={() => setShowDraftPrompt(false)}
            style={{ padding: '7px 14px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
            Ignorer
          </button>
        </div>
      )}

      {grades.length > 0 && (
        <div style={{ background: '#f0ebe3', borderRadius: 12, padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#6b5c45', marginBottom: 8 }}>
            <span>{classes.find((c: any) => c.id === selectedClass)?.name || ''} — {subjects.find((s: any) => s.id === selectedSubject)?.name || ''}</span>
            <span style={{ color: '#059669' }}>{validatedCount}/{grades.length} validées ({grades.length ? Math.round(validatedCount / grades.length * 100) : 0}%)</span>
          </div>
          <div style={{ height: 8, background: '#d4c8b8', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${grades.length ? Math.round(validatedCount / grades.length * 100) : 0}%`, background: '#059669', borderRadius: 8, transition: 'width 1s' }} />
          </div>
        </div>
      )}

      {/* Filtres + table */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select style={filterSt} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            <option value="">Classe</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={filterSt} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
            <option value="">Matière</option>
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select style={filterSt} value={selectedSequence} onChange={e => setSelectedSequence(e.target.value)}>
            <option value="">Séquence</option>
            {sequences.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button style={btnPrim} onClick={loadGrades} disabled={loading}>Charger</button>
          <div style={{ flex: 1 }} />
          <button
            style={{ ...btnSec, fontSize: 14 }}
            onClick={downloadTemplate}
            title="Télécharger le template Excel à remplir hors-ligne">
            📥 Template Excel
          </button>
          <label style={{ ...btnSec, fontSize: 14, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1 }}>
            {importing ? '⏳ Import...' : '📤 Importer Excel'}
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              disabled={importing}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { importFromExcel(file); e.target.value = '' }
              }}
            />
          </label>
        </div>

        {importResult && (
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #e8e0d4' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: importResult.errors.length > 0 ? 10 : 0 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: importResult.errors.length > 0 ? '#b45309' : '#059669' }}>
                {importResult.errors.length > 0 ? '⚠️' : '✅'} {importResult.imported} note{importResult.imported > 1 ? 's' : ''} importée{importResult.imported > 1 ? 's' : ''}
                {importResult.errors.length > 0 && ` · ${importResult.errors.length} erreur${importResult.errors.length > 1 ? 's' : ''}`}
              </span>
              <button
                onClick={() => setImportResult(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#a89478' }}>
                ✕
              </button>
            </div>
            {importResult.errors.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Ligne', 'Matricule', 'Erreur'].map(h => (
                        <th key={h} style={{ ...thSt, background: '#fef2f2', color: '#991b1b', padding: '8px 14px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((e, i) => (
                      <tr key={i} style={{ borderTop: '1px solid rgba(220,38,38,0.1)' }}>
                        <td style={{ ...tdSt, color: '#dc2626', fontWeight: 700, width: 60 }}>{e.line}</td>
                        <td style={{ ...tdSt, fontWeight: 700 }}>{e.matricule || '—'}</td>
                        <td style={{ ...tdSt, color: '#dc2626' }}>{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {grades.length > 0 && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['N°', 'Élève', 'Note /20', 'Observation', 'Statut'].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {grades.map((g: any, i: number) => {
                  const sid = g.studentId || g.student?.id
                  const name = g.student ? `${g.student.firstName} ${g.student.lastName}` : 'Inconnu'
                  const status = g.validationStatus || 'DRAFT'
                  const sColors: Record<string, { bg: string; color: string }> = {
                    DRAFT: { bg: '#f1f5f9', color: '#475569' },
                    SUBMITTED: { bg: '#fef3c7', color: '#92400e' },
                    VALIDATED: { bg: '#d1fae5', color: '#065f46' },
                    REJECTED: { bg: '#fee2e2', color: '#991b1b' },
                    LOCKED: { bg: '#e0e7ff', color: '#3730a3' },
                  }
                  const sc = sColors[status] || sColors.DRAFT
                  return (
                    <tr key={sid}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <td style={{ ...tdSt, color: '#a89478', width: 44 }}>{i + 1}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{name}</td>
                      <td style={tdSt}>
                        <input type="number" min={0} max={20} step={0.25}
                          value={notes[sid] ?? 0}
                          onChange={e => {
                            const a = { ...notes }
                            a[sid] = Number(e.target.value)
                            setNotes(a)
                          }}
                          disabled={status !== 'DRAFT' && status !== 'REJECTED'}
                          style={{ width: 80, padding: '7px 10px', border: '1.5px solid #d4c8b8', borderRadius: 9, fontSize: 17, fontWeight: 800, textAlign: 'center', fontFamily: 'inherit', outline: 'none', background: status !== 'DRAFT' && status !== 'REJECTED' ? '#f0ebe3' : 'white', color: (notes[sid] ?? 0) < 10 ? '#dc2626' : (notes[sid] ?? 0) >= 16 ? '#059669' : '#1a1209' }}
                        />
                      </td>
                      <td style={tdSt}>
                        <input type="text" value={observations[sid] || ''} placeholder="Observation..."
                          onChange={e => {
                            const a = { ...observations }
                            a[sid] = e.target.value
                            setObservations(a)
                          }}
                          disabled={status !== 'DRAFT' && status !== 'REJECTED'}
                          style={{ width: 240, padding: '7px 12px', border: '1.5px solid #d4c8b8', borderRadius: 9, fontSize: 16, fontFamily: 'inherit', outline: 'none', background: status !== 'DRAFT' && status !== 'REJECTED' ? '#f0ebe3' : 'white', color: '#1a1209' }}
                        />
                      </td>
                      <td style={tdSt}>
                        <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: sc.bg, color: sc.color }}>
                          {status === 'DRAFT' ? 'Brouillon' : status === 'SUBMITTED' ? 'Soumis' : status === 'VALIDATED' ? 'Validé' : status === 'REJECTED' ? 'Rejeté' : status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ padding: '14px 22px', borderTop: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <span style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>
                {draftCount} brouillon{draftCount > 1 ? 's' : ''}{rejectedCount > 0 ? ` · ${rejectedCount} rejetée${rejectedCount > 1 ? 's' : ''}` : ''} · {grades.filter((g: any) => g.validationStatus === 'SUBMITTED').length} soumise{grades.filter((g: any) => g.validationStatus === 'SUBMITTED').length > 1 ? 's' : ''}
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                {modifiableCount > 0 ? (
                  <>
                    <button style={btnSec} onClick={saveDraft} disabled={saving}>
                      {saving ? '...' : '💾 Brouillon'}
                    </button>
                    <button style={btnPrim} onClick={submitGrades} disabled={saving}>
                      {saving ? '...' : isOnline ? '📤 Soumettre pour validation' : '📶 Mettre en file d\'attente'}
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 15, color: '#059669', fontWeight: 700 }}>
                    ✅ Toutes les notes sont soumises ou en cours de validation
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notes rejetées */}
      {rejectedGrades.length > 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid rgba(220,38,38,0.3)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', background: '#fef2f2', borderBottom: '1px solid rgba(220,38,38,0.15)' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#dc2626' }}>✕ {rejectedGrades.length} note{rejectedGrades.length > 1 ? 's' : ''} rejetée{rejectedGrades.length > 1 ? 's' : ''}</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Élève', 'Note', 'Motif du rejet', 'Actions'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr></thead>
            <tbody>
              {rejectedGrades.map((g: any) => (
                <tr key={g.id}>
                  <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{g.student?.firstName} {g.student?.lastName}</td>
                  <td style={{ ...tdSt, fontWeight: 800, color: '#dc2626' }}>{g.sequenceScore ?? '?'}/20</td>
                  <td style={{ ...tdSt, color: '#dc2626', fontWeight: 700 }}>{g.rejectionReason || 'Motif non spécifié'}</td>
                  <td style={tdSt}>
                    <button
                      style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#fef3c7', color: '#d97706', border: '1px solid rgba(217,119,6,0.3)', cursor: 'pointer', fontFamily: 'inherit' }}
                      onClick={() => {
                        setSelectedClass(g.classId || '')
                        setSelectedSubject(g.subjectId || '')
                        setSelectedSequence(g.sequenceId || '')
                        loadGrades()
                      }}>
                      ✏️ Corriger et resoumettre
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
