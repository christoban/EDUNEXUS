'use client'
import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { TeacherSection, UserInfo } from '../_types'

interface NavItem {
  id: TeacherSection
  icon: string
  label: string
  badge?: string
  badgeColor?: 'red' | 'green' | 'amber'
}

interface NavGroup {
  label?: string
  items: NavItem[]
}

function buildNav(user: UserInfo | null | undefined, pendingGrades: number | undefined, tnav: ReturnType<typeof useT>, tcommon: ReturnType<typeof useT>): NavGroup[] {
  const groups: NavGroup[] = [
    {
      items: [{ id: 'dashboard', icon: '⊞', label: tnav('sidebar.dashboard') }],
    },
    {
      label: tnav('group.academic'),
      items: [
        { id: 'classes',    icon: '🏫', label: tnav('sidebar.myClasses') },
        { id: 'attendance', icon: '✅', label: tnav('sidebar.attendance') },
        { id: 'grades',     icon: '📝', label: tnav('sidebar.grades'), ...(pendingGrades ? { badge: String(pendingGrades), badgeColor: 'red' as const } : {}) },
        { id: 'timetable',  icon: '📅', label: tnav('sidebar.timetable') },
      ],
    },
    {
      label: tnav('group.pedagogie'),
      items: [{ id: 'cahier-de-texte', icon: '📓', label: tnav('sidebar.cahierDeTexte') }],
    },
    {
      label: tnav('group.ressources'),
      items: [{ id: 'resources', icon: '📦', label: tnav('sidebar.pedagogicalResources') }],
    },
  ]

  const ppClasses = user?.classesProfessorPrincipal ?? []
  if (ppClasses.length > 0) {
    const cls = ppClasses[0]!
    groups.push({
      label: tnav('group.pp'),
      items: [
        { id: 'pp-classe',        icon: '📋', label: `${tnav('sidebar.myClass')} · ${cls.name}` },
        { id: 'pp-appreciations', icon: '✍️',  label: tnav('sidebar.appreciations') },
      ],
    })
  }

  const depts = user?.headedDepartments ?? []
  if (depts.length > 0) {
    groups.push({
      label: tnav('group.ap'),
      items: depts.map(d => ({ id: 'ap-departement' as TeacherSection, icon: '🎯', label: d.name })),
    })
  }

  return groups
}

const BADGE_STYLES = {
  red:   'bg-red-500/25 text-red-300',
  green: 'bg-green-500/20 text-green-300',
  amber: 'bg-amber-500/20 text-amber-300',
}

