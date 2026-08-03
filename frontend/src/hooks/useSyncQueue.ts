'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { db, type PendingAction } from '@/lib/offline/db'
import { useOnlineStatus } from './useOnlineStatus'
import { fetchApi } from '@/lib/fetchApi'

export function useSyncQueue() {
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  const updateCount = useCallback(async () => {
    const count = await db.pendingActions.where('status').equals('PENDING').count()
    setPendingCount(count)
  }, [])

  const addToQueue = useCallback(
    async (action: Omit<PendingAction, 'id' | 'status' | 'createdAt' | 'idempotencyKey'>) => {
      await db.pendingActions.add({
        ...action,
        status: 'PENDING',
        createdAt: Date.now(),
        idempotencyKey: crypto.randomUUID(),
      })
      await updateCount()
    },
    [updateCount]
  )

  const syncQueue = useCallback(async (): Promise<number> => {
    if (!isOnline || syncingRef.current) return 0

    syncingRef.current = true
    setSyncing(true)

    // Ordre de création garanti (Plan offline-first V1 §4) : un where().equals() sur un index
    // Dexie ne garantit pas l'ordre — sortBy le rend explicite plutôt que de compter sur un
    // ordre incident de l'index auto-incrémenté.
    const pending = await db.pendingActions.where('status').equals('PENDING').sortBy('createdAt')
    let synced = 0

    for (const action of pending) {
      try {
        const res = await fetchApi(action.endpoint, {
          method: action.method,
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': action.idempotencyKey },
          body: JSON.stringify(action.payload),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await db.pendingActions.delete(action.id!)
        synced++
      } catch {
        await db.pendingActions.update(action.id!, { status: 'FAILED' })
      }
    }

    await updateCount()
    syncingRef.current = false
    setSyncing(false)
    return synced
  }, [isOnline, updateCount])

  useEffect(() => {
    updateCount()
  }, [updateCount])

  useEffect(() => {
    if (isOnline) {
      syncQueue()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  return { pendingCount, syncing, isOnline, addToQueue, syncQueue }
}
