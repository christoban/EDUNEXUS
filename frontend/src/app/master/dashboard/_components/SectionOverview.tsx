import Badge from './Badge'
import type { KpiData, ActivityRow } from '../_types'

interface Props {
  kpi: KpiData
  activity: ActivityRow[]
  onInvite: () => void
  onGoToSchools: (tab?: string) => void
  onGoToLogs: () => void
}

export default function SectionOverview({ kpi, activity, onInvite, onGoToSchools, onGoToLogs }: Props) {
  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 33, fontWeight: 700, color: '#1a1209' }}>
            Vue d&apos;ensemble
          </div>
          <div style={{ fontSize: 17, color: '#a89478', marginTop: 2 }}>
            Tableau de bord global — {kpi.totalSchools} établissements
          </div>
        </div>
        <button onClick={onInvite} style={btnPrimary}>+ Inviter une école</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 18, marginBottom: 29 }}>
        <KpiCard icon="🏫" bg="#d1fae5" val={String(kpi.activeSchools)} label="Écoles actives" sub={`dont ${kpi.suspendedCount} suspendue${kpi.suspendedCount > 1 ? 's' : ''}`} trend={kpi.activeSchools > 0 ? `+${kpi.activeSchools}` : '0'} trendBg="#d1fae5" trendColor="#065f46" onClick={() => onGoToSchools('active')} />
        <KpiCard icon="⏳" bg="#fef3c7" val={String(kpi.pendingSchools)} label="En attente d'approbation" trend="Urgent" trendBg="#fef3c7" trendColor="#92400e" onClick={() => onGoToSchools('pending')} />
        <KpiCard icon="✉️" bg="#dbeafe" val={String(kpi.pendingInvites)} label="Invitations en cours" sub="statut PENDING" trend={kpi.pendingInvites > 0 ? `${kpi.pendingInvites} en attente` : '0'} trendBg={kpi.pendingInvites > 0 ? '#fef3c7' : '#d1fae5'} trendColor={kpi.pendingInvites > 0 ? '#92400e' : '#065f46'} />
        <KpiCard icon="🆕" bg="#ede9fe" val={String(kpi.newThisMonth)} label="Nouveaux ce mois" sub="30 derniers jours" trend={kpi.newThisMonth > 0 ? `+${kpi.newThisMonth}` : '0'} trendBg="#d1fae5" trendColor="#065f46" />
      </div>

      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1a1209' }}>🕐 Activité récente</span>
          <button onClick={onGoToLogs} style={btnSecondarySmall}>Voir tous les logs →</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date / Heure', 'Action', 'École concernée', 'Opérateur'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 15, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activity.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '20px 16px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>Aucune activité récente</td></tr>
            ) : activity.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < activity.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                <td style={tdStyle}>{row.date}</td>
                <td style={tdStyle}><Badge type={row.badge}>{row.action}</Badge></td>
                <td style={tdStyle}><span style={{ fontWeight: 700, color: '#1a1209' }}>{row.school}</span></td>
                <td style={tdStyle}>{row.operator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ icon, bg, val, label, sub, trend, trendBg, trendColor, onClick }: {
  icon: string; bg: string; val: string; label: string; sub?: string; trend: string; trendBg: string; trendColor: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick}
      style={{
        background: 'white', borderRadius: 14, padding: '34px 22px',
        border: '1.5px solid #e8e0d4', cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s', position: 'relative', overflow: 'hidden'
      }}
      onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.07)', borderColor: '#d4c8b8' })}
      onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none', borderColor: '#e8e0d4' })}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
          {icon}
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: trendBg, color: trendColor }}>
          {trend}
        </span>
      </div>
      <div style={{ fontSize: 39, fontWeight: 900, color: '#1a1209', lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 16, color: '#a89478', marginTop: 5, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 14, color: '#a89478', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '12px 20px', borderRadius: 13, fontSize: 18, fontWeight: 800,
  background: 'linear-gradient(135deg,#059669,#047857)', color: 'white',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 3px 12px rgba(5,150,105,0.25)', display: 'inline-flex', alignItems: 'center', gap: 7
}
const btnSecondarySmall: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 12, fontSize: 17, fontWeight: 800,
  background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8',
  cursor: 'pointer', fontFamily: 'inherit'
}
const tdStyle: React.CSSProperties = { padding: '13px 16px', fontSize: 17, color: '#6b5c45', verticalAlign: 'middle' }
