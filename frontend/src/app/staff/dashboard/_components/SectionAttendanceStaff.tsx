'use client'
import { useState, useEffect, useCallback } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface AttendanceStats {
  total: number; present: number; absent: number; late: number; attendanceRate: string
}

interface ClassItem { id: string; name: string }

interface AttendanceRecord {
  id: string; date: string; status: string; period: string
  student: { id: string; firstName: string; lastName: string } | null
  class: { id: string; name: string } | null
  markedBy: { id: string; firstName: string; lastName: string } | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  PRESENT:          { bg: '#d1fae5', color: '#065f46', label: '✓ Présent'  },
  ABSENT:           { bg: '#fee2e2', color: '#991b1b', label: '✗ Absent'   },
  ABSENT_JUSTIFIED: { bg: '#fef3c7', color: '#92400e', label: '📋 Justifié' },
  LATE:             { bg: '#dbeafe', color: '#1e40af', label: '⏰ Retard'   },
}

export default function SectionAttendanceStaff({ onToast }: Props) {
  const [stats, setStats]           = useState<AttendanceStats | null>(null)
  const [classes, setClasses]       = useState<ClassItem[]>([])
  const [records, setRecords]       = useState<AttendanceRecord[]>([])
  const [classId, setClassId]       = useState('')
  const [date, setDate]             = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading]       = useState(true)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [justifyingId, setJustifyingId] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/attendance/stats', { credentials: 'include' })
      const data = await res.json()
      if (res.ok && data.stats) setStats(data.stats)
    } catch { /* silencieux */ }
  }, [])

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      if (res.ok) setClasses(data.data || [])
    } catch { /* silencieux */ }
  }, [])

  useEffect(() => {
    Promise.all([fetchStats(), fetchClasses()]).finally(() => setLoading(false))
  }, [fetchStats, fetchClasses])

  const fetchRecords = useCallback(async () => {
    if (!classId && !date) return
    setLoadingRecords(true)
    setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (classId) params.set('classId', classId)
      if (date) params.set('date', date)
      const res = await fetch(`/api/v2/attendance?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setRecords(data.records || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoadingRecords(false)
    }
  }, [classId, date])

  const justify = async (recordId: string) => {
    setJustifyingId(recordId)
    try {
      const res = await fetch(`/api/v2/attendance/${recordId}/justify`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justification: 'Justifiée par le personnel' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast('Absence justifiée', 'success')
      fetchRecords()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setJustifyingId(null)
    }
  }

  const presentCount = records.filter(r => r.status === 'PRESENT').length
  const absentCount  = records.filter(r => r.status === 'ABSENT').length
  const lateCount    = records.filter(r => r.status === 'LATE').length

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Présences</div>
          <div style={sSub}>Supervision · Lecture et justification des absences</div>
        </div>
        <button style={btnSec} onClick={() => { fetchStats(); fetchRecords() }}>🔄 Rafraîchir</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && (
        <>
          {/* KPIs globaux */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
              {[
                { icon: '✅', bg: '#d1fae5', val: stats.attendanceRate, label: 'Taux de présence', color: '#065f46' },
                { icon: '👥', bg: '#dbeafe', val: String(stats.total),   label: 'Enregistrements', color: '#1e40af' },
                { icon: '✗',  bg: '#fee2e2', val: String(stats.absent),  label: 'Absences',         color: '#991b1b' },
                { icon: '⏰', bg: '#fef3c7', val: String(stats.late),    label: 'Retards',           color: '#92400e' },
              ].map((k, i) => (
                <div key={i} style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '18px 20px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 14, color: '#a89478', fontWeight: 600, marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filtres */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={classId} onChange={e => setClassId(e.target.value)} style={filterSt}>
                <option value="">Toutes les classes</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...filterSt, cursor: 'pointer' }} />
              <button style={btnPrim} onClick={fetchRecords} disabled={loadingRecords}>
                {loadingRecords ? '⏳' : '🔍'} Charger
              </button>
              {records.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 14, color: '#a89478', fontWeight: 600 }}>
                  ✓ {presentCount} · ✗ {absentCount} · ⏰ {lateCount}
                </span>
              )}
            </div>

            {loadingRecords && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 28, height: 28, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            )}

            {!loadingRecords && error && (
              <div style={{ padding: '16px 20px', color: '#dc2626', fontWeight: 700 }}>⚠️ {error}</div>
            )}

            {!loadingRecords && !error && records.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#a89478' }}>
                {classId || date ? 'Aucun enregistrement pour ces filtres' : 'Sélectionnez une classe ou une date pour afficher les présences'}
              </div>
            )}

            {!loadingRecords && !error && records.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Élève', 'Classe', 'Date', 'Période', 'Statut', 'Saisi par', 'Actions'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const st = STATUS_STYLE[r.status] ?? { bg: '#f1f5f9', color: '#475569', label: r.status }
                    return (
                      <tr key={r.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>
                          {r.student ? `${r.student.firstName} ${r.student.lastName}` : '—'}
                        </td>
                        <td style={tdSt}>{r.class?.name ?? '—'}</td>
                        <td style={tdSt}>{new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
                        <td style={tdSt}>{r.period}</td>
                        <td style={tdSt}>
                          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: st.bg, color: st.color }}>
                            {st.label}
                          </span>
                        </td>
                        <td style={tdSt}>{r.markedBy ? `${r.markedBy.firstName} ${r.markedBy.lastName}` : '—'}</td>
                        <td style={tdSt}>
                          {r.status === 'ABSENT' && (
                            <button
                              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: '#fef3c7', color: '#92400e', border: '1px solid rgba(217,119,6,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => justify(r.id)}
                              disabled={justifyingId === r.id}>
                              {justifyingId === r.id ? '⏳' : '📋 Justifier'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '9px 18px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: '#6b5c45', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 14px', fontSize: 15, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
