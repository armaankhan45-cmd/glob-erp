// ═══════════════════════════════════════════════════════════════════
// App.jsx — PREMIUM Login + MainLayout with Sidebar + TopBar + Theme
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
// PREMIUM LOGIN PAGE — Like Stripe, Notion, Linear quality
// Clean professional design, proper form UX, real app feel
// Background follows the theme accent color
// ═══════════════════════════════════════════════════════════════════
function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 100) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Email is required'); return }
    if (!password.trim()) { setError('Password is required'); return }
    setLoading(true)

    const startTime = Date.now()
    const result = await login(email, password)
    const elapsed = Date.now() - startTime

    // If server was cold and login failed, auto-retry after server wakes
    if (elapsed > 8000 && !result.success) {
      setLoading(false)
      setRetrying(true)
      setError('Server is waking up (free tier). Retrying automatically...')
      setTimeout(async () => {
        const retry = await login(email, password)
        setRetrying(false)
        if (retry.success) {
          navigate('/app/dashboard')
        } else {
          setError(retry.msg || 'Login failed. Check your credentials.')
        }
      }, 5000)
      return
    }

    setLoading(false)
    if (result.success) {
      navigate('/app/dashboard')
    } else {
      setError(result.msg || 'Invalid email or password')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)', transition: 'background 0.5s ease' }}>
      {/* ═══ Left Panel — Brand Showcase ═══ */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
        background: 'linear-gradient(135deg, var(--bg-tint), var(--bg-primary))',
        padding: '40px 60px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background decorative elements that follow theme */}
        <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.08) 0%, transparent 70%)' }}></div>
        <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.06) 0%, transparent 70%)' }}></div>

        <div style={{ maxWidth: '480px', position: 'relative', zIndex: 2, transform: mounted ? 'translateY(0)' : 'translateY(30px)', opacity: mounted ? 1 : 0, transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              background: 'linear-gradient(135deg, var(--accent), rgba(var(--accent-rgb),0.7))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(var(--accent-rgb),0.3)'
            }}>
              <span style={{ fontSize: '24px', fontWeight: '900', color: '#fff' }}>G</span>
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '2px', color: 'var(--text-primary)' }}>GLOB ERP</h1>
              <p style={{ fontSize: '11px', fontWeight: '600', letterSpacing: '1px', color: 'var(--accent)' }}>FABRICATION & ENTERPRISES</p>
            </div>
          </div>

          {/* Tagline */}
          <h2 style={{ fontSize: '36px', fontWeight: '700', lineHeight: '1.2', color: 'var(--text-primary)', marginBottom: '16px' }}>
            Your Complete <br/>
            <span style={{ color: 'var(--accent)' }}>GST-Compliant</span><br/>
            Fabrication ERP
          </h2>
          <p style={{ fontSize: '16px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Invoices, Quotations, Purchase Bills, GST Reports — all in one system. Built for Indian manufacturing businesses.
          </p>

          {/* GSTIN Badge */}
          <div style={{ display: 'inline-block', padding: '10px 20px', borderRadius: '10px', background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.15)', marginBottom: '40px' }}>
            <div style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '1px', color: 'var(--text-muted)' }}>GSTIN</div>
            <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--accent)', letterSpacing: '1px' }}>27AWAPK1209R1ZC</div>
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['✓ GST Invoicing', '✓ Quotation Management', '✓ Purchase Tracking', '✓ GSTR-1/GSTR-3B', '✓ Customer Database'].map((f, i) => (
              <span key={i} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', background: 'rgba(var(--accent-rgb),0.06)', border: '1px solid rgba(var(--accent-rgb),0.1)', color: 'var(--text-secondary)' }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Right Panel — Login Form ═══ */}
      <div style={{
        width: '460px', minWidth: '460px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 40px',
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)',
        position: 'relative'
      }}>
        <div style={{ maxWidth: '380px', margin: '0 auto', width: '100%', transform: mounted ? 'translateY(0)' : 'translateY(20px)', opacity: mounted ? 1 : 0, transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s' }}>
          
          {/* Form Header */}
          <div style={{ marginBottom: '32px' }}>
            <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Sign in to your account</p>
            <h2 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>Welcome back</h2>
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              padding: '14px 16px', borderRadius: '10px', marginBottom: '24px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              color: '#f87171', fontSize: '14px', fontWeight: '500',
              display: 'flex', alignItems: 'center', gap: '10px',
              animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)'
            }}>
              {retrying && (
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(248,113,113,0.2)', borderTopColor: '#f87171', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              )}
              {!retrying && <span style={{ fontSize: '14px' }}>⚠️</span>}
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Email Field */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@globfabrication.com"
                required
                autoComplete="email"
                style={{
                  width: '100%', padding: '12px 16px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-input)',
                  borderRadius: '10px',
                  color: 'var(--text-primary)',
                  fontSize: '15px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(var(--accent-rgb),0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb),0.08)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border-input)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            {/* Password Field */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  style={{
                    width: '100%', padding: '12px 16px', paddingRight: '100px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-input)',
                    borderRadius: '10px',
                    color: 'var(--text-primary)',
                    fontSize: '15px',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(var(--accent-rgb),0.4)'; e.target.style.boxShadow = '0 0 0 3px rgba(var(--accent-rgb),0.08)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border-input)'; e.target.style.boxShadow = 'none' }}
                />
                {/* Show/Hide Toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    padding: '6px 12px', borderRadius: '8px',
                    background: showPassword ? 'rgba(var(--accent-rgb),0.12)' : 'var(--bg-glass)',
                    border: `1px solid ${showPassword ? 'rgba(var(--accent-rgb),0.2)' : 'var(--border)'}`,
                    color: showPassword ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || retrying}
              style={{
                width: '100%', padding: '14px',
                background: loading || retrying
                  ? 'rgba(var(--accent-rgb),0.15)'
                  : 'var(--accent)',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '600',
                cursor: loading || retrying ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                boxShadow: loading || retrying ? 'none' : '0 4px 16px rgba(var(--accent-rgb),0.25)'
              }}
            >
              {(loading || retrying) && (
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              )}
              {retrying ? 'Waking Server...' : loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Server Info */}
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              First visit may take ~30 seconds — server sleeps on free tier when idle.<br/>
              Subsequent logins are instant (~0.3s).
            </p>
          </div>

          {/* Footer */}
          <div style={{ marginTop: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>
              © 2024 Glob Fabrication and Enterprises • Maharashtra, India
            </p>
          </div>
        </div>
      </div>

      {/* ─── Animations ─── */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 960px) {
          .login-split { flex-direction: column; }
          .login-brand { width: 100%; min-width: unset; padding: 30px 24px; }
          .login-form-panel { width: 100%; min-width: unset; border-left: none; border-top: 1px solid var(--border); }
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
