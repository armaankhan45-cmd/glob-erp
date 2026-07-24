import axios from 'axios'

// ═══════════════════════════════════════════════════════════════════
// GLOB ERP — Smart API Client
// Keep-alive ping + Cold-start handling + Smart cache + Fast retries
// ═══════════════════════════════════════════════════════════════════

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000, // 30s — enough for cold start
})

// ─── KEEP-ALIVE PING ───────────────────────────────────────────────
// Wakes up the Render server BEFORE user clicks anything
// Runs every 5 minutes to prevent cold starts
let keepAliveTimer = null
let serverReady = false

function startKeepAlive() {
  if (keepAliveTimer) return // Already running
  
  // Ping immediately on app start
  pingServer()
  
  // Then ping every 5 minutes to keep server warm
  keepAliveTimer = setInterval(pingServer, 5 * 60 * 1000)
}

function pingServer() {
  api.get('/health', { timeout: 5000 })
    .then(res => {
      serverReady = true
      console.log('✅ Server awake:', res.data.msg)
    })
    .catch(err => {
      // Server might be sleeping — try again in 3 seconds
      console.log('⏳ Server waking up...')
      setTimeout(() => {
        api.get('/health', { timeout: 15000 })
          .then(() => { serverReady = true; console.log('✅ Server awake now') })
          .catch(() => { console.log('⚠️ Server still sleeping — will retry on next request') })
      }, 3000)
    })
}

// Start keep-alive as soon as this module loads
startKeepAlive()

// ─── SMART CACHE ───────────────────────────────────────────────────
// Instant UI, background refresh after 15s
const cache = new Map()
const CACHE_TTL = 30000 // 30 seconds

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

// ─── CHECK IF SERVER IS READY ──────────────────────────────────────
// UI can show "server waking up" indicator if not ready
api.isServerReady = () => serverReady

// ─── REQUEST INTERCEPTOR ───────────────────────────────────────────
// Add JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ─── RESPONSE INTERCEPTOR ──────────────────────────────────────────
// Handle 401 + smart cold-start retry
api.interceptors.response.use(
  response => {
    serverReady = true // Any successful response means server is awake
    return response
  },
  error => {
    const originalRequest = error.config

    // ── Handle 401 — session expired ──
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // ── Handle 405 — wrong method / server waking up ──
    if (error.response?.status === 405 && !originalRequest._retry405) {
      originalRequest._retry405 = true
      // Shorter wait — 3 seconds (Render usually responds fast after initial wake)
      return new Promise(resolve => {
        setTimeout(() => resolve(api(originalRequest)), 3000)
      })
    }

    // ── Handle network error — server sleeping (cold start) ──
    if (!error.response && !originalRequest._retryColdStart) {
      originalRequest._retryColdStart = true
      // Wait 5 seconds for Render cold start, then retry
      console.log('⏳ Server might be sleeping — retrying in 5s...')
      return new Promise(resolve => {
        setTimeout(() => resolve(api(originalRequest)), 5000)
      })
    }

    return Promise.reject(error)
  }
)

export default api
