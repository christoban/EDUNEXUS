'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2, User, School, BookOpen, ClipboardList, KeyRound, MoreVertical, ArrowLeft, Bell, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT, useLanguage } from '@/lib/i18n'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/NotificationBell'
import MobileMenuButton from '@/components/MobileMenuButton'
import { useNotifications } from '@/hooks/NotificationContext'

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
  onMenuClick?: () => void
}

export default function AdminTopbar({ title, onInvite, onNavigate, onChangePassword, onMenuClick }: Props) {
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

  // Recherche/actions secondaires en dessous de md : icône loupe qui ouvre le champ, actions
  // secondaires (thème/notifications/mot de passe/inviter) regroupées dans un menu kebab.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [kebabOpen, setKebabOpen]   = useState(false)
  const mobileSearchRef             = useRef<HTMLDivElement>(null)
  const kebabRef                    = useRef<HTMLDivElement>(null)
  const { unreadCount } = useNotifications()

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
      const insideDesktopSearch = !!searchRef.current?.contains(e.target as Node)
      const insideMobileSearch = !!mobileSearchRef.current?.contains(e.target as Node)
      if (!insideDesktopSearch && !insideMobileSearch) setOpen(false)
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) setKebabOpen(false)
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

  const searchResultsDropdown = (
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
  )

  return (
    <header className="px-[14px] md:px-[28px]" style={{
      height: 68, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)',
      display: 'flex', alignItems: 'center',
      gap: 14, flexShrink: 0, position: 'relative',
      '--keyframes-edu-spin': 'edu-spin',
    } as React.CSSProperties & { '--keyframes-edu-spin': string }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Recherche mobile en plein écran de la barre — sm:hidden, ne s'affiche donc jamais
          à partir de sm même si l'état reste true (ex. rotation d'écran). */}
      {mobileSearchOpen && (
        <div ref={mobileSearchRef} className="sm:hidden flex" style={{ position: 'absolute', inset: 0, background: 'var(--surface)', alignItems: 'center', padding: '0 14px', gap: 10, zIndex: 20 }}>
          <button onClick={() => { setMobileSearchOpen(false); setQuery(''); setResults([]); setOpen(false) }}
            aria-label="Retour"
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0, color: 'var(--text2)', padding: 4 }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ position: 'relative', flex: 1 }}>
            {loading ? (
              <Loader2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--green)', animation: 'edu-spin 0.7s linear infinite' }} />
            ) : (
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
            )}
            <input autoFocus type="text" placeholder={t('topbar.search_placeholder')} value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (results.length > 0) setOpen(true) }}
              className="text-[14px]"
              style={{ width: '100%', background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px 8px 34px', fontWeight: 600, color: 'var(--text)', outline: 'none', fontFamily: 'inherit' }} />
            {open && searchResultsDropdown}
          </div>
        </div>
      )}

      {onMenuClick && <MobileMenuButton onClick={onMenuClick} />}

      <div className="text-[17px] md:text-[22px] truncate" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </div>
      {todayLabel && (
        <span className="hidden lg:inline" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 15, fontWeight: 600, color: 'var(--text3)' }}>
          📅 {todayLabel}
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Icône de recherche — sous sm uniquement, ouvre l'overlay ci-dessus */}
        <button onClick={() => setMobileSearchOpen(true)} aria-label={t('topbar.search_placeholder')}
          className="sm:hidden flex" style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Search size={16} color="var(--text2)" />
        </button>

        {/* Champ de recherche complet — à partir de sm */}
        <div ref={searchRef} className="hidden sm:block" style={{ position: 'relative' }}>
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
          {open && searchResultsDropdown}
        </div>

        {/* Actions secondaires — inchangées à partir de md */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: 12 }}>
          <ThemeToggle />
          <NotificationBell onNav={onNavigate} />
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

        {/* Menu kebab — regroupe les actions secondaires sous md */}
        <div ref={kebabRef} className="md:hidden" style={{ position: 'relative' }}>
          <button onClick={() => setKebabOpen(o => !o)} aria-label="Menu"
            style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <MoreVertical size={18} color="var(--text2)" />
          </button>
          {kebabOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 220, background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, padding: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px' }}>
                <ThemeToggle />
                <span className="text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('topbar.theme')}</span>
              </div>
              <button onClick={() => { onNavigate?.('notifications'); setKebabOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                <Bell size={17} color="var(--text2)" />
                <span className="text-[13px]" style={{ fontWeight: 700, color: 'var(--text)', flex: 1, textAlign: 'left' }}>{t('topbar.notifications')}</span>
                {unreadCount > 0 && (
                  <span className="text-[11px]" style={{ background: 'var(--red)', color: 'white', fontWeight: 800, borderRadius: 999, padding: '1px 7px' }}>{unreadCount}</span>
                )}
              </button>
              {onChangePassword && (
                <button onClick={() => { onChangePassword(); setKebabOpen(false) }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, fontFamily: 'inherit' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                  <KeyRound size={17} color="var(--text2)" />
                  <span className="text-[13px]" style={{ fontWeight: 700, color: 'var(--text)' }}>{t('topbar.change_password')}</span>
                </button>
              )}
              <button onClick={() => { onInvite(); setKebabOpen(false) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 10, fontFamily: 'inherit' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
                <UserPlus size={17} color="var(--green)" />
                <span className="text-[13px]" style={{ fontWeight: 800, color: 'var(--green)' }}>{t('topbar.invite')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
