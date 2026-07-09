import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // ═══════════════════════════════════════════
  // INSTANT RESTORE — load user from localStorage immediately
  // No white flash, no waiting for API on app start
  // ═══════════════════════════════════════════
  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser)
        setUser(parsed)
        // Background: verify token is still valid & refresh user data
        api.get('/auth/me').then(res => {
          const freshUser = res.data.user
          localStorage.setItem('user', JSON.stringify(freshUser))
          setUser(freshUser)
        }).catch(() => {
          // Token expired — will be handled by 401 interceptor
        })
      } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    setLoading(false)
  }, [])

  // ═══════════════════════════════════════════
  // LOGIN WITH RETRY — handles Render cold starts
  // Retries up to 2 times with exponential backoff
  // ═══════════════════════════════════════════
  const login = async (email, password, retryCount = 0) => {
    const MAX_RETRIES = 2
    try {
      const res = await api.post('/auth/login', { email, password })
      const { token, user: userData } = res.data
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      return userData
    } catch (err) {
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout')
      const isServerError = err.response?.status >= 500
      const isNetworkError = !err.response && !isTimeout

      // Retry on timeout, server error, or network error (cold start)
      if ((isTimeout || isServerError || isNetworkError) && retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1500 // 1.5s, 3s
        await new Promise(r => setTimeout(r, delay))
        return login(email, password, retryCount + 1)
      }

      // If all retries exhausted, throw with helpful message
      if (isTimeout || isNetworkError) {
        const error = new Error('Server is waking up from sleep. Please try again in 30 seconds.')
        error.code = 'COLD_START'
        throw error
      }

      throw err
    }
  }

  const register = async (data) => {
    const res = await api.post('/auth/register', data)
    const { token, user: userData } = res.data
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me')
      const userData = res.data.user
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
    } catch {
      // token expired
      logout()
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