export default function TeacherSidebar({
  current, onChange, schoolName, logoUrl, onLogout, user, pendingGrades, pendingCount,
}: {
  current: TeacherSection
  onChange: (s: TeacherSection) => void
  schoolName?: string
  logoUrl?: string | null
  onLogout?: () => void
  user?: UserInfo | null
  pendingGrades?: number
  pendingCount?: number
}) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const displayName = schoolName || tcommon('brand.fallbackSchool')
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
  const nav = buildNav(user, pendingGrades, tnav, tcommon)

  return (
    <aside className="w-[320px] min-w-[320px] flex flex-col h-screen flex-shrink-0 relative overflow-hidden" style={{ background: 'var(--sidebar)' }}>
      {/* Bande déco */}
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }}
      />

      {/* Brand */}
      <div className="flex items-center gap-[13px] border-b border-white/[0.07]" style={{ padding: '25px 25px' }}>
        <div className="w-13 h-13 rounded-[14px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--green))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div>
          <div className="font-spectral text-[25px] font-bold text-white leading-tight">ZekoulABia</div>
          <div className="text-[14px] text-white/35 font-semibold">{tcommon('brand.roleTeacher')}</div>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden" style={{ padding: '25px 25px' }}>
        {/* École pill */}
        <div className="bg-white/[0.06] border border-white/10 rounded-[10px] mb-[25px]" style={{ padding: '20px 23px' }}>
          <div className="flex items-center gap-[8px]">
            {logoUrl
              ? <img src={logoUrl} alt={displayName} className="w-10 h-10 rounded-[10px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[var(--green)] to-[var(--blue)] flex items-center justify-center text-[15px] font-black text-white flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[16px] font-bold text-white truncate">{displayName}</div>
              <div className="text-[13px] text-white/35">{tcommon('brand.roleTeacher')}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-[10px] py-1">
          {nav.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="text-[11px] font-black text-white/30 tracking-[1.2px] uppercase" style={{ padding: '14px 0 4px 0' }}>
                  {group.label}
                </div>
              )}
              {group.items.map(item => (
                <button key={`${gi}-${item.id}`} onClick={() => onChange(item.id)}
                  className={cn(
                    'relative w-full flex items-center gap-[20px] rounded-lg mb-[1px]',
                    'text-[16px] font-semibold text-left border-none cursor-pointer font-nunito',
                    current === item.id
                      ? 'text-white'
                      : 'text-white/52 hover:bg-[var(--sidebar2)] hover:text-white/82'
                  )}
                  style={{ padding: '6px 9px' }}>
                  {current === item.id && (
                    <motion.div layoutId="teacher-nav-active"
                      className="absolute inset-0 rounded-lg" style={{ background: 'var(--sidebar-active)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                  )}
                  <span className="relative z-10 text-[23px] w-[18px] text-center flex-shrink-0">{item.icon}</span>
                  <span className="relative z-10 truncate flex-1">{item.label}</span>
                  {item.badge && item.badgeColor && (
                    <span className={cn('relative z-10 ml-auto text-[13px] font-black rounded-lg', BADGE_STYLES[item.badgeColor])} style={{ padding: '3px 6px' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}

          {/* Synchronisation */}
          {pendingCount != null && pendingCount > 0 && (
            <div>
              <div className="text-[11px] font-black text-white/30 tracking-[1.2px] uppercase" style={{ padding: '14px 0 4px 0' }}>
                {tnav('sidebar.sync')}
              </div>
              <button onClick={() => onChange('sync')}
                className={cn(
                  'relative w-full flex items-center gap-[20px] rounded-lg mb-[1px]',
                  'text-[16px] font-semibold text-left border-none cursor-pointer font-nunito',
                  current === 'sync' ? 'text-white' : 'text-white/52 hover:bg-[var(--sidebar2)] hover:text-white/82'
                )}
                style={{ padding: '6px 9px' }}>
                {current === 'sync' && (
                  <motion.div layoutId="teacher-nav-active"
                    className="absolute inset-0 rounded-lg" style={{ background: 'var(--sidebar-active)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10 text-[23px] w-[18px] text-center flex-shrink-0">📶</span>
                <span className="relative z-10 truncate flex-1">{tnav('sidebar.sync')}</span>
                <span className={cn('relative z-10 ml-auto text-[13px] font-black rounded-lg', BADGE_STYLES.amber)} style={{ padding: '3px 6px' }}>
                  {pendingCount}
                </span>
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* User */}
      <div className="border-t border-white/[0.07]" style={{ padding: '20px 25px' }}>
        <div className="flex items-center gap-[12px] rounded-[10px] hover:bg-white/[0.06]" style={{ padding: '12px 14px' }}>
          <div className="w-11 h-11 rounded-[11px] bg-gradient-to-br from-[var(--blue)] to-[var(--purple)] flex items-center justify-center text-white font-black text-[16px] flex-shrink-0">
            {user ? (user.firstName[0] || '') + (user.lastName[0] || '') : '??'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold text-white truncate">{user ? `${user.firstName} ${user.lastName}` : tcommon('user.loading')}</div>
            <div className="text-[14px] text-white/35">{user?.role || tcommon('user.teacherFallback')}{user?.teacherProfile?.teacherSubjects?.length ? ` · ${user.teacherProfile.teacherSubjects.map(s => s.subject.name).join(', ')}` : ''}</div>
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
