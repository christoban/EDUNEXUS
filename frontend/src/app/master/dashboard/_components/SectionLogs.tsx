'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2, XCircle, Ban, Trash2, Mail, RotateCw, KeyRound, Smartphone,
  AlertTriangle, EyeOff, Eye, ArrowLeft, Download, Search, Shield, Zap, Info, Globe,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Badge from './Badge'
import type { AuditLogDto } from '../_types'
import type { EmailLogDto } from '../_api'
import { fetchLogs, fetchEmailLogs, mfaSetup, mfaEnable, mfaDisable, mfaRegenCodes } from '../_api'

interface Props {
  logs: AuditLogDto[]
  loading: boolean
  onChangePwd: () => void
  mfaEnabled: boolean
}

type LogTab = 'auth' | 'actions' | 'emails' | 'security'

// ── Labels & badges pour les événements auth ────────────────────────────────

const AUTH_LABELS: Record<string, string> = {
  'success:login_otp_sent':                       'Code OTP envoyé',
  'success:otp_verified':                         'Email vérifié',
  'success:mfa_verified':                         'MFA validé',
  'success:mfa_login_totp':                       'Connexion MFA (TOTP)',
  'success:mfa_login_recovery_code':              'Connexion MFA (code récup.)',
  'success:recovery_codes_regenerated':           'Codes de récupération regénérés',
  'success:password_changed_from_security_dashboard': 'Mot de passe modifié',
  'success:logout':                               'Déconnexion',
  'success:otp_resend':                           'Code OTP renvoyé',
  'success:sensitive_auth_passed_no_mfa':         'Vérif. identité réussie (sans MFA)',
  'success:sensitive_auth_passed_totp':           'Vérif. identité réussie (TOTP)',
  'success:sensitive_auth_passed_recovery_code':  'Vérif. identité réussie (code récup.)',
  'failure:login_failed':                         'Échec de connexion',
  'failure:login_invalid_password':               'Mot de passe invalide',
  'failure:otp_verification_failed':              'Échec vérification OTP',
  'failure:mfa_verification_failed':              'Échec vérification MFA',
  'failure:sensitive_auth_invalid_password':      'Vérif. identité échouée — mot de passe',
  'failure:sensitive_auth_invalid_mfa_code':      'Vérif. identité échouée — code MFA',
  'failure:sensitive_auth_missing_factors':       'Vérif. identité — champ manquant',
}

const AUTH_BADGE: Record<string, 'event-success' | 'event-warning' | 'event-error' | 'event-info'> = {
  'success:login_otp_sent':                   'event-info',
  'success:otp_verified':                     'event-success',
  'success:mfa_verified':                     'event-success',
  'success:mfa_login_totp':                   'event-success',
  'success:mfa_login_recovery_code':          'event-warning',
  'success:recovery_codes_regenerated':       'event-success',
  'success:password_changed_from_security_dashboard': 'event-success',
  'success:logout':                           'event-info',
  'success:otp_resend':                       'event-info',
  'success:sensitive_auth_passed_no_mfa':     'event-success',
  'success:sensitive_auth_passed_totp':       'event-success',
  'success:sensitive_auth_passed_recovery_code': 'event-warning',
  'failure:login_failed':                     'event-error',
  'failure:login_invalid_password':           'event-error',
  'failure:otp_verification_failed':          'event-error',
  'failure:mfa_verification_failed':          'event-error',
  'failure:sensitive_auth_invalid_password':  'event-error',
  'failure:sensitive_auth_invalid_mfa_code':  'event-error',
  'failure:sensitive_auth_missing_factors':   'event-error',
}

// ── Labels & badges pour les actions métier ─────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'action:school_approved':      'École approuvée',
  'action:school_rejected':      'École rejetée',
  'action:school_suspended':     'École suspendue',
  'action:school_reactivated':   'École réactivée',
  'action:school_deleted':       'École supprimée',
  'action:school_invite_sent':   'Invitation envoyée',
  'action:school_invite_resent': 'Invitation renvoyée',
  'action:school_reexamined':    'Demande réexaminée',
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  'action:school_approved':      CheckCircle2,
  'action:school_rejected':      XCircle,
  'action:school_suspended':     Ban,
  'action:school_reactivated':   CheckCircle2,
  'action:school_deleted':       Trash2,
  'action:school_invite_sent':   Mail,
  'action:school_invite_resent': Mail,
  'action:school_reexamined':    RotateCw,
}

