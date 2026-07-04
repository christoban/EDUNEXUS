'use client'
import { useState, useEffect } from 'react'
import { Bell, Search } from 'lucide-react'
import { useT } from '@/lib/i18n'
import ThemeToggle from '@/components/ThemeToggle'

interface UserInfo { firstName: string; lastName: string }

interface Props {
  title: string
  user?: UserInfo | null
}

export default function TeacherTopbar({ title, user }: Props) {
  const tcommon = useT('common')
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '??'
  const [todayLabel, setTodayLabel] = useState('')

  useEffect(() => {
    const d = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    setTodayLabel(d.charAt(0).toUpperCase() + d.slice(1))
  }, [])

  return (
    <header style={{
      height: 68, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 28px',
      gap: 14, flexShrink: 0
    }}>
      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
        {title}
      </div>
      {todayLabel && (
        <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 12px', fontSize: 15, fontWeight: 600, color: 'var(--text3)' }}>
          📅 {todayLabel}
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input type="text" placeholder={tcommon('actions.search')}
            style={{ background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px 8px 34px', fontSize: 15, fontWeight: 600, color: 'var(--text)', outline: 'none', width: 240, fontFamily: 'inherit' }} />
        </div>
        <ThemeToggle />
        <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <Bell size={18} color="var(--text2)" />
          <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: 'var(--red)', borderRadius: '50%', border: '2px solid white' }} />
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg,var(--blue),var(--purple))', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--surface)', fontWeight: 800, fontSize: 15 }}>
          {initials}
        </div>
      </div>
    </header>
  )
}
