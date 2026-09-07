'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PasswordStrengthBar, { getPasswordStrength } from '@/components/PasswordStrengthBar'

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: React.SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (getPasswordStrength(newPassword) < 5) {
      setError('Le nouveau mot de passe ne respecte pas les règles de sécurité.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/v2/users/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message ?? 'Impossible de modifier le mot de passe.')
        return
      }
      const stored = localStorage.getItem('zekoulabia_user')
      const user = stored ? JSON.parse(stored) as { role?: string } : {}
      const destinations: Record<string, string> = {
        ADMIN: '/admin/dashboard',
        STAFF: '/staff/dashboard',
        TEACHER: '/teacher/dashboard',
        PARENT: '/parent/dashboard',
        STUDENT: '/student/dashboard',
      }
      router.replace(destinations[user.role ?? ''] ?? '/')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 24 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', padding: 32, borderRadius: 16, boxShadow: '0 16px 50px rgba(0,0,0,0.12)' }}>
        <h1 style={{ marginTop: 0, color: 'var(--text)' }}>Choisissez votre nouveau mot de passe</h1>
        <p style={{ color: 'var(--text2)', lineHeight: 1.5 }}>Votre mot de passe temporaire doit être remplacé avant de continuer.</p>
        <label style={labelStyle}>Mot de passe temporaire<input required type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} style={inputStyle} autoComplete="current-password" /></label>
        <label style={labelStyle}>Nouveau mot de passe<input required type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} style={inputStyle} autoComplete="new-password" /></label>
        {newPassword && <PasswordStrengthBar password={newPassword} />}
        <label style={labelStyle}>Confirmer le nouveau mot de passe<input required type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} style={inputStyle} autoComplete="new-password" /></label>
        {error && <p style={{ color: 'var(--red)', fontWeight: 700 }}>{error}</p>}
        <button disabled={loading} type="submit" style={buttonStyle}>{loading ? 'Modification...' : 'Modifier le mot de passe'}</button>
      </form>
    </main>
  )
}

const labelStyle: React.CSSProperties = { display: 'grid', gap: 6, marginTop: 18, color: 'var(--text2)', fontWeight: 700 }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '12px 14px', border: '1px solid var(--border2)', borderRadius: 10, background: 'var(--bg2)', color: 'var(--text)', fontSize: 16 }
const buttonStyle: React.CSSProperties = { width: '100%', marginTop: 24, padding: '13px 16px', border: 0, borderRadius: 10, background: 'var(--green)', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer' }