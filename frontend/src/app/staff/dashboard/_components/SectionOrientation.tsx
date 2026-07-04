'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

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

const RISK_STYLE: Record<string, { bg: string; color: string }> = {
  FAIBLE:   { bg: 'var(--green-light)', color: 'var(--green)' },
  MOYEN:    { bg: 'var(--amber-light)', color: 'var(--amber)' },
  ELEVE:    { bg: 'var(--red-light)', color: 'var(--red)' },
  CRITIQUE: { bg: 'var(--red-light)', color: 'var(--red)' },
}

const RISK_LABEL_KEY: Record<string, string> = {
  FAIBLE: 'riskBadgeFaible',
  MOYEN: 'riskBadgeMoyen',
  ELEVE: 'riskBadgeEleve',
  CRITIQUE: 'riskBadgeCritique',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  OUVERTE:   { bg: 'var(--green-light)', color: 'var(--green)' },
  EN_COURS:  { bg: 'var(--blue-light)', color: 'var(--blue)' },
  CLOSE:     { bg: 'var(--bg2)', color: 'var(--text3)' },
  TRANSFEREE:{ bg: 'var(--purple-light)', color: 'var(--purple)' },
}

const STATUS_LABEL_KEY: Record<string, string> = {
  OUVERTE: 'statusOuverte',
  EN_COURS: 'statusEnCours',
  CLOSE: 'statusClose',
  TRANSFEREE: 'statusTransferee',
}

const MOTIF_OPTIONS = [
  { value: 'ORIENTATION_GENERALE',  labelKey: 'motifOrientationGenerale' },
  { value: 'DIFFICULTE_SCOLAIRE',   labelKey: 'motifDifficulteScolaire' },
  { value: 'CHOIX_FILIERE_BAC',     labelKey: 'motifChoixFiliere' },
  { value: 'PROJET_PROFESSIONNEL',  labelKey: 'motifProjetPro' },
  { value: 'PROBLEME_COMPORTEMENT', labelKey: 'motifComportement' },
  { value: 'DEMANDE_ELEVE',         labelKey: 'motifDemandeEleve' },
  { value: 'DEMANDE_PARENT',        labelKey: 'motifDemandeParent' },
  { value: 'DEMANDE_ENSEIGNANT',    labelKey: 'motifDemandeEnseignant' },
]

const TYPE_ENTRETIEN_OPTIONS = [
  { value: 'INDIVIDUEL',   labelKey: 'typeEntretienIndividuel' },
  { value: 'GROUPE',       labelKey: 'typeEntretienGroupe' },
  { value: 'AVEC_PARENT',  labelKey: 'typeEntretienAvecParent' },
]

const TYPE_TEST_OPTIONS = [
  { value: 'COGNITIF',               labelKey: 'typeTestCognitif' },
  { value: 'INTERETS_PROFESSIONNELS',labelKey: 'typeTestInterets' },
  { value: 'PERSONNALITE',           labelKey: 'typeTestPersonnalite' },
  { value: 'PSYCHOTECHNIQUE',        labelKey: 'typeTestPsychotechnique' },
]

const ENTRETIEN_STATUS_LABEL_KEY: Record<string, string> = {
  PLANIFIE: 'interviewStatusPlanned',
  REALISE: 'interviewStatusRealised',
  ANNULE: 'interviewStatusCancelled',
}

const PREOCCUPATION_OPTIONS = [
  { value: 'SCOLAIRE',        labelKey: 'preoccupationScolaire' },
  { value: 'COMPORTEMENTAL',  labelKey: 'preoccupationComportemental' },
  { value: 'FAMILIAL',        labelKey: 'preoccupationFamilial' },
  { value: 'PROFESSIONNEL',   labelKey: 'preoccupationProfessionnel' },
  { value: 'SANTE',           labelKey: 'preoccupationSante' },
  { value: 'AUTRE',           labelKey: 'preoccupationAutre' },
]

