'use client'
import { useState } from 'react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const TABS = [
  { label: 'Tous',        count: '342' },
  { label: 'Enseignants', count: '28'  },
  { label: 'Élèves',      count: '280' },
  { label: 'Parents',     count: '186' },
  { label: 'Personnel',   count: '8'   },
]

const USERS = [
  { name: 'Marie Ngono',    email: 'marie.ngono@test.cm',   role: 'Élève',      roleBg: '#ccfbf1', roleColor: '#134e4a', status: 'Actif',  lastLogin: "Aujourd'hui 09:14", classe: '6e A' },
  { name: 'Jean Dupont',    email: 'jean.dupont@test.cm',   role: 'Enseignant', roleBg: '#dbeafe', roleColor: '#1e40af', status: 'Actif',  lastLogin: 'Hier 16:30',        classe: null  },
  { name: 'Paul Ngono',     email: 'parent.ngono@test.cm',  role: 'Parent',     roleBg: '#fef3c7', roleColor: '#92400e', status: 'Actif',  lastLogin: '29/05 08:45',       classe: null  },
  { name: 'Pierre Censeur', email: 'censeur@test.cm',       role: 'Personnel',  roleBg: '#ffedd5', roleColor: '#9a3412', status: 'Actif',  lastLogin: '29/05 11:00',       classe: null  },
  { name: 'Sophie Kamga',   email: 'sophie@test.cm',        role: 'Élève',      roleBg: '#ccfbf1', roleColor: '#134e4a', status: 'Invité', lastLogin: 'Jamais connecté',   classe: '5e B' },
]

export default function SectionUsers({ onToast }: Props) {
  const [activeTab, setActiveTab] = useState(0)
  const [openDD, setOpenDD] = useState<number | null>(null)

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
        <div>
          <div style={sTitle}>Utilisateurs</div>
          <div style={sSub}>342 comptes actifs</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnSecSm} onClick={() => onToast('Import CSV en cours...', 'info')}>📥 Importer CSV</button>
          <button style={btnSecSm} onClick={() => onToast('CSV exporté', 'success')}>📤 Exporter CSV</button>
          <button style={btnPrim} onClick={() => onToast('Modal invitation ouverte', 'info')}>+ Inviter</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, background: '#f0ebe3', padding: 5, borderRadius: 12, marginBottom: 20, width: 'fit-content', flexWrap: 'wrap' }}>
        {TABS.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            style={{ padding: '8px 18px', borderRadius: 9, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', display: 'flex', alignItems: 'center', gap: 6, background: activeTab === i ? 'white' : 'transparent', color: activeTab === i ? '#1a1209' : '#a89478', boxShadow: activeTab === i ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
            {tab.label}
            <span style={{ fontSize: 13, padding: '2px 7px', borderRadius: 8, background: activeTab === i ? '#d1fae5' : '#e8e0d4', color: activeTab === i ? '#047857' : '#a89478', fontWeight: 800 }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <input placeholder="Rechercher par nom, email..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: 16, fontFamily: 'inherit', fontWeight: 600, width: '100%', color: '#1a1209' }} />
          </div>
          <select style={filterSelect}><option>Tous statuts</option><option>Actif</option><option>Suspendu</option><option>Invité</option></select>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Utilisateur', 'Rôle', 'Statut', 'Dernière connexion', 'Classe', 'Actions'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {USERS.map((user, i) => (
              <tr key={i}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 700, color: '#1a1209', fontSize: 17 }}>{user.name}</div>
                  <div style={{ fontSize: 14, color: '#a89478', marginTop: 2 }}>{user.email}</div>
                </td>
                <td style={tdStyle}><span style={badge(user.roleBg, user.roleColor)}>{user.role}</span></td>
                <td style={tdStyle}>
                  <span style={badge(user.status === 'Actif' ? '#d1fae5' : '#f1f5f9', user.status === 'Actif' ? '#065f46' : '#475569')}>
                    {user.status === 'Actif' ? '✓ ' : ''}{user.status}
                  </span>
                </td>
                <td style={tdStyle}>{user.lastLogin}</td>
                <td style={tdStyle}>
                  {user.classe
                    ? <span style={badge('#f1f5f9', '#475569')}>{user.classe}</span>
                    : <span style={{ color: '#a89478' }}>—</span>}
                </td>
                <td style={tdStyle}>
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <button onClick={() => setOpenDD(openDD === i ? null : i)}
                      style={{ background: 'none', border: '1.5px solid #d4c8b8', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 16, color: '#a89478', transition: 'all 0.12s' }}
                      onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#059669', color: '#059669', background: '#d1fae5' })}
                      onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: '#d4c8b8', color: '#a89478', background: 'none' })}>
                      ⋯
                    </button>
                    {openDD === i && (
                      <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 200, zIndex: 100, overflow: 'hidden' }}>
                        {[
                          { icon: '👁',  label: 'Voir profil',       danger: false, onClick: () => { setOpenDD(null); onToast('Profil ouvert', 'info') } },
                          { icon: '✏️', label: 'Modifier',           danger: false, onClick: () => { setOpenDD(null); onToast('Modification...', 'info') } },
                          ...(user.role === 'Élève' ? [{ icon: '🔄', label: 'Changer de classe', danger: false, onClick: () => { setOpenDD(null); onToast('Transfer de classe', 'info') } }] : []),
                          { icon: '🗑',  label: 'Supprimer', danger: true, onClick: () => { setOpenDD(null); onToast('Utilisateur supprimé', 'error') } },
                        ].map((item, j) => (
                          <div key={j} onClick={item.onClick}
                            style={{ padding: '11px 16px', fontSize: 16, fontWeight: 600, color: item.danger ? '#dc2626' : '#6b5c45', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.1s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = item.danger ? '#fee2e2' : '#f0ebe3'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                            {item.icon} {item.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const badge = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', padding: '4px 12px',
  borderRadius: 22, fontSize: 14, fontWeight: 800, background: bg, color, whiteSpace: 'nowrap'
})

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const btnPrim: React.CSSProperties = { padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '7px 14px', borderRadius: 10, fontSize: 15, fontWeight: 800, background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8', cursor: 'pointer', fontFamily: 'inherit' }
const filterSelect: React.CSSProperties = { background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 10, padding: '8px 12px', fontSize: 16, fontWeight: 700, color: '#6b5c45', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
