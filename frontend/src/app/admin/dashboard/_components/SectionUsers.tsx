'use client'
import { useState, useEffect, useCallback } from 'react'

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
  emoji: string
  permissions: StaffPermission[]
}

const STAFF_TITLES: StaffTitle[] = [
  {
    key: 'Censeur', label: 'Censeur', emoji: '🔍',
    permissions: ['MANAGE_TIMETABLE','VALIDATE_GRADES','MANAGE_EXAMS','SUPERVISE_TEACHERS','MANAGE_ATTENDANCE','MANAGE_CLASS_COUNCIL','MANAGE_CATCHUP_REQUESTS','GENERATE_REPORTS','VIEW_SUPERVISED_GRADES','SUPERVISE_LESSON_PLANS'],
  },
  {
    key: 'Vice-Principal', label: 'Vice-Principal (anglophone)', emoji: '🔍',
    permissions: ['MANAGE_TIMETABLE','VALIDATE_GRADES','MANAGE_EXAMS','SUPERVISE_TEACHERS','MANAGE_ATTENDANCE','MANAGE_CLASS_COUNCIL','MANAGE_CATCHUP_REQUESTS','GENERATE_REPORTS','VIEW_SUPERVISED_GRADES','SUPERVISE_LESSON_PLANS'],
  },
  {
    key: 'Surveillant Général', label: 'Surveillant Général', emoji: '👁',
    permissions: ['MANAGE_ATTENDANCE','MANAGE_DISCIPLINE','MANAGE_INCIDENTS'],
  },
  {
    key: 'Intendant', label: 'Intendant / Bursar', emoji: '💰',
    permissions: ['MANAGE_FINANCE','VALIDATE_PAYMENTS','GENERATE_REPORTS'],
  },
  {
    key: 'Chef des Travaux', label: 'Chef des Travaux', emoji: '🔧',
    permissions: ['MANAGE_ATELIERS','MANAGE_PRACTICAL_GRADES','MANAGE_INTERNSHIPS','MANAGE_STAGE_CONVENTIONS','MANAGE_WORKSHOP_STOCK','GENERATE_REPORTS'],
  },
  {
    key: 'Documentaliste', label: 'Documentaliste / Bibliothécaire', emoji: '📚',
    permissions: ['MANAGE_LIBRARY'],
  },
  {
    key: "Conseiller d'Orientation", label: "Conseiller d'Orientation", emoji: '🧭',
    permissions: ['MANAGE_ORIENTATION'],
  },
  {
    key: 'Comptable-Matières', label: 'Comptable-Matières', emoji: '📦',
    permissions: ['MANAGE_PATRIMOINE','MANAGE_DEGRADATIONS'],
  },
]

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
}

