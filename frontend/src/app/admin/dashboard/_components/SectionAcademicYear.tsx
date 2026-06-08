'use client'
import { useState } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const TRIMESTERS = [
  {
    name: 'Trimestre 1',
    dates: '01/09 → 31/12/2025',
    status: 'done' as const,
    sequences: [
      { name: 'Séquence 1', dates: '01/09 → 15/10/2025', status: 'done' as const },
      { name: 'Séquence 2', dates: '16/10 → 31/12/2025', status: 'done' as const },
    ],
  },
  {
    name: 'Trimestre 2',
    dates: '05/01 → 28/02/2026',
    status: 'active' as const,
    sequences: [
      { name: 'Séquence 3', dates: '05/01 → 06/02/2026', status: 'active' as const },
      { name: 'Séquence 4', dates: '07/02 → 28/02/2026', status: 'pending' as const },
    ],
  },
  {
    name: 'Trimestre 3',
    dates: '01/03 → 30/06/2026',
    status: 'pending' as const,
    sequences: [
      { name: 'Séquence 5', dates: '01/03 → 15/04/2026', status: 'pending' as const },
      { name: 'Séquence 6', dates: '16/04 → 30/06/2026', status: 'pending' as const },
    ],
  },
]

const HISTORY = [
  { year: '2024–2025', type: 'Francophone', eleves: 312, bac: '87% succès', bacBg: '#d1fae5', bacC: '#065f46' },
  { year: '2023–2024', type: 'Francophone', eleves: 298, bac: '82% succès', bacBg: '#d1fae5', bacC: '#065f46' },
  { year: '2022–2023', type: 'Francophone', eleves: 275, bac: '79% succès', bacBg: '#fef3c7', bacC: '#92400e' },
]

const STATUS_BADGE = {
  done:    { bg: '#d1fae5', color: '#065f46', label: '✓ Terminé' },
  active:  { bg: '#fef3c7', color: '#92400e', label: '⏳ En cours' },
  pending: { bg: '#f1f5f9', color: '#475569', label: 'À venir' },
}

