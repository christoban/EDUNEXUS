'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────

type ConfigStep = 1 | 2 | 3 | 4

interface SchoolData {
  id: string
  name: string
  subdomain: string
  subsystem: string
  educationType: string
  ownership: string
  email: string | null
  logoUrl: string | null
  status: string
}

interface ClassPreview {
  name: string
  level: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

const SUBSYSTEM_LABEL: Record<string, string> = {
  FRANCOPHONE: 'Francophone', ANGLOPHONE: 'Anglophone', BILINGUAL: 'Bilingue',
}
const EDU_LABEL: Record<string, string> = {
  GENERAL: 'Général', TECHNICAL: 'Technique', PROFESSIONAL: 'Professionnel', MIXED: 'Mixte',
}
const OWN_LABEL: Record<string, string> = {
  PUBLIC: 'Public', PRIVATE_SECULAR: 'Privé laïc', PRIVATE_FAITH: 'Privé confessionnel',
}

function typeLabel(school: SchoolData) {
  return [
    SUBSYSTEM_LABEL[school.subsystem] ?? school.subsystem,
    EDU_LABEL[school.educationType] ?? school.educationType,
    OWN_LABEL[school.ownership] ?? school.ownership,
  ].join(' · ')
}

function currentAcademicYear() {
  const y = new Date().getFullYear()
  return `${y}–${y + 1}`
}

// ── Styles ─────────────────────────────────────────────────────────────────

const PAGE: React.CSSProperties = {
  minHeight: '100vh',
  background: '#f7f3ee',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  fontFamily: 'var(--font-nunito),Nunito,sans-serif',
  padding: '40px 16px 80px',
}

const CARD: React.CSSProperties = {
  background: 'white',
  border: '1.5px solid #e8e0d4',
  borderRadius: 18,
  padding: '36px 40px',
  width: '100%',
  maxWidth: 620,
  boxShadow: '0 4px 24px rgba(26,46,30,0.07)',
}

const LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: '#a89478',
  textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4,
}

const VALUE: React.CSSProperties = {
  fontSize: 15, fontWeight: 600, color: '#1a1209',
}

const ROW: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 2, padding: '12px 0',
  borderBottom: '1px solid #f0ebe3',
}

const BTN_PRIMARY: React.CSSProperties = {
  background: 'linear-gradient(135deg,#059669,#047857)',
  color: 'white', border: 'none', borderRadius: 10,
  padding: '13px 28px', fontSize: 15, fontWeight: 700,
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
}

