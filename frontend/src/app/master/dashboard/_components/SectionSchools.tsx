'use client'
import { useState } from 'react'
import Badge from './Badge'
import type { SchoolTab, SchoolRow, ConfirmActionTarget } from '../_types'

interface Props {
  schools: SchoolRow[]
  loading: boolean
  activeTab: SchoolTab
  onTabChange: (t: SchoolTab) => void
  searchTerm: string
  onSearchChange: (term: string) => void
  onInvite: () => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onSuspend: (id: string, name: string, subdomain: string) => void
  onDelete: (id: string, name: string) => void
  onViewDetails: (id: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onRefresh: () => void
  onConfirmAction: (target: ConfirmActionTarget) => void
}

const TABS: { id: SchoolTab; label: string; urgent?: boolean }[] = [
  { id: 'all',       label: 'Toutes' },
  { id: 'pending',   label: 'À approuver', urgent: true },
  { id: 'active',    label: 'Actives' },
  { id: 'suspended', label: 'Suspendues' },
  { id: 'draft',     label: 'Invitations en cours' },
  { id: 'rejected',  label: 'Rejetées' },
]

const STATUS_LABELS: Record<string, string> = {
  active:    'ACTIVE',
  pending:   'À APPROUVER',
  draft:     'INVITÉE',
  suspended: 'SUSPENDUE',
  rejected:  'REJETÉE',
}

const PLAN_LABELS: Record<string, string> = { deco: 'Découverte', std: 'Standard', prem: 'Premium' }

export default function SectionSchools({ schools, loading, activeTab, onTabChange, searchTerm, onSearchChange, onInvite, onApprove, onReject, onSuspend, onDelete, onViewDetails, onToast, onRefresh, onConfirmAction }: Props) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const countsByTab: Record<SchoolTab, number> = {
    all: schools.length,
    pending: schools.filter(s => s.status === 'pending').length,
    active: schools.filter(s => s.status === 'active').length,
    suspended: schools.filter(s => s.status === 'suspended').length,
    draft: schools.filter(s => s.status === 'draft').length,
    rejected: schools.filter(s => s.status === 'rejected').length,
  }

  const filtered = activeTab === 'all' ? schools : schools.filter(s => s.status === activeTab)

