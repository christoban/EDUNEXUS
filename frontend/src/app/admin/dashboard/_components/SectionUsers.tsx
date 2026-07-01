'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  openInviteOnMount?: boolean
  onInviteMounted?: () => void
}

// ── Mapping titre → permissions (doit correspondre au backend StaffPermissionRules.ts) ──
type StaffPermission =
  | 'MANAGE_TIMETABLE' | 'VALIDATE_GRADES' | 'MANAGE_EXAMS'
  | 'SUPERVISE_TEACHERS' | 'MANAGE_ATTENDANCE' | 'MANAGE_DISCIPLINE'
  | 'MANAGE_INCIDENTS' | 'MANAGE_FINANCE' | 'VALIDATE_PAYMENTS'
  | 'GENERATE_REPORTS' | 'MANAGE_ATELIERS' | 'MANAGE_PRACTICAL_GRADES'
  | 'MANAGE_INTERNSHIPS' | 'MANAGE_STAGE_CONVENTIONS' | 'MANAGE_WORKSHOP_STOCK'
  | 'MANAGE_CLASS_COUNCIL' | 'MANAGE_CATCHUP_REQUESTS'
  | 'VIEW_DEPARTMENT_GRADES' | 'SUPERVISE_DEPARTMENT_TEACHERS'
  | 'VALIDATE_DEPARTMENT_TIMETABLE' | 'GENERATE_DEPARTMENT_REPORTS'
  | 'VIEW_SUPERVISED_GRADES' | 'SUPERVISE_LESSON_PLANS'
  | 'GENERATE_PEDAGOGICAL_REPORTS' | 'MANAGE_CE_REPORTS' | 'MANAGE_PEDAGOGICAL_BRIEF'
  | 'MANAGE_PATRIMOINE' | 'MANAGE_DEGRADATIONS' | 'MANAGE_LIBRARY' | 'MANAGE_ORIENTATION'

const PERMISSION_LABELS: Record<StaffPermission, string> = {
  MANAGE_TIMETABLE:             'Emploi du temps',
  VALIDATE_GRADES:              'Validation notes',
  MANAGE_EXAMS:                 'Examens',
  SUPERVISE_TEACHERS:           'Supervision enseignants',
  MANAGE_ATTENDANCE:            'Présences',
  MANAGE_DISCIPLINE:            'Discipline',
  MANAGE_INCIDENTS:             'Incidents',
  MANAGE_FINANCE:               'Finance',
  VALIDATE_PAYMENTS:            'Validation paiements',
  GENERATE_REPORTS:             'Rapports',
  MANAGE_ATELIERS:              'Ateliers',
  MANAGE_PRACTICAL_GRADES:      'Notes pratiques',
  MANAGE_INTERNSHIPS:           'Stages / Internships',
  MANAGE_STAGE_CONVENTIONS:     'Conventions de stage',
  MANAGE_WORKSHOP_STOCK:        'Stock atelier',
  MANAGE_CLASS_COUNCIL:         'Conseil de classe',
  MANAGE_CATCHUP_REQUESTS:      'Demandes de rattrapage',
  VIEW_DEPARTMENT_GRADES:       'Notes département (lecture)',
  SUPERVISE_DEPARTMENT_TEACHERS:'Supervision département',
  VALIDATE_DEPARTMENT_TIMETABLE:'EDT département',
  GENERATE_DEPARTMENT_REPORTS:  'Rapports département',
  VIEW_SUPERVISED_GRADES:       'Notes supervisées (lecture)',
  SUPERVISE_LESSON_PLANS:       'Plans de cours',
  GENERATE_PEDAGOGICAL_REPORTS: 'Rapports pédagogiques',
  MANAGE_CE_REPORTS:            'Rapports CE',
  MANAGE_PEDAGOGICAL_BRIEF:     'Brief pédagogique',
  MANAGE_PATRIMOINE:            'Patrimoine',
  MANAGE_DEGRADATIONS:          'Dégradations',
  MANAGE_LIBRARY:               'Bibliothèque',
  MANAGE_ORIENTATION:           'Orientation',
}

type StaffTitle = {
  key: string
  label: string
  permissions: StaffPermission[]
}

// Emoji par titre (fallback générique selon les permissions typiques)
function emojiForTitle(key: string): string {
  if (key.includes('Censeur') || key.includes('Vice-Principal') || key.includes('Deputy Head') || key.includes('Directeur Adjoint')) return '🔍'
  if (key.includes('Surveillant') || key.includes('Discipline')) return '👁'
  if (key.includes('Intendant') || key.includes('Économe') || key.includes('Bursar')) return '💰'
  if (key.includes('Chef des Travaux')) return '🔧'
  if (key.includes('Documentaliste') || key.includes('Librarian')) return '📚'
  if (key.includes('Orientation') || key.includes('Counsellor') || key.includes('Pédagogique')) return '🧭'
  if (key.includes('Comptable') || key.includes('Matières')) return '📦'
  if (key.includes('HOD') || key.includes('Animateur')) return '🏫'
  return '🔑'
}

const ROLE_TABS: { label: string; role: string }[] = [
  { label: 'Tous',        role: ''        },
  { label: 'Enseignants', role: 'TEACHER' },
  { label: 'Élèves',      role: 'STUDENT' },
  { label: 'Parents',     role: 'PARENT'  },
  { label: 'Personnel',   role: 'STAFF'   },
]

const ROLE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  ADMIN:   { label: 'Admin',      bg: '#f0fdf4', color: '#15803d' },
  TEACHER: { label: 'Enseignant', bg: '#dbeafe', color: '#1e40af' },
  STUDENT: { label: 'Élève',      bg: '#ccfbf1', color: '#134e4a' },
  PARENT:  { label: 'Parent',     bg: '#fef3c7', color: '#92400e' },
  STAFF:   { label: 'Personnel',  bg: '#ffedd5', color: '#9a3412' },
}

interface UserItem {
  id: string
  firstName: string
  lastName: string
  email: string | null
  role: string
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  studentProfile: { class: { name: string } | null } | null
  staffProfile: { title: string } | null
  classesProfessorPrincipal?: { id: string; name: string }[]
}

