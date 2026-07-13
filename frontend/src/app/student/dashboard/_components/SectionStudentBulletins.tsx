'use client'
import { useCallback } from 'react'
import { ScrollText, Download, Loader2, WifiOff } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useState } from 'react'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const MENTION_COLOR = (m: string | null): [string, string] => {
  const map: Record<string, [string, string]> = {
    TB: ['var(--green-light)', 'var(--green)'], B: ['var(--blue-light)', 'var(--blue)'],
    AB: ['var(--amber-light)', 'var(--amber)'], P: ['var(--orange-light)', 'var(--orange)'], I: ['var(--red-light)', 'var(--red)'],
  }
  return map[m ?? ''] ?? ['var(--bg2)', 'var(--text2)']
}

const NOTE_COLOR = (n: number | null) => n !== null ? (n >= 14 ? 'var(--green)' : n >= 10 ? 'var(--blue)' : 'var(--red)') : 'var(--text3)'

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  const t = useT('student')
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      {t('common.offline_badge').replace('{date}', date)}
    </div>
  )
}

export default function SectionStudentBulletins({ onToast, user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const isOnline = useOnlineStatus()
  const [downloading, setDownloading] = useState<string | null>(null)

  const cacheKey = user ? `student:bulletins:${user.id}` : ''
  const fetchFn = useCallback(async () => {
    const res = await fetchApi('/api/v2/report-cards/my', { credentials: 'include' }).then(r => r.json())
    return (res.reportCards ?? []) as any[]
  }, [user])

  const { data: bulletins, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<any[]>(cacheKey, fetchFn)

  const downloadPdf = async (id: string, label: string) => {
    if (!isOnline) { onToast(t('bulletins.toast_download_offline'), 'warning'); return }
    setDownloading(id)
    try {
      const res = await fetchApi(`/api/v2/report-cards/${id}/pdf`, { credentials: 'include' })
      if (!res.ok) { onToast(t('bulletins.toast_download_error'), 'error'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Bulletin_${label.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onToast(t('bulletins.toast_download_success'), 'success')
    } catch {
      onToast(t('bulletins.toast_download_error'), 'error')
    } finally {
      setDownloading(null)
    }
  }

  if (!user || loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
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
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const list = bulletins ?? []

  if (!list.length) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={sTitle}>{t('bulletins.title')}</div>
          <div style={sSub}>{t('bulletins.subtitle')}</div>
        </div>
        {fromCache && <CacheBadge cachedAt={cachedAt} />}
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><ScrollText size={48} strokeWidth={2} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('bulletins.empty_title')}</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>{t('bulletins.empty_subtitle')}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 8 : 26 }}>
                  <div style={sTitle}>{t('bulletins.title')}</div>
        <div style={sSub}>{t('bulletins.subtitle')}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
        {list.map((b) => {
          const [mBg, mC] = MENTION_COLOR(b.mention)
          const avg = b.generalAverage
          const rankDisplay = b.rank ? `${b.rank}e` : '—'
          const totalDisplay = b.totalStudents || '—'
          return (
            <div key={b.id} style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,var(--sidebar),var(--sidebar2))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'white' }}>{b.academicPeriod?.name || t('bulletins.title')}</div>
                {b.mention && <span style={{ background: mBg, color: mC, padding: '4px 14px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>{b.mention}</span>}
              </div>
              <div style={{ padding: '22px 22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, fontWeight: 900, color: NOTE_COLOR(avg) }}>{avg !== null ? avg.toFixed(1) : '—'}</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700, marginTop: 4 }}>{t('bulletins.average_label')}</div>
                  </div>
                  <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--text)' }}>{rankDisplay}</div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 700, marginTop: 4 }}>{t('bulletins.rank_label').replace('{total}', String(totalDisplay))}</div>
                  </div>
                </div>
                <button
                  title={!isOnline ? t('bulletins.toast_download_offline') : undefined}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: isOnline ? 'linear-gradient(135deg,var(--green),var(--green2))' : 'var(--border2)', color: 'white', border: 'none', cursor: isOnline ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: downloading === b.id ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => downloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                  disabled={downloading === b.id || !isOnline}>
                  {!isOnline ? <><WifiOff size={16} strokeWidth={2} /> {t('bulletins.offline_label')}</> : downloading === b.id ? <><Loader2 size={16} strokeWidth={2} className="animate-spin" /> {t('bulletins.downloading_label')}</> : <><Download size={16} strokeWidth={2} /> {t('bulletins.download_button')}</>}
                </button>
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
