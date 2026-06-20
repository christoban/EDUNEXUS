'use client'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StudentSection, UserInfo } from '../_types'

interface NavItem {
  id: StudentSection
  icon: string
  label: string
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    items: [
      { id: 'dashboard', icon: '⊞', label: 'Tableau de bord' },
    ]
  },
  {
    label: 'Résultats',
    items: [
      { id: 'grades',    icon: '📝', label: 'Mes notes' },
      { id: 'bulletins', icon: '📄', label: 'Bulletins' },
    ]
  },
  {
    label: 'Agenda scolaire',
    items: [
      { id: 'timetable',  icon: '📅', label: 'Emploi du temps' },
      { id: 'attendance', icon: '✅', label: 'Mes présences' },
    ]
  },
  {
    label: 'Services',
    items: [
      { id: 'library', icon: '📚', label: 'Mes lectures' },
    ]
  },
]

export default function StudentSidebar({ current, onChange, schoolName, logoUrl, onLogout, user }: {
  current: StudentSection
  onChange: (s: StudentSection) => void
  schoolName?: string
  logoUrl?: string | null
  onLogout?: () => void
  user?: UserInfo | null
}) {
  const displayName = schoolName || 'Mon établissement'
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
  const className = user?.studentProfile?.class?.name || ''

  return (
    <aside className="w-[320px] min-w-[320px] bg-[#1a2e1e] flex flex-col h-screen flex-shrink-0 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 13px,#22c55e 13px,#22c55e 25px,#ef4444 25px,#ef4444 37px,#60a5fa 37px,#60a5fa 49px)' }} />

      <div className="flex items-center gap-[13px] border-b border-white/[0.07]" style={{ padding: '25px 25px' }}>
        <div className="w-13 h-13 rounded-[14px] bg-gradient-to-br from-[#f59e0b] to-[#22c55e] flex items-center justify-center text-[26px] flex-shrink-0">🎓</div>
        <div>
          <div className="font-spectral text-[25px] font-bold text-white leading-tight">EduNexus</div>
          <div className="text-[14px] text-white/35 font-semibold">Espace Élève</div>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '25px 25px' }}>
        <div className="bg-white/[0.06] border border-white/10 rounded-[10px] mb-[25px]" style={{ padding: '20px 23px' }}>
          <div className="flex items-center gap-[8px]">
            {logoUrl
              ? <img src={logoUrl} alt={displayName} className="w-10 h-10 rounded-[10px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#059669] to-[#1d4ed8] flex items-center justify-center text-[15px] font-black text-white flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[16px] font-bold text-white truncate">{displayName}</div>
              <div className="text-[13px] text-white/35">Espace Élève</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-[10px] py-1">
          {NAV.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="text-[14px] font-black text-white/30 tracking-[1.2px] uppercase" style={{ padding: '11px 0 0 0' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => (
                <button key={item.id} onClick={() => onChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-[20px] rounded-lg mb-[1px]',
                    'text-[16px] font-semibold transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                    current === item.id
                      ? 'bg-[#3a6b44] text-white'
                      : 'bg-transparent text-white/52 hover:bg-[#243b29] hover:text-white/82'
                  )}
                  style={{ padding: '6px 9px' }}>
                  <span className="text-[23px] w-[18px] text-center flex-shrink-0">{item.icon}</span>
                  <span className="truncate flex-1">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/[0.07]" style={{ padding: '20px 25px' }}>
        <div className="flex items-center gap-[12px] rounded-[10px] hover:bg-white/[0.06]" style={{ padding: '12px 14px' }}>
          <div className="w-11 h-11 rounded-[11px] bg-gradient-to-br from-[#7c3aed] to-[#1d4ed8] flex items-center justify-center text-white font-black text-[16px] flex-shrink-0">
            {user ? (user.firstName[0] || '') + (user.lastName[0] || '') : '??'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold text-white truncate">{user ? `${user.firstName} ${user.lastName}` : 'Chargement...'}</div>
            <div className="text-[14px] text-white/35">Élève{className ? ` · ${className}` : ''}</div>
          </div>
          {onLogout && (
            <button onClick={onLogout} title="Se déconnecter"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', flexShrink: 0, padding: 4, borderRadius: 6 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
