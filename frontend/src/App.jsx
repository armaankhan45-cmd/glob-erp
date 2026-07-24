// ═══════════════════════════════════════════════════════════════════
// App.jsx — Themed Login + MainLayout with Sidebar + TopBar
// Login page uses ThemeContext CSS variables to match app theme
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider, useTheme, THEMES } from './context/ThemeContext'
import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'
import MainLayout from './layouts/MainLayout'
import api from './api/client'

// ─── Lazy load pages ───
function PageFallback({ name }) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <h2 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{name}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Page loading or updating. Try refreshing if stuck.</p>
      </div>
    </div>
  )
}

const Dashboard       = lazy(() => import('./pages/Dashboard').catch(() => ({ default: () => <PageFallback name="Dashboard" /> })))
const Invoices        = lazy(() => import('./pages/Invoices').catch(() => ({ default: () => <PageFallback name="Invoices" /> })))
const InvoiceDetail   = lazy(() => import('./pages/InvoiceDetail').catch(() => ({ default: () => <PageFallback name="Invoice Detail" /> })))
const InvoiceNew      = lazy(() => import('./pages/InvoiceNew').catch(() => ({ default: () => <PageFallback name="New Invoice" /> })))
const InvoiceEdit     = lazy(() => import('./pages/InvoiceEdit').catch(() => ({ default: () => <PageFallback name="Edit Invoice" /> })))
const Quotations      = lazy(() => import('./pages/Quotations').catch(() => ({ default: () => <PageFallback name="Quotations" /> })))
const QuotationDetail = lazy(() => import('./pages/QuotationDetail').catch(() => ({ default: () => <PageFallback name="Quotation Detail" /> })))
const QuotationForm   = lazy(() => import('./pages/QuotationForm').catch(() => ({ default: () => <PageFallback name="New Quotation" /> })))
const Customers       = lazy(() => import('./pages/Customers').catch(() => ({ default: () => <PageFallback name="Customers" /> })))
const CustomerNew     = lazy(() => import('./pages/CustomerNew').catch(() => ({ default: () => <PageFallback name="New Customer" /> })))
const CustomerDetail  = lazy(() => import('./pages/CustomerDetail').catch(() => ({ default: () => <PageFallback name="Customer Detail" /> })))
const CustomerEdit    = lazy(() => import('./pages/CustomerEdit').catch(() => ({ default: () => <PageFallback name="Edit Customer" /> })))
const Purchases       = lazy(() => import('./pages/Purchases').catch(() => ({ default: () => <PageFallback name="Purchases" /> })))
const PurchaseNew     = lazy(() => import('./pages/PurchaseNew').catch(() => ({ default: () => <PageFallback name="New Purchase" /> })))
const PurchaseDetail  = lazy(() => import('./pages/PurchaseDetail').catch(() => ({ default: () => <PageFallback name="Purchase Detail" /> })))
const PurchaseEdit    = lazy(() => import('./pages/PurchaseEdit').catch(() => ({ default: () => <PageFallback name="Edit Purchase" /> })))
const GSTReports      = lazy(() => import('./pages/GSTReports').catch(() => ({ default: () => <PageFallback name="GST Reports" /> })))
const Reports         = lazy(() => import('./pages/Reports').catch(() => ({ default: () => <PageFallback name="Reports" /> })))
const AIAssistant     = lazy(() => import('./pages/AIAssistant').catch(() => ({ default: () => <PageFallback name="AI Assistant" /> })))
const Settings        = lazy(() => import('./pages/Settings').catch(() => ({ default: () => <PageFallback name="Settings" /> })))
const FontSettings    = lazy(() => import('./pages/FontSettings').catch(() => ({ default: () => <PageFallback name="Font Settings" /> })))
const ExportData      = lazy(() => import('./pages/ExportData').catch(() => ({ default: () => <PageFallback name="Export" /> })))
const DeployControl   = lazy(() => import('./pages/DeployControl').catch(() => ({ default: () => <PageFallback name="Deploy" /> })))
const Diagnostics     = lazy(() => import('./pages/Diagnostics').catch(() => ({ default: () => <PageFallback name="Diagnostics" /> })))

// ─── Inline loader ───
function InlineLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )
}

