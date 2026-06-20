'use client'
import { useState, useEffect, useRef } from 'react'
import { useOnlineStatus } from './useOnlineStatus'
import { db } from '@/lib/offline/db'

export function useCachedFetch<T>(cacheKey: string, fetchFn: () => Promise<T>) {
  const isOnline = useOnlineStatus()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const fetchFnRef = useRef(fetchFn)
  useEffect(() => { fetchFnRef.current = fetchFn })

  useEffect(() => {
    if (!cacheKey) { setLoading(false); return }
    let mounted = true

    const load = async () => {
      setLoading(true)
      setError(null)

      if (isOnline) {
        try {
          const result = await fetchFnRef.current()
          if (!mounted) return
          setData(result)
          setFromCache(false)
          setCachedAt(null)
          await db.cachedData.put({ key: cacheKey, data: result, cachedAt: Date.now() })
        } catch {
          const cached = await db.cachedData.get(cacheKey)
          if (cached && mounted) {
            setData(cached.data as T)
            setFromCache(true)
            setCachedAt(cached.cachedAt)
          } else if (mounted) {
            setError('Erreur de chargement')
          }
        }
      } else {
        const cached = await db.cachedData.get(cacheKey)
        if (cached && mounted) {
          setData(cached.data as T)
          setFromCache(true)
          setCachedAt(cached.cachedAt)
        } else if (mounted) {
          setError('OFFLINE_NO_CACHE')
        }
      }
      if (mounted) setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [cacheKey, isOnline, refreshKey])

  return { data, loading, error, fromCache, cachedAt, refetch: () => setRefreshKey(k => k + 1) }
}
