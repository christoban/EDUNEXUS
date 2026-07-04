'use client'
import { useState, useEffect, useRef } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { db } from '@/lib/offline/db'
import type { PendingAction } from '@/lib/offline/db'

interface Props {
  user: UserInfo | null
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

interface Classe    { id: string; name: string }
interface Subject   { id: string; name: string }
interface Chapitre  { id: string; titre: string; ordre: number; volumeHeuresPrevu: number }
interface Programme { id: string; titre: string; chapitres: Chapitre[] }
interface CahierEntry {
  id: string; date: string; contenuRealise: string | null; contenuLibre?: string | null
  devoirsDonnes: string | null
  class: { id: string; name: string }; subject: { id: string; name: string }
  chapitre: { id: string; titre: string; ordre: number } | null
}
interface ScanResult {
  chapitreDetecte: string | null; contenuRealise: string | null
  devoirsDonnes: string | null; confidence: number; error?: string
}

type Tab = 'saisie' | 'historique'

// ── Styles ────────────────────────────────────────────────────────────────────
const SEL: React.CSSProperties = {
  width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid var(--border)',
  fontSize: 16, fontWeight: 600, fontFamily: 'inherit', color: 'var(--text)',
  background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23a89478' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
}
const LBL: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase',
  letterSpacing: '0.6px', marginBottom: 6, display: 'block',
}
const AREA: React.CSSProperties = {
  width: '100%', padding: '14px 16px', borderRadius: 12, border: '1.5px solid var(--border)',
  fontSize: 16, fontWeight: 500, fontFamily: 'inherit', color: 'var(--text)',
  background: 'var(--surface)', outline: 'none', boxSizing: 'border-box', resize: 'vertical',
}

