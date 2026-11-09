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
    // No response / gateway error = the free-tier server is asleep or mid cold-start.
    // Wake it (shared across every waiting request, with an on-screen banner) and retry.
    // Writes are only retried when the server was really asleep or the gateway answered 5xx,
    // so a request that already reached the server is never sent twice.
    const status = error.response?.status
    const cold = !error.response || [502, 503, 504, 521, 522, 523, 524].includes(status)
    const cfg = error.config || {}
    if (cold && !cfg._noRetry && !/\/ping/.test(cfg.url || '') && (cfg._retryCount || 0) < 2) {
      cfg._retryCount = (cfg._retryCount || 0) + 1
      const w = await api.ensureAwake()
      const isGet = (cfg.method || 'get').toLowerCase() === 'get'
      if (isGet || w.woke || status) {
        try { return await api.request(cfg) } catch (retryErr) { return Promise.reject(retryErr) }
      }
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
  // mode: 'no-cors' — the browser sends the request and RESOLVES as soon as
  // the server responds, WITHOUT requiring an Access-Control-Allow-Origin
  // header. (The backend's /api/ping route is registered before the CORS
  // middleware, so its response has no CORS header — a normal fetch would be
  // blocked by the browser and the page would think the server is asleep
  // forever, stuck at "Waking server…".) We only need "did it respond?", so
  // the unreadable "opaque" response is exactly what we want.
  return fetch(`${API_URL}/ping?t=${Date.now()}`, { method: 'GET', cache: 'no-store', mode: 'no-cors', signal: ctrl.signal })
    .then(() => { clearTimeout(timer); return true })
    .catch(() => { clearTimeout(timer); return false })
}

api.pingServer = (timeoutMs = 5000) => rawPing(timeoutMs)

api.wakeServer = async function (onStatus) {
  if (onStatus) onStatus('Checking server…')
  if (await rawPing(3500)) { if (onStatus) onStatus('Server is awake'); return { awake: true } }

  // Server is asleep — Render free-tier cold start takes ~30–60s.
  // Poll every 3s so we catch it the instant it comes up.
  const startedAt = Date.now()
  const MAX_WAIT = 75000
  for (;;) {
    const elapsed = Math.round((Date.now() - startedAt) / 1000)
    if (onStatus) onStatus(`Waking server… ${elapsed}s (free tier cold start)`)
    if (elapsed >= MAX_WAIT) break
    await new Promise(r => setTimeout(r, 3000))
    if (await rawPing(3000)) { if (onStatus) onStatus('Server is awake!'); return { awake: true } }
  }
  if (onStatus) onStatus('Server is slow to start — please try again in a minute')
  return { awake: false }
}

// ── Shared wake-up: one ping loop for the whole app, with state the UI can show ──
const wakeListeners = new Set()
let wakeState = { waking: false, msg: '', elapsed: 0 }
const emitWake = (st) => { wakeState = st; wakeListeners.forEach(f => { try { f(st) } catch { /* ignore */ } }) }
api.subscribeWake = (f) => { wakeListeners.add(f); f(wakeState); return () => wakeListeners.delete(f) }
let wakePromise = null
api.ensureAwake = () => {
  if (wakePromise) return wakePromise
  wakePromise = (async () => {
    if (await rawPing(4000)) return { awake: true, woke: false }
    emitWake({ waking: true, msg: 'Waking up the server…', elapsed: 0 })
    const res = await api.wakeServer((msg) => { const m = /(\d+)s/.exec(msg); emitWake({ waking: true, msg, elapsed: m ? +m[1] : 0 }) })
    emitWake({ waking: false, msg: '', elapsed: 0 })
    return { awake: !!res.awake, woke: true }
  })().finally(() => { setTimeout(() => { wakePromise = null }, 1500) })
  return wakePromise
}
// Wake as soon as the app opens, and again when it returns from the background / regains network
api.ensureAwake()
let hiddenAt = 0
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hiddenAt = Date.now()
  else if (hiddenAt && Date.now() - hiddenAt > 2 * 60 * 1000) { hiddenAt = 0; api.ensureAwake() }
})
window.addEventListener('online', () => api.ensureAwake())

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

