'use client'
import { useCallback } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useState } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

const MENTION_COLOR = (m: string | null): [string, string] => {
  const map: Record<string, [string, string]> = {
    TB: ['#d1fae5', '#065f46'], B: ['#dbeafe', '#1e40af'],
    AB: ['#fef3c7', '#92400e'], P: ['#ffedd5', '#9a3412'], I: ['#fee2e2', '#991b1b'],
  }
  return map[m ?? ''] ?? ['#f1f5f9', '#475569']
}

const NOTE_COLOR = (n: number | null) => n !== null ? (n >= 14 ? '#059669' : n >= 10 ? '#1d4ed8' : '#dc2626') : '#a89478'

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: '#fef3c7', border: '1px solid #d97706', borderRadius: 8, padding: '5px 12px', fontSize: 13, fontWeight: 600, color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
      📦 Données du {date} — hors-ligne
    </div>
  )
}

export default function SectionStudentBulletins({ onToast, user }: Props) {
  const isOnline = useOnlineStatus()
  const [downloading, setDownloading] = useState<string | null>(null)

  const cacheKey = user ? `student:bulletins:${user.id}` : ''
  const fetchFn = useCallback(async () => {
    const res = await fetchApi('/api/v2/report-cards/my', { credentials: 'include' }).then(r => r.json())
    return (res.reportCards ?? []) as any[]
  }, [user])

  const { data: bulletins, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<any[]>(cacheKey, fetchFn)

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

  if (!user || loading) {
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

  const list = bulletins ?? []

  if (!list.length) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={sTitle}>Mes bulletins</div>
          <div style={sSub}>Résultats officiels par trimestre</div>
        </div>
        {fromCache && <CacheBadge cachedAt={cachedAt} />}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucun bulletin disponible</div>
          <div style={{ fontSize: 14, color: '#a89478' }}>Les bulletins apparaîtront ici une fois générés</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 8 : 26 }}>
        <div style={sTitle}>Mes bulletins</div>
        <div style={sSub}>Résultats officiels par trimestre</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
        {list.map((b) => {
          const [mBg, mC] = MENTION_COLOR(b.mention)
          const avg = b.generalAverage
          const rankDisplay = b.rank ? `${b.rank}e` : '—'
          const totalDisplay = b.totalStudents || '—'
          return (
            <div key={b.id} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid #e8e0d4', background: 'linear-gradient(135deg,#1a2e1e,#243b29)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 700, color: 'white' }}>{b.academicPeriod?.name || 'Période'}</div>
                {b.mention && <span style={{ background: mBg, color: mC, padding: '4px 14px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>{b.mention}</span>}
              </div>
              <div style={{ padding: '22px 22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                  <div style={{ background: '#f0ebe3', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 40, fontWeight: 900, color: NOTE_COLOR(avg) }}>{avg !== null ? avg.toFixed(1) : '—'}</div>
                    <div style={{ fontSize: 13, color: '#a89478', fontWeight: 700, marginTop: 4 }}>Moyenne / 20</div>
                  </div>
                  <div style={{ background: '#f0ebe3', borderRadius: 12, padding: '16px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: '#1a1209' }}>{rankDisplay}</div>
                    <div style={{ fontSize: 13, color: '#a89478', fontWeight: 700, marginTop: 4 }}>Rang / {totalDisplay} élèves</div>
                  </div>
                </div>
                <button
                  title={!isOnline ? 'Téléchargement PDF indisponible hors-ligne' : undefined}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: isOnline ? 'linear-gradient(135deg,#059669,#047857)' : '#d4c8b8', color: 'white', border: 'none', cursor: isOnline ? 'pointer' : 'not-allowed', fontFamily: 'inherit', opacity: downloading === b.id ? 0.7 : 1 }}
                  onClick={() => downloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                  disabled={downloading === b.id || !isOnline}>
                  {!isOnline ? '📶 PDF indisponible hors-ligne' : downloading === b.id ? '⏳ Téléchargement...' : '📥 Télécharger le bulletin PDF'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
