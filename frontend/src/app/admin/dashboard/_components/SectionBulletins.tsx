'use client'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const BULLETINS = [
  { name: 'Marie Ngono',   avg: 14.2, rang: '🥇 1er',    mention: 'Bien',        mBg: '#d1fae5', mC: '#065f46' },
  { name: 'Aminata Fouda', avg: 16.5, rang: '🏆 1er ex', mention: 'Très Bien',   mBg: '#ccfbf1', mC: '#134e4a' },
  { name: 'Jean Kamga',    avg: 12.8, rang: '3e',         mention: 'Assez Bien',  mBg: '#dbeafe', mC: '#1e40af' },
  { name: 'Paul Biya',     avg: 8.4,  rang: '12e',        mention: 'Insuffisant', mBg: '#fee2e2', mC: '#991b1b' },
]

const CHECKS = [
  { warn: false, title: 'Notes : 100% validées',        sub: '45 notes · toutes en statut VALIDATED' },
  { warn: false, title: 'Présences : complètes',        sub: 'Tous les créneaux saisis' },
  { warn: true,  title: 'Formule de calcul : vérifier', sub: 'Coefficients BAC non configurés' },
]

export default function SectionBulletins({ onToast }: Props) {
  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Bulletins</div>
        <div style={sSub}>Génération et distribution</div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '14px 20px', marginBottom: 18, display: 'flex', gap: 10 }}>
        <select style={selectSt}><option>Trimestre 2</option><option>Trimestre 1</option><option>Trimestre 3</option></select>
        <select style={selectSt}><option>6e A</option><option>5e B</option></select>
        <button style={btnPrim}>Charger</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Pré-vérification */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>🔍 Pré-vérification — 6e A</span>
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {CHECKS.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: c.warn ? '#fef3c7' : '#d1fae5', borderRadius: 11 }}>
                <span style={{ fontSize: 22 }}>{c.warn ? '⚠️' : '✅'}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: c.warn ? '#92400e' : '#065f46' }}>{c.title}</div>
                  <div style={{ fontSize: 14, color: c.warn ? '#92400e' : '#065f46', marginTop: 2 }}>{c.sub}</div>
                </div>
              </div>
            ))}
            <button style={{ ...btnPrim, marginTop: 4 }} onClick={() => onToast('Génération des bulletins en cours... (0/45)', 'info')}>
              📄 Générer les bulletins →
            </button>
          </div>
        </div>

        {/* Bulletins générés */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>📊 Bulletins générés</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnSec} onClick={() => onToast('ZIP téléchargé', 'success')}>📦 Exporter ZIP</button>
              <button style={btnSec} onClick={() => onToast('Envoi aux parents en cours...', 'info')}>📤 Envoyer aux parents</button>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Élève', 'Moy. gén.', 'Rang', 'Mention', 'Actions'].map(h => <th key={h} style={thSt}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {BULLETINS.map((b, i) => (
                <tr key={i}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                  <td style={tdSt}><strong style={{ color: '#1a1209' }}>{b.name}</strong></td>
                  <td style={tdSt}><strong style={{ color: b.avg < 10 ? '#dc2626' : '#059669', fontSize: 18 }}>{b.avg}</strong></td>
                  <td style={tdSt}>{b.rang}</td>
                  <td style={tdSt}>
                    <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: b.mBg, color: b.mC }}>{b.mention}</span>
                  </td>
                  <td style={tdSt}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={btnSec} onClick={() => onToast(`PDF ${b.name}`, 'info')}>👁 PDF</button>
                      <button style={btnSec} onClick={() => onToast(`Envoyé à ${b.name}`, 'success')}>📤</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
