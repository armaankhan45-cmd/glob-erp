// ═══════════════════════════════════════════════════════════════════
// App.jsx — Advanced Login + MainLayout with Sidebar + TopBar + Theme
// ThemeProvider is HERE (not in main.jsx) to avoid build issues
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'
import MainLayout from './layouts/MainLayout'

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
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
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

// ═══════════════════════════════════════════════════════════════════
// ADVANCED LOGIN PAGE — Animated background, particles, glass card
// Show/Hide password, server wake indicator, smooth animations
// ═══════════════════════════════════════════════════════════════════
function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState('error') // 'error' | 'info' | 'success'
  const [wakingServer, setWakingServer] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [particles] = useState(() => Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 20 + 15,
    delay: Math.random() * 5
  })))

  useEffect(() => { setTimeout(() => setMounted(true), 100) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setMsgType('error')
      setMsg('Please enter email and password')
      return
    }
    setLoading(true)
    setMsg('')

    // Check if server is cold (first attempt might take ~30s)
    const startTime = Date.now()
    const result = await login(email, password)
    const elapsed = Date.now() - startTime

    if (elapsed > 10000 && !result.success) {
      setMsgType('info')
      setMsg('Server is waking up (free tier). Retrying in 5 seconds...')
      setWakingServer(true)
      // Auto-retry after server wakes
      setTimeout(async () => {
        const retry = await login(email, password)
        setLoading(false)
        setWakingServer(false)
        if (retry.success) {
          navigate('/app/dashboard')
        } else {
          setMsgType('error')
          setMsg(retry.msg || 'Login failed. Check your credentials.')
        }
      }, 5000)
      return
    }

    setLoading(false)
    if (result.success) {
      navigate('/app/dashboard')
    } else {
      setMsgType('error')
      setMsg(result.msg || 'Login failed')
    }
  }

  const msgColors = {
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', text: '#f87171', icon: '⚠️' },
    info: { bg: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.25)', text: '#22d3ee', icon: '🔄' },
    success: { bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.25)', text: '#4ade80', icon: '✅' }
  }
  const mc = msgColors[msgType] || msgColors.error

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f1419 0%, #0a1628 25%, #0d2137 50%, #0a1628 75%, #0f1419 100%)', backgroundSize: '400% 400%', animation: 'loginGradient 12s ease infinite', padding: '20px', position: 'relative', overflow: 'hidden' }}>

      {/* ─── Animated Background Orbs ─── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Large cyan orb */}
        <div style={{ position: 'absolute', top: '15%', left: '10%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.08) 0%, transparent 70%)', animation: 'loginFloat1 20s ease-in-out infinite' }}></div>
        {/* Purple orb */}
        <div style={{ position: 'absolute', bottom: '10%', right: '15%', width: '350px', height: '350px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)', animation: 'loginFloat2 18s ease-in-out infinite' }}></div>
        {/* Blue orb */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(110,168,254,0.05) 0%, transparent 70%)', animation: 'loginFloat3 25s ease-in-out infinite' }}></div>
      </div>

      {/* ─── Floating Particles ─── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {particles.map(p => (
          <div key={p.id} style={{
            position: 'absolute', left: `${p.x}%`, top: `${p.y}%`,
            width: `${p.size}px`, height: `${p.size}px`,
            borderRadius: '50%',
            background: `rgba(34,211,238,${0.15 + Math.random() * 0.2})`,
            animation: `loginFloat1 ${p.duration}s ease-in-out ${p.delay}s infinite`,
            boxShadow: `0 0 ${p.size * 3}px rgba(34,211,238,0.1)`
          }}></div>
        ))}
      </div>

      {/* ─── Grid Overlay ─── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(34,211,238,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.03) 1px, transparent 1px)', backgroundSize: '80px 80px' }}></div>

      {/* ─── Login Card ─── */}
      <div style={{
        width: '100%', maxWidth: '440px',
        background: 'rgba(14,20,30,0.85)',
        border: '1px solid rgba(34,211,238,0.15)',
        borderRadius: '24px',
        padding: '44px 36px',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5), 0 0 40px rgba(34,211,238,0.06)',
        backdropFilter: 'blur(30px)',
        transform: mounted ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.96)',
        opacity: mounted ? 1 : 0,
        transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)',
        position: 'relative', zIndex: 10
      }}>

        {/* ─── Card glow border ─── */}
        <div style={{ position: 'absolute', inset: -1, borderRadius: '25px', background: 'conic-gradient(from 0deg, transparent, rgba(34,211,238,0.2), transparent, rgba(168,85,247,0.15), transparent)', animation: 'spin 6s linear infinite', zIndex: -1 }}></div>

        {/* ─── Logo Section ─── */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          {/* Animated Logo */}
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '18px', background: 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(168,85,247,0.15))', border: '1px solid rgba(34,211,238,0.2)', boxShadow: '0 0 40px rgba(34,211,238,0.1)', margin: '0 auto 16px', animation: mounted ? 'pulseGlow 3s ease-in-out infinite' : 'none' }}>
            <span style={{ fontSize: '28px', fontWeight: '900', color: '#22d3ee' }}>G</span>
          </div>

          <h1 style={{ color: '#22d3ee', fontSize: '32px', fontWeight: '800', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '4px' }}>
            GLOB ERP
          </h1>
          <p style={{ color: 'rgba(226,232,240,0.5)', fontSize: '13px', fontWeight: '500', letterSpacing: '1px' }}>
            Fabrication & Enterprises
          </p>
          <div style={{ display: 'inline-block', marginTop: '12px', background: '#e2e8f0', color: '#1e293b', border: '2px solid #1e293b', padding: '5px 12px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px' }}>
            GSTIN: 27AWAPK1209R1ZC
          </div>
        </div>

        {/* ─── Message ─── */}
        {msg && (
          <div style={{ background: mc.bg, border: `1px solid ${mc.border}`, padding: '14px', borderRadius: '12px', color: mc.text, fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}>
            <span style={{ fontSize: '16px' }}>{mc.icon}</span>
            <span>{msg}</span>
            {wakingServer && (
              <div style={{ marginLeft: '8px', width: '16px', height: '16px', border: '2px solid rgba(34,211,238,0.3)', borderTopColor: '#22d3ee', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            )}
          </div>
        )}

        {/* ─── Form ─── */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Email */}
          <div>
            <label style={{ color: 'rgba(226,232,240,0.55)', fontSize: '12px', fontWeight: '600', marginBottom: '8px', display: 'block', letterSpacing: '0.5px' }}>EMAIL ADDRESS</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(226,232,240,0.3)', fontSize: '14px' }}>📧</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@globfabrication.com"
                required
                style={{
                  width: '100%', padding: '14px 14px 14px 42px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#e2e8f0', fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(34,211,238,0.4)'; e.target.style.boxShadow = '0 0 20px rgba(34,211,238,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ color: 'rgba(226,232,240,0.55)', fontSize: '12px', fontWeight: '600', marginBottom: '8px', display: 'block', letterSpacing: '0.5px' }}>PASSWORD</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(226,232,240,0.3)', fontSize: '14px' }}>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: '100%', padding: '14px 14px 14px 42px',
                  paddingRight: '52px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#e2e8f0', fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.3s'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(34,211,238,0.4)'; e.target.style.boxShadow = '0 0 20px rgba(34,211,238,0.1)' }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none' }}
              />
              {/* Show/Hide Password Toggle */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  padding: '6px 8px',
                  color: showPassword ? '#22d3ee' : 'rgba(226,232,240,0.4)',
                  fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || wakingServer}
            style={{
              padding: '16px',
              background: loading || wakingServer
                ? 'rgba(34,211,238,0.2)'
                : 'linear-gradient(135deg, #22d3ee, #6ea8fe)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '15px',
              fontWeight: '700',
              cursor: loading || wakingServer ? 'not-allowed' : 'pointer',
              letterSpacing: '1px',
              transition: 'all 0.3s',
              boxShadow: loading || wakingServer ? 'none' : '0 0 30px rgba(34,211,238,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
            }}
          >
            {loading && (
              <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            )}
            {wakingServer ? 'Waking Server...' : loading ? 'Signing In...' : '→ Sign In'}
          </button>
        </form>

        {/* ─── Server Wake Info ─── */}
        <div style={{ textAlign: 'center', marginTop: '24px', padding: '12px', borderRadius: '10px', background: 'rgba(110,168,254,0.06)', border: '1px solid rgba(110,168,254,0.12)' }}>
          <p style={{ color: 'rgba(226,232,240,0.35)', fontSize: '11px', lineHeight: '1.5' }}>
            💡 <span style={{ color: 'rgba(110,168,254,0.6)', fontWeight: '600' }}>First visit may take ~30s</span> — server is on free tier and sleeps when idle.
            <br/>Subsequent logins are instant (~0.3s).
          </p>
        </div>

        {/* ─── Bottom Tagline ─── */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <p style={{ color: 'rgba(226,232,240,0.15)', fontSize: '10px', fontWeight: '600', letterSpacing: '2px' }}>
            NEBULA ERP SYSTEM • GST COMPLIANT
          </p>
        </div>
      </div>

      {/* ─── Animation Keyframes ─── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes loginGradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
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
          </AuthProvider>
        </BrowserRouter>
      </AutoHealErrorBoundary>
    </ThemeProvider>
  )
}
