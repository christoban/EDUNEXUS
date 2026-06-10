'use client'
import { useState, useEffect, useCallback } from 'react'
import type { ChildWithStats } from '../_types'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

const HEALTH_COLORS = (s: number): [string, string, string] =>
  s >= 86 ? ['#d1fae5', '#065f46', 'PROGRESSION']
  : s >= 71 ? ['#dbeafe', '#1e40af', 'STABLE']
  : s >= 51 ? ['#fef3c7', '#92400e', 'MOYEN']
  : s >= 31 ? ['#ffedd5', '#9a3412', 'ÉLEVÉ']
  : ['#fee2e2', '#991b1b', 'CRITIQUE']

function HealthBadge({ score }: { score: number }) {
  const [bg, color, label] = HEALTH_COLORS(score)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 46, height: 46, borderRadius: '50%', background: bg, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 900, color, flexShrink: 0 }}>
        {score}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 800, color }}>{label}</div>
        <div style={{ fontSize: 12, color: '#a89478', marginTop: 1 }}>Indice santé</div>
      </div>
    </div>
  )
}

export default function SectionParentChildren({ onNav, onToast }: Props) {
  const [children, setChildren] = useState<ChildWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
      if (res.success) {
        setChildren(res.data)
      } else {
        setError('Erreur de chargement des enfants')
      }
    } catch (err: any) {
      setError(err.message || 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

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

  if (!children.length) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 26 }}>
          <div style={sTitle}>Mes enfants</div>
          <div style={sSub}>Suivi scolaire en temps réel</div>
        </div>
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍👩‍👧</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Aucun enfant inscrit</div>
          <div style={{ fontSize: 14, color: '#a89478' }}>Les informations de vos enfants apparaîtront ici</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Mes enfants</div>
        <div style={sSub}>Suivi scolaire en temps réel · {children.length} enfant{children.length > 1 ? 's' : ''} inscrit{children.length > 1 ? 's' : ''}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
        {children.map((child, i) => {
          const avg = child.dernieereMoyenne ?? 0
          const avgColor = avg >= 14 ? '#059669' : avg >= 10 ? '#1d4ed8' : '#dc2626'
          return (
            <div key={child.studentId}
              style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', transition: 'all 0.15s' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>

              <div style={{ padding: '22px 26px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `linear-gradient(135deg,${i === 0 ? '#1d4ed8,#7c3aed' : '#059669,#0d9488'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 18, flexShrink: 0 }}>
                  {child.prenom[0]}{child.nom[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1209', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{child.prenom} {child.nom}</div>
                  <div style={{ fontSize: 15, color: '#a89478', marginTop: 3 }}>Élève · {child.classeNom || '—'}</div>
                </div>
                {child.indiceSante !== undefined && child.indiceSante !== null && (
                  <HealthBadge score={child.indiceSante} />
                )}
              </div>

              <div style={{ padding: '18px 26px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Dernière moyenne', val: `${avg.toFixed(1)}/20`, color: avgColor },
                    { label: 'Taux présence',    val: `${child.tauxPresence}%`,    color: child.tauxPresence >= 90    ? '#059669' : '#d97706' },
                    { label: 'Ponctualité',      val: `${child.tauxPonctualite}%`, color: child.tauxPonctualite >= 90 ? '#059669' : '#d97706' },
                  ].map((stat, j) => (
                    <div key={j} style={{ background: '#f0ebe3', borderRadius: 12, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: stat.color }}>{stat.val}</div>
                      <div style={{ fontSize: 13, color: '#a89478', fontWeight: 700, marginTop: 4 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: 16, color: '#6b5c45', fontWeight: 600 }}>
                    🏆 Mention : <strong style={{ color: '#1a1209' }}>{child.derniereeMention || '—'}</strong>
                  </span>
                  <span style={{ fontSize: 15, color: '#a89478' }}>
                    {child.joursAbsent} jour{child.joursAbsent > 1 ? 's' : ''} d&apos;absence
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  {[
                    { label: '📄 Bulletins',  action: () => onNav('grades'),     prim: true  },
                    { label: '✅ Présences',  action: () => onNav('attendance'),  prim: false },
                    { label: '📱 Paiements',  action: () => onNav('payments'),   prim: false },
                  ].map((btn, j) => (
                    <button key={j} onClick={btn.action}
                      style={{ flex: 1, padding: '9px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', border: btn.prim ? 'none' : '1.5px solid #d4c8b8', background: btn.prim ? 'linear-gradient(135deg,#059669,#047857)' : 'white', color: btn.prim ? 'white' : '#6b5c45', transition: 'all 0.12s' }}
                      onMouseEnter={e => { if (!btn.prim) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' }) }}
                      onMouseLeave={e => { if (!btn.prim) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' }) }}>
                      {btn.label}
                    </button>
                  ))}
                </div>
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
