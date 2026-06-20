'use client'
import { useCallback, useState } from 'react'
import type { ChildWithStats, ReportCard } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineEmptyState from '@/components/OfflineEmptyState'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

interface GradesData { children: ChildWithStats[]; bulletins: ReportCard[] }

const MENTION_COLOR = (m: string | null): [string, string] => {
  const map: Record<string, [string, string]> = {
    TB: ['#d1fae5', '#065f46'], B: ['#dbeafe', '#1e40af'],
    AB: ['#fef3c7', '#92400e'], P: ['#ffedd5', '#9a3412'], I: ['#fee2e2', '#991b1b'],
  }
  return map[m ?? ''] ?? ['#f1f5f9', '#475569']
}

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: '#fef3c7', border: '1px solid #d97706', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      📦 Données du {date} — hors-ligne
    </div>
  )
}

export default function SectionParentGrades({ onToast, userId }: Props) {
  const isOnline = useOnlineStatus()
  const [selectedChild, setSelectedChild] = useState(0)
  const [downloading, setDownloading] = useState<string | null>(null)

  const cacheKey = userId ? `parent:grades:${userId}` : ''
  const fetchFn = useCallback(async (): Promise<GradesData> => {
    const childrenRes = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    if (!childrenRes.success) throw new Error('Erreur de chargement')
    const rcRes = await fetchApi('/api/v2/report-cards', { credentials: 'include' }).then(r => r.json())
    return { children: childrenRes.data, bulletins: rcRes.reportCards ?? [] }
  }, [userId])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<GradesData>(cacheKey, fetchFn)

  const children = data?.children ?? []
  const bulletins = data?.bulletins ?? []
  const selectedChildData = children[selectedChild]
  const selectedName = selectedChildData ? `${selectedChildData.prenom} ${selectedChildData.nom}` : ''
  const filteredBulletins = bulletins.filter(b => b.student?.id === selectedChildData?.studentId)

  const downloadPdf = async (id: string, label: string) => {
    if (!isOnline) { onToast('Téléchargement PDF indisponible hors-ligne', 'warning'); return }
    setDownloading(id)
    try {
      const res = await fetchApi(`/api/v2/report-cards/${id}/pdf`, { credentials: 'include' })
      if (!res.ok) { onToast('Erreur de téléchargement', 'error'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Bulletin_${label.replace(/\s+/g, '_')}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      onToast('Bulletin téléchargé', 'success')
    } catch {
      onToast('Erreur de téléchargement', 'error')
    } finally {
      setDownloading(null)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: '#a89478', fontWeight: 600 }}>Chargement...</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={refetch}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
            🔄 Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 8 : 26 }}>
        <div style={sTitle}>Bulletins & Notes</div>
        <div style={sSub}>Résultats scolaires de vos enfants</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      {children.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {children.map((c, i) => (
            <button key={c.studentId} onClick={() => setSelectedChild(i)}
              style={{ padding: '8px 18px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', transition: 'all 0.12s', background: selectedChild === i ? '#d1fae5' : 'white', borderColor: selectedChild === i ? '#059669' : '#d4c8b8', color: selectedChild === i ? '#065f46' : '#6b5c45' }}>
              {c.prenom} {c.nom}
            </button>
          ))}
        </div>
      )}

      {filteredBulletins.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucun bulletin disponible</div>
          <div style={{ fontSize: 14, color: '#a89478' }}>{selectedName ? `Aucun bulletin pour ${selectedName}` : 'Les bulletins apparaîtront ici'}</div>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Période', 'Moyenne générale', 'Rang', 'Mention', 'Actions'].map(h => (
                <th key={h} style={thSt}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filteredBulletins.map((b) => {
                const [mBg, mC] = MENTION_COLOR(b.mention)
                const avg = b.generalAverage
                return (
                  <tr key={b.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{b.academicPeriod?.name || 'Période'}</td>
                    <td style={{ ...tdSt, fontWeight: 900, fontSize: 20, color: avg !== null ? (avg >= 14 ? '#059669' : avg >= 10 ? '#1d4ed8' : '#dc2626') : '#a89478' }}>{avg !== null ? `${avg}/20` : '—'}</td>
                    <td style={tdSt}>{b.rank !== null ? `${b.rank}e` : '—'} {b.totalStudents ? `/ ${b.totalStudents}` : ''}</td>
                    <td style={tdSt}>
                      {b.mention && (
                        <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: mBg, color: mC }}>{b.mention}</span>
                      )}
                    </td>
                    <td style={tdSt}>
                      <button
                        title={!isOnline ? 'Téléchargement PDF indisponible hors-ligne' : undefined}
                        style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: isOnline ? 'white' : '#f0ebe3', color: isOnline ? '#059669' : '#a89478', border: `1.5px solid ${isOnline ? '#059669' : '#d4c8b8'}`, cursor: isOnline ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: downloading === b.id ? 0.6 : 1 }}
                        onClick={() => downloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                        disabled={downloading === b.id || !isOnline}>
                        {downloading === b.id ? '⏳...' : isOnline ? '📥 PDF' : '📶'}
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

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