const RISK_OPTIONS = [
  { value: 'FAIBLE',   labelKey: 'riskFaible' },
  { value: 'MOYEN',    labelKey: 'riskMoyen' },
  { value: 'ELEVE',    labelKey: 'riskEleve' },
  { value: 'CRITIQUE', labelKey: 'riskCritique' },
]

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SectionOrientation({ onToast }: Props) {
  const t = useT('staff')
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
      setNewFicheForm(f => ({ ...f, error: t('orientation.selectStudentError') })); return
    }
    if (!selectedYear) {
      setNewFicheForm(f => ({ ...f, error: t('orientation.noYearError') })); return
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
      onToast(`${t('orientation.ficheCreated')} ${newFicheForm.selectedStudent.firstName} ${newFicheForm.selectedStudent.lastName}`, 'success')
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
      setEntretienForm(f => ({ ...f, error: t('orientation.dateRequired') })); return
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
      onToast(t('orientation.interviewScheduled'), 'success')
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
      onToast(t('orientation.interviewMarkedRealised'), 'success')
      if (selectedFiche) openFiche(selectedFiche.id)
    } catch { onToast('Erreur', 'error') }
  }

  // ── Ajouter test ──────────────────────────────────────────────────────────────
  const submitTest = async () => {
    if (!testForm.datePassage || !testForm.resultats) {
      setTestForm(f => ({ ...f, error: t('orientation.dateAndResultsRequired') })); return
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
      onToast(t('orientation.testAdded'), 'success')
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
      onToast(t('orientation.followUpSaved'), 'success')
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
      setRecoForm(f => ({ ...f, error: t('orientation.allFieldsRequired') })); return
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
      onToast(t('orientation.recoSaved'), 'success')
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
      onToast(t('orientation.recoValidated'), 'success')
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
        if (res.status === 403) { onToast(t('orientation.insufficientPermission'), 'error'); setEditEntOpen(false); return }
        setEditEnt(f => ({ ...f, error: d.message || 'Erreur', loading: false })); return
      }
      onToast(t('orientation.interviewModified'), 'success')
      setEditEntOpen(false)
      if (selectedFiche) openFiche(selectedFiche.id)
    } catch (err) {
      setEditEnt(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────────

  function Badge({ value, map, labelMap }: { value: string; map: Record<string, { bg: string; color: string }>; labelMap?: Record<string, string> }) {
    const b = map[value] ?? { bg: 'var(--bg2)', color: 'var(--text3)' }
    const lbl = labelMap?.[value] ? t(`orientation.${labelMap[value]}`) : value
    return (
      <span style={{ background: b.bg, color: b.color, borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>
        {lbl}
      </span>
    )
  }

  function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    return (
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 18, padding: '32px 36px', width: 520, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
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
            <div style={sTitle}>{t('orientation.title')}</div>
            <div style={sSub}>{t('orientation.subtitle')}</div>
          </div>
          <button style={btnPrim} onClick={() => setNewFicheOpen(true)}>{t('orientation.newFiche')}</button>
        </div>

        {/* Filtre année + risque */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
          {years.length > 0 && (
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} style={sSelect}>
              {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
            </select>
          )}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={sSelect}>
            <option value="">{t('orientation.filterAllStatuses')}</option>
            <option value="OUVERTE">{t('orientation.filterOuverte')}</option>
            <option value="EN_COURS">{t('orientation.filterEnCours')}</option>
            <option value="CLOSE">{t('orientation.filterClose')}</option>
            <option value="TRANSFEREE">{t('orientation.filterTransferee')}</option>
          </select>
          <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} style={sSelect}>
            <option value="">{t('orientation.filterAllRisks')}</option>
            <option value="FAIBLE">{t('orientation.filterFaible')}</option>
            <option value="MOYEN">{t('orientation.filterMoyen')}</option>
            <option value="ELEVE">{t('orientation.filterEleve')}</option>
            <option value="CRITIQUE">{t('orientation.filterCritique')}</option>
          </select>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 26 }}>
          {[
            { icon: '📋', bg: 'var(--green-light)', color: 'var(--green)', val: loadingStats ? '…' : String(stats?.fichesOuvertes ?? 0),            label: t('orientation.kpiOpenFiches')          },
            { icon: '🔴', bg: 'var(--red-light)', color: 'var(--red)', val: loadingStats ? '…' : String((stats?.elevesArisqueEleve ?? 0) + (stats?.elevesArisqueCritique ?? 0)), label: t('orientation.kpiAtRisk') },
            { icon: '📅', bg: 'var(--blue-light)', color: 'var(--blue)', val: loadingStats ? '…' : String(stats?.entretiensThisMois ?? 0),        label: t('orientation.kpiInterviewsThisMonth') },
            { icon: '🎓', bg: 'var(--purple-light)', color: 'var(--purple)', val: loadingStats ? '…' : String(stats?.recommandationsEnAttente ?? 0),  label: t('orientation.kpiPendingRecommendations')},
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '20px 24px' }}>
              <div style={{ width: 44, height: 44, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tableau */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>{t('orientation.studentsMonitored')}</span>
            <span style={{ fontSize: 14, color: 'var(--text3)' }}>{t('orientation.totalFiches')}</span>
          </div>

          {loadingList ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)' }}>{t('orientation.loadingFiches')}</div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--red)' }}>{error}</div>
          ) : fiches.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🧭</div>
              <div style={{ fontSize: 16 }}>{t('orientation.noFichesForFilters')}</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {[
                      t('orientation.tableHeaderStudent'),
                      t('orientation.tableHeaderClass'),
                      t('orientation.tableHeaderRisk'),
                      t('orientation.tableHeaderStatus'),
                      t('orientation.tableHeaderInterviews'),
                      t('orientation.tableHeaderUpdated'),
                      t('orientation.tableHeaderActions'),
                    ].map(h => (
                      <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 13, fontWeight: 700, color: 'var(--text3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fiches.map(f => (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                        {f.student.firstName} {f.student.lastName}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text3)' }}>
                        {f.student.studentProfile?.class?.name ?? '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge value={f.riskLevel} map={RISK_STYLE} labelMap={RISK_LABEL_KEY} />
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Badge value={f.status} map={STATUS_STYLE} labelMap={STATUS_LABEL_KEY} />
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text3)', textAlign: 'center' }}>
                        {f._count.entretiens}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text3)' }}>
                        {fmt(f.updatedAt)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <button
                          onClick={() => openFiche(f.id)}
                          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer' }}
                        >
                          {t('orientation.viewFiche')}
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
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, border: '1.5px solid', borderColor: p === page ? 'var(--green)' : 'var(--border)', background: p === page ? 'var(--green)' : 'white', color: p === page ? 'white' : 'var(--text3)', cursor: 'pointer' }}>
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
      return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>{t('orientation.loadingFiches')}</div>
    }
    const f = selectedFiche
    const nomEleve = `${f.student.firstName} ${f.student.lastName}`
    const classe = f.student.studentProfile?.class?.name ?? '—'

    return (
      <>
        {/* Retour + en-tête */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <button onClick={() => setView('dashboard')} style={{ ...btnSec, padding: '8px 14px', fontSize: 14 }}>{t('orientation.backToDashboard')}</button>
          <div>
            <div style={sTitle}>{nomEleve}</div>
            <div style={{ ...sSub, display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
              <span>{classe}</span>
              <Badge value={f.riskLevel} map={RISK_STYLE} labelMap={RISK_LABEL_KEY} />
              <Badge value={f.status} map={STATUS_STYLE} labelMap={STATUS_LABEL_KEY} />
            </div>
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 22, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
          {([
            { key: 'entretiens', label: t('orientation.tabInterviews'), count: f.entretiens.length },
            { key: 'tests',      label: t('orientation.tabTests'),       count: f.tests.length },
            { key: 'serie',      label: t('orientation.tabSeries'),   count: f.recommandation ? 1 : 0 },
            { key: 'suivis',     label: t('orientation.tabFollowUp'),       count: f.suivis.length },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setFicheTab(tab.key)}
              style={{
                padding: '10px 18px', borderRadius: '10px 10px 0 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none',
                background: ficheTab === tab.key ? 'var(--green)' : 'transparent',
                color: ficheTab === tab.key ? 'white' : 'var(--text3)',
                borderBottom: ficheTab === tab.key ? '2px solid var(--green)' : '2px solid transparent',
                marginBottom: -2,
              }}>
              {tab.label} {tab.count > 0 && <span style={{ marginLeft: 6, background: ficheTab === tab.key ? 'rgba(255,255,255,0.3)' : 'var(--border)', borderRadius: 99, padding: '1px 8px', fontSize: 12 }}>{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Tab: Entretiens */}
        {ficheTab === 'entretiens' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button style={btnPrim} onClick={() => setEntretienOpen(true)}>{t('orientation.planInterview')}</button>
            </div>
            {f.entretiens.length === 0 ? (
              <EmptyState icon="📋" text={t('orientation.noInterviews')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {f.entretiens.map(e => (
                  <div key={e.id} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{fmt(e.date)}</span>
                        <span style={{ marginLeft: 10, fontSize: 13, color: 'var(--text3)' }}>{e.type.replace('_', ' ')} · {e.motif.replace(/_/g, ' ')}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {e.parentNotified && <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>{t('orientation.parentNotifiedBadge')}</span>}
                        <span style={{
                          background: e.status === 'REALISE' ? 'var(--green-light)' : e.status === 'ANNULE' ? 'var(--red-light)' : 'var(--amber-light)',
                          color: e.status === 'REALISE' ? 'var(--green)' : e.status === 'ANNULE' ? 'var(--red)' : 'var(--amber)',
                          borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700,
                        }}>{ENTRETIEN_STATUS_LABEL_KEY[e.status] ? t(`orientation.${ENTRETIEN_STATUS_LABEL_KEY[e.status]}`) : e.status}</span>
                        {canEditEnt && (
                          <button onClick={() => openEditEntretien(e)} style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }}>{t('orientation.modifyRecommendation')}</button>
                        )}
                        {e.status === 'PLANIFIE' && (
                          <button onClick={() => marquerRealise(e.id)} style={{ ...btnSec, fontSize: 12, padding: '4px 10px' }}>{t('orientation.markRealised')}</button>
                        )}
                      </div>
                    </div>
                    {e.notes && <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 6, lineHeight: 1.6 }}><strong>{t('orientation.notesLabel')}</strong> {e.notes}</p>}
                    {e.recommendations && <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4, lineHeight: 1.6 }}><strong>{t('orientation.recommendationsLabel')}</strong> {e.recommendations}</p>}
                    {e.followUpDate && <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>{t('orientation.nextAppointment')}</p>}
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
              <button style={btnPrim} onClick={() => setTestOpen(true)}>{t('orientation.addTest')}</button>
            </div>
            {f.tests.length === 0 ? (
              <EmptyState icon="🧪" text={t('orientation.noTests')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {f.tests.map(test => (
                  <div key={test.id} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{test.type.replace(/_/g, ' ')}</span>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        {test.scoreGlobal != null && (
                          <span style={{ background: 'var(--green-light)', color: 'var(--green)', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 700 }}>{test.scoreGlobal}/100</span>
                        )}
                        <span style={{ fontSize: 13, color: 'var(--text3)' }}>{fmt(test.datePassage)}</span>
                      </div>
                    </div>
                    <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}><strong>{t('orientation.resultsLabel')}</strong> {test.resultats}</p>
                    {test.interpretation && <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4, lineHeight: 1.6 }}><strong>{t('orientation.interpretationLabel')}</strong> {test.interpretation}</p>}
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
                {f.recommandation ? t('orientation.modifyRecommendation') : t('orientation.createRecommendation')}
              </button>
            </div>
            {!f.recommandation ? (
              <EmptyState icon="🎓" text={t('orientation.noRecommendation')} />
            ) : (
              <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '24px 28px' }}>
                <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 4 }}>{t('orientation.currentSeries')}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)' }}>{f.recommandation.serieActuelle}</div>
                  </div>
                  <div style={{ fontSize: 28, color: 'var(--text3)', alignSelf: 'center' }}>→</div>
                  <div style={{ flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 4 }}>{t('orientation.recommendedSeries')}</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--green)' }}>{f.recommandation.serieRecommandee}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 700, marginBottom: 4 }}>{t('orientation.statusLabel')}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Badge value={f.recommandation.status} map={{
                        PROPOSEE:        { bg: 'var(--amber-light)', color: 'var(--amber)' },
                        VALIDEE_ADMIN:   { bg: 'var(--green-light)', color: 'var(--green)' },
                        ACCEPTEE_PARENT: { bg: 'var(--green-light)', color: 'var(--green)' },
                        REFUSEE_PARENT:  { bg: 'var(--red-light)', color: 'var(--red)' },
                        TRANSMISE_DRES:  { bg: 'var(--blue-light)', color: 'var(--blue)' },
                      }} labelMap={{
                        PROPOSEE: 'statusProposed',
                        VALIDEE_ADMIN: 'statusValidatedAdmin',
                        ACCEPTEE_PARENT: 'statusAcceptedParent',
                        REFUSEE_PARENT: 'statusRefusedParent',
                        TRANSMISE_DRES: 'statusTransmitedDRES',
                      }} />
                      {f.recommandation.status === 'PROPOSEE' && (
                        <button onClick={validerRecommandation} disabled={validatingReco}
                          style={{ padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.3)', cursor: validatingReco ? 'wait' : 'pointer', fontFamily: 'inherit' }}>
                          {validatingReco ? '⏳' : t('orientation.validateReco')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.7 }}><strong>{t('orientation.justificationLabel')}</strong> {f.recommandation.justification}</p>
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)' }}>
                  {f.recommandation.adminValidated && `${t('orientation.validatedByAdmin')} · `}
                  {f.recommandation.parentNotified && `${t('orientation.parentNotifiedBadge')} · `}
                  {t('orientation.createdOn')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Suivis */}
        {ficheTab === 'suivis' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button style={btnPrim} onClick={() => setSuiviOpen(true)}>{t('orientation.addFollowUp')}</button>
            </div>
            {f.suivis.length === 0 ? (
              <EmptyState icon="📊" text={t('orientation.noFollowUps')} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {f.suivis.map(s => (
                  <div key={s.id} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{fmt(s.date)}</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Badge value={s.riskLevel} map={RISK_STYLE} labelMap={RISK_LABEL_KEY} />
                        <span style={{ background: 'var(--bg2)', color: 'var(--text2)', borderRadius: 8, padding: '3px 10px', fontSize: 13, fontWeight: 600 }}>
                          {s.mainConcern.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    {s.interventions && <p style={{ fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}><strong>{t('orientation.interventionsLabel')}</strong> {s.interventions}</p>}
                    {s.notes && <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4, lineHeight: 1.6 }}>{s.notes}</p>}
                    {s.prochainRdv && <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 6 }}>{t('orientation.nextAppointment')}</p>}
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
      <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', background: 'var(--bg)', borderRadius: 14, border: '1.5px dashed var(--border)' }}>
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
        <div style={sModalTitle}>{t('orientation.newFicheModalTitle')}</div>
        <div style={sLabel}>{t('orientation.tableHeaderStudent')} *</div>
        <input
          style={sInput}
          placeholder={t('orientation.studentSearchPlaceholder')}
          value={newFicheForm.studentSearch}
          onChange={e => {
            setNewFicheForm(f => ({ ...f, studentSearch: e.target.value, selectedStudent: null }))
            searchStudents(e.target.value, r => setNewFicheForm(f => ({ ...f, studentResults: r })))
          }}
        />
        {newFicheForm.selectedStudent && (
          <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '8px 14px', borderRadius: 8, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>
            ✓ {newFicheForm.selectedStudent.firstName} {newFicheForm.selectedStudent.lastName}
          </div>
        )}
        {newFicheForm.studentResults.length > 0 && !newFicheForm.selectedStudent && (
          <div style={{ border: '1.5px solid var(--border)', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
            {newFicheForm.studentResults.map(s => (
              <div key={s.id} onClick={() => setNewFicheForm(f => ({ ...f, selectedStudent: s, studentSearch: `${s.firstName} ${s.lastName}`, studentResults: [] }))}
                style={{ padding: '10px 16px', cursor: 'pointer', fontSize: 14, borderBottom: '1px solid var(--bg2)', color: 'var(--text)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}>
                {s.firstName} {s.lastName}
              </div>
            ))}
          </div>
        )}
        <div style={sLabel}>{t('orientation.mainConcernLabel')}</div>
        <select style={sInput} value={newFicheForm.mainConcern} onChange={e => setNewFicheForm(f => ({ ...f, mainConcern: e.target.value }))}>
          <option value="">{t('orientation.mainConcernPlaceholder')}</option>
          {PREOCCUPATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
        </select>
        {newFicheForm.error && <div style={sError}>{newFicheForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setNewFicheOpen(false)}>{t('orientation.cancel')}</button>
          <button style={{ ...btnPrim, flex: 1, opacity: newFicheForm.loading ? 0.7 : 1 }} onClick={submitNouvelleFiche} disabled={newFicheForm.loading}>
            {newFicheForm.loading ? t('orientation.creatingFiche') : t('orientation.createFiche')}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalEntretien() {
    return (
      <ModalOverlay onClose={() => setEntretienOpen(false)}>
        <div style={sModalTitle}>{t('orientation.planInterviewModalTitle')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>{t('orientation.dateTimeLabel')}</div>
            <input style={sInput} type="datetime-local" value={entretienForm.date} onChange={e => setEntretienForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <div style={sLabel}>{t('orientation.typeLabel')}</div>
            <select style={sInput} value={entretienForm.type} onChange={e => setEntretienForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_ENTRETIEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
            </select>
          </div>
        </div>
        <div style={sLabel}>{t('orientation.motifLabel')}</div>
        <select style={sInput} value={entretienForm.motif} onChange={e => setEntretienForm(f => ({ ...f, motif: e.target.value }))}>
          {MOTIF_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
        </select>
        <div style={sLabel}>{t('orientation.notesLabel').replace(':', '')}</div>
        <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} value={entretienForm.notes} onChange={e => setEntretienForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('orientation.notesPlaceholder')} />
        <div style={sLabel}>{t('orientation.recommendationsLabel').replace(':', '')}</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={entretienForm.recommendations} onChange={e => setEntretienForm(f => ({ ...f, recommendations: e.target.value }))} placeholder={t('orientation.recommendationsPlaceholder')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>{t('orientation.followUpDateLabel')}</div>
            <input style={sInput} type="date" value={entretienForm.followUpDate} onChange={e => setEntretienForm(f => ({ ...f, followUpDate: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 28 }}>
            <input type="checkbox" id="pn" checked={entretienForm.parentNotified} onChange={e => setEntretienForm(f => ({ ...f, parentNotified: e.target.checked }))} />
            <label htmlFor="pn" style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{t('orientation.parentNotifiedCheckbox')}</label>
          </div>
        </div>
        {entretienForm.error && <div style={sError}>{entretienForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setEntretienOpen(false)}>{t('orientation.cancel')}</button>
          <button style={{ ...btnPrim, flex: 1, opacity: entretienForm.loading ? 0.7 : 1 }} onClick={submitEntretien} disabled={entretienForm.loading}>
            {entretienForm.loading ? t('orientation.savingInterview') : t('orientation.saveInterview')}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalTest() {
    return (
      <ModalOverlay onClose={() => setTestOpen(false)}>
        <div style={sModalTitle}>{t('orientation.addTestModalTitle')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>{t('orientation.testTypeLabel')}</div>
            <select style={sInput} value={testForm.type} onChange={e => setTestForm(f => ({ ...f, type: e.target.value }))}>
              {TYPE_TEST_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
            </select>
          </div>
          <div>
            <div style={sLabel}>{t('orientation.testDateLabel')}</div>
            <input style={sInput} type="date" value={testForm.datePassage} onChange={e => setTestForm(f => ({ ...f, datePassage: e.target.value }))} />
          </div>
        </div>
        <div style={sLabel}>{t('orientation.testResultsLabel')}</div>
        <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} value={testForm.resultats} onChange={e => setTestForm(f => ({ ...f, resultats: e.target.value }))} placeholder={t('orientation.testResultsPlaceholder')} />
        <div style={sLabel}>{t('orientation.testInterpretationLabel')}</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={testForm.interpretation} onChange={e => setTestForm(f => ({ ...f, interpretation: e.target.value }))} placeholder={t('orientation.testInterpretationPlaceholder')} />
        <div style={sLabel}>{t('orientation.testScoreLabel')}</div>
        <input style={sInput} type="number" min="0" max="100" value={testForm.scoreGlobal} onChange={e => setTestForm(f => ({ ...f, scoreGlobal: e.target.value }))} placeholder={t('orientation.testScorePlaceholder')} />
        {testForm.error && <div style={sError}>{testForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setTestOpen(false)}>{t('orientation.cancel')}</button>
          <button style={{ ...btnPrim, flex: 1, opacity: testForm.loading ? 0.7 : 1 }} onClick={submitTest} disabled={testForm.loading}>
            {testForm.loading ? t('orientation.savingTest') : t('orientation.addTestButton')}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalSuivi() {
    return (
      <ModalOverlay onClose={() => setSuiviOpen(false)}>
        <div style={sModalTitle}>{t('orientation.addFollowUpModalTitle')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>{t('orientation.riskLevelLabel')}</div>
            <select style={sInput} value={suiviForm.riskLevel} onChange={e => setSuiviForm(f => ({ ...f, riskLevel: e.target.value }))}>
              {RISK_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
            </select>
          </div>
          <div>
            <div style={sLabel}>{t('orientation.mainConcernLabelFM')}</div>
            <select style={sInput} value={suiviForm.mainConcern} onChange={e => setSuiviForm(f => ({ ...f, mainConcern: e.target.value }))}>
              {PREOCCUPATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`orientation.${o.labelKey}`)}</option>)}
            </select>
          </div>
        </div>
        <div style={sLabel}>{t('orientation.interventionsLabelFM')}</div>
        <textarea style={{ ...sInput, minHeight: 70, resize: 'vertical' }} value={suiviForm.interventions} onChange={e => setSuiviForm(f => ({ ...f, interventions: e.target.value }))} placeholder={t('orientation.interventionsPlaceholder')} />
        <div style={sLabel}>{t('orientation.notesLabel').replace(':', '')}</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={suiviForm.notes} onChange={e => setSuiviForm(f => ({ ...f, notes: e.target.value }))} placeholder={t('orientation.notesPlaceholderFU')} />
        <div style={sLabel}>{t('orientation.nextAppointmentLabel')}</div>
        <input style={sInput} type="date" value={suiviForm.prochainRdv} onChange={e => setSuiviForm(f => ({ ...f, prochainRdv: e.target.value }))} />
        {suiviForm.error && <div style={sError}>{suiviForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setSuiviOpen(false)}>{t('orientation.cancel')}</button>
          <button style={{ ...btnPrim, flex: 1, opacity: suiviForm.loading ? 0.7 : 1 }} onClick={submitSuivi} disabled={suiviForm.loading}>
            {suiviForm.loading ? t('orientation.savingFollowUp') : t('orientation.saveFollowUp')}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalReco() {
    const SERIES = ['A4', 'B', 'C', 'D', 'E', 'TI', 'ABI', 'G', 'H', 'F']
    return (
      <ModalOverlay onClose={() => setRecoOpen(false)}>
        <div style={sModalTitle}>{t('orientation.recommendationTitle')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>{t('orientation.currentSeries')}</div>
            <select style={sInput} value={recoForm.serieActuelle} onChange={e => setRecoForm(f => ({ ...f, serieActuelle: e.target.value }))}>
              <option value="">{t('orientation.recoSeriesPlaceholder')}</option>
              {SERIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={sLabel}>{t('orientation.recommendedSeries')}</div>
            <select style={sInput} value={recoForm.serieRecommandee} onChange={e => setRecoForm(f => ({ ...f, serieRecommandee: e.target.value }))}>
              <option value="">{t('orientation.recoSeriesPlaceholder')}</option>
              {SERIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={sLabel}>{t('orientation.justificationLabel').replace(':', '')}</div>
        <textarea style={{ ...sInput, minHeight: 100, resize: 'vertical' }} value={recoForm.justification} onChange={e => setRecoForm(f => ({ ...f, justification: e.target.value }))} placeholder={t('orientation.recoJustificationPlaceholder')} />
        {recoForm.error && <div style={sError}>{recoForm.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setRecoOpen(false)}>{t('orientation.cancel')}</button>
          <button style={{ ...btnPrim, flex: 1, opacity: recoForm.loading ? 0.7 : 1 }} onClick={submitReco} disabled={recoForm.loading}>
            {recoForm.loading ? t('orientation.recoSaving') : t('orientation.recoSave')}
          </button>
        </div>
      </ModalOverlay>
    )
  }

  function ModalModifierEntretien() {
    return (
      <ModalOverlay onClose={() => setEditEntOpen(false)}>
        <div style={sModalTitle}>{t('orientation.editInterviewModalTitle')}</div>
        <div style={sLabel}>{t('orientation.notesLabel').replace(':', '')}</div>
        <textarea style={{ ...sInput, minHeight: 80, resize: 'vertical' }} value={editEnt.notes} onChange={e => setEditEnt(f => ({ ...f, notes: e.target.value }))} placeholder={t('orientation.notesEditPlaceholder')} />
        <div style={sLabel}>{t('orientation.recommendationsLabel').replace(':', '')}</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={editEnt.recommendations} onChange={e => setEditEnt(f => ({ ...f, recommendations: e.target.value }))} placeholder={t('orientation.recommendationsEditPlaceholder')} />
        <div style={sLabel}>{t('orientation.nextActionsLabel')}</div>
        <textarea style={{ ...sInput, minHeight: 60, resize: 'vertical' }} value={editEnt.nextActions} onChange={e => setEditEnt(f => ({ ...f, nextActions: e.target.value }))} placeholder={t('orientation.nextActionsEditPlaceholder')} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <div style={sLabel}>{t('orientation.statusLabelFollowUp')}</div>
            <select style={sInput} value={editEnt.status} onChange={e => setEditEnt(f => ({ ...f, status: e.target.value }))}>
              <option value="PLANIFIE">{t('orientation.interviewStatusPlanned')}</option>
              <option value="REALISE">{t('orientation.interviewStatusRealised')}</option>
              <option value="ANNULE">{t('orientation.interviewStatusCancelled')}</option>
            </select>
          </div>
          <div>
            <div style={sLabel}>{t('orientation.followUpDateLabel')}</div>
            <input style={sInput} type="date" value={editEnt.followUpDate} onChange={e => setEditEnt(f => ({ ...f, followUpDate: e.target.value }))} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <input type="checkbox" id="pn-edit" checked={editEnt.parentNotified} onChange={e => setEditEnt(f => ({ ...f, parentNotified: e.target.checked }))} />
          <label htmlFor="pn-edit" style={{ fontSize: 14, color: 'var(--text2)', cursor: 'pointer' }}>{t('orientation.parentNotifiedCheckbox')}</label>
        </div>
        {editEnt.error && <div style={sError}>{editEnt.error}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button style={{ ...btnSec, flex: 1 }} onClick={() => setEditEntOpen(false)}>{t('orientation.cancelEdit')}</button>
          <button style={{ ...btnPrim, flex: 1, opacity: editEnt.loading ? 0.7 : 1 }} onClick={submitModifierEntretien} disabled={editEnt.loading}>
            {editEnt.loading ? t('orientation.savingEdit') : t('orientation.saveEdit')}
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
  fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)',
}
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 11, fontSize: 15, fontWeight: 800,
  background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
const btnSec: React.CSSProperties = {
  padding: '10px 20px', borderRadius: 11, fontSize: 15, fontWeight: 700,
  background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)',
  cursor: 'pointer', fontFamily: 'inherit',
}
const sSelect: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'inherit', cursor: 'pointer',
}
const sInput: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
  border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
  fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12,
}
const sLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }
const sError: React.CSSProperties = {
  background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8,
  padding: '8px 14px', fontSize: 13, fontWeight: 600, marginTop: 4,
}
const sModalTitle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700,
  color: 'var(--text)', marginBottom: 22,
}
