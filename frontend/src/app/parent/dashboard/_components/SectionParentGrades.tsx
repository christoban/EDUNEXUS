'use client'
import { useCallback, useState } from 'react'
import { ScrollText, Loader2, Download, WifiOff, Package } from 'lucide-react'
import type { ChildWithStats, ReportCard } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

interface GradesData { children: ChildWithStats[]; bulletins: ReportCard[] }

const MENTION_COLOR = (m: string | null): [string, string] => {
  const map: Record<string, [string, string]> = {
    TB: ['var(--green-light)', 'var(--green)'], B: ['var(--blue-light)', 'var(--blue)'],
    AB: ['var(--amber-light)', 'var(--amber)'], P: ['var(--orange-light)', 'var(--orange)'], I: ['var(--red-light)', 'var(--red)'],
  }
  return map[m ?? ''] ?? ['var(--bg2)', 'var(--text2)']
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

export default function SectionParentGrades({ onToast, userId }: Props) {
  const t = useT('parent')
  const isOnline = useOnlineStatus()
  const [selectedChild, setSelectedChild] = useState(0)
  const [downloading, setDownloading] = useState<string | null>(null)

  const cacheKey = userId ? `parent:grades:${userId}` : ''
  const fetchFn = useCallback(async (): Promise<GradesData> => {
    const childrenRes = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    if (!childrenRes.success) throw new Error(t('errorLoad'))
    const rcRes = await fetchApi('/api/v2/report-cards', { credentials: 'include' }).then(r => r.json())
    return { children: childrenRes.data, bulletins: rcRes.reportCards ?? [] }
  }, [userId, t])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<GradesData>(cacheKey, fetchFn)

  const children = data?.children ?? []
  const bulletins = data?.bulletins ?? []
  const selectedChildData = children[selectedChild]
  const selectedName = selectedChildData ? `${selectedChildData.prenom} ${selectedChildData.nom}` : ''
  const filteredBulletins = bulletins.filter(b => b.student?.id === selectedChildData?.studentId)

  const downloadPdf = async (id: string, label: string) => {
    if (!isOnline) { onToast(t('grades.downloadUnavailable'), 'warning'); return }
    setDownloading(id)
    try {
      const res = await fetchApi(`/api/v2/report-cards/${id}/pdf`, { credentials: 'include' })
      if (!res.ok) { onToast(t('grades.downloadError'), 'error'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${t('grades.downloaded').replace(/\s/g, '_')}_${label.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onToast(t('grades.downloaded'), 'success')
    } catch {
      onToast(t('grades.downloadError'), 'error')
    } finally {
      setDownloading(null)
    }
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

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 8 : 26 }}>
        <div style={sTitle}>{t('grades.title')}</div>
        <div style={sSub}>{t('grades.subtitle')}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      {children.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {children.map((c, i) => (
            <button key={c.studentId} onClick={() => setSelectedChild(i)}
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', transition: 'all 0.12s', background: selectedChild === i ? 'var(--green-light)' : 'white', borderColor: selectedChild === i ? 'var(--green)' : 'var(--border2)', color: selectedChild === i ? 'var(--green)' : 'var(--text2)' }}>
              {c.prenom} {c.nom}
            </button>
          ))}
        </div>
      )}

      {filteredBulletins.length === 0 ? (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><ScrollText size={48} strokeWidth={2} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{t('grades.emptyTitle')}</div>
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>{selectedName ? t('grades.emptyForChild').replace('{name}', selectedName) : t('grades.emptyDesc')}</div>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1.5px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{[t('grades.period'), t('grades.average'), t('grades.rank'), t('grades.mention'), t('grades.actions')].map(h => (
                <th key={h} style={thSt}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filteredBulletins.map((b) => {
                const [mBg, mC] = MENTION_COLOR(b.mention)
                const avg = b.generalAverage
                return (
                  <tr key={b.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{b.academicPeriod?.name || 'Période'}</td>
                    <td style={{ ...tdSt, fontWeight: 900, fontSize: 20, color: avg !== null ? (avg >= 14 ? 'var(--green)' : avg >= 10 ? 'var(--blue)' : 'var(--red)') : 'var(--text3)' }}>{avg !== null ? `${avg}/20` : '—'}</td>
                    <td style={tdSt}>{b.rank !== null ? `${b.rank}e` : '—'} {b.totalStudents ? `/ ${b.totalStudents}` : ''}</td>
                    <td style={tdSt}>
                      {b.mention && (
                        <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: mBg, color: mC }}>{b.mention}</span>
                      )}
                    </td>
                    <td style={tdSt}>
                      <button
                        title={!isOnline ? t('grades.downloadUnavailable') : undefined}
                        style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: isOnline ? 'white' : 'var(--bg2)', color: isOnline ? 'var(--green)' : 'var(--text3)', border: `1.5px solid ${isOnline ? 'var(--green)' : 'var(--border2)'}`, cursor: isOnline ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: downloading === b.id ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        onClick={() => downloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                        disabled={downloading === b.id || !isOnline}>
                        {downloading === b.id ? <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> {t('grades.downloading')}</> : isOnline ? <><Download size={14} strokeWidth={2} /> {t('grades.downloadPdf')}</> : <WifiOff size={14} strokeWidth={2} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 17, color: 'var(--text3)', marginTop: 3 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
