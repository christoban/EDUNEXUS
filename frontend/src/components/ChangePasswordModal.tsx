'use client'
import { useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import PasswordStrengthBar, { getPasswordStrength } from './PasswordStrengthBar'
import { useT } from '@/lib/i18n'
import { CheckCircle2, EyeOff, Eye, AlertTriangle } from 'lucide-react'

interface Props {
  onClose: () => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function ChangePasswordModal({ onClose, onToast }: Props) {
  const t = useT('common')
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
    if (!currentPwd || !newPwd || !confirmPwd) { setError(t('password.errorRequired')); return }
    if (newPwd !== confirmPwd) { setError(t('password.errorMismatch')); return }
    if (strength < 5) { setError(t('password.errorStrength')); return }

    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/users/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd, confirmPassword: confirmPwd }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || t('password.errorChange')); return }
      setSuccess(true)
      onToast?.(t('password.successMsg'), 'success')
      setTimeout(() => onClose(), 1800)
    } catch {
      setError(t('password.errorNetwork'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={() => !loading && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 18, padding: '32px 36px', width: 440, maxWidth: '94vw', boxShadow: 'var(--shadow-lg)' }}>

        <div style={{ fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          {t('password.changeTitle')}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 24, lineHeight: 1.5 }}>
          {t('password.subtitle')}
        </div>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green)', marginBottom: 12 }}><CheckCircle2 size={48} strokeWidth={2} /></div>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--green)' }}>{t('password.successTitle')}</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelSt}>{t('password.currentLabel')}</label>
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
                  {showCurrent ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 6 }}>
              <label style={labelSt}>{t('password.newLabel')}</label>
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
                  {showNew ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                </button>
              </div>
              {newPwd && <PasswordStrengthBar password={newPwd} />}
            </div>

            <div style={{ marginBottom: 20, marginTop: 14 }}>
              <label style={labelSt}>{t('password.confirmLabel')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  placeholder="••••••••••••"
                  style={{ ...inputSt, paddingRight: 44, borderColor: mismatch ? 'var(--red)' : 'var(--border2)' }}
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowConfirm(s => !s)} style={eyeSt}>
                  {showConfirm ? <EyeOff size={17} strokeWidth={2} /> : <Eye size={17} strokeWidth={2} />}
                </button>
              </div>
              {mismatch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>
                  <AlertTriangle size={13} strokeWidth={2} /> {t('password.errorMismatch')}
                </div>
              )}
            </div>

            {error && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '10px 14px', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('password.buttonCancel')}
              </button>
              <button
                type="submit"
                disabled={loading || strength < 5 || mismatch}
                style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: (loading || strength < 5 || mismatch) ? 'var(--text3)' : 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: (loading || strength < 5 || mismatch) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}>
                {loading ? t('password.buttonSubmitting') : t('password.buttonSubmit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const labelSt: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 6, letterSpacing: '0.5px', textTransform: 'uppercase' }
const inputSt: React.CSSProperties = { width: '100%', padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }
const eyeSt: React.CSSProperties = { position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', padding: 0 }