const BTN_SECONDARY: React.CSSProperties = {
  background: 'transparent', color: '#6b5c45',
  border: '1.5px solid #d4c8b8', borderRadius: 10,
  padding: '13px 24px', fontSize: 15, fontWeight: 600,
  cursor: 'pointer',
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ConfigurationPage() {
  const router = useRouter()

  const [step, setStep] = useState<ConfigStep>(1)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [school, setSchool] = useState<SchoolData | null>(null)
  const [classes, setClasses] = useState<ClassPreview[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState('')

  // ── Load school info ──────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d.success) { router.replace('/login'); return }
        const s: SchoolData = d.data
        if (s.status === 'ACTIVE') { router.replace('/admin/dashboard'); return }
        if (s.status !== 'APPROVED') { router.replace('/login'); return }
        setSchool(s)
        setLoadState('ready')
      })
      .catch(() => router.replace('/login'))
  }, [router])

  // ── Load class preview when reaching step 2 ──────────────────────────
  useEffect(() => {
    if (step !== 2 || !school || classes.length > 0) return
    setPreviewLoading(true)
    fetch(`/api/v2/schools/${school.id}/configuration/preview`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setClasses(d.data.classes) })
      .catch(() => {})
      .finally(() => setPreviewLoading(false))
  }, [step, school, classes.length])

  // ── Activate ──────────────────────────────────────────────────────────
  async function handleActivate() {
    if (!school) return
    setActivating(true)
    setActivateError('')
    try {
      const res = await fetch(`/api/v2/schools/${school.id}/activate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.message || 'Erreur lors de l\'activation')
      router.replace('/admin/dashboard?activated=1')
    } catch (e: any) {
      setActivateError(e.message || 'Erreur réseau. Réessayez.')
      setActivating(false)
    }
  }

  // ── Loading / error screens ───────────────────────────────────────────

  if (loadState === 'loading') {
    return (
      <div style={{ ...PAGE, justifyContent: 'center' }}>
        <div style={{ width: 48, height: 48, border: '4px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite' }} />
        <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (loadState === 'error' || !school) return null

  // ── Step labels ───────────────────────────────────────────────────────

  const STEPS = [
    { n: 1, label: 'Récapitulatif' },
    { n: 2, label: 'Classes' },
    { n: 3, label: 'Vérification' },
    { n: 4, label: 'Activation' },
  ]

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div style={PAGE}>
      <style>{`
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        @keyframes edu-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
        .cfg-btn-primary:hover { opacity: 0.9; }
        .cfg-btn-secondary:hover { background: #f7f3ee !important; }
      `}</style>

      {/* Brand header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#1a2e1e,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
          🎓
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>EduNexus</div>
          <div style={{ fontSize: 12, color: '#a89478', fontWeight: 600 }}>Configuration de votre espace</div>
        </div>
      </div>

      {/* Card */}
      <div style={{ ...CARD, animation: 'edu-fadeUp 0.4s ease both' }}>

        {/* Progress bar */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45' }}>Étape {step} / {STEPS.length}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#a89478' }}>
              {STEPS.find(s => s.n === step)?.label}
            </span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#e8e0d4', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(step / STEPS.length) * 100}%`, background: 'linear-gradient(90deg,#059669,#047857)', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
        </div>

        {/* ── ÉTAPE 1 — Récapitulatif ─────────────────────────────────── */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 4 }}>
                Votre école a été approuvée 🎉
              </div>
              <div style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.6 }}>
                Finalisez la configuration pour activer votre espace EduNexus.
              </div>
            </div>

            <div style={{ background: '#f0fdf4', border: '1.5px solid rgba(5,150,105,0.2)', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ✅ Informations enregistrées
              </div>
              <div style={ROW}>
                <div style={LABEL}>Nom de l'établissement</div>
                <div style={VALUE}>{school.name}</div>
              </div>
              <div style={ROW}>
                <div style={LABEL}>Type d'établissement</div>
                <div style={VALUE}>{typeLabel(school)}</div>
              </div>
              <div style={ROW}>
                <div style={LABEL}>Sous-domaine</div>
                <div style={{ ...VALUE, fontFamily: 'monospace', color: '#059669' }}>
                  {school.subdomain}.edunexus.cm
                </div>
              </div>
              {school.email && (
                <div style={{ ...ROW, borderBottom: 'none' }}>
                  <div style={LABEL}>Email de contact</div>
                  <div style={VALUE}>{school.email}</div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="cfg-btn-primary" style={BTN_PRIMARY} onClick={() => setStep(2)}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 2 — Structure des classes ─────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 4 }}>
                Classes à créer
              </div>
              <div style={{ fontSize: 15, color: '#6b5c45' }}>
                Voici la structure générée depuis vos choix lors de l'inscription.
              </div>
            </div>

            {previewLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', color: '#a89478' }}>
                <div style={{ width: 20, height: 20, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite', flexShrink: 0 }} />
                Chargement de la structure…
              </div>
            ) : classes.length === 0 ? (
              <div style={{ padding: '20px', background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 12, color: '#92400e', fontSize: 14, fontWeight: 600 }}>
                ⚠️ Aucune classe détectée. La structure sera créée selon votre configuration initiale.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#059669', marginBottom: 10 }}>
                  {classes.length} classe{classes.length > 1 ? 's' : ''} à créer
                </div>
                <div style={{ maxHeight: 280, overflowY: 'auto', border: '1.5px solid #e8e0d4', borderRadius: 10, marginBottom: 20 }}>
                  {classes.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < classes.length - 1 ? '1px solid #f0ebe3' : 'none' }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1209' }}>{c.name}</span>
                      <span style={{ fontSize: 12, color: '#a89478', marginLeft: 'auto' }}>{c.level}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="cfg-btn-secondary" style={BTN_SECONDARY} onClick={() => setStep(1)}>
                ← Retour
              </button>
              <button className="cfg-btn-primary" style={BTN_PRIMARY} onClick={() => setStep(3)}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 3 — Vérification ───────────────────────────────────── */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 4 }}>
                Vérification finale
              </div>
              <div style={{ fontSize: 15, color: '#6b5c45' }}>
                Voici tout ce qui sera créé à l'activation.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {[
                { icon: '🏫', text: `${classes.length > 0 ? classes.length : '—'} classe${classes.length > 1 ? 's' : ''}` },
                { icon: '📅', text: `Année scolaire ${currentAcademicYear()}` },
                { icon: '🗓️', text: '3 trimestres + 6 séquences (DS1 → DS5 + Composition)' },
                { icon: '📊', text: 'Formule de notes MINESEC (DS coeff 1, Composition coeff 2)' },
                { icon: '🎓', text: 'Mentions MINESEC (Excellent ≥16, TB ≥14, B ≥12, AB ≥10)' },
                { icon: '⚙️', text: 'Configuration : note de passage 10/20, 3 trimestres/an' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', background: '#f7f3ee', borderRadius: 10 }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#059669', fontWeight: 700, fontSize: 14 }}>✅</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1209' }}>{item.text}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 14, color: '#92400e', fontWeight: 600 }}>
              ⚠️ Tout pourra être modifié depuis votre tableau de bord après activation.
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="cfg-btn-secondary" style={BTN_SECONDARY} onClick={() => setStep(2)}>
                ← Retour
              </button>
              <button className="cfg-btn-primary" style={BTN_PRIMARY} onClick={() => setStep(4)}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 4 — Activation ────────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div style={{ marginBottom: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🚀</div>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>
                Prêt à activer
              </div>
              <div style={{ fontSize: 15, color: '#6b5c45', lineHeight: 1.7 }}>
                Cliquez sur le bouton ci-dessous pour créer toute la structure de{' '}
                <strong>{school.name}</strong> et accéder à votre tableau de bord.
              </div>
            </div>

            {activateError && (
              <div style={{ background: '#fef2f2', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#dc2626', fontSize: 14, fontWeight: 600 }}>
                ❌ {activateError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <button
                className="cfg-btn-primary"
                style={{ ...BTN_PRIMARY, width: '100%', justifyContent: 'center', fontSize: 16, padding: '16px 28px', opacity: activating ? 0.7 : 1 }}
                onClick={handleActivate}
                disabled={activating}
              >
                {activating ? (
                  <>
                    <div style={{ width: 18, height: 18, border: '3px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite' }} />
                    Activation en cours…
                  </>
                ) : (
                  '🚀 Activer mon espace EduNexus'
                )}
              </button>

              {!activating && (
                <button className="cfg-btn-secondary" style={BTN_SECONDARY} onClick={() => setStep(3)}>
                  ← Retour
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 32, fontSize: 13, color: '#a89478', textAlign: 'center' }}>
        EduNexus · Plateforme de gestion scolaire · Cameroun
      </div>
    </div>
  )
}
