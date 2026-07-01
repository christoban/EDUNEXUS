'use client'
import { Bell } from 'lucide-react'
import type { StaffSection } from '../_types'
import { SECTION_TITLES } from '../_types'

interface Props {
  section: StaffSection
  periodLabel?: string
  onChangePassword?: () => void
}

export default function StaffTopbar({ section, periodLabel, onChangePassword }: Props) {
  return (
    <header style={{
      height: 68, background: 'white', borderBottom: '1.5px solid #e8e0d4',
      display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, flexShrink: 0,
    }}>
      <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>
        {SECTION_TITLES[section]}
      </div>
      {periodLabel && (
        <span style={{ background: '#f0ebe3', border: '1px solid #e8e0d4', borderRadius: 20, padding: '4px 14px', fontSize: 15, fontWeight: 700, color: '#a89478' }}>
          {periodLabel}
        </span>
      )}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {onChangePassword && (
          <button onClick={onChangePassword} title="Changer le mot de passe"
            style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 18 }}>
            🔐
          </button>
        )}
        <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f0ebe3', border: '1.5px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}>
          <Bell size={18} color="#6b5c45" />
          <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: '#dc2626', borderRadius: '50%', border: '2px solid white' }} />
        </div>
      </div>
    </header>
  )
}
