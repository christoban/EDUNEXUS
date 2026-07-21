'use client'
import { motion } from 'framer-motion'
import {
  LogOut, LayoutDashboard, Users, School, BookOpen, ClipboardCheck, FileText,
  ScrollText, Calendar, GraduationCap, NotebookPen, Briefcase, CalendarDays,
  Smartphone, IdCard, Wallet, ClipboardEdit, UserPlus, BarChart3, ClipboardList,
  Globe, Languages, Bot, Megaphone, Settings, CalendarClock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'
import type { AdminSection } from '../_types'

interface NavItem {
  id: AdminSection
  icon: LucideIcon
  label: string
  badge?: string
  badgeColor?: 'red' | 'green' | 'amber'
}

interface NavSection {
  label?: string
  items: NavItem[]
}

const BADGE_STYLES = {
  red:   'bg-red-500/25 text-red-300',
  green: 'bg-green-500/20 text-green-300',
  amber: 'bg-amber-500/20 text-amber-300',
}

interface SessionUser {
  nomComplet?: string
  firstName?: string
  role?: string
}

interface Props {
  current: AdminSection
  onChange: (s: AdminSection) => void
  schoolName?: string
  logoUrl?: string | null
  badges?: Partial<Record<AdminSection, string>>
  sessionUser?: SessionUser | null
  onLogout?: () => void
  /** Types d'AcademicEvent actuellement actifs — masque les menus de fonctionnalités
   * événementielles (ex. 'lv2-choice') tant que la fonctionnalité réelle n'est pas ouverte. */
  activeEventTypes?: string[]
  /** Concours 6e / PEBS : pas de AcademicEvent dédié, gaté directement sur le statut réel de la
   * session (EntranceExamSession/PebsExamSession != CLOSED|APPLIED). */
  hasActiveEntranceExam?: boolean
  hasActivePebs?: boolean
}

export default function AdminSidebar({ current, onChange, schoolName, logoUrl, badges = {}, sessionUser, onLogout, activeEventTypes = [], hasActiveEntranceExam = false, hasActivePebs = false }: Props) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const displayName = schoolName || tcommon('brand.fallbackSchool')
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

  const userDisplayName = sessionUser?.nomComplet ?? sessionUser?.firstName ?? tcommon('user.fallbackName')
  const userInitials = userDisplayName.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2)

  const NAV: NavSection[] = [
    {
      items: [
        { id: 'dashboard', icon: LayoutDashboard, label: tnav('sidebar.dashboard') },
        { id: 'users',     icon: Users, label: tnav('sidebar.users'),     badge: badges.users,   badgeColor: 'green' },
        { id: 'classes',   icon: School, label: tnav('sidebar.classes'),   badge: badges.classes, badgeColor: 'green' },
        { id: 'subjects',  icon: BookOpen, label: tnav('sidebar.subjects') },
      ]
    },
    {
      label: tnav('group.academic'),
      items: [
        { id: 'attendance', icon: ClipboardCheck, label: tnav('sidebar.attendance') },
        { id: 'grades',     icon: FileText, label: tnav('sidebar.grades'),     badge: badges.grades, badgeColor: 'red' },
        { id: 'bulletins',  icon: ScrollText, label: tnav('sidebar.bulletins') },
        { id: 'timetable',  icon: Calendar, label: tnav('sidebar.timetable') },
        { id: 'council',    icon: GraduationCap, label: tnav('sidebar.council') },
        { id: 'pedagogie',  icon: NotebookPen, label: tnav('sidebar.pedagogie') },
        { id: 'rh',         icon: Briefcase, label: tnav('sidebar.rh') },
      ]
    },
    {
      label: tnav('group.services'),
      items: [
        { id: 'academic-year', icon: CalendarDays, label: tnav('sidebar.academicYear') },
        { id: 'academic-events', icon: CalendarClock, label: tnav('sidebar.academicEvents') },
        { id: 'finance',       icon: Smartphone, label: tnav('sidebar.finance'),     badge: badges.finance, badgeColor: 'amber' },
        { id: 'matricules',    icon: IdCard, label: tnav('sidebar.matricules') },
        { id: 'school-payments', icon: Wallet, label: tnav('sidebar.schoolPayments') },
        // Masqué tant qu'aucune session de concours n'est en cours (statut réel de
        // EntranceExamSession != CLOSED) — pas de AcademicEvent dédié, la session est déjà sa
        // propre source de vérité.
        ...(hasActiveEntranceExam ? [{ id: 'entrance-exams' as const, icon: ClipboardEdit, label: tnav('sidebar.entranceExams') }] : []),
        { id: 'eleve-onboarding', icon: UserPlus, label: tnav('sidebar.eleveOnboarding') },
        { id: 'minesec-stats', icon: BarChart3, label: tnav('sidebar.minesecStats') },
        { id: 'minedub-stats', icon: ClipboardList, label: tnav('sidebar.minedubStats') },
        // Même principe — masqué tant qu'aucune session PEBS n'est en cours (!= APPLIED).
        ...(hasActivePebs ? [{ id: 'pebs-exams' as const, icon: Globe, label: tnav('sidebar.pebsExams') }] : []),
        // Masqué tant qu'aucune fenêtre de choix LV2 n'est réellement ouverte (AcademicEvent
        // CHOIX_LV2 actif) — jamais affiché à vide toute l'année pour rien.
        ...(activeEventTypes.includes('CHOIX_LV2') ? [{ id: 'lv2-choice' as const, icon: Languages, label: tnav('sidebar.lv2Choice') }] : []),
        { id: 'ai',            icon: Bot, label: tnav('sidebar.ai') },
        { id: 'statistics',    icon: BarChart3, label: tnav('sidebar.statistics') },
        { id: 'communications', icon: Megaphone, label: tnav('sidebar.communications') },
        // Retiré de la sidebar — redondant avec la cloche (permanente sur tous les écrans),
        // qui offre désormais un lien « Voir tout » vers cette même page.
        { id: 'settings',      icon: Settings, label: tnav('sidebar.settings') },
      ]
    }
  ]

  return (
    <aside className="w-[320px] min-w-[320px] flex-shrink-0 relative" style={{ background: 'var(--sidebar)', display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Bande déco */}
      <div className="absolute top-0 left-0 right-0 h-[5px] z-10"
        style={{ background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 13px,var(--green) 13px,var(--green) 25px,var(--red) 25px,var(--red) 37px,#60a5fa 37px,#60a5fa 49px)' }}
      />

      {/* Brand */}
      <div className="flex items-center gap-[13px] border-b border-white/[0.07]" style={{ padding: "25px 25px", flexShrink: 0 }}>
        <div className="w-13 h-13 rounded-[14px] flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg,var(--amber),var(--green))" }}><img src="/logo.svg" alt="ZekoulABia" style={{ width: "70%", height: "70%", objectFit: "contain" }} /></div>
        <div>
          <div className="font-spectral text-[25px] font-bold text-white leading-tight">ZekoulABia</div>
          <div className="text-[14px] text-white/35 font-semibold">{tcommon('brand.roleAdmin')}</div>
        </div>
      </div>

      <div className="flex flex-col px-[25px] gap-[25px]" style={{ padding: "25px 25px", flex: 1, minHeight: 0 }}>
        {/* École pill */}
        <div className="mx-3 my-2 bg-white/[0.06] border border-white/10 rounded-[10px]" style={{ padding: "20px 23px", flexShrink: 0 }}>
          <div className="flex items-center gap-[8px]">
            {logoUrl
              ? <img src={logoUrl} alt={displayName} className="w-10 h-10 rounded-[10px] flex-shrink-0" style={{ objectFit: 'cover' }} />
              : <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-[var(--green)] to-[var(--blue)] flex items-center justify-center text-[15px] font-black text-white flex-shrink-0">{initials}</div>
            }
            <div className="min-w-0">
              <div className="text-[16px] font-bold text-white truncate">{displayName}</div>
              <div className="text-[13px] text-white/35">{tcommon('brand.roleAdmin')}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="overflow-y-auto px-[10px] py-1 scrollbar-hide" style={{ flex: 1, minHeight: 0 }}>
          {NAV.map((section, si) => (
            <div key={si}>
              {section.label && (
                <div className="text-[14px] font-black text-white/30 tracking-[1.2px] uppercase" style={{padding: "11px 0 0 0"}}>
                  {section.label}
                </div>
              )}
              {section.items.map(item => (
                <button key={item.id} onClick={() => onChange(item.id)}
                  className={cn(
                    'relative w-full flex items-center gap-[20px] rounded-lg mb-[1px]',
                    'text-[16px] font-semibold text-left border-none cursor-pointer font-nunito',
                    current === item.id
                      ? 'text-white'
                      : 'text-white/52 hover:bg-[var(--sidebar2)] hover:text-white/82'
                  )} style={{ padding: '6px 9px' }}>
                  {current === item.id && (
                    <motion.div layoutId="admin-nav-active"
                      className="absolute inset-0 rounded-lg"
                      style={{ background: 'var(--sidebar-active)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                  )}
                  <span className="relative z-10 w-[20px] flex items-center justify-center flex-shrink-0">
                    <item.icon size={20} strokeWidth={2} />
                  </span>
                  <span className="relative z-10 truncate flex-1">{item.label}</span>
                  {item.badge && (
                    <span className={cn('relative z-10 ml-auto text-[13px] font-black rounded-lg', BADGE_STYLES[item.badgeColor ?? 'green'])} style={{ padding: '3px 6px' }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* User */}
      <div className="border-t border-white/[0.07]" style={{ padding: '20px 25px', flexShrink: 0 }}>
        <div className="flex items-center gap-[12px] rounded-[10px] hover:bg-white/[0.06]" style={{ padding: '12px 14px' }}>
          <div className="w-11 h-11 rounded-[11px] bg-gradient-to-br from-[var(--amber)] to-[var(--red)] flex items-center justify-center text-white font-black text-[16px] flex-shrink-0">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-bold text-white truncate">{userDisplayName}</div>
            <div className="text-[14px] text-white/35">{tcommon('user.roleLabel')}</div>
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
