'use client'
import { useState, useEffect, useCallback } from 'react'
import { Siren, AlertTriangle, Eye, CheckCircle2, Star, RefreshCw, X, Bot } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface StudentHealth {
  studentId: string; name: string; className: string
  healthScore: number; alertLevel: 'critical' | 'warning' | 'recommendation' | 'good' | 'excellent'
}

interface HealthSummary { critical: number; warning: number; recommendation: number; good: number; excellent: number }

interface ClassItem { id: string; name: string }

const ALERT_STYLE: Record<string, { bg: string; color: string; label: string; icon: LucideIcon }> = {
  critical:       { bg: 'var(--red-light)', color: 'var(--red)', label: 'Critique',        icon: Siren },
  warning:        { bg: 'var(--orange-light)', color: 'var(--orange)', label: 'Avertissement',    icon: AlertTriangle },
  recommendation: { bg: 'var(--amber-light)', color: 'var(--amber)', label: 'Surveillance',     icon: Eye },
  good:           { bg: 'var(--blue-light)', color: 'var(--blue)', label: 'Bien',             icon: CheckCircle2 },
  excellent:      { bg: 'var(--green-light)', color: 'var(--green)', label: 'Excellent',        icon: Star },
}

interface HealthData { students: StudentHealth[]; summary: HealthSummary | null }

export default function SectionAdminAI({ onToast }: Props) {
  const t = useT('admin')
  const [classes, setClasses]     = useState<ClassItem[]>([])
  const [classFilter, setClassFilter] = useState('')
  const [alertFilter, setAlertFilter] = useState('')

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const d = await res.json()
      if (res.ok) setClasses(d.data || [])
    } catch { /* silencieux */ }
  }, [])

  const fetchHealthFn = useCallback(async (): Promise<HealthData> => {
    const params = new URLSearchParams()
    if (classFilter) params.set('classId', classFilter)
    const res = await fetchApi(`/api/v2/ai/students-health?${params}`, { credentials: 'include' })
    const d = await res.json()
    if (!res.ok) throw new Error(d.message || 'Erreur serveur')
    return { students: d.students || [], summary: d.summary || null }
  }, [classFilter])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<HealthData>(`admin:ai-health:${classFilter}`, fetchHealthFn)
  const students = data?.students ?? []
  const summary = data?.summary ?? null

  useEffect(() => { fetchClasses() }, [fetchClasses])
  useEffect(() => {
    if (error && error !== 'OFFLINE_NO_CACHE' && !data) onToast(error, 'error')
  }, [error, data, onToast])

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  const filtered = alertFilter ? students.filter(s => s.alertLevel === alertFilter) : students
  const atRisk   = students.filter(s => s.alertLevel === 'critical' || s.alertLevel === 'warning').length

  return (
    <div className="px-4 py-5 md:px-8 md:py-7" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
        <div>
          <div style={sTitle}>{t('ai.title')}</div>
          <div style={sSub}>Scores de bien-être académique · Alertes automatiques</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={refetch}><RefreshCw size={15} /> Actualiser</button>
      </div>

      {/* KPIs */}
      {summary && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 14, marginBottom: 22 }}>
          {(Object.entries(ALERT_STYLE) as [string, typeof ALERT_STYLE[string]][]).map(([key, s]) => (
            <div key={key} style={{ background: 'var(--surface)', borderRadius: 14, border: `1.5px solid ${alertFilter === key ? 'var(--green)' : 'var(--border)'}`, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
              onClick={() => setAlertFilter(alertFilter === key ? '' : key)}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><s.icon size={16} color={s.color} /></div>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{summary[key as keyof HealthSummary]}</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {atRisk > 0 && !loading && (
        <div style={{ background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 14, padding: '14px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Siren size={20} color="var(--red)" />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--red)' }}>
            {atRisk} élève{atRisk > 1 ? 's' : ''} nécessite{atRisk === 1 ? '' : 'nt'} une attention immédiate
          </span>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={filterSt}>
          <option value="">Toutes les classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {alertFilter && (
          <button onClick={() => setAlertFilter('')} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <X size={14} /> {ALERT_STYLE[alertFilter]?.label}
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--text3)', fontWeight: 600, alignSelf: 'center' }}>
          {filtered.length} élève{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--red)', fontWeight: 700 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Bot size={44} /></div>
            <div style={{ fontSize: 17 }}>Aucun élève pour ce filtre</div>
          </div>
        ) : (
          <>
          {/* ── Cartes empilées — mobile ── */}
          <div className="md:hidden flex flex-col" style={{ gap: 10, padding: 14 }}>
            {filtered.map(s => {
              const al = ALERT_STYLE[s.alertLevel] ?? ALERT_STYLE.good
              const barColor = s.alertLevel === 'critical' ? 'var(--red)' : s.alertLevel === 'warning' ? 'var(--orange)' : s.alertLevel === 'recommendation' ? 'var(--amber)' : s.alertLevel === 'good' ? 'var(--blue)' : 'var(--green)'
              return (
                <div key={s.studentId} style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 14, padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 15 }}>{s.name}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{s.className}</div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 22, fontSize: 12, fontWeight: 800, background: al.bg, color: al.color, display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <al.icon size={12} /> {al.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${s.healthScore}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                    <span style={{ fontWeight: 900, color: barColor, fontSize: 15, flexShrink: 0 }}>{s.healthScore}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── Tableau — desktop ── */}
          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr>{['Élève', 'Classe', 'Score santé', 'Niveau d\'alerte'].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const al = ALERT_STYLE[s.alertLevel] ?? ALERT_STYLE.good
                  const barColor = s.alertLevel === 'critical' ? 'var(--red)' : s.alertLevel === 'warning' ? 'var(--orange)' : s.alertLevel === 'recommendation' ? 'var(--amber)' : s.alertLevel === 'good' ? 'var(--blue)' : 'var(--green)'
                  return (
                    <tr key={s.studentId}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{s.name}</td>
                      <td style={tdSt}>{s.className}</td>
                      <td style={tdSt}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 120, height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${s.healthScore}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.5s' }} />
                          </div>
                          <span style={{ fontWeight: 900, color: barColor, fontSize: 16 }}>{s.healthScore}</span>
                        </div>
                      </td>
                      <td style={tdSt}>
                        <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 13, fontWeight: 800, background: al.bg, color: al.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <al.icon size={13} /> {al.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '13px 16px', fontSize: 15, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
