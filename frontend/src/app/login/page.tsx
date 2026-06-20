'use client'

import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Loader2, ChevronDown, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'

// ── Configuration d'affichage par rôle (emojis, badges, couleurs, redirections) ──
type SuccessInfo = { emoji: string; badge: string; color: string; bg: string; dest: string; firstName: string }

const ROLE_CONFIG: Record<string, Omit<SuccessInfo, 'firstName'>> = {
  ADMIN:   { emoji: '🏫',   badge: 'Administrateur', color: '#059669', bg: '#d1fae5', dest: '/admin/dashboard' },
  TEACHER: { emoji: '👨‍🏫', badge: 'Enseignant',      color: '#1d4ed8', bg: '#dbeafe', dest: '/teacher/dashboard' },
  PARENT:  { emoji: '👨‍👩‍👧', badge: 'Parent',          color: '#b45309', bg: '#fef3c7', dest: '/parent/dashboard' },
  STUDENT: { emoji: '👨‍🎓', badge: 'Élève',           color: '#7c3aed', bg: '#ede9fe', dest: '/student/dashboard' },
  STAFF:   { emoji: '🔍',   badge: 'Staff',           color: '#0d9488', bg: '#ccfbf1', dest: '/staff/dashboard' },
}

type SchoolOption = {
  id: string
  name: string
  subdomain: string
  city?: string | null
  region?: string | null
  logoUrl?: string | null
}

const ROLE_SELECTOR = [
  { role: 'ADMIN',   emoji: '🏫',   label: 'Administrateur', color: '#059669', bg: '#d1fae5', border: 'rgba(5,150,105,0.3)' },
  { role: 'TEACHER', emoji: '👨‍🏫', label: 'Enseignant',      color: '#1d4ed8', bg: '#dbeafe', border: 'rgba(29,78,216,0.3)'  },
  { role: 'PARENT',  emoji: '👨‍👩‍👧', label: 'Parent',          color: '#b45309', bg: '#fef3c7', border: 'rgba(180,83,9,0.3)'   },
  { role: 'STUDENT', emoji: '👨‍🎓', label: 'Élève',           color: '#7c3aed', bg: '#ede9fe', border: 'rgba(124,58,237,0.3)' },
  { role: 'STAFF',   emoji: '🔍',   label: 'Staff / Censeur', color: '#0d9488', bg: '#ccfbf1', border: 'rgba(13,148,136,0.3)' },
]

