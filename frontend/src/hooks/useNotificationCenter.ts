'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import type { AppNotification } from './useInAppNotifications'

export type NotificationTypeFilter = 'ALL' | 'ACADEMIC' | 'ATTENDANCE' | 'COMMUNICATION' | 'FINANCIAL' | 'AI_ALERT' | 'POSITIVE' | 'SYSTEM'
export type NotificationReadFilter = 'ALL' | 'UNREAD' | 'READ'

interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

/**
 * Vue paginée/filtrable complète de l'historique (contrairement à useInAppNotifications, qui
 * ne garde que les 30 dernières en mémoire pour la cloche live). Pas de connexion Socket.io
 * ici — cette vue se recharge à la demande (changement de page/filtre), la cloche reste seule
 * responsable du temps réel.
 */
export function useNotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 1 })
  const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>('ALL')
  const [readFilter, setReadFilter] = useState<NotificationReadFilter>('ALL')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      if (readFilter === 'UNREAD') params.set('isRead', 'false')
      if (readFilter === 'READ') params.set('isRead', 'true')

      const res = await fetchApi(`/api/v2/notifications?${params}`, { credentials: 'include' })
      const body = await res.json()
      if (body?.success) {
        setNotifications(body.data.notifications ?? [])
        setPagination(body.data.pagination ?? { page: 1, limit: 20, total: 0, pages: 1 })
      }
    } catch { /* silencieux */ }
    finally { setLoading(false) }
  }, [page, typeFilter, readFilter])

  useEffect(() => { load() }, [load])

  // Revenir à la page 1 quand un filtre change (évite une page vide hors bornes)
  useEffect(() => { setPage(1) }, [typeFilter, readFilter])

  const markAsRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
    try {
      await fetchApi(`/api/v2/notifications/${id}/read`, { method: 'POST', credentials: 'include' })
    } catch { /* resynchronisera au prochain chargement */ }
  }, [])

  const markAllAsRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
    try {
      await fetchApi('/api/v2/notifications/read-all', { method: 'POST', credentials: 'include' })
      load()
    } catch { /* idem */ }
  }, [load])

  return {
    notifications, pagination, loading,
    typeFilter, setTypeFilter, readFilter, setReadFilter,
    page, setPage,
    markAsRead, markAllAsRead,
  }
}
