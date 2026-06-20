'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface OrientationStats {
  fichesOuvertes: number
  elevesArisqueEleve: number
  elevesArisqueCritique: number
  entretiensThisMois: number
  recommandationsEnAttente: number
  repartitionRisque: Record<string, number>
}

interface FicheListItem {
  id: string
  status: string
  riskLevel: string
  mainConcern: string | null
  createdAt: string
  updatedAt: string
  student: {
    id: string
    firstName: string
    lastName: string
    studentProfile?: { class?: { name: string } | null } | null
  }
  _count: { entretiens: number; tests: number; suivis: number }
}

interface Entretien {
  id: string; ficheOrientationId: string; date: string; type: string; motif: string
  notes: string | null; recommendations: string | null; nextActions: string | null
  parentNotified: boolean; followUpDate: string | null; status: string; createdAt: string
}

interface TestAptitude {
  id: string; ficheOrientationId: string; type: string; datePassage: string
  resultats: string; interpretation: string | null; scoreGlobal: number | null; createdAt: string
}

interface Recommandation {
  id: string; ficheOrientationId: string; studentId: string
  serieActuelle: string; serieRecommandee: string; justification: string
  parentNotified: boolean; adminValidated: boolean; status: string; createdAt: string
}

interface Suivi {
  id: string; ficheOrientationId: string; date: string
  riskLevel: string; mainConcern: string; interventions: string | null
  prochainRdv: string | null; notes: string | null
}

interface FicheDetail extends FicheListItem {
  schoolId: string; academicYearId: string; conseillerId: string
  entretiens: Entretien[]; tests: TestAptitude[]
  recommandation: Recommandation | null; suivis: Suivi[]
}

interface StudentResult { id: string; firstName: string; lastName: string }
interface AcademicYear { id: string; label: string }

// ── Libellés ──────────────────────────────────────────────────────────────────

const RISK_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  FAIBLE:   { bg: '#d1fae5', color: '#065f46', label: '🟢 Faible'    },
  MOYEN:    { bg: '#fef3c7', color: '#92400e', label: '🟡 Moyen'     },
  ELEVE:    { bg: '#fee2e2', color: '#991b1b', label: '🔴 Élevé'     },
  CRITIQUE: { bg: '#fecaca', color: '#7f1d1d', label: '🚨 Critique'  },
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  OUVERTE:   { bg: '#d1fae5', color: '#065f46', label: 'Ouverte'    },
  EN_COURS:  { bg: '#dbeafe', color: '#1e40af', label: 'En cours'   },
  CLOSE:     { bg: '#f3f4f6', color: '#6b7280', label: 'Clôturée'   },
  TRANSFEREE:{ bg: '#ede9fe', color: '#5b21b6', label: 'Transférée' },
}

const MOTIF_OPTIONS = [
  { value: 'ORIENTATION_GENERALE',  label: 'Orientation générale'     },
  { value: 'DIFFICULTE_SCOLAIRE',    label: 'Difficulté scolaire'      },
  { value: 'CHOIX_FILIERE_BAC',      label: 'Choix filière BAC'        },
  { value: 'PROJET_PROFESSIONNEL',   label: 'Projet professionnel'     },
  { value: 'PROBLEME_COMPORTEMENT',  label: 'Problème de comportement' },
  { value: 'DEMANDE_ELEVE',          label: 'Demande de l\'élève'     },
  { value: 'DEMANDE_PARENT',         label: 'Demande du parent'        },
  { value: 'DEMANDE_ENSEIGNANT',     label: 'Demande d\'un enseignant' },
]

const TYPE_ENTRETIEN_OPTIONS = [
  { value: 'INDIVIDUEL',   label: 'Individuel'    },
  { value: 'GROUPE',       label: 'Groupe'        },
  { value: 'AVEC_PARENT',  label: 'Avec parent'   },
]

const TYPE_TEST_OPTIONS = [
  { value: 'COGNITIF',               label: 'Cognitif'                 },
  { value: 'INTERETS_PROFESSIONNELS',label: 'Intérêts professionnels'  },
  { value: 'PERSONNALITE',           label: 'Personnalité'             },
  { value: 'PSYCHOTECHNIQUE',        label: 'Psychotechnique'          },
]

const PREOCCUPATION_OPTIONS = [
  { value: 'SCOLAIRE',        label: 'Scolaire'        },
  { value: 'COMPORTEMENTAL',  label: 'Comportemental'  },
  { value: 'FAMILIAL',        label: 'Familial'        },
  { value: 'PROFESSIONNEL',   label: 'Professionnel'   },
  { value: 'SANTE',           label: 'Santé'           },
  { value: 'AUTRE',           label: 'Autre'           },
]

