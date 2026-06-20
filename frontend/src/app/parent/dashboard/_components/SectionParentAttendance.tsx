'use client'
import { useCallback } from 'react'
import type { ChildWithStats } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
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

export default function SectionParentAttendance({ onToast, userId }: Props) {
  const cacheKey = userId ? `parent:attendance:${userId}` : ''
  const fetchFn = useCallback(async () => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    if (!res.success) throw new Error('Erreur de chargement')
    return res.data as ChildWithStats[]
  }, [userId])

  const { data: children, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<ChildWithStats[]>(cacheKey, fetchFn)

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

  const list = children ?? []

  if (!list.length) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={sTitle}>Présences</div>
          <div style={sSub}>Suivi de l&apos;assiduité</div>
        </div>
        {fromCache && <CacheBadge cachedAt={cachedAt} />}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucune donnée de présence</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 8 : 26 }}>
        <div style={sTitle}>Présences</div>
        <div style={sSub}>Suivi de l&apos;assiduité de vos enfants</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
        {list.map((child) => (
          <div key={child.studentId} style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>👤 {child.prenom} {child.nom}</span>
              <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: '#dbeafe', color: '#1e40af' }}>{child.classeNom || '—'}</span>
            </div>
            <div style={{ padding: '18px 22px' }}>
              {[
                { label: 'Taux de présence', val: child.tauxPresence, color: child.tauxPresence >= 90 ? '#059669' : '#d97706' },
                { label: 'Ponctualité',      val: child.tauxPonctualite, color: child.tauxPonctualite >= 90 ? '#059669' : '#d97706' },
              ].map((stat, j) => (
                <div key={j} style={{ marginBottom: j === 0 ? 16 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#6b5c45', marginBottom: 7 }}>
                    <span>{stat.label}</span>
                    <span style={{ color: stat.color, fontWeight: 900 }}>{stat.val}%</span>
                  </div>
                  <div style={{ height: 8, background: '#e8e0d4', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${stat.val}%`, background: stat.color, borderRadius: 8, transition: 'width 1s' }} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #e8e0d4' }}>
                {[
                  { label: 'Jours absents', val: child.joursAbsent, bg: '#fee2e2', c: '#991b1b' },
                  { label: 'Ce mois',       val: '30 jours',        bg: '#f0ebe3', c: '#6b5c45' },
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

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
