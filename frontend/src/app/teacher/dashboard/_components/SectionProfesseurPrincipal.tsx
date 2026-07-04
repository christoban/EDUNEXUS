'use client'
import { useState, useEffect } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

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
  if (moy === null) return { bg: 'var(--bg2)', color: 'var(--text3)', label: '—' }
  if (moy >= 12) return { bg: 'var(--green-light)', color: 'var(--green)', label: String(moy.toFixed(2)) }
  if (moy >= 8)  return { bg: 'var(--amber-light)', color: 'var(--amber)', label: String(moy.toFixed(2)) }
  return { bg: 'var(--red-light)', color: 'var(--red)', label: String(moy.toFixed(2)) }
}

export default function SectionProfesseurPrincipal({ user: _user, classeId, classeNom }: Props) {
  const t = useT('teacher')
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
        .catch(() => setError(t('pp.load_error_students')))
        .finally(() => setLoading(false))
    } else {
      const since = dateFilter === 'semaine'
        ? new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)
        : new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)
      fetchApi(`/api/v2/attendance?classId=${classeId}&from=${since}&limit=200`, { credentials: 'include' })
        .then(r => r.json())
        .then(d => { setAttendances(Array.isArray(d.attendances) ? d.attendances : []) })
        .catch(() => setError(t('pp.load_error_attendance')))
        .finally(() => setLoading(false))
    }
  }, [tab, classeId, dateFilter])

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: '8px 20px', borderRadius: 10, fontSize: 14, fontWeight: 800,
        fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === t ? 'var(--sidebar)' : 'var(--bg2)',
        color: tab === t ? 'white' : 'var(--text2)',
        transition: 'all 0.15s',
      }}>
      {label}
    </button>
  )

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
          {t('pp.class_title').replace('{name}', classeNom)}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500, marginTop: 4 }}>
          {t('pp.view_title')}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {tabBtn('eleves',   t('pp.tab_students'))}
        {tabBtn('presences',t('pp.tab_attendance'))}
      </div>

      {tab === 'eleves' && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>Élèves — {classeNom}</span>
            <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{students.length} élève{students.length > 1 ? 's' : ''}</span>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Chargement...</div>
          ) : error ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)', fontSize: 14 }}>{error}</div>
          ) : students.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600 }}>Aucune note saisie pour cette classe</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Rang', 'Élève', 'Moyenne /20', 'Présence', 'Niveau'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const badge = BADGE(s.moyenne)
                  return (
                    <tr key={s.id} style={{ borderTop: '1px solid var(--bg2)', background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 800, color: 'var(--text3)' }}>#{s.rang}</td>
                      <td style={{ padding: '12px 16px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s.lastName} {s.firstName}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ background: badge.bg, color: badge.color, padding: '4px 12px', borderRadius: 20, fontSize: 14, fontWeight: 800 }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>
                        {s.tauxPresence !== null ? `${s.tauxPresence}%` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {s.moyenne !== null && (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                            background: s.moyenne >= 12 ? 'var(--green-light)' : s.moyenne >= 8 ? 'var(--amber-light)' : 'var(--red-light)',
                            color: s.moyenne >= 12 ? 'var(--green)' : s.moyenne >= 8 ? 'var(--amber)' : 'var(--red)' }}>
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
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', flex: 1 }}>Présences — {classeNom}</span>
            {(['semaine', 'mois'] as DateFilter[]).map(f => (
              <button key={f} onClick={() => setDateFilter(f)}
                style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                  background: dateFilter === f ? 'var(--sidebar)' : 'var(--bg2)', color: dateFilter === f ? 'white' : 'var(--text2)' }}>
                {f === 'semaine' ? '7 derniers jours' : '30 derniers jours'}
              </button>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Chargement...</div>
          ) : attendances.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>Aucune présence enregistrée sur cette période</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {['Date', 'Élève', 'Statut'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendances.map((a, i) => {
                  const statusStyle: Record<string, { bg: string; color: string; label: string }> = {
                    PRESENT:          { bg: 'var(--green-light)', color: 'var(--green)', label: '✅ Présent' },
                    ABSENT:           { bg: 'var(--red-light)', color: 'var(--red)', label: '🔴 Absent' },
                    ABSENT_JUSTIFIED: { bg: 'var(--amber-light)', color: 'var(--amber)', label: '📋 Justifié' },
                    LATE:             { bg: 'var(--blue-light)', color: 'var(--blue)', label: '⏰ Retard' },
                  }
                  const s = statusStyle[a.status] ?? { bg: 'var(--bg2)', color: 'var(--text3)', label: a.status }
                  return (
                    <tr key={a.id} style={{ borderTop: '1px solid var(--bg2)', background: i % 2 === 0 ? 'white' : 'var(--bg)' }}>
                      <td style={{ padding: '12px 16px', fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>
                        {new Date(a.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
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
