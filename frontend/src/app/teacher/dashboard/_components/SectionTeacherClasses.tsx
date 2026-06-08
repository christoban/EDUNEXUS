interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const CLASSES = [
  { name: '6e A', eleves: 45, matieres: ['Mathématiques'], moyClass: 13.2, tauxPresence: 97, pp: true  },
  { name: '5e B', eleves: 42, matieres: ['Mathématiques'], moyClass: 11.8, tauxPresence: 91, pp: false },
  { name: '4e C', eleves: 38, matieres: ['Mathématiques'], moyClass: 12.5, tauxPresence: 86, pp: true  },
  { name: '3e A', eleves: 40, matieres: ['Mathématiques'], moyClass: 14.1, tauxPresence: 78, pp: false },
]

const MOY_COLOR = (v: number) => v >= 14 ? '#059669' : v >= 10 ? '#1d4ed8' : '#dc2626'

export default function SectionTeacherClasses({ onNav, onToast }: Props) {
  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Mes classes</div>
        <div style={sSub}>4 classes · 165 élèves au total</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 18 }}>
        {CLASSES.map((cls, i) => (
          <div key={i}
            style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 26, cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)', borderColor: '#d4c8b8' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none', borderColor: '#e8e0d4' })}>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 33, fontWeight: 700, color: '#1a1209' }}>{cls.name}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {cls.pp && (
                  <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800 }}>
                    Prof. Principal
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 22, fontSize: 17, fontWeight: 600, color: '#6b5c45', marginBottom: 18 }}>
              <span>👥 <strong style={{ color: '#1a1209' }}>{cls.eleves}</strong> élèves</span>
              <span>📚 <strong style={{ color: '#1a1209' }}>{cls.matieres.length}</strong> matière{cls.matieres.length > 1 ? 's' : ''}</span>
            </div>

            {/* Stats boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
              <div style={{ background: '#f0ebe3', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#a89478', marginBottom: 6 }}>Moyenne classe</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: MOY_COLOR(cls.moyClass) }}>{cls.moyClass.toFixed(1)}<span style={{ fontSize: 16, fontWeight: 600, color: '#a89478' }}>/20</span></div>
              </div>
              <div style={{ background: '#f0ebe3', borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#a89478', marginBottom: 6 }}>Présence</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: cls.tauxPresence >= 90 ? '#059669' : '#d97706' }}>{cls.tauxPresence}%</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ flex: 1, padding: '9px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' })}
                onClick={() => onNav('attendance')}>✅ Présences</button>
              <button
                style={{ flex: 1, padding: '9px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' })}
                onClick={() => onNav('grades')}>📝 Notes</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
