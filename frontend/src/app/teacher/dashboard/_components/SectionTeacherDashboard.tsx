'use client'
import { useCallback } from 'react'
import { School, GraduationCap, FileText, CheckCircle2, Award, Target, MapPin, Siren, Hand, RefreshCw, Calendar, Bell, AlertTriangle, PenLine, ClipboardList, Package } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

interface TeacherDashData {
  classCount: number | null
  studentCount: number | null
  pendingGrades: number | null
  attendanceRate: string | null
  todaySlots: any[]
  rejectedGrades: number
}

export default function SectionTeacherDashboard({ onNav, onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')

  const fetchDataFn = useCallback(async (): Promise<TeacherDashData> => {
    const [classesRes, gradesPendingRes, statsRes, timetableRes, gradesRejectedRes] = await Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi(`/api/v2/grades?validationStatus=SUBMITTED`, { credentials: 'include' }).then(r => r.json()),
      fetchApi(`/api/v2/attendance/stats`, { credentials: 'include' }).then(r => r.json()),
      fetchApi(`/api/v2/timetables`, { credentials: 'include' }).then(r => r.json()),
      fetchApi(`/api/v2/grades?validationStatus=REJECTED`, { credentials: 'include' }).then(r => r.json()),
    ])

    const result: TeacherDashData = {
      classCount: null, studentCount: null, pendingGrades: null, attendanceRate: null, todaySlots: [], rejectedGrades: 0,
    }

    if (classesRes.success) {
      result.classCount = classesRes.data.length
      result.studentCount = classesRes.data.reduce((sum: number, c: any) => sum + (c._count?.students || 0), 0)
    }
    if (gradesPendingRes.grades) {
      result.pendingGrades = gradesPendingRes.pagination?.total || gradesPendingRes.grades.length
    }
    if (statsRes.stats) {
      result.attendanceRate = statsRes.stats.attendanceRate
    }
    if (timetableRes.success) {
      // getDay() : 0=Dimanche, 1=Lundi … 6=Samedi → converti en 0=Lundi … 5=Samedi, la
      // convention unique de TimetableSlot.dayOfWeek. Dimanche devient 6 et ne matche donc
      // aucun créneau, ce qui est le comportement voulu.
      const todayIdx = (new Date().getDay() + 6) % 7
      const teacherProfileId = user?.teacherProfile?.id
      result.todaySlots = timetableRes.data.flatMap((tt: any) =>
        (tt.slots || [])
          .filter((s: any) =>
            s.dayOfWeek === todayIdx && teacherProfileId && s.teacher?.id === teacherProfileId
          )
          .map((s: any) => ({
            time: `${s.startTime}–${s.endTime}`,
            classe: tt.class?.name || '',
            subject: s.subject?.name || '',
            salle: s.room || '',
            eleves: 0,
          }))
      )
    }
    if (gradesRejectedRes.grades) {
      result.rejectedGrades = gradesRejectedRes.grades.length
    }
    return result
  }, [user])

  const { data, loading, error, fromCache, cachedAt, refetch: fetchData } = useCachedFetch<TeacherDashData>(user ? `teacher:dashboard:${user.id}` : '', fetchDataFn)
  const classCount = data?.classCount ?? null
  const studentCount = data?.studentCount ?? null
  const pendingGrades = data?.pendingGrades ?? null
  const attendanceRate = data?.attendanceRate ?? null
  const todaySlots = data?.todaySlots ?? []
  const rejectedGrades = data?.rejectedGrades ?? 0

  const now = new Date()
  const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const KPI_ITEMS = [
    { Icon: School, bg: 'var(--green-light)', val: classCount !== null ? String(classCount) : '...', label: t('dashboard.kpi_assigned_classes'), trend: t('dashboard.trend_2025_2026'), tBg: 'var(--green-light)', tC: 'var(--green)' },
    { Icon: GraduationCap, bg: 'var(--blue-light)', val: studentCount !== null ? String(studentCount) : '...', label: t('dashboard.kpi_total_students'), trend: t('dashboard.trend_year'), tBg: 'var(--green-light)', tC: 'var(--green)' },
    { Icon: FileText, bg: 'var(--amber-light)', val: pendingGrades !== null ? String(pendingGrades) : '...', label: t('dashboard.kpi_pending_grades'), trend: t('dashboard.trend_urgent'), tBg: 'var(--amber-light)', tC: 'var(--amber)', nav: 'grades', urgent: true },
    { Icon: CheckCircle2, bg: 'var(--green-light)', val: attendanceRate || '...', label: t('dashboard.kpi_attendance_rate'), trend: t('dashboard.trend_global'), tBg: 'var(--green-light)', tC: 'var(--green)', nav: 'attendance' },
  ]

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error && error !== 'OFFLINE_NO_CACHE') {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={fetchData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={14} strokeWidth={2} />{t('dashboard.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={{ ...sTitle, display: 'flex', alignItems: 'center', gap: 10 }}>{t('dashboard.greeting').replace('{name}', user?.firstName || tcommon('user.teacherFallback'))}<Hand size={24} strokeWidth={2} /></div>
          <div style={sSub}>{dateStr}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Package size={14} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button style={{ ...btnSec, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { onToast(t('dashboard.refresh'), 'info'); fetchData() }}><RefreshCw size={14} strokeWidth={2} />{t('dashboard.refresh')}</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
        {KPI_ITEMS.map((k, i) => (
          <div key={i}
            onClick={() => k.nav && onNav(k.nav)}
            style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: '22px 26px', cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
            onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><k.Icon size={22} strokeWidth={2} /></div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: k.tBg, color: k.tC }}>
                {(k as any).urgent && <AlertTriangle size={12} strokeWidth={2} />}{k.trend}
              </span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 16, color: 'var(--text3)', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Rôles spéciaux : Professeur Principal + Animateur Pédagogique ── */}
      {((user?.classesProfessorPrincipal?.length ?? 0) > 0 || (user?.headedDepartments?.length ?? 0) > 0) && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 22, flexWrap: 'wrap' }}>

          {user?.classesProfessorPrincipal?.map(cls => (
            <div key={cls.id} style={{ flex: '1 1 300px', background: 'linear-gradient(135deg,var(--green-light),var(--green-light))', borderRadius: 16, border: '1.5px solid rgba(5,150,105,0.35)', padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(5,150,105,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Award size={26} strokeWidth={2} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{t('dashboard.pp_badge')}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--green)', lineHeight: 1.1 }}>{cls.name}</div>
                {cls._count && (
                  <div style={{ fontSize: 13, color: 'var(--green2)', fontWeight: 700, marginTop: 3 }}>{t('dashboard.pp_students').replace('{count}', String(cls._count.students))}</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <button onClick={() => onNav('pp-appreciations')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: 'rgba(5,150,105,0.15)', color: 'var(--green)', border: '1.5px solid rgba(5,150,105,0.3)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  <PenLine size={13} strokeWidth={2} />{t('dashboard.pp_appreciations_btn')}
                </button>
                <button onClick={() => onNav('pp-classe')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: 'var(--surface)', color: 'var(--green)', border: '1.5px solid rgba(5,150,105,0.3)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  <ClipboardList size={13} strokeWidth={2} />{t('dashboard.pp_class_btn')}
                </button>
              </div>
            </div>
          ))}

          {user?.headedDepartments?.map(dept => (
            <div key={dept.id} style={{ flex: '1 1 300px', background: `linear-gradient(135deg,${dept.color}20,${dept.color}08)`, borderRadius: 16, border: `1.5px solid ${dept.color}55`, padding: '18px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: `${dept.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Target size={26} strokeWidth={2} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: dept.color, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 2 }}>{t('dashboard.ap_badge')}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{t('dashboard.ap_dept_prefix').replace('{name}', dept.name)}</div>
                {dept.subjects && dept.subjects.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, marginTop: 3 }}>
                    {dept.subjects.slice(0, 3).map(s => s.name).join(' · ')}{dept.subjects.length > 3 ? t('dashboard.more_subjects').replace('{count}', String(dept.subjects.length - 3)) : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <button onClick={() => onNav('ap-departement')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 13, fontWeight: 800, background: `${dept.color}18`, color: dept.color, border: `1.5px solid ${dept.color}40`, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                  <Target size={13} strokeWidth={2} />{t('dashboard.ap_dept_btn')}
                </button>
              </div>
            </div>
          ))}

        </div>
      )}

      {/* 2 colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Cours aujourd'hui */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}><Calendar size={16} strokeWidth={2} />{t('dashboard.today_courses')}</span>
            <button style={btnSecSm} onClick={() => onNav('timetable')}>{t('dashboard.view_full_timetable')}</button>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {todaySlots.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 15, fontWeight: 600 }}>{t('dashboard.no_today_courses')}</div>
            ) : todaySlots.map((c, i) => (
              <div key={i}
                style={{ background: 'var(--bg)', borderRadius: 14, border: '1.5px solid var(--border)', padding: '16px 18px', cursor: 'pointer', transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', boxShadow: '0 3px 10px rgba(0,0,0,0.06)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border)', boxShadow: 'none' })}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text3)' }}>{c.time}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: 'var(--blue-light)', color: 'var(--blue)' }}>{c.classe}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{c.subject}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 15, color: 'var(--text3)', fontWeight: 600 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={14} strokeWidth={2} /> {c.salle || t('dashboard.room_undefined')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertes */}
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 800, color: 'var(--text)' }}><Bell size={16} strokeWidth={2} />{t('dashboard.alerts_title')}</span>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rejectedGrades > 0 && (
              <div
                onClick={() => onNav('grades')}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 12, border: '1.5px solid', cursor: 'pointer', background: 'var(--red-light)', borderColor: 'rgba(220,38,38,0.2)' }}>
                <span style={{ display: 'flex', alignItems: 'center' }}><Siren size={20} strokeWidth={2} /></span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--red)' }}>{t('dashboard.rejected_note').replace('{count}', String(rejectedGrades))}</div>
                  <div style={{ fontSize: 15, color: 'var(--red)', fontWeight: 500, marginTop: 3 }}>{t('dashboard.rejected_action')}</div>
                </div>
              </div>
            )}

            {/* Actions rapides */}
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                onClick={() => onNav('attendance')}>
                <CheckCircle2 size={16} strokeWidth={2} />{t('dashboard.take_attendance')}
              </button>
              <button style={{ width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                onClick={() => onNav('grades')}>
                <FileText size={16} strokeWidth={2} />{t('dashboard.enter_grades')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '6px 12px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
