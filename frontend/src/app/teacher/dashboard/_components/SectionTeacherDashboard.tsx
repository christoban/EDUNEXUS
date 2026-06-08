interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const KPI = [
  { icon: '🏫', bg: '#d1fae5', val: '4',   label: 'Classes assignées',  trend: '2025–2026',    tBg: '#d1fae5', tC: '#065f46' },
  { icon: '👨‍🎓', bg: '#dbeafe', val: '156', label: 'Élèves au total',    trend: '+8',            tBg: '#d1fae5', tC: '#065f46' },
  { icon: '📝', bg: '#fef3c7', val: '4',   label: 'Notes en attente',   trend: '⚠️ Urgent',     tBg: '#fef3c7', tC: '#92400e', nav: 'grades' },
  { icon: '✅', bg: '#d1fae5', val: '96%', label: 'Taux de présence',   trend: 'Ce trimestre', tBg: '#d1fae5', tC: '#065f46', nav: 'attendance' },
]

const TODAY = [
  { time: '07:30–08:30', classe: '6e A', subject: 'Mathématiques', salle: 'Salle 12', eleves: 45 },
  { time: '10:30–11:30', classe: '4e C', subject: 'Mathématiques', salle: 'Salle 7',  eleves: 38 },
  { time: '13:00–14:00', classe: '3e A', subject: 'Mathématiques', salle: 'Salle 3',  eleves: 40 },
]

const ALERTS = [
  { level: 'high',   icon: '🚨', title: '4 notes rejetées',            sub: '5e B — Valeur invalide',           nav: 'grades' },
  { level: 'medium', icon: '⚠️', title: 'Conseil de classe demain',    sub: '3e A — 14h00 · Salle des profs' },
  { level: 'medium', icon: '📊', title: '6 élèves absents aujourd\'hui', sub: 'Présences à valider',               nav: 'attendance' },
]

export default function SectionTeacherDashboard({ onNav, onToast }: Props) {
  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Bonjour, Jean 👋</div>
          <div style={sSub}>Vendredi 29 Mai 2026 · Trimestre 2 · Séquence 3</div>
        </div>
        <button style={btnSec} onClick={() => onToast('Actualisation...', 'info')}>🔄 Actualiser</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
        {KPI.map((k, i) => (
          <div key={i}
            onClick={() => k.nav && onNav(k.nav)}
            style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px', cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
            onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
              <span style={{ fontSize: 14, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: k.tBg, color: k.tC }}>{k.trend}</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 16, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* 2 colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Cours aujourd'hui */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>📅 Mes cours aujourd&apos;hui</span>
            <button style={btnSecSm} onClick={() => onNav('timetable')}>Voir EDT complet</button>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TODAY.map((c, i) => (
              <div key={i}
                style={{ background: '#f7f3ee', borderRadius: 14, border: '1.5px solid #e8e0d4', padding: '16px 18px', cursor: 'pointer', transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', boxShadow: '0 3px 10px rgba(0,0,0,0.06)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#e8e0d4', boxShadow: 'none' })}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#a89478' }}>{c.time}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: '#dbeafe', color: '#1e40af' }}>{c.classe}</span>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1209', marginBottom: 8 }}>{c.subject}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 15, color: '#a89478', fontWeight: 600 }}>
                  <span>📍 {c.salle}</span>
                  <span>👥 {c.eleves} élèves</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertes */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>🔔 Alertes &amp; actions</span>
          </div>
          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ALERTS.map((a, i) => (
              <div key={i}
                onClick={() => a.nav && onNav(a.nav)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 12, border: '1.5px solid', cursor: a.nav ? 'pointer' : 'default', transition: 'all 0.12s', background: a.level === 'high' ? '#fef2f2' : '#fef3c7', borderColor: a.level === 'high' ? 'rgba(220,38,38,0.2)' : 'rgba(217,119,6,0.2)' }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: a.level === 'high' ? '#991b1b' : '#92400e' }}>{a.title}</div>
                  <div style={{ fontSize: 15, color: a.level === 'high' ? '#dc2626' : '#d97706', fontWeight: 500, marginTop: 3 }}>{a.sub}</div>
                </div>
              </div>
            ))}

            {/* Actions rapides */}
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' })}
                onClick={() => onNav('attendance')}>
                ✅ Saisir les présences du jour
              </button>
              <button style={{ width: '100%', padding: '10px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' })}
                onClick={() => onNav('grades')}>
                📝 Saisir les notes en attente
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '6px 12px', borderRadius: 9, fontSize: 14, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
