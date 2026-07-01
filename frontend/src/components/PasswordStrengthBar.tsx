'use client'

export interface PasswordRule {
  label: string
  ok: boolean
}

export function getPasswordRules(password: string): PasswordRule[] {
  return [
    { label: '12 caractères minimum',        ok: password.length >= 12 },
    { label: 'Une lettre majuscule (A-Z)',    ok: /[A-Z]/.test(password) },
    { label: 'Une lettre minuscule (a-z)',    ok: /[a-z]/.test(password) },
    { label: 'Un chiffre (0-9)',             ok: /[0-9]/.test(password) },
    { label: 'Un caractère spécial (@$!%*?&#^()_+=.-)', ok: /[@$!%*?&#^()_+=.\-]/.test(password) },
  ]
}

export function getPasswordStrength(password: string): 0 | 1 | 2 | 3 | 4 | 5 {
  if (!password) return 0
  const rules = getPasswordRules(password)
  return rules.filter(r => r.ok).length as 0 | 1 | 2 | 3 | 4 | 5
}

const STRENGTH_LABELS = ['', 'Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort']
const STRENGTH_COLORS = ['', '#dc2626', '#f97316', '#eab308', '#22c55e', '#059669']

interface Props {
  password: string
  style?: React.CSSProperties
}

export default function PasswordStrengthBar({ password, style }: Props) {
  if (!password) return null

  const score  = getPasswordStrength(password)
  const rules  = getPasswordRules(password)
  const color  = STRENGTH_COLORS[score]!
  const label  = STRENGTH_LABELS[score]!

  return (
    <div style={{ marginTop: 10, ...style }}>
      {/* Barre */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{
            flex: 1, height: 5, borderRadius: 4,
            background: i <= score ? color : '#e5e7eb',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>

      {/* Label force */}
      {label && (
        <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8 }}>
          {label}
        </div>
      )}

      {/* Règles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {rules.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ color: r.ok ? '#059669' : '#9ca3af', fontSize: 13 }}>{r.ok ? '✓' : '○'}</span>
            <span style={{ color: r.ok ? '#374151' : '#9ca3af', fontWeight: r.ok ? 600 : 400 }}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
