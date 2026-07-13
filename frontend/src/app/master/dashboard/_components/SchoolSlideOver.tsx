import { X, Users, BookOpen, FileText, Wallet, Pencil, Ban } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Badge from './Badge'
import type { SchoolDetailDto } from '../_types'

interface Props {
  open: boolean
  schoolDetail: SchoolDetailDto | null
  loading: boolean
  onClose: () => void
  onSuspend: (id: string, name: string, subdomain: string) => void
}

const PLAN_LABELS: Record<string, string> = { DISCOVERY: 'Découverte', STANDARD: 'Standard', PREMIUM: 'Premium' }

function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

export default function SchoolSlideOver({ open, schoolDetail, loading, onClose, onSuspend }: Props) {
  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)', zIndex: 150
      }} />

      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 560,
        background: 'white', zIndex: 151, display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        animation: 'slideInRight 0.3s cubic-bezier(0.34,1.2,0.64,1) both'
      }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a89478', fontSize: 18 }}>
            Chargement...
          </div>
        ) : !schoolDetail ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a89478', fontSize: 18 }}>
            École introuvable
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '24px 28px', borderBottom: '1px solid #e8e0d4',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: 'linear-gradient(135deg,#059669,#1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 900, fontSize: 20, flexShrink: 0
                }}>{initials(schoolDetail.name)}</div>
                <div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 21, fontWeight: 700, color: '#1a1209' }}>
                    {schoolDetail.name}
                  </div>
                  <div style={{ fontSize: 14, color: '#a89478', marginTop: 3 }}>{schoolDetail.subdomain}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge type={schoolDetail.status.toLowerCase() as any}>{schoolDetail.status}</Badge>
                <button onClick={onClose} style={{
                  width: 36, height: 36, borderRadius: 8, border: '1.5px solid #d4c8b8',
                  background: 'none', cursor: 'pointer', fontSize: 18, color: '#a89478',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><X size={18} /></button>
              </div>
            </div>

            {/* Stats */}
            <div style={{ padding: '18px 28px', background: '#f7f3ee', borderBottom: '1px solid #e8e0d4', display: 'flex', gap: 12, flexShrink: 0 }}>
              {([
                { icon: Users, val: String(schoolDetail._count?.users ?? 0), label: 'Utilisateurs' },
                { icon: BookOpen, val: String(schoolDetail._count?.classes ?? 0), label: 'Classes' },
                { icon: FileText, val: String(schoolDetail._count?.subjects ?? 0), label: 'Matières' },
                { icon: Wallet, val: String(schoolDetail._count?.feePlans ?? 0), label: 'Frais' },
              ] as { icon: LucideIcon; val: string; label: string }[]).map((s, i) => (
                <div key={i} style={{ flex: 1, background: 'white', borderRadius: 10, padding: '14px 12px', textAlign: 'center', border: '1px solid #e8e0d4' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}><s.icon size={20} /></div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#1a1209', lineHeight: 1, marginTop: 5 }}>{s.val}</div>
                  <div style={{ fontSize: 13, color: '#a89478', fontWeight: 700, marginTop: 3 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
                  Informations générales
                </div>
                <div style={{ background: '#f7f3ee', borderRadius: 12, overflow: 'hidden', border: '1px solid #e8e0d4' }}>
                  {[
                    { key: 'Nom', val: schoolDetail.name },
                    { key: 'Sous-domaine', val: schoolDetail.subdomain },
                    { key: 'Type', val: schoolDetail.type },
                    { key: 'Plan', val: PLAN_LABELS[schoolDetail.plan] ?? schoolDetail.plan },
                    { key: 'Email admin', val: schoolDetail.email ?? '-' },
                    { key: 'Ville', val: schoolDetail.city ?? '-' },
                    { key: 'Téléphone', val: schoolDetail.phone ?? '-' },
                    { key: 'Créée le', val: new Date(schoolDetail.createdAt).toLocaleDateString('fr-CM') },
                  ].map((d, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: '1px solid #e8e0d4'
                    }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#a89478' }}>{d.key}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1209' }}>{d.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent invites */}
              {schoolDetail.invites && schoolDetail.invites.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#a89478', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 12 }}>
                    Invitations récentes
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {schoolDetail.invites.slice(0, 3).map(inv => (
                      <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#f7f3ee', borderRadius: 9 }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1209' }}>{inv.email}</div>
                          <div style={{ fontSize: 13, color: '#a89478' }}>{inv.status} · Expire {new Date(inv.expiresAt).toLocaleDateString('fr-CM')}</div>
                        </div>
                        <Badge type={inv.status === 'PENDING' ? 'pending' : inv.status === 'ACCEPTED' ? 'active' : 'draft'}>{inv.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '18px 28px', borderTop: '1px solid #e8e0d4', display: 'flex', gap: 12, flexShrink: 0 }}>
              <button style={{
                flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800,
                background: 'white', color: '#6b5c45', border: '1.5px solid #d4c8b8',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}><Pencil size={16} /> Modifier</button>
              {schoolDetail.status === 'ACTIVE' && (
                <button onClick={() => onSuspend(schoolDetail.id, schoolDetail.name, schoolDetail.subdomain)} style={{
                  flex: 1, padding: '12px 16px', borderRadius: 10, fontSize: 16, fontWeight: 800,
                  background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}><Ban size={16} /> Suspendre</button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
