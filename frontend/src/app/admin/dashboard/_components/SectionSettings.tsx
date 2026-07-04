'use client'
import { useState, useEffect, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface SchoolInfo { id?: string; name: string; logoUrl: string | null; subdomain?: string; city?: string; phone?: string; email?: string }
interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  schoolInfo?: SchoolInfo | null
  onLogoUpdate?: (url: string) => void
}
interface ActivityLog { id: string; createdAt: string; action: string; description: string; user?: { firstName?: string; lastName?: string } | null }
interface EmailLog { id: string; createdAt: string; to: string; subject: string; status: string }
interface AuditLog  { id: string; createdAt: string; action: string; description: string | null; user: { id: string; firstName: string; lastName: string } | null }
interface BackupInfo { lastBackupAt: string | null; lastBackupFile: string | null; latestFileExists?: boolean }
interface NotifSettings { smsAbsences: boolean; smsPayments: boolean; smsBulletins: boolean; emailDigestAdmin: boolean; smsLowBalance: boolean }
interface SecSettings   { passwordMinLength: number; passwordRequireUpper: boolean; passwordRequireDigit: boolean; sessionTimeoutMin: number }

export default function SectionSettings({ onToast, schoolInfo, onLogoUpdate }: Props) {
  const t = useT('admin')
  const [activeTab, setActiveTab] = useState(0)

  const TABS = [
    t('settings.tabs.0'), t('settings.tabs.1'), t('settings.tabs.2'),
    t('settings.tabs.3'), t('settings.tabs.4'), t('settings.tabs.5'),
    t('settings.tabs.6'), t('settings.tabs.7'),
  ]

  const NOTIF_ROWS: Array<{ key: keyof NotifSettings; icon: string; label: string; sub: string }> = [
    { key: 'smsAbsences',      icon: '📱', label: t('settings.notifications.rows.0.label'), sub: t('settings.notifications.rows.0.sub') },
    { key: 'smsPayments',      icon: '📱', label: t('settings.notifications.rows.1.label'), sub: t('settings.notifications.rows.1.sub') },
    { key: 'smsBulletins',     icon: '📱', label: t('settings.notifications.rows.2.label'), sub: t('settings.notifications.rows.2.sub') },
    { key: 'emailDigestAdmin', icon: '📧', label: t('settings.notifications.rows.3.label'), sub: t('settings.notifications.rows.3.sub') },
    { key: 'smsLowBalance',    icon: '📱', label: t('settings.notifications.rows.4.label'), sub: t('settings.notifications.rows.4.sub') },
  ]

  const SESSION_OPTIONS = [
    { value: 15, label: t('settings.security.session_options.0.label') },
    { value: 30, label: t('settings.security.session_options.1.label') },
    { value: 60, label: t('settings.security.session_options.2.label') },
    { value: 120, label: t('settings.security.session_options.3.label') },
    { value: 240, label: t('settings.security.session_options.4.label') },
    { value: 480, label: t('settings.security.session_options.5.label') },
  ]

  // ── Profil ──────────────────────────────────────────────────────────────
  const [schoolName, setSchoolName] = useState('')
  const [schoolType, setSchoolType] = useState('')
  const [schoolCity, setSchoolCity] = useState('')
  const [schoolPhone, setSchoolPhone] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoLoading, setLogoLoading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // ── Sous-domaine ────────────────────────────────────────────────────────
  const [subdomainInput, setSubdomainInput]   = useState('')
  const [subdomainAvail, setSubdomainAvail]   = useState<'checking' | 'available' | 'taken' | null>(null)
  const [subdomainSaving, setSubdomainSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Notifications ───────────────────────────────────────────────────────
  const [notifData, setNotifData]     = useState<NotifSettings | null>(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifSaving, setNotifSaving] = useState<keyof NotifSettings | null>(null)

  // ── Sécurité ────────────────────────────────────────────────────────────
  const [secSettings, setSecSettings] = useState<SecSettings | null>(null)
  const [secLoading, setSecLoading]   = useState(false)
  const [secModal, setSecModal]       = useState(false)
  const [secEdit, setSecEdit]         = useState<SecSettings>({ passwordMinLength: 8, passwordRequireUpper: false, passwordRequireDigit: true, sessionTimeoutMin: 60 })
  const [secSaving, setSecSaving]     = useState(false)

  // ── Audit logs ──────────────────────────────────────────────────────────
  const [auditOpen, setAuditOpen]   = useState(false)
  const [auditLogs, setAuditLogs]   = useState<AuditLog[]>([])
  const [auditPage, setAuditPage]   = useState(1)
  const [auditPages, setAuditPages] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditLoad, setAuditLoad]   = useState(false)
  const [auditAction, setAuditAction]   = useState('')
  const [auditActInput, setAuditActInput] = useState('')
  const [auditFrom, setAuditFrom]   = useState('')
  const [auditTo, setAuditTo]       = useState('')

  // ── Pédagogie ───────────────────────────────────────────────────────────
  const [pedSettings, setPedSettings] = useState<{
    passMark: number; councilPassMark: number; gradesPerTerm: number; termsPerYear: number
    maxAbsences: number; attendanceLateAsAbsence: boolean
    legalMaxContributionFirstCycle: number; legalMaxContributionSecondCycle: number
    bulletinBlockOnUnpaidFees: boolean
    schoolLanguageMode: string; academicCalendarType: string; cycles: string[]
    smsEnabled: boolean; offlineModeEnabled: boolean; aiAlertsEnabled: boolean; messageModeration: boolean
  } | null>(null)
  const [pedLoading, setPedLoading] = useState(false)
  const [pedSaving, setPedSaving]   = useState(false)

  // ── Activity logs ────────────────────────────────────────────────────────
  const [actPage, setActPage]               = useState(1)
  const [actSearchInput, setActSearchInput] = useState('')
  const [actSearch, setActSearch]           = useState('')
  const [actData, setActData]               = useState<{ logs: ActivityLog[]; page: number; pages: number; total: number } | null>(null)
  const [actLoading, setActLoading]         = useState(false)

  // ── Structure ────────────────────────────────────────────────────────────
  const [structConfig, setStructConfig] = useState<{
    niveaux1erCycle: string[]; classesParNiveau: Record<string, number>
    niveauxPrimaire: string[]; classesParNiveauPrimaire: Record<string, number>
  } | null>(null)
  const [structEdit, setStructEdit]   = useState<Record<string, number>>({})
  const [structSaving, setStructSaving] = useState(false)
  const [structResult, setStructResult] = useState<string[] | null>(null)
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const [backupLoading, setBackupLoading] = useState(false)
  const [logRetentionDays, setLogRetentionDays] = useState<number>(90)
  const [logRetentionLoading, setLogRetentionLoading] = useState(false)
  const [logRetentionSaving, setLogRetentionSaving] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  // ── Email logs ────────────────────────────────────────────────────────────
  const [emlPage, setEmlPage]               = useState(1)
  const [emlSearchInput, setEmlSearchInput] = useState('')
  const [emlSearch, setEmlSearch]           = useState('')
  const [emlStatus, setEmlStatus]           = useState('')
  const [emlData, setEmlData]               = useState<{ logs: EmailLog[]; pagination: { total: number; page: number; pages: number; limit: number } } | null>(null)
  const [emlLoading, setEmlLoading]         = useState(false)

  // ── Structure load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 7 || structConfig !== null || !schoolInfo?.id) return
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const cfg = d.data?.onboardingConfig
        if (!cfg) return
        const parsed = {
          niveaux1erCycle: cfg.niveaux1erCycle ?? [],
          classesParNiveau: cfg.classesParNiveau ?? {},
          niveauxPrimaire: cfg.niveauxPrimaire ?? [],
          classesParNiveauPrimaire: cfg.classesParNiveauPrimaire ?? {},
        }
        setStructConfig(parsed)
        setStructEdit({ ...parsed.classesParNiveau, ...parsed.classesParNiveauPrimaire })
      })
      .catch(() => onToast('Erreur chargement structure', 'error'))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 7 || backupInfo !== null || !schoolInfo?.id) return
    setBackupLoading(true)
    fetchApi('/api/v2/school/last-backup', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setBackupInfo(d.data) })
      .catch(() => onToast('Erreur chargement dernière sauvegarde', 'error'))
      .finally(() => setBackupLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTab !== 7 || logRetentionLoading || !schoolInfo?.id) return
    setLogRetentionLoading(true)
    fetchApi('/api/v2/school-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setLogRetentionDays(Number(d.data?.logRetentionDays ?? 90))
        }
      })
      .catch(() => onToast('Erreur chargement rétention des logs', 'error'))
      .finally(() => setLogRetentionLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStructSave = async () => {
    if (!schoolInfo?.id || !structConfig) return
    setStructSaving(true); setStructResult(null)
    try {
      const classesParNiveau: Record<string, number> = {}
      const classesParNiveauPrimaire: Record<string, number> = {}
      for (const n of structConfig.niveaux1erCycle) {
        const v = structEdit[n]
        if (v !== undefined) classesParNiveau[n] = Math.max(1, Math.min(26, v))
      }
      for (const n of structConfig.niveauxPrimaire) {
        const v = structEdit[n]
        if (v !== undefined) classesParNiveauPrimaire[n] = Math.max(1, Math.min(26, v))
      }
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/structure`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classesParNiveau, classesParNiveauPrimaire }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message ?? 'Erreur serveur')
      setStructResult(d.data?.classesCreated ?? [])
      setStructConfig(null) // forcer rechargement
      onToast(d.message, 'success')
    } catch (e) {
      onToast(String(e), 'error')
    } finally {
      setStructSaving(false)
    }
  }

  const handleLogRetentionSave = async () => {
    if (!schoolInfo?.id) return
    setLogRetentionSaving(true)
    try {
      const res = await fetchApi('/api/v2/school-settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logRetentionDays }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(t('settings.structure.toast_retention_saved'), 'success')
    } catch (e) {
      onToast(String(e), 'error')
    } finally {
      setLogRetentionSaving(false)
    }
  }

  const handleRgpdExport = async () => {
    if (!schoolInfo?.id) return
    setExportLoading(true)
    try {
      const res = await fetchApi('/api/v2/school/export', { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Erreur export RGPD')
      }
      const blob = await res.blob()
      const contentDisposition = res.headers.get('content-disposition') || ''
      const match = contentDisposition.match(/filename="?([^";]+)"?/i)
      const fileName = match?.[1] ?? 'edunexus-rgpd.json'
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      onToast(t('settings.structure.toast_exported'), 'success')
    } catch (e) {
      onToast(String(e), 'error')
    } finally {
      setExportLoading(false)
    }
  }

  // ── Init profil from schoolInfo ─────────────────────────────────────────
  useEffect(() => {
    if (!schoolInfo) return
    setSchoolName(schoolInfo.name || '')
    setSchoolCity(schoolInfo.city || '')
    setSchoolPhone(schoolInfo.phone || '')
    setSchoolEmail(schoolInfo.email || '')
    setLogoPreview(schoolInfo.logoUrl || null)
    setSubdomainInput(schoolInfo.subdomain || '')
  }, [schoolInfo])

  // ── Subdomain availability check (debounced 500ms) ─────────────────────
  useEffect(() => {
    const val = subdomainInput.trim()
    if (!val || val === schoolInfo?.subdomain) { setSubdomainAvail(null); return }
    if (!/^[a-z0-9-]+$/.test(val) || val.length < 3 || val.length > 30) { setSubdomainAvail(null); return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSubdomainAvail('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetchApi(`/api/v2/schools/check-subdomain?value=${encodeURIComponent(val)}`, { credentials: 'include' })
        const d = await r.json()
        setSubdomainAvail(d.available ? 'available' : 'taken')
      } catch { setSubdomainAvail(null) }
    }, 500)
  }, [subdomainInput, schoolInfo?.subdomain])

  // ── Notifications load ──────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 1 || notifData !== null || !schoolInfo?.id) return
    setNotifLoading(true)
    fetchApi(`/api/v2/schools/${schoolInfo.id}/notification-settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setNotifData(d.data) })
      .catch(() => onToast('Erreur chargement notifications', 'error'))
      .finally(() => setNotifLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Security settings load ──────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 2 || secSettings !== null || !schoolInfo?.id) return
    setSecLoading(true)
    fetchApi(`/api/v2/schools/${schoolInfo.id}/security-settings`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setSecSettings(d.data); setSecEdit(d.data) } })
      .catch(() => onToast('Erreur chargement sécurité', 'error'))
      .finally(() => setSecLoading(false))
  }, [activeTab, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audit logs load ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!auditOpen || !schoolInfo?.id) return
    setAuditLoad(true)
    const params = new URLSearchParams({ page: String(auditPage), limit: '20' })
    if (auditAction) params.set('action', auditAction)
    if (auditFrom)   params.set('from',   auditFrom)
    if (auditTo)     params.set('to',     auditTo)
    fetchApi(`/api/v2/schools/${schoolInfo.id}/audit-logs?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) { setAuditLogs(d.logs); setAuditPage(d.page); setAuditPages(d.pages); setAuditTotal(d.total) } })
      .catch(() => onToast('Erreur chargement journaux', 'error'))
      .finally(() => setAuditLoad(false))
  }, [auditOpen, auditPage, auditAction, auditFrom, auditTo, schoolInfo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pédagogie load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 3 || pedSettings) return
    setPedLoading(true)
    fetchApi('/api/v2/school-settings', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setPedSettings(d.data) })
      .catch(() => onToast('Erreur chargement paramètres', 'error'))
      .finally(() => setPedLoading(false))
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Activity logs load ───────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 5) return
    setActLoading(true)
    const params = new URLSearchParams({ page: String(actPage), limit: '10' })
    if (actSearch) params.set('search', actSearch)
    fetchApi(`/api/v2/activities?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setActData({ logs: d.logs ?? [], page: d.page ?? 1, pages: d.pages ?? 1, total: d.total ?? 0 }))
      .catch(() => onToast('Erreur chargement activités', 'error'))
      .finally(() => setActLoading(false))
  }, [activeTab, actPage, actSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Email logs load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 6) return
    setEmlLoading(true)
    const params = new URLSearchParams({ page: String(emlPage), limit: '15' })
    if (emlSearch) params.set('search', emlSearch)
    if (emlStatus) params.set('status', emlStatus)
    fetchApi(`/api/v2/email-logs?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setEmlData({ logs: d.logs ?? [], pagination: d.pagination ?? { total: 0, page: 1, pages: 1, limit: 15 } }))
      .catch(() => onToast('Erreur chargement emails', 'error'))
      .finally(() => setEmlLoading(false))
  }, [activeTab, emlPage, emlSearch, emlStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) { onToast(t('settings.profile.logo_too_large'), 'error'); return }
    const reader = new FileReader()
    reader.onload = async () => {
      const logoBase64 = reader.result as string
      setLogoPreview(logoBase64)
      setLogoLoading(true)
      try {
        const res = await fetchApi('/api/v2/school/logo', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoBase64 }) })
        const data = await res.json()
        if (!data.success) throw new Error(data.message || 'Erreur')
        onLogoUpdate?.(logoBase64)
        onToast(t('settings.profile.toast_updated'), 'success')
      } catch (err: any) {
        onToast(err.message || 'Erreur', 'error')
        setLogoPreview(schoolInfo?.logoUrl ?? null)
      } finally { setLogoLoading(false) }
    }
    reader.readAsDataURL(file)
  }

  async function handleSubdomainSave() {
    const val = subdomainInput.trim()
    if (!val || !schoolInfo?.id) return
    if (!/^[a-z0-9-]+$/.test(val)) { onToast(t('settings.profile.invalid_format'), 'error'); return }
    if (val.length < 3) { onToast(t('settings.profile.too_short'), 'error'); return }
    setSubdomainSaving(true)
    try {
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/subdomain`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSubdomain: val }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('settings.profile.toast_updated'), 'success')
      setSubdomainAvail(null)
    } catch (err: any) {
      onToast(err.message || 'Erreur', 'error')
    } finally { setSubdomainSaving(false) }
  }

  async function handleNotifToggle(key: keyof NotifSettings) {
    if (!notifData || !schoolInfo?.id || notifSaving) return
    const prev = notifData[key]
    const next = { ...notifData, [key]: !prev }
    setNotifData(next)
    setNotifSaving(key)
    try {
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/notification-settings`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: !prev }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('settings.notifications.toast_saved'), 'success')
    } catch (err: any) {
      setNotifData(notifData)
      onToast(err.message || 'Erreur', 'error')
    } finally { setNotifSaving(null) }
  }

  async function handleSecSave() {
    if (!schoolInfo?.id) return
    setSecSaving(true)
    try {
      const res = await fetchApi(`/api/v2/schools/${schoolInfo.id}/security-settings`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(secEdit),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setSecSettings(data.data)
      setSecModal(false)
      onToast(t('settings.security.toast_updated'), 'success')
    } catch (err: any) {
      onToast(err.message || 'Erreur', 'error')
    } finally { setSecSaving(false) }
  }

  const subdomainChanged = subdomainInput.trim() !== (schoolInfo?.subdomain ?? '')
  const subdomainValid   = /^[a-z0-9-]+$/.test(subdomainInput.trim()) && subdomainInput.trim().length >= 3

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-settings-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>{t('settings.title')}</div>
          <div style={sSub}>{t('settings.subtitle')}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg2)', padding: 5, borderRadius: 12, marginBottom: 24, width: 'fit-content' }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '8px 20px', borderRadius: 9, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: activeTab === i ? 'white' : 'transparent', color: activeTab === i ? 'var(--text)' : 'var(--text3)', boxShadow: activeTab === i ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB 0: PROFIL ── */}
      {activeTab === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Logo */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>{t('settings.profile.logo_section')}</span></div>
            <div style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 24 }}>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
              <div onClick={() => !logoLoading && logoInputRef.current?.click()}
                style={{ width: 88, height: 88, borderRadius: 16, border: `2px dashed ${logoPreview ? 'var(--green)' : 'var(--border2)'}`, background: logoPreview ? 'transparent' : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: logoLoading ? 'wait' : 'pointer', overflow: 'hidden', flexShrink: 0, transition: 'all 0.15s', position: 'relative' }}>
                {logoLoading && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    <div style={{ width: 22, height: 22, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
                  </div>
                )}
                {logoPreview ? <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 36 }}>🏫</span>}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                  {logoPreview ? t('settings.profile.current_logo') : t('settings.profile.no_logo')}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 10, lineHeight: 1.5 }}>
                  {t('settings.profile.logo_desc')}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnSec} onClick={() => logoInputRef.current?.click()} disabled={logoLoading}>
                    {logoPreview ? t('settings.profile.btn_change') : t('settings.profile.btn_upload')}
                  </button>
                  {logoPreview && (
                    <button style={{ ...btnSec, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.3)' }} disabled={logoLoading}
                      onClick={async () => {
                        setLogoLoading(true)
                        try {
                          const res = await fetchApi('/api/v2/school/logo', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logoBase64: '' }) })
                          const data = await res.json()
                          if (data.success) { setLogoPreview(null); onLogoUpdate?.(''); onToast(t('settings.profile.toast_deleted'), 'success') }
                          else throw new Error(data.message)
                        } catch (err: any) { onToast(err.message || 'Erreur', 'error') }
                        finally { setLogoLoading(false) }
                      }}>
                      {t('settings.profile.btn_delete')}
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{t('settings.profile.logo_hint')}</div>
              </div>
            </div>
          </div>

          {/* Identité */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>{t('settings.profile.identity_section')}</span></div>
            <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              {[
                { label: t('settings.profile.name_label'), val: schoolName, set: setSchoolName },
                { label: t('settings.profile.type_label'), val: schoolType, set: setSchoolType },
                { label: t('settings.profile.city_label'), val: schoolCity, set: setSchoolCity },
                { label: t('settings.profile.phone_label'), val: schoolPhone, set: setSchoolPhone },
              ].map((f, i) => (
                <div key={i}>
                  <div style={fieldLabel}>{f.label}</div>
                  <input value={f.val} onChange={e => f.set(e.target.value)} style={fieldInput}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }} />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={fieldLabel}>{t('settings.profile.email_label')}</div>
                <input value={schoolEmail} onChange={e => setSchoolEmail(e.target.value)} style={fieldInput}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }} />
              </div>
            </div>
            <div style={{ padding: '16px 26px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={btnPrim} onClick={async () => {
                try {
                  const res = await fetchApi('/api/v2/school/profile', { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: schoolName, city: schoolCity, phone: schoolPhone, email: schoolEmail }) })
                  const data = await res.json()
                  if (!res.ok) throw new Error(data.message || 'Erreur')
                  onToast(t('settings.profile.toast_saved'), 'success')
                } catch (err: any) { onToast(err.message || 'Erreur', 'error') }
              }}>{t('settings.profile.btn_save')}</button>
            </div>
          </div>

          {/* Sous-domaine */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>{t('settings.profile.subdomain_section')}</span></div>
            <div style={{ padding: '22px 26px' }}>
              {schoolInfo?.subdomain && (
                <div style={{ fontSize: 15, color: 'var(--text2)', marginBottom: 16, fontWeight: 500 }}>
                  {t('settings.profile.subdomain_desc')}{' '}
                  <strong style={{ color: 'var(--green)' }}>https://{schoolInfo.subdomain}.edunexus.cm</strong>
                </div>
              )}

              {/* Warning */}
              <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '11px 15px', marginBottom: 16, fontSize: 14, color: 'var(--amber)', lineHeight: 1.5 }}>
                {t('settings.profile.subdomain_warning')}
              </div>

              <div style={fieldLabel}>{t('settings.profile.subdomain_label')}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, color: 'var(--text3)', whiteSpace: 'nowrap', fontWeight: 600 }}>https://</span>
                <input
                  value={subdomainInput}
                  onChange={e => { setSubdomainInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSubdomainAvail(null) }}
                  style={{ ...fieldInput, flex: 1 }}
                  placeholder={t('settings.profile.subdomain_placeholder')}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
                />
                <span style={{ fontSize: 14, color: 'var(--text3)', whiteSpace: 'nowrap', fontWeight: 600 }}>.edunexus.cm</span>
              </div>

              <div style={{ fontSize: 13, marginBottom: 4, fontWeight: 600, minHeight: 20 }}>
                {subdomainAvail === 'checking'  && <span style={{ color: 'var(--text3)' }}>{t('settings.profile.checking')}</span>}
                {subdomainAvail === 'available' && <span style={{ color: 'var(--green)' }}>{t('settings.profile.available')}</span>}
                {subdomainAvail === 'taken'     && <span style={{ color: 'var(--red)' }}>{t('settings.profile.taken')}</span>}
                {!subdomainAvail && subdomainInput.trim() && subdomainInput.trim().length < 3 && (
                  <span style={{ color: 'var(--amber)' }}>{t('settings.profile.too_short')}</span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>{t('settings.profile.hint')}</div>
            </div>
            <div style={{ padding: '16px 26px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={{ ...btnPrim, opacity: subdomainSaving || !subdomainChanged || !subdomainValid || subdomainAvail === 'taken' || subdomainAvail === 'checking' ? 0.5 : 1 }}
                disabled={subdomainSaving || !subdomainChanged || !subdomainValid || subdomainAvail === 'taken' || subdomainAvail === 'checking'}
                onClick={handleSubdomainSave}>
                {subdomainSaving ? t('settings.profile.updating') : t('settings.profile.btn_update')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: NOTIFICATIONS ── */}
      {activeTab === 1 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={cardHeader}><span style={cardTitle}>{t('settings.notifications.title')}</span></div>

          {notifLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
            </div>
          )}

          {!notifLoading && !notifData && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
              {t('settings.notifications.load_error')}
              <button style={{ ...btnSec, marginLeft: 12 }} onClick={() => { setNotifData(null); setNotifLoading(true); fetchApi(`/api/v2/schools/${schoolInfo?.id}/notification-settings`, { credentials: 'include' }).then(r => r.json()).then(d => { if (d.success) setNotifData(d.data) }).finally(() => setNotifLoading(false)) }}>{t('settings.notifications.btn_retry')}</button>
            </div>
          )}

          {!notifLoading && notifData && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {NOTIF_ROWS.map((n, i) => {
                const on = notifData[n.key]
                const saving = notifSaving === n.key
                return (
                  <div key={n.key}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 26px', borderBottom: i < NOTIF_ROWS.length - 1 ? '1px solid var(--bg)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{n.icon} {n.label}</div>
                      <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 3 }}>{n.sub}</div>
                    </div>
                    <div onClick={() => !saving && handleNotifToggle(n.key)}
                      style={{ width: 50, height: 28, borderRadius: 14, background: on ? 'var(--green)' : 'var(--border2)', cursor: saving ? 'wait' : 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: saving ? 0.6 : 1 }}>
                      <div style={{ position: 'absolute', top: 3, left: on ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: SÉCURITÉ ── */}
      {activeTab === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Politique de mot de passe */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>{t('settings.security.password_policy')}</span></div>
            {secLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
              </div>
            )}
            {!secLoading && secSettings && (
              <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {[
                  { label: t('settings.security.min_length'),     val: t('settings.security.characters').replace('{count}', String(secSettings.passwordMinLength)) },
                  { label: t('settings.security.require_upper'), val: secSettings.passwordRequireUpper ? t('settings.security.yes') : t('settings.security.no') },
                  { label: t('settings.security.require_digit'), val: secSettings.passwordRequireDigit ? t('settings.security.yes') : t('settings.security.no') },
                  { label: t('settings.security.session_duration'), val: SESSION_OPTIONS.find(o => o.value === secSettings.sessionTimeoutMin)?.label ?? `${secSettings.sessionTimeoutMin} min` },
                ].map((f, i, arr) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: i < arr.length - 1 ? '1px solid var(--bg)' : 'none' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{f.label}</div>
                    <div style={{ fontSize: 16, color: 'var(--text2)', fontWeight: 600 }}>{f.val}</div>
                  </div>
                ))}
              </div>
            )}
            {!secLoading && !secSettings && (
              <div style={{ padding: '22px 26px', color: 'var(--text3)', fontSize: 15 }}>{t('settings.security.load_error')}</div>
            )}
            <div style={{ padding: '16px 26px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={btnSec} onClick={() => { if (secSettings) setSecEdit(secSettings); setSecModal(true) }}>{t('settings.security.btn_edit')}</button>
            </div>
          </div>

          {/* Journaux d'audit */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>{t('settings.security.audit_logs')}</span></div>
            <div style={{ padding: '22px 26px' }}>
              <div style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.7 }}>
                {t('settings.security.audit_desc')}
              </div>
              {!auditOpen && (
                <button style={btnSec} onClick={() => { setAuditOpen(true); setAuditPage(1) }}>{t('settings.security.btn_view')}</button>
              )}
            </div>

            {auditOpen && (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {/* Filters */}
                <div style={{ padding: '14px 22px', display: 'flex', gap: 10, flexWrap: 'wrap', borderBottom: '1px solid var(--bg2)' }}>
                  <input
                    placeholder={t('settings.security.filter_placeholder')}
                    value={auditActInput}
                    onChange={e => setAuditActInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { setAuditAction(auditActInput); setAuditPage(1) } }}
                    style={{ flex: 1, minWidth: 140, padding: '8px 12px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }}
                  />
                  <input type="date" value={auditFrom} onChange={e => { setAuditFrom(e.target.value); setAuditPage(1) }}
                    style={{ padding: '8px 10px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }} />
                  <input type="date" value={auditTo} onChange={e => { setAuditTo(e.target.value); setAuditPage(1) }}
                    style={{ padding: '8px 10px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 9, color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', fontWeight: 600, outline: 'none' }} />
                  <button style={btnSec} onClick={() => { setAuditAction(auditActInput); setAuditPage(1) }}>🔍</button>
                  <button style={{ ...btnSec, marginLeft: 'auto' }} onClick={() => setAuditOpen(false)}>{t('settings.security.btn_close')}</button>
                </div>

                {/* Total */}
                <div style={{ padding: '8px 22px', fontSize: 13, color: 'var(--text3)' }}>{t('settings.security.entries_count').replace('{count}', String(auditTotal))}</div>

                {auditLoad && (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
                  </div>
                )}

                {!auditLoad && auditLogs.length === 0 && (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 15 }}>{t('settings.security.no_logs')}</div>
                )}

                {!auditLoad && auditLogs.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={thLog}>{t('settings.security.table_headers.0')}</th>
                          <th style={thLog}>{t('settings.security.table_headers.1')}</th>
                          <th style={thLog}>{t('settings.security.table_headers.2')}</th>
                          <th style={thLog}>{t('settings.security.table_headers.3')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((log, i) => (
                          <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                            <td style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                            <td style={{ ...tdLog, whiteSpace: 'nowrap' }}>
                              {log.user ? `${log.user.firstName} ${log.user.lastName}` : <span style={{ color: 'var(--border2)' }}>—</span>}
                            </td>
                            <td style={tdLog}><span style={{ fontWeight: 700, color: 'var(--text)' }}>{log.action}</span></td>
                            <td style={{ ...tdLog, maxWidth: 280, wordBreak: 'break-word' }}>{log.description ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>{t('settings.security.page_info').replace('{current}', String(auditPage)).replace('{total}', String(auditPages))}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ ...btnSec, opacity: auditPage <= 1 ? 0.45 : 1 }} disabled={auditPage <= 1} onClick={() => setAuditPage(p => p - 1)}>{t('settings.security.btn_prev')}</button>
                    <button style={{ ...btnSec, opacity: auditPage >= auditPages ? 0.45 : 1 }} disabled={auditPage >= auditPages} onClick={() => setAuditPage(p => p + 1)}>{t('settings.security.btn_next')}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: PÉDAGOGIE ── */}
      {activeTab === 3 && (
        <>
          {pedLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
              <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
            </div>
          )}
          {!pedLoading && pedSettings && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                <div style={cardHeader}><span style={cardTitle}>{t('settings.pedagogy.academic_rules')}</span></div>
                <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div>
                    <div style={fieldLabel}>{t('settings.pedagogy.pass_mark')}</div>
                    <input type="number" min="0" max="20" step="0.5" style={fieldInput} value={pedSettings.passMark}
                      onChange={e => setPedSettings(s => s ? { ...s, passMark: parseFloat(e.target.value) || 0 } : s)} />
                  </div>
                  <div>
                    <div style={fieldLabel}>{t('settings.pedagogy.council_pass_mark')}</div>
                    <input type="number" min="0" max="20" step="0.5" style={fieldInput} value={pedSettings.councilPassMark}
                      onChange={e => setPedSettings(s => s ? { ...s, councilPassMark: parseFloat(e.target.value) || 0 } : s)} />
                  </div>
                  <div>
                    <div style={fieldLabel}>{t('settings.pedagogy.grades_per_term')}</div>
                    <div style={{ padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text3)', fontSize: 16, fontWeight: 600 }}>{pedSettings.gradesPerTerm}</div>
                  </div>
                  <div>
                    <div style={fieldLabel}>{t('settings.pedagogy.terms_per_year')}</div>
                    <div style={{ padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text3)', fontSize: 16, fontWeight: 600 }}>{pedSettings.termsPerYear}</div>
                  </div>
                  <div>
                    <div style={fieldLabel}>{t('settings.pedagogy.calendar_type')}</div>
                    <select style={fieldSelect} value={pedSettings.academicCalendarType}
                      onChange={e => setPedSettings(s => s ? { ...s, academicCalendarType: e.target.value } : s)}>
                      <option value="trimester">{t('settings.pedagogy.calendar_options.trimester')}</option>
                      <option value="semester">{t('settings.pedagogy.calendar_options.semester')}</option>
                    </select>
                  </div>
                  <div>
                    <div style={fieldLabel}>{t('settings.pedagogy.language_mode')}</div>
                    <select style={fieldSelect} value={pedSettings.schoolLanguageMode}
                      onChange={e => setPedSettings(s => s ? { ...s, schoolLanguageMode: e.target.value } : s)}>
                      <option value="francophone">{t('settings.pedagogy.language_options.francophone')}</option>
                      <option value="anglophone">{t('settings.pedagogy.language_options.anglophone')}</option>
                      <option value="bilingual">{t('settings.pedagogy.language_options.bilingual')}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                <div style={cardHeader}><span style={cardTitle}>{t('settings.pedagogy.attendance_section')}</span></div>
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div>
                    <div style={fieldLabel}>{t('settings.pedagogy.max_absences')}</div>
                    <input type="number" min="0" style={{ ...fieldInput, maxWidth: 200 }} value={pedSettings.maxAbsences}
                      onChange={e => setPedSettings(s => s ? { ...s, maxAbsences: parseInt(e.target.value) || 0 } : s)} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 50, height: 28, borderRadius: 14, background: pedSettings.attendanceLateAsAbsence ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                      onClick={() => setPedSettings(s => s ? { ...s, attendanceLateAsAbsence: !s.attendanceLateAsAbsence } : s)}>
                      <div style={{ position: 'absolute', top: 3, left: pedSettings.attendanceLateAsAbsence ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{t('settings.pedagogy.late_label')}</div>
                      <div style={{ fontSize: 14, color: 'var(--text3)' }}>{t('settings.pedagogy.late_sub')}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                <div style={cardHeader}><span style={cardTitle}>{t('settings.pedagogy.contributions_section')}</span></div>
                <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                  <div>
                    <div style={fieldLabel}>{t('settings.pedagogy.max_first_cycle')}</div>
                    <input type="number" min="0" style={fieldInput} value={pedSettings.legalMaxContributionFirstCycle}
                      onChange={e => setPedSettings(s => s ? { ...s, legalMaxContributionFirstCycle: parseInt(e.target.value) || 0 } : s)} />
                  </div>
                  <div>
                    <div style={fieldLabel}>{t('settings.pedagogy.max_second_cycle')}</div>
                    <input type="number" min="0" style={fieldInput} value={pedSettings.legalMaxContributionSecondCycle}
                      onChange={e => setPedSettings(s => s ? { ...s, legalMaxContributionSecondCycle: parseInt(e.target.value) || 0 } : s)} />
                  </div>
                </div>
                <div style={{ padding: '0 26px 22px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 50, height: 28, borderRadius: 14, background: pedSettings.bulletinBlockOnUnpaidFees ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                    onClick={() => setPedSettings(s => s ? { ...s, bulletinBlockOnUnpaidFees: !s.bulletinBlockOnUnpaidFees } : s)}>
                    <div style={{ position: 'absolute', top: 3, left: pedSettings.bulletinBlockOnUnpaidFees ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{t('settings.pedagogy.block_bulletin_label')}</div>
                      <div style={{ fontSize: 14, color: 'var(--text3)' }}>{t('settings.pedagogy.block_bulletin_sub')}</div>
                    </div>
                </div>
              </div>

              <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
                <div style={cardHeader}><span style={cardTitle}>{t('settings.pedagogy.features_section')}</span></div>
                <div style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { key: 'smsEnabled', label: t('settings.pedagogy.sms_label'), sub: t('settings.pedagogy.sms_sub') },
                    { key: 'offlineModeEnabled', label: t('settings.pedagogy.offline_label'), sub: t('settings.pedagogy.offline_sub') },
                    { key: 'aiAlertsEnabled', label: t('settings.pedagogy.ai_label'), sub: t('settings.pedagogy.ai_sub') },
                    { key: 'messageModeration', label: t('settings.pedagogy.moderation_label'), sub: t('settings.pedagogy.moderation_sub') },
                  ].map(({ key, label, sub }) => {
                    const on = pedSettings[key as keyof typeof pedSettings] as boolean
                    return (
                      <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--bg)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <div>
                          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{label}</div>
                          <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>
                        </div>
                        <div style={{ width: 50, height: 28, borderRadius: 14, background: on ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                          onClick={() => setPedSettings(s => s ? { ...s, [key]: !on } : s)}>
                          <div style={{ position: 'absolute', top: 3, left: on ? 24 : 3, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button style={{ ...btnPrim, opacity: pedSaving ? 0.7 : 1 }} disabled={pedSaving}
                  onClick={async () => {
                    if (!pedSettings) return
                    setPedSaving(true)
                    try {
                      const res = await fetchApi('/api/v2/school-settings', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passMark: pedSettings.passMark, councilPassMark: pedSettings.councilPassMark, maxAbsences: pedSettings.maxAbsences, attendanceLateAsAbsence: pedSettings.attendanceLateAsAbsence, legalMaxContributionFirstCycle: pedSettings.legalMaxContributionFirstCycle, legalMaxContributionSecondCycle: pedSettings.legalMaxContributionSecondCycle, bulletinBlockOnUnpaidFees: pedSettings.bulletinBlockOnUnpaidFees, schoolLanguageMode: pedSettings.schoolLanguageMode, academicCalendarType: pedSettings.academicCalendarType, smsEnabled: pedSettings.smsEnabled, offlineModeEnabled: pedSettings.offlineModeEnabled, aiAlertsEnabled: pedSettings.aiAlertsEnabled, messageModeration: pedSettings.messageModeration }) })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.message || 'Erreur')
                      onToast(t('settings.pedagogy.toast_saved'), 'success')
                    } catch (err: any) { onToast(err.message || 'Erreur', 'error') }
                    finally { setPedSaving(false) }
                  }}>
                  {pedSaving ? t('settings.pedagogy.saving') : t('settings.pedagogy.btn_save')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 4: PRÉFÉRENCES ── */}
      {activeTab === 4 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={cardHeader}><span style={cardTitle}>{t('settings.preferences.title')}</span></div>
          <div style={{ padding: '22px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {[
              { label: 'Langue', opts: ['Français', 'English', 'Français/English (Bilingue)'] },
              { label: 'Fuseau horaire', opts: ['Africa/Douala (UTC+1)', 'Africa/Lagos (UTC+1)', 'Europe/Paris (UTC+2)'] },
              { label: 'Format de date', opts: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
              { label: 'Système de notation', opts: ['/20 (MINESEC)', '/100', 'Lettres A–F'] },
            ].map((f, i) => (
              <div key={i}>
                <div style={fieldLabel}>{f.label}</div>
                <select style={fieldSelect}>{f.opts.map(o => <option key={o}>{o}</option>)}</select>
              </div>
            ))}
          </div>
          <div style={{ padding: '16px 26px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnPrim} onClick={() => onToast('Préférences enregistrées', 'success')}>💾 Enregistrer</button>
          </div>
        </div>
      )}

      {/* ── TAB 5: ACTIVITÉS ── */}
      {activeTab === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input placeholder={t('settings.activities.search_placeholder')} value={actSearchInput}
              onChange={e => setActSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setActSearch(actSearchInput); setActPage(1) } }}
              style={{ flex: 1, padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }} />
            <button style={btnSec} onClick={() => { setActSearch(actSearchInput); setActPage(1) }}>{t('settings.activities.btn_search')}</button>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={cardHeader}>
              <span style={cardTitle}>{t('settings.activities.title')}</span>
              {actData && <span style={{ fontSize: 14, color: 'var(--text3)' }}>{t('settings.activities.entries_count').replace('{count}', String(actData.total))}</span>}
            </div>
            {actLoading && (<div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} /></div>)}
            {!actLoading && actData && actData.logs.length === 0 && (<div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 16 }}>{t('settings.activities.no_activities')}</div>)}
            {!actLoading && actData && actData.logs.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={thLog}>{t('settings.activities.table_headers.0')}</th>
                    <th style={thLog}>{t('settings.activities.table_headers.1')}</th>
                    <th style={thLog}>{t('settings.activities.table_headers.2')}</th>
                    <th style={thLog}>{t('settings.activities.table_headers.3')}</th>
                  </tr></thead>
                  <tbody>
                    {actData.logs.map((log, i) => (
                      <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                        <td style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                        <td style={tdLog}><span style={{ fontWeight: 700, color: 'var(--text)' }}>{log.action}</span></td>
                        <td style={{ ...tdLog, maxWidth: 320, wordBreak: 'break-word' }}>{log.description}</td>
                        <td style={{ ...tdLog, whiteSpace: 'nowrap' }}>{log.user ? (`${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`).trim() || '—' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {actData && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 14, color: 'var(--text3)' }}>{t('settings.activities.page_info').replace('{current}', String(actData.page)).replace('{total}', String(actData.pages))}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...btnSec, opacity: actData.page <= 1 ? 0.45 : 1 }} disabled={actData.page <= 1} onClick={() => setActPage(p => p - 1)}>{t('settings.activities.btn_prev')}</button>
                  <button style={{ ...btnSec, opacity: actData.page >= actData.pages ? 0.45 : 1 }} disabled={actData.page >= actData.pages} onClick={() => setActPage(p => p + 1)}>{t('settings.activities.btn_next')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 6: EMAILS ── */}
      {activeTab === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder={t('settings.emails.search_placeholder')} value={emlSearchInput}
              onChange={e => setEmlSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setEmlSearch(emlSearchInput); setEmlPage(1) } }}
              style={{ flex: 1, minWidth: 200, padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.background = 'var(--surface)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.background = 'var(--bg2)' }} />
            <select value={emlStatus} onChange={e => { setEmlStatus(e.target.value); setEmlPage(1) }}
              style={{ padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }}>
              <option value="">{t('settings.emails.status_all')}</option>
              <option value="SENT">Envoyé</option>
              <option value="FAILED">Échec</option>
              <option value="PENDING">En attente</option>
            </select>
            <button style={btnSec} onClick={() => { setEmlSearch(emlSearchInput); setEmlPage(1) }}>{t('settings.emails.btn_search')}</button>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={cardHeader}>
              <span style={cardTitle}>{t('settings.emails.title')}</span>
              {emlData && <span style={{ fontSize: 14, color: 'var(--text3)' }}>{t('settings.emails.count').replace('{count}', String(emlData.pagination.total))}</span>}
            </div>
            {emlLoading && (<div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} /></div>)}
            {!emlLoading && emlData && emlData.logs.length === 0 && (<div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 16 }}>{t('settings.emails.no_emails')}</div>)}
            {!emlLoading && emlData && emlData.logs.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={thLog}>{t('settings.emails.table_headers.0')}</th>
                    <th style={thLog}>{t('settings.emails.table_headers.1')}</th>
                    <th style={thLog}>{t('settings.emails.table_headers.2')}</th>
                    <th style={thLog}>{t('settings.emails.table_headers.3')}</th>
                  </tr></thead>
                  <tbody>
                    {emlData.logs.map((log, i) => {
                      const s = (log.status ?? '').toLowerCase()
                      const badge = s.includes('sent') || s.includes('envoy') ? { bg: 'rgba(5,150,105,0.12)', color: 'var(--green2)' }
                        : s.includes('fail') || s.includes('chec') ? { bg: 'rgba(220,38,38,0.12)', color: 'var(--red)' }
                        : s.includes('pend') || s.includes('attente') ? { bg: 'rgba(217,119,6,0.12)', color: 'var(--amber)' }
                        : { bg: 'var(--bg2)', color: 'var(--text3)' }
                      return (
                        <tr key={log.id} style={{ background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                          <td style={{ ...tdLog, whiteSpace: 'nowrap' }}>{fmtDate(log.createdAt)}</td>
                          <td style={{ ...tdLog, maxWidth: 200, wordBreak: 'break-word' }}>{log.to}</td>
                          <td style={{ ...tdLog, maxWidth: 280, wordBreak: 'break-word' }}>{log.subject}</td>
                          <td style={tdLog}><span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: badge.bg, color: badge.color }}>{log.status}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {emlData && (
              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 14, color: 'var(--text3)' }}>{t('settings.emails.page_info').replace('{current}', String(emlData.pagination.page)).replace('{total}', String(emlData.pagination.pages))}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...btnSec, opacity: emlData.pagination.page <= 1 ? 0.45 : 1 }} disabled={emlData.pagination.page <= 1} onClick={() => setEmlPage(p => p - 1)}>{t('settings.emails.btn_prev')}</button>
                  <button style={{ ...btnSec, opacity: emlData.pagination.page >= emlData.pagination.pages ? 0.45 : 1 }} disabled={emlData.pagination.page >= emlData.pagination.pages} onClick={() => setEmlPage(p => p + 1)}>{t('settings.emails.btn_next')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Onglet Structure ── */}
      {activeTab === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>{t('settings.structure.backup_title')}</span></div>
            {backupLoading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 36 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
              </div>
            )}
            {!backupLoading && !backupInfo && (
              <div style={{ padding: '20px 26px', color: 'var(--text3)', fontSize: 15 }}>{t('settings.structure.no_backup')}</div>
            )}
            {!backupLoading && backupInfo && (
              <div style={{ padding: '20px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div style={fieldLabel}>Date</div>
                  <div style={{ padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontSize: 15, fontWeight: 600 }}>
                    {backupInfo.lastBackupAt ? new Date(backupInfo.lastBackupAt).toLocaleString('fr-FR') : '—'}
                  </div>
                </div>
                <div>
                  <div style={fieldLabel}>Fichier</div>
                  <div style={{ padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontSize: 15, fontWeight: 600, wordBreak: 'break-word' }}>
                    {backupInfo.lastBackupFile ?? '—'}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1', fontSize: 13, color: 'var(--text3)' }}>
                  {backupInfo.latestFileExists ? 'Le dernier fichier de sauvegarde est disponible.' : 'Le dernier fichier n\'est pas encore accessible sur disque.'}
                </div>
              </div>
            )}
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={cardHeader}><span style={cardTitle}>{t('settings.structure.rgpd_title')}</span></div>
            <div style={{ padding: '20px 26px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={fieldLabel}>{t('settings.structure.log_retention')}</div>
                {logRetentionLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48 }}>
                    <div style={{ width: 24, height: 24, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
                  </div>
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={logRetentionDays}
                    onChange={e => setLogRetentionDays(Math.max(1, parseInt(e.target.value || '90', 10) || 90))}
                    style={fieldInput}
                  />
                )}
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>{t('settings.structure.log_retention_hint')}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={fieldLabel}>{t('settings.structure.export_label')}</div>
                  <div style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>{t('settings.structure.export_desc')}</div>
                </div>
                <button style={btnSec} onClick={handleRgpdExport} disabled={exportLoading}>
                  {exportLoading ? t('settings.structure.exporting') : t('settings.structure.btn_export')}
                </button>
              </div>
            </div>
            <div style={{ padding: '16px 26px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button style={btnPrim} onClick={handleLogRetentionSave} disabled={logRetentionSaving || logRetentionLoading}>
                {logRetentionSaving ? t('settings.structure.saving_retention') : t('settings.structure.btn_save_retention')}
              </button>
            </div>
          </div>

          <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 12, padding: '14px 18px', fontSize: 14, color: 'var(--amber)', fontWeight: 600 }}>
            {t('settings.structure.structure_warning')}
          </div>

          {!structConfig && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-settings-spin 0.7s linear infinite' }} />
            </div>
          )}

          {structConfig && (
            <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              <div style={cardHeader}>
                <span style={cardTitle}>{t('settings.structure.classes_per_level')}</span>
              </div>
              <div style={{ padding: '20px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[...structConfig.niveaux1erCycle, ...structConfig.niveauxPrimaire].length === 0 && (
                  <div style={{ color: 'var(--text3)', fontSize: 15 }}>{t('settings.structure.no_levels')}</div>
                )}
                {[...structConfig.niveaux1erCycle, ...structConfig.niveauxPrimaire].map(niveau => (
                  <div key={niveau} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ minWidth: 60, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{niveau}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => setStructEdit(e => ({ ...e, [niveau]: Math.max(1, (e[niveau] ?? structConfig.classesParNiveau[niveau] ?? structConfig.classesParNiveauPrimaire[niveau] ?? 1) - 1) }))}
                        style={{ width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--border2)', background: 'var(--surface)', fontSize: 18, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontFamily: 'inherit' }}>−</button>
                      <span style={{ minWidth: 32, textAlign: 'center', fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>
                        {structEdit[niveau] ?? structConfig.classesParNiveau[niveau] ?? structConfig.classesParNiveauPrimaire[niveau] ?? 1}
                      </span>
                      <button onClick={() => setStructEdit(e => ({ ...e, [niveau]: Math.min(26, (e[niveau] ?? structConfig.classesParNiveau[niveau] ?? structConfig.classesParNiveauPrimaire[niveau] ?? 1) + 1) }))}
                        style={{ width: 34, height: 34, borderRadius: 8, border: '1.5px solid var(--border2)', background: 'var(--surface)', fontSize: 18, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontFamily: 'inherit' }}>+</button>
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--text3)' }}>
                      {(() => {
                        const current = structConfig.classesParNiveau[niveau] ?? structConfig.classesParNiveauPrimaire[niveau] ?? 1
                        const next = structEdit[niveau] ?? current
                        const diff = next - current
                        if (diff > 0) return `+${diff} classe(s) à créer`
                        if (diff < 0) return `(réduction ignorée — classes existantes conservées)`
                        return `actuel : ${current} classe(s)`
                      })()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {structResult !== null && structResult.length > 0 && (
            <div style={{ background: 'var(--green-light)', border: '1.5px solid var(--green)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--green2)', marginBottom: 8 }}>✅ Classes créées :</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {structResult.map(n => (
                  <span key={n} style={{ padding: '4px 12px', borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--green)', fontSize: 14, fontWeight: 700, color: 'var(--green2)' }}>{n}</span>
                ))}
              </div>
            </div>
          )}
          {structResult !== null && structResult.length === 0 && (
            <div style={{ background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 12, padding: '14px 18px', fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>
              ℹ️ Aucune nouvelle classe à créer — toutes les classes attendues existent déjà.
            </div>
          )}

          {structConfig && (
            <button onClick={handleStructSave} disabled={structSaving}
              style={{ ...btnPrim, alignSelf: 'flex-start', opacity: structSaving ? 0.7 : 1, cursor: structSaving ? 'wait' : 'pointer' }}>
              {structSaving ? t('settings.structure.applying') : t('settings.structure.btn_apply')}
            </button>
          )}
        </div>
      )}

      {/* ── MODAL: Politique de sécurité ── */}
      {secModal && (
        <div onClick={() => !secSaving && setSecModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: 18, padding: '32px 36px', width: 460, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 22 }}>
              {t('settings.security.modal.title')}
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={fieldLabel}>{t('settings.security.modal.min_length_label')}</div>
              <select style={fieldSelect} value={secEdit.passwordMinLength}
                onChange={e => setSecEdit(s => ({ ...s, passwordMinLength: parseInt(e.target.value) }))}>
                {[6,7,8,9,10,12,14,16].map(v => <option key={v} value={v}>{t('settings.security.characters').replace('{count}', String(v))}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 18 }}>
              {[
                { key: 'passwordRequireUpper' as const, label: t('settings.security.modal.require_upper_label') },
                { key: 'passwordRequireDigit' as const, label: t('settings.security.modal.require_digit_label') },
              ].map(({ key, label }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 46, height: 26, borderRadius: 13, background: secEdit[key] ? 'var(--green)' : 'var(--border2)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                    onClick={() => setSecEdit(s => ({ ...s, [key]: !s[key] }))}>
                    <div style={{ position: 'absolute', top: 2, left: secEdit[key] ? 22 : 2, width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={fieldLabel}>{t('settings.security.modal.session_label')}</div>
              <select style={fieldSelect} value={secEdit.sessionTimeoutMin}
                onChange={e => setSecEdit(s => ({ ...s, sessionTimeoutMin: parseInt(e.target.value) }))}>
                {SESSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSecModal(false)} disabled={secSaving}
                style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('settings.security.modal.btn_cancel')}
              </button>
              <button onClick={handleSecSave} disabled={secSaving}
                style={{ flex: 2, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: secSaving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: secSaving ? 0.7 : 1 }}>
                {secSaving ? t('settings.security.modal.saving') : t('settings.security.modal.btn_save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const cardHeader: React.CSSProperties = { padding: '16px 26px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }
const cardTitle: React.CSSProperties = { fontSize: 17, fontWeight: 800, color: 'var(--text)' }
const fieldLabel: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--text2)', marginBottom: 7, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }
const fieldInput: React.CSSProperties = { width: '100%', padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }
const fieldSelect: React.CSSProperties = { width: '100%', padding: '11px 14px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 11, color: 'var(--text)', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', cursor: 'pointer' }
const thLog: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdLog: React.CSSProperties = { padding: '10px 14px', fontSize: 14, color: 'var(--text2)', border: '1px solid var(--bg2)', verticalAlign: 'top' }

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}
