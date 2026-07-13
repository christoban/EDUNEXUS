'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Search, X, FolderOpen } from 'lucide-react'

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
  { name: 'Lettres', color: 'var(--blue)' },
  { name: 'Sciences Humaines', color: 'var(--amber)' },
  { name: 'Langues Vivantes', color: 'var(--green)' },
  { name: 'Maths & Sciences', color: 'var(--red)' },
  { name: 'Informatique', color: 'var(--purple)' },
  { name: 'Arts & Culture', color: 'var(--orange)' },
  { name: 'Gris', color: 'var(--text3)' },
  { name: 'Personnalisé', color: 'var(--text)' },
]

export default function SectionDepartementsStaff({ onToast }: Props) {
  const t = useT('staff')
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
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={16} strokeWidth={2} /></span><span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={fetchDepartments} style={{ padding: '7px 16px', borderRadius: 9, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>{t('departements.retry')}</button>
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
          <div style={sTitle}>{t('departements.title')}</div>
          <div style={sSub}>{loading ? '…' : t('departements.subtitle', { count: departments.length })}</div>
        </div>
      </div>

      {/* Barre outils */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px', minWidth: 200, maxWidth: 400 }}>
          <span style={{ display: 'inline-flex' }}><Search size={16} strokeWidth={2} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('departements.searchPlaceholder')}
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
          {search && <span onClick={() => setSearch('')} style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 14, display: 'inline-flex' }}><X size={14} strokeWidth={2} /></span>}
        </div>
        {search && searchMatchCount > 0 && (
          <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
            {t('departements.resultsCount', { count: searchMatchCount })}
          </span>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Empty */}
      {!loading && departments.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '64px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16, display: 'flex', justifyContent: 'center' }}><FolderOpen size={48} strokeWidth={2} /></div>
          <div style={{ fontSize: 17, color: 'var(--text3)' }}>
            {t('departements.empty')}
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
                background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden',
                opacity: hasSearch && !hasAnyMatch ? 0.4 : 1,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ height: 6, background: dept.color }} />
                <div style={{ padding: '16px 18px' }}>
                  {/* En-tête */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: dept.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>{dept.name}</span>
                      <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700 }}>({dept.subjects.length})</span>
                    </div>
                  </div>

                  {/* AP */}
                  <div style={{ marginBottom: 10 }}>
                    {dept.head
                      ? <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                          {t('departements.apLabel', { firstName: dept.head.firstName, lastName: dept.head.lastName })}
                        </span>
                      : <span style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>{t('departements.apNotAssigned')}</span>
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
                              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: isMatch ? 'var(--text)' : 'var(--text3)' }}>
                                {hasSearch && isMatch ? highlightMatch(s.name, search) : s.name}
                              </span>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic', textAlign: 'center', padding: '12px 0' }}>
                      {t('departements.noSubjects')}
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
      <strong style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '1px 3px', borderRadius: 4, fontWeight: 900 }}>{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </span>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
