'use client'
import { useState, useEffect, useRef } from 'react'

interface SchoolInfo { name: string; logoUrl: string | null; subdomain?: string; city?: string; phone?: string; email?: string }

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  schoolInfo?: SchoolInfo | null
  onLogoUpdate?: (url: string) => void
}
interface ActivityLog { id: string; createdAt: string; action: string; description: string; user?: { firstName?: string; lastName?: string } | null }
interface EmailLog { id: string; createdAt: string; to: string; subject: string; status: string }

const TABS = ['Profil', 'Notifications', 'Sécurité', 'Pédagogie', 'Préférences', 'Activités', 'Emails']

const NOTIF_SETTINGS = [
  { label: 'Alertes notes en attente',       sub: 'Notifier quand des notes dépassent 48h sans validation', on: true },
  { label: 'Rappels de présences',            sub: 'Rappel quotidien si des créneaux ne sont pas saisis',    on: true },
  { label: 'Paiements Mobile Money',          sub: "Notification lors d'un paiement reçu ou échoué",       on: true },
  { label: 'Invitations expirées',            sub: 'Alerter quand une invitation utilisateur expire',        on: false },
  { label: 'Résumé hebdomadaire',             sub: 'Rapport automatique chaque lundi matin par email',       on: false },
]

export default function SectionSettings({ onToast, schoolInfo, onLogoUpdate }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const [notifs, setNotifs] = useState(NOTIF_SETTINGS.map(n => n.on))
  const [schoolName, setSchoolName] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [schoolCity, setSchoolCity] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // Pédagogie
  const [pedSettings, setPedSettings] = useState<{
    passMark: number; councilPassMark: number; gradesPerTerm: number; termsPerYear: number
    maxAbsences: number; attendanceLateAsAbsence: boolean
    legalMaxContributionFirstCycle: number; legalMaxContributionSecondCycle: number
    bulletinBlockOnUnpaidFees: boolean
    schoolLanguageMode: string; academicCalendarType: string; cycles: string[]
    smsEnabled: boolean; offlineModeEnabled: boolean; aiAlertsEnabled: boolean; messageModeration: boolean
  } | null>(null)
  const [pedLoading, setPedLoading] = useState(false)
  const [pedSaving, setPedSaving] = useState(false)

  // Activity logs
  const [actPage, setActPage]               = useState(1)
  const [actSearchInput, setActSearchInput] = useState('')
  const [actSearch, setActSearch]           = useState('')
  const [actData, setActData]               = useState<{ logs: ActivityLog[]; page: number; pages: number; total: number } | null>(null)
  const [actLoading, setActLoading]         = useState(false)
  // Email logs
  const [emlPage, setEmlPage]               = useState(1)
  const [emlSearchInput, setEmlSearchInput] = useState('')
  const [emlSearch, setEmlSearch]           = useState('')
  const [emlStatus, setEmlStatus]           = useState('')
  const [emlData, setEmlData]               = useState<{ logs: EmailLog[]; pagination: { total: number; page: number; pages: number; limit: number } } | null>(null)
  const [emlLoading, setEmlLoading]         = useState(false)

  useEffect(() => {
    if (schoolInfo) {
      setSchoolName(schoolInfo.name || '')
      setSchoolCity(schoolInfo.city || '')
      setSchoolPhone(schoolInfo.phone || '')
      setSchoolEmail(schoolInfo.email || '')
      setLogoPreview(schoolInfo.logoUrl || null)
    }
  }, [schoolInfo])

  useEffect(() => {
    if (activeTab !== 3) return
    if (pedSettings) return
    setPedLoading(true)
    fetch('/api/v2/school-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPedSettings(d.data) })
      .catch(() => onToast('Erreur chargement paramètres', 'error'))
      .finally(() => setPedLoading(false))
  }, [activeTab])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 5) return
    setActLoading(true)
    const params = new URLSearchParams({ page: String(actPage), limit: '10' })
    if (actSearch) params.set('search', actSearch)
    fetch(`/api/v2/activities?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setActData({ logs: d.logs ?? [], page: d.page ?? 1, pages: d.pages ?? 1, total: d.total ?? 0 }))
      .catch(() => onToast('Erreur chargement activités', 'error'))
      .finally(() => setActLoading(false))
  }, [activeTab, actPage, actSearch])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 6) return
    setEmlLoading(true)
    const params = new URLSearchParams({ page: String(emlPage), limit: '15' })
    if (emlSearch) params.set('search', emlSearch)
    if (emlStatus) params.set('status', emlStatus)
    fetch(`/api/v2/email-logs?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setEmlData({ logs: d.logs ?? [], pagination: d.pagination ?? { total: 0, page: 1, pages: 1, limit: 15 } }))
      .catch(() => onToast('Erreur chargement emails', 'error'))
      .finally(() => setEmlLoading(false))
  }, [activeTab, emlPage, emlSearch, emlStatus])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) { onToast('Logo trop volumineux (max 1.5 MB)', 'error'); return }
    const reader = new FileReader()
    reader.onload = async () => {
      const logoBase64 = reader.result as string
      setLogoPreview(logoBase64)
      setLogoLoading(true)
      try {
        const res = await fetch('/api/v2/school/logo', {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logoBase64 }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || 'Erreur')
        onLogoUpdate?.(logoBase64)
        onToast('Logo mis à jour avec succès', 'success')
      } catch (err: any) {
        onToast(err.message || 'Erreur lors de la mise à jour du logo', 'error')
        setLogoPreview(schoolInfo?.logoUrl ?? null)
      } finally {
        setLogoLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-settings-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Paramètres</div>
          <div style={sSub}>Configuration de l&apos;établissement</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f0ebe3', padding: 5, borderRadius: 12, marginBottom: 24, width: 'fit-content' }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '8px 20px', borderRadius: 9, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: activeTab === i ? 'white' : 'transparent', color: activeTab === i ? '#1a1209' : '#a89478', boxShadow: activeTab === i ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB: PROFIL ── */}
      {activeTab === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Logo */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>🖼️ Logo de l&apos;établissement</span></div>
            <div style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 24 }}>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
              <div onClick={() => !logoLoading && logoInputRef.current?.click()}
                style={{ width: 88, height: 88, borderRadius: 16, border: `2px dashed ${logoPreview ? '#059669' : '#d4c8b8'}`, background: logoPreview ? 'transparent' : '#f9f6f1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: logoLoading ? 'wait' : 'pointer', overflow: 'hidden', flexShrink: 0, transition: 'all 0.15s', position: 'relative' }}>
                {logoLoading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    <div style={{ width: 22, height: 22, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
                  </div>
                )}
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 36 }}>🏫</span>}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>
                  {logoPreview ? 'Logo actuel' : 'Aucun logo défini'}
                </div>
                <div style={{ fontSize: 14, color: '#a89478', marginBottom: 10, lineHeight: 1.5 }}>
                  Ce logo apparaît dans la barre latérale de tous les utilisateurs<br />de votre établissement (admin, enseignants, etc.)
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnSec} onClick={() => logoInputRef.current?.click()} disabled={logoLoading}>
                    {logoPreview ? '🔄 Changer' : '📤 Téléverser'}
                  </button>
                  {logoPreview && (
                    <button style={{ ...btnSec, color: '#dc2626', borderColor: 'rgba(220,38,38,0.3)' }}
                      disabled={logoLoading}
                      onClick={async () => {
                        setLogoLoading(true)
                        try {
                          const res = await fetch('/api/v2/school/logo', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoBase64: '' }) })
                          const data = await res.json()
                          if (data.success) { setLogoPreview(null); onLogoUpdate?.(''); onToast('Logo supprimé', 'success') }
                          else throw new Error(data.message)
                        } catch (err: any) { onToast(err.message || 'Erreur', 'error') }
                        finally { setLogoLoading(false) }
                      }}>
                      🗑️ Supprimer
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#a89478', marginTop: 6 }}>PNG, JPG, SVG · max 1.5 MB · Recommandé : 256×256 px</div>
              </div>
            </div>
          </div>

          {/* Identité */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={cardHeader}>
              <span style={cardTitle}>🏫 Identité de l&apos;établissement</span>
            </div>
            <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {[
                { label: 'Nom de l\'établissement', val: schoolName, set: setSchoolName },
                { label: 'Type d\'établissement',   val: schoolType, set: setSchoolType },
                { label: 'Ville',                    val: schoolCity, set: setSchoolCity },
                { label: 'Téléphone',                val: schoolPhone, set: setSchoolPhone },
              ].map((f, i) => (
                <div key={i}>
                  <div style={fieldLabel}>{f.label}</div>
                  <input
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                    style={fieldInput}
                    onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#059669'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                    onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d4c8b8'; (e.currentTarget as HTMLElement).style.background = '#f0ebe3' }}
                  />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={fieldLabel}>Email administrateur</div>
                <input
                  value={schoolEmail}
                  onChange={e => setSchoolEmail(e.target.value)}
                  style={fieldInput}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#059669'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d4c8b8'; (e.currentTarget as HTMLElement).style.background = '#f0ebe3' }}
                />
              </div>
            </div>
            <div style={{ padding: '16px 26px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={btnPrim} onClick={async () => {
                try {
                  const res = await fetch('/api/v2/school/profile', {
                    method: 'PATCH', credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: schoolName, city: schoolCity, phone: schoolPhone, email: schoolEmail }),
                  })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.message || 'Erreur')
                  onToast('Profil sauvegardé avec succès', 'success')
                } catch (err: any) {
                  onToast(err.message || 'Erreur lors de la sauvegarde', 'error')
                }
              }}>💾 Enregistrer les modifications</button>
            </div>
          </div>

          {/* Sous-domaine */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>🌐 Sous-domaine EduNexus</span></div>
            <div style={{ padding: '22px 26px' }}>
              <div style={fieldLabel}>Sous-domaine</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <input
                  defaultValue="lycee-du-succes"
                  style={{ ...fieldInput, flex: 1 }}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = '#059669'; (e.currentTarget as HTMLElement).style.background = 'white' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = '#d4c8b8'; (e.currentTarget as HTMLElement).style.background = '#f0ebe3' }}
                />
                <span style={{ fontSize: 17, color: '#a89478', fontWeight: 600, whiteSpace: 'nowrap' }}>.edunexus.cm</span>
              </div>
              <div style={{ fontSize: 14, color: '#a89478', marginTop: 8, fontWeight: 500 }}>
                URL actuelle : <strong style={{ color: '#059669' }}>lycee-du-succes.edunexus.cm</strong>
              </div>
            </div>
            <div style={{ padding: '16px 26px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={btnPrim} onClick={() => onToast('Sous-domaine mis à jour', 'success')}>Mettre à jour</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: NOTIFICATIONS ── */}
      {activeTab === 1 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={cardHeader}><span style={cardTitle}>🔔 Préférences de notifications</span></div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {NOTIF_SETTINGS.map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', borderBottom: i < NOTIF_SETTINGS.length - 1 ? '1px solid #faf7f2' : 'none' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1209' }}>{n.label}</div>
                  <div style={{ fontSize: 14, color: '#a89478', marginTop: 3 }}>{n.sub}</div>
                </div>
                {/* Toggle */}
                <div
                  onClick={() => setNotifs(prev => { const next = [...prev]; next[i] = !next[i]; return next })}
                  style={{ width: 50, height: 28, borderRadius: 14, background: notifs[i] ? '#059669' : '#d4c8b8', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 3, left: notifs[i] ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px 26px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnPrim} onClick={() => onToast('Préférences notifications sauvegardées', 'success')}>💾 Enregistrer</button>
          </div>
        </div>
      )}

      {/* ── TAB: SÉCURITÉ ── */}
      {activeTab === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>🔑 Politique de mot de passe</span></div>
            <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Longueur minimale', val: '8 caractères' },
                { label: 'Expiration', val: '90 jours' },
                { label: 'Tentatives avant blocage', val: '5 tentatives' },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < 2 ? '1px solid #faf7f2' : 'none' }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1209' }}>{f.label}</div>
                  <div style={{ fontSize: 16, color: '#6b5c45', fontWeight: 600 }}>{f.val}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '16px 26px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={btnSec} onClick={() => onToast('Configuration sécurité', 'info')}>⚙️ Modifier la politique</button>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>🛡️ Journaux d&apos;audit</span></div>
            <div style={{ padding: '22px 26px' }}>
              <div style={{ fontSize: 17, color: '#6b5c45', marginBottom: 16, lineHeight: 1.7 }}>
                Consultez les dernières connexions et modifications importantes effectuées dans votre établissement.
              </div>
              <button style={btnSec} onClick={() => onToast('Journaux ouverts', 'info')}>📋 Voir les journaux d&apos;audit</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: PÉDAGOGIE ── */}
      {activeTab === 3 && (
        <>
          {pedLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div style={{ width: 36, height: 36, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
            </div>
          )}
          {!pedLoading && pedSettings && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              {/* Règles académiques */}
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <div style={cardHeader}><span style={cardTitle}>📚 Règles académiques</span></div>
                <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div>
                    <div style={fieldLabel}>Moyenne de passage (/20)</div>
                    <input type="number" min="0" max="20" step="0.5" style={fieldInput} value={pedSettings.passMark}
                      onChange={e => setPedSettings(s => s ? { ...s, passMark: parseFloat(e.target.value) || 0 } : s)} />
                  </div>
                  <div>
                    <div style={fieldLabel}>Moyenne conseil (/20)</div>
                    <input type="number" min="0" max="20" step="0.5" style={fieldInput} value={pedSettings.councilPassMark}
                      onChange={e => setPedSettings(s => s ? { ...s, councilPassMark: parseFloat(e.target.value) || 0 } : s)} />
                  </div>
                  <div>
                    <div style={fieldLabel}>Notes par trimestre</div>
                    <div style={{ padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 11, color: '#a89478', fontSize: 16, fontWeight: 600 }}>{pedSettings.gradesPerTerm}</div>
                  </div>
                  <div>
                    <div style={fieldLabel}>Trimestres par an</div>
                    <div style={{ padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 11, color: '#a89478', fontSize: 16, fontWeight: 600 }}>{pedSettings.termsPerYear}</div>
                  </div>
                  <div>
                    <div style={fieldLabel}>Calendrier académique</div>
                    <select style={fieldSelect} value={pedSettings.academicCalendarType}
                      onChange={e => setPedSettings(s => s ? { ...s, academicCalendarType: e.target.value } : s)}>
                      <option value="trimester">Trimestres</option>
                      <option value="semester">Semestres</option>
                    </select>
                  </div>
                  <div>
                    <div style={fieldLabel}>Régime linguistique</div>
                    <select style={fieldSelect} value={pedSettings.schoolLanguageMode}
                      onChange={e => setPedSettings(s => s ? { ...s, schoolLanguageMode: e.target.value } : s)}>
                      <option value="francophone">Francophone</option>
                      <option value="anglophone">Anglophone</option>
                      <option value="bilingual">Bilingue</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Présences */}
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <div style={cardHeader}><span style={cardTitle}>👥 Gestion des présences</span></div>
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <div style={fieldLabel}>Absences max. autorisées</div>
                    <input type="number" min="0" style={{ ...fieldInput, maxWidth: 200 }} value={pedSettings.maxAbsences}
                      onChange={e => setPedSettings(s => s ? { ...s, maxAbsences: parseInt(e.target.value) || 0 } : s)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 50, height: 28, borderRadius: 14, background: pedSettings.attendanceLateAsAbsence ? '#059669' : '#d4c8b8', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                      onClick={() => setPedSettings(s => s ? { ...s, attendanceLateAsAbsence: !s.attendanceLateAsAbsence } : s)}>
                      <div style={{ position: 'absolute', top: 3, left: pedSettings.attendanceLateAsAbsence ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1209' }}>Retard = Absence</div>
                      <div style={{ fontSize: 14, color: '#a89478' }}>Compter les retards comme des absences</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contributions financières */}
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <div style={cardHeader}><span style={cardTitle}>💰 Contributions financières</span></div>
                <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div>
                    <div style={fieldLabel}>Plafond 1er cycle (FCFA)</div>
                    <input type="number" min="0" style={fieldInput} value={pedSettings.legalMaxContributionFirstCycle}
                      onChange={e => setPedSettings(s => s ? { ...s, legalMaxContributionFirstCycle: parseInt(e.target.value) || 0 } : s)} />
                  </div>
                  <div>
                    <div style={fieldLabel}>Plafond 2nd cycle (FCFA)</div>
                    <input type="number" min="0" style={fieldInput} value={pedSettings.legalMaxContributionSecondCycle}
                      onChange={e => setPedSettings(s => s ? { ...s, legalMaxContributionSecondCycle: parseInt(e.target.value) || 0 } : s)} />
                  </div>
                </div>
                <div style={{ padding: '0 26px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 50, height: 28, borderRadius: 14, background: pedSettings.bulletinBlockOnUnpaidFees ? '#059669' : '#d4c8b8', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                    onClick={() => setPedSettings(s => s ? { ...s, bulletinBlockOnUnpaidFees: !s.bulletinBlockOnUnpaidFees } : s)}>
                    <div style={{ position: 'absolute', top: 3, left: pedSettings.bulletinBlockOnUnpaidFees ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1209' }}>Bloquer bulletins si impayés</div>
                    <div style={{ fontSize: 14, color: '#a89478' }}>Empêcher la génération des bulletins si des frais sont dus</div>
                  </div>
                </div>
              </div>

              {/* Fonctionnalités */}
              <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                <div style={cardHeader}><span style={cardTitle}>⚡ Fonctionnalités</span></div>
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { key: 'smsEnabled', label: 'SMS', sub: 'Notifications par SMS aux parents' },
                    { key: 'offlineModeEnabled', label: 'Mode hors-ligne', sub: 'Permettre la saisie sans connexion' },
                    { key: 'aiAlertsEnabled', label: 'Alertes IA', sub: 'Détection automatique des anomalies de notes' },
                    { key: 'messageModeration', label: 'Modération messages', sub: 'Valider les messages avant envoi' },
                  ].map(({ key, label, sub }) => {
                    const on = pedSettings[key as keyof typeof pedSettings] as boolean
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #faf7f2' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1209' }}>{label}</div>
                          <div style={{ fontSize: 14, color: '#a89478', marginTop: 3 }}>{sub}</div>
                        </div>
                        <div style={{ width: 50, height: 28, borderRadius: 14, background: on ? '#059669' : '#d4c8b8', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                          onClick={() => setPedSettings(s => s ? { ...s, [key]: !on } : s)}>
                          <div style={{ position: 'absolute', top: 3, left: on ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Save button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button style={{ ...btnPrim, opacity: pedSaving ? 0.7 : 1 }} disabled={pedSaving}
                  onClick={async () => {
                    if (!pedSettings) return
                    setPedSaving(true)
                    try {
                      const res = await fetch('/api/v2/school-settings', {
                        method: 'PUT', credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          passMark: pedSettings.passMark,
                          councilPassMark: pedSettings.councilPassMark,
                          maxAbsences: pedSettings.maxAbsences,
                          attendanceLateAsAbsence: pedSettings.attendanceLateAsAbsence,
                          legalMaxContributionFirstCycle: pedSettings.legalMaxContributionFirstCycle,
                          legalMaxContributionSecondCycle: pedSettings.legalMaxContributionSecondCycle,
                          bulletinBlockOnUnpaidFees: pedSettings.bulletinBlockOnUnpaidFees,
                          schoolLanguageMode: pedSettings.schoolLanguageMode,
                          academicCalendarType: pedSettings.academicCalendarType,
                          smsEnabled: pedSettings.smsEnabled,
                          offlineModeEnabled: pedSettings.offlineModeEnabled,
                          aiAlertsEnabled: pedSettings.aiAlertsEnabled,
                          messageModeration: pedSettings.messageModeration,
                        }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.message || 'Erreur')
                      onToast('Paramètres pédagogiques sauvegardés', 'success')
                    } catch (err: any) {
                      onToast(err.message || 'Erreur', 'error')
                    } finally { setPedSaving(false) }
                  }}>
                  {pedSaving ? '⏳ Enregistrement…' : '💾 Enregistrer les modifications'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB: PRÉFÉRENCES ── */}
      {activeTab === 4 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={cardHeader}><span style={cardTitle}>⚙️ Préférences système</span></div>
          <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {[
              { label: 'Langue', opts: ['Français', 'English', 'Français/English (Bilingue)'] },
              { label: 'Fuseau horaire', opts: ['Africa/Douala (UTC+1)', 'Africa/Lagos (UTC+1)', 'Europe/Paris (UTC+2)'] },
              { label: 'Format de date', opts: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
              { label: 'Système de notation', opts: ['/20 (MINESEC)', '/100', 'Lettres A–F'] },
            ].map((f, i) => (
              <div key={i}>
                <div style={fieldLabel}>{f.label}</div>
                <select style={fieldSelect}>
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px 26px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnPrim} onClick={() => onToast('Préférences enregistrées', 'success')}>💾 Enregistrer</button>
          </div>
        </div>
      )}

      {/* ── TAB: ACTIVITÉS ── */}
      {activeTab === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              placeholder="Rechercher par action ou description…"
              value={actSearchInput}
              onChange={e => setActSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setActSearch(actSearchInput); setActPage(1) } }}
              style={{ flex: 1, padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 11, color: '#1a1209', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = 'white' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#d4c8b8'; e.currentTarget.style.background = '#f0ebe3' }}
            />
            <button style={btnSec} onClick={() => { setActSearch(actSearchInput); setActPage(1) }}>🔍 Rechercher</button>
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={cardHeader}>
              <span style={cardTitle}>📋 Journal d&apos;activités</span>
              {actData && <span style={{ fontSize: 14, color: '#a89478' }}>{actData.total} entrée{actData.total !== 1 ? 's' : ''}</span>}
            </div>

            {actLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
              </div>
            )}
            {!actLoading && actData && actData.logs.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>Aucune activité enregistrée</div>
            )}
            {!actLoading && actData && actData.logs.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Date', 'Action', 'Description', 'Utilisateur'].map(h => <th key={h} style={thLog}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {actData.logs.map((log, i) => (
                      <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : '#fdfaf6' }}>
                        <td style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                        <td style={tdLog}><span style={{ fontWeight: 700, color: '#1a1209' }}>{log.action}</span></td>
                        <td style={{ ...tdLog, maxWidth: 320, wordBreak: 'break-word' }}>{log.description}</td>
                        <td style={{ ...tdLog, whiteSpace: 'nowrap' }}>
                          {log.user ? (`${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`).trim() || '—' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {actData && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 14, color: '#a89478' }}>Page {actData.page} / {actData.pages}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...btnSec, opacity: actData.page <= 1 ? 0.45 : 1 }} disabled={actData.page <= 1} onClick={() => setActPage(p => p - 1)}>← Précédent</button>
                  <button style={{ ...btnSec, opacity: actData.page >= actData.pages ? 0.45 : 1 }} disabled={actData.page >= actData.pages} onClick={() => setActPage(p => p + 1)}>Suivant →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: EMAILS ── */}
      {activeTab === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input
              placeholder="Rechercher par destinataire ou sujet…"
              value={emlSearchInput}
              onChange={e => setEmlSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setEmlSearch(emlSearchInput); setEmlPage(1) } }}
              style={{ flex: 1, minWidth: 200, padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 11, color: '#1a1209', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.background = 'white' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#d4c8b8'; e.currentTarget.style.background = '#f0ebe3' }}
            />
            <select
              value={emlStatus}
              onChange={e => { setEmlStatus(e.target.value); setEmlPage(1) }}
              style={{ padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 11, color: '#1a1209', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
              <option value="">Tous les statuts</option>
              <option value="SENT">Envoyé</option>
              <option value="FAILED">Échec</option>
              <option value="PENDING">En attente</option>
            </select>
            <button style={btnSec} onClick={() => { setEmlSearch(emlSearchInput); setEmlPage(1) }}>🔍 Rechercher</button>
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={cardHeader}>
              <span style={cardTitle}>📧 Journal des emails</span>
              {emlData && <span style={{ fontSize: 14, color: '#a89478' }}>{emlData.pagination.total} email{emlData.pagination.total !== 1 ? 's' : ''}</span>}
            </div>

            {emlLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
              </div>
            )}
            {!emlLoading && emlData && emlData.logs.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>Aucun email enregistré</div>
            )}
            {!emlLoading && emlData && emlData.logs.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Date', 'Destinataire', 'Sujet', 'Statut'].map(h => <th key={h} style={thLog}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {emlData.logs.map((log, i) => {
                      const s = (log.status ?? '').toLowerCase()
                      const badge = s.includes('sent') || s.includes('envoy')
                        ? { bg: 'rgba(5,150,105,0.12)', color: '#047857' }
                        : s.includes('fail') || s.includes('chec')
                          ? { bg: 'rgba(220,38,38,0.12)', color: '#dc2626' }
                          : s.includes('pend') || s.includes('attente')
                            ? { bg: 'rgba(217,119,6,0.12)', color: '#b45309' }
                            : { bg: '#f0ebe3', color: '#a89478' }
                      return (
                        <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : '#fdfaf6' }}>
                          <td style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                          <td style={{ ...tdLog, maxWidth: 200, wordBreak: 'break-word' }}>{log.to}</td>
                          <td style={{ ...tdLog, maxWidth: 280, wordBreak: 'break-word' }}>{log.subject}</td>
                          <td style={tdLog}>
                            <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: badge.bg, color: badge.color }}>
                              {log.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {emlData && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 14, color: '#a89478' }}>Page {emlData.pagination.page} / {emlData.pagination.pages}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...btnSec, opacity: emlData.pagination.page <= 1 ? 0.45 : 1 }} disabled={emlData.pagination.page <= 1} onClick={() => setEmlPage(p => p - 1)}>← Précédent</button>
                  <button style={{ ...btnSec, opacity: emlData.pagination.page >= emlData.pagination.pages ? 0.45 : 1 }} disabled={emlData.pagination.page >= emlData.pagination.pages} onClick={() => setEmlPage(p => p + 1)}>Suivant →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const cardHeader: React.CSSProperties = { padding: '16px 26px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const cardTitle: React.CSSProperties = { fontSize: 17, fontWeight: 800, color: '#1a1209' }
const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#6b5c45', marginBottom: 7, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }
const fieldInput: React.CSSProperties = { width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 11, color: '#1a1209', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s' }
const fieldSelect: React.CSSProperties = { width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 11, color: '#1a1209', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }
const thLog: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', background: '#f0ebe3', border: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdLog: React.CSSProperties = { padding: '10px 14px', fontSize: 14, color: '#6b5c45', border: '1px solid #f0ebe3', verticalAlign: 'top' }

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}
