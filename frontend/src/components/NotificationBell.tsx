'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { useInAppNotifications } from '@/hooks/useInAppNotifications'

export default function NotificationBell() {
  const t = useT('common')
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useInAppNotifications()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
      >
        <Bell size={18} color="var(--text2)" />
        {unreadCount > 0 && (
          <div style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, background: 'var(--red)', borderRadius: '50%', border: '2px solid white' }} />
        )}
      </div>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 340, background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, maxHeight: 420, overflowY: 'auto' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{t('notifications.title')}</span>
            {unreadCount > 0 && (
              <button onClick={() => markAllAsRead()} style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {t('notifications.empty')}
            </div>
          ) : notifications.map(n => (
            <div
              key={n.id}
              onClick={() => !n.isRead && markAsRead(n.id)}
              style={{
                padding: '12px 18px', cursor: n.isRead ? 'default' : 'pointer',
                borderBottom: '1px solid var(--border)',
                background: n.isRead ? 'transparent' : 'var(--bg2)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}
            >
              {!n.isRead && (
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', marginTop: 5, flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: n.isRead ? 600 : 800, color: 'var(--text)' }}>{n.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{n.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