export default function SectionCahierDeTexte({ user, onToast }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const [tab, setTab] = useState<Tab>('saisie')
  const { isOnline, addToQueue, pendingCount } = useSyncQueue()

  // Données
  const [classes,  setClasses]  = useState<Classe[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [chapitres, setChapitres] = useState<Chapitre[]>([])
  const [hasProgramme, setHasProgramme] = useState<boolean | null>(null)

  // Sélections formulaire
  const [selectedClass,    setSelectedClass]    = useState('')
  const [selectedSubject,  setSelectedSubject]  = useState('')
  const [selectedChapitre, setSelectedChapitre] = useState('')
  const [date,         setDate]         = useState(new Date().toISOString().slice(0, 10))
  const [contenu,      setContenu]      = useState('')  // contenuRealise
  const [contenuLibre, setContenuLibre] = useState('')  // matières sans programme
  const [devoirsOn,    setDevoirsOn]    = useState(false)
  const [devoirs,      setDevoirs]      = useState('')
  const [saving,       setSaving]       = useState(false)

  // Pré-remplissage depuis l'emploi du temps
  const [slotBanner,       setSlotBanner]       = useState<string | null>(null)
  const [prefillSubjectId, setPrefillSubjectId] = useState<string | null>(null)

  // Scan photo
  const cameraRef = useRef<HTMLInputElement>(null)
  const [scanning,   setScanning]   = useState(false)
  const [scanBanner, setScanBanner] = useState<string | null>(null)

  // Historique
  const [entries,        setEntries]        = useState<CahierEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [filterClass,    setFilterClass]    = useState('')
  const [pendingEntries, setPendingEntries] = useState<PendingAction[]>([])

  // ── Init : classes + slot du jour ──────────────────────────────────────────
  useEffect(() => {
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setClasses(d.data ?? []) }).catch(() => {})

    fetchApi('/api/v2/pedagogie/today-slot', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const { classId, className, subjectId, subjectName, startTime, endTime } = d.data
          setSelectedClass(classId)
          setPrefillSubjectId(subjectId)
          setSlotBanner(t('cahier_de_texte.slot_banner').replace('{info}', `${className ?? ''} — ${subjectName ?? ''} (${startTime}–${endTime})`))
        }
      }).catch(() => {})
  }, [])

  // ── Matières selon la classe ────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedClass) { setSubjects([]); setSelectedSubject(''); return }
    fetchApi(`/api/v2/teaching-assignments?classId=${selectedClass}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const myId = user?.id
          const mine = (d.data ?? []).filter((a: any) => a.teacherId === myId)
          const dedup = new Map<string, Subject>()
          for (const a of mine) dedup.set(a.subject.id, a.subject)
          setSubjects([...dedup.values()])
        }
      }).catch(() => {})
    setSelectedSubject(''); setChapitres([]); setSelectedChapitre(''); setHasProgramme(null)
  }, [selectedClass, user?.id])

  // ── Appliquer pré-remplissage matière après chargement ─────────────────────
  useEffect(() => {
    if (!prefillSubjectId || subjects.length === 0) return
    if (subjects.find(s => s.id === prefillSubjectId)) {
      setSelectedSubject(prefillSubjectId)
      setPrefillSubjectId(null)
    }
  }, [subjects, prefillSubjectId])

  // ── Vérification programme + chapitres selon matière ──────────────────────
  useEffect(() => {
    if (!selectedSubject) { setChapitres([]); setSelectedChapitre(''); setHasProgramme(null); return }
    const url = `/api/v2/pedagogie/subjects/${selectedSubject}/has-programme${selectedClass ? `?classId=${selectedClass}` : ''}`
    fetchApi(url, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setHasProgramme(d.data.hasProgramme)
          setChapitres(d.data.chapitres ?? [])
        }
      })
      .catch(() => setHasProgramme(true)) // fallback safe : afficher le dropdown
    setSelectedChapitre('')
  }, [selectedSubject, selectedClass])

  // ── Réinitialiser contenu libre quand matière change ──────────────────────
  useEffect(() => { setContenuLibre('') }, [selectedSubject])

  // ── Enregistrement (online ou offline) ────────────────────────────────────
  const handleSave = async () => {
    if (!selectedClass || !selectedSubject) {
      onToast(t('cahier_de_texte.toast_class_subject_required'), 'error'); return
    }
    const realise = hasProgramme === false ? undefined : contenu.trim() || undefined
    const libre   = hasProgramme === false ? contenuLibre.trim() || undefined : undefined
    if (!realise && !libre) {
      onToast(t('cahier_de_texte.toast_content_required'), 'error'); return
    }

    const payload = {
      classId: selectedClass, subjectId: selectedSubject,
      chapitreId: selectedChapitre || undefined,
      date, contenuRealise: realise, contenuLibre: libre,
      devoirsDonnes: (devoirsOn && devoirs.trim()) ? devoirs.trim() : undefined,
    }

    if (!isOnline) {
      await addToQueue({
        type: 'CAHIER_DE_TEXTE_CREATE',
        endpoint: '/api/v2/pedagogie/cahier-de-texte',
        method: 'POST',
        payload: {
          ...payload,
          _className:   classes.find(c => c.id === selectedClass)?.name,
          _subjectName: subjects.find(s => s.id === selectedSubject)?.name,
        },
      })
      onToast(t('cahier_de_texte.toast_saved_offline'), 'info')
      setContenu(''); setContenuLibre(''); setDevoirs(''); setDevoirsOn(false)
      setSelectedChapitre(''); setScanBanner(null)
      return
    }

    setSaving(true)
    try {
      const r = await fetchApi('/api/v2/pedagogie/cahier-de-texte', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (data.success) {
        onToast(t('cahier_de_texte.toast_saved'), 'success')
        setContenu(''); setContenuLibre(''); setDevoirs(''); setDevoirsOn(false)
        setSelectedChapitre(''); setScanBanner(null)
      } else {
        onToast(data.message ?? t('cahier_de_texte.toast_save_error'), 'error')
      }
    } catch { onToast(t('cahier_de_texte.toast_network_error'), 'error') }
    finally { setSaving(false) }
  }

  // ── Scan photo ─────────────────────────────────────────────────────────────
  const handleScanClick = () => {
    if (!isOnline) {
      onToast(t('cahier_de_texte.scan_toast_offline'), 'warning')
      return
    }
    cameraRef.current?.click()
  }

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true); setScanBanner(null)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const r = await fetchApi('/api/v2/pedagogie/scan', {
        method: 'POST', credentials: 'include', body: formData,
      })
      const d = await r.json()
      const result: ScanResult = d.data ?? { chapitreDetecte: null, contenuRealise: null, devoirsDonnes: null, confidence: 0 }

      if (result.error || result.confidence < 0.6) {
        onToast(t('cahier_de_texte.scan_toast_unreadable'), 'warning')
      } else {
        const texte = result.contenuRealise ?? ''
        if (hasProgramme === false) { if (texte) setContenuLibre(texte) }
        else { if (texte) setContenu(texte) }
        if (result.devoirsDonnes) { setDevoirsOn(true); setDevoirs(result.devoirsDonnes) }
        if (result.chapitreDetecte && chapitres.length > 0) {
          const lc = result.chapitreDetecte.toLowerCase()
          const match = chapitres.find(c =>
            c.titre.toLowerCase().includes(lc) || lc.includes(c.titre.toLowerCase())
          )
          if (match) setSelectedChapitre(match.id)
        }
        setScanBanner(t('cahier_de_texte.scan_banner_ok'))
      }
    } catch { onToast(t('cahier_de_texte.scan_toast_error'), 'error') }
    finally { setScanning(false); if (cameraRef.current) cameraRef.current.value = '' }
  }

  // ── Historique ─────────────────────────────────────────────────────────────
  const loadEntries = () => {
    setLoadingEntries(true)
    const params = new URLSearchParams()
    if (filterClass) params.set('classId', filterClass)
    fetchApi(`/api/v2/pedagogie/cahier-de-texte?${params}`, { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setEntries(d.data ?? []) })
      .catch(() => {}).finally(() => setLoadingEntries(false))
  }

  // Entrées en attente de synchronisation (Dexie)
  useEffect(() => {
    if (tab !== 'historique') return
    db.pendingActions
      .where('type').equals('CAHIER_DE_TEXTE_CREATE')
      .toArray()
      .then(all => setPendingEntries(all.filter(a => a.status === 'PENDING' || a.status === 'FAILED')))
      .catch(() => {})
  }, [tab, pendingCount]) // pendingCount change après chaque sync → recharge

  useEffect(() => { if (tab === 'historique') loadEntries() }, [tab]) // eslint-disable-line

  // ── Dérivé UX ──────────────────────────────────────────────────────────────
  const isFormValid = !!selectedClass && !!selectedSubject &&
    (hasProgramme === false ? !!contenuLibre.trim() : !!contenu.trim())

  const tabBtn = (t: Tab, label: string) => (
    <button key={t} onClick={() => setTab(t)} style={{
      padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 800,
      fontFamily: 'inherit', cursor: 'pointer', border: 'none',
      background: tab === t ? 'var(--sidebar)' : 'var(--bg2)',
      color: tab === t ? 'white' : 'var(--text2)', transition: 'all 0.15s',
    }}>{label}</button>
  )

  return (
    <div style={{ padding: '20px 16px', height: '100%', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--bg)' }}>

      {/* Indicateur hors-ligne */}
      {!isOnline && (
        <div style={{
          background: 'var(--orange-light)', border: '1.5px solid var(--orange)', borderRadius: 10,
          padding: '8px 14px', marginBottom: 14, fontSize: 13, color: 'var(--orange)', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {t('cahier_de_texte.offline_banner')}
        </div>
      )}

      {/* Titre */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
          {t('cahier_de_texte.title')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500, marginTop: 3 }}>
          {t('cahier_de_texte.subtitle')}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {tabBtn('saisie', t('cahier_de_texte.tab_new_entry'))}
        {tabBtn('historique', t('cahier_de_texte.tab_history'))}
      </div>

      {/* ── Onglet Saisie ── */}
      {tab === 'saisie' && (
        <div style={{ maxWidth: 480, width: '100%' }}>

          {/* Bannière slot du jour */}
          {slotBanner && (
            <div style={{
              background: 'var(--green-light)', border: '1.5px solid #6ee7b7', borderRadius: 12,
              padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--green)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>📅</span>
              <span style={{ flex: 1 }}>{slotBanner}</span>
              <button onClick={() => setSlotBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Bannière qualité scan */}
          {scanBanner && (
            <div style={{
              background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 12,
              padding: '10px 14px', marginBottom: 14, fontSize: 13, color: 'var(--amber)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠️</span>
              <span style={{ flex: 1 }}>{scanBanner}</span>
              <button onClick={() => setScanBanner(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--amber)', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* ── CAS 1 : Formulaire principal — toujours visible en premier ── */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Classe */}
            <div>
              <label style={LBL}>{t('cahier_de_texte.class_label')}</label>
              <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} style={SEL}>
                <option value="">{t('cahier_de_texte.class_placeholder')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Matière */}
            <div>
              <label style={LBL}>{t('cahier_de_texte.subject_label')}</label>
              <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                style={{ ...SEL, opacity: !selectedClass ? 0.5 : 1 }} disabled={!selectedClass}>
                <option value="">{t('cahier_de_texte.subject_placeholder')}</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {/* ── CAS 2 : Chapitre si programme, texte libre sinon ── */}
            {selectedSubject && hasProgramme !== null && (
              hasProgramme ? (
                <div>
                  <label style={LBL}>{t('cahier_de_texte.chapter_label')}</label>
                  <select value={selectedChapitre} onChange={e => setSelectedChapitre(e.target.value)} style={SEL}>
                    <option value="">{t('cahier_de_texte.chapter_placeholder')}</option>
                    {chapitres.map(c => (
                      <option key={c.id} value={c.id}>Ch.{c.ordre} — {c.titre} ({c.volumeHeuresPrevu}h)</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label style={LBL}>{t('cahier_de_texte.free_text_label')}</label>
                  <textarea
                    value={contenuLibre} onChange={e => setContenuLibre(e.target.value)}
                    placeholder={t('cahier_de_texte.free_text_placeholder')}
                    rows={3} style={AREA}
                    autoFocus
                  />
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>
                    {t('cahier_de_texte.free_text_hint')}
                  </div>
                </div>
              )
            )}

            {/* Contenu réalisé (affiché uniquement si la matière a un programme ou si pas encore déterminé) */}
            {hasProgramme !== false && (
              <div>
                <label style={LBL}>{t('cahier_de_texte.content_label')}{hasProgramme === null ? '' : '*'}</label>
                <textarea
                  value={contenu} onChange={e => setContenu(e.target.value)}
                  placeholder={t('cahier_de_texte.content_placeholder')}
                  rows={3} style={{ ...AREA, minHeight: 88 }}
                />
              </div>
            )}

            {/* Devoirs — toggle */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: devoirsOn ? 10 : 0 }}>
                <label style={{ ...LBL, marginBottom: 0, flex: 1 }}>{t('cahier_de_texte.homework_label')}</label>
                <button
                  onClick={() => { setDevoirsOn(v => !v); if (devoirsOn) setDevoirs('') }}
                  style={{
                    width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: devoirsOn ? 'var(--sidebar)' : 'var(--border)', transition: 'background 0.2s',
                    position: 'relative', flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3, left: devoirsOn ? 26 : 4,
                    width: 22, height: 22, borderRadius: '50%', background: 'var(--surface)',
                    transition: 'left 0.2s', display: 'block', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }} />
                </button>
              </div>
              {devoirsOn && (
                <textarea
                  value={devoirs} onChange={e => setDevoirs(e.target.value)}
                  placeholder={t('cahier_de_texte.homework_placeholder')}
                  rows={2} style={AREA} autoFocus
                />
              )}
            </div>

            {/* Date */}
            <div>
              <label style={LBL}>{t('cahier_de_texte.date_label')}</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...SEL, paddingTop: 13, paddingBottom: 13 }} />
            </div>
          </div>

          {/* ── CAS 1 : Scan optionnel — secondaire, sous le formulaire ── */}
          <div style={{ marginTop: 12 }}>
            <button
              onClick={handleScanClick}
              disabled={scanning}
              style={{
                width: '100%', padding: '11px 16px', borderRadius: 12,
                border: '1.5px dashed #d4c4a8', background: 'transparent',
                color: 'var(--text3)', fontSize: 13, fontWeight: 700,
                fontFamily: 'inherit', cursor: scanning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {scanning
                ? <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span> {t('cahier_de_texte.scan_scanning')}</>
                : <>{t('cahier_de_texte.scan_idle')}</>
              }
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }} onChange={handleScan} />
          </div>

          {/* ── Bouton Enregistrer — sticky ── */}
          <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', paddingTop: 10, paddingBottom: 20 }}>
            <button
              onClick={handleSave}
              disabled={saving || !isFormValid}
              style={{
                width: '100%', padding: '16px 20px', borderRadius: 14,
                background: (saving || !isFormValid) ? '#d4c4a8' : 'var(--sidebar)',
                color: 'white', border: 'none', fontSize: 16, fontWeight: 800,
                fontFamily: 'inherit', cursor: (saving || !isFormValid) ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {saving ? t('cahier_de_texte.save_saving') : !isOnline ? t('cahier_de_texte.save_offline') : t('cahier_de_texte.save_online')}
            </button>
          </div>
        </div>
      )}

      {/* ── Onglet Historique ── */}
      {tab === 'historique' && (
        <div style={{ maxWidth: 480, width: '100%' }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={LBL}>{t('cahier_de_texte.history_filter_label')}</label>
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)} style={SEL}>
                <option value="">{t('cahier_de_texte.history_filter_all')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button onClick={loadEntries} style={{
              padding: '13px 18px', borderRadius: 12, background: 'var(--sidebar)', color: 'white',
              border: 'none', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0,
            }}>↺</button>
          </div>

          {/* ── CAS 3 : Entrées hors-ligne en attente ── */}
          {pendingEntries.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--amber)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                {t('cahier_de_texte.history_pending_title').replace('{count}', String(pendingEntries.length))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pendingEntries.map(entry => {
                  const p = entry.payload as any
                  const isFailed = entry.status === 'FAILED'
                  return (
                    <div key={entry.id} style={{
                      background: isFailed ? 'var(--red-light)' : 'var(--amber-light)',
                      border: `1.5px solid ${isFailed ? 'var(--red-light)' : 'var(--amber)'}`,
                      borderRadius: 14, padding: '14px 16px', position: 'relative',
                    }}>
                      <div style={{ position: 'absolute', top: 12, right: 14, fontSize: 16 }}>
                        {isFailed ? '✗' : '⏳'}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                          {p._className ?? p.classId}
                        </span>
                        <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                          {p._subjectName ?? p.subjectId}
                        </span>
                        <span style={{
                          background: isFailed ? 'var(--red-light)' : 'var(--amber-light)', color: isFailed ? 'var(--red)' : '#713f12',
                          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                        }}>
                          {isFailed ? t('cahier_de_texte.history_pending_failed') : t('cahier_de_texte.history_pending_pending')}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>
                        {p.contenuRealise ?? p.contenuLibre ?? '—'}
                      </div>
                      {p.devoirsDonnes && (
                        <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6, fontStyle: 'italic' }}>
                          {t('cahier_de_texte.history_pending_homework').replace('{text}', p.devoirsDonnes ?? '')}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
                        {p.date ? new Date(p.date).toLocaleDateString('fr-FR') : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Entrées synchronisées (API) */}
          {loadingEntries ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>{t('cahier_de_texte.history_loading')}</div>
          ) : entries.length === 0 && pendingEntries.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
              <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>{t('cahier_de_texte.history_empty')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entries.map(e => (
                <div key={e.id} style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '16px' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '8px 12px', textAlign: 'center', flexShrink: 0, minWidth: 44 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase' }}>
                        {new Date(e.date).toLocaleDateString('fr-FR', { month: 'short' })}
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>
                        {new Date(e.date).getDate()}
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                          {e.class.name}
                        </span>
                        <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                          {e.subject.name}
                        </span>
                        {e.chapitre && (
                          <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                            Ch.{e.chapitre.ordre} — {e.chapitre.titre}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, marginBottom: (e.devoirsDonnes || e.contenuLibre) ? 8 : 0 }}>
                        {e.contenuRealise ?? e.contenuLibre ?? '—'}
                      </div>
                      {e.contenuLibre && e.contenuRealise && (
                        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>{e.contenuLibre}</div>
                      )}
                      {e.devoirsDonnes && (
                        <div style={{ fontSize: 12, color: 'var(--text2)', fontStyle: 'italic', padding: '6px 10px', background: '#fefce8', borderRadius: 8, borderLeft: '3px solid var(--amber)' }}>
                          {t('cahier_de_texte.history_pending_homework').replace('{text}', e.devoirsDonnes)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
