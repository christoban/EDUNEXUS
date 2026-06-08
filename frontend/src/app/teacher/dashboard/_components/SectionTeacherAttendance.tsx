'use client'
import { useState } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

type AttStatus = 'P' | 'A' | 'R' | 'E' | null

const STUDENTS = [
  'Marie Ngono', 'Jean Kamga', 'Paul Biya', 'Aminata Fouda',
  'Bertrand Nkolo', 'Sophie Ateba', 'Patrick Essomba', 'Claire Mbida',
]

const ATT_STYLE: Record<'P'|'A'|'R'|'E', { selBg: string; selBorder: string; selColor: string; label: string; title: string }> = {
  P: { selBg: '#d1fae5', selBorder: '#059669', selColor: '#065f46', label: '✓', title: 'Présent' },
  A: { selBg: '#fee2e2', selBorder: '#dc2626', selColor: '#991b1b', label: '✗', title: 'Absent' },
  R: { selBg: '#fef3c7', selBorder: '#d97706', selColor: '#92400e', label: '~', title: 'Retard' },
  E: { selBg: '#dbeafe', selBorder: '#1d4ed8', selColor: '#1e40af', label: 'E', title: 'Excusé' },
}

export default function SectionTeacherAttendance({ onToast }: Props) {
  const [statuses, setStatuses] = useState<Record<number, AttStatus>>({})

  const toggle = (i: number, s: AttStatus) =>
    setStatuses(p => ({ ...p, [i]: p[i] === s ? null : s }))

  const counts = { P: 0, A: 0, R: 0, E: 0 }
  Object.values(statuses).forEach(s => { if (s) counts[s]++ })

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Présences</div>
          <div style={sSub}>Saisie rapide par classe · Aujourd&apos;hui</div>
        </div>
        <button style={btnPrim} onClick={() => onToast('Présences sauvegardées', 'success')}>💾 Sauvegarder</button>
      </div>

      {/* Filtres */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '14px 22px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={filterSt}><option>6e A</option><option>5e B</option><option>4e C</option><option>3e A</option></select>
        <select style={filterSt}><option>Mathématiques</option></select>
        <select style={filterSt}><option>Vendredi 29/05/2026 — 07:30</option></select>
        <button style={btnPrim}>Charger</button>
      </div>

      {/* Stats rapides */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
        {[
          { label: 'Présents', count: counts.P, bg: '#d1fae5', color: '#065f46' },
          { label: 'Absents',  count: counts.A, bg: '#fee2e2', color: '#991b1b' },
          { label: 'Retards',  count: counts.R, bg: '#fef3c7', color: '#92400e' },
          { label: 'Excusés',  count: counts.E, bg: '#dbeafe', color: '#1e40af' },
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: s.bg, borderRadius: 13, padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.color, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table présences */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
        <div style={{ padding: '12px 22px', borderBottom: '1px solid #e8e0d4' }}>
          <button
            style={{ fontSize: 15, fontWeight: 800, color: '#059669', border: '1.5px solid rgba(5,150,105,0.3)', background: '#d1fae5', cursor: 'pointer', padding: '7px 16px', borderRadius: 10, fontFamily: 'inherit' }}
            onClick={() => setStatuses(Object.fromEntries(STUDENTS.map((_, i) => [i, 'P' as AttStatus])))}>
            ✓ Tous présents
          </button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thSt}>N°</th>
              <th style={thSt}>Élève</th>
              {(['P', 'A', 'R', 'E'] as const).map(s => (
                <th key={s} style={{ ...thSt, textAlign: 'center' }}>{ATT_STYLE[s].title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STUDENTS.map((name, i) => (
              <tr key={i}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                <td style={{ ...tdSt, color: '#a89478', width: 44 }}>{i + 1}</td>
                <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>{name}</td>
                {(['P', 'A', 'R', 'E'] as const).map(s => {
                  const sel = statuses[i] === s
                  const st = ATT_STYLE[s]
                  return (
                    <td key={s} style={{ ...tdSt, textAlign: 'center' }}>
                      <button
                        onClick={() => toggle(i, s)}
                        title={st.title}
                        style={{
                          width: 36, height: 36, borderRadius: 9, fontSize: 17,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800,
                          border: `1.5px solid ${sel ? st.selBorder : '#d4c8b8'}`,
                          background: sel ? st.selBg : 'white',
                          color: sel ? st.selColor : '#a89478',
                          transition: 'all 0.1s'
                        }}>
                        {st.label}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #e8e0d4', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button style={btnSec} onClick={() => onToast('Brouillon sauvegardé', 'info')}>💾 Brouillon</button>
          <button style={btnPrim} onClick={() => onToast('Présences validées pour 6e A', 'success')}>✅ Valider les présences</button>
        </div>
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
