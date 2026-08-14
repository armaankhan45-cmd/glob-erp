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
    // A single 3s retry isn't enough — cold start takes up to ~30s — so back off and retry
    // a few times before giving up, instead of surfacing a broken-looking failure.
    if (!error.response && (error.config._retryCount || 0) < 3) {
      error.config._retryCount = (error.config._retryCount || 0) + 1
      const delay = [3000, 8000, 15000][error.config._retryCount - 1]
      await new Promise(r => setTimeout(r, delay))
      try { return await api.request(error.config) } catch (retryErr) { return Promise.reject(retryErr) }
    }
    return Promise.reject(error)
  }
)

api.wakeServer = async function (onStatus) {
  const ping = (timeout) => api.get('/ping', { timeout }).then(() => true).catch(() => false)
  if (onStatus) onStatus('Checking server...')
  if (await ping(3000)) { if (onStatus) onStatus('Server is awake'); return { awake: true } }
  const attempts = [
    { delay: 2000, timeout: 8000, label: 'Waking server…' },
    { delay: 3000, timeout: 15000, label: 'Still waking…' },
    { delay: 5000, timeout: 30000, label: 'Almost ready…' },
    { delay: 8000, timeout: 45000, label: 'One more try…' },
  ]
  for (const attempt of attempts) {
    if (onStatus) onStatus(attempt.label)
    await new Promise(r => setTimeout(r, attempt.delay))
    if (await ping(attempt.timeout)) { if (onStatus) onStatus('Server is awake!'); return { awake: true } }
  }
  if (onStatus) onStatus('Server may still be starting — try logging in')
  return { awake: false }
}

let keepAliveTimer = null
let keepAliveStarted = false

api.startKeepAlive = () => {
  if (keepAliveStarted) return
  keepAliveStarted = true
  const ping = () => api.get('/ping', { timeout: 8000 }).catch(() => {})
  ping()
  // Render's free tier sleeps after ~15 min idle. A 14-minute setInterval alone isn't reliable:
  // browsers throttle/suspend timers in background tabs, so a long-backgrounded tab can miss
  // several beats and the server falls asleep mid-session — which is what "stops working after
  // ~30 min" actually is. Ping on a shorter interval AND immediately whenever the tab regains
  // focus/visibility, so a gap never grows past the 15-minute sleep threshold.
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