// ─── Auth guard ───
function PrivateRoute({ children }) {
  const { user, initialized } = useAuth()
  if (!initialized) return <InlineLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ─── Login page — themed to match app ───
function LoginPage() {
  const { login } = useAuth()
  const { themeKey, mode, themes } = useTheme()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  const [wakingUp, setWakingUp] = useState(!api.isServerReady())

  useEffect(() => { setMounted(true) }, [])

  // Check if server is awake every 3 seconds while on login page
  useEffect(() => {
    if (wakingUp) {
      const timer = setInterval(() => {
        if (api.isServerReady()) {
          setWakingUp(false)
          clearInterval(timer)
        }
      }, 3000)
      return () => clearInterval(timer)
    }
  }, [wakingUp])

  const accentColor = themes[themeKey]?.color || '#06b6d4'
  const themeIcon = themes[themeKey]?.icon || '💎'
  const isLight = mode === 'light'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setMsg('')
    const result = await login(email, password)
    setLoading(false)
    if (result.success) navigate('/app/dashboard')
    else setMsg(result.msg || 'Login failed')
  }

  // Background orbs — themed
  const orbStyle1 = {
    position: 'absolute', top: '15%', left: '10%', width: '300px', height: '300px',
    borderRadius: '50%',
    background: isLight ? `rgba(${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)},0.08)` : `rgba(${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)},0.15)`,
    filter: 'blur(80px)',
    animation: 'loginFloat1 8s ease-in-out infinite',
  }
  const orbStyle2 = {
    position: 'absolute', bottom: '10%', right: '15%', width: '250px', height: '250px',
    borderRadius: '50%',
    background: isLight ? `rgba(79,143,255,0.06)` : `rgba(79,143,255,0.12)`,
    filter: 'blur(60px)',
    animation: 'loginFloat2 6s ease-in-out infinite',
  }
  const orbStyle3 = {
    position: 'absolute', top: '50%', left: '50%', width: '200px', height: '200px',
    borderRadius: '50%',
    background: isLight ? `rgba(${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)},0.05)` : `rgba(${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)},0.1)`,
    filter: 'blur(50px)',
    animation: 'loginFloat3 10s ease-in-out infinite',
  }

  // Card entrance animation
  const cardStyle = {
    width: '100%', maxWidth: '420px',
    background: 'var(--bg-card)',
    border: `1px solid var(--border)`,
    borderRadius: '20px',
    padding: '40px 32px',
    boxShadow: isLight ? '0 25px 50px rgba(0,0,0,0.08)' : '0 25px 50px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(20px)',
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(30px)',
    transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)',
    position: 'relative',
    overflow: 'hidden',
  }

  // Accent glow line inside card
  const glowLineStyle = {
    height: '2px',
    background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
    margin: '0 -32px 24px -32px',
    opacity: 0.6,
  }

  // Input focus animation
  const inputStyle = {
    width: '100%', padding: '12px 16px 12px 42px',
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }

  const inputIconStyle = {
    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
    color: 'var(--text-muted)', fontSize: '16px',
  }

  const labelStyle = {
    color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '6px', display: 'block', fontWeight: 600,
  }

  const errorBoxStyle = {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    padding: '12px', borderRadius: '8px', color: '#f87171', fontSize: '13px', marginBottom: '16px',
  }

  // Logo gradient background
  const logoBg = {
    background: `linear-gradient(135deg, ${accentColor}, #4f8fff)`,
    padding: '8px 16px', borderRadius: '12px', display: 'inline-block', marginBottom: '8px',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '20px', position: 'relative', overflow: 'hidden', transition: 'background 0.3s' }}>
      {/* Animated themed background orbs */}
      <div style={orbStyle1} />
      <div style={orbStyle2} />
      <div style={orbStyle3} />

      {/* Login card */}
      <div style={cardStyle}>
        {/* Accent glow line */}
        <div style={glowLineStyle} />

        {/* Server status indicator */}
        {wakingUp && (
          <div style={{ background: 'rgba(var(--accent-rgb), 0.08)', border: '1px solid rgba(var(--accent-rgb), 0.15)', padding: '10px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <span className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: accentColor, borderTopColor: 'transparent' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Server is waking up... This takes ~30s on first visit</span>
            </div>
          </div>
        )}

        {/* Logo & branding */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={logoBg}>
            <span style={{ color: '#fff', fontSize: '22px', fontWeight: '700', letterSpacing: '2px' }}>GLOB ERP</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>Fabrication & Enterprises</p>
          <div className="gstin-badge" style={{ marginTop: '10px' }}>GSTIN: 27AWAPK1209R1ZC</div>
          {/* Theme indicator */}
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
            {themeIcon} {themes[themeKey]?.name || 'Cyan Nebula'} • {isLight ? '☀️ Day' : '🌙 Night'} Mode
          </div>
        </div>

        {/* Error message */}
        {msg && (
          <div style={errorBoxStyle}>
            ⚠️ {msg}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email field */}
          <div>
            <label style={labelStyle}>Email</label>
            <div style={{ position: 'relative' }}>
              <span style={inputIconStyle}>📧</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@globfabrication.com"
                required
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 0 3px rgba(${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)},0.15)` }}
                onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = '' }}
              />
            </div>
          </div>

          {/* Password field */}
          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <span style={inputIconStyle}>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{ ...inputStyle, paddingRight: '42px' }}
                onFocus={e => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `0 0 0 3px rgba(${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)},0.15)` }}
                onBlur={e => { e.target.style.borderColor = ''; e.target.style.boxShadow = '' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '0' }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Submit button — themed accent */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary btn-shine"
            style={{
              padding: '14px',
              background: loading ? `rgba(${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)},0.3)` : `linear-gradient(135deg, ${accentColor}, #4f8fff)`,
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Cold start notice */}
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px', marginTop: '20px' }}>
          ⏱ First visit may take 30s (server waking up)
        </p>

        {/* Subtle accent shimmer on card */}
        <div className="shimmer" style={{ position: 'absolute', top: 0, left: '-100%', width: '50%', height: '100%', background: `linear-gradient(90deg, transparent, rgba(${parseInt(accentColor.slice(1,3),16)},${parseInt(accentColor.slice(3,5),16)},${parseInt(accentColor.slice(5,7),16)},0.04), transparent)`, animation: 'shimmer 3s infinite' }} />
      </div>

      {/* Login page animation keyframes */}
      <style>{`
        @keyframes loginFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.95); }
        }
        @keyframes loginFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-25px, -30px) scale(1.1); }
        }
        @keyframes loginFloat3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-45%, -55%) scale(1.15); }
        }
      `}</style>
    </div>
  )
}

