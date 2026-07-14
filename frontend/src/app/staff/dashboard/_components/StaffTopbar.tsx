'use client'
import { KeyRound } from 'lucide-react'
import type { StaffSection } from '../_types'
import { useT } from '@/lib/i18n'
import ThemeToggle from '@/components/ThemeToggle'
import NotificationBell from '@/components/NotificationBell'

const SECTION_KEY: Record<string, string> = {
  'grille-horaire': 'grilleHoraire',
}

interface Props {
  section: StaffSection
  periodLabel?: string
  onChangePassword?: () => void
}

export default function StaffTopbar({ section, periodLabel, onChangePassword }: Props) {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  return (
    <header style={{
      height: 68, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, flexShrink: 0,
    }}>
      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
        {tnav(`pageTitle.staff_${SECTION_KEY[section] ?? section}`)}
      </div>
      {periodLabel && (
        <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 14px', fontSize: 15, fontWeight: 700, color: 'var(--text3)' }}>
          {periodLabel}
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {onChangePassword && (
          <button onClick={onChangePassword} title={tcommon('auth.changePassword')}
            style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <KeyRound size={18} color="var(--text2)" />
          </button>
        )}
        <ThemeToggle />
        <NotificationBell />
      </div>
    </header>
  )
}
