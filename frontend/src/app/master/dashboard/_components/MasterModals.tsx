'use client'
import { useState, useRef, useEffect } from 'react'
import type { ModalId } from '../_types'
import { inviteSchool, suspendSchool, rejectSchool, deleteSchool, changeSchoolPlan, approveSchool, fetchMasterMfaStatus, changePassword } from '../_api'

interface Props {
  open: ModalId
  schoolId: string | null
  suspendTarget: { id: string; name: string; subdomain: string } | null
  deleteTarget: { id: string; name: string } | null
  mfaEnabled: boolean
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onActionDone: () => void
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
      {children}
    </div>
  )
}

function ModalWrap({ children, size = 'md' }: { children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const maxW = size === 'sm' ? 550 : size === 'lg' ? 860 : 520
  return (
    <div style={{
      background: 'white', borderRadius: 18, padding: 32,
      maxWidth: maxW, width: '90%', maxHeight: '90vh', overflowY: 'auto',
      position: 'relative', animation: 'popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both'
    }}>
      {children}
    </div>
  )
}

function ModalHeader({ title, sub, onClose, danger }: { title: string; sub?: string; onClose: () => void; danger?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: danger ? '#dc2626' : '#1a1209' }}>{title}</div>
        {sub && <div style={{ fontSize: 17, color: '#6b5c45', marginTop: 4 }}>{sub}</div>}
      </div>
      <button onClick={onClose} style={{ width: 40, height: 40, borderRadius: 8, border: '1.5px solid #d4c8b8', background: 'none', cursor: 'pointer', fontSize: 22, color: '#a89478', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
    </div>
  )
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid #e8e0d4' }}>
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 14, fontWeight: 800, color: '#6b5c45', marginBottom: 6, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#a89478', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

function FieldInput({ placeholder, type = 'text', value, onChange, style }: { placeholder?: string; type?: string; value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; style?: React.CSSProperties }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={onChange}
      style={{ width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 10, color: '#1a1209', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, outline: 'none', ...style }} />
  )
}

function BtnPrimary({ onClick, children, disabled, type = 'button' }: { onClick?: () => void; children: React.ReactNode; disabled?: boolean; type?: 'button' | 'submit' }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ padding: '11px 20px', borderRadius: 10, fontSize: 17, fontWeight: 800, background: disabled ? '#6b7280' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: disabled ? 'none' : '0 3px 12px rgba(5,150,105,0.25)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      {children}
    </button>
  )
}

function BtnSecondary({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '11px 20px', borderRadius: 10, fontSize: 17, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
      {children}
    </button>
  )
}

function SchoolSummary({ initials: init, name, meta, danger }: { initials: string; name: string; meta: string; danger?: boolean }) {
  return (
    <div style={{ background: '#f0ebe3', borderRadius: 14, padding: '18px 20px', marginBottom: 19, display: 'flex', gap: 14, alignItems: 'center' }}>
      <div style={{ width: 53, height: 53, borderRadius: 11, background: danger ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'linear-gradient(135deg,#059669,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 20, flexShrink: 0 }}>
        {init}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1209' }}>{name}</div>
        <div style={{ fontSize: 16, color: '#a89478', marginTop: 2 }}>{meta}</div>
      </div>
    </div>
  )
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: '#fef3c7', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '12px 14px', fontSize: 17, color: '#92400e', fontWeight: 600, lineHeight: 1.6, marginBottom: 19, display: 'flex', gap: 10 }}>
      {children}
    </div>
  )
}

const PLAN_MAP: Record<string, string> = { deco: 'DISCOVERY', std: 'STANDARD', prem: 'PREMIUM' }

