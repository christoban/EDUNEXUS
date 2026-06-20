'use client'
import { useState, useEffect } from 'react'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { db } from '@/lib/offline/db'
import type { PendingAction } from '@/lib/offline/db'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  ATTENDANCE: { label: 'Présences', icon: '✅' },
  GRADE:      { label: 'Notes',     icon: '📝' },
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: '#fef3c7', color: '#92400e' },
  SYNCING: { bg: '#dbeafe', color: '#1e40af' },
  FAILED:  { bg: '#fee2e2', color: '#991b1b' },
}

export default function SectionOfflineStatus({ onToast }: Props) {
  const { pendingCount, syncing, isOnline, syncQueue } = useSyncQueue()
  const [actions, setActions] = useState<PendingAction[]>([])

  useEffect(() => {
    db.pendingActions.toArray().then(setActions)
  }, [pendingCount])

  const handleSync = async () => {
    if (!isOnline) { onToast('Pas de connexion internet', 'error'); return }
    await syncQueue()
    onToast('Synchronisation terminée', 'success')
    const updated = await db.pendingActions.toArray()
    setActions(updated)
  }

  const handleDelete = async (id: number) => {
    await db.pendingActions.delete(id)
    setActions(prev => prev.filter(a => a.id !== id))
    onToast('Action supprimée', 'info')
  }

  return (
    <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 26 }}>
        <div style={sTitle}>Synchronisation</div>
        <div style={sSub}>Actions en attente de synchronisation</div>
      </div>

      {/* Status card */}
      <div style={{ background: isOnline ? '#d1fae5' : '#fee2e2', borderRadius: 16, padding: '20px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 28 }}>{isOnline ? '🌐' : '📶'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: isOnline ? '#065f46' : '#991b1b' }}>
            {isOnline ? 'Connecté à internet' : 'Hors ligne'}
          </div>
          <div style={{ fontSize: 14, color: isOnline ? '#059669' : '#dc2626', marginTop: 2 }}>
            {pendingCount} action{pendingCount !== 1 ? 's' : ''} en attente
          </div>
        </div>
        {isOnline && pendingCount > 0 && (
          <button onClick={handleSync} disabled={syncing}
            style={{ padding: '10px 20px', borderRadius: 11, fontSize: 16, fontWeight: 800, background: 'linear-gradient(135deg,#059669,#047857)', color: 'white', border: 'none', cursor: syncing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: syncing ? 0.7 : 1 }}>
            {syncing ? '⏳ Sync...' : '🔄 Synchroniser maintenant'}
          </button>
        )}
      </div>

      {actions.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1209', marginBottom: 8 }}>Tout est synchronisé</div>
          <div style={{ fontSize: 14, color: '#a89478' }}>Aucune action en attente</div>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 16, border: '1.5px solid #e8e0d4', overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#6b5c45' }}>
              {actions.length} action{actions.length !== 1 ? 's' : ''} en attente
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Type', 'Endpoint', 'Date', 'Statut', 'Action'].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actions.map(action => {
                const meta = TYPE_LABELS[action.type] || { label: action.type, icon: '📌' }
                const sc = STATUS_COLORS[action.status] || STATUS_COLORS.PENDING
                const date = new Date(action.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                return (
                  <tr key={action.id}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fdfaf6'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                    <td style={{ ...tdSt, fontWeight: 700, color: '#1a1209' }}>
                      <span style={{ marginRight: 8 }}>{meta.icon}</span>{meta.label}
                    </td>
                    <td style={{ ...tdSt, fontFamily: 'monospace', fontSize: 14, color: '#6b5c45' }}>{action.endpoint}</td>
                    <td style={{ ...tdSt, color: '#a89478', whiteSpace: 'nowrap' }}>{date}</td>
                    <td style={tdSt}>
                      <span style={{ padding: '4px 12px', borderRadius: 22, fontSize: 14, fontWeight: 800, background: sc.bg, color: sc.color }}>
                        {action.status === 'PENDING' ? 'En attente' : action.status === 'SYNCING' ? 'Sync...' : 'Échec'}
                      </span>
                    </td>
                    <td style={tdSt}>
                      <button onClick={() => handleDelete(action.id!)}
                        style={{ padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, background: '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        Supprimer
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: '#1a1209' }
const sSub: React.CSSProperties = { fontSize: 17, color: '#a89478', marginTop: 3 }
const thSt: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '14px 16px', fontSize: 17, color: '#6b5c45', borderBottom: '1px solid #faf7f2', verticalAlign: 'middle' }
