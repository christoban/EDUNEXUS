'use client'
import { useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import PasswordStrengthBar, { getPasswordStrength } from './PasswordStrengthBar'

interface Props {
  onClose: () => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function ChangePasswordModal({ onClose, onToast }: Props) {
  const [currentPwd,  setCurrentPwd]  = useState('')
  const [newPwd,      setNewPwd]      = useState('')
  const [confirmPwd,  setConfirmPwd]  = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew,     setShowNew]     = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)

  const strength = getPasswordStrength(newPwd)
  const mismatch = confirmPwd.length > 0 && confirmPwd !== newPwd

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!currentPwd || !newPwd || !confirmPwd) { setError('Tous les champs sont requis.'); return }
    if (newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas.'); return }
    if (strength < 5) { setError('Le mot de passe ne respecte pas toutes les règles de sécurité.'); return }

    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/users/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd, confirmPassword: confirmPwd }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || 'Erreur lors du changement.'); return }
      setSuccess(true)
      onToast?.('Mot de passe modifié avec succès', 'success')
      setTimeout(() => onClose(), 1800)
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={() => !loading && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>

        <div style={{ fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>
          🔐 Changer de mot de passe
        </div>
        <div style={{ fontSize: 14, color: '#a89478', marginBottom: 24, lineHeight: 1.5 }}>
          Votre nouveau mot de passe doit respecter toutes les règles de sécurité.
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#059669' }}>Mot de passe modifié !</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Mot de passe actuel */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelSt}>Mot de passe actuel *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ ...inputSt, paddingRight: 44 }}
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowCurrent(s => !s)} style={eyeSt}>
                  {showCurrent ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Nouveau mot de passe */}
            <div style={{ marginBottom: 6 }}>
              <label style={labelSt}>Nouveau mot de passe *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ ...inputSt, paddingRight: 44 }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNew(s => !s)} style={eyeSt}>
                  {showNew ? '🙈' : '👁'}
                </button>
              </div>
              {newPwd && <PasswordStrengthBar password={newPwd} />}
            </div>

            {/* Confirmation */}
            <div style={{ marginBottom: 20, marginTop: 14 }}>
              <label style={labelSt}>Confirmer le nouveau mot de passe *</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ ...inputSt, paddingRight: 44, borderColor: mismatch ? '#dc2626' : '#d4c8b8' }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)} style={eyeSt}>
                  {showConfirm ? '🙈' : '👁'}
                </button>
              </div>
              {mismatch && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontWeight: 600 }}>
                  ⚠️ Les mots de passe ne correspondent pas.
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading || strength < 5 || mismatch}
                style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: (loading || strength < 5 || mismatch) ? '#9ca3af' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: (loading || strength < 5 || mismatch) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>
                {loading ? '⏳ Modification…' : '🔐 Changer le mot de passe'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 800, color: '#6b5c45', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }
const inputSt: React.CSSProperties = { width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 10, color: '#1a1209', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const eyeSt: React.CSSProperties = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 17, color: '#a89478', padding: 0 }
