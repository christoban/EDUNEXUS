'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { X, AlertTriangle, CalendarDays, Calendar, Bot } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string }
interface TimetableSlot {
  id: string; dayOfWeek: number; startTime: string; endTime: string
  room: string | null; kind: string
  subject: { id: string; name: string } | null
  teacher: { id: string; firstName: string; lastName: string } | null
}
interface Timetable {
  id: string; classId: string; status: string; generatedByAI: boolean
  class: { id: string; name: string }
  slots: TimetableSlot[]
}
interface PeriodeGrille {
  ordre: number; debut: string; fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'; duree: number
}
interface GenResult {
  classId: string; className: string; timetableId: string; slotsCreated: number; isNew: boolean
}
interface UnplacedItem {
  classId: string; className: string; subjectId: string; subjectName: string
  teacherName: string; explication: string
}
interface GenResults {
  results: GenResult[]
  skipped: { classId: string; className: string; reason: string }[]
  unplaced: UnplacedItem[]
  stats: { classesTraitees: number; classesIgnorees: number; slotsTotal: number; coursNonPlaces: number }
}

const DAY_MAP: Record<string, number> = {
  LUNDI: 1, MARDI: 2, MERCREDI: 3, JEUDI: 4, VENDREDI: 5, SAMEDI: 6,
}

const SUBJECT_PALETTES = [
  { bg: 'rgba(5,150,105,0.10)', border: 'var(--green)', text: 'var(--green2)' },
  { bg: 'rgba(37,99,235,0.09)', border: 'var(--blue)', text: 'var(--blue)' },
  { bg: 'rgba(217,119,6,0.09)', border: 'var(--amber)', text: 'var(--amber)' },
  { bg: 'rgba(139,92,246,0.09)', border: 'var(--purple)', text: 'var(--purple)' },
  { bg: 'rgba(236,72,153,0.09)', border: '#db2777', text: '#be185d' },
  { bg: 'rgba(20,184,166,0.09)', border: 'var(--teal)', text: 'var(--teal)' },
]
function subjectColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length]
}

