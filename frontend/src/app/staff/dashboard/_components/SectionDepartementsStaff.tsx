'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface SubjectItem {
  id: string; name: string; code: string | null
}

interface Department {
  id: string; name: string; color: string
  head: { id: string; firstName: string; lastName: string } | null
  subjects: SubjectItem[]
}

const DEPT_COLORS = [
  { name: 'Lettres', color: '#3b82f6' },
  { name: 'Sciences Humaines', color: '#f59e0b' },
  { name: 'Langues Vivantes', color: '#10b981' },
  { name: 'Maths & Sciences', color: '#ef4444' },
  { name: 'Informatique', color: '#8b5cf6' },
  { name: 'Arts & Culture', color: '#f97316' },
  { name: 'Gris', color: '#6b7280' },
  { name: 'Personnalisé', color: '#1a1209' },
]

export default function SectionDepartementsStaff({ onToast }: Props) {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/departments', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setDepartments(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchDepartments() }, [fetchDepartments])

  const searchLower = search.toLowerCase()
  const searchMatchCount = search
    ? departments.reduce((sum, d) => sum + d.subjects.filter(s => s.name.toLowerCase().includes(searchLower)).length, 0)
    : 0

  function getColorInfo(color: string) {
    return DEPT_COLORS.find(c => c.color === color) ?? { color, name: color }
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
        <div style={{ background: '#fee2e2', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>⚠️</span><span style={{ fontWeight: 700, color: '#dc2626', flex: 1 }}>{error}</span>
          <button onClick={fetchDepartments} style={{ padding: '7px 16px', borderRadius: 9, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>Réessayer</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={sTitle}>Départements pédagogiques</div>
          <div style={sSub}>{loading ? '…' : `${departments.length} département${departments.length > 1 ? 's' : ''}`}</div>
        </div>
      </div>

      {/* Barre outils */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px', minWidth: 200, maxWidth: 400 }}>
          <span>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une matière…"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
          {search && <span onClick={() => setSearch('')} style={{ cursor: 'pointer', color: '#a89478', fontSize: 14 }}>✕</span>}
        </div>
        {search && searchMatchCount > 0 && (
          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
            {searchMatchCount} résultat{searchMatchCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Empty */}
      {!loading && departments.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
          <div style={{ fontSize: 17, color: '#a89478' }}>
            Aucun département pédagogique configuré.
          </div>
        </div>
      )}

      {/* Grid */}
      {!loading && departments.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {departments.sort((a, b) => a.name.localeCompare(b.name)).map(dept => {
            const hasSearch = search.length > 0
            const matchingSubjectIds = new Set(
              dept.subjects.filter(s => s.name.toLowerCase().includes(searchLower)).map(s => s.id)
            )
            const hasAnyMatch = !hasSearch || matchingSubjectIds.size > 0
            const colorInfo = getColorInfo(dept.color)

            return (
              <div key={dept.id} style={{
                background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden',
                opacity: hasSearch && !hasAnyMatch ? 0.4 : 1,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ height: 6, background: dept.color }} />
                <div style={{ padding: '16px 18px' }}>
                  {/* En-tête */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: dept.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>{dept.name}</span>
                      <span style={{ fontSize: 13, color: '#a89478', fontWeight: 700 }}>({dept.subjects.length})</span>
                    </div>
                  </div>

                  {/* AP */}
                  <div style={{ marginBottom: 10 }}>
                    {dept.head
                      ? <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                          AP : {dept.head.firstName} {dept.head.lastName}
                        </span>
                      : <span style={{ color: '#dc2626', fontSize: 13, fontWeight: 600 }}>⚠️ AP non désigné</span>
                    }
                  </div>

                  {/* Matières */}
                  {dept.subjects.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dept.subjects
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(s => {
                          const isMatch = !hasSearch || matchingSubjectIds.has(s.id)
                          return (
                            <div key={s.id} style={{
                              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8,
                              opacity: hasSearch && !isMatch ? 0.3 : 1,
                              transition: 'opacity 0.2s',
                            }}>
                              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isMatch ? '#1a1209' : '#a89478' }}>
                                {hasSearch && isMatch ? highlightMatch(s.name, search) : s.name}
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div style={{ color: '#a89478', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                      Aucune matière
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <span>
      {text.slice(0, idx)}
      <strong style={{ background: '#fef3c7', color: '#92400e', padding: '1px 3px', borderRadius: 4, fontWeight: 900 }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </span>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
