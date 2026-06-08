'use client'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
const TIMES = ['07:30–08:30', '08:30–09:30', '09:30–10:30', '10:30–11:30', '12:00–13:00', '13:00–14:00', '14:00–15:00']

type Slot = { subject: string; teacher: string } | null

const SLOTS: Record<string, Slot> = {
  '0-0': { subject: 'Mathématiques',   teacher: 'M. Dupont'   },
  '0-1': { subject: 'Français',        teacher: 'Mme Essomba' },
  '1-0': { subject: 'SVT',             teacher: 'M. Ateba'    },
  '1-2': { subject: 'Physique-Chimie', teacher: 'M. Nkomo'    },
  '2-1': { subject: 'Anglais',         teacher: 'Mme Fouda'   },
  '2-3': { subject: 'Histoire-Géo',    teacher: 'M. Kamga'    },
  '3-0': { subject: 'EPS',             teacher: 'M. Bello'    },
  '3-4': { subject: 'Mathématiques',   teacher: 'M. Dupont'   },
  '4-2': { subject: 'Français',        teacher: 'Mme Essomba' },
  '4-5': { subject: 'SVT',             teacher: 'M. Ateba'    },
}

export default function SectionTimetable({ onToast }: Props) {
  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Emploi du temps</div>
          <div style={sSub}>Gestion des créneaux horaires</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select style={selectSt}>
            <option>6e A</option><option>5e B</option><option>4e A</option>
          </select>
          <button style={btnSec} onClick={() => onToast('Créneau ajouté', 'info')}>+ Créneau</button>
          <button style={btnPrim} onClick={() => onToast('Emploi du temps publié !', 'success')}>📤 Publier</button>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 130 }}>Horaire</th>
                {DAYS.map(d => <th key={d} style={thSt}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((time, ti) => (
                <tr key={ti}>
                  <td style={{ padding: '10px 12px', background: '#f0ebe3', fontSize: 14, fontWeight: 800, color: '#a89478', textAlign: 'center', border: '1px solid #e8e0d4', whiteSpace: 'nowrap' }}>
                    {time}
                  </td>
                  {DAYS.map((_, di) => {
                    const slot = SLOTS[`${di}-${ti}`]
                    return (
                      <td key={di} style={{ padding: 0, border: '1px solid #e8e0d4', verticalAlign: 'top', minWidth: 140, height: 76 }}>
                        {slot ? (
                          <div
                            style={{ padding: 11, height: '100%', background: 'linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.04))', borderLeft: '3px solid #059669', cursor: 'pointer', boxSizing: 'border-box' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg,rgba(5,150,105,0.14),rgba(5,150,105,0.08))'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.04))'}
                            onClick={() => onToast(`${slot.subject} — ${slot.teacher}`, 'info')}
                          >
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#047857' }}>{slot.subject}</div>
                            <div style={{ fontSize: 13, color: '#a89478', marginTop: 3 }}>{slot.teacher}</div>
                          </div>
                        ) : (
                          <div
                            onClick={() => onToast('Ajouter un créneau', 'info')}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', cursor: 'pointer', color: '#d4c8b8', fontSize: 24, fontWeight: 300 }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f0ebe3'; (e.currentTarget as HTMLElement).style.color = '#a89478' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; (e.currentTarget as HTMLElement).style.color = '#d4c8b8' }}
                          >
                            +
                          </div>
                        )}
                      </td>
                    )
                  })}
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
const btnPrim: React.CSSProperties = { padding: '10px 18px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '9px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const selectSt: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 10px', textAlign: 'center', fontSize: 14, fontWeight: 800, color: '#a89478', background: '#f0ebe3', border: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.5px' }
