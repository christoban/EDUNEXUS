'use client'
import { Bell, Search } from 'lucide-react'

interface UserInfo { firstName: string; lastName: string }

interface Props {
  title: string
  user?: UserInfo | null
}

export default function TeacherTopbar({ title, user }: Props) {
  const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '??'
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1)

  return (
    <header style={{
      height: 68, background: 'white', borderBottom: '1.5px solid #e8e0d4',
      display: 'flex', alignItems: 'center', padding: '0 28px',
      gap: 14, flexShrink: 0
    }}>
      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>
        {title}
      </div>
      <span style={{ background: '#f0ebe3', border: '1px solid #e8e0d4', borderRadius: 20, padding: '4px 12px', fontSize: 15, fontWeight: 600, color: '#a89478' }}>
        📅 {todayCapitalized}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#a89478' }} />
          <input type="text" placeholder="Rechercher..."
            style={{ background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px 8px 34px', fontSize: 15, fontWeight: 600, color: '#1a1209', outline: 'none', width: 240, fontFamily: 'inherit' }} />
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <Bell size={18} color="#6b5c45" />
          <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#dc2626', borderRadius: '50%', border: '2px solid white' }} />
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 11, background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', fontWeight: 800, fontSize: 15 }}>
          {initials}
        </div>
      </div>
    </header>
  )
}
