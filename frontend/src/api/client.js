import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 45000,
})

const cache = new Map()
const CACHE_TTL = 30000

api.getCached = async (url, forceFresh = false) => {
  const now = Date.now()
  const entry = cache.get(url)
  if (!forceFresh && entry && (now - entry.time) < CACHE_TTL) {
    if ((now - entry.time) > 15000) {
      api.get(url).then(res => { cache.set(url, { data: res.data, time: Date.now() }) }).catch(() => {})
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
  for (const key of cache.keys()) { if (key.includes(pattern)) cache.delete(key) }
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (!window.location.pathname.includes('/login')) { window.location.href = '/login' }
    }
    if (error.response?.status === 405 && !error.config._retried) {
      error.config._retried = true
      try { return await api.request(error.config) } catch (retryErr) { return Promise.reject(retryErr) }
    }
    // No response at all = likely the Render free-tier server was asleep or mid cold-start.
    // Don't retry here with long backoff — that's what made login feel frozen for minutes.
    // The wake-up flow (api.wakeServer) uses raw fetch and handles cold start properly.
    if (!error.response && !error.config._noRetry && (error.config._retryCount || 0) < 1) {
      error.config._retryCount = (error.config._retryCount || 0) + 1
      await new Promise(r => setTimeout(r, 2000))
      try { return await api.request(error.config) } catch (retryErr) { return Promise.reject(retryErr) }
    }
    return Promise.reject(error)
  }
)

// ═══════════════════════════════════════════════════════════════
// RAW FETCH PING — deliberately NOT axios, so it bypasses the
// response interceptor's retry backoff entirely. This is what makes
// "Waking server…" fast and accurate instead of minutes-long.
// ═══════════════════════════════════════════════════════════════
function rawPing(timeoutMs) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  return fetch(`${API_URL}/ping`, { method: 'GET', cache: 'no-store', signal: ctrl.signal })
    .then(async (r) => {
      clearTimeout(timer)
      if (!r.ok) return false
      try { const j = await r.json(); return !!(j && j.ok === true) } catch { return false }
    })
    .catch(() => { clearTimeout(timer); return false })
}

api.pingServer = (timeoutMs = 5000) => rawPing(timeoutMs)

api.wakeServer = async function (onStatus) {
  if (onStatus) onStatus('Checking server…')
  if (await rawPing(3500)) { if (onStatus) onStatus('Server is awake'); return { awake: true } }

  // Server is asleep — Render free-tier cold start takes ~30–60s.
  // Poll tightly (every 4s) so we catch it the instant it comes up.
  const startedAt = Date.now()
  const MAX_WAIT = 90000
  for (;;) {
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    if (onStatus) onStatus(`Waking server… ${elapsed}s (free tier cold start)`)
    if (elapsed >= MAX_WAIT) break
    await new Promise(r => setTimeout(r, 4000))
    if (await rawPing(4000)) { if (onStatus) onStatus('Server is awake!'); return { awake: true } }
  }
  if (onStatus) onStatus('Server is slow to start — please try again in a minute')
  return { awake: false }
}

let keepAliveTimer = null
let keepAliveStarted = false

api.startKeepAlive = () => {
  if (keepAliveStarted) return
  keepAliveStarted = true
  const ping = () => rawPing(8000)
  ping()
  // Render's free tier sleeps after ~15 min idle. Ping every 5 min AND
  // immediately whenever the tab regains focus/visibility, so the gap
  // never grows past the sleep threshold mid-session.
  keepAliveTimer = setInterval(ping, 5 * 60 * 1000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ping() })
  window.addEventListener('focus', ping)
}

api.stopKeepAlive = () => {
  if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null }
  keepAliveStarted = false
}

api.startKeepAlive()

export default api