  return (
    <div style={{ padding: '28px 32px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 31, fontWeight: 700, color: '#1a1209' }}>
            Gestion des Écoles
          </div>
          <div style={{ fontSize: 16, color: '#a89478', marginTop: 2 }}>{schools.length} établissements au total</div>
        </div>
        <button onClick={onInvite} style={btnPrimary}>+ Inviter une école</button>
      </div>

      <div style={{ background: 'white', borderRadius: 14, border: '1.5px solid #e8e0d4', marginBottom: 20 }}>
        <div style={{ display: 'flex', background: 'white', borderBottom: '2.5px solid #e8e0d4', padding: '0 20px' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => onTabChange(tab.id)}
              style={{
                padding: '12px 18px', fontSize: 18, fontWeight: 700,
                color: activeTab === tab.id ? '#059669' : '#a89478',
                background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '3px solid #059669' : '3px solid transparent',
                marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap',
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: 'inherit', transition: 'all 0.15s'
              }}>
              {tab.label}
              <span style={{
                fontSize: 14, fontWeight: 800, padding: '1px 6px', borderRadius: 8,
                background: activeTab === tab.id ? '#d1fae5' : '#f0ebe3',
                color: activeTab === tab.id ? '#047857' : tab.urgent && countsByTab[tab.id] > 0 ? '#92400e' : '#a89478'
              }}>{countsByTab[tab.id]}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0ebe3', border: '1.5px solid #e8e0d4', borderRadius: 9, padding: '8px 12px', flex: 1, minWidth: 200 }}>
            <span>🔍</span>
            <input type="text" value={searchTerm} onChange={e => onSearchChange(e.target.value)} placeholder="Rechercher par nom, sous-domaine, email..."
              style={{ background: 'none', border: 'none', outline: 'none', fontSize: 17, color: '#1a1209', fontFamily: 'inherit', fontWeight: 600, width: '100%' }} />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['École', 'Type', 'Plan', 'Statut', 'Admin', 'Invitation', 'Créée le', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 15, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#a89478', fontSize: 16 }}>Aucune école trouvée</td></tr>
            ) : filtered.map((school) => (
              <tr key={school.id} style={{ borderBottom: '1px solid #faf7f2' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                  <div style={{ fontWeight: 700, color: '#1a1209', fontSize: 17 }}>{school.name}</div>
                  <div style={{ fontSize: 15, color: '#a89478', marginTop: 1, fontWeight: 500 }}>{school.subdomain}</div>
                </td>
                <td style={tdStyle}>{school.type}</td>
                <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                  <Badge type={`plan-${school.plan}` as any}>{PLAN_LABELS[school.plan] ?? school.plan}</Badge>
                </td>
                <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                  <Badge type={school.status}>{STATUS_LABELS[school.status] ?? school.status.toUpperCase()}</Badge>
                </td>
                <td style={tdStyle}>{school.adminEmail || <span style={{ color: '#c8bfb2' }}>—</span>}</td>
                <td style={{ padding: '17px 16px', verticalAlign: 'middle' }}>
                  {school.status === 'draft' ? (
                    <>
                      <Badge type="pending">En attente</Badge>
                      {school.inviteExpiry && <div style={{ fontSize: 13, color: '#a89478', marginTop: 1, fontWeight: 500 }}>Expire {school.inviteExpiry}</div>}
                    </>
                  ) : (
                    <span style={{ color: '#c8bfb2', fontSize: 14 }}>—</span>
                  )}
                </td>
                <td style={tdStyle}>{school.createdAt}</td>
                <td style={{ padding: '13px 16px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', position: 'relative' }}>
                    {school.status === 'pending' && (
                      <>
                        <button onClick={() => onApprove(school.id)} style={{ ...btnPrimary, padding: '7px 14px', fontSize: 15 }}>✅</button>
                        <button onClick={() => onReject(school.id)} style={{ padding: '6px 12px', borderRadius: 9, fontSize: 15, fontWeight: 800, background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}>❌</button>
                      </>
                    )}
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setOpenDropdown(openDropdown === school.id ? null : school.id)}
                        style={{ background: 'none', border: '1.5px solid #d4c8b8', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', fontSize: 16, color: '#6b5c45', transition: 'all 0.15s' }}>
                        ⋯
                      </button>
                      {openDropdown === school.id && (
                        <div style={{
                          position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                          background: 'white', border: '1.5px solid #d4c8b8', borderRadius: 12,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 230, zIndex: 100, overflow: 'hidden'
                        }}>
                          <DropdownItem onClick={() => { onViewDetails(school.id); setOpenDropdown(null) }}>🔍 Voir les détails</DropdownItem>

                          {/* ── Écoles ACTIVES ────────────────────────────── */}
                          {school.status === 'active' && (
                            <>
                              <DropdownItem onClick={() => { onToast('Fonctionnalité à venir', 'info'); setOpenDropdown(null) }}>✏️ Modifier les infos</DropdownItem>
                              <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                              <DropdownItem onClick={() => { onSuspend(school.id, school.name, school.subdomain); setOpenDropdown(null) }} danger>⛔ Suspendre</DropdownItem>
                              <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                              <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger>🗑️ Supprimer définitivement</DropdownItem>
                            </>
                          )}

                          {/* ── Écoles SUSPENDUES ─────────────────────────── */}
                          {school.status === 'suspended' && (
                            <>
                              <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                              <DropdownItem onClick={() => {
                                setOpenDropdown(null)
                                onConfirmAction({
                                  title: 'Réactiver l\'établissement',
                                  description: `Réactiver «${school.name}» — tous les utilisateurs retrouveront l'accès.`,
                                  icon: '✅',
                                  successMsg: `${school.name} a été réactivée`,
                                  execute: async (auth) => {
                                    const { reactivateSchool } = await import('../_api')
                                    await reactivateSchool(school.id, auth)
                                    onRefresh()
                                  },
                                })
                              }} color="#059669">✅ Réactiver</DropdownItem>
                              <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                              <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger>🗑️ Supprimer définitivement</DropdownItem>
                            </>
                          )}

                          {/* ── Écoles REJETÉES ───────────────────────────── */}
                          {school.status === 'rejected' && (
                            <>
                              <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                              <DropdownItem onClick={() => {
                                setOpenDropdown(null)
                                onConfirmAction({
                                  title: 'Réexaminer la demande',
                                  description: `Remettre «${school.name}» en file d'attente pour approbation.`,
                                  icon: '🔄',
                                  successMsg: `La demande de ${school.name} est remise en examen`,
                                  execute: async (auth) => {
                                    const { reexamineSchool } = await import('../_api')
                                    await reexamineSchool(school.id, auth)
                                    onRefresh()
                                  },
                                })
                              }} color="#1d4ed8">🔄 Réexaminer la demande</DropdownItem>
                              <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                              <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger>🗑️ Supprimer définitivement</DropdownItem>
                            </>
                          )}

                          {/* ── Écoles en INVITATION (draft) ─────────────── */}
                          {school.status === 'draft' && (
                            <>
                              <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                              <DropdownItem onClick={() => {
                                setOpenDropdown(null)
                                onConfirmAction({
                                  title: 'Renvoyer l\'invitation',
                                  description: `Envoyer un nouveau lien d'invitation à «${school.name}».`,
                                  icon: '📧',
                                  successMsg: 'Invitation renvoyée avec succès',
                                  execute: async (auth) => {
                                    const { resendInvite } = await import('../_api')
                                    await resendInvite(school.id, auth)
                                  },
                                })
                              }} color="#059669">📧 Renvoyer l'invitation</DropdownItem>
                              <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                              <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger>🗑️ Supprimer définitivement</DropdownItem>
                            </>
                          )}

                          {/* ── Écoles À APPROUVER (pending) ─────────────── */}
                          {school.status === 'pending' && (
                            <>
                              <div style={{ height: 1, background: '#e8e0d4', margin: '4px 0' }} />
                              <DropdownItem onClick={() => { onDelete(school.id, school.name); setOpenDropdown(null) }} danger>🗑️ Supprimer définitivement</DropdownItem>
                            </>
                          )}
                        </div>
                      )}
                    </div>
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

function DropdownItem({ children, onClick, danger, color }: { children: React.ReactNode; onClick: () => void; danger?: boolean; color?: string }) {
  return (
    <div onClick={onClick} style={{
      padding: '13px 14px', fontSize: 17, fontWeight: 600,
      color: danger ? '#dc2626' : color ?? '#6b5c45',
      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      transition: 'background 0.1s'
    }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = danger ? '#fee2e2' : '#f0ebe3'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
      {children}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '9px 18px', borderRadius: 10, fontSize: 17, fontWeight: 800,
  background: 'linear-gradient(135deg,#059669,#047857)', color: 'white',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 3px 12px rgba(5,150,105,0.25)', display: 'inline-flex', alignItems: 'center', gap: 7
}
const tdStyle: React.CSSProperties = { padding: '13px 16px', fontSize: 17, color: '#6b5c45', verticalAlign: 'middle' }
