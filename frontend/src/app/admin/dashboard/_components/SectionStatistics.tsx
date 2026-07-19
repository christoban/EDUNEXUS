'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Apple, Package } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string; level?: string | null }
interface SubjectItem { id: string; name: string }
interface TeacherItem { id: string; firstName: string; lastName: string }

interface EvolutionPoint { sequenceName: string; periodName: string; moyenne: number; nbNotes: number }
interface ClassComparisonRow { classId: string; className: string; level: string | null; moyenne: number | null; nbEleves: number }
interface DistributionRow { label: string; count: number }
interface TeacherPerf {
  teacherName: string
  heuresPrevuesParSemaine: number
  seancesEnregistrees: number
  tauxPresence: number | null
  moyennesParClasse: { subjectName: string; className: string; moyenne: number | null; nbEleves: number }[]
}

const PIE_COLORS = ['var(--green)', 'var(--amber)', 'var(--blue)', 'var(--red)', 'var(--purple)', 'var(--text3)']

// Styles Recharts thème-aware (axes/tooltip/légende basculent en sombre)
const CHART_TOOLTIP = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' },
  labelStyle: { color: 'var(--text2)' },
  itemStyle: { color: 'var(--text)' },
} as const

const card: React.CSSProperties = { background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }
const cardHeader: React.CSSProperties = { padding: '16px 22px', borderBottom: '1px solid var(--border)' }
const cardTitle: React.CSSProperties = { fontSize: 17, fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }
const select: React.CSSProperties = { padding: '8px 12px', borderRadius: 9, border: '1.5px solid var(--border2)', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)', background: 'var(--surface)' }

export default function SectionStatistics({ onToast }: Props) {
  const t = useT('admin')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [teachers, setTeachers] = useState<TeacherItem[]>([])

  const [evoClassId, setEvoClassId] = useState('')
  const [evoSubjectId, setEvoSubjectId] = useState('')

  const [level, setLevel] = useState('')

  const [criteria, setCriteria] = useState<'gender' | 'level' | 'paymentStatus'>('gender')

  const [teacherId, setTeacherId] = useState('')

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/users?role=TEACHER&limit=200', { credentials: 'include' }).then(r => r.json()),
    ]).then(([cd, sd, td]) => {
      setClasses(cd.data || [])
      setSubjects(sd.data || [])
      setTeachers(td.data || [])
    }).catch(() => {})
  }, [])

  const fetchEvolutionFn = useCallback(async (): Promise<EvolutionPoint[]> => {
    const params = new URLSearchParams()
    if (evoClassId) params.set('classId', evoClassId)
    if (evoSubjectId) params.set('subjectId', evoSubjectId)
    const res = await fetchApi(`/api/v2/statistics/grades-evolution?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.data || []
  }, [evoClassId, evoSubjectId])
  const { data: evolutionData, loading: evoLoading, error: evoError, fromCache: evoFromCache, cachedAt: evoCachedAt } = useCachedFetch<EvolutionPoint[]>(`admin:stats-evolution:${evoClassId}:${evoSubjectId}`, fetchEvolutionFn)
  const evolution = evolutionData ?? []

  const fetchComparisonFn = useCallback(async (): Promise<ClassComparisonRow[]> => {
    const params = new URLSearchParams()
    if (level) params.set('level', level)
    const res = await fetchApi(`/api/v2/statistics/classes-comparison?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.data || []
  }, [level])
  const { data: comparisonData, loading: compLoading, fromCache: compFromCache, cachedAt: compCachedAt } = useCachedFetch<ClassComparisonRow[]>(`admin:stats-comparison:${level}`, fetchComparisonFn)
  const comparison = comparisonData ?? []

  const fetchDistributionFn = useCallback(async (): Promise<DistributionRow[]> => {
    const res = await fetchApi(`/api/v2/statistics/students-distribution?criteria=${criteria}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.data || []
  }, [criteria])
  const { data: distributionData, loading: distLoading, fromCache: distFromCache, cachedAt: distCachedAt } = useCachedFetch<DistributionRow[]>(`admin:stats-distribution:${criteria}`, fetchDistributionFn)
  const distribution = distributionData ?? []

  const fetchTeacherPerfFn = useCallback(async (): Promise<TeacherPerf | null> => {
    if (!teacherId) return null
    const res = await fetchApi(`/api/v2/statistics/teacher-performance/${teacherId}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.data
  }, [teacherId])
  const { data: teacherPerf, loading: teacherLoading, fromCache: teacherFromCache, cachedAt: teacherCachedAt } = useCachedFetch<TeacherPerf | null>(`admin:stats-teacher:${teacherId}`, fetchTeacherPerfFn)

  useEffect(() => {
    if (evoError && evoError !== 'OFFLINE_NO_CACHE') onToast(evoError, 'error')
  }, [evoError, onToast])

  const levels = Array.from(new Set(classes.map(c => c.level).filter(Boolean))) as string[]

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: 26 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }}>
          {t('statistics.title')}
        </div>
        <div style={{ fontSize: 17, color: 'var(--text3)', marginTop: 3 }}>Visualisation des données de l&apos;établissement</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>

        {/* Évolution des moyennes */}
        <div style={card}>
          <div style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={cardTitle}><TrendingUp size={17} strokeWidth={2} /> Évolution des moyennes <CacheBadge fromCache={evoFromCache} cachedAt={evoCachedAt} t={t} /></span>
            <div style={{ display: 'flex', gap: 8 }}>
              <select style={select} value={evoClassId} onChange={e => setEvoClassId(e.target.value)}>
                <option value="">Toutes les classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select style={select} value={evoSubjectId} onChange={e => setEvoSubjectId(e.target.value)}>
                <option value="">Toutes les matières</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ padding: '18px 22px', height: 300 }}>
            {evoLoading ? (
              <Spinner />
            ) : evolution.length === 0 ? (
              <EmptyState text="Aucune séquence clôturée avec des notes validées" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="sequenceName" tick={{ fontSize: 12, fill: 'var(--text3)' }} stroke="var(--border)" />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 12, fill: 'var(--text3)' }} stroke="var(--border)" />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Line type="monotone" dataKey="moyenne" name="Moyenne" stroke="var(--green)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Comparaison entre classes */}
        <div style={card}>
          <div style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={cardTitle}><BarChart3 size={17} strokeWidth={2} /> Comparaison entre classes <CacheBadge fromCache={compFromCache} cachedAt={compCachedAt} t={t} /></span>
            <select style={select} value={level} onChange={e => setLevel(e.target.value)}>
              <option value="">Tous les niveaux</option>
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div style={{ padding: '18px 22px', height: 300 }}>
            {compLoading ? (
              <Spinner />
            ) : comparison.length === 0 ? (
              <EmptyState text="Aucune classe trouvée" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="className" tick={{ fontSize: 12, fill: 'var(--text3)' }} stroke="var(--border)" />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 12, fill: 'var(--text3)' }} stroke="var(--border)" />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="moyenne" name="Moyenne générale" fill="var(--blue)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Répartition des effectifs */}
        <div style={card}>
          <div style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={cardTitle}><PieChartIcon size={17} strokeWidth={2} /> Répartition des effectifs <CacheBadge fromCache={distFromCache} cachedAt={distCachedAt} t={t} /></span>
            <select style={select} value={criteria} onChange={e => setCriteria(e.target.value as typeof criteria)}>
              <option value="gender">Par sexe</option>
              <option value="level">Par niveau</option>
              <option value="paymentStatus">Par statut de paiement</option>
            </select>
          </div>
          <div style={{ padding: '18px 22px', height: 300 }}>
            {distLoading ? (
              <Spinner />
            ) : distribution.length === 0 ? (
              <EmptyState text="Aucune donnée disponible" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                    {distribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text2)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Performance enseignant */}
        <div style={card}>
          <div style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={cardTitle}><Apple size={17} strokeWidth={2} /> Performance enseignant <CacheBadge fromCache={teacherFromCache} cachedAt={teacherCachedAt} t={t} /></span>
            <select style={select} value={teacherId} onChange={e => setTeacherId(e.target.value)}>
              <option value="">Sélectionner un enseignant</option>
              {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
            </select>
          </div>
          <div style={{ padding: '18px 22px', minHeight: 300 }}>
            {!teacherId ? (
              <EmptyState text="Sélectionnez un enseignant pour voir ses statistiques" />
            ) : teacherLoading ? (
              <Spinner />
            ) : !teacherPerf ? (
              <EmptyState text="Aucune donnée disponible" />
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
                  <Kpi label="Heures prévues/sem" value={String(teacherPerf.heuresPrevuesParSemaine)} />
                  <Kpi label="Séances enregistrées" value={String(teacherPerf.seancesEnregistrees)} />
                  <Kpi label="Taux de présence" value={teacherPerf.tauxPresence !== null ? `${teacherPerf.tauxPresence}%` : '—'} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
                  {teacherPerf.moyennesParClasse.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                      <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{m.subjectName} · {m.className}</span>
                      <span style={{ fontWeight: 800, color: 'var(--text)' }}>{m.moyenne !== null ? `${m.moyenne}/20` : '—'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 14, color: 'var(--text3)', textAlign: 'center', padding: '0 20px' }}>
      {text}
    </div>
  )
}

function CacheBadge({ fromCache, cachedAt, t }: { fromCache: boolean; cachedAt: number | null; t: (key: string, params?: Record<string, string | number>) => string }) {
  if (!fromCache || !cachedAt) return null
  return (
    <span style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <Package size={12} strokeWidth={2} /> {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
    </span>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}
