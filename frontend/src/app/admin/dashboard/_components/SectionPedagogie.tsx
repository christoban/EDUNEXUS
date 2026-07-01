'use client'
import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'

interface OnToast { (msg: string, type?: 'success' | 'error' | 'info' | 'warning'): void }

interface Subject { id: string; name: string }
interface Classe  { id: string; name: string; level?: string | null }
interface Chapitre {
  id: string; titre: string; ordre: number; volumeHeuresPrevu: number
  sequenceCibleFin?: number | null; realise?: boolean
}
interface Programme {
  id: string; titre: string
  subject: { id: string; name: string }
  class: { id: string; name: string } | null
  level: string | null
  chapitres: Chapitre[]
}
interface Alerte {
  programmeId: string; programmeTitre: string; subjectName: string; className: string; classId: string
  chapitresTotal: number; chapitresRealises: number; progressionPct: number; attenduPct: number
  retardPct: number; niveau: 'CRITIQUE' | 'MODERE'
}
interface ProgressionData {
  programme: { id: string; titre: string } | null
  chapitresTotal: number; chapitresRealises: number
  totalHeuresPrevu: number; heuresRealisees: number
  progressionPct: number | null; attenduPct: number | null; retardPct: number | null
  chapitres: (Chapitre & { realise: boolean })[]
}

type Tab = 'programmes' | 'progression' | 'alertes' | 'rapports'

