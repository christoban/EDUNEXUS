'use client'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const CLASSES = [
  { name: '6e A',   badge: 'Collège', badgeBg: '#dbeafe', badgeC: '#1e40af', eleves: 45, matieres: 8,  pp: 'Jean Dupont',   avg: 92 },
  { name: '5e B',   badge: 'Collège', badgeBg: '#dbeafe', badgeC: '#1e40af', eleves: 42, matieres: 8,  pp: 'Marie Essomba', avg: 88 },
  { name: '4e C',   badge: 'Collège', badgeBg: '#dbeafe', badgeC: '#1e40af', eleves: 38, matieres: 9,  pp: 'Paul Ateba',    avg: 85 },
  { name: '3e A',   badge: 'BEPC',   badgeBg: '#ede9fe', badgeC: '#5b21b6', eleves: 40, matieres: 9,  pp: 'Sophie Kamga',  avg: 79 },
  { name: '2nde C', badge: 'Lycée',   badgeBg: '#ffedd5', badgeC: '#9a3412', eleves: 35, matieres: 10, pp: 'Thomas Nkomo',  avg: 83 },
  { name: 'Tle D',  badge: 'BAC',     badgeBg: '#fee2e2', badgeC: '#991b1b', eleves: 32, matieres: 10, pp: 'Alice Fouda',   avg: 87 },
]

const AVG_COLOR = (v: number) =>
  v >= 90 ? '#059669' : v >= 80 ? '#1d4ed8' : v >= 70 ? '#d97706' : '#dc2626'

export default function SectionClasses({ onToast }: Props) {
  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Classes</div>
          <div style={sSub}>6 classes · 245 élèves</div>
        </div>
        <button style={btnPrim} onClick={() => onToast('Création de classe...', 'info')}>+ Créer une classe</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
        {CLASSES.map((cls, i) => (
          <div key={i}
            style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 22, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)', borderColor: '#d4c8b8' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none', borderColor: '#e8e0d4' })}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 24, fontWeight: 700, color: '#1a1209' }}>{cls.name}</div>
              <span style={{ background: cls.badgeBg, color: cls.badgeC, padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>{cls.badge}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 16, color: '#6b5c45', fontWeight: 600, marginBottom: 12 }}>
              <span>👨‍🎓 <strong style={{ color: '#1a1209' }}>{cls.eleves}</strong> élèves</span>
              <span>📚 <strong style={{ color: '#1a1209' }}>{cls.matieres}</strong> matières</span>
            </div>
            <div style={{ fontSize: 15, color: '#a89478', fontWeight: 600, marginBottom: 14 }}>
              🧑‍💼 Prof. principal : <strong style={{ color: '#6b5c45' }}>{cls.pp}</strong>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: '#a89478', marginBottom: 6 }}>
                <span>Taux de présence</span>
                <span style={{ color: AVG_COLOR(cls.avg) }}>{cls.avg}%</span>
              </div>
              <div style={{ height: 8, background: '#e8e0d4', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${cls.avg}%`, background: AVG_COLOR(cls.avg), borderRadius: 8, transition: 'width 1s' }} />
              </div>
            </div>
            <div style={{ paddingTop: 12, borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                style={{ padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }}
                onClick={() => onToast(`Détails de ${cls.name}`, 'info')}>
                Voir détails →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
