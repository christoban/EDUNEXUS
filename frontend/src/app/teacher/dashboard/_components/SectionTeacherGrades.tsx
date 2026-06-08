'use client'
import { useState } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const GRADES_DATA = [
  { num: 1, name: 'Marie Ngono',    note: 15.5, obs: '',                   status: 'Brouillon', sBg: '#f1f5f9', sC: '#475569' },
  { num: 2, name: 'Jean Kamga',     note: 12,   obs: '',                   status: 'Brouillon', sBg: '#f1f5f9', sC: '#475569' },
  { num: 3, name: 'Paul Kamga',     note: 7.5,  obs: 'Manque de travail', status: 'Brouillon', sBg: '#f1f5f9', sC: '#475569' },
  { num: 4, name: 'Aminata Fouda',  note: 18,   obs: 'Excellent travail', status: 'Soumis',    sBg: '#fef3c7', sC: '#92400e' },
  { num: 5, name: 'Bertrand Nkolo', note: 11,   obs: '',                   status: 'Brouillon', sBg: '#f1f5f9', sC: '#475569' },
]

export default function SectionTeacherGrades({ onToast }: Props) {
  const [notes, setNotes] = useState(GRADES_DATA.map(g => g.note))

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Notes</div>
          <div style={sSub}>Saisie et soumission des notes</div>
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{ background: '#f0ebe3', borderRadius: 12, padding: '14px 18px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#6b5c45', marginBottom: 8 }}>
          <span>4e C — Mathématiques — Séquence 3</span>
          <span style={{ color: '#059669' }}>30/38 validées (79%)</span>
        </div>
        <div style={{ height: 8, background: '#d4c8b8', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: '79%', background: '#059669', borderRadius: 8, transition: 'width 1s' }} />
        </div>
      </div>

      {/* Filtres + table */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select style={filterSt}><option>4e C</option><option>6e A</option><option>5e B</option><option>3e A</option></select>
          <select style={filterSt}><option>Mathématiques</option></select>
          <select style={filterSt}><option>Séquence 3</option><option>Séquence 4</option></select>
          <button style={btnPrim}>Charger</button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['N°', 'Élève', 'Note /20', 'Observation', 'Statut'].map(h => (
              <th key={h} style={thSt}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {GRADES_DATA.map((g, i) => (
              <tr key={i}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                <td style={{ ...tdSt, color: '#a89478', width: 44 }}>{g.num}</td>
                <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{g.name}</td>
                <td style={tdSt}>
                  <input type="number" min={0} max={20} step={0.25}
                    value={notes[i]}
                    onChange={e => { const a = [...notes]; a[i] = Number(e.target.value); setNotes(a) }}
                    style={{ width: 80, padding: '7px 10px', border: '1.5px solid #d4c8b8', borderRadius: 9, fontSize: 17, fontWeight: 800, textAlign: 'center', fontFamily: 'inherit', outline: 'none', background: 'white', color: notes[i] < 10 ? '#dc2626' : notes[i] >= 16 ? '#059669' : '#1a1209' }}
                  />
                </td>
                <td style={tdSt}>
                  <input type="text" defaultValue={g.obs} placeholder="Observation..."
                    style={{ width: 240, padding: '7px 12px', border: '1.5px solid #d4c8b8', borderRadius: 9, fontSize: 16, fontFamily: 'inherit', outline: 'none', background: 'white', color: '#1a1209' }}
                  />
                </td>
                <td style={tdSt}>
                  <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: g.sBg, color: g.sC }}>
                    {g.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <span style={{ fontSize: 15, color: '#a89478', fontWeight: 600 }}>3 notes en brouillon · 1 soumise</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnSec} onClick={() => onToast('Brouillon sauvegardé', 'info')}>💾 Brouillon</button>
            <button style={btnPrim} onClick={() => onToast('Notes soumises pour validation', 'success')}>📤 Soumettre pour validation</button>
          </div>
        </div>
      </div>

      {/* Note rejetée */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid rgba(220,38,38,0.3)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 22px', background: '#fef2f2', borderBottom: '1px solid rgba(220,38,38,0.15)' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#dc2626' }}>✕ Note rejetée — 5e B</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Élève', 'Note', 'Motif du rejet', 'Actions'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr></thead>
          <tbody>
            <tr>
              <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>Sophie Kamga</td>
              <td style={{ ...tdSt, fontWeight: 800, color: '#dc2626' }}>22/20</td>
              <td style={{ ...tdSt, color: '#dc2626', fontWeight: 700 }}>Note invalide — dépasse 20</td>
              <td style={tdSt}>
                <button
                  style={{ padding: '7px 14px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#fef3c7', color: '#d97706', border: '1px solid rgba(217,119,6,0.3)', cursor: 'pointer', fontFamily: 'inherit' }}
                  onClick={() => onToast('Formulaire pré-rempli pour correction', 'info')}>
                  ✏️ Corriger et resoumettre
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