const ACTION_BADGE: Record<string, 'event-success' | 'event-warning' | 'event-error' | 'event-info'> = {
  'action:school_approved':      'event-success',
  'action:school_rejected':      'event-error',
  'action:school_suspended':     'event-warning',
  'action:school_reactivated':   'event-success',
  'action:school_deleted':       'event-error',
  'action:school_invite_sent':   'event-info',
  'action:school_invite_resent': 'event-info',
  'action:school_reexamined':    'event-info',
}

const tdStyle: React.CSSProperties = {
  padding: '13px 16px', fontSize: 15, color: '#6b5c45', verticalAlign: 'middle',
}

// ── Composant SecurityTab (MFA + mot de passe) ───────────────────────────────

type MfaFlow = 'enable-qr' | 'enable-verify' | 'enable-codes' | 'disable' | 'regen' | 'regen-codes' | null

function downloadRecoveryCodes(codes: string[]): void {
  const content = [
    'CODES DE RÉCUPÉRATION — ZEKOULABIA MASTER ADMIN',
    '='.repeat(48),
    `Générés le : ${new Date().toLocaleString('fr-CM')}`,
    '',
    'IMPORTANT : Chaque code est à usage unique.',
    'Conservez ce fichier dans un endroit sûr et confidentiel.',
    "Supprimez ce fichier après l'avoir imprimé ou stocké dans un gestionnaire de mots de passe.",
    '',
    ...codes.map((code, i) => `  ${String(i + 1).padStart(2, '0')}.  ${code}`),
    '',
    "Ces codes vous permettent de vous connecter si vous n'avez plus accès",
    "à votre application d'authentification (Google Authenticator, Authy…).",
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zekoulabia-recovery-codes-${new Date().toISOString().slice(0, 10)}.txt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function SecurityTab({ mfaEnabled, onChangePwd, onMfaChange }: {
  mfaEnabled: boolean
  onChangePwd: () => void
  onMfaChange: () => void
}) {
  const [flow, setFlow] = useState<MfaFlow>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Enable MFA state
  const [qrDataUri, setQrDataUri] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [password, setPassword] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])

  // Disable / regen state
  const [disablePwd, setDisablePwd] = useState('')
  const [disableMfa, setDisableMfa] = useState('')

  // Show/hide password toggles
  const [showEnablePwd, setShowEnablePwd] = useState(false)
  const [showDisablePwd, setShowDisablePwd] = useState(false)

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8',
    borderRadius: 10, color: '#1a1209', fontSize: 15, fontFamily: 'inherit', fontWeight: 600,
    outline: 'none', boxSizing: 'border-box',
  }
  const btnGreen: React.CSSProperties = {
    padding: '11px 22px', background: 'linear-gradient(135deg,#059669,#047857)', color: 'white',
    border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 800, cursor: 'pointer',
    fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(5,150,105,0.2)',
  }
  const btnGray: React.CSSProperties = {
    padding: '10px 20px', background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8',
    borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  }
  const btnRed: React.CSSProperties = {
    padding: '10px 20px', background: '#fef2f2', color: '#dc2626',
    border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 10, fontSize: 15, fontWeight: 800,
    cursor: 'pointer', fontFamily: 'inherit',
  }

  const reset = () => {
    setFlow(null); setError(''); setLoading(false)
    setQrDataUri(''); setManualKey(''); setTotpCode(''); setPassword('')
    setDisablePwd(''); setDisableMfa(''); setRecoveryCodes([])
  }

  async function startEnableMfa() {
    setLoading(true); setError('')
    try {
      const data = await mfaSetup()
      setQrDataUri(data.qrDataUri)
      setManualKey(data.manualKey)
      setFlow('enable-qr')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleEnableVerify() {
    if (!totpCode.trim() || totpCode.trim().length !== 6) { setError('Entrez le code à 6 chiffres de votre application.'); return }
    if (!password.trim()) { setError('Le mot de passe est requis.'); return }
    setLoading(true); setError('')
    try {
      const data = await mfaEnable(totpCode.trim(), password.trim())
      setRecoveryCodes(data.recoveryCodes)
      setFlow('enable-codes')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleDisable() {
    if (!disablePwd.trim()) { setError('Mot de passe requis.'); return }
    if (!disableMfa.trim()) { setError('Code MFA requis.'); return }
    setLoading(true); setError('')
    try {
      await mfaDisable(disablePwd.trim(), disableMfa.trim())
      reset()
      onMfaChange()
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleRegenCodes() {
    if (!disablePwd.trim()) { setError('Mot de passe requis.'); return }
    if (!disableMfa.trim()) { setError('Code MFA requis.'); return }
    setLoading(true); setError('')
    try {
      const data = await mfaRegenCodes(disablePwd.trim(), disableMfa.trim())
      setRecoveryCodes(data.recoveryCodes)
      setFlow('regen-codes')
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#6b5c45', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: '0.4px' }

  return (
    <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Mot de passe ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 10 }}>
          <KeyRound size={20} />
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1209' }}>Mot de passe</span>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <p style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.7, marginBottom: 16, marginTop: 0 }}>
            Modifiez votre mot de passe master. Vous devrez saisir votre mot de passe actuel{mfaEnabled ? ' et votre code MFA' : ''}.
          </p>
          <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={onChangePwd}><KeyRound size={16} /> Changer le mot de passe</button>
        </div>
      </div>

      {/* ── MFA ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Smartphone size={20} />
            <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1209' }}>Authentification à deux facteurs (MFA)</span>
          </div>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: mfaEnabled ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.08)', color: mfaEnabled ? '#059669' : '#dc2626', border: `1px solid ${mfaEnabled ? 'rgba(5,150,105,0.25)' : 'rgba(220,38,38,0.2)'}`, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {mfaEnabled ? <><CheckCircle2 size={13} /> Actif</> : <><XCircle size={13} /> Inactif</>}
          </span>
        </div>

        <div style={{ padding: '20px 24px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 9, fontSize: 14, fontWeight: 700, color: '#991b1b', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={15} style={{ flexShrink: 0 }} /> {error}</div>
          )}

          {/* ── Pas de flow actif ── */}
          {!flow && (
            <>
              <p style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.7, marginBottom: 16, marginTop: 0 }}>
                {mfaEnabled
                  ? 'Le MFA est actif. Toutes les actions sensibles nécessitent votre code TOTP (Google Authenticator, Authy…).'
                  : 'Le MFA n\'est pas activé. Activez-le pour renforcer la sécurité de ce compte d\'administration critique.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {!mfaEnabled && (
                  <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={startEnableMfa}>
                    {loading ? '…' : <><Smartphone size={16} /> Activer le MFA</>}
                  </button>
                )}
                {mfaEnabled && (
                  <>
                    <button style={{ ...btnGray, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { setError(''); setFlow('regen') }}><RotateCw size={16} /> Régénérer les codes de récupération</button>
                    <button style={{ ...btnRed, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { setError(''); setFlow('disable') }}><AlertTriangle size={16} /> Désactiver le MFA</button>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── ENABLE : QR code ── */}
          {flow === 'enable-qr' && (
            <div>
              <p style={{ fontSize: 15, color: '#6b5c45', marginBottom: 16, marginTop: 0, lineHeight: 1.7 }}>
                <strong>Étape 1 / 2</strong> — Scannez ce QR code avec votre application d&apos;authentification (Google Authenticator, Authy, etc.) ou entrez la clé manuellement.
              </p>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                {qrDataUri && <img src={qrDataUri} alt="QR Code MFA" style={{ width: 180, height: 180, borderRadius: 12, border: '2px solid #e8e0d4' }} />}
              </div>
              <div style={{ background: '#f0ebe3', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', marginBottom: 6 }}>Clé manuelle</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1209', wordBreak: 'break-all', fontFamily: 'monospace', letterSpacing: 2 }}>{manualKey}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={btnGray} onClick={reset}>Annuler</button>
                <button style={btnGreen} onClick={() => { setError(''); setFlow('enable-verify') }}>J&apos;ai scanné → Continuer</button>
              </div>
            </div>
          )}

          {/* ── ENABLE : Vérification ── */}
          {flow === 'enable-verify' && (
            <div>
              <p style={{ fontSize: 15, color: '#6b5c45', marginBottom: 16, marginTop: 0, lineHeight: 1.7 }}>
                <strong>Étape 2 / 2</strong> — Entrez le code à 6 chiffres affiché dans votre application et confirmez avec votre mot de passe.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>Code TOTP (6 chiffres) *</label>
                <input style={{ ...inp, textAlign: 'center', fontSize: 22, fontWeight: 900, letterSpacing: 8 }}
                  type="tel" maxLength={6} value={totpCode} placeholder="123456"
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabel}>Votre mot de passe actuel *</label>
                <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 40 }} type={showEnablePwd ? 'text' : 'password'} placeholder="••••••••••••" value={password}
                    autoComplete="new-password" onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowEnablePwd(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    {showEnablePwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ ...btnGray, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { setError(''); setFlow('enable-qr') }}><ArrowLeft size={15} /> Retour</button>
                <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={handleEnableVerify}>
                  {loading ? '…' : <><CheckCircle2 size={16} /> Activer le MFA</>}
                </button>
              </div>
            </div>
          )}

          {/* ── ENABLE : Codes de récupération (affichage unique) ── */}
          {flow === 'enable-codes' && (
            <div>
              <div style={{ padding: '14px 16px', background: '#fef3c7', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, marginBottom: 16 }}>
                <strong style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={16} /> Sauvegardez ces codes maintenant !</strong>
                <p style={{ color: '#92400e', fontSize: 14, marginTop: 6, marginBottom: 0, lineHeight: 1.6 }}>
                  Ces codes de récupération ne seront affichés <strong>qu&apos;une seule fois</strong>. Conservez-les dans un endroit sûr. Chaque code est à usage unique.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                {recoveryCodes.map((code, i) => (
                  <div key={i} style={{ background: '#f0ebe3', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#1a1209', textAlign: 'center', letterSpacing: 1 }}>
                    {code}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={{ ...btnGray, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => downloadRecoveryCodes(recoveryCodes)}>
                  <Download size={16} /> Télécharger (.txt)
                </button>
                <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { reset(); onMfaChange() }}><CheckCircle2 size={16} /> J&apos;ai sauvegardé mes codes → Terminer</button>
              </div>
            </div>
          )}

          {/* ── DISABLE MFA ── */}
          {flow === 'disable' && (
            <div>
              <div style={{ padding: '12px 14px', background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, marginBottom: 16, fontSize: 14, color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} /> La désactivation du MFA affaiblit la sécurité de ce compte. Soyez certain de votre choix.
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>Mot de passe actuel *</label>
                <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 40 }} type={showDisablePwd ? 'text' : 'password'} placeholder="••••••••••••" value={disablePwd}
                    autoComplete="new-password" onChange={e => setDisablePwd(e.target.value)} />
                  <button type="button" onClick={() => setShowDisablePwd(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    {showDisablePwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabel}>Code MFA actuel *</label>
                <input style={{ ...inp, textAlign: 'center', fontSize: 20, fontWeight: 900, letterSpacing: 6 }}
                  type="tel" maxLength={6} placeholder="123456" value={disableMfa} autoComplete="one-time-code"
                  onChange={e => setDisableMfa(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={btnGray} onClick={reset}>Annuler</button>
                <button style={{ ...btnRed, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={handleDisable}>
                  {loading ? '…' : <><AlertTriangle size={16} /> Confirmer la désactivation</>}
                </button>
              </div>
            </div>
          )}

          {/* ── REGEN codes : saisie ── */}
          {flow === 'regen' && (
            <div>
              <p style={{ fontSize: 15, color: '#6b5c45', marginBottom: 16, marginTop: 0, lineHeight: 1.7 }}>
                La régénération invalide tous les codes de récupération existants. Confirmez votre identité.
              </p>
              <div style={{ marginBottom: 14 }}>
                <label style={fieldLabel}>Mot de passe actuel *</label>
                <input type="text" autoComplete="username" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <input type="password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} />
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inp, paddingRight: 40 }} type={showDisablePwd ? 'text' : 'password'} placeholder="••••••••••••" value={disablePwd}
                    autoComplete="new-password" onChange={e => setDisablePwd(e.target.value)} />
                  <button type="button" onClick={() => setShowDisablePwd(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 4, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                    {showDisablePwd ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={fieldLabel}>Code MFA actuel *</label>
                <input style={{ ...inp, textAlign: 'center', fontSize: 20, fontWeight: 900, letterSpacing: 6 }}
                  type="tel" maxLength={6} placeholder="123456" value={disableMfa} autoComplete="one-time-code"
                  onChange={e => setDisableMfa(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={btnGray} onClick={reset}>Annuler</button>
                <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} disabled={loading} onClick={handleRegenCodes}>
                  {loading ? '…' : <><RotateCw size={16} /> Régénérer les codes</>}
                </button>
              </div>
            </div>
          )}

          {/* ── REGEN codes : résultat ── */}
          {flow === 'regen-codes' && (
            <div>
              <div style={{ padding: '14px 16px', background: '#fef3c7', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, marginBottom: 16 }}>
                <strong style={{ color: '#92400e', display: 'flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={16} /> Nouveaux codes — sauvegardez-les maintenant !</strong>
                <p style={{ color: '#92400e', fontSize: 14, marginTop: 6, marginBottom: 0 }}>Les anciens codes sont désormais invalides.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
                {recoveryCodes.map((code, i) => (
                  <div key={i} style={{ background: '#f0ebe3', borderRadius: 8, padding: '10px 14px', fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#1a1209', textAlign: 'center', letterSpacing: 1 }}>
                    {code}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button style={{ ...btnGray, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => downloadRecoveryCodes(recoveryCodes)}>
                  <Download size={16} /> Télécharger (.txt)
                </button>
                <button style={{ ...btnGreen, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={reset}><CheckCircle2 size={16} /> J&apos;ai sauvegardé → Fermer</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Activité récente ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Globe size={20} />
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1209' }}>Activité récente</span>
        </div>
        <div style={{ padding: '16px 22px' }}>
          <p style={{ fontSize: 15, color: '#a89478', margin: 0 }}>
            Consultez l&apos;onglet <strong style={{ color: '#1a1209' }}>Authentification</strong> pour voir toutes les connexions et événements de sécurité en temps réel.
          </p>
        </div>
      </div>

    </div>
  )
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} style={{ padding: '40px 16px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>
        {msg}
      </td>
    </tr>
  )
}

export default function SectionLogs({ logs: initialLogs, loading: initialLoading, onChangePwd, mfaEnabled }: Props) {
  const [tab, setTab] = useState<LogTab>('auth')

  // Logs actions
  const [actionLogs, setActionLogs] = useState<AuditLogDto[]>([])
  const [actionLoading, setActionLoading] = useState(false)

  // Email logs
  const [emailLogs, setEmailLogs] = useState<EmailLogDto[]>([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailSearch, setEmailSearch] = useState('')

  const loadActionLogs = useCallback(async () => {
    setActionLoading(true)
    try {
      const res = await fetchLogs({ type: 'actions', limit: 100 })
      setActionLogs(res.data)
    } catch { /* silencieux */ }
    finally { setActionLoading(false) }
  }, [])

  const loadEmailLogs = useCallback(async (search?: string) => {
    setEmailLoading(true)
    try {
      const res = await fetchEmailLogs({ search: search?.trim() || undefined, limit: 100 })
      setEmailLogs(res.data)
    } catch { /* silencieux */ }
    finally { setEmailLoading(false) }
  }, [])

  useEffect(() => {
    if (tab === 'actions' && actionLogs.length === 0) loadActionLogs()
    if (tab === 'emails' && emailLogs.length === 0) loadEmailLogs()
  }, [tab, actionLogs.length, emailLogs.length, loadActionLogs, loadEmailLogs])

  // Auth logs viennent du parent (déjà chargés)
  const authLogs = initialLogs.filter(l => !l.action.startsWith('action:'))

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#f0ebe3', padding: 4, borderRadius: 10, marginBottom: 20, width: 'fit-content' }}>
        {([
          { id: 'auth'     as const, label: 'Authentification', icon: KeyRound },
          { id: 'actions'  as const, label: 'Actions admin', icon: Zap },
          { id: 'emails'   as const, label: 'Logs emails', icon: Mail },
          { id: 'security' as const, label: 'Sécurité du compte', icon: Shield },
        ] as { id: LogTab; label: string; icon: LucideIcon }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '9px 20px', borderRadius: 8, fontSize: 17, fontWeight: 700,
            background: tab === t.id ? 'white' : 'transparent',
            color: tab === t.id ? '#1a1209' : '#a89478',
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}><t.icon size={16} />{t.label}</button>
        ))}
      </div>

      {/* ── ONGLET AUTHENTIFICATION ─────────────────────────────────────────── */}
      {tab === 'auth' && (
        <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', fontSize: 14, color: '#a89478', fontWeight: 600 }}>
            Connexions, OTP, MFA — toutes les tentatives d&apos;authentification du compte master
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date / Heure', 'Événement', 'Compte', 'IP'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {initialLoading
                ? <EmptyRow cols={4} msg="Chargement..." />
                : authLogs.length === 0
                  ? <EmptyRow cols={4} msg="Aucun log d'authentification" />
                  : authLogs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: i < authLogs.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                      <td style={tdStyle}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                      <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                        <Badge type={AUTH_BADGE[log.action] ?? 'event-info'}>
                          {AUTH_LABELS[log.action] ?? log.action}
                        </Badge>
                      </td>
                      <td style={tdStyle}>{log.masterUser?.email ?? log.description ?? '—'}</td>
                      <td style={tdStyle}>{log.ipAddress ?? '—'}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ── ONGLET ACTIONS ADMIN ────────────────────────────────────────────── */}
      {tab === 'actions' && (
        <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', fontSize: 14, color: '#a89478', fontWeight: 600 }}>
            Approbations, rejets, suspensions, invitations — toutes les actions décisives sur les écoles
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Date / Heure', 'Action', 'Détail', 'IP'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actionLoading
                ? <EmptyRow cols={4} msg="Chargement..." />
                : actionLogs.length === 0
                  ? <EmptyRow cols={4} msg="Aucune action enregistrée" />
                  : actionLogs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: i < actionLogs.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                      <td style={tdStyle}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                      <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                        <Badge type={ACTION_BADGE[log.action] ?? 'event-info'}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            {ACTION_ICONS[log.action] && (() => { const Icon = ACTION_ICONS[log.action]; return <Icon size={13} /> })()}
                            {ACTION_LABELS[log.action] ?? log.action.replace('action:', '')}
                          </span>
                        </Badge>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 320, wordBreak: 'break-word' }}>{log.description ?? '—'}</td>
                      <td style={tdStyle}>{log.ipAddress ?? '—'}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ── ONGLET LOGS EMAILS ──────────────────────────────────────────────── */}
      {tab === 'emails' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Barre de recherche */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 9, padding: '8px 14px', flex: 1 }}>
              <Search size={16} color="#a89478" />
              <input
                type="text"
                value={emailSearch}
                onChange={e => setEmailSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadEmailLogs(emailSearch)}
                placeholder="Rechercher par email ou sujet..."
                style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, color: '#1a1209', fontFamily: 'inherit', fontWeight: 600, width: '100%' }}
              />
            </div>
            <button onClick={() => loadEmailLogs(emailSearch)}
              style={{ padding: '10px 18px', background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Rechercher
            </button>
          </div>

          <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', fontSize: 14, color: '#a89478', fontWeight: 600 }}>
              Emails envoyés à travers toutes les écoles (OTP, bulletins, paiements, etc.)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Destinataire', 'Sujet', 'École', 'Statut', 'Provider'].map(h => (
                    <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emailLoading
                  ? <EmptyRow cols={6} msg="Chargement..." />
                  : emailLogs.length === 0
                    ? <EmptyRow cols={6} msg="Aucun email enregistré. Les emails des écoles actives apparaissent ici." />
                    : emailLogs.map((log, i) => (
                      <tr key={log.id} style={{ borderBottom: i < emailLogs.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString('fr-CM')}</td>
                        <td style={tdStyle}>{log.to}</td>
                        <td style={{ ...tdStyle, maxWidth: 240, wordBreak: 'break-word' }}>{log.subject}</td>
                        <td style={tdStyle}>{log.school?.name ?? '—'}</td>
                        <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                          <Badge type={log.status === 'sent' ? 'event-success' : 'event-error'}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              {log.status === 'sent' ? <><CheckCircle2 size={13} /> Envoyé</> : <><XCircle size={13} /> Échoué</>}
                            </span>
                          </Badge>
                        </td>
                        <td style={{ ...tdStyle, color: '#a89478', fontSize: 13 }}>{log.provider ?? '—'}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Note : master admin emails (invitations, approbations) loggés dans Actions admin */}
          <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10, fontSize: 14, color: '#1e40af', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Info size={16} style={{ flexShrink: 0 }} /> Les emails d&apos;invitation et d&apos;approbation envoyés par le master admin sont tracés dans l&apos;onglet <strong>Actions admin</strong>.
          </div>
        </div>
      )}
      {/* ── ONGLET SÉCURITÉ DU COMPTE ───────────────────────────────────────── */}
      {tab === 'security' && (
        <SecurityTab
          mfaEnabled={mfaEnabled}
          onChangePwd={onChangePwd}
          onMfaChange={() => {
            // Rafraîchit le statut MFA dans le parent via re-fetch
            window.location.reload()
          }}
        />
      )}

    </div>
  )
}
