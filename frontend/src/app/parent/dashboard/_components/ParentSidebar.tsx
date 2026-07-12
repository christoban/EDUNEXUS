'use client'
import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { ParentSection } from '../_types'

interface NavItem {
  id: ParentSection
  icon: string
  label: string
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

interface UserInfo { id: string; firstName: string; lastName: string; role: string }
interface SchoolInfo { name: string; logoUrl: string | null }

export default function ParentSidebar({ current, onChange, onLogout, user, school }: {
  current: ParentSection
  onChange: (s: ParentSection) => void
  onLogout?: () => void
  user?: UserInfo | null
  school?: SchoolInfo | null
}) {
  const tnav = useT('navigation')
  const tcommon = useT('common')

  const NAV_GROUPS: NavGroup[] = [
    {
      items: [
        { id: 'children', icon: '👨‍👩‍👧', label: tnav('sidebar.myChildren') },
      ]
    },
    {
      label: tnav('group.academic'),
      items: [
        { id: 'grades',     icon: '📄', label: tnav('sidebar.grades') },
        { id: 'attendance', icon: '✅', label: tnav('sidebar.attendance') },
        { id: 'timetable',  icon: '📅', label: tnav('sidebar.timetable') },
      ]
    },
    {
      label: tnav('group.services'),
      items: [
        { id: 'payments', icon: '📱', label: tnav('sidebar.payments') },
        { id: 'library',  icon: '📚', label: tnav('sidebar.readings') },
        { id: 'settings', icon: '⚙️', label: tnav('sidebar.settings') },
      ]
    },
  ]

  const userDisplayName = user ? `${user.firstName} ${user.lastName}` : tcommon('user.loading')
  const userInitials = user ? (user.firstName[0] ?? '') + (user.lastName[0] ?? '') : tcommon('brand.fallbackInitials')

  return (
    <aside className="w-[320px] min-w-[320px] flex flex-col h-screen flex-shrink-0 relative overflow-hidden" style={{ background: 'var(--sidebar)' }}>
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }} />

      <div className="flex items-center gap-[13px] border-b border-white/[0.07]" style={{ padding: '25px 25px' }}>
        <div className="w-13 h-13 rounded-[14px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--green))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div>
          <div className="font-spectral text-[25px] font-bold text-white leading-tight">ZekoulABia</div>
          <div className="text-[14px] text-white/35 font-semibold">{tcommon('brand.roleParent')}</div>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '25px 25px' }}>
        <div className="bg-white/[0.06] border border-white/10 rounded-[10px] mb-[25px]" style={{ padding: '20px 23px' }}>
          <div className="flex items-center gap-[8px]">
            {school?.logoUrl
              ? <img src={school.logoUrl} alt={school.name} className="w-10 h-10 rounded-[10px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[var(--green)] to-[var(--blue)] flex items-center justify-center text-[15px] font-black text-white flex-shrink-0">
                  {school ? school.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') : tcommon('brand.fallbackInitials')}
                </div>
            }
            <div className="min-w-0">
              <div className="text-[16px] font-bold text-white truncate">{school?.name ?? tcommon('user.loading')}</div>
              <div className="text-[13px] text-white/35">{tcommon('brand.roleParent')}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-[10px] py-1">
          {NAV_GROUPS.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="text-[14px] font-black text-white/30 tracking-[1.2px] uppercase" style={{ padding: '11px 0 0 0' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => (
                <button key={item.id} onClick={() => onChange(item.id)}
                  className={cn(
                    'relative w-full flex items-center gap-[20px] rounded-lg mb-[1px]',
                    'text-[16px] font-semibold text-left border-none cursor-pointer font-nunito',
                    current === item.id
                      ? 'text-white'
                      : 'text-white/52 hover:bg-[var(--sidebar2)] hover:text-white/82'
                  )}
                  style={{ padding: '6px 9px' }}>
                  {current === item.id && (
                    <motion.div layoutId="parent-nav-active"
                      className="absolute inset-0 rounded-lg" style={{ background: 'var(--sidebar-active)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                  )}
                  <span className="relative z-10 text-[23px] w-[18px] text-center flex-shrink-0">{item.icon}</span>
                  <span className="relative z-10 truncate flex-1">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/[0.07]" style={{ padding: '20px 25px' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}><ThemeToggle /></div>
        <div className="flex items-center gap-[12px] rounded-[10px] hover:bg-white/[0.06]" style={{ padding: '12px 14px' }}>
          <div className="w-11 h-11 rounded-[11px] bg-gradient-to-br from-[var(--amber)] to-[var(--orange)] flex items-center justify-center text-white font-black text-[16px] flex-shrink-0">
            {user ? (user.firstName[0] ?? '') + (user.lastName[0] ?? '') : tcommon('brand.fallbackInitials')}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold text-white truncate">{userDisplayName}</div>
            <div className="text-[14px] text-white/35">{tcommon('user.parentFallback')}</div>
          </div>
          {onLogout && (
            <button onClick={onLogout} title={tcommon('user.logoutTitle')}
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
