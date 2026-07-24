import { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'
import MainLayout from './layouts/MainLayout'

// ─── Suspense fallback ───
function PageFallback({ name }) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div>
        <h2 className="text-xl font-bold mt-4" style={{ color: 'var(--accent)' }}>{name}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading page...</p>
      </div>
    </div>
  )
}

// ─── Lazy load pages ───
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
    <div className="flex items-center justify-center h-screen" style={{ background: '#06080f' }}>
      <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
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
// ENHANCED LOGIN PAGE — Premium dark theme with animated background
// ═══════════════════════════════════════════════════════════════════
function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => { setTimeout(() => setReady(true), 200) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setMsg('')
    try {
      const result = await login(email, password)
      setLoading(false)
      if (result.success) navigate('/app/dashboard')
      else setMsg(result.msg || 'Login failed')
    } catch (err) {
      setLoading(false)
      setMsg('Server may be waking up (30s). Please try again.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06080f', position: 'relative', overflow: 'hidden' }}>
      {/* Animated background orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', top: '-200px', left: '-100px', animation: 'floatOrb 20s ease-in-out infinite' }}></div>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,143,255,0.06) 0%, transparent 70%)', bottom: '-150px', right: '-50px', animation: 'floatOrb 15s ease-in-out infinite reverse' }}></div>
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.05) 0%, transparent 70%)', top: '40%', right: '20%', animation: 'floatOrb 12s ease-in-out infinite 2s' }}></div>
      </div>

      {/* Login card with entrance animation */}
      <div style={{
        width: '100%', maxWidth: '440px',
        background: 'rgba(14,18,36,0.97)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '24px',
        padding: '48px 40px',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5), 0 0 80px rgba(6,182,212,0.05)',
        position: 'relative', zIndex: 1,
        opacity: ready ? 1 : 0,
        transform: ready ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)'
      }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #06b6d4, #4f8fff, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 0 40px rgba(6,182,212,0.2)',
            fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: 1
          }}>G</div>
          <h1 style={{ color: '#06b6d4', fontSize: '32px', fontWeight: '900', letterSpacing: '4px', textTransform: 'uppercase', lineHeight: 1 }}>GLOB ERP</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '13px', marginTop: '8px', fontWeight: 600 }}>Fabrication & Enterprises</p>
          <div style={{
            background: 'rgba(6,182,212,0.08)',
            color: '#06b6d4',
            border: '1px solid rgba(6,182,212,0.15)',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: '700',
            marginTop: '12px',
            letterSpacing: '0.5px',
            display: 'inline-block'
          }}>GSTIN: 27AWAPK1209R1ZC</div>
        </div>

        {/* Error message */}
        {msg && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.15)',
            padding: '14px 18px',
            borderRadius: '12px',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '20px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <span>{msg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginBottom: '8px', display: 'block', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Email</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>📧</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@globfabrication.com"
                required
                style={{
                  width: '100%', padding: '14px 14px 14px 42px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', color: '#fff',
                  fontSize: '14px', outline: 'none',
                  transition: 'border-color 0.2s, background 0.2s'
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.3)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
              />
            </div>
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginBottom: '8px', display: 'block', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                style={{
                  width: '100%', padding: '14px 42px 14px 42px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', color: '#fff',
                  fontSize: '14px', outline: 'none',
                  transition: 'border-color 0.2s, background 0.2s'
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(6,182,212,0.3)'; e.target.style.background = 'rgba(255,255,255,0.06)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.background = 'rgba(255,255,255,0.04)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 14, cursor: 'pointer' }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '16px',
              background: loading ? 'rgba(6,182,212,0.15)' : 'linear-gradient(135deg, #06b6d4, #4f8fff)',
              border: 'none', borderRadius: '12px',
              color: '#fff', fontSize: '16px', fontWeight: '800',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '1px',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(6,182,212,0.3)',
              transition: 'all 0.3s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            {loading ? (
              <>
                <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                Signing in...
              </>
            ) : (
              <>🚀 Sign In</>
            )}
          </button>
        </form>

        {/* Cold start notice */}
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '24px', fontWeight: 500 }}>
          ⏳ First visit may take 30s (server waking up on free tier)
        </p>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -20px) scale(1.05); }
          50% { transform: translate(-20px, 30px) scale(0.95); }
          75% { transform: translate(10px, 20px) scale(1.02); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
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
