'use client'
import { useState, useEffect } from 'react'
import type { UserInfo } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
const TIMES = ['07:30', '08:30', '09:30', '10:30', '12:00', '13:00', '14:00']
const TIMES_END = ['08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00']

type SlotType = { subject: string; classe: string; mine: boolean } | null

const EMPTY_CATCHUP = { open: false, classId: '', proposedDate: '', subjectId: '', proposedStartTime: '', proposedEndTime: '', reason: '', loading: false, error: '' }

export default function SectionTeacherTimetable({ onToast, user }: Props) {
  const [slots, setSlots] = useState<Record<string, SlotType>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catchup, setCatchup] = useState(EMPTY_CATCHUP)
  const [catchupClasses, setCatchupClasses] = useState<{ id: string; name: string }[]>([])

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v2/timetables', { credentials: 'include' }).then(r => r.json())
      if (res.success) {
        const slotMap: Record<string, SlotType> = {}
        const teacherName = user ? `${user.firstName} ${user.lastName}`.toLowerCase() : ''

        res.data.forEach((tt: any) => {
          (tt.slots || []).forEach((s: any) => {
            const startIdx = TIMES.indexOf(s.startTime)
            if (startIdx === -1) return
            const isMine = user?.teacherProfile?.teacherSubjects?.some(
              (ts: any) => ts.subject.id === s.subject?.id
            ) || false
            const key = `${s.dayOfWeek}-${startIdx}`
            slotMap[key] = {
              subject: s.subject?.name || '',
              classe: tt.class?.name || '',
              mine: isMine,
            }
          })
        })
        setSlots(slotMap)
      } else {
        setError('Erreur de chargement')
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [user])

  const openCatchupModal = async () => {
    setCatchup({ ...EMPTY_CATCHUP, open: true })
    try {
      const res = await fetch('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      setCatchupClasses(data.data || [])
    } catch {}
  }

  const submitCatchup = async () => {
    if (!catchup.classId || !catchup.proposedDate) {
      setCatchup(f => ({ ...f, error: 'La classe et la date sont obligatoires.' })); return
    }
    setCatchup(f => ({ ...f, loading: true, error: '' }))
    try {
      const body: Record<string, string> = { classId: catchup.classId, proposedDate: catchup.proposedDate }
      if (catchup.subjectId)          body.subjectId = catchup.subjectId
      if (catchup.proposedStartTime)  body.proposedStartTime = catchup.proposedStartTime
      if (catchup.proposedEndTime)    body.proposedEndTime = catchup.proposedEndTime
      if (catchup.reason.trim())      body.reason = catchup.reason.trim()
      const res = await fetch('/api/v2/timetables/catchup-requests', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        let errMsg = data.message || 'Erreur serveur'
        if (res.status === 409) errMsg = 'Un conflit existe déjà à cette date/heure.'
        else if (res.status === 400) errMsg = 'La classe et la date sont obligatoires.'
        setCatchup(f => ({ ...f, error: errMsg, loading: false })); return
      }
      onToast('Demande de rattrapage envoyée', 'success')
      setCatchup(EMPTY_CATCHUP)
    } catch (err) {
      setCatchup(f => ({ ...f, error: err instanceof Error ? err.message : 'Erreur', loading: false }))
    }
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

  const getWeekRange = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return `Semaine du ${fmt(monday)} au ${fmt(friday)}`
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Mon emploi du temps</div>
          <div style={sSub}>{getWeekRange()}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#059669' }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: '#d1fae5', border: '2px solid #059669' }} />
            Mes cours
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#a89478' }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: '#f0ebe3', border: '2px solid #d4c8b8' }} />
            Autres
          </span>
          <button onClick={openCatchupModal}
            style={{ padding: '9px 16px', borderRadius: 10, fontSize: 14, fontWeight: 800, background: 'white', color: '#059669', border: '1.5px solid rgba(5,150,105,0.35)', cursor: 'pointer', fontFamily: 'inherit' }}>
            📅 Demander un rattrapage
          </button>
        </div>
      </div>

      {/* ── Modal demande de rattrapage ── */}
      {catchup.open && (
        <div onClick={() => setCatchup(EMPTY_CATCHUP)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18, padding: '32px 36px', width: 480, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 22 }}>Demander un rattrapage</div>
            <div style={catchSLb}>Classe *</div>
            <select style={catchSIn} value={catchup.classId} onChange={e => setCatchup(f => ({ ...f, classId: e.target.value }))}>
              <option value="">Sélectionner une classe…</option>
              {catchupClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={catchSLb}>Date proposée *</div>
            <input style={catchSIn} type="date" value={catchup.proposedDate} onChange={e => setCatchup(f => ({ ...f, proposedDate: e.target.value }))} />
            <div style={catchSLb}>Matière (optionnel)</div>
            <select style={catchSIn} value={catchup.subjectId} onChange={e => setCatchup(f => ({ ...f, subjectId: e.target.value }))}>
              <option value="">— Toutes les matières —</option>
              {(user?.teacherProfile?.teacherSubjects || []).map(ts => (
                <option key={ts.subject.id} value={ts.subject.id}>{ts.subject.name}</option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={catchSLb}>Heure début (optionnel)</div>
                <input style={catchSIn} type="time" value={catchup.proposedStartTime} onChange={e => setCatchup(f => ({ ...f, proposedStartTime: e.target.value }))} />
              </div>
              <div>
                <div style={catchSLb}>Heure fin (optionnel)</div>
                <input style={catchSIn} type="time" value={catchup.proposedEndTime} onChange={e => setCatchup(f => ({ ...f, proposedEndTime: e.target.value }))} />
              </div>
            </div>
            <div style={catchSLb}>Motif (optionnel)</div>
            <textarea style={{ ...catchSIn, minHeight: 70, resize: 'vertical' }} value={catchup.reason} onChange={e => setCatchup(f => ({ ...f, reason: e.target.value }))} placeholder="Absence, cours manqué, maladie…" />
            {catchup.error && <div style={{ background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8, lineHeight: 1.5 }}>{catchup.error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'white', color: '#374151', border: '1.5px solid #e8e0d4', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setCatchup(EMPTY_CATCHUP)}>Annuler</button>
              <button style={{ flex: 1, padding: '10px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: catchup.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: catchup.loading ? 0.7 : 1 }} onClick={submitCatchup} disabled={catchup.loading}>
                {catchup.loading ? 'Envoi…' : '📅 Envoyer la demande'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                          <div
                            style={{
                              padding: 10, height: '100%', cursor: slot.mine ? 'pointer' : 'default',
                              background: slot.mine
                                ? 'linear-gradient(135deg,rgba(5,150,105,0.1),rgba(5,150,105,0.05))'
                                : 'rgba(0,0,0,0.02)',
                              borderLeft: slot.mine ? '3px solid #059669' : 'none',
                              opacity: slot.mine ? 1 : 0.5
                            }}
                            onClick={() => slot.mine && onToast(`${slot.subject} — ${slot.classe}`, 'info')}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: slot.mine ? '#047857' : '#6b5c45' }}>{slot.subject}</div>
                            <div style={{ fontSize: 12, color: '#a89478', marginTop: 3 }}>{slot.classe}</div>
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
const catchSLb: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 6 }
const catchSIn: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, border: '1.5px solid #e8e0d4', background: 'white', color: '#1a1209', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14, outline: 'none' }