const RISK_OPTIONS = [
  { value: 'FAIBLE',   label: 'Faible'   },
  { value: 'MOYEN',    label: 'Moyen'    },
  { value: 'ELEVE',    label: 'Élevé'    },
  { value: 'CRITIQUE', label: 'Critique' },
]

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SectionOrientation({ onToast }: Props) {
  type View = 'dashboard' | 'fiche'
  const [view, setView]                     = useState<View>('dashboard')
  const [stats, setStats]                   = useState<OrientationStats | null>(null)
  const [fiches, setFiches]                 = useState<FicheListItem[]>([])
  const [total, setTotal]                   = useState(0)
  const [page, setPage]                     = useState(1)
  const [loadingList, setLoadingList]       = useState(true)
  const [loadingStats, setLoadingStats]     = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [riskFilter, setRiskFilter]         = useState('')
  const [statusFilter, setStatusFilter]     = useState('OUVERTE')
  const [years, setYears]                   = useState<AcademicYear[]>([])
  const [selectedYear, setSelectedYear]     = useState('')

  // fiche detail
  const [selectedFiche, setSelectedFiche]   = useState<FicheDetail | null>(null)
  const [loadingFiche, setLoadingFiche]     = useState(false)
  const [ficheTab, setFicheTab]             = useState<'entretiens' | 'tests' | 'serie' | 'suivis'>('entretiens')

  // modal nouvelle fiche
  const [newFicheOpen, setNewFicheOpen]     = useState(false)
  const [newFicheForm, setNewFicheForm]     = useState({
    studentSearch: '', studentResults: [] as StudentResult[],
    selectedStudent: null as StudentResult | null,
    mainConcern: '', loading: false, error: '',
  })

  // modal entretien
  const [entretienOpen, setEntretienOpen]   = useState(false)
  const [entretienForm, setEntretienForm]   = useState({
    date: '', type: 'INDIVIDUEL', motif: 'ORIENTATION_GENERALE',
    notes: '', recommendations: '', nextActions: '',
    parentNotified: false, followUpDate: '',
    loading: false, error: '',
  })

  // modal test
  const [testOpen, setTestOpen]             = useState(false)
  const [testForm, setTestForm]             = useState({
    type: 'COGNITIF', datePassage: '', resultats: '',
    interpretation: '', scoreGlobal: '',
    loading: false, error: '',
  })

  // modal suivi
  const [suiviOpen, setSuiviOpen]           = useState(false)
  const [suiviForm, setSuiviForm]           = useState({
    riskLevel: 'MOYEN', mainConcern: 'SCOLAIRE',
    interventions: '', prochainRdv: '', notes: '',
    loading: false, error: '',
  })

  const [validatingReco, setValidatingReco] = useState(false)

  // permission modifier entretien
  const [canEditEnt, setCanEditEnt] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('edunexus_user')
      if (raw) {
        const u = JSON.parse(raw)
        setCanEditEnt(u.role === 'ADMIN' || (u.permissions ?? []).includes('MANAGE_ORIENTATION'))
      }
    } catch {}
  }, [])

  // modal modifier entretien
  const [editEntOpen, setEditEntOpen] = useState(false)
  const [editEnt, setEditEnt] = useState({
    entretienId: '', notes: '', recommendations: '', nextActions: '',
    parentNotified: false, followUpDate: '', status: '', loading: false, error: '',
  })
  const [editOrig, setEditOrig] = useState({
    notes: '', recommendations: '', nextActions: '',
    parentNotified: false, followUpDate: '', status: '',
  })

  // modal recommandation
  const [recoOpen, setRecoOpen]             = useState(false)
  const [recoForm, setRecoForm]             = useState({
    serieActuelle: '', serieRecommandee: '', justification: '',
    loading: false, error: '',
  })

  // ── Fetch years ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchApi('/api/v2/academic-years', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list: AcademicYear[] = (d.data || []).map((y: any) => ({ id: y.id, label: y.label || y.name || y.id }))
        setYears(list)
        if (list.length > 0) setSelectedYear(list[0].id)
      })
      .catch(() => {})
  }, [])

  // ── Fetch stats ───────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const params = selectedYear ? `?academicYearId=${selectedYear}` : ''
      const res = await fetchApi(`/api/v2/orientation/stats${params}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      setStats(d.data)
    } catch { /* silencieux */ }
    finally { setLoadingStats(false) }
  }, [selectedYear])

  // ── Fetch fiches ─────────────────────────────────────────────────────────────
  const fetchFiches = useCallback(async (p = 1) => {
    setLoadingList(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(p) })
      if (riskFilter)   params.set('riskLevel', riskFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (selectedYear) params.set('academicYearId', selectedYear)
      const res = await fetchApi(`/api/v2/orientation/fiches?${params}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur serveur')
      setFiches(d.fiches || [])
      setTotal(d.total || 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally { setLoadingList(false) }
  }, [riskFilter, statusFilter, selectedYear])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { setPage(1); fetchFiches(1) }, [fetchFiches])

  // ── Fetch fiche detail ────────────────────────────────────────────────────────
  const openFiche = async (id: string) => {
    setLoadingFiche(true); setView('fiche'); setFicheTab('entretiens')
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${id}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message)
      setSelectedFiche(d.data)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
      setView('dashboard')
    } finally { setLoadingFiche(false) }
  }

  // ── Recherche élève ───────────────────────────────────────────────────────────
  const searchStudents = async (q: string, setter: (r: StudentResult[]) => void) => {
    if (q.trim().length < 2) { setter([]); return }
    try {
      const res = await fetchApi(`/api/v2/users?role=STUDENT&search=${encodeURIComponent(q)}&limit=8`, { credentials: 'include' })
      const d = await res.json()
      setter(d.data || [])
    } catch { setter([]) }
  }

  // ── Créer fiche ───────────────────────────────────────────────────────────────
  const submitNouvelleFiche = async () => {
    if (!newFicheForm.selectedStudent) {
      setNewFicheForm(f => ({ ...f, error: 'Sélectionnez un élève' })); return
    }
    if (!selectedYear) {
      setNewFicheForm(f => ({ ...f, error: 'Aucune année scolaire sélectionnée' })); return
    }
    setNewFicheForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/orientation/fiches', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: newFicheForm.selectedStudent.id,
          academicYearId: selectedYear,
          mainConcern: newFicheForm.mainConcern || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast(`Fiche créée pour ${newFicheForm.selectedStudent.firstName} ${newFicheForm.selectedStudent.lastName}`, 'success')
      setNewFicheOpen(false)
      setNewFicheForm({ studentSearch: '', studentResults: [], selectedStudent: null, mainConcern: '', loading: false, error: '' })
      fetchFiches(1); fetchStats()
    } catch (err) {
      setNewFicheForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Ajouter entretien ─────────────────────────────────────────────────────────
  const submitEntretien = async () => {
    if (!entretienForm.date) {
      setEntretienForm(f => ({ ...f, error: 'Date obligatoire' })); return
    }
    if (!selectedFiche) return
    setEntretienForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${selectedFiche.id}/entretiens`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: entretienForm.date,
          type: entretienForm.type,
          motif: entretienForm.motif,
          notes: entretienForm.notes || undefined,
          recommendations: entretienForm.recommendations || undefined,
          nextActions: entretienForm.nextActions || undefined,
          parentNotified: entretienForm.parentNotified,
          followUpDate: entretienForm.followUpDate || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast('Entretien planifié', 'success')
      setEntretienOpen(false)
      setEntretienForm({ date: '', type: 'INDIVIDUEL', motif: 'ORIENTATION_GENERALE', notes: '', recommendations: '', nextActions: '', parentNotified: false, followUpDate: '', loading: false, error: '' })
      openFiche(selectedFiche.id)
    } catch (err) {
      setEntretienForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Marquer entretien réalisé ─────────────────────────────────────────────────
  const marquerRealise = async (entretienId: string) => {
    try {
      const res = await fetchApi(`/api/v2/orientation/entretiens/${entretienId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REALISE' }),
      })
      if (!res.ok) throw new Error()
      onToast('Entretien marqué comme réalisé', 'success')
      if (selectedFiche) openFiche(selectedFiche.id)
    } catch { onToast('Erreur', 'error') }
  }

  // ── Ajouter test ──────────────────────────────────────────────────────────────
  const submitTest = async () => {
    if (!testForm.datePassage || !testForm.resultats) {
      setTestForm(f => ({ ...f, error: 'Date et résultats obligatoires' })); return
    }
    if (!selectedFiche) return
    setTestForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${selectedFiche.id}/tests`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: testForm.type,
          datePassage: testForm.datePassage,
          resultats: testForm.resultats,
          interpretation: testForm.interpretation || undefined,
          scoreGlobal: testForm.scoreGlobal ? parseInt(testForm.scoreGlobal) : undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast('Test ajouté', 'success')
      setTestOpen(false)
      setTestForm({ type: 'COGNITIF', datePassage: '', resultats: '', interpretation: '', scoreGlobal: '', loading: false, error: '' })
      openFiche(selectedFiche.id)
    } catch (err) {
      setTestForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Ajouter suivi ─────────────────────────────────────────────────────────────
  const submitSuivi = async () => {
    if (!selectedFiche) return
    setSuiviForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${selectedFiche.id}/suivis`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riskLevel: suiviForm.riskLevel,
          mainConcern: suiviForm.mainConcern,
          interventions: suiviForm.interventions || undefined,
          prochainRdv: suiviForm.prochainRdv || undefined,
          notes: suiviForm.notes || undefined,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast('Suivi enregistré', 'success')
      setSuiviOpen(false)
      setSuiviForm({ riskLevel: 'MOYEN', mainConcern: 'SCOLAIRE', interventions: '', prochainRdv: '', notes: '', loading: false, error: '' })
      openFiche(selectedFiche.id); fetchStats()
    } catch (err) {
      setSuiviForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Créer recommandation ──────────────────────────────────────────────────────
  const submitReco = async () => {
    if (!recoForm.serieActuelle || !recoForm.serieRecommandee || !recoForm.justification) {
      setRecoForm(f => ({ ...f, error: 'Tous les champs sont obligatoires' })); return
    }
    if (!selectedFiche) return
    setRecoForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/fiches/${selectedFiche.id}/recommandation-serie`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serieActuelle: recoForm.serieActuelle,
          serieRecommandee: recoForm.serieRecommandee,
          justification: recoForm.justification,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast('Recommandation enregistrée', 'success')
      setRecoOpen(false)
      setRecoForm({ serieActuelle: '', serieRecommandee: '', justification: '', loading: false, error: '' })
      openFiche(selectedFiche.id)
    } catch (err) {
      setRecoForm(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Valider recommandation ────────────────────────────────────────────────────
  const validerRecommandation = async () => {
    if (!selectedFiche?.recommandation) return
    setValidatingReco(true)
    try {
      const res = await fetchApi(`/api/v2/orientation/recommandations/${selectedFiche.recommandation.id}/valider`, {
        method: 'PATCH', credentials: 'include',
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      onToast('Recommandation validée par l\'administration', 'success')
      openFiche(selectedFiche.id)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setValidatingReco(false)
    }
  }

  // ── Modifier entretien ────────────────────────────────────────────────────────
  const openEditEntretien = (e: Entretien) => {
    const orig = {
      notes: e.notes ?? '',
      recommendations: e.recommendations ?? '',
      nextActions: e.nextActions ?? '',
      parentNotified: e.parentNotified,
      followUpDate: e.followUpDate ? new Date(e.followUpDate).toISOString().slice(0, 10) : '',
      status: e.status,
    }
    setEditOrig(orig)
    setEditEnt({ entretienId: e.id, ...orig, loading: false, error: '' })
    setEditEntOpen(true)
  }

  const submitModifierEntretien = async () => {
    const body: Record<string, unknown> = {}
    if (editEnt.notes !== editOrig.notes)                   body.notes = editEnt.notes || null
    if (editEnt.recommendations !== editOrig.recommendations) body.recommendations = editEnt.recommendations || null
    if (editEnt.nextActions !== editOrig.nextActions)        body.nextActions = editEnt.nextActions || null
    if (editEnt.parentNotified !== editOrig.parentNotified)  body.parentNotified = editEnt.parentNotified
    if (editEnt.followUpDate !== editOrig.followUpDate)      body.followUpDate = editEnt.followUpDate || null
    if (editEnt.status !== editOrig.status)                  body.status = editEnt.status
    if (Object.keys(body).length === 0) { setEditEntOpen(false); return }
    setEditEnt(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/orientation/entretiens/${editEnt.entretienId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) {
        if (res.status === 403) { onToast('Permission insuffisante', 'error'); setEditEntOpen(false); return }
        setEditEnt(f => ({ ...f, error: d.message || 'Erreur', loading: false })); return
      }
      onToast('Entretien modifié avec succès', 'success')
      setEditEntOpen(false)
      if (selectedFiche) openFiche(selectedFiche.id)
    } catch (err) {
      setEditEnt(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function Badge({ value, map }: { value: string; map: Record<string, { bg: string; color: string; label: string }> }) {
    const b = map[value] ?? { bg: '#f3f4f6', color: '#6b7280', label: value }
    return (
      <span style={{ background: b.bg, color: b.color, borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>
        {b.label}
      </span>
    )
  }

  function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
          {children}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VUE 1 — Tableau de bord
  // ═══════════════════════════════════════════════════════════════════════════

  function ViewDashboard() {
    const pages = Math.ceil(total / 20)
    return (
      <>
        {/* En-tête */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
          <div>
            <div style={sTitle}>Orientation</div>
            <div style={sSub}>Suivi et conseils d&apos;orientation des élèves</div>
          </div>
          <button style={btnPrim} onClick={() => setNewFicheOpen(true)}>+ Nouveau dossier</button>
        </div>

        {/* Filtre année + risque */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          {years.length > 0 && (
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={sSelect}>
              {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          )}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sSelect}>
            <option value="">Tous les statuts</option>
            <option value="OUVERTE">Ouverte</option>
            <option value="EN_COURS">En cours</option>
            <option value="CLOSE">Clôturée</option>
            <option value="TRANSFEREE">Transférée</option>
          </select>
          <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} style={sSelect}>
            <option value="">Tous les niveaux de risque</option>
            <option value="FAIBLE">Faible</option>
            <option value="MOYEN">Moyen</option>
            <option value="ELEVE">Élevé</option>
            <option value="CRITIQUE">Critique</option>
          </select>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 26 }}>
          {[
            { icon: '📋', bg: '#d1fae5', color: '#065f46', val: loadingStats ? '…' : String(stats?.fichesOuvertes ?? 0),            label: 'Fiches ouvertes'          },
            { icon: '🔴', bg: '#fee2e2', color: '#991b1b', val: loadingStats ? '…' : String((stats?.elevesArisqueEleve ?? 0) + (stats?.elevesArisqueCritique ?? 0)), label: 'Élèves à risque élevé' },
            { icon: '📅', bg: '#dbeafe', color: '#1e40af', val: loadingStats ? '…' : String(stats?.entretiensThisMois ?? 0),        label: 'Entretiens ce mois'        },
            { icon: '🎓', bg: '#ede9fe', color: '#5b21b6', val: loadingStats ? '…' : String(stats?.recommandationsEnAttente ?? 0),  label: 'Recommandations en attente'},
          ].map((s, i) => (
            <div key={i} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '20px 24px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 14, color: '#a89478', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tableau */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid #e8e0d4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#1a1209' }}>Élèves suivis</span>
            <span style={{ fontSize: 14, color: '#a89478' }}>{total} fiche{total > 1 ? 's' : ''}</span>
          </div>

          {loadingList ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#a89478' }}>Chargement…</div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>{error}</div>
          ) : fiches.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#a89478' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧭</div>
              <div style={{ fontSize: 16 }}>Aucune fiche pour les filtres sélectionnés</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#faf8f5' }}>
                    {['Élève', 'Classe', 'Risque', 'Statut', 'Entretiens', 'Dernière MÀJ', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: '#a89478', borderBottom: '1px solid #e8e0d4', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fiches.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid #f0ebe3' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#1a1209' }}>
                        {f.student.firstName} {f.student.lastName}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#6b7280' }}>
                        {f.student.studentProfile?.class?.name ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge value={f.riskLevel} map={RISK_BADGE} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge value={f.status} map={STATUS_BADGE} />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
                        {f._count.entretiens}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#a89478' }}>
                        {fmt(f.updatedAt)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => openFiche(f.id)}
                          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                          Voir la fiche
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div style={{ padding: '14px 24px', display: 'flex', gap: 8, justifyContent: 'center' }}>
              {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => { setPage(p); fetchFiches(p) }}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: '1.5px solid', borderColor: p === page ? '#059669' : '#e8e0d4', background: p === page ? '#059669' : 'white', color: p === page ? 'white' : '#6b7280', cursor: 'pointer' }}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VUE 2 — Fiche détaillée
  // ═══════════════════════════════════════════════════════════════════════════

  function ViewFiche() {
    if (loadingFiche || !selectedFiche) {
      return <div style={{ padding: 60, textAlign: 'center', color: '#a89478' }}>Chargement de la fiche…</div>
    }
    const f = selectedFiche
    const nomEleve = `${f.student.firstName} ${f.student.lastName}`
    const classe = f.student.studentProfile?.class?.name ?? '—'

    return (
      <>
        {/* Retour + en-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <button onClick={() => setView('dashboard')} style={{ ...btnSec, padding: '8px 14px', fontSize: 14 }}>← Retour</button>
          <div>
            <div style={sTitle}>{nomEleve}</div>
            <div style={{ ...sSub, display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
              <span>{classe}</span>
              <Badge value={f.riskLevel} map={RISK_BADGE} />
              <Badge value={f.status} map={STATUS_BADGE} />
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: '2px solid #e8e0d4', paddingBottom: 0 }}>
          {([
            { key: 'entretiens', label: '📋 Entretiens', count: f.entretiens.length },
            { key: 'tests',      label: '🧪 Tests',       count: f.tests.length },
            { key: 'serie',      label: '🎓 Série BAC',   count: f.recommandation ? 1 : 0 },
            { key: 'suivis',     label: '📊 Suivi',       count: f.suivis.length },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setFicheTab(tab.key)}
              style={{
                padding: '10px 18px', borderRadius: '10px 10px 0 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: ficheTab === tab.key ? '#059669' : 'transparent',
                color: ficheTab === tab.key ? 'white' : '#a89478',
                borderBottom: ficheTab === tab.key ? '2px solid #059669' : '2px solid transparent',
                marginBottom: -2,
              }}>
              {tab.label} {tab.count > 0 && <span style={{ marginLeft: 6, background: ficheTab === tab.key ? 'rgba(255,255,255,0.3)' : '#e8e0d4', borderRadius: 99, padding: '1px 8px', fontSize: 12 }}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Tab: Entretiens */}
        {ficheTab === 'entretiens' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button style={btnPrim} onClick={() => setEntretienOpen(true)}>+ Planifier un entretien</button>
            </div>
            {f.entretiens.length === 0 ? (
              <EmptyState icon="📋" text="Aucun entretien enregistré" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {f.entretiens.map(e => (
                  <div key={e.id} style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 14, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1209' }}>{fmt(e.date)}</span>
                        <span style={{ marginLeft: 10, fontSize: 13, color: '#6b7280' }}>{e.type.replace('_', ' ')} · {e.motif.replace(/_/g, ' ')}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {e.parentNotified && <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>👪 Parent notifié</span>}
                        <span style={{
                          background: e.status === 'REALISE' ? '#d1fae5' : e.status === 'ANNULE' ? '#fee2e2' : '#fef3c7',
                          color: e.status === 'REALISE' ? '#065f46' : e.status === 'ANNULE' ? '#991b1b' : '#92400e',
                          borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700,
                        }}>{e.status}</span>
                        {canEditEnt && (
                          <button onClick={() => openEditEntretien(e)} style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }}>✏️ Modifier</button>
                        )}
                        {e.status === 'PLANIFIE' && (
                          <button onClick={() => marquerRealise(e.id)} style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }}>✓ Réalisé</button>
                        )}
                      </div>
                    </div>
                    {e.notes && <p style={{ fontSize: 14, color: '#6b7280', marginTop: 6, lineHeight: 1.6 }}><strong>Notes :</strong> {e.notes}</p>}
                    {e.recommendations && <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4, lineHeight: 1.6 }}><strong>Recommandations :</strong> {e.recommendations}</p>}
                    {e.followUpDate && <p style={{ fontSize: 13, color: '#a89478', marginTop: 6 }}>Prochain RDV : {fmt(e.followUpDate)}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Tests */}
        {ficheTab === 'tests' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button style={btnPrim} onClick={() => setTestOpen(true)}>+ Ajouter un test</button>
            </div>
            {f.tests.length === 0 ? (
              <EmptyState icon="🧪" text="Aucun test d'aptitude enregistré" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {f.tests.map(t => (
                  <div key={t.id} style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 14, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1209' }}>{t.type.replace(/_/g, ' ')}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {t.scoreGlobal != null && (
                          <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>{t.scoreGlobal}/100</span>
                        )}
                        <span style={{ fontSize: 13, color: '#a89478' }}>{fmt(t.datePassage)}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}><strong>Résultats :</strong> {t.resultats}</p>
                    {t.interpretation && <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4, lineHeight: 1.6 }}><strong>Interprétation :</strong> {t.interpretation}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Série BAC */}
        {ficheTab === 'serie' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button style={btnPrim} onClick={() => setRecoOpen(true)}>
                {f.recommandation ? '✏️ Modifier la recommandation' : '+ Créer une recommandation'}
              </button>
            </div>
            {!f.recommandation ? (
              <EmptyState icon="🎓" text="Aucune recommandation de série BAC" />
            ) : (
              <div style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 14, padding: '24px 28px' }}>
                <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: '#a89478', fontWeight: 700, marginBottom: 4 }}>SÉRIE ACTUELLE</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#1a1209' }}>{f.recommandation.serieActuelle}</div>
                  </div>
                  <div style={{ fontSize: 28, color: '#a89478', alignSelf: 'center' }}>→</div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: '#a89478', fontWeight: 700, marginBottom: 4 }}>SÉRIE RECOMMANDÉE</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#059669' }}>{f.recommandation.serieRecommandee}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#a89478', fontWeight: 700, marginBottom: 4 }}>STATUT</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge value={f.recommandation.status} map={{
                        PROPOSEE:        { bg: '#fef3c7', color: '#92400e', label: 'Proposée'          },
                        VALIDEE_ADMIN:   { bg: '#d1fae5', color: '#065f46', label: '✓ Validée admin'   },
                        ACCEPTEE_PARENT: { bg: '#d1fae5', color: '#065f46', label: '✓ Acceptée parent' },
                        REFUSEE_PARENT:  { bg: '#fee2e2', color: '#991b1b', label: '✗ Refusée parent'  },
                        TRANSMISE_DRES:  { bg: '#dbeafe', color: '#1e40af', label: 'Transmise DRES'    },
                      }} />
                      {f.recommandation.status === 'PROPOSEE' && (
                        <button onClick={validerRecommandation} disabled={validatingReco}
                          style={{ padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#d1fae5', color: '#065f46', border: '1px solid rgba(5,150,105,0.3)', cursor: validatingReco ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                          {validatingReco ? '⏳' : '✓ Valider'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}><strong>Justification :</strong> {f.recommandation.justification}</p>
                <div style={{ marginTop: 12, fontSize: 13, color: '#a89478' }}>
                  {f.recommandation.adminValidated && '✓ Validée par l\'admin · '}
                  {f.recommandation.parentNotified && '👪 Parent notifié · '}
                  Créée le {fmt(f.recommandation.createdAt)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Suivis */}
        {ficheTab === 'suivis' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button style={btnPrim} onClick={() => setSuiviOpen(true)}>+ Enregistrer un suivi</button>
            </div>
            {f.suivis.length === 0 ? (
              <EmptyState icon="📊" text="Aucun suivi enregistré" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {f.suivis.map(s => (
                  <div key={s.id} style={{ background: 'white', border: '1.5px solid #e8e0d4', borderRadius: 14, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1209' }}>{fmt(s.date)}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Badge value={s.riskLevel} map={RISK_BADGE} />
                        <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 600 }}>
                          {s.mainConcern.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    {s.interventions && <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}><strong>Interventions :</strong> {s.interventions}</p>}
                    {s.notes && <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4, lineHeight: 1.6 }}>{s.notes}</p>}
                    {s.prochainRdv && <p style={{ fontSize: 13, color: '#a89478', marginTop: 6 }}>Prochain RDV : {fmt(s.prochainRdv)}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  function EmptyState({ icon, text }: { icon: string; text: string }) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478', background: '#faf8f5', borderRadius: 14, border: '1.5px dashed #e8e0d4' }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 15 }}>{text}</div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Modales
  // ═══════════════════════════════════════════════════════════════════════════

  function ModalNouvelleFiche() {
    return (
      <ModalOverlay onClose={() => setNewFicheOpen(false)}>
        <div style={sModalTitle}>Nouveau dossier d&apos;orientation</div>
        <div style={sLabel}>Élève *</div>
        <input
          style={sInput}
          placeholder="Rechercher un élève…"
          value={newFicheForm.studentSearch}
          onChange={e => {
            setNewFicheForm(f => ({ ...f, studentSearch: e.target.value, selectedStudent: null }))
            searchStudents(e.target.value, r => setNewFicheForm(f => ({ ...f, studentResults: r })))
          }}
        />
        {newFicheForm.selectedStudent && (
          <div style={{ background: '#d1fae5', color: '#065f46', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
            ✓ {newFicheForm.selectedStudent.firstName} {newFicheForm.selectedStudent.lastName}
          </div>
        )}
        {newFicheForm.studentResults.length > 0 && !newFicheForm.selectedStudent && (
          <div style={{ border: '1.5px solid #e8e0d4', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
            {newFicheForm.studentResults.map(s => (
              <div key={s.id} onClick={() => setNewFicheForm(f => ({ ...f, selectedStudent: s, studentSearch: `${s.firstName} ${s.lastName}`, studentResults: [] }))}
                style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid #f0ebe3', color: '#1a1209' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#faf8f5')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                {s.firstName} {s.lastName}
              </div>
            ))}
          </div>
        )}
        <div style={sLabel}>Préoccupation principale</div>
        <select style={sInput} value={newFicheForm.mainConcern} onChange={e => setNewFicheForm(f => ({ ...f, mainConcern: e.target.value }))}>
          <option value="">Sélectionner…</option>
          {PREOCCUPATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {newFicheForm.error && <div style={sError}>{newFicheForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setNewFicheOpen(false)}>Annuler</button>
          <button style={{ ...btnPrim, flex: 1, opacity: newFicheForm.loading ? 0.7 : 1 }} onClick={submitNouvelleFiche} disabled={newFicheForm.loading}>
            {newFicheForm.loading ? 'Création…' : 'Créer le dossier'}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalEntretien() {
    return (
      <ModalOverlay onClose={() => setEntretienOpen(false)}>
        <div style={sModalTitle}>Planifier un entretien</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>Date et heure *</div>
            <input style={sInput} type="datetime-local" value={entretienForm.date} onChange={e => setEntretienForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <div style={sLabel}>Type</div>
            <select style={sInput} value={entretienForm.type} onChange={e => setEntretienForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_ENTRETIEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div style={sLabel}>Motif</div>
        <select style={sInput} value={entretienForm.motif} onChange={e => setEntretienForm(f => ({ ...f, motif: e.target.value }))}>
          {MOTIF_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div style={sLabel}>Notes</div>
        <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} value={entretienForm.notes} onChange={e => setEntretienForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observations, contexte…" />
        <div style={sLabel}>Recommandations</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={entretienForm.recommendations} onChange={e => setEntretienForm(f => ({ ...f, recommendations: e.target.value }))} placeholder="Actions recommandées…" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>Date de suivi prévue</div>
            <input style={sInput} type="date" value={entretienForm.followUpDate} onChange={e => setEntretienForm(f => ({ ...f, followUpDate: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 28 }}>
            <input type="checkbox" id="pn" checked={entretienForm.parentNotified} onChange={e => setEntretienForm(f => ({ ...f, parentNotified: e.target.checked }))} />
            <label htmlFor="pn" style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}>Parent notifié</label>
          </div>
        </div>
        {entretienForm.error && <div style={sError}>{entretienForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setEntretienOpen(false)}>Annuler</button>
          <button style={{ ...btnPrim, flex: 1, opacity: entretienForm.loading ? 0.7 : 1 }} onClick={submitEntretien} disabled={entretienForm.loading}>
            {entretienForm.loading ? 'Enregistrement…' : 'Planifier'}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalTest() {
    return (
      <ModalOverlay onClose={() => setTestOpen(false)}>
        <div style={sModalTitle}>Ajouter un test d&apos;aptitude</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>Type de test *</div>
            <select style={sInput} value={testForm.type} onChange={e => setTestForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_TEST_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <div style={sLabel}>Date de passation *</div>
            <input style={sInput} type="date" value={testForm.datePassage} onChange={e => setTestForm(f => ({ ...f, datePassage: e.target.value }))} />
          </div>
        </div>
        <div style={sLabel}>Résultats *</div>
        <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} value={testForm.resultats} onChange={e => setTestForm(f => ({ ...f, resultats: e.target.value }))} placeholder="Description des résultats…" />
        <div style={sLabel}>Interprétation</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={testForm.interpretation} onChange={e => setTestForm(f => ({ ...f, interpretation: e.target.value }))} placeholder="Analyse clinique des résultats…" />
        <div style={sLabel}>Score global (/100)</div>
        <input style={sInput} type="number" min="0" max="100" value={testForm.scoreGlobal} onChange={e => setTestForm(f => ({ ...f, scoreGlobal: e.target.value }))} placeholder="Optionnel" />
        {testForm.error && <div style={sError}>{testForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setTestOpen(false)}>Annuler</button>
          <button style={{ ...btnPrim, flex: 1, opacity: testForm.loading ? 0.7 : 1 }} onClick={submitTest} disabled={testForm.loading}>
            {testForm.loading ? 'Enregistrement…' : 'Ajouter le test'}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalSuivi() {
    return (
      <ModalOverlay onClose={() => setSuiviOpen(false)}>
        <div style={sModalTitle}>Enregistrer un suivi</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>Niveau de risque *</div>
            <select style={sInput} value={suiviForm.riskLevel} onChange={e => setSuiviForm(f => ({ ...f, riskLevel: e.target.value }))}>
              {RISK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <div style={sLabel}>Préoccupation principale *</div>
            <select style={sInput} value={suiviForm.mainConcern} onChange={e => setSuiviForm(f => ({ ...f, mainConcern: e.target.value }))}>
              {PREOCCUPATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div style={sLabel}>Interventions réalisées</div>
        <textarea style={{ ...sInput, minHeight: 70, resize: 'vertical' }} value={suiviForm.interventions} onChange={e => setSuiviForm(f => ({ ...f, interventions: e.target.value }))} placeholder="Actions menées…" />
        <div style={sLabel}>Notes</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={suiviForm.notes} onChange={e => setSuiviForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observations générales…" />
        <div style={sLabel}>Prochain rendez-vous</div>
        <input style={sInput} type="date" value={suiviForm.prochainRdv} onChange={e => setSuiviForm(f => ({ ...f, prochainRdv: e.target.value }))} />
        {suiviForm.error && <div style={sError}>{suiviForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setSuiviOpen(false)}>Annuler</button>
          <button style={{ ...btnPrim, flex: 1, opacity: suiviForm.loading ? 0.7 : 1 }} onClick={submitSuivi} disabled={suiviForm.loading}>
            {suiviForm.loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalReco() {
    const SERIES = ['A4', 'B', 'C', 'D', 'E', 'TI', 'ABI', 'G', 'H', 'F']
    return (
      <ModalOverlay onClose={() => setRecoOpen(false)}>
        <div style={sModalTitle}>Recommandation de série BAC</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>Série actuelle *</div>
            <select style={sInput} value={recoForm.serieActuelle} onChange={e => setRecoForm(f => ({ ...f, serieActuelle: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {SERIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={sLabel}>Série recommandée *</div>
            <select style={sInput} value={recoForm.serieRecommandee} onChange={e => setRecoForm(f => ({ ...f, serieRecommandee: e.target.value }))}>
              <option value="">Sélectionner…</option>
              {SERIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={sLabel}>Justification *</div>
        <textarea style={{ ...sInput, minHeight: 100, resize: 'vertical' }} value={recoForm.justification} onChange={e => setRecoForm(f => ({ ...f, justification: e.target.value }))} placeholder="Motivation détaillée de la recommandation…" />
        {recoForm.error && <div style={sError}>{recoForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setRecoOpen(false)}>Annuler</button>
          <button style={{ ...btnPrim, flex: 1, opacity: recoForm.loading ? 0.7 : 1 }} onClick={submitReco} disabled={recoForm.loading}>
            {recoForm.loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalModifierEntretien() {
    return (
      <ModalOverlay onClose={() => setEditEntOpen(false)}>
        <div style={sModalTitle}>Modifier l&apos;entretien</div>
        <div style={sLabel}>Notes</div>
        <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} value={editEnt.notes} onChange={e => setEditEnt(f => ({ ...f, notes: e.target.value }))} placeholder="Observations, contexte…" />
        <div style={sLabel}>Recommandations</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={editEnt.recommendations} onChange={e => setEditEnt(f => ({ ...f, recommendations: e.target.value }))} placeholder="Actions recommandées…" />
        <div style={sLabel}>Prochaines actions</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={editEnt.nextActions} onChange={e => setEditEnt(f => ({ ...f, nextActions: e.target.value }))} placeholder="Actions à entreprendre…" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>Statut</div>
            <select style={sInput} value={editEnt.status} onChange={e => setEditEnt(f => ({ ...f, status: e.target.value }))}>
              <option value="PLANIFIE">Planifié</option>
              <option value="REALISE">Réalisé</option>
              <option value="ANNULE">Annulé</option>
            </select>
          </div>
          <div>
            <div style={sLabel}>Date de suivi</div>
            <input style={sInput} type="date" value={editEnt.followUpDate} onChange={e => setEditEnt(f => ({ ...f, followUpDate: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <input type="checkbox" id="pn-edit" checked={editEnt.parentNotified} onChange={e => setEditEnt(f => ({ ...f, parentNotified: e.target.checked }))} />
          <label htmlFor="pn-edit" style={{ fontSize: 14, color: '#374151', cursor: 'pointer' }}>Parent notifié</label>
        </div>
        {editEnt.error && <div style={sError}>{editEnt.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setEditEntOpen(false)}>Annuler</button>
          <button style={{ ...btnPrim, flex: 1, opacity: editEnt.loading ? 0.7 : 1 }} onClick={submitModifierEntretien} disabled={editEnt.loading}>
            {editEnt.loading ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Rendu principal
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      {view === 'dashboard' && <ViewDashboard />}
      {view === 'fiche'     && <ViewFiche />}

      {newFicheOpen   && <ModalNouvelleFiche />}
      {entretienOpen  && <ModalEntretien />}
      {editEntOpen    && <ModalModifierEntretien />}
      {testOpen       && <ModalTest />}
      {suiviOpen      && <ModalSuivi />}
      {recoOpen       && <ModalReco />}
    </div>
  )
}

// ── Styles partagés ───────────────────────────────────────────────────────────

const sTitle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209',
}
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 11, fontSize: 15, fontWeight: 800,
  background: 'linear-gradient(135deg,#059669,#047857)', color: 'white',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
const btnSec: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 11, fontSize: 15, fontWeight: 700,
  background: 'white', color: '#374151', border: '1.5px solid #e8e0d4',
  cursor: 'pointer', fontFamily: 'inherit',
}
const sSelect: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4',
  background: 'white', color: '#374151', fontFamily: 'inherit', cursor: 'pointer',
}
const sInput: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
  border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209',
  fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12,
}
const sLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }
const sError: React.CSSProperties = {
  background: '#fee2e2', color: '#991b1b', borderRadius: 8,
  padding: '8px 14px', fontSize: 13, fontWeight: 600, marginTop: 4,
}
const sModalTitle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700,
  color: '#1a1209', marginBottom: 22,
}
