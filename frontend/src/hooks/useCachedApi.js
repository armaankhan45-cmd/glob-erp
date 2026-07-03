import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/client'

// Simple in-memory cache for API responses
const cache = new Map()

export function invalidateCache(key) {
  if (!key) {
    cache.clear()
    return
  }
  // Delete exact match and partial matches
  for (const k of cache.keys()) {
    if (k === key || k.includes(key)) cache.delete(k)
  }
}

export default function useCachedApi(url, options = {}) {
  const { maxAge = 30000, enabled = true } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async (showLoading = true) => {
    if (!url || !enabled) return
    if (showLoading) setLoading(true)
    setError(null)

    // Check cache first
    const cached = cache.get(url)
    const now = Date.now()
    if (cached && (now - cached.time) < maxAge) {
      if (mountedRef.current) {
        setData(cached.data)
        setLoading(false)
      }
      // Background refresh if cache is getting stale
      if ((now - cached.time) > maxAge / 2) {
        api.get(url).then(res => {
          cache.set(url, { data: res.data, time: Date.now() })
          if (mountedRef.current) setData(res.data)
        }).catch(() => {})
      }
      return
    }

    try {
      const res = await api.get(url)
      cache.set(url, { data: res.data, time: Date.now() })
      if (mountedRef.current) {
        setData(res.data)
        setLoading(false)
      }
    } catch (err) {
      // Use stale cache if available
      if (cached) {
        if (mountedRef.current) {
          setData(cached.data)
          setLoading(false)
        }
      } else if (mountedRef.current) {
        setError(err.response?.data?.msg || err.message)
        setLoading(false)
      }
    }
  }, [url, maxAge, enabled])

  useEffect(() => {
    mountedRef.current = true
    if (url && enabled) {
      fetchData(true)
    }
    return () => { mountedRef.current = false }
  }, [url, enabled, fetchData])

  // Auto-refresh interval
  useEffect(() => {
    if (!url || !enabled) return

    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchData(false)
        }
      }, maxAge)
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchData(false)
        startInterval()
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    }

    startInterval()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [url, enabled, maxAge, fetchData])

  const refetch = useCallback(() => {
    invalidateCache(url)
    return fetchData(true)
  }, [url, fetchData])

  return { data, loading, error, refetch }
}