export default function SectionAcademicYear({ onToast }: Props) {
  const [openTrims, setOpenTrims] = useState<Set<number>>(new Set([1]))
  const [periodOpen, setPeriodOpen] = useState(false)
  const [currentPeriod, setCurrentPeriod] = useState('Trimestre 2')

  const toggleTrim = (i: number) => {
    setOpenTrims(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Année scolaire</div>
          <div style={sSub}>Gestion des années, périodes et séquences</div>
        </div>
        <button style={btnPrim} onClick={() => onToast('Création nouvelle année...', 'info')}>+ Nouvelle année</button>
      </div>

      {/* Current Year Banner */}
      <div style={{
        background: 'linear-gradient(135deg,#1a2e1e 0%,#243b29 60%,#1a3520 100%)',
        borderRadius: 20, padding: '32px 36px', marginBottom: 22,
        position: 'relative', overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ position: 'absolute', right: 36, top: '50%', transform: 'translateY(-50%)', fontSize: 100, opacity: 0.04, color: 'white', pointerEvents: 'none' }}>★</div>

        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
              Année en cours
            </div>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 44, fontWeight: 700, color: 'white', lineHeight: 1 }}>
              2025–2026
            </div>
            <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.5)', marginTop: 8, fontWeight: 600 }}>
              01 Sept 2025 → 30 Juin 2026
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setPeriodOpen(!periodOpen)}
                style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 9, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
                📅 {currentPeriod} ▾
              </button>
              {periodOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, zIndex: 50, overflow: 'hidden' }}>
                  {['Trimestre 1', 'Trimestre 2', 'Trimestre 3'].map(p => (
                    <div key={p} onClick={() => { setCurrentPeriod(p); setPeriodOpen(false) }}
                      style={{ padding: '11px 16px', fontSize: 16, fontWeight: 700, color: p === currentPeriod ? '#059669' : '#6b5c45', background: p === currentPeriod ? '#d1fae5' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      onMouseEnter={e => { if (p !== currentPeriod) (e.currentTarget as HTMLElement).style.background = '#f0ebe3' }}
                      onMouseLeave={e => { if (p !== currentPeriod) (e.currentTarget as HTMLElement).style.background = 'white' }}>
                      {p} {p === currentPeriod && '✓'}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button style={{ ...btnSecLight, fontSize: 14, padding: '7px 14px' }} onClick={() => onToast('Vue historique', 'info')}>
              📋 Vue historique
            </button>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: 28, marginBottom: 22, flexWrap: 'wrap' }}>
          {[
            { label: 'Type', value: 'Francophone · Collège–Lycée' },
            { label: 'Système', value: 'MINESEC · 3 Trimestres' },
            { label: 'Séquence en cours', value: 'Séquence 3', badge: { bg: '#fef3c7', color: '#92400e', text: 'En cours' } },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px' }}>{m.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'white' }}>{m.value}</div>
                {m.badge && <span style={{ background: m.badge.bg, color: m.badge.color, padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>{m.badge.text}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => onToast('Mode édition calendrier', 'info')}
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#34d399', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
            ✏️ Modifier le calendrier
          </button>
          <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            Prochain : Trimestre 3 le 01 Mars 2026
          </span>
        </div>
      </div>

      {/* Calendar Editor */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>📅 Calendrier scolaire — 2025–2026</span>
          <button style={btnSecSm} onClick={() => onToast('Nouvelle année en cours...', 'info')}>+ Nouvelle année</button>
        </div>

        {TRIMESTERS.map((trim, ti) => (
          <div key={ti} style={{ borderBottom: ti < TRIMESTERS.length - 1 ? '1px solid #e8e0d4' : 'none' }}>
            {/* Trim header */}
            <div
              onClick={() => toggleTrim(ti)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 22px', cursor: 'pointer', transition: 'background 0.1s', userSelect: 'none' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f7f3ee'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
              <span style={{ fontSize: 14, color: '#a89478', transition: 'transform 0.2s', display: 'inline-block', transform: openTrims.has(ti) ? 'rotate(90deg)' : 'rotate(0deg)', flexShrink: 0 }}>▶</span>
              <span style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209', flex: 1 }}>{trim.name}</span>
              <span style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>{trim.dates}</span>
              <span style={{ background: STATUS_BADGE[trim.status].bg, color: STATUS_BADGE[trim.status].color, padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                {STATUS_BADGE[trim.status].label}
              </span>
            </div>

            {/* Sequences */}
            {openTrims.has(ti) && (
              <div style={{ padding: '0 22px 20px 22px' }}>
                <div style={{ borderLeft: '3px solid #e8e0d4', marginLeft: 10, paddingLeft: 22, display: 'flex', flexDirection: 'column' }}>
                  {trim.sequences.map((seq, si) => (
                    <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', position: 'relative', borderBottom: si < trim.sequences.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                      <div style={{ position: 'absolute', left: -30, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, borderRadius: '50%', background: seq.status === 'done' ? '#059669' : seq.status === 'active' ? '#d97706' : '#d4c8b8', border: '2px solid white', boxShadow: seq.status === 'active' ? '0 0 0 4px rgba(217,119,6,0.18)' : 'none' }} />
                      <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1209', minWidth: 120 }}>{seq.name}</span>
                      <span style={{ fontSize: 15, color: '#a89478', fontWeight: 600, flex: 1 }}>{seq.dates}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ background: STATUS_BADGE[seq.status].bg, color: STATUS_BADGE[seq.status].color, padding: '3px 10px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                          {STATUS_BADGE[seq.status].label}
                        </span>
                        {seq.status !== 'pending' && (
                          <button style={btnSecSm} onClick={() => onToast(`Modifier ${seq.name}`, 'info')}>✏️</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* History */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>🗂️ Historique des années</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Année', 'Type', 'Élèves', 'Résultats BAC', 'Statut', 'Actions'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {HISTORY.map((h, i) => (
              <tr key={i}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                <td style={tdStyle}>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 19, fontWeight: 800, color: '#1a1209' }}>{h.year}</div>
                </td>
                <td style={tdStyle}>{h.type}</td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>{h.eleves}</td>
                <td style={tdStyle}>
                  <span style={{ background: h.bacBg, color: h.bacC, padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>{h.bac}</span>
                </td>
                <td style={tdStyle}>
                  <span style={{ background: '#f1f5f9', color: '#475569', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>Archivée</span>
                </td>
                <td style={tdStyle}>
                  <button style={btnSecSm} onClick={() => onToast(`Archives ${h.year}`, 'info')}>📂 Voir</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Danger zone */}
      <div style={{ background: 'white', borderRadius: 18, border: '2px solid rgba(220,38,38,0.2)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 26px', background: '#fee2e2', borderBottom: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>Zone de danger — Actions irréversibles</div>
        </div>
        <div style={{ padding: '22px 26px' }}>
          <p style={{ fontSize: 17, color: '#6b5c45', marginBottom: 20, lineHeight: 1.7 }}>
            La clôture de l'année est définitive. Toutes les données seront archivées et l'accès sera verrouillé.
            Assurez-vous que tous les bulletins ont été générés et validés avant de procéder.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={btnSec} onClick={() => onToast('Archivage en cours...', 'info')}>📦 Archiver l&apos;année</button>
            <button
              style={{ padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: '#fee2e2', color: '#dc2626', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => onToast('Clôture requiert confirmation', 'error')}>
              🔒 Clôturer l&apos;année 2025–2026
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecLight: React.CSSProperties = { padding: '7px 14px', borderRadius: 9, fontSize: 14, fontWeight: 700, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 20px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '15px 20px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
