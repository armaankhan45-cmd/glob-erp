import { Component } from 'react'
import { AlertTriangle, RefreshCw, Wrench, Home, Bug } from 'lucide-react'

/**
 * 🛡️ AUTO-HEAL ERROR BOUNDARY
 * 
 * When ANY component crashes, this catches it and:
 * 1. Logs the error to console + localStorage error log
 * 2. Shows a friendly recovery screen (not a blank white page)
 * 3. Offers "Try Again" button (re-mounts the failed component)
 * 4. Offers "Go Home" button (navigates to dashboard safely)
 * 5. Shows error details for debugging
 * 6. Auto-reports to backend /api/diagnose/errors for self-healing
 * 
 * Wrap your entire app in this component for maximum protection.
 */
export default class AutoHealErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      autoRetryScheduled: false,
      reported: false
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('🛡️ ErrorBoundary caught:', error)
    console.error('Component stack:', errorInfo?.componentStack)

    // ── Log to localStorage error history ──
    const errorLog = JSON.parse(localStorage.getItem('erp_error_log') || '[]')
    errorLog.unshift({
      time: new Date().toISOString(),
      message: error.message,
      stack: error.stack?.substring(0, 500),
      componentStack: errorInfo?.componentStack?.substring(0, 500),
      url: window.location.href,
      retryCount: this.state.retryCount
    })
    // Keep last 50 errors only
    if (errorLog.length > 50) errorLog.length = 50
    localStorage.setItem('erp_error_log', JSON.stringify(errorLog))

    // ── Auto-report to backend ──
    this.reportError(error, errorInfo)

    // ── Auto-retry after 3 seconds (first time only) ──
    if (this.state.retryCount === 0 && !this.state.autoRetryScheduled) {
      this.setState({ autoRetryScheduled: true })
      setTimeout(() => {
        this.handleRetry()
      }, 3000)
    }
  }

  async reportError(error, errorInfo) {
    if (this.state.reported) return
    this.setState({ reported: true })
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      await fetch(`${localStorage.getItem('erp_api_url') || '/api'}/diagnose/frontend-error`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack?.substring(0, 1000),
          componentStack: errorInfo?.componentStack?.substring(0, 1000),
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        })
      }).catch(() => { /* silent fail — not critical */ })
    } catch (e) { /* silent */ }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: this.state.retryCount + 1,
      autoRetryScheduled: false,
      reported: false
    })
  }

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, retryCount: 0 })
    window.location.href = '/app'
  }

  handleHardRefresh = () => {
    // Clear any cached data that might be causing the error
    localStorage.removeItem('erp_cache')
    localStorage.removeItem('cached_dashboard')
    // Hard refresh the page
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Unknown error'
      const isNetworkError = errorMsg.includes('Network Error') || errorMsg.includes('timeout') || errorMsg.includes('Failed to fetch')
      const isAuthError = errorMsg.includes('401') || errorMsg.includes('Invalid token') || errorMsg.includes('Login required')
      const isDBError = errorMsg.includes('column') && errorMsg.includes('does not exist')
      const retryCount = this.state.retryCount

      return (
        <div className="min-h-screen flex items-center justify-center p-6"
          style={{ background: 'linear-gradient(135deg, #0a0a1a, #0d1b2a, #1a1a2e)' }}>
          <div className="max-w-lg w-full rounded-2xl p-8 text-center"
            style={{
              background: 'rgba(14,18,36,0.97)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
              backdropFilter: 'blur(20px)'
            }}>

            {/* Error Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.25)' }}>
                <AlertTriangle size={32} className="text-red-400" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-2">
              {isNetworkError ? 'Connection Issue' : isAuthError ? 'Session Expired' : isDBError ? 'Auto-Fixing Database' : 'Something Went Wrong'}
            </h2>

            {/* Auto-diagnosis message */}
            <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {isNetworkError
                ? 'The server might be waking up (Render cold start takes ~30s). Auto-retrying in 3 seconds...'
                : isAuthError
                  ? 'Your login session has expired. Please log in again.'
                  : isDBError
                    ? 'The system is auto-fixing a database issue. This usually resolves itself in 1-2 minutes.'
                    : retryCount > 0
                      ? `Retry #${retryCount} — Still encountering this error. Try a hard refresh.`
                      : 'The app encountered an error. Auto-retrying in 3 seconds...'
              }
            </p>

            {/* Error details (collapsible) */}
            <div className="mb-6 rounded-xl p-4 text-left"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Bug size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Error Details</span>
              </div>
              <p className="text-xs text-red-400 font-mono break-all">{errorMsg}</p>
              {this.state.errorInfo?.componentStack && (
                <details className="mt-2">
                  <summary className="text-xs cursor-pointer" style={{ color: 'rgba(255,255,255,0.2)' }}>Show component trace</summary>
                  <pre className="text-xs mt-1 overflow-auto" style={{ color: 'rgba(255,255,255,0.15)', maxHeight: 100 }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              {!isAuthError && (
                <button onClick={this.handleRetry}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #4f8fff)', color: '#fff', boxShadow: '0 4px 15px rgba(6,182,212,0.3)' }}>
                  <RefreshCw size={16} /> Try Again
                </button>
              )}

              {isAuthError ? (
                <button onClick={() => { localStorage.clear(); window.location.href = '/login' }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #4f8fff)', color: '#fff' }}>
                  <Home size={16} /> Log In Again
                </button>
              ) : (
                <button onClick={this.handleGoHome}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                  <Home size={16} /> Go to Dashboard
                </button>
              )}

              {retryCount > 1 && (
                <button onClick={this.handleHardRefresh}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <Wrench size={16} /> Hard Refresh
                </button>
              )}
            </div>

            {/* Retry indicator */}
            {retryCount > 0 && (
              <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Retry attempts: {retryCount} • Error ID: {Date.now()}
              </p>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
