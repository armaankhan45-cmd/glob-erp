import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [initialized, setInitialized] = useState(false)

  // ── FAST AUTH: Use cached user IMMEDIATELY, verify in background ──
  useEffect(() => {
    let cancelled = false
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    // If we have saved user data, use it RIGHT NOW — no waiting
    if (token && savedUser) {
      try { setUser(JSON.parse(savedUser)) } catch {}
    }

    if (!token) {
      // No token — skip auth check entirely
      setLoading(false)
      setInitialized(true)
      return
    }

    // If no saved user but have token, need to check
    if (!savedUser) {
      setLoading(true)
    } else {
      // We have cached data — show app immediately, verify in background
      setLoading(false)
      setInitialized(true)
    }

    // Verify token in background (2s timeout — fast)
    const timeoutId = setTimeout(() => {
      if (!cancelled && !initialized) {
        setLoading(false)
        setInitialized(true)
      }
    }, 2000)

    api.get('/auth/me', { timeout: 2000 }).then(res => {
      if (!cancelled) {
        setUser(res.data.user)
        localStorage.setItem('user', JSON.stringify(res.data.user))
        setLoading(false)
        setInitialized(true)
        clearTimeout(timeoutId)
      }
    }).catch(err => {
      if (!cancelled) {
        if (err.response?.status === 401) {
          // Token is invalid — clear everything, redirect to login
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setUser(null)
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login'
          }
        } else {
          // Network error (server sleeping) — use cached data, that's fine
          if (savedUser) {
            try { setUser(JSON.parse(savedUser)) } catch {}
          }
        }
        setLoading(false)
        setInitialized(true)
        clearTimeout(timeoutId)
      }
    })

    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [])

  const login = useCallback(async (email, password) => {
    setError(null)
    try {
      const res = await api.post('/auth/login', { email, password })
      const { token, user } = res.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user)
      return { success: true }
    } catch (err) {
      const msg = err.response?.data?.msg || err.message || 'Login failed'
      setError(msg)
      return { success: false, msg }
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me')
      setUser(res.data.user)
      localStorage.setItem('user', JSON.stringify(res.data.user))
    } catch {}
  }, [])

  // NO loading screen — if we have cached data, show app immediately
  // Only show a tiny spinner if we have NO cached data at all
  if (loading && !localStorage.getItem('user')) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid rgba(var(--accent-rgb),0.2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, refreshUser, initialized }}>
      {children}
    </AuthContext.Provider>
  )
}
