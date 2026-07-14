'use client'

import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useT } from '@/lib/i18n'
import { Bell, BellOff, Loader2 } from 'lucide-react'

interface Props {
  style?: React.CSSProperties
  onToggle?: (subscribed: boolean) => void
}

export default function PushNotificationToggle({ style, onToggle }: Props) {
  const t = useT('common')
  const { supported, permission, subscribed, loading, error, subscribe, unsubscribe } =
    usePushNotifications()

  if (!supported) return null

  const handleToggle = async () => {
    if (subscribed) {
      const ok = await unsubscribe()
      if (ok) onToggle?.(false)
    } else {
      const ok = await subscribe()
      if (ok) onToggle?.(true)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: 12,
        background: 'var(--surface)',
        border: '1.5px solid var(--border)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ display: 'flex', color: subscribed ? 'var(--green)' : 'var(--text3)' }}>
          {subscribed ? <Bell size={20} /> : <BellOff size={20} />}
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {t('pushNotifications.title')}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {permission === 'denied'
              ? t('pushNotifications.denied')
              : subscribed
                ? t('pushNotifications.enabled')
                : t('pushNotifications.disabled')}
          </div>
          {error && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>{error}</div>
          )}
        </div>
      </div>

      <button
        onClick={handleToggle}
        disabled={loading || permission === 'denied'}
        style={{
          position: 'relative',
          width: 48,
          height: 26,
          borderRadius: 13,
          border: 'none',
          cursor: loading || permission === 'denied' ? 'not-allowed' : 'pointer',
          background: subscribed ? 'var(--green)' : 'var(--border)',
          transition: 'background 0.2s',
          opacity: permission === 'denied' ? 0.5 : 1,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: subscribed ? 25 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading && <Loader2 size={12} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--text3)' }} />}
        </span>
      </button>
    </div>
  )
}
