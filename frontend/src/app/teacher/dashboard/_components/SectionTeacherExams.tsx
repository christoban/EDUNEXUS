'use client'
import { useState } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const EXAMS = [
  { title: 'DS Maths — Algèbre', sub: '18 questions · 60 min', classe: '6e A', type: 'Devoir', typeBg: '#dbeafe', typeC: '#1e40af', status: '▶ Actif', sBg: '#d1fae5', sC: '#065f46', date: '26/05/2026' },
  { title: 'Interrogation — Géométrie', sub: '10 questions · 30 min', classe: '4e C', type: 'Interrogation', typeBg: '#ede9fe', typeC: '#5b21b6', status: 'Brouillon', sBg: '#f1f5f9', sC: '#475569', date: '24/05/2026' },
]

export default function SectionTeacherExams({ onToast }: Props) {
  const [tab, setTab] = useState<'list' | 'create'>('list')

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Examens</div>
        <div style={sSub}>Créer et gérer vos examens manuels</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 1, background: '#f0ebe3', padding: 4, borderRadius: 11, marginBottom: 18, width: 'fit-content' }}>
        {([
          { id: 'list' as const, label: 'Mes examens' },
          { id: 'create' as const, label: '+ Créer un examen' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '8px 20px', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: tab === t.id ? 'white' : 'transparent', color: tab === t.id ? '#1a1209' : '#a89478', boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {tab === 'list' && (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid #e8e0d4' }}>
            <select style={filterSt}><option>Toutes classes</option><option>6e A</option><option>4e C</option></select>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Titre', 'Classe', 'Type', 'Statut', 'Créé le', 'Actions'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr></thead>
            <tbody>
              {EXAMS.map((exam, i) => (
                <tr key={i}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                  <td style={tdSt}>
                    <div style={{ fontWeight: 700, color: '#1a1209', fontSize: 17 }}>{exam.title}</div>
                    <div style={{ fontSize: 14, color: '#a89478', marginTop: 2 }}>{exam.sub}</div>
                  </td>
                  <td style={tdSt}>{exam.classe}</td>
                  <td style={tdSt}>
                    <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: exam.typeBg, color: exam.typeC }}>{exam.type}</span>
                  </td>
                  <td style={tdSt}>
                    <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: exam.sBg, color: exam.sC }}>{exam.status}</span>
                  </td>
                  <td style={tdSt}>{exam.date}</td>
                  <td style={tdSt}>
                    <button
                      style={{ background: 'none', border: '1.5px solid #d4c8b8', borderRadius: 9, padding: '6px 12px', cursor: 'pointer', fontSize: 16, color: '#6b5c45' }}
                      onClick={() => onToast(`Actions pour ${exam.title}`, 'info')}>⋯</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Créer */}
      {tab === 'create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
              <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>📋 Paramètres de l&apos;examen</span>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelSt}>Titre *</label>
                <input type="text" placeholder="DS de Mathématiques — Algèbre"
                  style={{ width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 10, fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', color: '#1a1209', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[
                  { label: 'Matière *', opts: ['Mathématiques'] },
                  { label: 'Classe *', opts: ['6e A', '5e B', '4e C', '3e A'] },
                  { label: 'Type *', opts: ['Devoir', 'Composition', 'Interrogation', 'BAC blanc'] },
                  { label: 'Durée (min) *', opts: ['30 min', '45 min', '60 min', '90 min', '120 min'] },
                ].map((s, i) => (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <label style={labelSt}>{s.label}</label>
                    <select style={{ width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 10, fontSize: 16, fontFamily: 'inherit', fontWeight: 600, outline: 'none', color: '#1a1209', cursor: 'pointer' }}>
                      {s.opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={labelSt}>Instructions (optionnel)</label>
                <textarea placeholder="Chapitres à couvrir, consignes particulières..."
                  style={{ width: '100%', padding: '11px 14px', background: '#f0ebe3', border: '1.5px solid #d4c8b8', borderRadius: 10, fontSize: 15, fontFamily: 'inherit', fontWeight: 600, outline: 'none', resize: 'vertical', minHeight: 90, color: '#1a1209', boxSizing: 'border-box' }} />
              </div>
              <button
                style={{ ...btnPrim, width: '100%', justifyContent: 'center' }}
                onClick={() => onToast('Examen créé avec succès', 'success')}>
                📋 Créer l&apos;examen
              </button>
            </div>
          </div>

          {/* Aperçu */}
          <div style={{ background: '#f0ebe3', borderRadius: 16, border: '2px dashed #d4c8b8', padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 60, marginBottom: 20 }}>📋</div>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: '#1a1209', marginBottom: 10 }}>
              Aperçu de l&apos;examen
            </div>
            <div style={{ fontSize: 16, color: '#a89478', fontWeight: 500, lineHeight: 1.7 }}>
              Remplissez le formulaire pour voir un aperçu de votre examen avant de le créer.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const labelSt: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: '#6b5c45', marginBottom: 6, display: 'block', letterSpacing: '0.5px', textTransform: 'uppercase' }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 8 }
const filterSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
