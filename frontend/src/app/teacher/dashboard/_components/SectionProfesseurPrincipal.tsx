'use client'
import { useState, useEffect } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'

interface Props {
  user: UserInfo
  classeId: string
  classeNom: string
}

interface StudentRow {
  id: string
  firstName: string
  lastName: string
  rang: number
  moyenne: number | null
  tauxPresence: number | null
}

interface AttendanceRecord {
  id: string
  date: string
  studentId: string
  studentName?: string
  status: string
}

type Tab = 'eleves' | 'presences'
type DateFilter = 'semaine' | 'mois'

const BADGE = (moy: number | null) => {
  if (moy === null) return { bg: '#f0ebe3', color: '#a89478', label: '—' }
  if (moy >= 12) return { bg: '#d1fae5', color: '#065f46', label: String(moy.toFixed(2)) }
  if (moy >= 8)  return { bg: '#fef3c7', color: '#92400e', label: String(moy.toFixed(2)) }
  return { bg: '#fee2e2', color: '#991b1b', label: String(moy.toFixed(2)) }
}

export default function SectionProfesseurPrincipal({ user: _user, classeId, classeNom }: Props) {
  const [tab, setTab] = useState<Tab>('eleves')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter>('semaine')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    if (tab === 'eleves') {
      fetchApi(`/api/v2/classes/${classeId}/students`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => { if (d.success) setStudents(d.data) })
        .catch(() => setError('Erreur chargement élèves'))
        .finally(() => setLoading(false))
    } else {
      const since = dateFilter === 'semaine'
        ? new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
        : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
      fetchApi(`/api/v2/attendance?classId=${classeId}&from=${since}&limit=200`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => { setAttendances(Array.isArray(d.attendances) ? d.attendances : []) })
        .catch(() => setError('Erreur chargement présences'))
        .finally(() => setLoading(false))
    }
  }, [tab, classeId, dateFilter])

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 800,
        fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === t ? '#1a2e1e' : '#f0ebe3',
        color: tab === t ? 'white' : '#6b5c45',
        transition: 'all 0.15s',
      }}>
      {label}
    </button>
  )

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: '#1a1209' }}>
          📋 Classe {classeNom}
        </div>
        <div style={{ fontSize: 14, color: '#a89478', fontWeight: 500, marginTop: 4 }}>
          Vue Professeur Principal
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabBtn('eleves',   '📊 Élèves et moyennes')}
        {tabBtn('presences','✅ Présences')}
      </div>

      {tab === 'eleves' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1209' }}>Élèves — {classeNom}</span>
            <span style={{ fontSize: 13, color: '#a89478', fontWeight: 600 }}>{students.length} élève{students.length > 1 ? 's' : ''}</span>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#a89478', fontSize: 14 }}>Chargement...</div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#dc2626', fontSize: 14 }}>{error}</div>
          ) : students.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>Aucune note saisie pour cette classe</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7f3ee' }}>
                  {['Rang', 'Élève', 'Moyenne /20', 'Présence', 'Niveau'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const badge = BADGE(s.moyenne)
                  return (
                    <tr key={s.id} style={{ borderTop: '1px solid #f0ebe3', background: i % 2 === 0 ? 'white' : '#fafaf9' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: '#a89478' }}>#{s.rang}</td>
                      <td style={{ padding: '12px 16px', fontSize: 15, fontWeight: 700, color: '#1a1209' }}>{s.lastName} {s.firstName}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: badge.bg, color: badge.color, padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#6b5c45', fontWeight: 600 }}>
                        {s.tauxPresence !== null ? `${s.tauxPresence}%` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {s.moyenne !== null && (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                            background: s.moyenne >= 12 ? '#d1fae5' : s.moyenne >= 8 ? '#fef3c7' : '#fee2e2',
                            color: s.moyenne >= 12 ? '#065f46' : s.moyenne >= 8 ? '#92400e' : '#991b1b' }}>
                            {s.moyenne >= 12 ? '✅ Admis' : s.moyenne >= 8 ? '⚠️ Passable' : '🔴 En difficulté'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'presences' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1209', flex: 1 }}>Présences — {classeNom}</span>
            {(['semaine', 'mois'] as DateFilter[]).map(f => (
              <button key={f} onClick={() => setDateFilter(f)}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: dateFilter === f ? '#1a2e1e' : '#f0ebe3', color: dateFilter === f ? 'white' : '#6b5c45' }}>
                {f === 'semaine' ? '7 derniers jours' : '30 derniers jours'}
              </button>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#a89478', fontSize: 14 }}>Chargement...</div>
          ) : attendances.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#a89478', fontSize: 14 }}>Aucune présence enregistrée sur cette période</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7f3ee' }}>
                  {['Date', 'Élève', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendances.map((a, i) => {
                  const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
                    PRESENT:          { bg: '#d1fae5', color: '#065f46', label: '✅ Présent' },
                    ABSENT:           { bg: '#fee2e2', color: '#991b1b', label: '🔴 Absent' },
                    ABSENT_JUSTIFIED: { bg: '#fef3c7', color: '#92400e', label: '📋 Justifié' },
                    LATE:             { bg: '#dbeafe', color: '#1e40af', label: '⏰ Retard' },
                  }
                  const s = statusStyle[a.status] ?? { bg: '#f0ebe3', color: '#a89478', label: a.status }
                  return (
                    <tr key={a.id} style={{ borderTop: '1px solid #f0ebe3', background: i % 2 === 0 ? 'white' : '#fafaf9' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: '#6b5c45', fontWeight: 600 }}>
                        {new Date(a.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 15, fontWeight: 700, color: '#1a1209' }}>
                        {a.studentName ?? a.studentId}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: s.bg, color: s.color, padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700 }}>{s.label}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
