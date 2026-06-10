'use client'
import { useState, useEffect, useCallback } from 'react'
import type { UserInfo } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
const TIMES = ['07:30', '08:30', '09:30', '10:30', '12:00', '13:00', '14:00']
const TIMES_END = ['08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00']

type SlotType = { subject: string; teacher: string; color: string } | null

export default function SectionStudentTimetable({ onToast, user }: Props) {
  const [slots, setSlots] = useState<Record<string, SlotType>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [className, setClassName] = useState('')

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    const classId = user.studentProfile?.class?.id
    if (!classId) {
      setError('Aucune classe assignée')
      setLoading(false)
      return
    }

    setClassName(user.studentProfile?.class?.name || '')

    try {
      const res = await fetch(`/api/v2/timetables?classId=${classId}`, { credentials: 'include' }).then(r => r.json())
      if (res.success) {
        const slotMap: Record<string, SlotType> = {}
        const colors = ['#059669', '#1d4ed8', '#7c3aed', '#d97706', '#0d9488', '#dc2626', '#ea580c']
        let colorIdx = 0
        const subjectColors: Record<string, string> = {}

        res.data.forEach((tt: any) => {
          (tt.slots || []).forEach((s: any) => {
            const startIdx = TIMES.indexOf(s.startTime)
            if (startIdx === -1) return
            const subName = s.subject?.name || ''
            if (subName && !subjectColors[subName]) {
              subjectColors[subName] = colors[colorIdx % colors.length]
              colorIdx++
            }
            const key = `${s.dayOfWeek}-${startIdx}`
            slotMap[key] = {
              subject: subName,
              teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : '',
              color: subjectColors[subName] || '#059669',
            }
          })
        })
        setSlots(slotMap)
      } else {
        setError('Erreur de chargement de l\'emploi du temps')
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  const getWeekRange = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return `Semaine du ${fmt(monday)} au ${fmt(friday)}`
  }

  if (loading) {
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
          <button onClick={fetchData}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
            🔄 Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Mon emploi du temps</div>
        <div style={sSub}>{className} · {getWeekRange()}</div>
      </div>
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 100 }}>Horaire</th>
                {DAYS.map(d => <th key={d} style={thSt}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((time, ti) => (
                <tr key={ti}>
                  <td style={{ padding: '10px 11px', background: '#f0ebe3', fontSize: 13, fontWeight: 800, color: '#a89478', textAlign: 'center', border: '1px solid #e8e0d4', whiteSpace: 'nowrap' }}>
                    {time}<br /><span style={{ fontSize: 11, color: '#d4c8b8' }}>{TIMES_END[ti]}</span>
                  </td>
                  {DAYS.map((_, di) => {
                    const slot = slots[`${di}-${ti}`]
                    return (
                      <td key={di} style={{ padding: 0, border: '1px solid #e8e0d4', verticalAlign: 'top', minWidth: 140, height: 76 }}>
                        {slot ? (
                          <div style={{ padding: 10, height: '100%', background: `${slot.color}12`, borderLeft: `3px solid ${slot.color}` }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: slot.color }}>{slot.subject}</div>
                            <div style={{ fontSize: 12, color: '#a89478', marginTop: 3 }}>{slot.teacher}</div>
                          </div>
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4c8b8', fontSize: 20 }}>·</div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const thSt: React.CSSProperties = { padding: '11px 10px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', border: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.5px' }