export default function SectionPedagogie({ onToast }: { onToast: OnToast }) {
  const [tab, setTab] = useState<Tab>('alertes')

  // Data
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classes, setClasses] = useState<Classe[]>([])
  const [alertes, setAlertes] = useState<Alerte[]>([])
  const [loading, setLoading] = useState(false)

  // Prog form
  const [formTitre, setFormTitre] = useState('')
  const [formSubjectId, setFormSubjectId] = useState('')
  const [formClassId, setFormClassId] = useState('')
  const [formLevel, setFormLevel] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandedProg, setExpandedProg] = useState<string | null>(null)

  // Chapitre form
  const [chapTitre, setChapTitre] = useState('')
  const [chapHeures, setChapHeures] = useState(2)
  const [chapSeq, setChapSeq] = useState('')
  const [addingChapFor, setAddingChapFor] = useState<string | null>(null)

  // Progression
  const [progClassId, setProgClassId] = useState('')
  const [progSubjectId, setProgSubjectId] = useState('')
  const [progressionData, setProgressionData] = useState<ProgressionData | null>(null)
  const [loadingProg, setLoadingProg] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
    ]).then(([subs, cls]) => {
      if (subs.success) setSubjects(subs.data ?? [])
      if (cls.success) setClasses(cls.data ?? [])
    }).catch(() => {})
  }, [])

  const loadProgrammes = () => {
    setLoading(true)
    fetchApi('/api/v2/pedagogie/programmes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setProgrammes(d.data ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  const loadAlertes = () => {
    setLoading(true)
    fetchApi('/api/v2/pedagogie/alertes-retard', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setAlertes(d.data ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (tab === 'programmes') loadProgrammes()
    if (tab === 'alertes') loadAlertes()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const handleCreateProgramme = async () => {
    if (!formTitre.trim() || !formSubjectId) { onToast('Titre et matière requis', 'error'); return }
    setSaving(true)
    try {
      const r = await fetchApi('/api/v2/pedagogie/programmes', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: formTitre.trim(), subjectId: formSubjectId, classId: formClassId || undefined, level: formLevel || undefined }),
      })
      const d = await r.json()
      if (d.success) {
        onToast('Programme créé', 'success')
        setFormTitre(''); setFormSubjectId(''); setFormClassId(''); setFormLevel('')
        loadProgrammes()
      } else onToast(d.message ?? 'Erreur', 'error')
    } catch { onToast('Erreur réseau', 'error') }
    finally { setSaving(false) }
  }

  const handleDeleteProgramme = async (id: string) => {
    if (!confirm('Supprimer ce programme et tous ses chapitres ?')) return
    const r = await fetchApi(`/api/v2/pedagogie/programmes/${id}`, { method: 'DELETE', credentials: 'include' })
    const d = await r.json()
    if (d.success) { onToast('Programme supprimé', 'success'); loadProgrammes() }
    else onToast(d.message ?? 'Erreur', 'error')
  }

  const handleAddChapitre = async (programmeId: string) => {
    if (!chapTitre.trim()) { onToast('Titre du chapitre requis', 'error'); return }
    const r = await fetchApi(`/api/v2/pedagogie/programmes/${programmeId}/chapitres`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre: chapTitre.trim(), volumeHeuresPrevu: chapHeures, sequenceCibleFin: chapSeq ? parseInt(chapSeq) : undefined }),
    })
    const d = await r.json()
    if (d.success) {
      onToast('Chapitre ajouté', 'success')
      setChapTitre(''); setChapHeures(2); setChapSeq(''); setAddingChapFor(null)
      loadProgrammes()
    } else onToast(d.message ?? 'Erreur', 'error')
  }

  const handleDeleteChapitre = async (id: string) => {
    const r = await fetchApi(`/api/v2/pedagogie/chapitres/${id}`, { method: 'DELETE', credentials: 'include' })
    const d = await r.json()
    if (d.success) { onToast('Chapitre supprimé', 'success'); loadProgrammes() }
    else onToast(d.message ?? 'Erreur', 'error')
  }

  const loadProgression = () => {
    if (!progClassId || !progSubjectId) return
    setLoadingProg(true)
    fetchApi(`/api/v2/pedagogie/progression?classId=${progClassId}&subjectId=${progSubjectId}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setProgressionData(d.data) })
      .catch(() => {})
      .finally(() => setLoadingProg(false))
  }

  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)}
      style={{ padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === t ? '#1a2e1e' : '#f0ebe3', color: tab === t ? 'white' : '#6b5c45', transition: 'all 0.15s' }}>
      {label}
    </button>
  )

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e8e0d4',
    fontSize: 14, fontWeight: 600, fontFamily: 'inherit', color: '#1a1209',
    background: 'white', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block',
  }

  const niveauColor = (n: 'CRITIQUE' | 'MODERE') =>
    n === 'CRITIQUE' ? { bg: '#fee2e2', color: '#991b1b' } : { bg: '#fef3c7', color: '#92400e' }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: '#1a1209' }}>
          Gestion de la Pédagogie
        </div>
        <div style={{ fontSize: 14, color: '#a89478', fontWeight: 500, marginTop: 4 }}>
          Programmes, cahiers de texte et suivi des progressions
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {tabBtn('alertes', '🔴 Alertes retard')}
        {tabBtn('progression', '📈 Progression')}
        {tabBtn('programmes', '📚 Programmes')}
      </div>

      {/* ─── Onglet Alertes ─── */}
      {tab === 'alertes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: '#6b5c45', fontWeight: 600 }}>
              Classes/matières avec un retard significatif par rapport au calendrier prévu
            </div>
            <button onClick={loadAlertes} style={{ padding: '8px 16px', borderRadius: 10, background: '#1a2e1e', color: 'white', border: 'none', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
              Actualiser
            </button>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#a89478' }}>Calcul en cours...</div>
          ) : alertes.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#065f46', marginBottom: 4 }}>Aucun retard significatif détecté</div>
              <div style={{ fontSize: 14, color: '#a89478', fontWeight: 500 }}>
                Toutes les classes sont dans les délais prévus, ou aucun programme n'est encore défini.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {alertes.map((a, i) => {
                const nc = niveauColor(a.niveau)
                return (
                  <div key={i} style={{ background: 'white', borderRadius: 14, border: `1.5px solid ${a.niveau === 'CRITIQUE' ? '#fca5a5' : '#fde68a'}`, padding: '18px 22px', display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, textAlign: 'center', padding: '10px 14px', background: nc.bg, borderRadius: 12 }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: nc.color }}>-{a.retardPct}%</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: nc.color, textTransform: 'uppercase' }}>{a.niveau}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{a.className}</span>
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{a.subjectName}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1209', marginBottom: 6 }}>{a.programmeTitre}</div>
                      <div style={{ display: 'flex', gap: 20, fontSize: 13, color: '#6b5c45', fontWeight: 600 }}>
                        <span>Réalisé : {a.progressionPct}%</span>
                        <span>Attendu : {a.attenduPct}%</span>
                        <span>{a.chapitresRealises}/{a.chapitresTotal} chapitres</span>
                      </div>
                      {/* Barre de progression */}
                      <div style={{ marginTop: 10, position: 'relative' }}>
                        <div style={{ background: '#f0ebe3', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${a.attenduPct}%`, background: '#e8d5b7', position: 'absolute', left: 0, top: 0, borderRadius: 6 }} />
                          <div style={{ height: '100%', width: `${a.progressionPct}%`, background: a.niveau === 'CRITIQUE' ? '#dc2626' : '#f59e0b', borderRadius: 6, position: 'relative', zIndex: 1 }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#a89478', marginTop: 4 }}>
                          La barre verte (grise) montre le niveau attendu à cette date
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Onglet Progression ─── */}
      {tab === 'progression' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={labelStyle}>Classe</label>
              <select value={progClassId} onChange={e => setProgClassId(e.target.value)} style={{ ...inputStyle, width: 200 }}>
                <option value="">— Choisir —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Matière</label>
              <select value={progSubjectId} onChange={e => setProgSubjectId(e.target.value)} style={{ ...inputStyle, width: 200 }}>
                <option value="">— Choisir —</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button onClick={loadProgression} disabled={!progClassId || !progSubjectId}
              style={{ padding: '10px 20px', borderRadius: 10, background: !progClassId || !progSubjectId ? '#a89478' : '#1a2e1e', color: 'white', border: 'none', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: !progClassId || !progSubjectId ? 'not-allowed' : 'pointer' }}>
              Voir progression
            </button>
          </div>

          {loadingProg && <div style={{ padding: 40, textAlign: 'center', color: '#a89478' }}>Calcul...</div>}

          {!loadingProg && progressionData && (
            <>
              {!progressionData.programme ? (
                <div style={{ padding: 40, textAlign: 'center', background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                  <div style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>Aucun programme défini pour cette classe/matière</div>
                  <div style={{ fontSize: 13, color: '#c4b8a8', marginTop: 4 }}>Créez d'abord un programme dans l'onglet Programmes.</div>
                </div>
              ) : (
                <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 28 }}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: '#1a1209', marginBottom: 18 }}>
                    {progressionData.programme.titre}
                  </div>

                  {/* Métriques */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                    {[
                      { label: 'Chapitres réalisés', value: `${progressionData.chapitresRealises}/${progressionData.chapitresTotal}`, color: '#1a2e1e' },
                      { label: 'Progression réelle', value: progressionData.progressionPct !== null ? `${progressionData.progressionPct}%` : '—', color: progressionData.progressionPct !== null && progressionData.progressionPct >= (progressionData.attenduPct ?? 0) ? '#059669' : '#dc2626' },
                      { label: 'Progression attendue', value: progressionData.attenduPct !== null ? `${progressionData.attenduPct}%` : '—', color: '#6b7280' },
                      { label: 'Retard', value: progressionData.retardPct !== null ? (progressionData.retardPct > 0 ? `-${progressionData.retardPct}%` : 'À jour') : '—', color: (progressionData.retardPct ?? 0) > 15 ? '#dc2626' : (progressionData.retardPct ?? 0) > 0 ? '#f59e0b' : '#059669' },
                    ].map(m => (
                      <div key={m.label} style={{ background: '#f7f3ee', borderRadius: 12, padding: '14px 18px', textAlign: 'center' }}>
                        <div style={{ fontSize: 22, fontWeight: 900, color: m.color }}>{m.value}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#a89478', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Barre double */}
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#6b5c45', marginBottom: 6 }}>Progression du programme</div>
                    <div style={{ background: '#f0ebe3', borderRadius: 8, height: 20, overflow: 'hidden', position: 'relative' }}>
                      {progressionData.attenduPct !== null && (
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressionData.attenduPct}%`, background: '#e2d9c8', zIndex: 1 }} />
                      )}
                      {progressionData.progressionPct !== null && (
                        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progressionData.progressionPct}%`, background: (progressionData.retardPct ?? 0) > 15 ? '#dc2626' : '#059669', zIndex: 2, borderRadius: 8, transition: 'width 0.5s ease' }} />
                      )}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#a89478', marginTop: 4 }}>
                      <span>Vert = réalisé · Gris = attendu à date</span>
                      <span>{progressionData.heuresRealisees}h / {progressionData.totalHeuresPrevu}h</span>
                    </div>
                  </div>

                  {/* Liste des chapitres */}
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#6b5c45', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Chapitres
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(progressionData.chapitres ?? []).map((c: Chapitre & { realise: boolean }) => (
                      <div key={c.id} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '10px 16px', background: c.realise ? '#f0fdf4' : '#fafaf9', borderRadius: 10, border: `1px solid ${c.realise ? '#bbf7d0' : '#f0ebe3'}` }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: c.realise ? '#059669' : '#e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: c.realise ? 'white' : '#a89478', fontWeight: 900, flexShrink: 0 }}>
                          {c.realise ? '✓' : c.ordre}
                        </div>
                        <span style={{ flex: 1, fontSize: 14, fontWeight: c.realise ? 700 : 600, color: c.realise ? '#064e3b' : '#6b5c45' }}>{c.titre}</span>
                        <span style={{ fontSize: 12, color: '#a89478', fontWeight: 600 }}>{c.volumeHeuresPrevu}h</span>
                        {c.sequenceCibleFin && (
                          <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                            Seq {c.sequenceCibleFin}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Onglet Programmes ─── */}
      {tab === 'programmes' && (
        <div>
          {/* Formulaire création */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 24, marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1209', marginBottom: 16 }}>Nouveau programme</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Titre *</label>
                <input value={formTitre} onChange={e => setFormTitre(e.target.value)} placeholder="Ex: Programme Maths 3ème 2025-2026" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Matière *</label>
                <select value={formSubjectId} onChange={e => setFormSubjectId(e.target.value)} style={inputStyle}>
                  <option value="">— Choisir —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Classe (optionnel)</label>
                <select value={formClassId} onChange={e => setFormClassId(e.target.value)} style={inputStyle}>
                  <option value="">— Toutes classes du niveau —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {!formClassId && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Niveau (si non lié à une classe précise)</label>
                <input value={formLevel} onChange={e => setFormLevel(e.target.value)} placeholder="Ex: 3ème, Terminale..." style={{ ...inputStyle, maxWidth: 300 }} />
              </div>
            )}
            <button onClick={handleCreateProgramme} disabled={saving || !formTitre.trim() || !formSubjectId}
              style={{ padding: '10px 24px', borderRadius: 12, background: saving || !formTitre.trim() || !formSubjectId ? '#a89478' : '#1a2e1e', color: 'white', border: 'none', fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? 'Création...' : 'Créer le programme'}
            </button>
          </div>

          {/* Liste */}
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#a89478' }}>Chargement...</div>
          ) : programmes.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>Aucun programme défini</div>
              <div style={{ fontSize: 13, color: '#c4b8a8', marginTop: 4 }}>Créez un programme ci-dessus, puis ajoutez ses chapitres.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {programmes.map(p => (
                <div key={p.id} style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
                  {/* Header prog */}
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    onClick={() => setExpandedProg(expandedProg === p.id ? null : p.id)}>
                    <span style={{ fontSize: 18 }}>{expandedProg === p.id ? '▼' : '▶'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1209' }}>{p.titre}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{p.subject.name}</span>
                        {p.class && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{p.class.name}</span>}
                        {p.level && !p.class && <span style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{p.level}</span>}
                        <span style={{ background: '#f0ebe3', color: '#a89478', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{p.chapitres.length} chapitre{p.chapitres.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteProgramme(p.id) }}
                      style={{ padding: '6px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', border: 'none', fontSize: 12, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
                      Supprimer
                    </button>
                  </div>

                  {expandedProg === p.id && (
                    <div style={{ borderTop: '1px solid #e8e0d4', padding: '16px 20px' }}>
                      {/* Chapitres */}
                      {p.chapitres.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                          {p.chapitres.map(c => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#f7f3ee', borderRadius: 8, marginBottom: 6 }}>
                              <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#1a2e1e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>{c.ordre}</span>
                              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#1a1209' }}>{c.titre}</span>
                              <span style={{ fontSize: 12, color: '#a89478', fontWeight: 600 }}>{c.volumeHeuresPrevu}h</span>
                              {c.sequenceCibleFin && <span style={{ background: '#ede9fe', color: '#6d28d9', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>Seq {c.sequenceCibleFin}</span>}
                              <button onClick={() => handleDeleteChapitre(c.id)}
                                style={{ padding: '3px 8px', borderRadius: 6, background: '#fee2e2', color: '#991b1b', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulaire ajout chapitre */}
                      {addingChapFor === p.id ? (
                        <div style={{ background: '#f7f3ee', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10 }}>
                            <div>
                              <label style={labelStyle}>Titre *</label>
                              <input value={chapTitre} onChange={e => setChapTitre(e.target.value)} placeholder="Ex: Fonctions numériques" style={inputStyle} />
                            </div>
                            <div>
                              <label style={labelStyle}>Durée (h)</label>
                              <input type="number" value={chapHeures} min={1} max={50} onChange={e => setChapHeures(parseInt(e.target.value) || 2)} style={inputStyle} />
                            </div>
                            <div>
                              <label style={labelStyle}>Séquence cible</label>
                              <select value={chapSeq} onChange={e => setChapSeq(e.target.value)} style={inputStyle}>
                                <option value="">—</option>
                                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>Séquence {n}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => handleAddChapitre(p.id)}
                              style={{ padding: '8px 18px', borderRadius: 10, background: '#1a2e1e', color: 'white', border: 'none', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
                              Ajouter
                            </button>
                            <button onClick={() => { setAddingChapFor(null); setChapTitre(''); setChapHeures(2); setChapSeq('') }}
                              style={{ padding: '8px 18px', borderRadius: 10, background: '#f0ebe3', color: '#6b5c45', border: 'none', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setAddingChapFor(p.id)}
                          style={{ padding: '8px 16px', borderRadius: 10, background: '#f0ebe3', color: '#1a2e1e', border: '1.5px dashed #c4b8a8', fontSize: 13, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer' }}>
                          + Ajouter un chapitre
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
