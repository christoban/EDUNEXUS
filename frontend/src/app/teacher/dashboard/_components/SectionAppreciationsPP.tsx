'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  user: UserInfo
  classeId: string
}

interface Period {
  id: string
  name: string
}

interface ReportCard {
  id: string
  studentId: string
  studentName: string
  generalAverage: number | null
  classMasterComment: string | null
  status: string
}

const QUICK_CHIPS = [
  'Résultats satisfaisants',
  'Peut mieux faire',
  'En nette progression',
  'Trimestre encourageant',
  'Des efforts nécessaires',
]

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function SectionAppreciationsPP({ user: _user, classeId }: Props) {
  const [periods, setPeriods] = useState<Period[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('')
  const [reportCards, setReportCards] = useState<ReportCard[]>([])
  const [comments, setComments] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [loadingCards, setLoadingCards] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Load periods from current academic year
  useEffect(() => {
    fetchApi('/api/v2/academic-years?isCurrent=true', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const years = Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []
        const current = years[0]
        if (current?.periods?.length) {
          setPeriods(current.periods)
          setSelectedPeriodId(current.periods[0].id)
        }
      })
      .catch(() => {})
  }, [])

  // Load report cards when period changes
  useEffect(() => {
    if (!selectedPeriodId) return
    setLoadingCards(true)
    setError(null)
    fetchApi(`/api/v2/report-cards?classId=${classeId}&periodId=${selectedPeriodId}&limit=100`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const cards: ReportCard[] = (d.reportCards ?? []).map((rc: any) => ({
          id: rc.id,
          studentId: rc.studentId,
          studentName: rc.student ? `${rc.student.lastName ?? ''} ${rc.student.firstName ?? ''}`.trim() : rc.studentId,
          generalAverage: rc.generalAverage ?? null,
          classMasterComment: rc.classMasterComment ?? null,
          status: rc.status ?? '',
        }))
        setReportCards(cards)
        const init: Record<string, string> = {}
        for (const rc of cards) init[rc.id] = rc.classMasterComment ?? ''
        setComments(init)
        setSaved({})
      })
      .catch(() => setError('Erreur de chargement des bulletins'))
      .finally(() => setLoadingCards(false))
  }, [selectedPeriodId, classeId])

  // Debounced auto-save per report card
  const debouncedComments = useDebounce(comments, 1500)
  const prevSavedRef = useRef<Record<string, string>>({})

  useEffect(() => {
    for (const [rcId, text] of Object.entries(debouncedComments)) {
      if (prevSavedRef.current[rcId] === text) continue
      prevSavedRef.current[rcId] = text
      setSaving(s => ({ ...s, [rcId]: true }))
      fetchApi(`/api/v2/report-cards/${rcId}/comment`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classMasterComment: text }),
      })
        .then(() => {
          setSaved(s => ({ ...s, [rcId]: true }))
          setTimeout(() => setSaved(s => { const n = { ...s }; delete n[rcId]; return n }), 3000)
        })
        .catch(() => {})
        .finally(() => setSaving(s => { const n = { ...s }; delete n[rcId]; return n }))
    }
  }, [debouncedComments])

  const handleBulkSave = useCallback(async () => {
    const entries = Object.entries(comments)
    setBulkSaving(true)
    setBulkProgress(0)
    let done = 0
    for (const [rcId, text] of entries) {
      await fetchApi(`/api/v2/report-cards/${rcId}/comment`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classMasterComment: text }),
      }).catch(() => {})
      done++
      setBulkProgress(Math.round((done / entries.length) * 100))
    }
    setBulkSaving(false)
  }, [comments])

  const isLocked = (rc: ReportCard) => rc.status === 'LOCKED' || rc.status === 'SENT'

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: '#1a1209' }}>
            ✍️ Appréciations du Professeur Principal
          </div>
          <div style={{ fontSize: 14, color: '#a89478', fontWeight: 500, marginTop: 4 }}>
            Rédigez l&apos;appréciation pour chaque élève
          </div>
        </div>
        <button
          onClick={handleBulkSave}
          disabled={bulkSaving || reportCards.length === 0}
          style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
            background: bulkSaving ? '#e8e0d4' : '#1a2e1e', color: bulkSaving ? '#a89478' : 'white', transition: 'all 0.15s' }}>
          {bulkSaving ? `💾 ${bulkProgress}%` : '💾 Tout sauvegarder'}
        </button>
      </div>

      {/* Barre progression bulk */}
      {bulkSaving && (
        <div style={{ background: '#e8e0d4', borderRadius: 6, height: 6, marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: '#1a2e1e', width: `${bulkProgress}%`, transition: 'width 0.3s' }} />
        </div>
      )}

      {/* Sélecteur période */}
      {periods.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {periods.map(p => (
            <button key={p.id} onClick={() => setSelectedPeriodId(p.id)}
              style={{ padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                background: selectedPeriodId === p.id ? '#1a2e1e' : '#f0ebe3',
                color: selectedPeriodId === p.id ? 'white' : '#6b5c45' }}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      {error && <div style={{ padding: 16, background: '#fee2e2', borderRadius: 10, color: '#991b1b', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>{error}</div>}

      {loadingCards ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#a89478', fontSize: 14 }}>Chargement des bulletins...</div>
      ) : reportCards.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>Aucun bulletin généré pour cette période</div>
          <div style={{ fontSize: 13, color: '#c4b8a8', marginTop: 6 }}>Les bulletins doivent être générés par l&apos;administration avant de pouvoir rédiger des appréciations.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {reportCards.map(rc => {
            const locked = isLocked(rc)
            const text = comments[rc.id] ?? ''
            const charCount = text.length
            return (
              <div key={rc.id} style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '20px 24px' }}>
                {/* Élève info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#1a2e1e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                      {rc.studentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>{rc.studentName}</div>
                      {rc.generalAverage !== null && (
                        <div style={{ fontSize: 13, color: '#6b5c45', fontWeight: 600 }}>Moyenne : {rc.generalAverage.toFixed(2)}/20</div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {saving[rc.id] && <span style={{ fontSize: 12, color: '#a89478', fontWeight: 600 }}>⏳ Sauvegarde...</span>}
                    {saved[rc.id] && !saving[rc.id] && <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>💾 Sauvegardé</span>}
                    {locked && (
                      <span style={{ fontSize: 12, color: '#6b5c45', fontWeight: 700, background: '#f0ebe3', padding: '4px 10px', borderRadius: 20 }}>
                        🔒 Verrouillé
                      </span>
                    )}
                  </div>
                </div>

                {locked ? (
                  <div style={{ padding: '12px 16px', background: '#f7f3ee', borderRadius: 10, border: '1.5px solid #e8e0d4', color: '#a89478', fontSize: 14, fontWeight: 600 }}>
                    🔒 Conseil verrouillé — appréciation non modifiable
                    {text && <div style={{ marginTop: 8, color: '#6b5c45', fontStyle: 'italic' }}>&ldquo;{text}&rdquo;</div>}
                  </div>
                ) : (
                  <>
                    {/* Chips */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {QUICK_CHIPS.map(chip => (
                        <button key={chip} onClick={() => setComments(c => ({ ...c, [rc.id]: chip }))}
                          style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1.5px solid #d4c8b8', background: 'white', color: '#6b5c45', fontFamily: 'inherit', transition: 'all 0.12s' }}
                          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: '#1a2e1e', color: 'white', borderColor: '#1a2e1e' })}
                          onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'white', color: '#6b5c45', borderColor: '#d4c8b8' })}>
                          {chip}
                        </button>
                      ))}
                    </div>

                    {/* Textarea */}
                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={text}
                        onChange={e => setComments(c => ({ ...c, [rc.id]: e.target.value }))}
                        maxLength={300}
                        placeholder="Rédigez votre appréciation..."
                        rows={3}
                        style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #d4c8b8', fontSize: 14, fontFamily: 'inherit', fontWeight: 500, color: '#1a1209', resize: 'vertical', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                        onFocus={e => (e.currentTarget.style.borderColor = '#1a2e1e')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#d4c8b8')}
                      />
                      <div style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 11, color: charCount > 270 ? '#dc2626' : '#a89478', fontWeight: 600 }}>
                        {charCount}/300
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
