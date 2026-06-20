'use client'
import { useState, useEffect } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { db } from '@/lib/offline/db'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null

const ATT_SHORT: Record<string, 'P' | 'A' | 'R' | 'E'> = {
  PRESENT: 'P', ABSENT: 'A', LATE: 'R', EXCUSED: 'E',
}

const ATT_STYLE: Record<string, { selBg: string; selBorder: string; selColor: string; label: string; title: string }> = {
  P: { selBg: '#d1fae5', selBorder: '#059669', selColor: '#065f46', label: '✓', title: 'Présent' },
  A: { selBg: '#fee2e2', selBorder: '#dc2626', selColor: '#991b1b', label: '✗', title: 'Absent' },
  R: { selBg: '#fef3c7', selBorder: '#d97706', selColor: '#92400e', label: '~', title: 'Retard' },
  E: { selBg: '#dbeafe', selBorder: '#1d4ed8', selColor: '#1e40af', label: 'E', title: 'Excusé' },
}

export default function SectionTeacherAttendance({ onToast, user }: Props) {
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<any[]>([])
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { isOnline, addToQueue } = useSyncQueue()

  useEffect(() => {
    if (navigator.onLine) {
      Promise.all([
        fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
      ]).then(async ([clsRes, subRes]) => {
        if (clsRes.success) {
          setClasses(clsRes.data)
          await db.cachedData.put({ key: 'teacher:classes', data: clsRes.data, cachedAt: Date.now() })
        }
        if (subRes.success) {
          setSubjects(subRes.data)
          await db.cachedData.put({ key: 'teacher:subjects', data: subRes.data, cachedAt: Date.now() })
        }
      }).catch(() => {}).finally(() => setLoading(false))
    } else {
      Promise.all([
        db.cachedData.get('teacher:classes'),
        db.cachedData.get('teacher:subjects'),
      ]).then(([clsCache, subCache]) => {
        if (clsCache) setClasses(clsCache.data as any[])
        if (subCache) setSubjects(subCache.data as any[])
      }).catch(() => {}).finally(() => setLoading(false))
    }
  }, [])

  const loadAttendance = async () => {
    if (!selectedClass) { onToast('Sélectionne une classe', 'warning'); return }
    setLoading(true)
    setError(null)
    try {
      if (!isOnline) {
        const cached = await db.cachedData.get(`teacher:students:${selectedClass}`)
        if (cached) {
          setStudents(cached.data as any[])
          setStatuses({})
          onToast('Mode hors-ligne — données en cache', 'info')
        } else {
          setStudents([])
          onToast('Aucune donnée en cache pour cette classe', 'warning')
        }
        return
      }

      const res = await fetchApi(`/api/v2/attendance?classId=${selectedClass}&date=${selectedDate}`, { credentials: 'include' }).then(r => r.json())
      if (res.records?.length) {
        const mapped: Record<string, AttStatus> = {}
        res.records.forEach((r: any) => { mapped[r.studentId] = r.status as AttStatus })
        const studentList = res.records.map((r: any) => ({ id: r.studentId, name: r.student?.name || 'Inconnu', ...r.student }))
        setStudents(studentList)
        setStatuses(mapped)
        await db.cachedData.put({ key: `teacher:students:${selectedClass}`, data: studentList, cachedAt: Date.now() })
      } else {
        const usersRes = await fetchApi(`/api/v2/users?role=STUDENT&classId=${selectedClass}`, { credentials: 'include' }).then(r => r.json())
        if (usersRes.success && usersRes.data.length) {
          const studentList = usersRes.data.map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }))
          setStudents(studentList)
          setStatuses({})
          await db.cachedData.put({ key: `teacher:students:${selectedClass}`, data: studentList, cachedAt: Date.now() })
        } else {
          setStudents([])
          setStatuses({})
          onToast('Aucun élève trouvé pour cette classe', 'info')
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id: string, s: AttStatus) =>
    setStatuses(p => ({ ...p, [id]: p[id] === s ? null : s }))

  const saveAttendance = async () => {
    if (!selectedClass || !students.length) { onToast('Rien à sauvegarder', 'warning'); return }
    const presences = Object.entries(statuses)
      .filter(([, v]) => v !== null)
      .map(([studentId, statut]) => ({ studentId, statut }))
    const payload = {
      classId: selectedClass,
      subjectId: selectedSubject || undefined,
      date: selectedDate,
      period: 'MORNING',
      presences,
    }

    if (!isOnline) {
      await addToQueue({ type: 'ATTENDANCE', endpoint: '/api/v2/attendance', method: 'POST', payload })
      onToast('Présences mises en file d\'attente — synchronisation à la reconnexion', 'warning')
      return
    }

    setLoading(true)
    try {
      const res = await fetchApi('/api/v2/attendance', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(r => r.json())
      if (res.success) {
        onToast('Présences enregistrées', 'success')
      } else {
        onToast(res.message || 'Erreur de sauvegarde', 'error')
      }
    } catch (err: any) {
      onToast(err.message || 'Erreur réseau', 'error')
    } finally {
      setLoading(false)
    }
  }

  const counts = { P: 0, A: 0, R: 0, E: 0 }
  Object.entries(statuses).forEach(([, s]) => {
    if (s) counts[ATT_SHORT[s]]++
  })

  if (loading && !students.length) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600 }}>Chargement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={loadAttendance}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
            🔄 Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Présences</div>
          <div style={sSub}>Saisie par classe · {selectedDate}</div>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: '#fef3c7', border: '1.5px solid #d97706', borderRadius: 12, padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📶</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#92400e' }}>Mode hors-ligne — les présences seront synchronisées à la reconnexion</span>
        </div>
      )}

      {/* Filtres */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '14px 22px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={filterSt} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          <option value="">Sélectionne une classe</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.level || ''} {c.name} {c.serie || ''}</option>)}
        </select>
        <select style={filterSt} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
          <option value="">Matière (optionnelle)</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          style={{ ...filterSt, fontFamily: 'inherit' }} />
        <button style={btnPrim} onClick={loadAttendance} disabled={loading}>Charger</button>
      </div>

      {students.length > 0 && (
        <>
          {/* Stats rapides */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            {[
              { label: 'Présents', count: counts.P, bg: '#d1fae5', color: '#065f46' },
              { label: 'Absents',  count: counts.A, bg: '#fee2e2', color: '#991b1b' },
              { label: 'Retards',  count: counts.R, bg: '#fef3c7', color: '#92400e' },
              { label: 'Excusés',  count: counts.E, bg: '#dbeafe', color: '#1e40af' },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, background: s.bg, borderRadius: 13, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Table présences */}
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '12px 22px', borderBottom: '1px solid #e8e0d4' }}>
              <button
                style={{ fontSize: 15, fontWeight: 800, color: '#059669', border: '1.5px solid rgba(5,150,105,0.3)', background: '#d1fae5', cursor: 'pointer', padding: '7px 16px', borderRadius: 10, fontFamily: 'inherit' }}
                onClick={() => {
                  const all: Record<string, AttStatus> = {}
                  students.forEach(s => { all[s.id] = 'PRESENT' })
                  setStatuses(all)
                }}>
                ✓ Tous présents
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thSt}>N°</th>
                  <th style={thSt}>Élève</th>
                  {(['P', 'A', 'R', 'E'] as const).map(s => (
                    <th key={s} style={{ ...thSt, textAlign: 'center' }}>{ATT_STYLE[s].title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, i) => {
                  const shortStatus = ATT_SHORT[statuses[student.id] || ''] || null
                  return (
                    <tr key={student.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                      <td style={{ ...tdSt, color: '#a89478', width: 44 }}>{i + 1}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{student.name}</td>
                      {(['P', 'A', 'R', 'E'] as const).map(s => {
                        const sel = shortStatus === s
                        const st = ATT_STYLE[s]
                        return (
                          <td key={s} style={{ ...tdSt, textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                const mapping: Record<string, AttStatus> = { P: 'PRESENT', A: 'ABSENT', R: 'LATE', E: 'EXCUSED' }
                                toggle(student.id, sel ? null : (mapping[s] as AttStatus))
                              }}
                              title={st.title}
                              style={{
                                width: 36, height: 36, borderRadius: 9, fontSize: 17,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800,
                                border: `1.5px solid ${sel ? st.selBorder : '#d4c8b8'}`,
                                background: sel ? st.selBg : 'white',
                                color: sel ? st.selColor : '#a89478',
                                transition: 'all 0.1s'
                              }}>
                              {st.label}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={btnPrim} onClick={saveAttendance} disabled={loading}>
                {loading ? '💾 Sauvegarde...' : isOnline ? '✅ Enregistrer les présences' : '📶 Mettre en file d\'attente'}
              </button>
            </div>
          </div>
        </>
      )}

      {!loading && students.length === 0 && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Sélectionne une classe et clique sur Charger</div>
          <div style={{ fontSize: 14, color: '#a89478' }}>Pour saisir les présences du jour</div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
