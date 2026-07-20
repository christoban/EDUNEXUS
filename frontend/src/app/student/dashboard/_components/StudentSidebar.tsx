'use client'
import { motion } from 'framer-motion'
import { LogOut, LayoutDashboard, FileText, ScrollText, Calendar, ClipboardCheck, BookOpen, Bell, HeartPulse } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ThemeToggle from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { StudentSection, UserInfo } from '../_types'

interface NavItem {
  id: StudentSection
  icon: LucideIcon
  label: string
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

export default function StudentSidebar({ current, onChange, schoolName, logoUrl, onLogout, user }: {
  current: StudentSection
  onChange: (s: StudentSection) => void
  schoolName?: string
  logoUrl?: string | null
  onLogout?: () => void
  user?: UserInfo | null
}) {
  const tnav = useT('navigation')
  const tcommon = useT('common')

  const NAV: NavGroup[] = [
    {
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: tnav('sidebar.dashboard') },
      ]
    },
    {
      label: tnav('group.results'),
      items: [
        { id: 'grades',    icon: FileText, label: tnav('sidebar.myGrades') },
        { id: 'bulletins', icon: ScrollText, label: tnav('sidebar.bulletins') },
        { id: 'health-tracking', icon: HeartPulse, label: tnav('sidebar.myHealthTracking') },
      ]
    },
    {
      label: tnav('group.schoolAgenda'),
      items: [
        { id: 'timetable',  icon: Calendar, label: tnav('sidebar.timetable') },
        { id: 'attendance', icon: ClipboardCheck, label: tnav('sidebar.myAttendance') },
      ]
    },
    {
      label: tnav('group.services'),
      items: [
        { id: 'library', icon: BookOpen, label: tnav('sidebar.myLibrary') },
        { id: 'notifications', icon: Bell, label: tnav('sidebar.notifications') },
      ]
    },
  ]

  const displayName = schoolName || tcommon('brand.fallbackSchool')
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
  const className = user?.studentProfile?.class?.name || ''

  return (
    <aside className="w-[320px] min-w-[320px] flex flex-col h-screen flex-shrink-0 relative overflow-hidden" style={{ background: 'var(--sidebar)' }}>
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }} />

      <div className="flex items-center gap-[13px] border-b border-white/[0.07]" style={{ padding: '25px 25px' }}>
        <div className="w-13 h-13 rounded-[14px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--green))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div>
          <div className="font-spectral text-[25px] font-bold text-white leading-tight">ZekoulABia</div>
          <div className="text-[14px] text-white/35 font-semibold">{tcommon('brand.roleStudent')}</div>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '25px 25px' }}>
        <div className="bg-white/[0.06] border border-white/10 rounded-[10px] mb-[25px]" style={{ padding: '20px 23px' }}>
          <div className="flex items-center gap-[8px]">
            {logoUrl
              ? <img src={logoUrl} alt={displayName} className="w-10 h-10 rounded-[10px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[var(--green)] to-[var(--blue)] flex items-center justify-center text-[15px] font-black text-white flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[16px] font-bold text-white truncate">{displayName}</div>
              <div className="text-[13px] text-white/35">{tcommon('brand.roleStudent')}</div>
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
                    'relative w-full flex items-center gap-[20px] rounded-lg mb-[1px]',
                    'text-[16px] font-semibold text-left border-none cursor-pointer font-nunito',
                    current === item.id
                      ? 'text-white'
                      : 'text-white/52 hover:bg-[var(--sidebar2)] hover:text-white/82'
                  )}
                  style={{ padding: '6px 9px' }}>
                  {current === item.id && (
                    <motion.div layoutId="student-nav-active"
                      className="absolute inset-0 rounded-lg" style={{ background: 'var(--sidebar-active)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                  )}
                  <span className="relative z-10 w-[20px] flex items-center justify-center flex-shrink-0">
                    <item.icon size={20} strokeWidth={2} />
                  </span>
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
          <div className="w-11 h-11 rounded-[11px] bg-gradient-to-br from-[var(--purple)] to-[var(--blue)] flex items-center justify-center text-white font-black text-[16px] flex-shrink-0">
            {user ? (user.firstName[0] || '') + (user.lastName[0] || '') : '??'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold text-white truncate">{user ? `${user.firstName} ${user.lastName}` : tcommon('user.loading')}</div>
            <div className="text-[14px] text-white/35">{tcommon('user.studentFallback')}{className ? ` · ${className}` : ''}</div>
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