// ── Fusion permissions sans doublon ──
function mergePermissions(selectedTitles: string[], customPerms: StaffPermission[]): StaffPermission[] {
  const set = new Set<StaffPermission>(customPerms)
  for (const tk of selectedTitles) {
    const title = STAFF_TITLES.find(t => t.key === tk)
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

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
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

  const mergedPerms = mergePermissions(form.selectedTitles, form.customPerms)
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
      const res = await fetch('/api/v2/users', {
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
                  {STAFF_TITLES.map(title => {
                    const checked = form.selectedTitles.includes(title.key)
                    return (
                      <label key={title.key}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderRadius: 12, border: `1.5px solid ${checked ? '#059669' : '#e8e0d4'}`, background: checked ? '#f0fdf4' : 'white', cursor: 'pointer', transition: 'all 0.12s' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleTitle(title.key)}
                          style={{ marginTop: 3, accentColor: '#059669', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1209' }}>{title.emoji} {title.label}</div>
                          <div style={{ fontSize: 13, color: '#a89478', marginTop: 3, lineHeight: 1.5 }}>
                            {title.permissions.slice(0, 4).map(p => PERMISSION_LABELS[p]).join(' · ')}
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
                        const isInherited = mergePermissions(form.selectedTitles, []).includes(perm)
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
const EMPTY_AP = { open: false, userId: '', userName: '', subjects: [] as { id: string; name: string }[], selectedIds: [] as string[], loadingSubjects: false, loading: false, error: '' }
const EMPTY_REMOVE_AP = { open: false, userId: '', userName: '', loading: false }
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
  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_USER)
  const [apForm, setApForm]         = useState(EMPTY_AP)
  const [removeAP, setRemoveAP]     = useState(EMPTY_REMOVE_AP)
  const [availClasses, setAvailClasses] = useState<ClassItem[]>([])
  const [availSubjects, setAvailSubjects] = useState<SubjectItem2[]>([])

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
      const res = await fetch(`/api/v2/users?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      setUsers(data.data || [])
      if (!roleFilter) {
        // compute counts per role from the full list
        const c: Record<string, number> = {}
        for (const u of (data.data || []) as UserItem[]) {
          c[u.role] = (c[u.role] || 0) + 1
        }
        setCounts(c)
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

  // ── Modifier utilisateur ────────────────────────────────────────────────
  const openModUser = (user: UserItem) => {
    setOpenDD(null)
    setModUser({ open: true, userId: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email ?? '', phone: '', loading: false, error: '' })
  }

  const submitModUser = async () => {
    if (!modUser.firstName.trim() || !modUser.lastName.trim()) { setModUser(f => ({ ...f, error: 'Prénom et nom obligatoires' })); return }
    setModUser(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/v2/users/${modUser.userId}`, {
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
      const res = await fetch('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setTransfer(f => ({ ...f, classes: data.data || [] }))
    } catch { /* silencieux */ }
  }

  const submitTransfer = async () => {
    if (!transfer.classId) { setTransfer(f => ({ ...f, error: 'Sélectionnez une classe' })); return }
    setTransfer(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/v2/users/students/${transfer.userId}/transfer`, {
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
        fetch('/api/v2/classes', { credentials: 'include' }),
        fetch('/api/v2/subjects', { credentials: 'include' }),
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

      const res = await fetch('/api/v2/users', {
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
      const res = await fetch(`/api/v2/users/${userId}`, { method: 'DELETE', credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Utilisateur supprimé', 'success')
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    }
  }

  // ── Désigner / Retirer AP ────────────────────────────────────────────────
  const openDesignerAP = async (user: UserItem) => {
    setOpenDD(null)
    setApForm({ ...EMPTY_AP, open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, loadingSubjects: true })
    try {
      const res = await fetch('/api/v2/subjects', { credentials: 'include' })
      const data = await res.json()
      setApForm(f => ({ ...f, subjects: data.data || [], loadingSubjects: false }))
    } catch {
      setApForm(f => ({ ...f, loadingSubjects: false }))
    }
  }

  const submitDesignerAP = async () => {
    if (apForm.selectedIds.length === 0) { setApForm(f => ({ ...f, error: 'Sélectionnez au moins une matière.' })); return }
    setApForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetch(`/api/v2/users/${apForm.userId}/ap-designation`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ASSIGN', departmentSubjectIds: apForm.selectedIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`${apForm.userName} désigné(e) Animateur Pédagogique`, 'success')
      setApForm(EMPTY_AP)
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
      setApForm(f => ({ ...f, loading: false }))
    }
  }

  const openRetireAP = (user: UserItem) => {
    setOpenDD(null)
    setRemoveAP({ open: true, userId: user.id, userName: `${user.firstName} ${user.lastName}`, loading: false })
  }

  const confirmRemoveAP = async () => {
    setRemoveAP(f => ({ ...f, loading: true }))
    try {
      const res = await fetch(`/api/v2/users/${removeAP.userId}/ap-designation`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REMOVE', departmentSubjectIds: [] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(`Désignation AP retirée de ${removeAP.userName}`, 'success')
      setRemoveAP(EMPTY_REMOVE_AP)
      fetchUsers(ROLE_TABS[activeTab]?.role ?? '')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
      setRemoveAP(f => ({ ...f, loading: false }))
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
                              ...(user.role === 'STUDENT' ? [{ icon: '🔄', label: 'Changer de classe', danger: false, onClick: () => openTransfer(user) }] : []),
                              ...(user.role === 'TEACHER' ? [
                                user.staffProfile?.title === 'Animateur Pédagogique'
                                  ? { icon: '⭐', label: 'Retirer la désignation AP', danger: false, onClick: () => openRetireAP(user) }
                                  : { icon: '⭐', label: 'Désigner comme AP', danger: false, onClick: () => openDesignerAP(user) }
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

      {/* ── Modal désigner AP ── */}
      {apForm.open && (
        <div onClick={() => setApForm(EMPTY_AP)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 500, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 4 }}>Désigner comme AP</div>
            <div style={{ fontSize: 15, color: '#a89478', marginBottom: 22 }}>{apForm.userName}</div>
            <div style={sLb}>Matières du département *</div>
            <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, maxHeight: 240, overflowY: 'auto', padding: 4, marginBottom: 10 }}>
              {apForm.loadingSubjects ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                  <div style={{ width: 22, height: 22, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                </div>
              ) : apForm.subjects.length === 0 ? (
                <div style={{ padding: 12, color: '#a89478', fontSize: 14, textAlign: 'center' }}>Aucune matière disponible</div>
              ) : apForm.subjects.map(sub => {
                const checked = apForm.selectedIds.includes(sub.id)
                return (
                  <label key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', background: checked ? '#f0fdf4' : 'transparent' }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => setApForm(f => ({ ...f, selectedIds: checked ? f.selectedIds.filter(x => x !== sub.id) : [...f.selectedIds, sub.id] }))}
                      style={{ accentColor: '#059669', width: 16, height: 16, cursor: 'pointer', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1209' }}>{sub.name}</span>
                  </label>
                )
              })}
            </div>
            <div style={{ fontSize: 13, color: '#a89478', marginBottom: 14 }}>
              {apForm.selectedIds.length} matière{apForm.selectedIds.length !== 1 ? 's' : ''} sélectionnée{apForm.selectedIds.length !== 1 ? 's' : ''}
            </div>
            {apForm.error && <div style={sErr}>{apForm.error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setApForm(EMPTY_AP)}>Annuler</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: apForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: apForm.loading ? 0.7 : 1 }} onClick={submitDesignerAP} disabled={apForm.loading || apForm.loadingSubjects}>
                {apForm.loading ? '⏳ Désignation…' : '⭐ Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation retrait AP ── */}
      {removeAP.open && (
        <div onClick={() => setRemoveAP(EMPTY_REMOVE_AP)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 420, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 14 }}>Retirer la désignation AP</div>
            <div style={{ fontSize: 16, color: '#6b5c45', lineHeight: 1.7, marginBottom: 24 }}>
              Retirer la désignation AP de <strong>{removeAP.userName}</strong> ?<br />
              <span style={{ fontSize: 14, color: '#a89478' }}>Les permissions Animateur Pédagogique seront supprimées.</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setRemoveAP(EMPTY_REMOVE_AP)}>Annuler</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', color: 'white', border: 'none', cursor: removeAP.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: removeAP.loading ? 0.7 : 1 }} onClick={confirmRemoveAP} disabled={removeAP.loading}>
                {removeAP.loading ? '⏳ Retrait…' : 'Retirer la désignation'}
              </button>
            </div>
          </div>
        </div>
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
                  {STAFF_TITLES.map(t => <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>)}
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
const filterSelect: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
const sLb: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }
const sIn: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }
const sErr: React.CSSProperties = { background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }
