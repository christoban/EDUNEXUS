'use client'
import { useState, useEffect, useCallback } from 'react'
import type { UserInfo } from '../_types'

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

export default function SectionStudentBulletins({ onToast, user }: Props) {
  const [bulletins, setBulletins] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v2/report-cards/my', { credentials: 'include' }).then(r => r.json())
      if (res.reportCards) {
        setBulletins(res.reportCards)
      } else {
        setBulletins([])
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  const downloadPdf = async (id: string, label: string) => {
    setDownloading(id)
    try {
      const res = await fetch(`/api/v2/report-cards/${id}/pdf`, { credentials: 'include' })
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

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={fetchData}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}>
            🔄 Réessayer
          </button>
        </div>
      </div>
    )
  }

  if (!bulletins.length) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={sTitle}>Mes bulletins</div>
          <div style={sSub}>Résultats officiels par trimestre</div>
        </div>
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
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Mes bulletins</div>
        <div style={sSub}>Résultats officiels par trimestre</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
        {bulletins.map((b) => {
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
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', opacity: downloading === b.id ? 0.7 : 1 }}
                  onClick={() => downloadPdf(b.id, b.academicPeriod?.name || 'bulletin')}
                  disabled={downloading === b.id}>
                  {downloading === b.id ? '⏳ Téléchargement...' : '📥 Télécharger le bulletin PDF'}
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