// ─── Root App component ───
export default function App() {
  return (
    <ThemeProvider>
      <AutoHealErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<InlineLoader />}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/app" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="invoices" element={<Invoices />} />
                  <Route path="invoices/new" element={<InvoiceNew />} />
                  <Route path="invoices/:id" element={<InvoiceDetail />} />
                  <Route path="invoices/:id/edit" element={<InvoiceEdit />} />
                  <Route path="quotations" element={<Quotations />} />
                  <Route path="quotations/new" element={<QuotationForm />} />
                  <Route path="quotations/:id" element={<QuotationDetail />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="customers/new" element={<CustomerNew />} />
                  <Route path="customers/:id" element={<CustomerDetail />} />
                  <Route path="customers/:id/edit" element={<CustomerEdit />} />
                  <Route path="purchases" element={<Purchases />} />
                  <Route path="purchases/new" element={<PurchaseNew />} />
                  <Route path="purchases/:id" element={<PurchaseDetail />} />
                  <Route path="purchases/:id/edit" element={<PurchaseEdit />} />
                  <Route path="gst" element={<GSTReports />} />
                  <Route path="reports" element={<Reports />} />
                  <Route path="ai-assistant" element={<AIAssistant />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="fonts" element={<FontSettings />} />
                  <Route path="export" element={<ExportData />} />
                  <Route path="deploy" element={<DeployControl />} />
                  <Route path="diagnostics" element={<Diagnostics />} />
                  <Route path="" element={<Navigate to="/app/dashboard" replace />} />
                </Route>
                <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </AutoHealErrorBoundary>
    </ThemeProvider>
  )
}
