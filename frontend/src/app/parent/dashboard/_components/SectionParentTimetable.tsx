'use client'
import { useCallback, useState } from 'react'
import type { ChildWithStats } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

const TIMES = ['07:30', '08:30', '09:30', '10:30', '12:00', '13:00', '14:00']
const TIMES_END = ['08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00']

type SlotType = { subject: string; teacher: string; color: string } | null

interface TimetableData {
  children: ChildWithStats[]
  slotsByChild: Record<string, Record<string, SlotType>>
  classNames: Record<string, string>
}

function CacheBadge({ cachedAt, label }: { cachedAt: number | null; label: string }) {
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      {label.replace('{date}', date)}
    </div>
  )
}

function buildSlots(data: any[]): Record<string, SlotType> {
  const slotMap: Record<string, SlotType> = {}
  const colors = ['var(--green)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--teal)', 'var(--red)', 'var(--orange)']
  let colorIdx = 0
  const subjectColors: Record<string, string> = {}
  data.forEach((tt: any) => {
    (tt.slots || []).forEach((s: any) => {
      const startIdx = TIMES.indexOf(s.startTime)
      if (startIdx === -1) return
      const subName = s.subject?.name || ''
      if (subName && !subjectColors[subName]) { subjectColors[subName] = colors[colorIdx % colors.length]; colorIdx++ }
      slotMap[`${s.dayOfWeek}-${startIdx}`] = {
        subject: subName,
        teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : '',
        color: subjectColors[subName] || 'var(--green)',
      }
    })
  })
  return slotMap
}

export default function SectionParentTimetable({ onToast, userId }: Props) {
  const t = useT('parent')
  const [selectedChild, setSelectedChild] = useState(0)

  const cacheKey = userId ? `parent:timetable:${userId}` : ''
  const fetchFn = useCallback(async (): Promise<TimetableData> => {
    const childrenRes = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    if (!childrenRes.success) throw new Error(t('children.errorLoadChildren'))
    const children: ChildWithStats[] = childrenRes.data

    const slotsByChild: Record<string, Record<string, SlotType>> = {}
    const classNames: Record<string, string> = {}

    await Promise.all(children.map(async (child) => {
      if (!child.classeId) { slotsByChild[child.studentId] = {}; classNames[child.studentId] = child.classeNom || '—'; return }
      classNames[child.studentId] = child.classeNom || ''
      try {
        const ttRes = await fetchApi(`/api/v2/timetables?classId=${child.classeId}`, { credentials: 'include' }).then(r => r.json())
        slotsByChild[child.studentId] = ttRes.success ? buildSlots(ttRes.data) : {}
      } catch {
        slotsByChild[child.studentId] = {}
      }
    }))

    return { children, slotsByChild, classNames }
  }, [userId, t])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<TimetableData>(cacheKey, fetchFn)

  const getWeekRange = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return t('timetable.weekRange').replace('{start}', fmt(monday)).replace('{end}', fmt(friday))
  }

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('loading')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={refetch}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  const children = data?.children ?? []
  const child = children[selectedChild]
  const slots = child ? (data?.slotsByChild[child.studentId] ?? {}) : {}
  const className = child ? (data?.classNames[child.studentId] ?? '') : ''
  const DAYS = t('timetable.days').split(',')

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: fromCache ? 8 : 26 }}>
        <div style={sTitle}>{t('timetable.title')}</div>
        <div style={sSub}>{className} · {getWeekRange()}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      {children.length > 1 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {children.map((c, i) => (
            <button key={c.studentId} onClick={() => setSelectedChild(i)}
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', transition: 'all 0.12s', background: selectedChild === i ? 'var(--green-light)' : 'white', borderColor: selectedChild === i ? 'var(--green)' : 'var(--border2)', color: selectedChild === i ? 'var(--green)' : 'var(--text2)' }}>
              {c.prenom} {c.nom}
            </button>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 100 }}>{t('timetable.schedule')}</th>
                {DAYS.map((d, i) => <th key={i} style={thSt}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((time, ti) => (
                <tr key={ti}>
                  <td style={{ padding: '10px 11px', background: 'var(--bg2)', fontSize: 13, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {time}<br /><span style={{ fontSize: 11, color: 'var(--border2)' }}>{TIMES_END[ti]}</span>
                  </td>
                  {DAYS.map((_, di) => {
                    const slot = slots[`${di}-${ti}`]
                    return (
                      <td key={di} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 140, height: 76 }}>
                        {slot ? (
                          <div style={{ padding: 10, height: '100%', background: `${slot.color}12`, borderLeft: `3px solid ${slot.color}` }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: slot.color }}>{slot.subject}</div>
                            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{slot.teacher}</div>
                          </div>
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border2)', fontSize: 20 }}>·</div>
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

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const thSt: React.CSSProperties = { padding: '11px 10px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }
