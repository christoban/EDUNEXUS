'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'valid' | 'invalid' | 'expired' | 'used'
type Step = 1 | 2 | 3

interface InviteData {
  schoolName: string
  email: string
  plan: string
  notes: string | null
}

interface FormData {
  // Step 1 — École
  nom: string
  subdomain: string
  subsystem: string
  educationType: string
  ownership: string
  ville: string
  region: string
  telephone: string
  adresse: string
  logoBase64: string
  // Step 2 — Admin
  adminPrenom: string
  adminNom: string
  adminEmail: string
  password: string
  confirmPassword: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const REGIONS = ['Adamaoua','Centre','Est','Extrême-Nord','Littoral','Nord','Nord-Ouest','Ouest','Sud','Sud-Ouest']

const PLAN_LABEL: Record<string, string> = {
  DISCOVERY: 'Découverte', STANDARD: 'Standard', PREMIUM: 'Premium',
}
const PLAN_COLOR: Record<string, string> = {
  DISCOVERY: '#059669', STANDARD: '#2563eb', PREMIUM: '#9333ea',
}

const SUBSYSTEM_OPTIONS = [
  { value: 'FRANCOPHONE', label: 'Francophone', icon: '🇫🇷' },
  { value: 'ANGLOPHONE',  label: 'Anglophone',  icon: '🇬🇧' },
  { value: 'BILINGUAL',   label: 'Bilingue',    icon: '🌍' },
]
const EDUCATION_OPTIONS = [
  { value: 'GENERAL',      label: 'Enseignement général',      icon: '📚' },
  { value: 'TECHNICAL',    label: 'Enseignement technique',    icon: '⚙️' },
  { value: 'PROFESSIONAL', label: 'Enseignement professionnel', icon: '🔧' },
  { value: 'MIXED',        label: 'Mixte',                     icon: '🎓' },
]
const OWNERSHIP_OPTIONS = [
  { value: 'PUBLIC',          label: 'Public',              icon: '🏛️' },
  { value: 'PRIVATE_SECULAR', label: 'Privé laïc',         icon: '🏫' },
  { value: 'PRIVATE_FAITH',   label: 'Privé confessionnel', icon: '⛪' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function toSlug(v: string) {
  return v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function labelOf(opts: { value: string; label: string }[], val: string) {
  return opts.find(o => o.value === val)?.label ?? val
}

// ── Sub-components ─────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '11px 14px', background: 'white',
  border: '1.5px solid #d4c8b8', borderRadius: 10, color: '#1a1209',
  fontSize: 17, fontFamily: 'inherit', fontWeight: 600, outline: 'none',
  boxSizing: 'border-box', transition: 'all 0.2s',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 6, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: '#dc2626', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Alert({ msg, type }: { msg: string; type: 'error' | 'success' | 'info' }) {
  const styles = {
    error:   { bg: '#fef2f2', border: 'rgba(220,38,38,0.25)',  color: '#991b1b', icon: '⚠️' },
    success: { bg: '#f0fdf4', border: 'rgba(5,150,105,0.25)',  color: '#065f46', icon: '✅' },
    info:    { bg: '#eff6ff', border: 'rgba(37,99,235,0.25)',  color: '#1e40af', icon: 'ℹ️' },
  }[type]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: styles.bg, border: `1.5px solid ${styles.border}`, borderRadius: 10, marginBottom: 14, fontSize: 14, fontWeight: 700, color: styles.color }}>
      <span>{styles.icon}</span><span>{msg}</span>
    </div>
  )
}

function RadioCards({ options, value, onChange }: {
  options: { value: string; label: string; icon: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length <= 3 ? options.length : 2}, 1fr)`, gap: 8 }}>
      {options.map(o => {
        const active = value === o.value
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            style={{
              padding: '10px 8px', border: `2px solid ${active ? '#059669' : '#d4c8b8'}`,
              borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
            <span style={{ fontSize: 22 }}>{o.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: active ? '#047857' : '#6b5c45', textAlign: 'center', lineHeight: 1.2 }}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function SubmitBtn({ loading, disabled, onClick, children }: { loading?: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={loading || disabled}
      style={{
        width: '100%', padding: '14px', background: loading || disabled ? '#a8d5c2' : 'linear-gradient(135deg,#059669,#047857)',
        color: 'white', fontSize: 18, fontWeight: 800, border: 'none', borderRadius: 10,
        cursor: loading || disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        boxShadow: loading || disabled ? 'none' : '0 4px 16px rgba(5,150,105,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, transition: 'all 0.2s',
      }}>
      {loading
        ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /> Traitement en cours…</>
        : children}
    </button>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const params = useParams()
  const token = params?.token as string

  const [loadState, setLoadState]   = useState<LoadState>('loading')
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [step, setStep]             = useState<Step>(1)
  const [done, setDone]             = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError]     = useState('')
  const [stepError, setStepError]         = useState('')
  const [showPwd, setShowPwd]             = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)

  const [form, setForm] = useState<FormData>({
    nom: '', subdomain: '', subsystem: 'FRANCOPHONE', educationType: 'GENERAL',
    ownership: 'PRIVATE_SECULAR', ville: '', region: '', telephone: '', adresse: '',
    logoBase64: '',
    adminPrenom: '', adminNom: '', adminEmail: '', password: '', confirmPassword: '',
  })

  const set = (k: keyof FormData) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const slRef = useRef(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) { setStepError('Logo trop volumineux (max 1.5 MB).'); return }
    const reader = new FileReader()
    reader.onload = () => set('logoBase64')(reader.result as string)
    reader.readAsDataURL(file)
  }

  // Auto-generate subdomain from school name
  useEffect(() => {
    if (!slRef.current && form.nom) {
      setForm(f => ({ ...f, subdomain: toSlug(f.nom) }))
    }
  }, [form.nom])

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      // token absent après 1s → URL invalide
      const t = setTimeout(() => {
        setLoadState('invalid')
        setErrorMsg('Lien d\'invitation invalide ou incomplet.')
      }, 1000)
      return () => clearTimeout(t)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000) // 12s timeout

    fetch(`/api/v2/onboarding/invite/${token}`, {
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
      .then(r => {
        if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data.success) {
          setInviteData(data.data)
          setForm(f => ({ ...f, nom: data.data.schoolName, adminEmail: data.data.email }))
          setLoadState('valid')
        } else {
          const msg: string = data.message ?? 'Invitation invalide.'
          if (msg.includes('expiré')) setLoadState('expired')
          else if (msg.includes('utilisée')) setLoadState('used')
          else setLoadState('invalid')
          setErrorMsg(msg)
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') {
          setLoadState('invalid')
          setErrorMsg('La vérification a pris trop de temps. Vérifiez votre connexion et réessayez.')
        } else {
          setLoadState('invalid')
          setErrorMsg('Impossible de vérifier l\'invitation. Vérifiez votre connexion.')
        }
      })
      .finally(() => clearTimeout(timeout))
  }, [token])

  // Validate step 1
  function validateStep1(): string {
    if (!form.nom.trim())       return 'Le nom de l\'établissement est requis.'
    if (!form.subdomain.trim()) return 'Le sous-domaine est requis.'
    if (!/^[a-z0-9-]+$/.test(form.subdomain)) return 'Le sous-domaine ne peut contenir que des lettres minuscules, chiffres et tirets.'
    if (form.subdomain.length < 3) return 'Le sous-domaine doit faire au moins 3 caractères.'
    return ''
  }

  // Validate step 2
  function validateStep2(): string {
    if (!form.adminPrenom.trim()) return 'Le prénom est requis.'
    if (!form.adminNom.trim())    return 'Le nom de famille est requis.'
    if (!form.adminEmail.trim() || !form.adminEmail.includes('@')) return 'Adresse email invalide.'
    if (form.password.length < 8)  return 'Le mot de passe doit contenir au moins 8 caractères.'
    if (form.password !== form.confirmPassword) return 'Les mots de passe ne correspondent pas.'
    return ''
  }

  function goNext() {
    setStepError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) { setStepError(err); return }
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) { setStepError(err); return }
      setStep(3)
    }
  }

  async function handleSubmit() {
    setSubmitError('')
    setSubmitLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const res = await fetch(`/api/v2/onboarding/invite/${token}/complete`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          nom: form.nom,
          subdomain: form.subdomain,
          adresse: form.adresse,
          ville: form.ville,
          region: form.region,
          telephone: form.telephone,
          logoBase64: form.logoBase64 || undefined,
          subsystem: form.subsystem,
          educationType: form.educationType,
          ownership: form.ownership,
          adminPrenom: form.adminPrenom,
          adminNom: form.adminNom,
          adminEmail: form.adminEmail,
          password: form.password,
        }),
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Erreur lors de la soumission.')
      setDone(true)
    } catch (e: any) {
      clearTimeout(timeout)
      const msg = e?.name === 'AbortError'
        ? 'La requête a pris trop de temps (>30s). Vérifiez votre connexion et réessayez.'
        : (e?.message || 'Erreur réseau. Vérifiez votre connexion et réessayez.')
      console.error('[Onboarding submit error]', e)
      setSubmitError(msg)
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    } finally {
      setSubmitLoading(false)
    }
  }

  // ── Left panel (constant) ──────────────────────────────────────────────

  const LeftPanel = (
    <div style={{ width: '42vw', minWidth: 0, background: '#1a2e1e', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', flexShrink: 0 }} className="edu-left-panel">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, zIndex: 2, background: 'repeating-linear-gradient(90deg,#f59e0b 0,#f59e0b 16px,#22c55e 16px,#22c55e 32px,#ef4444 32px,#ef4444 48px,#60a5fa 48px,#60a5fa 64px,#d4a843 64px,#d4a843 80px)' }} />
      <div style={{ position: 'absolute', bottom: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 44, animation: 'edu-fadeDown 0.6s ease both' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,#f59e0b,#22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 4px 16px rgba(34,197,94,0.3)', flexShrink: 0 }}>🎓</div>
          <div>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'white' }}>EduNexus</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>Plateforme scolaire · Cameroun</div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 38, fontWeight: 700, lineHeight: 1.15, color: 'white', marginBottom: 12, animation: 'edu-fadeDown 0.6s 0.1s ease both' }}>
          Bienvenue sur<br />
          <span style={{ color: '#4ade80' }}>EduNexus</span>
        </div>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, fontWeight: 500, marginBottom: 36, animation: 'edu-fadeDown 0.6s 0.2s ease both' }}>
          Configurez votre espace scolaire en quelques minutes. Votre établissement sera opérationnel dès validation.
        </p>

        {/* Plan badge */}
        {inviteData && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, marginBottom: 28, animation: 'edu-fadeDown 0.6s 0.25s ease both', alignSelf: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>⭐</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: PLAN_COLOR[inviteData.plan] ?? '#059669' }}>Plan {PLAN_LABEL[inviteData.plan] ?? inviteData.plan}</span>
          </div>
        )}

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'edu-fadeDown 0.6s 0.3s ease both' }}>
          {[
            { bg: 'rgba(34,197,94,0.1)',   icon: '🏫', title: 'Gestion multi-niveaux',      desc: 'Classes, sections, matières' },
            { bg: 'rgba(96,165,250,0.1)',   icon: '📊', title: 'Notes & bulletins',          desc: 'Calcul automatique, export PDF' },
            { bg: 'rgba(245,158,11,0.1)',   icon: '💳', title: 'Gestion financière',         desc: 'Frais, paiements, CampPay' },
            { bg: 'rgba(212,168,67,0.1)',   icon: '📅', title: 'Emplois du temps IA',        desc: 'Génération automatique' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{f.icon}</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                <strong style={{ color: 'white', fontWeight: 700 }}>{f.title}</strong> — {f.desc}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
          © 2026 EduNexus · Tous droits réservés
        </div>
      </div>
    </div>
  )

  // ── Stepper ────────────────────────────────────────────────────────────

  const Stepper = (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
      {([
        { n: 1, label: 'Établissement' },
        { n: 2, label: 'Administrateur' },
        { n: 3, label: 'Confirmation' },
      ] as { n: Step; label: string }[]).map(({ n, label }) => {
        const active = step === n, done2 = step > n
        return (
          <div key={n}
            className={`edu-step${active ? ' s-active' : ''}${done2 ? ' s-done' : ''}`}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flex: 1, position: 'relative' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, zIndex: 1, border: `5px solid ${done2 ? '#047857' : active ? '#059669' : '#d4c8b8'}`, color: done2 ? 'white' : active ? '#059669' : '#a89478', background: done2 ? '#047857' : active ? 'rgba(5,150,105,0.08)' : 'white', transition: 'all 0.3s' }}>
              {done2 ? '✓' : n}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: done2 ? '#047857' : active ? '#059669' : '#a89478' }}>{label}</div>
          </div>
        )
      })}
    </div>
  )

  // ── Right panel content ────────────────────────────────────────────────

  let content: React.ReactNode

  if (loadState === 'loading') {
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '60px 0', animation: 'edu-fadeUp 0.4s ease both' }}>
        <div style={{ width: 52, height: 52, border: '4px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: '#6b5c45' }}>Vérification de l&apos;invitation…</div>
      </div>
    )
  } else if (loadState === 'invalid' || loadState === 'expired' || loadState === 'used') {
    const info = {
      invalid:  { icon: '🔒', title: 'Lien invalide',          color: '#dc2626', bg: '#fef2f2', border: 'rgba(220,38,38,0.2)' },
      expired:  { icon: '⏰', title: 'Invitation expirée',     color: '#d97706', bg: '#fef3c7', border: 'rgba(217,119,6,0.2)' },
      used:     { icon: '✅', title: 'Invitation déjà utilisée', color: '#059669', bg: '#f0fdf4', border: 'rgba(5,150,105,0.2)' },
    }[loadState]
    content = (
      <div style={{ animation: 'edu-fadeUp 0.4s ease both', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>{info.icon}</div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209', marginBottom: 12 }}>{info.title}</div>
        <div style={{ padding: '16px 20px', background: info.bg, border: `1.5px solid ${info.border}`, borderRadius: 12, marginBottom: 24, fontSize: 15, fontWeight: 600, color: info.color, lineHeight: 1.6 }}>
          {errorMsg}
        </div>
        <p style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.7 }}>
          Pour obtenir de l&apos;aide, contactez votre administrateur EduNexus à <strong>support@edunexus.cm</strong>
        </p>
      </div>
    )
  } else if (done) {
    content = (
      <div style={{ animation: 'edu-fadeUp 0.4s ease both', textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 30, fontWeight: 700, color: '#1a1209', marginBottom: 10 }}>
          Demande soumise !
        </div>
        <div style={{ padding: '16px 20px', background: '#f0fdf4', border: '1.5px solid rgba(5,150,105,0.2)', borderRadius: 12, marginBottom: 24, fontSize: 15, fontWeight: 600, color: '#065f46', lineHeight: 1.8 }}>
          ✅ <strong>{form.nom}</strong> est en attente de validation par l&apos;équipe EduNexus.<br />
          Vous recevrez un email à <strong>{form.adminEmail}</strong> sous 24 à 48 heures.
        </div>
        <p style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.7 }}>
          Dès approbation, vous pourrez vous connecter avec votre email et mot de passe pour accéder à votre espace d&apos;administration.
        </p>
      </div>
    )
  } else {
    content = (
      <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: '#1a1209', marginBottom: 4 }}>
            {step === 1 ? 'Votre établissement' : step === 2 ? 'Votre compte administrateur' : 'Vérification finale'}
          </div>
          <div style={{ fontSize: 15, color: '#6b5c45', fontWeight: 500 }}>
            {step === 1 ? 'Renseignez les informations de votre école.' : step === 2 ? 'Créez votre compte pour accéder au dashboard.' : 'Relisez avant de soumettre votre dossier.'}
          </div>
        </div>

        {Stepper}

        {stepError && <Alert msg={stepError} type="error" />}

        {/* ── STEP 1 ──────────────────────────────── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Field label="Nom de l'établissement" required>
              <input className="edu-field" value={form.nom} style={INPUT}
                onChange={e => set('nom')(e.target.value)} placeholder="Lycée de la Réussite" />
            </Field>

            <Field label="Sous-domaine (URL)" required>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: '#a89478' }}>edunexus.cm/</span>
                <input className="edu-field" value={form.subdomain} style={{ ...INPUT, paddingLeft: 106 }}
                  onChange={e => { slRef.current = true; set('subdomain')(toSlug(e.target.value)) }}
                  placeholder="lycee-reussite" />
              </div>
              <div style={{ fontSize: 12, color: '#a89478', marginTop: 4, fontWeight: 600 }}>
                Lettres minuscules, chiffres et tirets uniquement.
              </div>
            </Field>

            <Field label="Sous-système" required>
              <RadioCards options={SUBSYSTEM_OPTIONS} value={form.subsystem} onChange={set('subsystem')} />
            </Field>

            <Field label="Type d'enseignement" required>
              <RadioCards options={EDUCATION_OPTIONS} value={form.educationType} onChange={set('educationType')} />
            </Field>

            <Field label="Statut juridique" required>
              <RadioCards options={OWNERSHIP_OPTIONS} value={form.ownership} onChange={set('ownership')} />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Ville">
                <input className="edu-field" value={form.ville} style={INPUT}
                  onChange={e => set('ville')(e.target.value)} placeholder="Yaoundé" />
              </Field>
              <Field label="Région">
                <select className="edu-field" value={form.region} style={{ ...INPUT, appearance: 'none', backgroundImage: 'none' }}
                  onChange={e => set('region')(e.target.value)}>
                  <option value="">— Sélectionner —</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Téléphone de l'établissement">
              <input className="edu-field" value={form.telephone} style={INPUT}
                onChange={e => set('telephone')(e.target.value)} placeholder="+237 6XX XXX XXX" />
            </Field>

            {/* Logo upload */}
            <Field label="Logo de l'établissement (facultatif)">
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Preview or placeholder */}
                <div onClick={() => logoInputRef.current?.click()}
                  style={{ width: 72, height: 72, borderRadius: 14, border: `2px dashed ${form.logoBase64 ? '#059669' : '#d4c8b8'}`, background: form.logoBase64 ? 'transparent' : '#f9f6f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, transition: 'all 0.15s' }}>
                  {form.logoBase64
                    ? <img src={form.logoBase64} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 28 }}>🏫</span>}
                </div>
                <div>
                  <button type="button" onClick={() => logoInputRef.current?.click()}
                    style={{ padding: '9px 16px', border: '1.5px solid #d4c8b8', borderRadius: 9, background: 'white', fontSize: 14, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6 }}>
                    {form.logoBase64 ? '🔄 Changer le logo' : '📤 Téléverser un logo'}
                  </button>
                  <div style={{ fontSize: 12, color: '#a89478', fontWeight: 600 }}>PNG, JPG, SVG · max 1.5 MB</div>
                  {form.logoBase64 && (
                    <button type="button" onClick={() => set('logoBase64')('')}
                      style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                      ✕ Supprimer
                    </button>
                  )}
                </div>
              </div>
            </Field>

            <SubmitBtn onClick={goNext}>Continuer → Compte administrateur</SubmitBtn>
          </div>
        )}

        {/* ── STEP 2 ──────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <button type="button" onClick={() => { setStep(1); setStepError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#a89478', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}>
              ← Retour
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Prénom" required>
                <input className="edu-field" value={form.adminPrenom} style={INPUT}
                  onChange={e => set('adminPrenom')(e.target.value)} placeholder="Jean" />
              </Field>
              <Field label="Nom" required>
                <input className="edu-field" value={form.adminNom} style={INPUT}
                  onChange={e => set('adminNom')(e.target.value)} placeholder="Ngono" />
              </Field>
            </div>

            <Field label="Email administrateur" required>
              <input className="edu-field" type="email" value={form.adminEmail} style={INPUT}
                onChange={e => set('adminEmail')(e.target.value)} placeholder="admin@ecole.cm" />
              <div style={{ fontSize: 12, color: '#a89478', marginTop: 4, fontWeight: 600 }}>
                Cet email sera votre identifiant de connexion.
              </div>
            </Field>

            <Field label="Mot de passe" required>
              <div style={{ position: 'relative' }}>
                <input className="edu-field" type={showPwd ? 'text' : 'password'} value={form.password}
                  style={{ ...INPUT, paddingRight: 44 }}
                  onChange={e => set('password')(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#a89478' }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#a89478', marginTop: 4, fontWeight: 600 }}>Minimum 8 caractères.</div>
            </Field>

            <Field label="Confirmer le mot de passe" required>
              <div style={{ position: 'relative' }}>
                <input className="edu-field" type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                  style={{ ...INPUT, paddingRight: 44, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? '#dc2626' : '#d4c8b8' }}
                  onChange={e => set('confirmPassword')(e.target.value)} placeholder="••••••••" />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#a89478' }}>
                  {showConfirm ? '🙈' : '👁'}
                </button>
              </div>
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4, fontWeight: 700 }}>⚠️ Les mots de passe ne correspondent pas.</div>
              )}
            </Field>

            <SubmitBtn onClick={goNext}>Continuer → Confirmation</SubmitBtn>
          </div>
        )}

        {/* ── STEP 3 — Récapitulatif ───────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <button type="button" onClick={() => { setStep(2); setSubmitError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: '#a89478', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 14, padding: 0 }}>
              ← Retour
            </button>

            {/* Summary cards */}
            <div style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>🏫 Établissement</div>
              {form.logoBase64 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 0', borderBottom: '1px solid #f0ebe3' }}>
                  <img src={form.logoBase64} alt="Logo" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1.5px solid #e8e0d4' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>Logo téléversé ✓</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                {[
                  ['Nom', form.nom],
                  ['Sous-domaine', `edunexus.cm/${form.subdomain}`],
                  ['Sous-système', labelOf(SUBSYSTEM_OPTIONS, form.subsystem)],
                  ['Enseignement', labelOf(EDUCATION_OPTIONS, form.educationType)],
                  ['Statut', labelOf(OWNERSHIP_OPTIONS, form.ownership)],
                  ['Ville', form.ville || '—'],
                  ['Région', form.region || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700, wordBreak: 'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>👤 Administrateur</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                {[
                  ['Prénom', form.adminPrenom],
                  ['Nom', form.adminNom],
                  ['Email', form.adminEmail],
                  ['Mot de passe', '••••••••'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 11, color: '#a89478', fontWeight: 700, textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 14, color: '#1a1209', fontWeight: 700, wordBreak: 'break-all' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <Alert msg="Une fois soumis, votre dossier sera examiné sous 24-48h. Vous recevrez un email de confirmation." type="info" />

            {submitError && (
              <div ref={errorRef}>
                <Alert msg={submitError} type="error" />
              </div>
            )}

            <SubmitBtn loading={submitLoading} onClick={handleSubmit}>
              🚀 Soumettre ma demande d&apos;inscription
            </SubmitBtn>
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .edu-step:not(:last-child)::after {
          content: '';
          position: absolute; top: 13px; left: calc(50% + 12px);
          width: calc(100% - 24px); height: 2px;
          background: #d4c8b8; transition: background 0.4s;
        }
        .edu-step.s-done:not(:last-child)::after,
        .edu-step.s-active:not(:last-child)::after { background: #047857; }
        .edu-field:focus { border-color: #059669 !important; background: #f0ece6 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.08); }
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        @keyframes edu-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes edu-fadeDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 768px) {
          .edu-left-panel { display: none !important; }
          .edu-right-panel { width: 100vw !important; max-width: 100vw !important; }
        }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>

        {LeftPanel}

        {/* ── Right panel ── */}
        <div className="edu-right-panel" style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: '#f7f3ee', overflowY: 'auto', position: 'relative', padding: '32px 24px' }}>
          <div style={{ position: 'absolute', top: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.05) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 1 }}>
            {content}
          </div>
        </div>

      </div>
    </>
  )
}
