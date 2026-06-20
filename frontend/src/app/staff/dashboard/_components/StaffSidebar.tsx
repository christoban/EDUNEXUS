'use client'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logoutUser } from '@/lib/userAuth'
import type { StaffSection, SessionUser } from '../_types'

interface NavItem {
  id: StaffSection
  icon: string
  label: string
  badge?: string
  badgeColor?: 'red' | 'amber' | 'green'
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

interface Props {
  current: StaffSection
  onChange: (s: StaffSection) => void
  allowedSections: Set<StaffSection>
  sessionUser: SessionUser | null
  schoolName?: string
  logoUrl?: string | null
  badges?: Partial<Record<StaffSection, string>>
}

const BADGE_STYLES = {
  red:   'bg-red-500/25 text-red-300',
  green: 'bg-green-500/20 text-green-300',
  amber: 'bg-amber-500/20 text-amber-300',
}

export default function StaffSidebar({ current, onChange, allowedSections, sessionUser, schoolName, logoUrl, badges = {} }: Props) {
  const can = (s: StaffSection) => allowedSections.has(s)

  const supervisionItems: NavItem[] = []
  if (can('council'))          supervisionItems.push({ id: 'council',          icon: '🎓', label: 'Conseil de classe', badge: badges.council,   badgeColor: 'amber' })
  if (can('grades'))           supervisionItems.push({ id: 'grades',           icon: '📝', label: 'Validation notes',  badge: badges.grades,    badgeColor: 'red'   })
  if (can('attendance'))       supervisionItems.push({ id: 'attendance',       icon: '✅', label: 'Présences',         badge: badges.attendance })
  if (can('grille-horaire'))   supervisionItems.push({ id: 'grille-horaire',   icon: '⏱️', label: 'Grille horaire' })
  if (can('affectations'))     supervisionItems.push({ id: 'affectations',     icon: '🔗', label: 'Affectations' })
  if (can('timetable'))        supervisionItems.push({ id: 'timetable',        icon: '📅', label: 'Emploi du temps' })
  if (can('departements'))     supervisionItems.push({ id: 'departements',     icon: '🏛️', label: 'Départements' })

  const servicesItems: NavItem[] = []
  if (can('finance'))     servicesItems.push({ id: 'finance',     icon: '📱', label: 'Mobile Money',  badge: badges.finance,  badgeColor: 'red' })
  if (can('cautions'))    servicesItems.push({ id: 'cautions',    icon: '🔒', label: 'Cautions' })
  if (can('discipline'))  servicesItems.push({ id: 'discipline',  icon: '⚠️', label: 'Discipline' })
  if (can('library'))     servicesItems.push({ id: 'library',     icon: '📚', label: 'Bibliothèque' })
  if (can('orientation')) servicesItems.push({ id: 'orientation', icon: '🧭', label: 'Orientation' })

  const navGroups: NavGroup[] = [
    { items: [{ id: 'dashboard', icon: '⊞', label: 'Tableau de bord' }] },
    ...(supervisionItems.length > 0 ? [{ label: 'Supervision', items: supervisionItems }] : []),
    ...(servicesItems.length > 0    ? [{ label: 'Services',    items: servicesItems    }] : []),
  ]

  const initials = sessionUser
    ? (sessionUser.nomComplet ?? '').split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
    : 'ST'

  return (
    <aside className="w-[280px] min-w-[280px] bg-[#1a2e1e] flex flex-col h-screen flex-shrink-0 relative overflow-hidden">
      {/* Bande déco camerounaise */}
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 13px,#22c55e 13px,#22c55e 25px,#ef4444 25px,#ef4444 37px,#60a5fa 37px,#60a5fa 49px)' }} />

      {/* Brand */}
      <div className="flex items-center gap-[13px] border-b border-white/[0.07]" style={{ padding: '25px 22px' }}>
        <div className="w-11 h-11 rounded-[13px] bg-gradient-to-br from-[#f59e0b] to-[#22c55e] flex items-center justify-center text-[24px] flex-shrink-0">🎓</div>
        <div>
          <div className="font-spectral text-[22px] font-bold text-white leading-tight">EduNexus</div>
          <div className="text-[13px] text-white/35 font-semibold">Espace Staff</div>
        </div>
      </div>

      {/* École */}
      <div style={{ padding: '16px 22px 0' }}>
        <div className="bg-white/[0.06] border border-white/10 rounded-[10px]" style={{ padding: '14px 16px' }}>
          <div className="flex items-center gap-[10px]">
            {logoUrl
              ? <img src={logoUrl} alt={schoolName ?? 'Logo'} className="w-9 h-9 rounded-[8px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-9 h-9 rounded-[8px] bg-gradient-to-br from-[#059669] to-[#1d4ed8] flex items-center justify-center text-[13px] font-black text-white flex-shrink-0">
                  {(schoolName ?? 'ET').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
            }
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-white truncate">{schoolName ?? 'Établissement'}</div>
              <div className="text-[12px] text-white/35">2025–2026</div>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '12px 12px' }}>
        {navGroups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 4 }}>
            {group.label && (
              <div className="text-[12px] font-black text-white/30 tracking-[1.2px] uppercase" style={{ padding: '10px 8px 4px' }}>
                {group.label}
              </div>
            )}
            {group.items.map(item => (
              <button key={item.id} onClick={() => onChange(item.id)}
                className={cn(
                  'w-full flex items-center gap-[14px] rounded-lg mb-[1px]',
                  'text-[15px] font-semibold transition-all duration-[120ms] text-left border-none cursor-pointer font-nunito',
                  current === item.id
                    ? 'bg-[#3a6b44] text-white'
                    : 'bg-transparent text-white/50 hover:bg-[#243b29] hover:text-white/80'
                )}
                style={{ padding: '8px 10px' }}>
                <span style={{ fontSize: 20, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                <span className="truncate flex-1">{item.label}</span>
                {item.badge && (
                  <span className={cn('ml-auto text-[12px] font-black rounded-md', BADGE_STYLES[item.badgeColor ?? 'red'])} style={{ padding: '2px 6px' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.07]" style={{ padding: '16px 22px' }}>
        <div className="flex items-center gap-[10px] rounded-[10px] hover:bg-white/[0.06] cursor-pointer" style={{ padding: '10px 12px' }}>
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[#0d9488] to-[#059669] flex items-center justify-center text-white font-black text-[14px] flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-white truncate">{sessionUser?.nomComplet ?? 'Membre du personnel'}</div>
            <div className="text-[12px] text-white/35">Staff</div>
          </div>
          <button onClick={logoutUser} title="Se déconnecter"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4, borderRadius: 6, flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.8)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
