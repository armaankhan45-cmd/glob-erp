import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // 60s timeout — handles Render cold starts + SMTP email connections
  timeout: 60000,
})

// ═══════════════════════════════════════════
// SMART CACHE — instant UI, background refresh
// Shows cached data immediately, fetches fresh in background
// ═══════════════════════════════════════════
const cache = new Map()
const CACHE_TTL = 30000 // 30 seconds — high refresh rate

api.getCached = async (url, forceFresh = false) => {
  const now = Date.now()
  const entry = cache.get(url)

  // Return cached data instantly if fresh enough
  if (!forceFresh && entry && (now - entry.time) < CACHE_TTL) {
    // Background refresh if cache is > 15s old
    if ((now - entry.time) > 15000) {
      api.get(url).then(res => {
        cache.set(url, { data: res.data, time: Date.now() })
      }).catch(() => {})
    }
    return { data: entry.data, fromCache: true }
  }

  // Fetch fresh data
  try {
    const res = await api.get(url)
    cache.set(url, { data: res.data, time: Date.now() })
    return { data: res.data, fromCache: false }
  } catch (err) {
    // If fetch fails but we have stale cache, use it
    if (entry) return { data: entry.data, fromCache: true, stale: true }
    throw err
  }
}

// Clear cache for specific URL pattern
api.invalidateCache = (pattern) => {
  if (!pattern) { cache.clear(); return }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key)
  }
}

// Request interceptor - add JWT
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Response interceptor - handle 401
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
