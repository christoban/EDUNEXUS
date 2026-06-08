'use client'
import { useState } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const SUBJECTS = [
  { name: 'Mathématiques',                    code: 'MATH', coeff: 4, heures: 4, type: 'Cours magistral', enseignants: 2 },
  { name: 'Français / Littérature',            code: 'FR',   coeff: 4, heures: 4, type: 'Cours magistral', enseignants: 1 },
  { name: 'Sciences de la Vie et de la Terre', code: 'SVT',  coeff: 3, heures: 3, type: 'Cours magistral', enseignants: 1 },
  { name: 'Physique-Chimie',                   code: 'PC',   coeff: 3, heures: 3, type: 'TP + Cours',      enseignants: 2 },
  { name: 'Histoire-Géographie',               code: 'HG',   coeff: 2, heures: 2, type: 'Cours magistral', enseignants: 1 },
  { name: 'Éducation Physique & Sport',        code: 'EPS',  coeff: 1, heures: 2, type: 'Pratique',        enseignants: 1 },
  { name: 'Anglais',                           code: 'ANG',  coeff: 3, heures: 3, type: 'Cours magistral', enseignants: 1 },
]

export default function SectionSubjects({ onToast }: Props) {
  const [openDD, setOpenDD] = useState<number | null>(null)

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Matières</div>
          <div style={sSub}>7 matières configurées · Système MINESEC</div>
        </div>
        <button style={btnPrim} onClick={() => onToast('Création de matière...', 'info')}>+ Créer une matière</button>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px', flex: 1 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <input placeholder="Rechercher une matière..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Matière', 'Code', 'Coefficient', 'H/semaine', 'Type', 'Enseignants', 'Actions'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {SUBJECTS.map((sub, i) => (
              <tr key={i}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 700, color: '#1a1209', fontSize: 17 }}>{sub.name}</div>
                </td>
                <td style={tdStyle}>
                  <code style={{ background: '#f0ebe3', padding: '3px 9px', borderRadius: 7, fontSize: 14 }}>{sub.code}</code>
                </td>
                <td style={tdStyle}>
                  <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 900 }}>×{sub.coeff}</span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>{sub.heures}h</td>
                <td style={tdStyle}>{sub.type}</td>
                <td style={tdStyle}>
                  <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                    {sub.enseignants} assigné{sub.enseignants > 1 ? 's' : ''}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button onClick={() => setOpenDD(openDD === i ? null : i)}
                      style={{ background: 'none', border: '1.5px solid #d4c8b8', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 16, color: '#a89478', transition: 'all 0.12s' }}
                      onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669', background: '#d1fae5' })}
                      onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#a89478', background: 'none' })}>
                      ⋯
                    </button>
                    {openDD === i && (
                      <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 210, zIndex: 100, overflow: 'hidden' }}>
                        {[
                          { icon: '📊', label: 'Coefficients BAC',    danger: false },
                          { icon: '👥', label: 'Assigner enseignant', danger: false },
                          { icon: '✏️', label: 'Modifier',            danger: false },
                          { icon: '🗑',  label: 'Supprimer',           danger: true  },
                        ].map((item, j) => (
                          <div key={j} onClick={() => { setOpenDD(null); onToast(`${item.label} : ${sub.name}`, item.danger ? 'error' : 'info') }}
                            style={{ padding: '11px 16px', fontSize: 16, fontWeight: 600, color: item.danger ? '#dc2626' : '#6b5c45', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.danger ? '#fee2e2' : '#f0ebe3'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                            {item.icon} {item.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
