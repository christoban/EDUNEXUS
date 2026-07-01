'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Search, Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'

interface SearchResult {
  id: string
  type: 'user' | 'class' | 'subject' | 'activity'
  title: string
  subtitle: string | null
}

interface Props {
  title: string
  onInvite: () => void
  onNavigate?: (section: string) => void
  onChangePassword?: () => void
}

const TYPE_CONFIG: Record<string, { label: string; section: string | null; icon: string }> = {
  user:     { label: 'Utilisateurs', section: 'users',   icon: '👤' },
  class:    { label: 'Classes',      section: 'classes', icon: '🏫' },
  subject:  { label: 'Matières',     section: 'subjects',icon: '📚' },
  activity: { label: 'Activités',    section: null,      icon: '📋' },
}

const CATEGORY_ORDER = ['user', 'class', 'subject', 'activity']

export default function AdminTopbar({ title, onInvite, onNavigate, onChangePassword }: Props) {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1)

  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SearchResult[]>([])
  const [loading, setLoading]       = useState(false)
  const [open, setOpen]             = useState(false)
  const debounceRef                 = useRef<NodeJS.Timeout | null>(null)
  const searchRef                   = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await fetchApi(`/api/v2/search/global?q=${encodeURIComponent(q.trim())}`, { credentials: 'include' })
      const data = await res.json()
      if (res.ok) {
        setResults(data.results || [])
        setOpen(true)
      }
    } catch { /* silencieux */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false)
  }

  const handleSelect = (r: SearchResult) => {
    setOpen(false)
    setQuery('')
    const cfg = TYPE_CONFIG[r.type]
    if (cfg?.section && onNavigate) onNavigate(cfg.section)
  }

  const grouped = CATEGORY_ORDER
    .map(t => ({ type: t, items: results.filter(r => r.type === t) }))
    .filter(g => g.items.length > 0)

  return (
    <header style={{
      height: 68, background: 'white', borderBottom: '1.5px solid #e8e0d4',
      display: 'flex', alignItems: 'center', padding: '0 28px',
      gap: 14, flexShrink: 0,
      '--keyframes-edu-spin': 'edu-spin',
    } as React.CSSProperties & { '--keyframes-edu-spin': string }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>
        {title}
      </div>
      <span style={{ background: '#f0ebe3', border: '1px solid #e8e0d4', borderRadius: 20, padding: '4px 12px', fontSize: 15, fontWeight: 600, color: '#a89478' }}>
        📅 {todayCapitalized}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div ref={searchRef} style={{ position: 'relative' }}>
          {loading ? (
            <Loader2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#059669', animation: 'edu-spin 0.7s linear infinite' }} />
          ) : (
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#a89478' }} />
          )}
          <input type="text" placeholder="Rechercher..." value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length > 0) setOpen(true) }}
            style={{ background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px 8px 34px', fontSize: 15, fontWeight: 600, color: '#1a1209', outline: 'none', width: 260, fontFamily: 'inherit' }} />

          {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', zIndex: 1000, maxHeight: 420, overflowY: 'auto' }}>
              {grouped.length === 0 ? (
                <div style={{ padding: '18px 20px', textAlign: 'center', color: '#a89478', fontSize: 14 }}>
                  Aucun résultat pour <strong>"{query}"</strong>
                </div>
              ) : grouped.map(g => (
                <div key={g.type}>
                  <div style={{ padding: '10px 18px 6px', fontSize: 12, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {TYPE_CONFIG[g.type]?.icon} {TYPE_CONFIG[g.type]?.label}
                  </div>
                  {g.items.map(r => (
                    <div key={`${r.type}_${r.id}`} onClick={() => handleSelect(r)}
                      style={{ padding: '9px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1, transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0ebe3'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1209' }}>{r.title}</span>
                      {r.subtitle && <span style={{ fontSize: 12, color: '#a89478' }}>{r.subtitle}</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <Bell size={18} color="#6b5c45" />
          <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#dc2626', borderRadius: '50%', border: '2px solid white' }} />
        </div>
        {onChangePassword && (
          <button onClick={onChangePassword} title="Changer le mot de passe"
            style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}>
            🔐
          </button>
        )}
        <button onClick={onInvite} style={{
          padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800,
          background: 'linear-gradient(135deg,#059669,#047857)', color: 'white',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit'
        }}>+ Inviter</button>
      </div>
    </header>
  )
}