const ROLES = [
  { emoji:'🏫',   name:'Administrateur',  desc:"Gestion complète de l'établissement" },
  { emoji:'👨‍🏫', name:'Enseignant',       desc:'Présences, notes, emploi du temps' },
  { emoji:'👨‍👩‍👧', name:'Parent',           desc:'Suivi scolaire & paiements Mobile Money' },
  { emoji:'👨‍🎓', name:'Élève',            desc:'Notes, bulletins, emploi du temps' },
  { emoji:'🔍',   name:'Censeur / Staff', desc:'Validation notes, EDT, conseil de classe' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [schoolId, setSchoolId]         = useState('')         // subdomain envoyé à l'API
  const [selectedSchool, setSelectedSchool] = useState<SchoolOption | null>(null)
  const [schools, setSchools]           = useState<SchoolOption[]>([])
  const [schoolsLoading, setSchoolsLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [selectedRole, setSelectedRole]         = useState<string | null>(null)
  const [roleMismatchWarning, setRoleMismatchWarning] = useState<string | null>(null)
  const [loading, setLoading]                   = useState(false)
  const [alert, setAlert]           = useState<{ msg: string; type: 'error' | 'warning' } | null>(null)
  const [suspended, setSuspended]   = useState<{ schoolName: string } | null>(null)
  const [success, setSuccess]       = useState<SuccessInfo | null>(null)
  const [progress, setProgress]     = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { emailRef.current?.focus() }, [])

  // Empêcher le remplissage automatique du navigateur (sécurité)
  useEffect(() => {
    const t = setTimeout(() => { setEmail(''); setPassword('') }, 50)
    return () => clearTimeout(t)
  }, [])

  // Charge la liste des écoles publiques au montage
  useEffect(() => {
    fetch('/api/v2/public/schools', { headers: { 'ngrok-skip-browser-warning': '1' } })
      .then(r => r.json())
      .then(data => { if (data.success) setSchools(data.data) })
      .catch(() => {/* silencieux — l'utilisateur peut toujours taper manuellement */})
      .finally(() => setSchoolsLoading(false))
  }, [])

  // Ferme le dropdown au clic extérieur
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setProgress(true), 100)
      const r = setTimeout(() => router.push(success.dest), 2200)
      return () => { clearTimeout(t); clearTimeout(r) }
    }
  }, [success, router])

  const submit = async () => {
    setAlert(null)
    setSuspended(null)
    if (!selectedRole) {
      setAlert({ msg: 'Veuillez sélectionner votre rôle', type: 'error' }); return
    }
    if (!selectedSchool) {
      setAlert({ msg: "Veuillez sélectionner votre établissement", type: 'error' }); return
    }
    if (!email.trim() || !password) {
      setAlert({ msg: 'Email et mot de passe requis', type: 'error' }); return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/v2/users/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          subdomain: schoolId.trim().toLowerCase(),
          role: selectedRole,
        }),
      })

      const data = await res.json()

      // École suspendue — credentials valides mais accès bloqué
      if (res.status === 403 && data.error === 'SCHOOL_SUSPENDED') {
        setSuspended({ schoolName: selectedSchool.name })
        return
      }

      // Cas multi-rôles
      if (res.status === 422 && data.code === 'ROLE_MISMATCH_MULTIPLE') {
        const labels = (data.availableRoles as string[])
          .map(r => ROLE_SELECTOR.find(s => s.role === r)?.label ?? r)
          .join(' et ')
        setAlert({
          msg: `Votre compte dans cet établissement a plusieurs rôles : ${labels}. Sélectionnez le bon rôle ci-dessus.`,
          type: 'error',
        })
        return
      }

      if (!data.success) {
        const msg: string = data.message ?? 'Email ou mot de passe incorrect'
        setAlert({ msg, type: 'error' })
        return
      }

      const { role, nomComplet, userId, permissions, roleMismatch, redirectTo } = data.data as {
        role: string; nomComplet: string; userId: string; permissions: string[]; roleMismatch: boolean; redirectTo?: string | null
      }
      const config = ROLE_CONFIG[role] ?? { emoji: '👤', badge: role, color: '#6b7280', bg: '#f3f4f6', dest: '/' }
      const dest = redirectTo ?? config.dest
      const firstName = nomComplet?.split(' ')[0] ?? 'Bienvenue'

      localStorage.setItem('edunexus_user', JSON.stringify({
        userId, role, nomComplet, firstName,
        permissions: permissions ?? [],
      }))

      if (roleMismatch) {
        const selectedLabel = ROLE_SELECTOR.find(s => s.role === selectedRole)?.label ?? selectedRole
        const actualLabel   = ROLE_SELECTOR.find(s => s.role === role)?.label ?? role
        setRoleMismatchWarning(`Vous avez sélectionné ${selectedLabel} mais votre rôle dans cet établissement est ${actualLabel}. Redirection vers votre espace…`)
      }

      setSuccess({ ...config, dest, firstName })
    } catch {
      setAlert({ msg: 'Impossible de se connecter. Vérifiez votre connexion.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#f7f3ee',
      fontFamily: 'var(--font-nunito), Nunito, sans-serif'
    }}>

      {/* ══ PANNEAU GAUCHE ══ */}
      <div style={{
        width: '48%', background: '#1a2e1e',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden', flexShrink: 0
      }}>
        {/* Bande déco */}
        <div style={{
          height: 6, flexShrink: 0,
          background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px,#d4a843 64px,#d4a843 80px)'
        }} />

        {/* Cercle déco 1 */}
        <div style={{
          position: 'absolute', bottom: -80, right: -80,
          width: 300, height: 300, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(34,197,94,0.08) 0%, transparent 70%)'
        }} />
        {/* Cercle déco 2 */}
        <div style={{
          position: 'absolute', top: 100, left: -60,
          width: 200, height: 200, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)'
        }} />

        <div style={{
          padding: '44px', display: 'flex', flexDirection: 'column',
          flex: 1, position: 'relative', zIndex: 1
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 60 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 14, fontSize: 32,
              background: 'linear-gradient(135deg,#f59e0b,#22c55e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(34,197,94,0.25)'
            }}>🎓</div>
            <div>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 36, fontWeight: 700, color: 'white' }}>EduNexus</div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>Gestion Scolaire · Cameroun</div>
            </div>
          </div>

          {/* Titre */}
          <div style={{
            fontFamily: 'var(--font-spectral),Spectral,serif',
            fontSize: 48, fontWeight: 700, lineHeight: 1.2,
            color: 'white', marginBottom: 14
          }}>
            Bienvenue<br />
            sur votre <span style={{ color: '#4ade80' }}>espace</span><br />
            scolaire
          </div>

          <p style={{
            fontSize: 19, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7,
            fontWeight: 500, maxWidth: 400, marginBottom: 48
          }}>
            Accédez à votre tableau de bord personnalisé selon votre rôle dans l&apos;établissement.
          </p>

          {/* Rôle cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {ROLES.map((role, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '13px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, cursor: 'default',
                transition: 'all 0.2s'
              }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.09)', borderColor: 'rgba(255,255,255,0.14)', transform: 'translateX(4px)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)', transform: 'none' })}
              >
                <div style={{
                  fontSize: 26, width: 50, height: 50,
                  background: 'rgba(255,255,255,0.06)', borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>{role.emoji}</div>
                <div>
                  <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{role.name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 15, fontWeight: 500 }}>{role.desc}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.2)', fontSize: 20 }}>→</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div style={{ marginTop: 'auto', fontSize: 16, color: 'rgba(255,255,255,0.2)', fontWeight: 500, paddingTop: 16 }}>
            © 2026 EduNexus · Système de gestion scolaire
          </div>
        </div>
      </div>

      {/* ══ PANNEAU DROIT ══ */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40, background: '#f7f3ee', position: 'relative'
      }}>
        <div style={{ width: '100%', maxWidth: 530, position: 'relative', zIndex: 1 }}>

          {/* ══ BLOC SUSPENSION — remplace le formulaire ══ */}
          {suspended ? (
            <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
              <style>{`@keyframes edu-fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }`}</style>
              <div style={{ background: '#fef2f2', border: '2px solid rgba(220,38,38,0.25)', borderRadius: 16, padding: '32px 36px', boxShadow: '0 4px 24px rgba(220,38,38,0.08)' }}>
                <div style={{ fontSize: 40, marginBottom: 16, textAlign: 'center' }}>🚫</div>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#991b1b', marginBottom: 12, textAlign: 'center' }}>
                  Établissement suspendu
                </div>
                <div style={{ fontSize: 15, color: '#b91c1c', fontWeight: 600, lineHeight: 1.7, marginBottom: 20 }}>
                  <strong>{suspended.schoolName}</strong> a été suspendu par l&apos;administrateur EduNexus.
                  L&apos;accès à la plateforme est temporairement bloqué pour cet établissement.
                </div>
                <div style={{ background: 'white', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, padding: '14px 18px', marginBottom: 20, fontSize: 14, color: '#6b5c45', lineHeight: 1.6 }}>
                  Pour toute question ou pour régulariser la situation, contactez le support EduNexus à{' '}
                  <a href="mailto:support@edunexus.cm" style={{ color: '#059669', fontWeight: 700 }}>support@edunexus.cm</a>
                </div>
                <button
                  onClick={() => setSuspended(null)}
                  style={{ width: '100%', padding: '12px 0', background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, fontSize: 15, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Changer d&apos;établissement
                </button>
              </div>
            </div>
          ) : (

          <>{/* Welcome */}
          <div style={{ marginBottom: 32 }}>
            <span style={{ fontSize: 45, marginBottom: 10, display: 'block' }}>👋</span>
            <div style={{
              fontFamily: 'var(--font-spectral),Spectral,serif',
              fontSize: 36, fontWeight: 700, color: '#1a1209', marginBottom: 6
            }}>
              Connexion à votre espace
            </div>
            <div style={{ fontSize: 18, color: '#6b5c45', fontWeight: 500, lineHeight: 1.6 }}>
              Entrez vos identifiants pour accéder à votre tableau de bord.
            </div>
          </div>

          {/* Alert */}
          {alert && (
            <div style={{
              padding: '12px 14px', borderRadius: 10, fontSize: 17, fontWeight: 700,
              marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
              background: alert.type === 'error' ? '#fee2e2' : '#ffedd5',
              border: alert.type === 'error' ? '1px solid rgba(220,38,38,0.2)' : '1px solid rgba(234,88,12,0.2)',
              color: alert.type === 'error' ? '#b91c1c' : '#ea580c'
            }}>
              <span>⚠️</span><span>{alert.msg}</span>
            </div>
          )}

          {/* Sélecteur d'établissement */}
          <div style={{ marginBottom: 18, position: 'relative' }} ref={dropdownRef}>
            <label style={{ fontSize: 15, fontWeight: 800, color: '#6b5c45', marginBottom: 7, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              🏫 Votre établissement *
            </label>

            {/* Bouton déclencheur */}
            <button
              type="button"
              onClick={() => { setDropdownOpen(o => !o); setSchoolSearch('') }}
              style={{
                width: '100%', padding: '16px 16px', background: 'white',
                border: `1.5px solid ${dropdownOpen ? '#059669' : '#e8e0d4'}`,
                borderRadius: 14, color: selectedSchool ? '#1a1209' : '#a89478',
                fontSize: 15, fontFamily: 'inherit', fontWeight: 600,
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                boxShadow: dropdownOpen ? '0 0 0 3px rgba(5,150,105,0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {schoolsLoading ? (
                  <span style={{ color: '#a89478' }}>Chargement des établissements…</span>
                ) : selectedSchool ? (
                  <>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🏫</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedSchool.name}
                    </span>
                  </>
                ) : (
                  <span>Sélectionner votre établissement…</span>
                )}
              </span>
              <ChevronDown size={16} style={{ flexShrink: 0, color: '#a89478', transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'none' }} />
            </button>

            {/* Sous-domaine affiché sous le bouton quand sélectionné */}
            {selectedSchool && (
              <div style={{ fontSize: 13, color: '#a89478', fontWeight: 500, marginTop: 5 }}>
                Sous-domaine : <span style={{ fontFamily: 'monospace', color: '#6b5c45' }}>{selectedSchool.subdomain}</span>
                {selectedSchool.city ? ` · ${selectedSchool.city}` : ''}
              </div>
            )}

            {/* Dropdown */}
            {dropdownOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50,
                background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)', overflow: 'hidden',
              }}>
                {/* Barre de recherche */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0ebe3', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Search size={15} style={{ color: '#a89478', flexShrink: 0 }} />
                  <input
                    autoFocus
                    type="text"
                    value={schoolSearch}
                    onChange={e => setSchoolSearch(e.target.value)}
                    placeholder="Rechercher un établissement…"
                    style={{ border: 'none', outline: 'none', fontSize: 14, color: '#1a1209', fontFamily: 'inherit', fontWeight: 600, width: '100%', background: 'transparent' }}
                  />
                </div>

                {/* Liste */}
                <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                  {schools.length === 0 ? (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#a89478', fontSize: 14 }}>
                      Aucun établissement disponible
                    </div>
                  ) : (() => {
                    const filtered = schools.filter(s =>
                      s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
                      s.subdomain.toLowerCase().includes(schoolSearch.toLowerCase()) ||
                      (s.city ?? '').toLowerCase().includes(schoolSearch.toLowerCase())
                    )
                    if (filtered.length === 0) return (
                      <div style={{ padding: '20px 16px', textAlign: 'center', color: '#a89478', fontSize: 14 }}>
                        Aucun résultat pour &ldquo;{schoolSearch}&rdquo;
                      </div>
                    )
                    return filtered.map(school => (
                      <button
                        key={school.id}
                        type="button"
                        onClick={() => {
                          setSelectedSchool(school)
                          setSchoolId(school.subdomain)
                          setDropdownOpen(false)
                          setAlert(null)
                        }}
                        style={{
                          width: '100%', padding: '12px 16px', background: selectedSchool?.id === school.id ? '#f0fdf4' : 'white',
                          border: 'none', borderBottom: '1px solid #faf7f2',
                          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          display: 'flex', alignItems: 'center', gap: 12,
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0fdf4' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = selectedSchool?.id === school.id ? '#f0fdf4' : 'white' }}
                      >
                        <span style={{ fontSize: 26, flexShrink: 0 }}>🏫</span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1209', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{school.name}</span>
                            {selectedSchool?.id === school.id && (
                              <span style={{ fontSize: 10, color: '#059669', fontWeight: 800, flexShrink: 0 }}>✓</span>
                            )}
                          </span>
                          <span style={{ fontSize: 12, color: '#a89478', fontWeight: 500, fontFamily: 'monospace' }}>
                            {school.subdomain}{school.city ? ` · ${school.city}` : ''}
                          </span>
                        </span>
                      </button>
                    ))
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Sélecteur de rôle */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 15, fontWeight: 800, color: '#6b5c45', marginBottom: 10, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Votre rôle *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {ROLE_SELECTOR.map(r => {
                const active = selectedRole === r.role
                return (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setSelectedRole(active ? null : r.role)}
                    style={{
                      padding: '10px 6px', border: `1.5px solid ${active ? r.border : '#e8e0d4'}`,
                      borderRadius: 12, background: active ? r.bg : 'white',
                      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                      transition: 'all 0.15s',
                      boxShadow: active ? `0 0 0 3px ${r.border}` : 'none',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = r.border }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.borderColor = '#e8e0d4' }}
                  >
                    <div style={{ fontSize: 22, marginBottom: 4 }}>{r.emoji}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: active ? r.color : '#6b5c45', lineHeight: 1.3 }}>
                      {r.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 15, fontWeight: 800, color: '#6b5c45', marginBottom: 7, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Adresse email
            </label>
            <input
              ref={emailRef} type="email" value={email}
              onChange={e => { setEmail(e.target.value); setAlert(null) }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="jean.dupont@ecole.cm"
              autoComplete="off"
              style={{ width: '100%', padding: '19px 16px', background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 14, color: '#1a1209', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.2s' }}
            />
          </div>

          {/* Mot de passe */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 15, fontWeight: 800, color: '#6b5c45', marginBottom: 7, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setAlert(null) }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="••••••••••" autoComplete="new-password"
                style={{ width: '100%', padding: '19px 16px', background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 14, color: '#1a1209', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.2s' }}
              />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#a89478', cursor: 'pointer', padding: 4 }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Mot de passe oublié */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -10, marginBottom: 18 }}>
            <button style={{ fontSize: 15, fontWeight: 700, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              Mot de passe oublié ?
            </button>
          </div>

          {/* Bouton submit */}
          <button onClick={submit} disabled={loading}
            style={{
              width: '100%', padding: 14,
              background: 'linear-gradient(135deg,#059669,#047857)',
              color: 'white', fontSize: 19, fontWeight: 800,
              border: 'none', borderRadius: 10, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', transition: 'all 0.2s',
              boxShadow: '0 4px 16px rgba(5,150,105,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: loading ? 0.8 : 1
            }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Connexion...' : 'Se connecter →'}
          </button>

        </>
        )}

        </div>
      </div>

      {/* ══ MODAL SUCCÈS ══ */}
      {success && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
          zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'white', borderRadius: 20, padding: 40,
            textAlign: 'center', maxWidth: 360, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both'
          }}>
            <span style={{ fontSize: 56, marginBottom: 16, display: 'block' }}>
              {success.emoji}
            </span>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>
              Bonjour, {success.firstName} !
            </div>
            {roleMismatchWarning && (
              <div style={{ padding: '10px 14px', background: '#fef3c7', border: '1px solid rgba(217,119,6,0.3)', borderRadius: 10, fontSize: 13, color: '#92400e', fontWeight: 600, marginBottom: 10, textAlign: 'left', lineHeight: 1.6 }}>
                ⚠️ {roleMismatchWarning}
              </div>
            )}
            <div style={{ fontSize: 14, color: '#6b5c45', fontWeight: 500, lineHeight: 1.6, marginBottom: 8 }}>
              Connexion réussie à EduNexus · École Lycée du Succès
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 20,
              fontSize: 13, fontWeight: 800, margin: '12px 0 20px',
              background: success.bg, color: success.color
            }}>
              {success.emoji} {success.badge}
            </div>

            {/* Barre de progression 2s */}
            <div style={{ background: '#f0ebe3', borderRadius: 8, overflow: 'hidden', height: 6, marginBottom: 16 }}>
              <div style={{
                height: '100%', background: '#059669',
                width: progress ? '100%' : '0%',
                transition: 'width 2s linear', borderRadius: 8
              }} />
            </div>
            <div style={{ fontSize: 12, color: '#a89478', fontWeight: 600, marginBottom: 14 }}>
              Redirection dans 2 secondes...
            </div>
            <button
              onClick={() => router.push(success.dest)}
              style={{ width: '100%', padding: 12, background: '#059669', color: 'white', fontSize: 14, fontWeight: 800, border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
              Accéder au tableau de bord →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