export default function MasterModals({ open, schoolId, suspendTarget, deleteTarget, mfaEnabled, onClose, onToast, onActionDone }: Props) {
  const [selectedPlan, setSelectedPlan] = useState<'deco' | 'std' | 'prem'>('std')
  const [suspendReason, setSuspendReason] = useState('')
  const [deleteInput, setDeleteInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [rejectFocused, setRejectFocused] = useState(false)
  const rejectRef = useRef<HTMLTextAreaElement>(null)

  // changePwd state
  const [pwdStep, setPwdStep] = useState<1 | 2>(1)
  const [currentPwd, setCurrentPwd] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const resetPwdState = () => {
    setPwdStep(1)
    setCurrentPwd('')
    setMfaCode('')
    setNewPwd('')
    setConfirmPwd('')
    setPwdLoading(false)
  }

  const doAction = async (action: () => Promise<void>, successMsg: string, errMsg: string) => {
    setLoading(true)
    try {
      await action()
      onToast(successMsg)
      onActionDone()
      onClose()
    } catch (err: any) {
      onToast(err.message || errMsg, 'error')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <>
      {open === 'invite' && (
        <Overlay onClose={onClose}>
          <ModalWrap>
            <ModalHeader title="Inviter un nouvel établissement" sub="Un lien d'activation valable 72h sera envoyé à l'administrateur" onClose={onClose} />
            <InviteForm
              selectedPlan={selectedPlan}
              onPlanChange={setSelectedPlan}
              loading={loading}
              onCancel={onClose}
              onDone={(msg) => { onToast(msg); onActionDone(); onClose() }}
              onError={(msg) => onToast(msg, 'error')}
            />
          </ModalWrap>
        </Overlay>
      )}

      {open === 'approve' && (
        <Overlay onClose={onClose}>
          <ModalWrap size="lg">
            <ModalHeader title="Confirmer l'approbation" sub="Validation de l'école" onClose={onClose} />
            <WarningBox>⚠️ Cette action va approuver l'établissement. Vérifiez que les informations sont complètes avant de confirmer.</WarningBox>
            <ModalFooter>
              <BtnSecondary onClick={onClose}>Annuler</BtnSecondary>
              <BtnPrimary disabled={loading} onClick={() => doAction(
                async () => {
                  if (!schoolId) throw new Error('ID école manquant')
                  await approveSchool(schoolId)
                },
                'École approuvée avec succès ! L\'admin a été notifié par email.',
                'Erreur lors de l\'approbation'
              )}>
                {loading ? '...' : '✅ Confirmer l\'approbation'}
              </BtnPrimary>
            </ModalFooter>
          </ModalWrap>
        </Overlay>
      )}

      {open === 'reject' && schoolId && (
        <Overlay onClose={onClose}>
          <ModalWrap size="sm">
            <ModalHeader title="Rejeter la demande" sub="L'administrateur sera notifié du rejet par email" onClose={onClose} />
            <Field label="Motif du rejet *" hint="Obligatoire — ce motif sera envoyé par email">
              <textarea
                ref={rejectRef}
                placeholder="Ex: Documents incomplets, Informations insuffisantes..."
                onFocus={() => setRejectFocused(true)}
                onBlur={() => setRejectFocused(false)}
                onInput={() => {
                  const el = rejectRef.current
                  if (!el) return
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 320) + 'px'
                }}
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 10,
                  color: '#1a1209', fontSize: 16, fontFamily: 'inherit', fontWeight: 600,
                  outline: 'none', resize: 'none', minHeight: 80, maxHeight: 320, overflowY: 'auto',
                  background: rejectFocused ? 'white' : '#f0ebe3',
                  border: rejectFocused ? '1.5px solid #2AA05F' : '1.5px solid #d4c8b8',
                  boxShadow: rejectFocused ? '0 0 0 3px rgba(48,189,153,0.1)' : 'none',
                  transition: 'background 0.2s, border 0.2s, box-shadow 0.2s',
                }} />
            </Field>
            <ModalFooter>
              <BtnSecondary onClick={onClose}>Annuler</BtnSecondary>
              <BtnPrimary disabled={loading} onClick={() => doAction(
                async () => {
                  const motif = rejectRef.current?.value?.trim()
                  if (!motif) throw new Error('Un motif de rejet est requis')
                  await rejectSchool(schoolId, motif)
                },
                'Demande rejetée',
                'Erreur lors du rejet'
              )}>
                {loading ? '...' : '❌ Confirmer le rejet'}
              </BtnPrimary>
            </ModalFooter>
          </ModalWrap>
        </Overlay>
      )}

      {open === 'suspend' && suspendTarget && (
        <Overlay onClose={onClose}>
          <ModalWrap size="sm">
            <ModalHeader title="Suspendre l'établissement" sub={suspendTarget.name} onClose={onClose} />
            <SchoolSummary
              initials={suspendTarget.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
              name={suspendTarget.name} meta={`${suspendTarget.subdomain}`} danger />
            <WarningBox>⚠️ La suspension bloque immédiatement l&apos;accès à tous les utilisateurs. Action réversible via &quot;Réactiver&quot;.</WarningBox>
            <Field label="Motif de la suspension" hint="Sera enregistré dans les logs">
              <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                placeholder="Ex: Non-paiement, Violation des conditions..."
                style={{ width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 10, color: '#1a1209', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, outline: 'none', resize: 'vertical', minHeight: 80 }} />
            </Field>
            <ModalFooter>
              <BtnSecondary onClick={onClose}>Annuler</BtnSecondary>
              <BtnPrimary disabled={loading} onClick={() => doAction(
                async () => { await suspendSchool(suspendTarget.id, suspendReason) },
                `${suspendTarget.name} a été suspendue`,
                'Erreur lors de la suspension'
              )}>
                {loading ? '...' : '⛔ Confirmer la suspension'}
              </BtnPrimary>
            </ModalFooter>
          </ModalWrap>
        </Overlay>
      )}

      {open === 'delete' && deleteTarget && (
        <Overlay onClose={onClose}>
          <ModalWrap size="sm">
            <ModalHeader title="⚠️ Supprimer l'établissement" sub={deleteTarget.name} onClose={onClose} danger />
            <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '16px 18px', marginBottom: 18, border: '2px solid #dc2626' }}>
              <div style={{ color: '#f87171', fontSize: 13, fontWeight: 800, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>🚨 ACTION IRRÉVERSIBLE</div>
              <div style={{ color: '#fca5a5', fontSize: 12.5, fontWeight: 600, lineHeight: 1.6 }}>
                Cette action supprimera <strong style={{ color: 'white' }}>définitivement</strong> l&apos;établissement et toutes ses données.
              </div>
            </div>
            <Field label="Confirmez en tapant le nom de l'école *"
              hint={deleteInput === deleteTarget.name
                ? '⚠️ Confirmation valide'
                : 'Le nom doit correspondre exactement'}>
              <input type="text" value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
                placeholder={`Tapez exactement : ${deleteTarget.name}`}
                style={{ width: '100%', padding: '11px 14px', background: '#f0ebe3', border: `1.5px solid ${deleteInput === deleteTarget.name ? '#dc2626' : '#d4c8b8'}`, borderRadius: 10, color: '#1a1209', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }} />
            </Field>
            <ModalFooter>
              <BtnSecondary onClick={() => { onClose(); setDeleteInput('') }}>Annuler</BtnSecondary>
              <button
                type="button"
                disabled={deleteInput !== deleteTarget.name || loading}
                onClick={() => doAction(
                  async () => { await deleteSchool(deleteTarget.id) },
                  `${deleteTarget.name} a été définitivement supprimée`,
                  'Erreur lors de la suppression'
                )}
                style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 800, background: deleteInput === deleteTarget.name && !loading ? '#dc2626' : '#6b7280', color: 'white', border: 'none', cursor: deleteInput === deleteTarget.name && !loading ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
                🗑️ Supprimer définitivement
              </button>
            </ModalFooter>
          </ModalWrap>
        </Overlay>
      )}

      {open === 'changePwd' && (
        <Overlay onClose={() => { onClose(); resetPwdState() }}>
          <ModalWrap size="sm">
            <ModalHeader
              title="Changer le mot de passe"
              sub={pwdStep === 1 ? 'Étape 1 / 2 — Vérification d\'identité' : 'Étape 2 / 2 — Nouveau mot de passe'}
              onClose={() => { onClose(); resetPwdState() }}
            />

            {pwdStep === 1 ? (
              <>
                <Field label="Mot de passe actuel *">
                  <FieldInput type="password" placeholder="••••••••••••" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
                </Field>
                {mfaEnabled && (
                  <Field label="Code TOTP ou code de récupération *" hint="Requis car le MFA est actif sur ce compte">
                    <FieldInput
                      type="text"
                      placeholder="123456  ou  ABCD-1234-EFGH-5678"
                      value={mfaCode}
                      onChange={e => setMfaCode(e.target.value)}
                      style={{ textAlign: 'center', fontSize: 16, letterSpacing: 2 }}
                    />
                  </Field>
                )}
                <ModalFooter>
                  <BtnSecondary onClick={() => { onClose(); resetPwdState() }}>Annuler</BtnSecondary>
                  <BtnPrimary onClick={() => {
                    if (!currentPwd.trim()) { onToast('Le mot de passe actuel est requis.', 'error'); return }
                    if (mfaEnabled && !mfaCode.trim()) { onToast('Le code MFA est requis.', 'error'); return }
                    setPwdStep(2)
                  }}>
                    Continuer →
                  </BtnPrimary>
                </ModalFooter>
              </>
            ) : (
              <>
                <Field label="Nouveau mot de passe *" hint="Minimum 12 caractères">
                  <FieldInput type="password" placeholder="Minimum 12 caractères" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                </Field>
                <Field label="Confirmer le mot de passe *">
                  <FieldInput type="password" placeholder="Répétez le nouveau mot de passe" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
                </Field>
                <ModalFooter>
                  <BtnSecondary onClick={() => setPwdStep(1)}>← Retour</BtnSecondary>
                  <BtnPrimary
                    disabled={pwdLoading}
                    onClick={async () => {
                      if (newPwd.length < 12) { onToast('Minimum 12 caractères requis.', 'error'); return }
                      if (newPwd !== confirmPwd) { onToast('Les mots de passe ne correspondent pas.', 'error'); return }
                      setPwdLoading(true)
                      try {
                        await changePassword({ currentPassword: currentPwd, mfaCode: mfaCode || undefined, newPassword: newPwd })
                        onToast('Mot de passe modifié avec succès.')
                        onClose()
                        resetPwdState()
                      } catch (err: any) {
                        onToast(err.message || 'Erreur lors du changement de mot de passe', 'error')
                      } finally {
                        setPwdLoading(false)
                      }
                    }}
                  >
                    {pwdLoading ? '...' : '✅ Confirmer le changement'}
                  </BtnPrimary>
                </ModalFooter>
              </>
            )}
          </ModalWrap>
        </Overlay>
      )}
    </>
  )
}