export default function SectionTimetable({ onToast }: Props) {
  const t = useT('admin')
  const [classes, setClasses]                 = useState<ClassItem[]>([])
  const [classId, setClassId]                 = useState('')
  const [timetable, setTimetable]             = useState<Timetable | null>(null)
  const [squelette, setSquelette]             = useState<PeriodeGrille[]>([])
  const [joursActifs, setJoursActifs]         = useState<string[]>(['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
  const [loading, setLoading]                 = useState(false)
  const [loadingClasses, setLoadingClasses]   = useState(true)
  const [publishing, setPublishing]           = useState(false)
  const [error, setError]                     = useState<string | null>(null)

  // Auto-generation state
  const [autoGenerating, setAutoGenerating]   = useState(false)
  const [genResults, setGenResults]           = useState<GenResults | null>(null)
  const [showGenPanel, setShowGenPanel]       = useState(false)
  const [confirmReset, setConfirmReset]       = useState(false)

  // Groq adjustment state
  const [adjustInstruction, setAdjustInstruction] = useState('')
  const [adjusting, setAdjusting]             = useState(false)
  const [adjustResult, setAdjustResult]       = useState<{ applied: string[]; errors: string[]; message: string } | null>(null)

  // Vue mobile : un jour a la fois (onglets) au lieu de la grille complete, illisible en dessous de md.
  const [mobileDay, setMobileDay]             = useState('LUNDI')

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()),
    ]).then(([classData, configData]) => {
      setClasses(classData.data || [])
      if (configData.data) {
        setSquelette(configData.data.squelette || [])
        setJoursActifs(configData.data.config?.joursActifs || ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
      }
    }).catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  const fetchTimetable = useCallback(async (cid?: string) => {
    const id = cid ?? classId
    if (!id) return
    setLoading(true); setError(null)
    try {
      const res = await fetchApi(`/api/v2/timetables?classId=${id}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.err'))
      const list: Timetable[] = data.data || []
      setTimetable(list[0] ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('timetable.errLoad'))
    } finally {
      setLoading(false)
    }
  }, [classId])

  // Rafraîchissement temps réel quand l'assistant IA publie/modifie un emploi du temps.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'timetable' && classId) fetchTimetable()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchTimetable, classId])

  const handleClassChange = (newId: string) => {
    setClassId(newId); setTimetable(null); setError(null); setAdjustResult(null); setAdjustInstruction('')
    if (newId) fetchTimetable(newId)
  }

  const handlePublish = async () => {
    if (!timetable) return
    setPublishing(true)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/publish`, {
        method: 'PUT', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.err'))
      onToast(t('timetable.published'), 'success')
      fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.errPublish'), 'error')
    } finally {
      setPublishing(false)
    }
  }

  const handleAutoGenerate = async () => {
    setAutoGenerating(true); setGenResults(null); setConfirmReset(false)
    try {
      const res = await fetchApi('/api/v2/timetables/auto-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.err'))
      setGenResults(data.data)
      setShowGenPanel(true)
      const s = data.data.stats
      onToast(
        `${t('timetable.genToast', { classes: s.classesTraitees, slots: s.slotsTotal })}${s.coursNonPlaces > 0 ? t('timetable.genUnplacedSuffix', { n: s.coursNonPlaces }) : ''}`,
        s.coursNonPlaces > 0 ? 'info' : 'success',
      )
      if (classId) fetchTimetable()
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.errGen'), 'error')
    } finally {
      setAutoGenerating(false)
    }
  }

  const handleAdjust = async () => {
    if (!timetable || !adjustInstruction.trim()) return
    setAdjusting(true); setAdjustResult(null)
    try {
      const res = await fetchApi(`/api/v2/timetables/${timetable.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ instruction: adjustInstruction }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('timetable.err'))
      setAdjustResult(data.data)
      if (data.data.applied?.length) {
        onToast(data.data.message, 'success')
        setAdjustInstruction('')
        fetchTimetable()
      } else {
        onToast(data.data.message, 'info')
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('timetable.errAI'), 'error')
    } finally {
      setAdjusting(false)
    }
  }

  const slots = timetable?.slots ?? []
  const slotMap = new Map<string, TimetableSlot>()
  for (const s of slots) slotMap.set(`${s.dayOfWeek}-${s.startTime}`, s)

  const joursNumeriques = joursActifs.map(j => DAY_MAP[j]).filter(Boolean)
  const hasGridConfig = squelette.length > 0
  const fallbackTimes = hasGridConfig ? [] : Array.from(new Set(slots.map(s => s.startTime))).sort()
  const displayDays = hasGridConfig ? joursActifs : ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
  const effectiveMobileDay = displayDays.includes(mobileDay) ? mobileDay : displayDays[0]

  const totalCours = slots.filter(s => s.kind === 'CLASS').length
  const remplis    = slots.filter(s => s.kind === 'CLASS' && s.subject).length
  const pct        = totalCours > 0 ? Math.round(remplis / totalCours * 100) : 0

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="text-[22px] md:text-[28px]" style={sTitle}>{t('timetable.title')}</div>
          <div className="text-[13px] md:text-[17px]" style={sSub}>
            {timetable
              ? `${timetable.class.name} — ${t('timetable.slotsFilled', { filled: remplis, total: totalCours })} · ${timetable.status === 'PUBLISHED' ? t('timetable.statusPublished') : timetable.generatedByAI ? t('timetable.statusAIDraft') : t('timetable.statusDraft')}`
              : t('timetable.selectOrGen')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={classId} onChange={e => handleClassChange(e.target.value)} style={selectSt} disabled={loadingClasses}>
            <option value="">{loadingClasses ? t('timetable.loading') : t('timetable.selectClass')}</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Bouton génération automatique */}
          {!confirmReset ? (
            <button className="text-[12.5px] md:text-[15px]" style={{ ...btnAI, borderRadius: 20, padding: '10px 16px', fontWeight: 700, opacity: autoGenerating ? 0.7 : 1 }} disabled={autoGenerating}
              onClick={() => setConfirmReset(true)}>
              {autoGenerating
                ? <><span style={spinInline} />{t('timetable.generating')}</>
                : t('timetable.autoGen')}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 10, padding: '6px 10px' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>{t('timetable.overwriteConfirm')}</span>
              <button style={{ ...btnPrim, padding: '5px 12px', fontSize: 13 }} onClick={handleAutoGenerate} disabled={autoGenerating}>
                {autoGenerating ? <><span style={spinInline} />…</> : t('timetable.yesGenerate')}
              </button>
              <button style={{ ...btnSec, padding: '5px 10px', fontSize: 13 }} onClick={() => setConfirmReset(false)}>{t('timetable.cancel')}</button>
            </div>
          )}

          {timetable && timetable.status !== 'PUBLISHED' && (
            <button style={btnPrim} onClick={handlePublish} disabled={publishing}>
              {publishing ? <><span style={spinInline} />{t('timetable.publishing')}</> : t('timetable.publishBtn')}
            </button>
          )}
        </div>
      </div>

      {/* Bandeau info rôle */}
      <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13, color: 'var(--blue)' }}>
        <strong>{t('timetable.bannerRole')}</strong> {t('timetable.bannerText1')} <strong>{t('timetable.bannerCenseur')}</strong> {t('timetable.bannerText2')} <strong>{t('timetable.bannerAutoGen')}</strong> {t('timetable.bannerText3')} <strong>{t('timetable.bannerPublish')}</strong>.
      </div>

      {/* Panel résultats génération */}
      {showGenPanel && genResults && (
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border2)', marginBottom: 20, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
            <div>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{t('timetable.genResultsTitle')}</span>
              <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text3)' }}>
                {t('timetable.genPanelSummary', { classes: genResults.stats.classesTraitees, slots: genResults.stats.slotsTotal })}
                {genResults.stats.coursNonPlaces > 0 && <span style={{ color: 'var(--red)', fontWeight: 700 }}>{t('timetable.genUnplacedSuffix', { n: genResults.stats.coursNonPlaces })}</span>}
              </span>
            </div>
            <button onClick={() => setShowGenPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4, display: 'inline-flex', alignItems: 'center' }}><X size={16} strokeWidth={2} /></button>
          </div>

          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Classes générées */}
            {genResults.results.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', marginBottom: 6 }}>{t('timetable.classesGenerated')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {genResults.results.map(r => (
                    <div key={r.classId} style={{ background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 8, padding: '4px 10px', fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                      {r.className} · {t('timetable.lessonsCount', { n: r.slotsCreated })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Classes ignorées */}
            {genResults.skipped.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--amber)', marginBottom: 6 }}>{t('timetable.skipped')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {genResults.skipped.map(s => (
                    <div key={s.classId} style={{ fontSize: 13, color: 'var(--amber)' }}><strong>{s.className}</strong> — {s.reason}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Cours non placés avec explication Groq */}
            {genResults.unplaced.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)', marginBottom: 8 }}>{t('timetable.unplacedTitle')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {genResults.unplaced.map((u, i) => (
                    <div key={i} style={{ background: 'var(--red-light)', border: '1px solid var(--red-light)', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--red)', marginBottom: 4 }}>
                        {u.className} — {u.subjectName} ({u.teacherName})
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.5 }}>{u.explication}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chargement */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Erreur */}
      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 14, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <AlertTriangle size={16} strokeWidth={2} color="var(--red)" />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1 }}>{error}</span>
          <button onClick={() => fetchTimetable()} style={btnSec}>{t('timetable.retry')}</button>
        </div>
      )}

      {/* Pas de classe */}
      {!loading && !error && !classId && (
        <div className="p-[32px] md:px-[32px] md:py-[60px]" style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><CalendarDays size={52} strokeWidth={1.5} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('timetable.selectClassTitle')}</div>
          <div style={{ fontSize: 15, color: 'var(--text3)', marginBottom: 24 }}>{t('timetable.selectClassHint')}</div>
          <button style={{ ...btnAI, fontSize: 16, padding: '12px 24px' }} disabled={autoGenerating}
            onClick={() => setConfirmReset(true)}>
            {autoGenerating ? <><span style={spinInline} />{t('timetable.genInProgress')}</> : t('timetable.autoGenAll')}
          </button>
        </div>
      )}

      {/* Classe sélectionnée, pas d'EDT */}
      {!loading && !error && classId && !timetable && (
        <div className="p-[32px] md:px-[32px] md:py-[60px]" style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Calendar size={52} strokeWidth={1.5} /></div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('timetable.noTimetable')}</div>
          <div style={{ fontSize: 15, color: 'var(--text3)' }}>{t('timetable.noTimetableHint')}</div>
        </div>
      )}

      {/* Grille lecture seule */}
      {!loading && !error && timetable && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          {/* Barre progression */}
          <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>{t('timetable.slotsCount', { filled: remplis, total: totalCours })}</span>
            <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--amber)', transition: 'width 0.3s', borderRadius: 4 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: pct === 100 ? 'var(--green)' : 'var(--amber)' }}>{pct}%</span>
            {timetable.generatedByAI && <span style={{ fontSize: 12, background: 'var(--purple-light)', color: 'var(--purple)', fontWeight: 700, borderRadius: 20, padding: '3px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Bot size={12} strokeWidth={2} /> IA</span>}
            {timetable.status === 'PUBLISHED' && <span style={{ fontSize: 12, background: 'var(--green-light)', color: 'var(--green)', fontWeight: 700, borderRadius: 20, padding: '3px 10px' }}>{t('timetable.statusPublished')}</span>}
            {timetable.status !== 'PUBLISHED' && <span style={{ fontSize: 12, background: 'var(--amber-light)', color: 'var(--amber)', fontWeight: 700, borderRadius: 20, padding: '3px 10px' }}>{t('timetable.statusDraft')}</span>}
          </div>

          {slots.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 16 }}>
              {t('timetable.skeletonEmpty')}
            </div>
          ) : (
            <>
            {/* ── Vue jour-par-jour — mobile ── */}
            <div className="md:hidden">
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                {displayDays.map(j => (
                  <button key={j} onClick={() => setMobileDay(j)}
                    style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 800, border: `1.5px solid ${effectiveMobileDay === j ? 'var(--green)' : 'var(--border)'}`, background: effectiveMobileDay === j ? 'var(--green-light)' : 'white', color: effectiveMobileDay === j ? 'var(--green)' : 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t(`timetable.days.${j}`)}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {hasGridConfig ? squelette.map((periode, idx) => {
                  if (periode.type !== 'COURS') {
                    const isPetite = periode.type === 'PETITE_PAUSE'
                    return (
                      <div key={`m-pause-${idx}`} style={{ textAlign: 'center', padding: '6px 12px', background: 'var(--amber-light)', fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>
                        {isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')} — {periode.debut} {t('timetable.to')} {periode.fin}
                      </div>
                    )
                  }
                  const slot = slotMap.get(`${DAY_MAP[effectiveMobileDay]}-${periode.debut}`)
                  const col = slot?.subject ? subjectColor(slot.subject.id) : null
                  return (
                    <div key={`m-cours-${periode.debut}`} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 64, flexShrink: 0, padding: '10px 8px', background: 'var(--bg)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', textAlign: 'center' }}>
                        {periode.debut}<br /><span style={{ fontSize: 10 }}>{periode.fin}</span>
                      </div>
                      <div style={{ flex: 1, padding: '10px 12px', background: slot?.subject ? col!.bg : 'transparent', borderLeft: slot?.subject ? `3px solid ${col!.border}` : 'none' }}>
                        {slot?.subject ? (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 800, color: col!.text }}>{slot.subject.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                              {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}
                            </div>
                          </>
                        ) : (
                          <div style={{ fontSize: 13, color: 'var(--text3)' }}>—</div>
                        )}
                      </div>
                    </div>
                  )
                }) : fallbackTimes.map(time => {
                  const d = DAY_MAP[effectiveMobileDay]
                  const slot = slotMap.get(`${d}-${time}`)
                  const col = slot?.subject ? subjectColor(slot.subject.id) : null
                  return (
                    <div key={`m-${time}`} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 64, flexShrink: 0, padding: '10px 8px', background: 'var(--bg)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', textAlign: 'center' }}>{time}</div>
                      <div style={{ flex: 1, padding: '10px 12px', background: slot?.subject ? col!.bg : 'transparent', borderLeft: slot?.subject ? `3px solid ${col!.border}` : 'none' }}>
                        {slot?.subject ? (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 800, color: col!.text }}>{slot.subject.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}</div>
                          </>
                        ) : <div style={{ fontSize: 13, color: 'var(--text3)' }}>—</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Grille complete — desktop ── */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>
                    <th style={{ ...thSt, width: 100 }}>{t('timetable.schedule')}</th>
                    {(hasGridConfig ? joursActifs : ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']).map(j => (
                      <th key={j} style={thSt}>{t(`timetable.days.${j}`)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasGridConfig ? (
                    squelette.map((periode, idx) => {
                      if (periode.type !== 'COURS') {
                        const isPetite = periode.type === 'PETITE_PAUSE'
                        return (
                          <tr key={`pause-${idx}`}>
                            <td colSpan={joursActifs.length + 1}
                              style={{ textAlign: 'center', padding: '5px 12px', background: 'var(--amber-light)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>
                              {isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')} — {periode.debut} {t('timetable.to')} {periode.fin}
                            </td>
                          </tr>
                        )
                      }
                      return (
                        <tr key={`cours-${periode.debut}`}>
                          <td style={{ padding: '8px 10px', background: 'var(--bg)', fontSize: 13, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            {periode.debut}<br /><span style={{ fontSize: 11 }}>{periode.fin}</span>
                          </td>
                          {joursActifs.map(jour => {
                            const slot = slotMap.get(`${DAY_MAP[jour]}-${periode.debut}`)
                            const col = slot?.subject ? subjectColor(slot.subject.id) : null
                            return (
                              <td key={jour} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 110, height: 64 }}>
                                {slot?.subject ? (
                                  <div style={{ padding: '8px 10px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                    <div style={{ fontSize: 13, fontWeight: 800, color: col!.text, lineHeight: 1.2 }}>{slot.subject.name}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                      {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ height: '100%', background: 'var(--bg)' }} />
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })
                  ) : (
                    fallbackTimes.map(time => (
                      <tr key={time}>
                        <td style={{ padding: '8px 10px', background: 'var(--bg)', fontSize: 13, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {time}
                        </td>
                        {[1,2,3,4,5].map(d => {
                          const slot = slotMap.get(`${d}-${time}`)
                          const col = slot?.subject ? subjectColor(slot.subject.id) : null
                          return (
                            <td key={d} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 110, height: 64 }}>
                              {slot?.subject ? (
                                <div style={{ padding: '8px 10px', height: '100%', background: col!.bg, borderLeft: `3px solid ${col!.border}`, boxSizing: 'border-box' }}>
                                  <div style={{ fontSize: 13, fontWeight: 800, color: col!.text }}>{slot.subject.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                                    {slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ height: '100%' }} />
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {/* Ajustement IA — visible si EDT DRAFT sélectionné */}
      {timetable && timetable.status !== 'PUBLISHED' && (
        <div style={{ marginTop: 20, background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border2)', padding: '18px 20px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{t('timetable.adjustTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
            {t('timetable.adjustHint')}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <textarea
              value={adjustInstruction}
              onChange={e => setAdjustInstruction(e.target.value)}
              placeholder={t('timetable.adjustPlaceholder')}
              rows={2}
              style={{ flex: 1, padding: '10px 13px', border: '1.5px solid var(--border2)', borderRadius: 10, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', outline: 'none', color: 'var(--text)' }}
            />
            <button
              style={{ ...btnAI, alignSelf: 'flex-end', opacity: adjusting || !adjustInstruction.trim() ? 0.6 : 1 }}
              disabled={adjusting || !adjustInstruction.trim()}
              onClick={handleAdjust}
            >
              {adjusting ? <><span style={spinInline} />{t('timetable.processing')}</> : t('timetable.apply')}
            </button>
          </div>

          {adjustResult && (
            <div style={{ marginTop: 12 }}>
              {adjustResult.applied.length > 0 && (
                <div style={{ background: 'var(--green-light)', border: '1px solid var(--green)', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--green)', marginBottom: 4 }}>{t('timetable.changesApplied')}</div>
                  {adjustResult.applied.map((a, i) => <div key={i} style={{ fontSize: 13, color: 'var(--green)' }}>• {a}</div>)}
                </div>
              )}
              {adjustResult.errors.length > 0 && (
                <div style={{ background: 'var(--red-light)', border: '1px solid var(--red-light)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)', marginBottom: 4 }}>{t('timetable.conflicts')}</div>
                  {adjustResult.errors.map((e, i) => <div key={i} style={{ fontSize: 13, color: 'var(--red)' }}>• {e}</div>)}
                </div>
              )}
              {adjustResult.applied.length === 0 && adjustResult.errors.length === 0 && (
                <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>{adjustResult.message}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const sTitle:    React.CSSProperties = { fontFamily: 'var(--font-spectral,Spectral,serif)', fontWeight: 700, color: 'var(--text)' }
const sSub:      React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnPrim:   React.CSSProperties = { padding: '10px 18px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnAI:     React.CSSProperties = { padding: '10px 18px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--purple),var(--purple))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6 }
const btnSec:    React.CSSProperties = { padding: '9px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt:  React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt:      React.CSSProperties = { padding: '10px 8px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }
const spinInline: React.CSSProperties = { display: 'inline-block', width: 13, height: 13, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', verticalAlign: 'middle' }
