'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getNotificationSocket } from '@/lib/notificationSocket'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  metadata?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

export function useInAppNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const loadedOnce = useRef(false)

  const loadInitial = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/notifications?limit=30', { credentials: 'include' })
      if (!res.ok) return
      const body = await res.json()
      if (body?.success) {
        setNotifications(body.data.notifications ?? [])
        setUnreadCount(body.data.unreadCount ?? 0)
      }
    } catch { /* silencieux — la cloche reste vide plutôt que casser le dashboard */ }
  }, [])

  useEffect(() => {
    if (loadedOnce.current) return
    loadedOnce.current = true
    loadInitial()

    const socket = getNotificationSocket()
    const onNotification = (n: AppNotification) => {
      setNotifications(prev => [n, ...prev].slice(0, 30))
      if (!n.isRead) setUnreadCount(prev => prev + 1)
    }
    socket.on('notification', onNotification)

    return () => { socket.off('notification', onNotification) }
  }, [loadInitial])

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    setUnreadCount(prev => Math.max(0, prev - 1))
    try {
      await fetchApi(`/api/v2/notifications/${id}/read`, { method: 'POST', credentials: 'include' })
    } catch { /* état local déjà mis à jour — resynchronisera au prochain chargement */ }
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    setUnreadCount(0)
    try {
      await fetchApi('/api/v2/notifications/read-all', { method: 'POST', credentials: 'include' })
    } catch { /* idem */ }
  }, [])

  return { notifications, unreadCount, markAsRead, markAllAsRead }
}
