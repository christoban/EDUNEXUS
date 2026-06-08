'use client'
import { useState } from 'react'
import Badge from './Badge'
import type { AuditLogDto } from '../_types'

interface Props {
  logs: AuditLogDto[]
  loading: boolean
}

type LogTab = 'emails' | 'auth' | 'security'

const ACTION_LABELS: Record<string, string> = {
  login_otp_sent: 'Connexion — Code OTP envoyé',
  otp_verified: 'Email vérifié',
  mfa_verified: 'MFA validé',
  mfa_login_totp: 'Connexion MFA (TOTP)',
  login_failed: 'Échec de connexion',
  login_invalid_password: 'Mot de passe invalide',
  otp_verification_failed: 'Échec vérification OTP',
  mfa_verification_failed: 'Échec vérification MFA',
  mfa_login_recovery_code: 'Connexion MFA (code récup.)',
  recovery_codes_regenerated: 'Codes de récupération regénérés',
  password_changed_from_security_dashboard: 'Mot de passe modifié (dashboard)',
  otp_resend: 'Code OTP renvoyé',
  logout: 'Déconnexion',
}

const ACTION_BADGE: Record<string, 'event-success' | 'event-warning' | 'event-error' | 'event-info'> = {
  login_otp_sent: 'event-info',
  otp_verified: 'event-success',
  mfa_verified: 'event-success',
  mfa_login_totp: 'event-success',
  login_failed: 'event-error',
  login_invalid_password: 'event-error',
  otp_verification_failed: 'event-error',
  mfa_verification_failed: 'event-error',
  mfa_login_recovery_code: 'event-warning',
  recovery_codes_regenerated: 'event-success',
  password_changed_from_security_dashboard: 'event-success',
  otp_resend: 'event-info',
  logout: 'event-info',
}

export default function SectionLogs({ logs, loading }: Props) {
  const [tab, setTab] = useState<LogTab>('auth')

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 31, fontWeight: 700, color: '#1a1209' }}>
            Logs &amp; Sécurité
          </div>
          <div style={{ fontSize: 16, color: '#a89478', marginTop: 2 }}>Audit complet des actions et connexions</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, background: '#f0ebe3', padding: 4, borderRadius: 10, marginBottom: 20, width: 'fit-content' }}>
        {[
          { id: 'auth' as const, label: '🔐 Audit sécurité' },
          { id: 'emails' as const, label: '📧 Logs emails' },
          { id: 'security' as const, label: '🛡️ Sécurité du compte' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 17, fontWeight: 700,
            background: tab === t.id ? 'white' : 'transparent',
            color: tab === t.id ? '#1a1209' : '#a89478',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'auth' && (
        <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date / Heure', 'Événement', 'Compte', 'IP'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 15, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: '#a89478' }}>Chargement...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: '#a89478' }}>Aucun log trouvé</td></tr>
              ) : logs.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: i < logs.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                  <td style={tdStyle}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                  <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                    <Badge type={ACTION_BADGE[log.action] ?? 'event-info'}>{ACTION_LABELS[log.action] ?? log.action}</Badge>
                  </td>
                  <td style={tdStyle}>{log.masterUser?.email ?? '-'}</td>
                  <td style={tdStyle}>{log.ipAddress ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'emails' && (
        <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', color: '#a89478', fontSize: 16 }}>
            Les logs emails sont disponibles dans la section Écoles.
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e8e0d4' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1209' }}>🔐 Authentification à deux facteurs</span>
            </div>
            <div style={{ padding: '22px 24px' }}>
              <p style={{ fontSize: 16, color: '#6b5c45', fontWeight: 500, lineHeight: 1.7, marginBottom: 18 }}>
                La gestion du MFA (activer, désactiver, régénérer les codes) sera disponible prochainement.
              </p>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e8e0d4' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1209' }}>🔑 Mot de passe</span>
            </div>
            <div style={{ padding: '22px 24px' }}>
              <p style={{ fontSize: 16, color: '#6b5c45', fontWeight: 500, lineHeight: 1.7, marginBottom: 18 }}>
                Pour des raisons de sécurité, le changement de mot de passe nécessite une vérification par email (code OTP valable 15 minutes).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 16, color: '#6b5c45', verticalAlign: 'middle' }
