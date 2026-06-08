'use client'
import { useState } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const GRADES = [
  { name: 'Marie Ngono',    note: 14, obs: '',                   status: 'Brouillon',  statusBg: '#f1f5f9', statusColor: '#475569' },
  { name: 'Jean Kamga',     note: 16, obs: '',                   status: '✓ Validée',  statusBg: '#d1fae5', statusColor: '#065f46' },
  { name: 'Paul Biya',      note: 8,  obs: 'Manque de travail', status: 'En attente', statusBg: '#fef3c7', statusColor: '#92400e' },
  { name: 'Aminata Fouda',  note: 18, obs: '',                   status: '✕ Rejetée', statusBg: '#fee2e2', statusColor: '#991b1b' },
  { name: 'Bertrand Nkolo', note: 11, obs: '',                   status: 'Brouillon',  statusBg: '#f1f5f9', statusColor: '#475569' },
]

export default function SectionGrades({ onToast }: Props) {
  const [notes, setNotes] = useState(GRADES.map(g => g.note))

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Notes</div>
          <div style={sSub}>Saisie et validation des notes — Séquence 3</div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {[
            ['6e A', '5e B', '4e C', '3e A'],
            ['Mathématiques', 'Français', 'SVT', 'PC'],
            ['Séquence 3', 'Séquence 4', 'Séquence 1', 'Séquence 2'],
          ].map((opts, i) => (
            <select key={i} style={filterSelect}>
              {opts.map(o => <option key={o}>{o}</option>)}
            </select>
          ))}
          <button style={btnPrim}>Charger</button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Élève', 'Note /20', 'Observation', 'Statut'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {GRADES.map((grade, i) => (
              <tr key={i}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#1a1209' }}>{grade.name}</td>
                <td style={tdStyle}>
                  <input type="number" min={0} max={20}
                    value={notes[i]}
                    onChange={e => {
                      const arr = [...notes]
                      arr[i] = Number(e.target.value)
                      setNotes(arr)
                    }}
                    style={{ width: 80, padding: '7px 10px', border: '1.5px solid #d4c8b8', borderRadius: 9, fontSize: 17, fontWeight: 800, textAlign: 'center', fontFamily: 'inherit', outline: 'none', background: 'white', color: notes[i] < 10 ? '#dc2626' : '#1a1209' }}
                  />
                </td>
                <td style={tdStyle}>
                  <input type="text" defaultValue={grade.obs} placeholder="Observation..."
                    style={{ width: 260, padding: '7px 12px', border: '1.5px solid #d4c8b8', borderRadius: 9, fontSize: 16, fontFamily: 'inherit', outline: 'none', background: 'white', color: '#1a1209' }}
                  />
                </td>
                <td style={tdStyle}>
                  <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: grade.statusBg, color: grade.statusColor }}>
                    {grade.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '14px 20px', borderTop: '1px solid #e8e0d4', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button style={btnSec} onClick={() => onToast('Brouillon sauvegardé', 'info')}>💾 Sauvegarder brouillon</button>
          <button style={btnPrim} onClick={() => onToast('Notes soumises pour validation', 'success')}>📤 Soumettre pour validation</button>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const filterSelect: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