// ── Fusion permissions sans doublon ──
function mergePermissions(selectedTitles: string[], customPerms: StaffPermission[], titles: StaffTitle[]): StaffPermission[] {
  const set = new Set<StaffPermission>(customPerms)
  for (const tk of selectedTitles) {
    const title = titles.find(t => t.key === tk)
    title?.permissions.forEach(p => set.add(p))
  }
  return Array.from(set)
}

// ── Modal invitation ──
interface InviteForm {
  firstName: string
  lastName: string
  email: string
  role: string
  selectedTitles: string[]
  customPerms: StaffPermission[]
  showCustomPerms: boolean
  loading: boolean
  error: string
}

const EMPTY_FORM: InviteForm = {
  firstName: '', lastName: '', email: '', role: 'TEACHER',
  selectedTitles: [], customPerms: [], showCustomPerms: false,
  loading: false, error: '',
}

function InviteModal({ onClose, onSuccess, staffTitles }: { onClose: () => void; onSuccess: (msg: string) => void; staffTitles: StaffTitle[] }) {
  const [form, setForm] = useState<InviteForm>(EMPTY_FORM)

  const set = (field: keyof InviteForm, val: unknown) =>
    setForm(prev => ({ ...prev, [field]: val }))

  const toggleTitle = (key: string) => {
    const next = form.selectedTitles.includes(key)
      ? form.selectedTitles.filter(k => k !== key)
      : [...form.selectedTitles, key]
    // Quand on coche "Personnalisé", pré-cocher les perms déjà accumulées
    if (key === '__custom__') {
      setForm(prev => ({ ...prev, selectedTitles: next, showCustomPerms: !prev.showCustomPerms }))
    } else {
      setForm(prev => ({ ...prev, selectedTitles: next }))
    }
  }

  const toggleCustomPerm = (perm: StaffPermission) => {
    const next = form.customPerms.includes(perm)
      ? form.customPerms.filter(p => p !== perm)
      : [...form.customPerms, perm]
    set('customPerms', next)
  }

  const mergedPerms = mergePermissions(form.selectedTitles, form.customPerms, staffTitles)
  const isStaff = form.role === 'STAFF'

  const submit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      set('error', 'Prénom, nom et email sont obligatoires')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      set('error', 'Adresse email invalide')
      return
    }
    if (isStaff && form.selectedTitles.length === 0 && form.customPerms.length === 0) {
      set('error', 'Sélectionnez au moins un poste ou une permission')
      return
    }

    set('loading', true)
    set('error', '')
    try {
      const res = await fetchApi('/api/v2/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          role: form.role,
          password: 'EduNexus2025!',
          ...(isStaff && {
            staffTitle: form.selectedTitles[0] ?? 'Personnalisé',
            staffPermissions: mergedPerms,
          }),
        }),
      })
      const data = await res.json() as { success?: boolean; message?: string }
      if (!res.ok || !data.success) throw new Error(data.message ?? 'Erreur inconnue')
      onSuccess(`${form.firstName} ${form.lastName} invité(e) avec succès`)
      onClose()
    } catch (err: unknown) {
      set('error', err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    } finally {
      set('loading', false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)' }} />

      {/* Conteneur centrage */}
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, width: '96%', maxWidth: 640, maxHeight: '92vh', overflowY: 'auto', borderRadius: 20 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: '40px 44px', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', animation: 'popIn 0.22s ease' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>
                Inviter un utilisateur
              </div>
              <div style={{ fontSize: 14, color: '#a89478', marginTop: 4 }}>
                Un mot de passe temporaire sera généré automatiquement.
              </div>
            </div>
            <button onClick={onClose}
              style={{ background: '#f0ebe3', border: 'none', cursor: 'pointer', color: '#6b5c45', fontSize: 18, padding: '6px 11px', borderRadius: 9, lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>

          <div style={{ height: 1, background: '#e8e0d4', marginBottom: 26 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Nom + Prénom */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Prénom *">
                <input value={form.firstName} onChange={e => set('firstName', e.target.value)}
                  placeholder="Marie" style={inputSt} />
              </Field>
              <Field label="Nom *">
                <input value={form.lastName} onChange={e => set('lastName', e.target.value)}
                  placeholder="Ngono" style={inputSt} />
              </Field>
            </div>

            {/* Email */}
            <Field label="Email *">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="marie.ngono@lycee.cm" style={inputSt} />
            </Field>

            {/* Rôle */}
            <Field label="Rôle">
              <select value={form.role} onChange={e => set('role', e.target.value)} style={{ ...inputSt, cursor: 'pointer', appearance: 'auto' }}>
                <option value="TEACHER">👨‍🏫 Enseignant</option>
                <option value="STAFF">🔍 Personnel (Staff)</option>
                <option value="STUDENT">👨‍🎓 Élève</option>
                <option value="PARENT">👨‍👩‍👧 Parent</option>
              </select>
            </Field>

            {/* Section STAFF — postes avec checkboxes */}
            {isStaff && (
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#6b5c45', marginBottom: 12 }}>
                  Postes (cochez un ou plusieurs)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {staffTitles.length === 0 && (
                    <div style={{ fontSize: 13, color: '#a89478', padding: '8px 0' }}>Chargement des postes…</div>
                  )}
                  {staffTitles.map(title => {
                    const checked = form.selectedTitles.includes(title.key)
                    const emoji = emojiForTitle(title.key)
                    return (
                      <label key={title.key}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${checked ? '#059669' : '#e8e0d4'}`, background: checked ? '#f0fdf4' : 'white', cursor: 'pointer', transition: 'all 0.12s' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTitle(title.key)}
                          style={{ marginTop: 3, accentColor: '#059669', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1209' }}>{emoji} {title.label}</div>
                          <div style={{ fontSize: 13, color: '#a89478', marginTop: 3, lineHeight: 1.5 }}>
                            {(title.permissions as StaffPermission[]).slice(0, 4).map(p => PERMISSION_LABELS[p]).join(' · ')}
                            {title.permissions.length > 4 ? ` + ${title.permissions.length - 4}` : ''}
                          </div>
                        </div>
                      </label>
                    )
                  })}

                  {/* Personnalisé */}
                  <label
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${form.showCustomPerms ? '#7c3aed' : '#e8e0d4'}`, background: form.showCustomPerms ? '#faf5ff' : 'white', cursor: 'pointer', transition: 'all 0.12s' }}>
                    <input type="checkbox" checked={form.showCustomPerms} onChange={() => setForm(prev => ({ ...prev, showCustomPerms: !prev.showCustomPerms }))}
                      style={{ marginTop: 3, accentColor: '#7c3aed', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1209' }}>🛠 Personnalisé</div>
                      <div style={{ fontSize: 13, color: '#a89478', marginTop: 3 }}>Sélectionner les permissions manuellement</div>
                    </div>
                  </label>
                </div>

                {/* Permissions personnalisées */}
                {form.showCustomPerms && (
                  <div style={{ marginTop: 14, padding: '14px 16px', background: '#f0ebe3', borderRadius: 12, border: '1px solid #e8e0d4' }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#6b5c45', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                      Permissions individuelles
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {(Object.keys(PERMISSION_LABELS) as StaffPermission[]).map(perm => {
                        const isInherited = mergePermissions(form.selectedTitles, [], staffTitles).includes(perm)
                        const isChecked = mergedPerms.includes(perm)
                        return (
                          <label key={perm}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: isInherited ? '#d1fae5' : 'white', border: `1px solid ${isInherited ? 'rgba(5,150,105,0.2)' : '#e8e0d4'}`, cursor: isInherited ? 'default' : 'pointer', opacity: 1 }}>
                            <input type="checkbox" checked={isChecked} disabled={isInherited}
                              onChange={() => !isInherited && toggleCustomPerm(perm)}
                              style={{ accentColor: '#059669', width: 14, height: 14, flexShrink: 0 }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: isInherited ? '#065f46' : '#6b5c45', lineHeight: 1.2 }}>
                              {PERMISSION_LABELS[perm]}
                              {isInherited && <span style={{ fontSize: 11, color: '#059669', marginLeft: 4 }}>(incluse)</span>}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Résumé des permissions fusionnées */}
                {mergedPerms.length > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid rgba(5,150,105,0.2)', fontSize: 13, color: '#065f46', fontWeight: 600 }}>
                    ✅ {mergedPerms.length} permission{mergedPerms.length > 1 ? 's' : ''} assignée{mergedPerms.length > 1 ? 's' : ''} :&nbsp;
                    {mergedPerms.slice(0, 5).map(p => PERMISSION_LABELS[p]).join(', ')}
                    {mergedPerms.length > 5 ? ` + ${mergedPerms.length - 5} autres` : ''}
                  </div>
                )}
              </div>
            )}

            {/* Erreur */}
            {form.error && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', borderRadius: 10, border: '1px solid rgba(220,38,38,0.2)', fontSize: 14, fontWeight: 700, color: '#dc2626' }}>
                {form.error}
              </div>
            )}

            {/* Submit */}
            <button onClick={submit} disabled={form.loading}
              style={{ width: '100%', background: form.loading ? '#6b9e8e' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', fontWeight: 800, fontSize: 17, padding: '16px 24px', borderRadius: 11, border: 'none', cursor: form.loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {form.loading ? '⏳ Envoi...' : '✉️ Envoyer l\'invitation'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Modal Import Excel ──
interface ImportPreviewRow {
  nom: string
  prenom: string
  email: string
  telephone: string
  classe?: string
  matieres?: string
  classePrincipale?: string
  departementAp?: string
}

interface ImportStepProps {
  importType: 'STUDENT' | 'TEACHER' | null
  setImportType: (t: 'STUDENT' | 'TEACHER') => void
  step: number
  onStep: (n: number) => void
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onSuccess: () => void
}

function ImportModal({ onClose, onToast, onSuccess }: Omit<ImportStepProps, 'importType' | 'setImportType' | 'step' | 'onStep'>) {
  const [step, setStep] = useState(0)
  const [importType, setImportType] = useState<'STUDENT' | 'TEACHER' | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewRow[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    total: number
    success: number
    professeursPrincipauxAssignes: number
    animateursPedagogiquesAssignes: number
    errors: { ligne: number; erreur: string }[]
    warnings: { ligne: number; avertissement: string }[]
  } | null>(null)

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetchApi(`/api/v2/templates/${importType === 'STUDENT' ? 'import-eleves' : 'import-enseignants'}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Erreur de téléchargement')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = importType === 'STUDENT' ? 'import-eleves.xlsx' : 'import-enseignants.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de téléchargement', 'error')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      onToast('Fichier trop volumineux (max 5 MB)', 'error')
      return
    }
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'))
    if (ext !== '.xlsx' && ext !== '.xls') {
      onToast('Format non supporté. Utilisez .xlsx ou .xls', 'error')
      return
    }
    setFile(f)

    const buffer = await f.arrayBuffer()
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
    setTotalRows(rows.length)

    const previewData: ImportPreviewRow[] = rows.slice(0, 5).map((r: Record<string, string>) => ({
      nom: r.nom || '',
      prenom: r.prenom || '',
      email: r.email || '',
      telephone: r.telephone || '',
      classe: r.classe || r.matieres || '',
      matieres: r.matieres || '',
      classePrincipale: r.classe_principale || '',
      departementAp: r.departement_ap || '',
    }))
    setPreview(previewData)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('role', importType!)
      const res = await fetchApi('/api/v2/users/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur lors de l\'import')
      setResult(data.data)
      setStep(3)
      if (data.data.errors?.length === 0) {
        onToast(`${data.data.success} compte${data.data.success > 1 ? 's' : ''} créé${data.data.success > 1 ? 's' : ''} avec succès`, 'success')
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setStep(0)
    setImportType(null)
    setFile(null)
    setPreview([])
    setTotalRows(0)
    setResult(null)
  }

  const handleClose = () => {
    if (result && result.success > 0) onSuccess()
    handleReset()
    onClose()
  }

  return (
    <>
      <div onClick={handleClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(26,18,9,0.5)', backdropFilter: 'blur(3px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201, width: '96%', maxWidth: 620, maxHeight: '92vh', overflowY: 'auto', borderRadius: 20 }}>
        <div style={{ background: 'white', borderRadius: 20, padding: '40px 44px', boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209' }}>
                {step === 0 ? 'Import Excel' : step === 1 ? 'Télécharger le modèle' : step === 2 ? 'Importer le fichier' : 'Résultat'}
              </div>
              <div style={{ fontSize: 14, color: '#a89478', marginTop: 4 }}>
                {step === 0 && 'Que voulez-vous importer ?'}
                {step === 1 && 'Utilisez notre modèle pour éviter les erreurs'}
                {step === 2 && file ? `${totalRows} ligne${totalRows > 1 ? 's' : ''} détectée${totalRows > 1 ? 's' : ''}` : 'Formats acceptés : .xlsx, .xls (max 5 MB)'}
                {step === 3 && result && `${result.success} compte${result.success > 1 ? 's' : ''} créé${result.success > 1 ? 's' : ''}`}
              </div>
            </div>
            <button onClick={handleClose} style={{ background: '#f0ebe3', border: 'none', cursor: 'pointer', color: '#6b5c45', fontSize: 18, padding: '6px 11px', borderRadius: 9, lineHeight: 1, flexShrink: 0 }}>✕</button>
          </div>

          <div style={{ height: 1, background: '#e8e0d4', marginBottom: 26 }} />

          {/* Steps indicator */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 28, justifyContent: 'center' }}>
            {['Choix', 'Modèle', 'Import', 'Résultat'].map((label, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: i <= step ? '#059669' : '#e8e0d4', color: i <= step ? 'white' : '#a89478' }}>{i + 1}</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: i <= step ? '#059669' : '#a89478', display: i === step ? 'inline' : 'none' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Step 0 — Choose type */}
          {step === 0 && (
            <div style={{ display: 'flex', gap: 16, flexDirection: 'column' }}>
              <button onClick={() => { setImportType('STUDENT'); setStep(1) }}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderRadius: 14, border: `2px solid ${importType === 'STUDENT' ? '#059669' : '#e8e0d4'}`, background: importType === 'STUDENT' ? '#f0fdf4' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit', width: '100%' }}>
                <span style={{ fontSize: 32 }}>👨‍🎓</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1209' }}>Élèves + Parents</div>
                  <div style={{ fontSize: 14, color: '#a89478', marginTop: 3 }}>Importez vos élèves avec leurs parents (optionnel)</div>
                </div>
              </button>
              <button onClick={() => { setImportType('TEACHER'); setStep(1) }}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderRadius: 14, border: `2px solid ${importType === 'TEACHER' ? '#059669' : '#e8e0d4'}`, background: importType === 'TEACHER' ? '#f0fdf4' : 'white', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s', fontFamily: 'inherit', width: '100%' }}>
                <span style={{ fontSize: 32 }}>👨‍🏫</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1209' }}>Enseignants</div>
                  <div style={{ fontSize: 14, color: '#a89478', marginTop: 3 }}>Importez vos enseignants avec leurs matières</div>
                </div>
              </button>
            </div>
          )}

          {/* Step 1 — Download template */}
          {step === 1 && (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📥</div>
              <div style={{ fontSize: 16, color: '#6b5c45', marginBottom: 24, lineHeight: 1.6 }}>
                Téléchargez le modèle Excel, remplissez-le avec vos données, puis importez-le.
              </div>
              <button onClick={handleDownloadTemplate}
                style={{ padding: '16px 28px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                📥 Télécharger le modèle {importType === 'STUDENT' ? 'élèves' : 'enseignants'}
              </button>
              <div style={{ marginTop: 16 }}>
                <button onClick={() => setStep(2)}
                  style={{ background: 'none', border: 'none', color: '#059669', fontWeight: 700, cursor: 'pointer', fontSize: 15, fontFamily: 'inherit' }}>
                  J'ai déjà mon fichier → Passer à l'import
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Upload file */}
          {step === 2 && (
            <div>
              <label style={{ display: 'block', border: `2px dashed ${file ? '#059669' : '#d4c8b8'}`, borderRadius: 14, padding: '36px 20px', textAlign: 'center', cursor: 'pointer', background: file ? '#f0fdf4' : '#fafaf8', transition: 'all 0.12s' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{file ? '📄' : '📂'}</div>
                {file ? (
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#059669' }}>{file.name}</div>
                ) : (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#6b5c45' }}>Cliquez pour sélectionner un fichier</div>
                    <div style={{ fontSize: 13, color: '#a89478', marginTop: 6 }}>.xlsx ou .xls — 5 MB max</div>
                  </>
                )}
                <input type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>

              {/* Preview */}
              {preview.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#6b5c45', marginBottom: 10 }}>
                    Aperçu ({Math.min(5, totalRows)} premières lignes sur {totalRows})
                  </div>
                  <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: '#f0ebe3' }}>
                          {importType === 'STUDENT'
                            ? ['Nom', 'Prénom', 'Email', 'Téléphone', 'Classe'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#6b5c45' }}>{h}</th>)
                            : ['Nom', 'Prénom', 'Email', 'Téléphone', 'Matières', 'Prof. Principal', 'AP'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#6b5c45' }}>{h}</th>)
                          }
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #f0ebe3' }}>
                            <td style={{ padding: '7px 10px', fontWeight: 600, color: '#1a1209' }}>{row.nom}</td>
                            <td style={{ padding: '7px 10px', color: '#6b5c45' }}>{row.prenom}</td>
                            <td style={{ padding: '7px 10px', color: '#6b5c45' }}>{row.email || '—'}</td>
                            <td style={{ padding: '7px 10px', color: '#6b5c45' }}>{row.telephone || '—'}</td>
                            <td style={{ padding: '7px 10px', color: '#6b5c45' }}>{row.classe || row.matieres || '—'}</td>
                            {importType === 'TEACHER' && <>
                              <td style={{ padding: '7px 10px', color: row.classePrincipale ? '#059669' : '#a89478', fontWeight: row.classePrincipale ? 700 : 400 }}>{row.classePrincipale || '—'}</td>
                              <td style={{ padding: '7px 10px', color: row.departementAp ? '#1d4ed8' : '#a89478', fontWeight: row.departementAp ? 700 : 400 }}>{row.departementAp || '—'}</td>
                            </>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }}>← Changer</button>
                <button onClick={handleImport} disabled={!file || loading}
                  style={{ flex: 1, padding: '14px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: !file ? '#ccc' : 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: !file ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                  {loading ? '⏳ Traitement en cours...' : '✅ Confirmer l\'import'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Result */}
          {step === 3 && result && (
            <div>
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>{result.errors?.length > 0 ? '⚠️' : '✅'}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>
                  {result.success} compte{result.success > 1 ? 's' : ''} créé{result.success > 1 ? 's' : ''}
                </div>
                {result.errors?.length > 0 && (
                  <div style={{ fontSize: 15, color: '#dc2626', fontWeight: 600 }}>⚠️ {result.errors.length} ligne{result.errors.length > 1 ? 's' : ''} ignorée{result.errors.length > 1 ? 's' : ''}</div>
                )}
              </div>

              {/* Stats PP / AP */}
              {(result.professeursPrincipauxAssignes > 0 || result.animateursPedagogiquesAssignes > 0) && (
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  {result.professeursPrincipauxAssignes > 0 && (
                    <div style={{ flex: 1, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, marginBottom: 2 }}>🧑‍💼</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#065f46' }}>{result.professeursPrincipauxAssignes} PP assigné{result.professeursPrincipauxAssignes > 1 ? 's' : ''}</div>
                    </div>
                  )}
                  {result.animateursPedagogiquesAssignes > 0 && (
                    <div style={{ flex: 1, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, marginBottom: 2 }}>⭐</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1e40af' }}>{result.animateursPedagogiquesAssignes} AP assigné{result.animateursPedagogiquesAssignes > 1 ? 's' : ''}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Erreurs (rouge) */}
              {result.errors?.length > 0 && (
                <div style={{ marginTop: 12, background: '#fef2f2', borderRadius: 10, border: '1px solid rgba(220,38,38,0.15)', padding: '14px 16px', maxHeight: 160, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#991b1b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Erreurs</div>
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#991b1b', marginBottom: i < result.errors.length - 1 ? 6 : 0, lineHeight: 1.5 }}>
                      <strong>Ligne {err.ligne}</strong> — {err.erreur}
                    </div>
                  ))}
                </div>
              )}

              {/* Avertissements (orange) */}
              {result.warnings?.length > 0 && (
                <div style={{ marginTop: 10, background: '#fffbeb', borderRadius: 10, border: '1px solid rgba(245,158,11,0.25)', padding: '14px 16px', maxHeight: 120, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avertissements</div>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ fontSize: 13, color: '#b45309', marginBottom: i < result.warnings.length - 1 ? 6 : 0, lineHeight: 1.5 }}>
                      <strong>Ligne {w.ligne}</strong> — {w.avertissement}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button onClick={() => { handleReset(); setStep(0) }} style={{ flex: 1, padding: '14px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Importer un autre fichier
                </button>
                <button onClick={handleClose} style={{ flex: 1, padding: '14px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  Fermer
                </button>
              </div>
            </div>
          )}

          {/* Loading overlay for import */}
          {loading && step === 2 && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: 40, height: 40, border: '4px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, color: '#6b5c45', fontWeight: 600 }}>Traitement en cours...</div>
              <div style={{ fontSize: 13, color: '#a89478', marginTop: 4 }}>Création des comptes et envoi des invitations</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#6b5c45', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e8e0d4',
  fontSize: 16, fontFamily: 'inherit', color: '#1a1209', background: '#fafaf8',
  outline: 'none', boxSizing: 'border-box',
}

function formatLastLogin(dt: string | null): string {
  if (!dt) return 'Jamais connecté'
  const d = new Date(dt)
  const now = new Date()
  const diffH = Math.floor((now.getTime() - d.getTime()) / 3600000)
  if (diffH < 1) return "Aujourd'hui"
  if (diffH < 24) return `Aujourd'hui ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  if (diffH < 48) return `Hier ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// ── Composant principal ──
interface ClassItem { id: string; name: string }

const EMPTY_MOD_USER = { open: false, userId: '', firstName: '', lastName: '', email: '', phone: '', loading: false, error: '' }
const EMPTY_TRANSFER = { open: false, userId: '', userName: '', classId: '', classes: [] as ClassItem[], loading: false, error: '' }
const EMPTY_DOC_MODAL = { open: false, userId: '', userName: '', status: '', loading: false, error: '' }

const EMPTY_CREATE_USER = {
  open: false, firstName: '', lastName: '', email: '', phone: '', role: 'TEACHER' as 'TEACHER' | 'STUDENT' | 'PARENT' | 'STAFF',
  subjectIds: [] as string[], classeId: '', dateOfBirth: '', gender: '',
  staffTitle: '', staffPermissions: [] as StaffPermission[],
  loading: false, error: '',
}
interface SubjectItem2 { id: string; name: string }

export default function SectionUsers({ onToast, openInviteOnMount, onInviteMounted }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const [openDD, setOpenDD] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [modUser, setModUser]       = useState(EMPTY_MOD_USER)
  const [transfer, setTransfer]     = useState(EMPTY_TRANSFER)
  const [docModal, setDocModal]     = useState(EMPTY_DOC_MODAL)
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_USER)

  const [availClasses, setAvailClasses] = useState<ClassItem[]>([])
  const [availSubjects, setAvailSubjects] = useState<SubjectItem2[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [staffTitles, setStaffTitles] = useState<StaffTitle[]>([])

  // Fetch des titres staff filtrés selon le template de l'école (une seule fois)
  useEffect(() => {
    fetchApi('/api/v2/school/staff-titles')
      .then(r => r.json())
      .then(d => { if (d.success) setStaffTitles(d.data as StaffTitle[]) })
      .catch(() => { /* non bloquant */ })
  }, [])

  useEffect(() => {
    if (openInviteOnMount) {
      setInviteOpen(true)
      onInviteMounted?.()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})

  const fetchUsers = useCallback(async (roleFilter = '') => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ limit: '100' })
      if (roleFilter) params.set('role', roleFilter)
      if (search) params.set('search', search)
      const res = await fetchApi(`/api/v2/users?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setUsers(data.data || [])
      // Utiliser roleCounts du backend (vrais totaux, pas limités à la page)
      if (!roleFilter && data.roleCounts) {
        setCounts(data.roleCounts as Record<string, number>)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
  }, [activeTab])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Générer un document scolaire ────────────────────────────────────────
  const openDocModal = (user: UserItem) => {
    setOpenDD(null)
    setDocModal({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, status: (user as any).studentStatus ?? 'ACTIVE', loading: false, error: '' })
  }

  const generateDoc = async (type: 'certificat' | 'carte' | 'lettre-transfert') => {
    setDocModal(f => ({ ...f, loading: true, error: '' }))
    try {
      const url = type === 'lettre-transfert'
        ? `/api/v2/students/${docModal.userId}/${type}?motif=Demande de transfert`
        : `/api/v2/students/${docModal.userId}/${type}`
      const res = await fetchApi(url, { credentials: 'include' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setDocModal(f => ({ ...f, loading: false, error: (d as any).message ?? 'Erreur génération PDF' }))
        return
      }
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      window.open(objUrl, '_blank')
      setDocModal(EMPTY_DOC_MODAL)
    } catch (e: any) {
      setDocModal(f => ({ ...f, loading: false, error: e.message ?? 'Erreur réseau' }))
    }
  }

  // ── Modifier utilisateur ────────────────────────────────────────────────
  const openModUser = (user: UserItem) => {
    setOpenDD(null)
    setModUser({ open: true, userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email ?? '', phone: '', loading: false, error: '' })
  }

  const submitModUser = async () => {
    if (!modUser.firstName.trim() || !modUser.lastName.trim()) { setModUser(f => ({ ...f, error: 'Prénom et nom obligatoires' })); return }
    setModUser(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/users/${modUser.userId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: modUser.firstName.trim(), lastName: modUser.lastName.trim(), email: modUser.email.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Utilisateur modifié', 'success')
      setModUser(EMPTY_MOD_USER)
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      setModUser(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Changer de classe ────────────────────────────────────────────────────
  const openTransfer = async (user: UserItem) => {
    setOpenDD(null)
    setTransfer({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, classId: '', classes: [], loading: false, error: '' })
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setTransfer(f => ({ ...f, classes: data.data || [] }))
    } catch { /* silencieux */ }
  }

  const submitTransfer = async () => {
    if (!transfer.classId) { setTransfer(f => ({ ...f, error: 'Sélectionnez une classe' })); return }
    setTransfer(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/users/students/${transfer.userId}/transfer`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newClassId: transfer.classId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`${transfer.userName} transféré(e)`, 'success')
      setTransfer(EMPTY_TRANSFER)
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      setTransfer(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  const openCreateUser = async () => {
    setCreateForm(EMPTY_CREATE_USER)
    setCreateOpen(true)
    try {
      const [cRes, sRes] = await Promise.all([
        fetchApi('/api/v2/classes', { credentials: 'include' }),
        fetchApi('/api/v2/subjects', { credentials: 'include' }),
      ])
      if (cRes.ok) { const d = await cRes.json(); setAvailClasses(d.data || []) }
      if (sRes.ok) { const d = await sRes.json(); setAvailSubjects(d.data || []) }
    } catch { /* silencieux */ }
  }

  const setCreate = (field: string, val: unknown) =>
    setCreateForm(prev => ({ ...prev, [field]: val }))

  const submitCreateUser = async () => {
    if (!createForm.firstName.trim() || !createForm.lastName.trim()) {
      setCreate('error', 'Prénom et nom obligatoires'); return
    }
    setCreate('loading', true)
    setCreate('error', '')
    try {
      const body: Record<string, unknown> = {
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        role: createForm.role,
        password: 'EduNexus2025!',
      }
      if (createForm.email.trim()) body.email = createForm.email.trim()
      if (createForm.phone.trim()) body.phone = createForm.phone.trim()

      if (createForm.role === 'TEACHER') {
        if (createForm.subjectIds.length > 0) body.subjectIds = createForm.subjectIds
      } else if (createForm.role === 'STUDENT') {
        if (createForm.classeId) body.classeId = createForm.classeId
        if (createForm.dateOfBirth) body.dateOfBirth = createForm.dateOfBirth
        if (createForm.gender) body.gender = createForm.gender
      } else if (createForm.role === 'STAFF') {
        if (createForm.staffTitle) body.staffTitle = createForm.staffTitle
        if (createForm.staffPermissions.length > 0) body.staffPermissions = createForm.staffPermissions
      }

      const res = await fetchApi('/api/v2/users', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`${createForm.firstName} ${createForm.lastName} créé(e) avec succès`, 'success')
      setCreateOpen(false)
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      setCreate('error', err instanceof Error ? err.message : 'Erreur')
    } finally {
      setCreate('loading', false)
    }
  }

  const toggleSubjectId = (id: string) => {
    setCreateForm(prev => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(id)
        ? prev.subjectIds.filter(x => x !== id)
        : [...prev.subjectIds, id],
    }))
  }

  const handleDelete = async (userId: string) => {
    if (!confirm('Supprimer cet utilisateur ? Cette action est irréversible.')) return
    try {
      const res = await fetchApi(`/api/v2/users/${userId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Utilisateur supprimé', 'success')
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    }
  }

  const totalAll = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Utilisateurs</div>
          <div style={sSub}>{loading ? '…' : `${totalAll} compte${totalAll > 1 ? 's' : ''}`}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={{ ...btnSecSm, padding: '10px 18px' }} onClick={openCreateUser}>+ Créer</button>
          <button style={btnPrim} onClick={() => setInviteOpen(true)}>✉️ Inviter</button>
          <button style={{ ...btnSecSm, padding: '10px 18px' }} onClick={() => setImportOpen(true)}>📊 Import Excel</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f0ebe3', padding: 5, borderRadius: 12, marginBottom: 20, width: 'fit-content', flexWrap: 'wrap' }}>
        {ROLE_TABS.map((tab, i) => {
          const cnt = i === 0 ? totalAll : (counts[tab.role] ?? 0)
          return (
            <button key={i} onClick={() => setActiveTab(i)}
              style={{ padding: '8px 18px', borderRadius: 9, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', display: 'flex', alignItems: 'center', gap: 6, background: activeTab === i ? 'white' : 'transparent', color: activeTab === i ? '#1a1209' : '#a89478', boxShadow: activeTab === i ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
              {tab.label}
              <span style={{ fontSize: 13, padding: '2px 7px', borderRadius: 8, background: activeTab === i ? '#d1fae5' : '#e8e0d4', color: activeTab === i ? '#047857' : '#a89478', fontWeight: 800 }}>{cnt}</span>
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchUsers(ROLE_TABS[activeTab]?.role ?? '')}
              placeholder="Rechercher par nom, email… (Entrée)"
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%', color: '#1a1209' }}
            />
          </div>
          <button style={btnSecSm} onClick={() => fetchUsers(ROLE_TABS[activeTab]?.role ?? '')}>🔍 Rechercher</button>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ {error}</span>
            <button onClick={() => fetchUsers(ROLE_TABS[activeTab]?.role ?? '')}
              style={{ padding: '5px 12px', borderRadius: 8, background: 'white', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478', fontSize: 17 }}>
            Aucun utilisateur trouvé
          </div>
        )}

        {!loading && !error && users.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Utilisateur', 'Rôle', 'Statut', 'Dernière connexion', 'Classe / Titre', 'Actions'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const rl = ROLE_LABEL[user.role] ?? { label: user.role, bg: '#f1f5f9', color: '#475569' }
                const className = user.studentProfile?.class?.name ?? null
                const staffTitle = user.staffProfile?.title ?? null
                const ppClasses = user.classesProfessorPrincipal?.map((c: { name: string }) => c.name) ?? []
                return (
                  <tr key={user.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 700, color: '#1a1209', fontSize: 17 }}>{user.firstName} {user.lastName}</div>
                      <div style={{ fontSize: 14, color: '#a89478', marginTop: 2 }}>{user.email ?? '—'}</div>
                    </td>
                    <td style={tdStyle}><span style={badge(rl.bg, rl.color)}>{rl.label}</span></td>
                    <td style={tdStyle}>
                      <span style={badge(user.isActive ? '#d1fae5' : '#f1f5f9', user.isActive ? '#065f46' : '#475569')}>
                        {user.isActive ? '✓ Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td style={tdStyle}>{formatLastLogin(user.lastLogin)}</td>
                    <td style={tdStyle}>
                      {className ? <span style={badge('#f1f5f9', '#475569')}>{className}</span>
                        : ppClasses.length > 0
                          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={badge('#dbeafe', '#1e40af')}>🏫 PP {ppClasses[0]}</span>
                              {staffTitle && (
                                <span style={badge(staffTitle === 'Animateur Pédagogique' ? '#d1fae5' : '#ffedd5', staffTitle === 'Animateur Pédagogique' ? '#065f46' : '#9a3412')}>
                                  {staffTitle === 'Animateur Pédagogique' ? '⭐ AP' : staffTitle}
                                </span>
                              )}
                            </div>
                        : (user.role === 'TEACHER' && staffTitle === 'Animateur Pédagogique')
                          ? <span style={badge('#d1fae5', '#065f46')}>⭐ AP</span>
                        : staffTitle ? <span style={badge('#ffedd5', '#9a3412')}>{staffTitle}</span>
                        : <span style={{ color: '#a89478' }}>—</span>}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button onClick={() => setOpenDD(openDD === user.id ? null : user.id)}
                          style={{ background: 'none', border: '1.5px solid #d4c8b8', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 16, color: '#a89478', transition: 'all 0.12s' }}
                          onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669', background: '#d1fae5' })}
                          onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#a89478', background: 'none' })}>
                          ⋯
                        </button>
                        {openDD === user.id && (
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 100, overflow: 'hidden' }}>
                            {[
                              { icon: '✏️', label: 'Modifier', danger: false, onClick: () => openModUser(user) },
                              ...(user.role === 'STUDENT' ? [
                                { icon: '🔄', label: 'Changer de classe', danger: false, onClick: () => openTransfer(user) },
                                { icon: '📄', label: 'Générer document', danger: false, onClick: () => openDocModal(user) },
                              ] : []),
                              { icon: '🗑', label: 'Supprimer', danger: true, onClick: () => { setOpenDD(null); handleDelete(user.id) } },
                            ].map((item, j) => (
                              <div key={j} onClick={item.onClick}
                                style={{ padding: '11px 16px', fontSize: 16, fontWeight: 600, color: item.danger ? '#dc2626' : '#6b5c45', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.danger ? '#fee2e2' : '#f0ebe3'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                                {item.icon} {item.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal invitation */}
      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onSuccess={msg => { onToast(msg, 'success'); setInviteOpen(false); fetchUsers(ROLE_TABS[activeTab]?.role ?? '') }}
          staffTitles={staffTitles}
        />
      )}

      {/* ── Modal modifier utilisateur ── */}
      {modUser.open && (
        <div onClick={() => setModUser(EMPTY_MOD_USER)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 440, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>Modifier l&apos;utilisateur</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={sLb}>Prénom *</div>
                <input style={sIn} value={modUser.firstName} onChange={e => setModUser(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <div style={sLb}>Nom *</div>
                <input style={sIn} value={modUser.lastName} onChange={e => setModUser(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div style={sLb}>Email</div>
            <input style={sIn} type="email" value={modUser.email} onChange={e => setModUser(f => ({ ...f, email: e.target.value }))} />
            {modUser.error && <div style={sErr}>{modUser.error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setModUser(EMPTY_MOD_USER)}>Annuler</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: modUser.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: modUser.loading ? 0.7 : 1 }} onClick={submitModUser} disabled={modUser.loading}>
                {modUser.loading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal changer de classe ── */}
      {transfer.open && (
        <div onClick={() => setTransfer(EMPTY_TRANSFER)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 420, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>Changer de classe</div>
            <div style={{ fontSize: 15, color: '#a89478', marginBottom: 22 }}>{transfer.userName}</div>
            <div style={sLb}>Nouvelle classe *</div>
            <select style={sIn} value={transfer.classId} onChange={e => setTransfer(f => ({ ...f, classId: e.target.value }))}>
              <option value="">Sélectionner une classe…</option>
              {transfer.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {transfer.error && <div style={sErr}>{transfer.error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setTransfer(EMPTY_TRANSFER)}>Annuler</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: transfer.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: transfer.loading ? 0.7 : 1 }} onClick={submitTransfer} disabled={transfer.loading}>
                {transfer.loading ? 'Transfert…' : '🔄 Transférer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Générer document scolaire ── */}
      {docModal.open && (
        <div onClick={() => setDocModal(EMPTY_DOC_MODAL)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 460, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 4 }}>Générer un document</div>
            <div style={{ fontSize: 15, color: '#a89478', marginBottom: 24 }}>{docModal.userName}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: '📋', label: 'Certificat de scolarité', sub: 'Atteste l\'inscription de l\'élève', type: 'certificat' as const },
                { icon: '🪪', label: 'Carte d\'identité scolaire', sub: 'Recto (photo, classe) + Verso (règlement)', type: 'carte' as const },
                { icon: '📤', label: 'Lettre de transfert', sub: 'Uniquement pour élève transféré / sorti', type: 'lettre-transfert' as const, disabled: !['TRANSFERRED', 'LEFT', 'GRADUATED'].includes(docModal.status) },
              ].map(item => (
                <button key={item.type} disabled={item.disabled || docModal.loading}
                  onClick={() => generateDoc(item.type)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 12, border: `1.5px solid ${item.disabled ? '#f0ebe3' : '#d4c8b8'}`, background: item.disabled ? '#fafaf9' : 'white', cursor: item.disabled || docModal.loading ? 'not-allowed' : 'pointer', textAlign: 'left', fontFamily: 'inherit', opacity: item.disabled ? 0.45 : 1, transition: 'all 0.12s' }}
                  onMouseEnter={e => { if (!item.disabled && !docModal.loading) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', background: '#f0fdf4' }) }}
                  onMouseLeave={e => { if (!item.disabled) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', background: 'white' }) }}>
                  <span style={{ fontSize: 28 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1209' }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: '#a89478', marginTop: 2 }}>{item.sub}</div>
                  </div>
                </button>
              ))}
            </div>
            {docModal.loading && <div style={{ marginTop: 16, textAlign: 'center', color: '#059669', fontSize: 14, fontWeight: 600 }}>⏳ Génération du PDF en cours…</div>}
            {docModal.error && <div style={{ marginTop: 12, padding: '10px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>{docModal.error}</div>}
            <button style={{ marginTop: 20, width: '100%', padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#6b5c45', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setDocModal(EMPTY_DOC_MODAL)}>Fermer</button>
          </div>
        </div>
      )}

      {/* ── Modal Import Excel ── */}
      {importOpen && (
        <ImportModal
          onClose={() => { setImportOpen(false) }}
          onToast={onToast}
          onSuccess={() => fetchUsers(ROLE_TABS[activeTab]?.role ?? '')}
        />
      )}

      {/* ── Modal créer un utilisateur ── */}
      {createOpen && (
        <div onClick={() => { setCreateOpen(false); setCreateForm(EMPTY_CREATE_USER) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 540, maxWidth: '94vw', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>Créer un utilisateur</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Prénom *">
                <input value={createForm.firstName} onChange={e => setCreate('firstName', e.target.value)} placeholder="Marie" style={sIn} />
              </Field>
              <Field label="Nom *">
                <input value={createForm.lastName} onChange={e => setCreate('lastName', e.target.value)} placeholder="Ngono" style={sIn} />
              </Field>
            </div>

            <Field label="Email">
              <input type="email" value={createForm.email} onChange={e => setCreate('email', e.target.value)} placeholder="marie@lycee.cm" style={sIn} />
            </Field>

            <Field label="Téléphone">
              <input type="tel" value={createForm.phone} onChange={e => setCreate('phone', e.target.value)} placeholder="691234567" style={sIn} />
            </Field>

            <Field label="Rôle *">
              <select value={createForm.role} onChange={e => setCreate('role', e.target.value)} style={sIn}>
                <option value="TEACHER">👨‍🏫 Enseignant</option>
                <option value="STUDENT">👨‍🎓 Élève</option>
                <option value="PARENT">👨‍👩‍👧 Parent</option>
                <option value="STAFF">🔍 Personnel (Staff)</option>
              </select>
            </Field>

            {/* TEACHER — matières */}
            {createForm.role === 'TEACHER' && (
              <div>
                <div style={sLb}>Matières enseignées</div>
                <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, maxHeight: 160, overflowY: 'auto', padding: 4 }}>
                  {availSubjects.length === 0 && <div style={{ padding: 12, color: '#a89478', fontSize: 14, textAlign: 'center' }}>Aucune matière disponible</div>}
                  {availSubjects.map(sub => {
                    const checked = createForm.subjectIds.includes(sub.id)
                    return (
                      <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: checked ? '#f0fdf4' : 'transparent' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleSubjectId(sub.id)} style={{ accentColor: '#059669', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1209' }}>{sub.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STUDENT — classe, date naissance, genre */}
            {createForm.role === 'STUDENT' && (
              <>
                <Field label="Classe">
                  <select value={createForm.classeId} onChange={e => setCreate('classeId', e.target.value)} style={sIn}>
                    <option value="">Sélectionner une classe…</option>
                    {availClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label="Date de naissance">
                    <input type="date" value={createForm.dateOfBirth} onChange={e => setCreate('dateOfBirth', e.target.value)} style={sIn} />
                  </Field>
                  <Field label="Genre">
                    <select value={createForm.gender} onChange={e => setCreate('gender', e.target.value)} style={sIn}>
                      <option value="">—</option>
                      <option value="M">Masculin</option>
                      <option value="F">Féminin</option>
                    </select>
                  </Field>
                </div>
              </>
            )}

            {/* STAFF — titre */}
            {createForm.role === 'STAFF' && (
              <Field label="Poste">
                <select value={createForm.staffTitle} onChange={e => setCreate('staffTitle', e.target.value)} style={sIn}>
                  <option value="">Sélectionner un poste…</option>
                  {staffTitles.map(t => <option key={t.key} value={t.key}>{emojiForTitle(t.key)} {t.label}</option>)}
                </select>
              </Field>
            )}

            {createForm.error && <div style={sErr}>{createForm.error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setCreateOpen(false); setCreateForm(EMPTY_CREATE_USER) }}>Annuler</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: createForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: createForm.loading ? 0.7 : 1 }} onClick={submitCreateUser} disabled={createForm.loading}>
                {createForm.loading ? 'Création…' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const badge = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
  borderRadius: 22, fontSize: 14, fontWeight: 800, background: bg, color, whiteSpace: 'nowrap'
})

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }

const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
const sLb: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }
const sIn: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }
const sErr: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }
