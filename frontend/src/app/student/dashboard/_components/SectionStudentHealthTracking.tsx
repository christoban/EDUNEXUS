'use client'
import { useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { HeartPulse, Sparkles, Package, UserCheck } from 'lucide-react'
import type { UserInfo } from '../_types'

interface Props {
  user?: UserInfo | null
}

interface HealthTrackingChild {
  studentId: string
  healthScore: number
  alertLevel: 'critical' | 'warning' | 'good'
  conseil: string | null
  conseilDate: string | null
  // Convocation par le conseiller pédagogique — distincte du conseil santé (contextType séparé
  // côté backend), jamais mélangée : une convocation ne doit jamais masquer le dernier vrai
  // conseil pédagogique (bug trouvé en revue de code, corrigé côté AIController.getHealthTracking).
  convocation: { message: string; date: string } | null
}

export default function SectionStudentHealthTracking({ user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')

  const cacheKey = user ? `student:health-tracking:${user.id}` : ''
  const fetchFn = useCallback(async (): Promise<HealthTrackingChild | null> => {
    const res = await fetchApi('/api/v2/ai/health-tracking', { credentials: 'include' }).then(r => r.json())
    const children = res.children ?? []
    return children[0] ?? null
  }, [user])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<HealthTrackingChild | null>(cacheKey, fetchFn)

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('health_tracking.loading')}</div>
      </div>
    )
  }

  if (error && error !== 'OFFLINE_NO_CACHE') {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t('health_tracking.load_error')}</div>
          <button onClick={refetch}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('health_tracking.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={sTitle}>{t('health_tracking.title')}</div>
          <div style={sSub}>{t('health_tracking.subtitle')}</div>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center', maxWidth: 460 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><HeartPulse size={40} color="var(--text3)" /></div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('health_tracking.empty_title')}</div>
          <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500 }}>{t('health_tracking.empty_sub')}</div>
        </div>
      </div>
    )
  }

  const color = data.alertLevel === 'critical' ? 'var(--red)' : data.alertLevel === 'warning' ? 'var(--amber)' : 'var(--green)'
  const bg = data.alertLevel === 'critical' ? 'var(--red-light)' : data.alertLevel === 'warning' ? 'var(--amber-light)' : 'var(--green-light)'
  const levelLabel = data.alertLevel === 'critical' ? t('health_tracking.level_critical') : data.alertLevel === 'warning' ? t('health_tracking.level_warning') : t('health_tracking.level_good')

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>{t('health_tracking.title')}</div>
        <div style={sSub}>{t('health_tracking.subtitle')}</div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Package size={14} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
          </div>
        )}
      </div>

      {data.convocation && (
        <div style={{ background: 'var(--blue-light)', border: '1.5px solid var(--blue)', borderRadius: 14, padding: '16px 20px', marginBottom: 20, maxWidth: 520 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            <UserCheck size={14} strokeWidth={2} /> {t('health_tracking.convocation_title')}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 600, lineHeight: 1.5 }}>{data.convocation.message}</div>
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 16, border: `1.5px solid ${data.alertLevel === 'critical' ? 'var(--red)' : 'var(--border)'}`, padding: 28, maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: data.conseil ? 22 : 0 }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: bg, border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color, flexShrink: 0 }}>
            {data.healthScore}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>{t('health_tracking.score_label')}</div>
            <span style={{ background: bg, color, padding: '4px 14px', borderRadius: 20, fontSize: 15, fontWeight: 800, display: 'inline-block' }}>{levelLabel}</span>
          </div>
        </div>

        {data.conseil ? (
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              <Sparkles size={13} strokeWidth={2} /> {t('health_tracking.advice_title')}
            </div>
            <div style={{ fontSize: 16, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.6 }}>{data.conseil}</div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500 }}>{t('health_tracking.no_advice')}</div>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
