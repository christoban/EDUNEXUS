'use client'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useT } from '@/lib/i18n'

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const t = useT('common')
  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? t('theme.toLight') : t('theme.toDark')}
      style={{
        width: 42,
        height: 42,
        borderRadius: 10,
        background: 'var(--bg2)',
        border: '1.5px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--text)',
        flexShrink: 0,
        transition: 'background 0.2s, color 0.2s, border-color 0.2s',
      }}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