function InviteForm({ selectedPlan, onPlanChange, loading, onCancel, onDone, onError }: {
  selectedPlan: 'deco' | 'std' | 'prem'
  onPlanChange: (p: 'deco' | 'std' | 'prem') => void
  loading: boolean
  onCancel: () => void
  onDone: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [step, setStep] = useState<'details' | 'confirm'>('details')
  const [email, setEmail] = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchMasterMfaStatus()
      .then(d => setMfaEnabled(d.mfaEnabled))
      .catch(() => setMfaEnabled(false))
  }, [])

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !schoolName) { onError('Email et nom de l\'école requis'); return }
    if (!email.includes('@')) { onError('Format email invalide'); return }
    setStep('confirm')
  }

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) { onError('Le mot de passe master est requis.'); return }
    if (mfaEnabled && !mfaCode.trim()) { onError('Le code MFA est requis.'); return }

    setSubmitting(true)
    try {
      await inviteSchool({
        email,
        schoolName,
        plan: PLAN_MAP[selectedPlan],
        sensitiveAuth: { password: password.trim(), ...(mfaEnabled && { code: mfaCode.trim() }) },
      })
      onDone(`Invitation envoyée à ${email}`)
    } catch (err: any) {
      onError(err.message || 'Erreur lors de l\'invitation')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'details') {
    return (
      <form onSubmit={handleDetailsSubmit}>
        <Field label="Email de l'administrateur *" hint="L'administrateur recevra le lien d'invitation">
          <FieldInput type="email" placeholder="directeur@lyceedebafia.cm" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        <Field label="Nom de l'établissement *">
          <FieldInput placeholder="Lycée de Bafia" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
        </Field>
        <Field label="Plan tarifaire">
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'deco' as const, name: 'Découverte', desc: 'Gratuit · 50 élèves max' },
              { id: 'std' as const, name: 'Standard', desc: '300 élèves · Toutes fonctions' },
              { id: 'prem' as const, name: 'Premium', desc: 'Illimité · IA + Mobile Money' },
            ].map(plan => (
              <div key={plan.id} onClick={() => onPlanChange(plan.id)} style={{
                flex: 1, padding: 10, border: `1.5px solid ${selectedPlan === plan.id ? '#059669' : '#d4c8b8'}`,
                borderRadius: 10, textAlign: 'center', cursor: 'pointer',
                background: selectedPlan === plan.id ? '#d1fae5' : 'white',
                transition: 'all 0.15s'
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1209' }}>{plan.name}</div>
                <div style={{ fontSize: 10, color: '#a89478', marginTop: 2 }}>{plan.desc}</div>
              </div>
            ))}
          </div>
        </Field>
        <ModalFooter>
          <button type="button" onClick={onCancel} style={{ padding: '11px 20px', borderRadius: 10, fontSize: 17, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
          <button type="submit" disabled={loading} style={{ padding: '11px 20px', borderRadius: 10, fontSize: 17, fontWeight: 800, background: loading ? '#6b7280' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: loading ? 'none' : '0 3px 12px rgba(5,150,105,0.25)' }}>
            Continuer →
          </button>
        </ModalFooter>
      </form>
    )
  }

  return (
    <form onSubmit={handleConfirmSubmit}>
      <div style={{ background: '#f0ebe3', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#a89478', marginBottom: 4 }}>Établissement</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>{schoolName}</div>
        <div style={{ fontSize: 12, color: '#a89478', marginTop: 10, marginBottom: 4 }}>Email</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1209' }}>{email}</div>
      </div>

      <Field label="Mot de passe master *" hint="Confirmez votre identité pour envoyer l'invitation">
        <FieldInput type="password" placeholder="••••••••••••" value={password} onChange={e => setPassword(e.target.value)} />
      </Field>

      {mfaEnabled && (
        <Field label="Code MFA *">
          <FieldInput type="tel" placeholder="123456" value={mfaCode} onChange={e => setMfaCode(e.target.value)} style={{ textAlign: 'center', fontSize: 18, fontWeight: 900, letterSpacing: 4 }} />
        </Field>
      )}

      <ModalFooter>
        <button type="button" onClick={() => setStep('details')} style={{ padding: '11px 20px', borderRadius: 10, fontSize: 17, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>← Retour</button>
        <button type="submit" disabled={submitting || loading} style={{ padding: '11px 20px', borderRadius: 10, fontSize: 17, fontWeight: 800, background: submitting || loading ? '#6b7280' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: submitting || loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: submitting || loading ? 'none' : '0 3px 12px rgba(5,150,105,0.25)' }}>
          {submitting ? '...' : '📧 Envoyer l\'invitation'}
        </button>
      </ModalFooter>
    </form>
  )
}
