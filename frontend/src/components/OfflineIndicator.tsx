'use client'

import { useState, useEffect, useRef } from 'react'
import { WifiOff, RefreshCw, Clock, CheckCircle2 } from 'lucide-react'
import { useSyncQueue } from '@/hooks/useSyncQueue'

export function OfflineIndicator() {
  const { pendingCount, syncing, isOnline, syncQueue } = useSyncQueue()
  const [syncedCount, setSyncedCount] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)
  const prevPendingRef = useRef(pendingCount)

  useEffect(() => {
    const prev = prevPendingRef.current
    prevPendingRef.current = pendingCount

    if (prev > 0 && pendingCount === 0 && isOnline && !syncing) {
      setSyncedCount(prev)
      setShowSuccess(true)
      const t = setTimeout(() => setShowSuccess(false), 3000)
      return () => clearTimeout(t)
    }
  }, [pendingCount, isOnline, syncing])

  if (isOnline && pendingCount === 0 && !syncing && !showSuccess) return null

  const base: React.CSSProperties = {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 9999,
    borderRadius: 12,
    padding: '12px 16px',
    minWidth: 260,
    maxWidth: 320,
    fontFamily: 'var(--font-nunito), Nunito, sans-serif',
    fontSize: 14,
    fontWeight: 600,
    boxShadow: '0 4px 20px rgba(0,0,0,0.14)',
    border: '1.5px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  }

  if (!isOnline) {
    return (
      <div style={{ ...base, background: '#fef2f2', borderColor: '#fca5a5', color: '#991b1b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOff size={16} />
          <span>Hors-ligne</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: '#b91c1c' }}>
          Vos actions seront synchronisées à la reconnexion
        </div>
      </div>
    )
  }

  if (syncing) {
    return (
      <div style={{ ...base, background: '#eff6ff', borderColor: '#93c5fd', color: '#1d4ed8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} className="animate-spin" />
          <span>Synchronisation en cours...</span>
        </div>
        {pendingCount > 0 && (
          <div style={{ fontSize: 12, fontWeight: 500, color: '#3b82f6' }}>
            {pendingCount} élément{pendingCount > 1 ? 's' : ''} à synchroniser
          </div>
        )}
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div style={{ ...base, background: '#fffbeb', borderColor: '#fcd34d', color: '#92400e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} />
          <span>{pendingCount} élément{pendingCount > 1 ? 's' : ''} en attente</span>
        </div>
        <button
          onClick={() => syncQueue()}
          style={{
            marginTop: 2,
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          Synchroniser maintenant
        </button>
      </div>
    )
  }

  if (showSuccess) {
    return (
      <div style={{ ...base, background: '#f0fdf4', borderColor: '#86efac', color: '#14532d' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>
            {syncedCount} élément{syncedCount > 1 ? 's' : ''} synchronisé{syncedCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    )
  }

  return null
}
