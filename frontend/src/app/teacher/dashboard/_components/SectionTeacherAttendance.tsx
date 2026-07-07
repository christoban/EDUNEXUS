'use client'
import { useState, useEffect } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { db } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null

const ATT_SHORT: Record<string, 'P' | 'A' | 'R' | 'E'> = {
  PRESENT: 'P', ABSENT: 'A', LATE: 'R', EXCUSED: 'E',
}

const ATT_STYLE: Record<string, { selBg: string; selBorder: string; selColor: string; label: string }> = {
  P: { selBg: 'var(--green-light)', selBorder: 'var(--green)', selColor: 'var(--green)', label: '✓' },
  A: { selBg: 'var(--red-light)', selBorder: 'var(--red)', selColor: 'var(--red)', label: '✗' },
  R: { selBg: 'var(--amber-light)', selBorder: 'var(--amber)', selColor: 'var(--amber)', label: '~' },
  E: { selBg: 'var(--blue-light)', selBorder: 'var(--blue)', selColor: 'var(--blue)', label: 'E' },
}

const ATT_TITLE_KEY: Record<string, string> = {
  P: 'attendance.stats_present',
  A: 'attendance.stats_absent',
  R: 'attendance.stats_late',
  E: 'attendance.stats_excused',
}

export default function SectionTeacherAttendance({ onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const attTitle = (code: string) => t(ATT_TITLE_KEY[code] || code)
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [students, setStudents] = useState<any[]>([])
  const [statuses, setStatuses] = useState<Record<string, AttStatus>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rosterLabel, setRosterLabel] = useState<string | null>(null)

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
    if (!selectedClass) { onToast(t('attendance.toast_select_class'), 'warning'); return }
    setLoading(true)
    setError(null)
    setRosterLabel(null)
    try {
      if (!isOnline) {
        const cached = await db.cachedData.get(`teacher:students:${selectedClass}`)
        if (cached) {
          setStudents(cached.data as any[])
          setStatuses({})
          onToast(t('attendance.toast_offline_cache'), 'info')
        } else {
          setStudents([])
          onToast(t('attendance.toast_no_cache'), 'warning')
        }
        return
      }

      const res = await fetchApi(`/api/v2/attendance?classId=${selectedClass}&date=${selectedDate}`, { credentials: 'include' }).then(r => r.json())
      const mapped: Record<string, AttStatus> = {}
      let studentList: any[] = []
      if (res.records?.length) {
        res.records.forEach((r: any) => { mapped[r.studentId] = r.status as AttStatus })
          studentList = res.records.map((r: any) => ({ id: r.studentId, name: r.student?.name || t('grades_section.unknown_student'), ...r.student }))
      } else {
        const usersRes = await fetchApi(`/api/v2/users?role=STUDENT&classId=${selectedClass}`, { credentials: 'include' }).then(r => r.json())
        if (usersRes.success && usersRes.data.length) {
          studentList = usersRes.data.map((u: any) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() }))
        }
      }

      // Créneau électif (LV2 ou A-Level) : restreindre à la liste filtrée + en-tête
      let filteredRoster = false
      if (selectedSubject) {
        try {
          const roster = await fetchApi(`/api/v2/teacher/roster?classId=${selectedClass}&subjectId=${selectedSubject}`, { credentials: 'include' }).then(r => r.json())
          if (roster?.success && roster.data.filtered) {
            studentList = roster.data.students.map((s: any) => ({ id: s.id, name: s.name, className: s.className }))
            setRosterLabel(roster.data.label)
            filteredRoster = true
            // Restreindre les statuts pré-chargés aux seuls élèves du roster
            const allowed = new Set<string>(roster.data.students.map((s: any) => s.id))
            for (const k of Object.keys(mapped)) if (!allowed.has(k)) delete mapped[k]
          }
        } catch { /* réseau : on garde la liste complète */ }
      }

      setStudents(studentList)
      setStatuses(mapped)
      if (studentList.length === 0) onToast(t('attendance.toast_no_students'), 'info')
      // Ne pas écraser le cache classe complète avec une liste élective filtrée
      if (!filteredRoster) {
        await db.cachedData.put({ key: `teacher:students:${selectedClass}`, data: studentList, cachedAt: Date.now() })
      }
    } catch (err: any) {
      setError(err.message || tcommon('status.error'))
    } finally {
      setLoading(false)
    }
  }

  const toggle = (id: string, s: AttStatus) =>
    setStatuses(p => ({ ...p, [id]: p[id] === s ? null : s }))

  const saveAttendance = async () => {
    if (!selectedClass || !students.length) { onToast(t('attendance.toast_nothing_save'), 'warning'); return }
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
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>Chargement...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={loadAttendance}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
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
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 12, padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📶</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--amber)' }}>Mode hors-ligne — les présences seront synchronisées à la reconnexion</span>
        </div>
      )}

      {/* Filtres */}
      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '14px 22px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={filterSt} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
          <option value="">Sélectionne une classe</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select style={filterSt} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
          <option value="">Matière (optionnelle)</option>
          {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
          style={{ ...filterSt, fontFamily: 'inherit' }} />
        <button style={btnPrim} onClick={loadAttendance} disabled={loading}>Charger</button>
      </div>

      {rosterLabel && (
        <div style={{ background: 'var(--blue-light)', border: '1.5px solid var(--blue)', borderRadius: 12, padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--blue)' }}>{rosterLabel}</span>
        </div>
      )}

      {students.length > 0 && (
        <>
          {/* Stats rapides */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            {[
              { label: 'Présents', count: counts.P, bg: 'var(--green-light)', color: 'var(--green)' },
              { label: 'Absents',  count: counts.A, bg: 'var(--red-light)', color: 'var(--red)' },
              { label: 'Retards',  count: counts.R, bg: 'var(--amber-light)', color: 'var(--amber)' },
              { label: 'Excusés',  count: counts.E, bg: 'var(--blue-light)', color: 'var(--blue)' },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, background: s.bg, borderRadius: 13, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.count}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Table présences */}
          <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--border)' }}>
              <button
                style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)', border: '1.5px solid rgba(5,150,105,0.3)', background: 'var(--green-light)', cursor: 'pointer', padding: '7px 16px', borderRadius: 10, fontFamily: 'inherit' }}
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
                    <th key={s} style={{ ...thSt, textAlign: 'center' }}>{attTitle(s)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {students.map((student, i) => {
                  const shortStatus = ATT_SHORT[statuses[student.id] || ''] || null
                  return (
                    <tr key={student.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdSt, color: 'var(--text3)', width: 44 }}>{i + 1}</td>
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                        {student.name}
                        {rosterLabel && student.className && <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 14 }}> ({student.className})</span>}
                      </td>
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
                              title={attTitle(s)}
                              style={{
                                width: 36, height: 36, borderRadius: 9, fontSize: 17,
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800,
                                border: `1.5px solid ${sel ? st.selBorder : 'var(--border2)'}`,
                                background: sel ? st.selBg : 'white',
                                color: sel ? st.selColor : 'var(--text3)',
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
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button style={btnPrim} onClick={saveAttendance} disabled={loading}>
                {loading ? '💾 Sauvegarde...' : isOnline ? '✅ Enregistrer les présences' : '📶 Mettre en file d\'attente'}
              </button>
            </div>
          </div>
        </>
      )}

      {!loading && students.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Sélectionne une classe et clique sur Charger</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>Pour saisir les présences du jour</div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
