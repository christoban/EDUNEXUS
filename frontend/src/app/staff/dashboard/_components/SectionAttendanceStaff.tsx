'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

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

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  PRESENT:          { bg: 'var(--green-light)', color: 'var(--green)' },
  ABSENT:           { bg: 'var(--red-light)', color: 'var(--red)' },
  ABSENT_JUSTIFIED: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  LATE:             { bg: 'var(--blue-light)', color: 'var(--blue)' },
}

export default function SectionAttendanceStaff({ onToast }: Props) {
  const t = useT('staff')
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
      const res = await fetchApi('/api/v2/attendance/stats', { credentials: 'include' })
      const data = await res.json()
      if (res.ok && data.stats) setStats(data.stats)
    } catch { /* silencieux */ }
  }, [])

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
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
      const res = await fetchApi(`/api/v2/attendance?${params}`, { credentials: 'include' })
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
      const res = await fetchApi(`/api/v2/attendance/${recordId}/justify`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justification: 'Justifiée par le personnel' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('attendance.justifySuccess'), 'success')
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
          <div style={sTitle}>{t('attendance.title')}</div>
          <div style={sSub}>{t('attendance.subtitle')}</div>
        </div>
        <button style={btnSec} onClick={() => { fetchStats(); fetchRecords() }}>{t('attendance.refresh')}</button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && (
        <>
          {/* KPIs globaux */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
              {[
                { icon: '✅', bg: 'var(--green-light)', val: stats.attendanceRate, label: t('attendance.kpiRate'), color: 'var(--green)' },
                { icon: '👥', bg: 'var(--blue-light)', val: String(stats.total),   label: t('attendance.kpiRecords'), color: 'var(--blue)' },
                { icon: '✗',  bg: 'var(--red-light)', val: String(stats.absent),  label: t('attendance.kpiAbsences'), color: 'var(--red)' },
                { icon: '⏰', bg: 'var(--amber-light)', val: String(stats.late),    label: t('attendance.kpiLate'), color: 'var(--amber)' },
              ].map((k, i) => (
                <div key={i} style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '18px 20px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{k.icon}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: k.color }}>{k.val}</div>
                  <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filtres */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={classId} onChange={e => setClassId(e.target.value)} style={filterSt}>
                <option value="">{t('attendance.filterAllClasses')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...filterSt, cursor: 'pointer' }} />
              <button style={btnPrim} onClick={fetchRecords} disabled={loadingRecords}>
                {loadingRecords ? '⏳' : '🔍'} {t('attendance.filter')}
              </button>
              {records.length > 0 && (
                <span style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--text3)', fontWeight: 600 }}>
                  {t('attendance.summary', { present: presentCount, absent: absentCount, late: lateCount })}
                </span>
              )}
            </div>

            {loadingRecords && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
              </div>
            )}

            {!loadingRecords && error && (
              <div style={{ padding: '16px 20px', color: 'var(--red)', fontWeight: 700 }}>⚠️ {error}</div>
            )}

            {!loadingRecords && !error && records.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
                {classId || date ? t('attendance.noRecords') : t('attendance.noSelection')}
              </div>
            )}

            {!loadingRecords && !error && records.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{[
                    t('attendance.tableHeaderStudent'),
                    t('attendance.tableHeaderClass'),
                    t('attendance.tableHeaderDate'),
                    t('attendance.tableHeaderPeriod'),
                    t('attendance.tableHeaderStatus'),
                    t('attendance.tableHeaderMarkedBy'),
                    t('attendance.tableHeaderActions'),
                  ].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const st = STATUS_STYLE[r.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                    return (
                      <tr key={r.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                          {r.student ? `${r.student.firstName} ${r.student.lastName}` : '—'}
                        </td>
                        <td style={tdSt}>{r.class?.name ?? '—'}</td>
                        <td style={tdSt}>{new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</td>
                        <td style={tdSt}>{r.period}</td>
                        <td style={tdSt}>
                          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: st.bg, color: st.color }}>
                            {t(`attendance.${r.status === 'PRESENT' ? 'presentLabel' : r.status === 'ABSENT' ? 'absentLabel' : r.status === 'ABSENT_JUSTIFIED' ? 'justifiedLabel' : 'lateLabel'}`)}
                          </span>
                        </td>
                        <td style={tdSt}>{r.markedBy ? `${r.markedBy.firstName} ${r.markedBy.lastName}` : '—'}</td>
                        <td style={tdSt}>
                          {r.status === 'ABSENT' && (
                            <button
                              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => justify(r.id)}
                              disabled={justifyingId === r.id}>
                              {justifyingId === r.id ? '⏳' : t('attendance.justify')}
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

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '9px 18px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '12px 14px', fontSize: 15, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
