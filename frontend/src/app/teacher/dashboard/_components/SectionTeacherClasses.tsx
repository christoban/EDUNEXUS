'use client'
import { useState, useEffect } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const MOY_COLOR = (v: number) => v >= 14 ? 'var(--green)' : v >= 10 ? 'var(--blue)' : 'var(--red)'

interface ClassStats {
  classId: string
  average: number | null
  attendanceRate: string | null
}

export default function SectionTeacherClasses({ onNav, onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const [classes, setClasses] = useState<any[]>([])
  const [stats, setStats]     = useState<Record<string, ClassStats>>({})
  const [gradeStats, setGradeStats] = useState<Record<string, { total: number; submitted: number; draft: number }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json())
      if (res.success) {
        setClasses(res.data)
        fetchStats(res.data as any[])
      } else {
        setError(t('classes.load_error'))
      }
    } catch (err: any) {
      setError(err.message || t('classes.network_error'))
    } finally { setLoading(false) }
  }

  const fetchStats = async (classList: any[]) => {
    const statsMap: Record<string, ClassStats> = {}
    const gradeMap: Record<string, { total: number; submitted: number; draft: number }> = {}
    await Promise.all(classList.map(async (cls) => {
      try {
        const res = await fetchApi(`/api/v2/attendance/stats?classId=${cls.id}`, { credentials: 'include' })
        const d = await res.json()
        statsMap[cls.id] = {
          classId: cls.id,
          average: null,
          attendanceRate: res.ok && d.stats?.attendanceRate ? d.stats.attendanceRate : null,
        }
      } catch { statsMap[cls.id] = { classId: cls.id, average: null, attendanceRate: null } }
      try {
        const gr = await fetchApi(`/api/v2/grades/status/${cls.id}`, { credentials: 'include' })
        const gd = await gr.json()
        if (gr.ok && gd.stats) {
          gradeMap[cls.id] = {
            total: gd.stats.total,
            submitted: (gd.stats.SUBMITTED || 0) + (gd.stats.VALIDATED || 0) + (gd.stats.LOCKED || 0),
            draft: gd.stats.DRAFT || 0,
          }
        }
      } catch { /* silencieux — ne pas casser l'affichage */ }
    }))
    setStats(statsMap)
    setGradeStats(gradeMap)
  }

  useEffect(() => { fetchData() }, [])

  const totalStudents = classes.reduce((sum: number, c: any) => sum + (c._count?.students || 0), 0)

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('user.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={fetchData}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('classes.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>{t('classes.title')}</div>
        <div style={sSub}>{t('classes.subtitle').replace('{count}', String(classes.length)).replace('{students}', String(totalStudents))}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
        {classes.map((cls, i) => {
          const isPP = cls.professorPrincipalId === user?.id
          return (
            <div key={cls.id}
              style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 26, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)', borderColor: 'var(--border2)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none', borderColor: 'var(--border)' })}>

              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 33, fontWeight: 700, color: 'var(--text)' }}>
                  {cls.name}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isPP && (
                    <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                      {t('classes.badge_pp')}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 22, fontSize: 17, fontWeight: 600, color: 'var(--text2)', marginBottom: 18 }}>
                <span>{t('classes.students_count').replace('{count}', String(cls._count?.students || 0))}</span>
              </div>

              {/* Stats boxes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>{t('classes.stats_avg')}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: stats[cls.id]?.average != null ? MOY_COLOR(stats[cls.id].average!) : 'var(--text3)' }}>
                    {stats[cls.id]?.average != null ? `${stats[cls.id].average!.toFixed(1)}` : '--'}
                    <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text3)' }}>/20</span>
                  </div>
                </div>
                <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)', marginBottom: 6 }}>{t('classes.stats_attendance')}</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: stats[cls.id]?.attendanceRate ? 'var(--green)' : 'var(--text3)' }}>
                    {stats[cls.id]?.attendanceRate ?? '--'}
                  </div>
                </div>
              </div>

              {/* Grade submission status */}
              {(() => {
                const gs = gradeStats[cls.id]
                if (!gs) return null
                const done = gs.submitted
                const total = gs.total
                let label: string, bg: string, color: string
                if (total === 0) {
                  label = t('classes.grade_awaiting'); bg = 'var(--red-light)'; color = 'var(--red)'
                } else if (done === total) {
                  label = t('classes.grade_complete'); bg = 'var(--green-light)'; color = 'var(--green)'
                } else {
                  label = t('classes.grade_partial').replace('{done}', String(done)).replace('{total}', String(total)); bg = 'var(--amber-light)'; color = 'var(--amber)'
                }
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text3)' }}>{t('classes.grade_label')}</span>
                    <span style={{ background: bg, color, padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                      {label}
                    </span>
                    {total > 0 && done < total && (
                      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(done / total) * 100}%`, height: '100%', background: 'var(--amber)', borderRadius: 4 }} />
                      </div>
                    )}
                  </div>
                )
              })()}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  style={{ flex: 1, padding: '9px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)' })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                  onClick={() => onNav('attendance')}>{t('classes.btn_attendance')}</button>
                <button
                  style={{ flex: 1, padding: '9px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)' })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                  onClick={() => onNav('grades')}>{t('classes.btn_grades')}</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }