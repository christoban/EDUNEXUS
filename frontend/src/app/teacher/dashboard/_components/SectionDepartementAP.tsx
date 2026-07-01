'use client'
import { useState, useEffect } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  user: UserInfo
  departementId: string
  departementNom: string
}

interface PerfRow {
  teacherName: string
  subjectName: string
  className: string
  moyenne: number | null
  nbEleves: number
}

interface HoraireRow {
  teacherName: string
  subjectName: string
  totalHours: number
  isOverLimit: boolean
}

type Tab = 'performances' | 'horaires' | 'progression'

interface ProgAlerte {
  programmeTitre: string; subjectName: string; className: string
  chapitresTotal: number; chapitresRealises: number; progressionPct: number
  attenduPct: number; retardPct: number; niveau: 'CRITIQUE' | 'MODERE'
}

export default function SectionDepartementAP({ user: _user, departementId, departementNom }: Props) {
  const [tab, setTab] = useState<Tab>('performances')
  const [perf, setPerf] = useState<PerfRow[]>([])
  const [horaires, setHoraires] = useState<HoraireRow[]>([])
  const [alertes, setAlertes] = useState<ProgAlerte[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    if (tab === 'performances') {
      fetchApi(`/api/v2/departments/${departementId}/performance`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => setPerf(Array.isArray(d.data) ? d.data : []))
        .catch(() => setError('Erreur de chargement des performances'))
        .finally(() => setLoading(false))
    } else if (tab === 'progression') {
      fetchApi(`/api/v2/pedagogie/alertes-retard`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (d.success) setAlertes(d.data ?? [])
          else setError('Erreur de chargement des progressions')
        })
        .catch(() => setError('Erreur réseau'))
        .finally(() => setLoading(false))
    } else {
      // Volume horaire: fetch timetables and compute per teacher
      fetchApi(`/api/v2/timetables?departmentId=${departementId}`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => {
          if (!d.success) { setHoraires([]); return }
          const map = new Map<string, { teacherName: string; subjectName: string; totalHours: number }>()
          for (const timetable of d.data ?? []) {
            for (const slot of timetable.slots ?? []) {
              const key = `${slot.teacher?.id}__${slot.subject?.id}`
              const dur = slot.durationMinutes ?? 60
              const existing = map.get(key)
              if (existing) {
                existing.totalHours += dur / 60
              } else {
                map.set(key, {
                  teacherName: slot.teacher ? `${slot.teacher.user?.firstName ?? ''} ${slot.teacher.user?.lastName ?? ''}`.trim() : '—',
                  subjectName: slot.subject?.name ?? '—',
                  totalHours: dur / 60,
                })
              }
            }
          }
          setHoraires(
            [...map.values()].map(r => ({ ...r, isOverLimit: r.totalHours > 14 }))
              .sort((a, b) => b.totalHours - a.totalHours)
          )
        })
        .catch(() => setError('Erreur de chargement des volumes horaires'))
        .finally(() => setLoading(false))
    }
  }, [tab, departementId])

  const tabBtn = (t: Tab, label: string) => (
    <button onClick={() => setTab(t)}
      style={{ padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 800, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === t ? '#1a2e1e' : '#f0ebe3', color: tab === t ? 'white' : '#6b5c45', transition: 'all 0.15s' }}>
      {label}
    </button>
  )

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: '#1a1209' }}>
          🎯 Département {departementNom}
        </div>
        <div style={{ fontSize: 14, color: '#a89478', fontWeight: 500, marginTop: 4 }}>
          Vue Animateur Pédagogique
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabBtn('performances', '📊 Performances')}
        {tabBtn('horaires', '⏱️ Volume horaire')}
        {tabBtn('progression', '📈 Progression programmes')}
      </div>

      {error && (
        <div style={{ padding: 16, background: '#fee2e2', borderRadius: 10, color: '#991b1b', fontSize: 14, fontWeight: 600, marginBottom: 20 }}>{error}</div>
      )}

      {/* Onglet Performances */}
      {tab === 'performances' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Moyennes par matière / enseignant</span>
            <span style={{ fontSize: 13, color: '#a89478', fontWeight: 600 }}>{perf.length} cours</span>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#a89478', fontSize: 14 }}>Chargement...</div>
          ) : perf.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>Aucune donnée de performance disponible</div>
              <div style={{ fontSize: 13, color: '#c4b8a8', marginTop: 6 }}>Les notes doivent être validées pour apparaître ici.</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7f3ee' }}>
                  {['Enseignant', 'Matière', 'Classe', 'Moyenne /20', 'Élèves'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perf.map((row, i) => {
                  const moy = row.moyenne
                  const moyBg = moy === null ? '#f0ebe3' : moy >= 12 ? '#d1fae5' : moy >= 8 ? '#fef3c7' : '#fee2e2'
                  const moyColor = moy === null ? '#a89478' : moy >= 12 ? '#065f46' : moy >= 8 ? '#92400e' : '#991b1b'
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #f0ebe3', background: i % 2 === 0 ? 'white' : '#fafaf9' }}>
                      <td style={{ padding: '12px 16px', fontSize: 15, fontWeight: 700, color: '#1a1209' }}>{row.teacherName}</td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#6b5c45', fontWeight: 600 }}>{row.subjectName}</td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#6b5c45', fontWeight: 600 }}>{row.className}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: moyBg, color: moyColor, padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
                          {moy !== null ? moy.toFixed(2) : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#6b5c45', fontWeight: 600 }}>{row.nbEleves}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Onglet Volume horaire */}
      {tab === 'horaires' && (
        <div>
          {/* Alerte limite légale */}
          <div style={{ padding: '14px 18px', background: '#fefce8', border: '1.5px solid #fde68a', borderRadius: 12, marginBottom: 18, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#92400e' }}>Limite légale MINESEC : 14h / semaine</div>
              <div style={{ fontSize: 13, color: '#a16207', fontWeight: 500, marginTop: 2 }}>Les enseignants dépassant cette limite sont mis en évidence en rouge.</div>
            </div>
          </div>

          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Volume horaire hebdomadaire</span>
            </div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#a89478', fontSize: 14 }}>Chargement...</div>
            ) : horaires.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>Aucun emploi du temps enregistré</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f7f3ee' }}>
                    {['Enseignant', 'Matière', 'Heures / sem.', 'Statut'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {horaires.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #f0ebe3', background: row.isOverLimit ? '#fff7f7' : i % 2 === 0 ? 'white' : '#fafaf9' }}>
                      <td style={{ padding: '12px 16px', fontSize: 15, fontWeight: 700, color: row.isOverLimit ? '#991b1b' : '#1a1209' }}>{row.teacherName}</td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#6b5c45', fontWeight: 600 }}>{row.subjectName}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: row.isOverLimit ? '#dc2626' : '#1a1209' }}>
                            {row.totalHours.toFixed(1)}h
                          </span>
                          <div style={{ flex: 1, background: '#f0ebe3', borderRadius: 4, height: 6, maxWidth: 100, overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: 4, width: `${Math.min((row.totalHours / 20) * 100, 100)}%`, background: row.isOverLimit ? '#dc2626' : '#059669' }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {row.isOverLimit
                          ? <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>🔴 Dépasse 14h</span>
                          : <span style={{ background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>✅ OK</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Onglet Progression programmes */}
      {tab === 'progression' && (
        <div>
          <div style={{ padding: '14px 18px', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, marginBottom: 18, fontSize: 14, fontWeight: 600, color: '#065f46' }}>
            Alertes de retard sur les programmes de votre département — toutes classes confondues.
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#a89478', fontSize: 14 }}>Calcul en cours...</div>
          ) : alertes.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 15, color: '#065f46', fontWeight: 700 }}>Aucun retard significatif</div>
              <div style={{ fontSize: 13, color: '#a89478', marginTop: 4 }}>Tous les cours sont dans les délais, ou aucun programme n'est encore défini.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alertes.map((a, i) => {
                const isCritique = a.niveau === 'CRITIQUE'
                return (
                  <div key={i} style={{ background: 'white', borderRadius: 14, border: `1.5px solid ${isCritique ? '#fca5a5' : '#fde68a'}`, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{ background: isCritique ? '#fee2e2' : '#fef3c7', borderRadius: 10, padding: '8px 14px', textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 900, color: isCritique ? '#991b1b' : '#92400e' }}>-{a.retardPct}%</div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: isCritique ? '#991b1b' : '#92400e', textTransform: 'uppercase' }}>{a.niveau}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                          <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{a.className}</span>
                          <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>{a.subjectName}</span>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1209' }}>{a.programmeTitre}</div>
                        <div style={{ fontSize: 12, color: '#6b5c45', marginTop: 2 }}>
                          {a.chapitresRealises}/{a.chapitresTotal} chapitres · Réalisé {a.progressionPct}% · Attendu {a.attenduPct}%
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
    </div>
  )
}
