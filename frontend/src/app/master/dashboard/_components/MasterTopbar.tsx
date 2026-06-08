'use client'
import type { Section, MasterUserDto } from '../_types'

interface Props {
  user: MasterUserDto | null
  currentSection: Section
  mfaEnabled: boolean
  onNav: (s: Section) => void
  onLogout: () => void
  onChangePwd: () => void
}

const NAV: { id: Section; label: string; dotColor: string }[] = [
  { id: 'overview', label: "Vue d'ensemble", dotColor: '#4ade80' },
  { id: 'schools',  label: 'Écoles',          dotColor: '#d97706' },
  { id: 'logs',     label: 'Logs & Sécurité', dotColor: '#94a3b8' },
]

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function MasterTopbar({ user, currentSection, mfaEnabled, onNav, onLogout, onChangePwd }: Props) {
  return (
    <header style={{
      height: 80, background: '#1a2e1e', display: 'flex', alignItems: 'center',
      padding: '0 24px', gap: 16, flexShrink: 0, position: 'relative', zIndex: 50
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 4.5,
        background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px)'
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 9,
          background: 'linear-gradient(135deg,#f59e0b,#22c55e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
        }}>🎓</div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 25, fontWeight: 700, color: 'white' }}>
          EduNexus
        </div>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)',
        fontSize: 14, fontWeight: 700, padding: '2px 8px',
        borderRadius: 13, border: '1px solid rgba(255,255,255,0.15)'
      }}>HUB DE CONTRÔLE</div>

      <nav style={{ display: 'flex', gap: 16, margin: '0 24px' }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)}
            style={{
              padding: '6px 16px', borderRadius: 8,
              background: currentSection === n.id ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: currentSection === n.id ? 'white' : 'rgba(255,255,255,0.5)',
              fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              transition: 'all 0.15s'
            }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.dotColor }} />
            {n.label}
          </button>
        ))}
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {mfaEnabled !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: mfaEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
            border: mfaEnabled ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(239,68,68,0.25)',
            borderRadius: 20, padding: '4px 20px', fontSize: 16, fontWeight: 700,
            color: mfaEnabled ? '#4ade80' : '#f87171'
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: mfaEnabled ? '#4ade80' : '#f87171', boxShadow: mfaEnabled ? '0 0 6px #4ade80' : '0 0 6px #f87171' }} />
            {mfaEnabled ? 'MFA actif' : 'MFA inactif'}
          </div>
        )}

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 19, fontWeight: 700, color: 'white' }}>{user?.name ?? '...'}</div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{user?.role ?? '...'}</div>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: 11,
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 800, fontSize: 16
        }}>{user ? initials(user.name) : '?'}</div>

        <button onClick={onChangePwd} style={{
          padding: '8px 14px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', gap: 6
        }}>🔑 Mot de passe</button>

        <button id="edu-logout-btn" onClick={onLogout} style={{
          padding: '8px 17px', borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)', background: 'transparent',
          color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s'
        }}>↗ Déconnexion</button>
      </div>
    </header>
  )
}
