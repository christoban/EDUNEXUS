'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Search, Loader2, User, School, BookOpen, ClipboardList, KeyRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT, useLanguage } from '@/lib/i18n'
import ThemeToggle from '@/components/ThemeToggle'

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

export default function AdminTopbar({ title, onInvite, onNavigate, onChangePassword }: Props) {
  const t = useT('admin')

  const TYPE_CONFIG: Record<string, { label: string; section: string | null; icon: LucideIcon }> = {
    user:     { label: t('topbar.type_labels.user'), section: 'users',   icon: User },
    class:    { label: t('topbar.type_labels.class'), section: 'classes', icon: School },
    subject:  { label: t('topbar.type_labels.subject'), section: 'subjects',icon: BookOpen },
    activity: { label: t('topbar.type_labels.activity'), section: null,      icon: ClipboardList },
  }

  const CATEGORY_ORDER = ['user', 'class', 'subject', 'activity']

  const [todayLabel, setTodayLabel] = useState('')

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

  const { lang } = useLanguage()
  useEffect(() => {
    const locale = lang === 'en' ? 'en-US' : 'fr-FR'
    const d = new Date().toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    setTodayLabel(d.charAt(0).toUpperCase() + d.slice(1))
  }, [lang])

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
      height: 68, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 28px',
      gap: 14, flexShrink: 0,
      '--keyframes-edu-spin': 'edu-spin',
    } as React.CSSProperties & { '--keyframes-edu-spin': string }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </div>
      {todayLabel && (
        <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 15, fontWeight: 600, color: 'var(--text3)' }}>
          📅 {todayLabel}
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div ref={searchRef} style={{ position: 'relative' }}>
          {loading ? (
            <Loader2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--green)', animation: 'edu-spin 0.7s linear infinite' }} />
          ) : (
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          )}
          <input type="text" placeholder={t('topbar.search_placeholder')} value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (results.length > 0) setOpen(true) }}
            style={{ background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px 8px 34px', fontSize: 15, fontWeight: 600, color: 'var(--text)', outline: 'none', width: 260, fontFamily: 'inherit' }} />

          {open && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, maxHeight: 420, overflowY: 'auto' }}>
              {grouped.length === 0 ? (
                <div style={{ padding: '18px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
                  {t('topbar.no_results_for')} <strong>"{query}"</strong>
                </div>
              ) : grouped.map(g => {
                const TypeIcon = TYPE_CONFIG[g.type]?.icon
                return (
                <div key={g.type}>
                  <div style={{ padding: '10px 18px 6px', fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {TypeIcon && <TypeIcon size={13} strokeWidth={2.25} />}
                    {TYPE_CONFIG[g.type]?.label}
                  </div>
                  {g.items.map(r => (
                    <div key={`${r.type}_${r.id}`} onClick={() => handleSelect(r)}
                      style={{ padding: '9px 18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 1, transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{r.title}</span>
                      {r.subtitle && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{r.subtitle}</span>}
                    </div>
                  ))}
                </div>
                )
              })}
            </div>
          )}
        </div>
        <ThemeToggle />
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <Bell size={18} color="var(--text2)" />
          <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: 'var(--red)', borderRadius: '50%', border: '2px solid white' }} />
        </div>
        {onChangePassword && (
          <button onClick={onChangePassword} title={t('topbar.change_password')}
            style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <KeyRound size={18} color="var(--text2)" />
          </button>
        )}
        <button onClick={onInvite} style={{
          padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800,
          background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'var(--surface)',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit'
        }}>{t('topbar.invite')}</button>
      </div>
    </header>
  )
}
