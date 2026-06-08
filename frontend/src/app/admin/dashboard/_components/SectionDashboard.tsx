interface Props {
  onNav: (s: string) => void
  onInvite: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const ATTENDANCE = [
  { label: '6e A · 45 élèves', val: 97, color: '#059669' },
  { label: '5e B · 42 élèves', val: 91, color: '#1d4ed8' },
  { label: '4e C · 38 élèves', val: 86, color: '#d97706' },
  { label: '3e A · 40 élèves', val: 78, color: '#dc2626' },
  { label: 'Tle D · 32 élèves', val: 92, color: '#0d9488' },
]

const KPI = [
  { icon: '👨‍🎓', bg: '#dbeafe', val: '342', label: 'Élèves inscrits',  trend: '+12',    trendBg: '#d1fae5', trendColor: '#065f46', nav: 'users' },
  { icon: '✅',   bg: '#d1fae5', val: '94%', label: 'Taux de présence', trend: '94%',    trendBg: '#d1fae5', trendColor: '#065f46' },
  { icon: '📝',   bg: '#fef3c7', val: '87%', label: 'Notes validées',   trend: '4 att.', trendBg: '#fef3c7', trendColor: '#92400e', nav: 'grades' },
  { icon: '📱',   bg: '#ffedd5', val: '74%', label: 'Recouvrement',     trend: '89 imp.', trendBg: '#fee2e2', trendColor: '#991b1b', nav: 'finance' },
]

export default function SectionDashboard({ onNav, onInvite, onToast }: Props) {
  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }}>Vue d&apos;ensemble</div>
          <div style={{ fontSize: 17, color: '#a89478', marginTop: 3 }}>Trimestre 2 en cours · Séquence 3</div>
        </div>
        <button onClick={() => onToast('Tableau de bord actualisé', 'success')} style={btnSecSm}>🔄 Actualiser</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 22 }}>
        {KPI.map((k, i) => (
          <div key={i} onClick={() => k.nav && onNav(k.nav)}
            style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: '22px 26px', cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
            onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
            onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{k.icon}</div>
              <span style={{ fontSize: 14, fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: k.trendBg, color: k.trendColor }}>{k.trend}</span>
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 16, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* 2 colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        {/* Présence par classe */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>📊 Présence par classe</span>
          </div>
          <div style={{ padding: '18px 22px' }}>
            {ATTENDANCE.map((row, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1209' }}>{row.label}</span>
                  <span style={{ fontSize: 17, fontWeight: 800, color: row.color }}>{row.val}%</span>
                </div>
                <div style={{ height: 8, background: '#e8e0d4', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${row.val}%`, background: row.color, borderRadius: 8, transition: 'width 1s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions rapides */}
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid #e8e0d4' }}>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#1a1209' }}>⚡ Actions rapides</span>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '✅', label: 'Saisir les présences', nav: 'attendance' },
              { icon: '📝', label: 'Notes en attente',    nav: 'grades' },
              { icon: '📄', label: 'Générer bulletins',   nav: 'bulletins' },
              { icon: '👤', label: 'Inviter utilisateur', action: onInvite },
            ].map((btn, i) => (
              <button key={i}
                onClick={() => btn.action ? btn.action() : onNav(btn.nav!)}
                style={{ width: '100%', padding: '10px 20px', borderRadius: 10, fontSize: 16, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}
                onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#6b5c45' })}
              >
                <span>{btn.icon}</span> {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

const btnSecSm: React.CSSProperties = {
  padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800,
  background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8',
  cursor: 'pointer', fontFamily: 'inherit'
}
