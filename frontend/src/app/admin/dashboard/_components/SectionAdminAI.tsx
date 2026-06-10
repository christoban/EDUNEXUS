'use client'
import { useState, useEffect, useCallback } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface StudentHealth {
  studentId: string; name: string; className: string
  healthScore: number; alertLevel: 'critical' | 'warning' | 'recommendation' | 'good' | 'excellent'
}

interface HealthSummary { critical: number; warning: number; recommendation: number; good: number; excellent: number }

interface ClassItem { id: string; name: string }

const ALERT_STYLE: Record<string, { bg: string; color: string; label: string; icon: string }> = {
  critical:       { bg: '#fee2e2', color: '#991b1b', label: 'Critique',        icon: '🚨' },
  warning:        { bg: '#ffedd5', color: '#9a3412', label: 'Avertissement',    icon: '⚠️' },
  recommendation: { bg: '#fef3c7', color: '#92400e', label: 'Surveillance',     icon: '👁️' },
  good:           { bg: '#dbeafe', color: '#1e40af', label: 'Bien',             icon: '✅' },
  excellent:      { bg: '#d1fae5', color: '#065f46', label: 'Excellent',        icon: '⭐' },
}

export default function SectionAdminAI({ onToast }: Props) {
  const [students, setStudents]   = useState<StudentHealth[]>([])
  const [summary, setSummary]     = useState<HealthSummary | null>(null)
  const [classes, setClasses]     = useState<ClassItem[]>([])
  const [classFilter, setClassFilter] = useState('')
  const [alertFilter, setAlertFilter] = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/classes', { credentials: 'include' })
      const d = await res.json()
      if (res.ok) setClasses(d.data || [])
    } catch { /* silencieux */ }
  }, [])

  const fetchHealth = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams()
      if (classFilter) params.set('classId', classFilter)
      const res = await fetch(`/api/v2/ai/students-health?${params}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur serveur')
      setStudents(d.students || [])
      setSummary(d.summary || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally { setLoading(false) }
  }, [classFilter])

  useEffect(() => { fetchClasses() }, [fetchClasses])
  useEffect(() => { fetchHealth() }, [fetchHealth])

  const filtered = alertFilter ? students.filter(s => s.alertLevel === alertFilter) : students
  const atRisk   = students.filter(s => s.alertLevel === 'critical' || s.alertLevel === 'warning').length

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>IA Santé scolaire</div>
          <div style={sSub}>Scores de bien-être académique · Alertes automatiques</div>
        </div>
        <button style={btnSec} onClick={fetchHealth}>🔄 Actualiser</button>
      </div>

      {/* KPIs */}
      {summary && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 22 }}>
          {(Object.entries(ALERT_STYLE) as [string, typeof ALERT_STYLE[string]][]).map(([key, s]) => (
            <div key={key} style={{ background: 'white', borderRadius: 14, border: `1.5px solid ${alertFilter === key ? '#059669' : '#e8e0d4'}`, padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
              onClick={() => setAlertFilter(alertFilter === key ? '' : key)}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{summary[key as keyof HealthSummary]}</div>
              <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600, marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {atRisk > 0 && !loading && (
        <div style={{ background: '#fee2e2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 14, padding: '14px 20px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>🚨</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#dc2626' }}>
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
          <button onClick={() => setAlertFilter('')} style={{ padding: '8px 14px', borderRadius: 10, fontSize: 14, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ {ALERT_STYLE[alertFilter]?.label}
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 14, color: '#a89478', fontWeight: 600, alignSelf: 'center' }}>
          {filtered.length} élève{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ width: 32, height: 32, border: '3px solid #e8e0d4', borderTopColor: '#059669', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#dc2626', fontWeight: 700 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#a89478' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 17 }}>Aucun élève pour ce filtre</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Élève', 'Classe', 'Score santé', 'Niveau d\'alerte'].map(h => (
                <th key={h} style={thSt}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const al = ALERT_STYLE[s.alertLevel] ?? ALERT_STYLE.good
                const barColor = s.alertLevel === 'critical' ? '#dc2626' : s.alertLevel === 'warning' ? '#ea580c' : s.alertLevel === 'recommendation' ? '#d97706' : s.alertLevel === 'good' ? '#1d4ed8' : '#059669'
                return (
                  <tr key={s.studentId}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{s.name}</td>
                    <td style={tdSt}>{s.className}</td>
                    <td style={tdSt}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 120, height: 8, background: '#f0ebe3', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${s.healthScore}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontWeight: 900, color: barColor, fontSize: 16 }}>{s.healthScore}</span>
                      </div>
                    </td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 13, fontWeight: 800, background: al.bg, color: al.color }}>
                        {al.icon} {al.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '8px 16px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 15, fontWeight: 700, color: '#6b5c45', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '13px 16px', fontSize: 15, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
