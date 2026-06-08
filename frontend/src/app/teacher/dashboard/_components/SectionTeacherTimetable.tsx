interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi']
const TIMES = ['07:30', '08:30', '09:30', '10:30', '12:00', '13:00', '14:00']
const TIMES_END = ['08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00']

type SlotType = { subject: string; classe: string; mine: boolean } | null

const SLOTS: Record<string, SlotType> = {
  '0-0': { subject: 'Mathématiques', classe: '6e A', mine: true },
  '0-1': { subject: 'Physique-Chimie', classe: '5e B', mine: false },
  '1-2': { subject: 'Mathématiques', classe: '4e C', mine: true },
  '2-0': { subject: 'Mathématiques', classe: '5e B', mine: true },
  '2-3': { subject: 'Français', classe: '6e A', mine: false },
  '3-4': { subject: 'Mathématiques', classe: '3e A', mine: true },
  '4-1': { subject: 'Mathématiques', classe: '6e A', mine: true },
  '4-5': { subject: 'SVT', classe: '4e C', mine: false },
}

export default function SectionTeacherTimetable({ onToast }: Props) {
  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Mon emploi du temps</div>
          <div style={sSub}>Semaine du 26 au 30 Mai 2026</div>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#059669' }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: '#d1fae5', border: '2px solid #059669' }} />
            Mes cours
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#a89478' }}>
            <div style={{ width: 14, height: 14, borderRadius: 4, background: '#f0ebe3', border: '2px solid #d4c8b8' }} />
            Autres
          </span>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 100 }}>Horaire</th>
                {DAYS.map(d => <th key={d} style={thSt}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((time, ti) => (
                <tr key={ti}>
                  <td style={{ padding: '10px 11px', background: '#f0ebe3', fontSize: 13, fontWeight: 800, color: '#a89478', textAlign: 'center', border: '1px solid #e8e0d4', whiteSpace: 'nowrap' }}>
                    {time}<br /><span style={{ fontSize: 11, color: '#d4c8b8' }}>{TIMES_END[ti]}</span>
                  </td>
                  {DAYS.map((_, di) => {
                    const slot = SLOTS[`${di}-${ti}`]
                    return (
                      <td key={di} style={{ padding: 0, border: '1px solid #e8e0d4', verticalAlign: 'top', minWidth: 140, height: 76 }}>
                        {slot ? (
                          <div
                            style={{
                              padding: 10, height: '100%', cursor: slot.mine ? 'pointer' : 'default',
                              background: slot.mine
                                ? 'linear-gradient(135deg,rgba(5,150,105,0.1),rgba(5,150,105,0.05))'
                                : 'rgba(0,0,0,0.02)',
                              borderLeft: slot.mine ? '3px solid #059669' : 'none',
                              opacity: slot.mine ? 1 : 0.5
                            }}
                            onClick={() => slot.mine && onToast(`${slot.subject} — ${slot.classe}`, 'info')}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: slot.mine ? '#047857' : '#6b5c45' }}>{slot.subject}</div>
                            <div style={{ fontSize: 12, color: '#a89478', marginTop: 3 }}>{slot.classe}</div>
                          </div>
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d4c8b8', fontSize: 20 }}>·</div>
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
const thSt: React.CSSProperties = { padding: '11px 10px', textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', border: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.5px' }
