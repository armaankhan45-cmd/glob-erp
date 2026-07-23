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

  // ── SAFE AUTH CHECK: Never gets stuck ──
  // If backend is sleeping (Render cold start), we timeout in 10s
  // and show the app anyway — user can retry later
  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(() => {
      if (!cancelled && !initialized) {
        console.warn('⚠️ Auth check timed out — showing app anyway')
        setLoading(false)
        setInitialized(true)
        // Check if we have a token in localStorage — if so, assume valid
        const savedUser = localStorage.getItem('user')
        if (savedUser) {
          try { setUser(JSON.parse(savedUser)) } catch {}
        }
      }
    }, 10000) // 10 second safety timeout — NEVER stuck forever

    const checkAuth = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        setInitialized(true)
        clearTimeout(timeoutId)
        return
      }

      try {
        const res = await api.get('/auth/me', { timeout: 8000 })
        if (!cancelled) {
          setUser(res.data.user)
          localStorage.setItem('user', JSON.stringify(res.data.user))
          setLoading(false)
          setInitialized(true)
          clearTimeout(timeoutId)
        }
      } catch (err) {
        if (!cancelled) {
          // If 401, token is invalid — clear it
          if (err.response?.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setUser(null)
          } else {
            // Network error (backend sleeping) — use cached user data
            console.warn('⚠️ Auth check failed (backend might be sleeping):', err.message)
            const savedUser = localStorage.getItem('user')
            if (savedUser) {
              try { setUser(JSON.parse(savedUser)) } catch {}
            }
          }
          setLoading(false)
          setInitialized(true)
          clearTimeout(timeoutId)
        }
      }
    }

    checkAuth()
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

  // While loading, show a minimal splash (NOT stuck forever)
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0a1a, #0d1b2a)',
        color: '#fff',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{
          width: '48px', height: '48px',
          border: '3px solid rgba(6,182,212,0.2)',
          borderTopColor: '#06b6d4',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
          Checking session...
        </p>
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
