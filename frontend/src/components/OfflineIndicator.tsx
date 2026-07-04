'use client'

import { useState, useEffect, useRef } from 'react'
import { WifiOff, RefreshCw, Clock, CheckCircle2 } from 'lucide-react'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { useT } from '@/lib/i18n'

export function OfflineIndicator() {
  const t = useT('common')
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
      <div style={{ ...base, background: 'var(--red-light)', borderColor: 'var(--red)', color: 'var(--red)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOff size={16} />
          <span>{t('offline.title')}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--red)' }}>
          {t('offline.description')}
        </div>
      </div>
    )
  }

  if (syncing) {
    return (
      <div style={{ ...base, background: 'var(--blue-light)', borderColor: 'var(--blue)', color: 'var(--blue)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={16} className="animate-spin" />
          <span>{t('offline.syncing')}</span>
        </div>
        {pendingCount > 0 && (
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--blue)' }}>
            {pendingCount} {t('offline.element')}{pendingCount > 1 ? 's' : ''} {t('offline.toSync')}
          </div>
        )}
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div style={{ ...base, background: 'var(--amber-light)', borderColor: 'var(--amber)', color: 'var(--amber)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} />
          <span>{pendingCount} {t('offline.element')}{pendingCount > 1 ? 's' : ''} {t('offline.pending')}</span>
        </div>
        <button
          onClick={() => syncQueue()}
          style={{
            marginTop: 2,
            background: 'var(--amber)',
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
          {t('offline.syncNow')}
        </button>
      </div>
    )
  }

  if (showSuccess) {
    return (
      <div style={{ ...base, background: 'var(--green-light)', borderColor: 'var(--green)', color: 'var(--green)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CheckCircle2 size={16} />
          <span>
            {syncedCount} {t('offline.element')}{syncedCount > 1 ? 's' : ''} {t('offline.synced')}{syncedCount > 1 ? 's' : ''}
          </span>
        </div>
      </div>
    )
  }

  return null
}
