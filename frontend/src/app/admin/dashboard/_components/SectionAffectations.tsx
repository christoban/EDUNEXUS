'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface ClassItem { id: string; name: string; level: string | null }
interface AssignmentRow {
  subjectId: string
  subjectName: string
  coefficient: number
  currentTeacherId: string | null
  currentTeacherName: string | null
  eligibleTeachers: { id: string; name: string }[]
}

const sScroll: React.CSSProperties = { height: '100%', overflowY: 'auto', padding: '32px 40px' }
const sCard: React.CSSProperties = { background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '28px 32px' }
const sLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }
const sSelect: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e8e0d4', fontSize: 15, color: '#1a1209', background: 'white', fontFamily: 'inherit', cursor: 'pointer' }

export default function SectionAffectations({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classId, setClassId] = useState('')
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [meta, setMeta] = useState<{ total: number; assigned: number } | null>(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState<string | null>(null) // subjectId en cours de sauvegarde

  useEffect(() => {
    fetchApi('/api/v2/classes')
      .then(r => r.json())
      .then(d => {
        if (d.success) setClasses(d.data.map((c: any) => ({ id: c.id, name: c.name, level: c.level })))
      })
      .catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  const loadAssignments = useCallback((cid: string) => {
    if (!cid) { setRows([]); setMeta(null); return }
    setLoadingRows(true)
    fetchApi(`/api/v2/teaching-assignments?classId=${cid}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) { setRows(d.data); setMeta(d.meta) }
      })
      .catch(() => onToast('Erreur lors du chargement des affectations', 'error'))
      .finally(() => setLoadingRows(false))
  }, [onToast])

  const handleClassChange = (cid: string) => {
    setClassId(cid)
    loadAssignments(cid)
  }

  const handleAssign = async (subjectId: string, teacherId: string | null) => {
    setSaving(subjectId)
    try {
      const res = await fetchApi('/api/v2/teaching-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, subjectId, teacherId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')

      setRows(prev => prev.map(r =>
        r.subjectId === subjectId
          ? {
              ...r,
              currentTeacherId: teacherId,
              currentTeacherName: teacherId
                ? (r.eligibleTeachers.find(t => t.id === teacherId)?.name ?? null)
                : null,
            }
          : r,
      ))
      setMeta(prev => {
        if (!prev) return prev
        const wasAssigned = rows.find(r => r.subjectId === subjectId)?.currentTeacherId !== null
        const nowAssigned = teacherId !== null
        if (wasAssigned === nowAssigned) return prev
        return { ...prev, assigned: prev.assigned + (nowAssigned ? 1 : -1) }
      })
      onToast(teacherId ? 'Affectation enregistrée' : 'Affectation supprimée', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(null)
    }
  }

  const selectedClass = classes.find(c => c.id === classId)

  return (
    <div style={sScroll}>
      {/* En-tête */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>
          Affectations pédagogiques
        </div>
        <div style={{ fontSize: 15, color: '#a89478' }}>
          Associez chaque matière du programme à un enseignant pour chaque classe.
        </div>
      </div>

      {/* Sélecteur de classe */}
      <div style={{ ...sCard, marginBottom: 24, maxWidth: 480 }}>
        <div style={sLabel}>Choisir une classe</div>
        {loadingClasses ? (
          <div style={{ color: '#a89478', fontSize: 14 }}>Chargement…</div>
        ) : (
          <select style={sSelect} value={classId} onChange={e => handleClassChange(e.target.value)}>
            <option value="">— Sélectionner une classe —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* KPI */}
      {meta && classId && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ background: meta.assigned === meta.total ? '#f0fdf4' : '#fffbeb', border: `1.5px solid ${meta.assigned === meta.total ? '#bbf7d0' : '#fde68a'}`, borderRadius: 12, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{meta.assigned === meta.total ? '✅' : '⚠️'}</span>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1209' }}>{meta.assigned}/{meta.total}</div>
              <div style={{ fontSize: 13, color: '#6b5c45' }}>matières affectées</div>
            </div>
          </div>
          {meta.assigned < meta.total && (
            <div style={{ background: '#fff7ed', border: '1.5px solid #fed7aa', borderRadius: 12, padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>📋</span>
              <div style={{ fontSize: 14, color: '#9a3412' }}>
                <strong>{meta.total - meta.assigned}</strong> matière{meta.total - meta.assigned > 1 ? 's' : ''} sans enseignant
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tableau */}
      {classId && (
        <div style={sCard}>
          {loadingRows ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#a89478' }}>Chargement des matières…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <div style={{ fontSize: 16, color: '#a89478' }}>
                Aucune matière dans le programme de {selectedClass?.name}.<br />
                Configurez d'abord les coefficients dans la section Matières.
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8e0d4' }}>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#6b5c45', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matière</th>
                  <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#6b5c45', textTransform: 'uppercase', letterSpacing: '0.04em', width: 80 }}>Coeff.</th>
                  <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#6b5c45', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Enseignant affecté</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isSaving = saving === row.subjectId
                  const unassigned = row.currentTeacherId === null
                  return (
                    <tr key={row.subjectId} style={{ borderBottom: '1px solid #f0ebe3', background: unassigned ? '#fffbeb' : 'white' }}>
                      <td style={{ padding: '12px 14px', fontSize: 15, fontWeight: 600, color: '#1a1209' }}>
                        {unassigned && <span style={{ marginRight: 6, fontSize: 14 }}>⚠️</span>}
                        {row.subjectName}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 15, color: '#6b5c45', fontWeight: 700 }}>
                        {row.coefficient}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          style={{
                            ...sSelect,
                            maxWidth: 340,
                            opacity: isSaving ? 0.6 : 1,
                            borderColor: unassigned ? '#fde68a' : '#e8e0d4',
                            background: unassigned ? '#fffbeb' : 'white',
                          }}
                          value={row.currentTeacherId ?? ''}
                          disabled={isSaving}
                          onChange={e => handleAssign(row.subjectId, e.target.value || null)}
                        >
                          <option value="">— Non assigné —</option>
                          {row.eligibleTeachers.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                          {/* Enseignant actuellement affecté mais pas éligible (sécurité) */}
                          {row.currentTeacherId && !row.eligibleTeachers.find(t => t.id === row.currentTeacherId) && (
                            <option value={row.currentTeacherId}>{row.currentTeacherName ?? row.currentTeacherId}</option>
                          )}
                        </select>
                        {row.eligibleTeachers.length === 0 && (
                          <div style={{ fontSize: 12, color: '#a89478', marginTop: 4 }}>
                            Aucun enseignant n'a déclaré cette matière.
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        {isSaving && <span style={{ fontSize: 16 }}>⏳</span>}
                        {!isSaving && !unassigned && <span style={{ fontSize: 16, color: '#059669' }}>✓</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!classId && !loadingClasses && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#a89478' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
          <div style={{ fontSize: 17 }}>Sélectionnez une classe pour gérer ses affectations.</div>
        </div>
      )}
    </div>
  )
}
