'use client'
import { useState, useEffect, useCallback } from 'react'
import { useT } from '@/lib/i18n'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { AlertTriangle, Loader2, Search, CheckCircle2, Check, X, Package } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string }
interface SubjectItem { id: string; name: string }

interface GradeItem {
  id: string
  sequenceAverage: number | null
  validationStatus: string
  student: { id: string; firstName: string; lastName: string }
  subject: { id: string; name: string; code: string | null }
}

export default function SectionGrades({ onToast }: Props) {
  const t = useT('grades')
  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    DRAFT:     { bg: 'var(--bg2)', color: 'var(--text2)', label: t('status_labels.DRAFT')     },
    SUBMITTED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: t('status_labels.SUBMITTED')    },
    VALIDATED: { bg: 'var(--green-light)', color: 'var(--green)', label: t('status_labels.VALIDATED')     },
    LOCKED:    { bg: 'var(--green-light)', color: 'var(--green)', label: t('status_labels.LOCKED')    },
    REJECTED:  { bg: 'var(--red-light)', color: 'var(--red)', label: t('status_labels.REJECTED')     },
  }
  const [classes, setClasses]     = useState<ClassItem[]>([])
  const [subjects, setSubjects]   = useState<SubjectItem[]>([])
  const [filtersReady, setFiltersReady] = useState(false)
  const [classId, setClassId]     = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [status, setStatus]       = useState('SUBMITTED')

  // Charger classes + matières au montage
  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes',  { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
    ]).then(([cd, sd]) => {
      setClasses(cd.data  || [])
      setSubjects(sd.data || [])
    }).catch(() => {}).finally(() => setFiltersReady(true))
  }, [])

  const fetchGradesFn = useCallback(async (): Promise<GradeItem[]> => {
    const params = new URLSearchParams({ limit: '100' })
    if (classId)   params.set('classId', classId)
    if (subjectId) params.set('subjectId', subjectId)
    if (status)    params.set('validationStatus', status)
    const res = await fetchApi(`/api/v2/grades?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.grades || []
  }, [classId, subjectId, status])

  const { data: gradesData, loading, error, fromCache, cachedAt, refetch: fetchGrades } = useCachedFetch<GradeItem[]>(`admin:grades:${classId}:${subjectId}:${status}`, fetchGradesFn)
  const grades = gradesData ?? []

  // Rafraîchissement temps réel quand l'assistant IA valide des notes en masse.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'grade') fetchGrades()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchGrades])

  const handleValidate = async (gradeId: string) => {
    try {
      const res = await fetchApi(`/api/v2/grades/${gradeId}/validate`, {
        method: 'PATCH', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Note validée avec succès', 'success')
      fetchGrades()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de validation', 'error')
    }
  }

  const handleBulkValidate = async () => {
    if (!classId) { onToast('Sélectionnez une classe', 'info'); return }
    const pending = grades.filter(g => g.validationStatus === 'SUBMITTED')
    if (pending.length === 0) { onToast('Aucune note en attente', 'info'); return }
    let ok = 0
    for (const g of pending) {
      try {
        const res = await fetchApi(`/api/v2/grades/${g.id}/validate`, { method: 'PATCH', credentials: 'include' })
        if (res.ok) ok++
      } catch { /* continue */ }
    }
    onToast(`${ok}/${pending.length} note${ok > 1 ? 's' : ''} validée${ok > 1 ? 's' : ''}`, ok > 0 ? 'success' : 'error')
    fetchGrades()
  }

  const pendingCount = grades.filter(g => g.validationStatus === 'SUBMITTED').length

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
        <div>
          <div className="text-[22px] md:text-[28px]" style={sTitle}>{t('title')}</div>
          <div className="text-[13px] md:text-[17px]" style={sSub}>Consultation et validation des notes</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Package size={14} strokeWidth={2} /> {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        {pendingCount > 0 && (
          <>
            {/* Mobile — pilule "Valider tout" a cote du titre (maquette) */}
            <button className="md:hidden inline-flex items-center gap-[6px] rounded-full px-[14px] py-[10px] text-[12.5px] flex-shrink-0 border-0"
              style={{ background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={handleBulkValidate}>
              Valider tout
            </button>
            <div className="hidden md:flex" style={{ background: 'var(--amber-light)', border: '1.5px solid rgba(217,119,6,0.25)', borderRadius: 12, padding: '8px 16px', fontSize: 15, fontWeight: 700, color: 'var(--amber)', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} strokeWidth={2} /> {pendingCount} note{pendingCount > 1 ? 's' : ''} en attente
            </div>
          </>
        )}
      </div>

      {/* Bandeau "en attente" — mobile uniquement, sous le titre (maquette) */}
      {pendingCount > 0 && (
        <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--amber-light)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, marginTop: -12 }}>
          <AlertTriangle size={16} strokeWidth={2.2} color="var(--amber)" />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)' }}>{pendingCount} note{pendingCount > 1 ? 's' : ''} en attente</span>
        </div>
      )}

      <div className="rounded-none md:rounded-[16px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden' }}>
        {/* Filtres */}
        <div className="grid grid-cols-2 sm:flex gap-2.5 px-0 py-0 mb-4 md:mb-0 sm:px-5 sm:py-3.5 sm:items-center sm:flex-wrap md:border-b md:border-[var(--border)]">
          <select value={classId} onChange={e => setClassId(e.target.value)} className="w-full sm:w-auto" style={filterSelect} disabled={!filtersReady}>
            <option value="">Toutes les classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full sm:w-auto" style={filterSelect} disabled={!filtersReady}>
            <option value="">Toutes les matières</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="w-full sm:w-auto" style={filterSelect}>
            <option value="">Tous les statuts</option>
            <option value="SUBMITTED">{t('status_labels.SUBMITTED')}</option>
            <option value="VALIDATED">{t('status_labels.VALIDATED')}</option>
            <option value="DRAFT">{t('status_labels.DRAFT')}</option>
            <option value="REJECTED">{t('status_labels.REJECTED')}</option>
            <option value="LOCKED">{t('status_labels.LOCKED')}</option>
          </select>
          <button className="w-full sm:w-auto" style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={fetchGrades} disabled={loading}>
            {loading ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : <Search size={15} strokeWidth={2} />} Charger
          </button>
          {pendingCount > 0 && (
            <button data-help-id="grades-bulk-validate" className="hidden md:inline-flex sm:col-span-1 w-full sm:w-auto" style={{ ...btnSec, color: 'var(--green)', borderColor: 'var(--green)', marginLeft: 'auto', alignItems: 'center', justifyContent: 'center', gap: 6 }} onClick={handleBulkValidate}>
              <CheckCircle2 size={15} strokeWidth={2} /> Valider tout ({pendingCount})
            </button>
          )}
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        )}

        {!loading && error === 'OFFLINE_NO_CACHE' && (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 17 }}>
            Aucune donnée en cache pour ces filtres — reconnectez-vous pour charger les notes.
          </div>
        )}

        {!loading && error && error !== 'OFFLINE_NO_CACHE' && (
          <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ color: 'var(--red)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={15} strokeWidth={2} /> {error}</span>
            <button onClick={fetchGrades}
              style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && grades.length === 0 && (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 17 }}>
            Aucune note pour ces filtres
          </div>
        )}

        {!loading && !error && grades.length > 0 && (
          <>
            {/* ── Cartes empilées — mobile ── */}
            <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
              {grades.map((grade) => {
                const st = STATUS_STYLE[grade.validationStatus] ?? STATUS_STYLE.DRAFT
                return (
                  <div key={grade.id} className="rounded-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15.5 }}>{grade.student.firstName} {grade.student.lastName}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{grade.subject.name}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: 20, fontWeight: 900, color: (grade.sequenceAverage ?? 0) < 10 ? 'var(--red)' : 'var(--green)' }}>
                          {grade.sequenceAverage != null ? grade.sequenceAverage.toFixed(1) : '—'}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text3)', marginLeft: 3 }}>/20</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 13, fontWeight: 800, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                      {grade.validationStatus === 'SUBMITTED' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            style={{ ...btnSecSm, color: 'var(--green)', borderColor: 'rgba(5,150,105,0.5)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleValidate(grade.id)}>
                            <Check size={14} strokeWidth={2} /> Valider
                          </button>
                          <button
                            style={{ ...btnSecSm, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.4)', display: 'inline-flex', alignItems: 'center' }}
                            onClick={() => onToast('Saisissez un motif de rejet dans le module notes', 'info')}>
                            <X size={14} strokeWidth={2} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Tableau — desktop ── */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 550 }}>
                <thead>
                  <tr>{['Élève', 'Matière', 'Note /20', 'Statut', 'Actions'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {grades.map((grade) => {
                    const st = STATUS_STYLE[grade.validationStatus] ?? STATUS_STYLE.DRAFT
                    return (
                      <tr key={grade.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)' }}>
                          {grade.student.firstName} {grade.student.lastName}
                        </td>
                        <td style={tdStyle}>{grade.subject.name}</td>
                        <td style={tdStyle}>
                          <span style={{
                            fontSize: 20, fontWeight: 900,
                            color: (grade.sequenceAverage ?? 0) < 10 ? 'var(--red)' : 'var(--green)',
                          }}>
                            {grade.sequenceAverage != null ? grade.sequenceAverage.toFixed(1) : '—'}
                          </span>
                          <span style={{ fontSize: 14, color: 'var(--text3)', marginLeft: 4 }}>/20</span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {grade.validationStatus === 'SUBMITTED' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                style={{ ...btnSecSm, color: 'var(--green)', borderColor: 'rgba(5,150,105,0.5)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => handleValidate(grade.id)}>
                                <Check size={14} strokeWidth={2} /> Valider
                              </button>
                              <button
                                style={{ ...btnSecSm, color: 'var(--red)', borderColor: 'rgba(220,38,38,0.4)', display: 'inline-flex', alignItems: 'center' }}
                                onClick={() => onToast('Saisissez un motif de rejet dans le module notes', 'info')}>
                                <X size={14} strokeWidth={2} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>
                {grades.length} note{grades.length > 1 ? 's' : ''} — dont {pendingCount} en attente
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '5px 12px', borderRadius: 8, fontSize: 14, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSelect: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }
