import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // 60s timeout — handles Render cold starts
  timeout: 60000,
})

// ═══════════════════════════════════════════
// SMART CACHE — instant UI, background refresh
// ═══════════════════════════════════════════
const cache = new Map()
const CACHE_TTL = 30000

api.getCached = async (url, forceFresh = false) => {
  const now = Date.now()
  const entry = cache.get(url)

  if (!forceFresh && entry && (now - entry.time) < CACHE_TTL) {
    if ((now - entry.time) > 15000) {
      api.get(url).then(res => {
        cache.set(url, { data: res.data, time: Date.now() })
      }).catch(() => {})
    }
    return { data: entry.data, fromCache: true }
  }

  try {
    const res = await api.get(url)
    cache.set(url, { data: res.data, time: Date.now() })
    return { data: res.data, fromCache: false }
  } catch (err) {
    if (entry) return { data: entry.data, fromCache: true, stale: true }
    throw err
  }
}

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

// Response interceptor - handle 401, auto-retry 405 on cold start
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }

    // Auto-retry 405 errors (cold start proxy issue)
    if (error.response?.status === 405 && !error.config._retried) {
      error.config._retried = true
      try {
        return await api.request(error.config)
      } catch (retryErr) {
        return Promise.reject(retryErr)
      }
    }

    // Auto-retry network errors (server waking up) once
    if (!error.response && !error.config._retried) {
      error.config._retried = true
      try {
        return await api.request(error.config)
      } catch (retryErr) {
        return Promise.reject(retryErr)
      }
    }

    return Promise.reject(error)
  }
)

// ═══════════════════════════════════════════
// KEEP-ALIVE PING — prevents Render cold starts
// Pings server every 14 minutes (free tier sleeps after 15min)
// ═══════════════════════════════════════════
let keepAliveTimer = null

api.startKeepAlive = () => {
  if (keepAliveTimer) return
  keepAliveTimer = setInterval(() => {
    api.get('/ai/status').catch(() => {})
  }, 14 * 60 * 1000) // 14 minutes
}

api.stopKeepAlive = () => {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }
}

export default api
