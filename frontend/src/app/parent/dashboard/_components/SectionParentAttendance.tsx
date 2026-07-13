'use client'
import { useCallback } from 'react'
import { Package, CheckCircle2, User } from 'lucide-react'
import type { ChildWithStats } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

function CacheBadge({ cachedAt, label }: { cachedAt: number | null; label: string }) {
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      <Package size={14} strokeWidth={2} /> {label.replace('{date}', date)}
    </div>
  )
}

export default function SectionParentAttendance({ onToast, userId }: Props) {
  const t = useT('parent')
  const cacheKey = userId ? `parent:attendance:${userId}` : ''
  const fetchFn = useCallback(async () => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    if (!res.success) throw new Error(t('errorLoad'))
    return res.data as ChildWithStats[]
  }, [userId, t])

  const { data: children, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<ChildWithStats[]>(cacheKey, fetchFn)

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

  const list = children ?? []

  if (!list.length) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={sTitle}>{t('attendance.title')}</div>
          <div style={sSub}>{t('attendance.subtitle')}</div>
        </div>
        {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><CheckCircle2 size={48} strokeWidth={2} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('attendance.emptyTitle')}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 8 : 26 }}>
        <div style={sTitle}>{t('attendance.title')}</div>
        <div style={sSub}>{t('attendance.subtitleExtended')}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
        {list.map((child) => (
          <div key={child.studentId} style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }}><User size={16} strokeWidth={2} /> {child.prenom} {child.nom}</span>
              <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: 'var(--blue-light)', color: 'var(--blue)' }}>{child.classeNom || '—'}</span>
            </div>
            <div style={{ padding: '18px 22px' }}>
              {[
                { label: t('attendance.rate'), val: child.tauxPresence, color: child.tauxPresence >= 90 ? 'var(--green)' : 'var(--amber)' },
                { label: t('attendance.punctuality'), val: child.tauxPonctualite, color: child.tauxPonctualite >= 90 ? 'var(--green)' : 'var(--amber)' },
              ].map((stat, j) => (
                <div key={j} style={{ marginBottom: j === 0 ? 16 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: 'var(--text2)', marginBottom: 7 }}>
                    <span>{stat.label}</span>
                    <span style={{ color: stat.color, fontWeight: 900 }}>{stat.val}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${stat.val}%`, background: stat.color, borderRadius: 8, transition: 'width 1s' }} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                {[
                  { label: t('attendance.absentDays'), val: child.joursAbsent, bg: 'var(--red-light)', c: 'var(--red)' },
                  { label: t('attendance.thisMonth'), val: '30 jours', bg: 'var(--bg2)', c: 'var(--text2)' },
                ].map((s, j) => (
                  <div key={j} style={{ flex: 1, background: s.bg, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: s.c }}>{s.val}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.c, opacity: 0.8, marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
