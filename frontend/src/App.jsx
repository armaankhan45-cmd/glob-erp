// ═══════════════════════════════════════════════════════════════════
// App.jsx — PREMIUM Login (Stripe/Notion quality) + Main App
// Background follows theme color throughout the entire website
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'
import MainLayout from './layouts/MainLayout'

function PageFallback({ name }) {
  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-center">
        <h2 className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{name}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading…</p>
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

function InlineLoader() {
  return (
    <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-10 h-10 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, initialized } = useAuth()
  if (!initialized) return <InlineLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ═══════════════════════════════════════════════════════════════════
// PREMIUM LOGIN PAGE — Like Stripe, Notion, Linear
// Two-panel: left = brand showcase, right = clean form
// Background follows theme color
// ═══════════════════════════════════════════════════════════════════
function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retrying, setRetrying] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 80) }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Please enter your email'); return }
    if (!password.trim()) { setError('Please enter your password'); return }
    setLoading(true)

    const start = Date.now()
    const result = await login(email, password)
    const took = Date.now() - start

    if (took > 8000 && !result.success) {
      setLoading(false)
      setRetrying(true)
      setError('Server is waking up — retrying automatically…')
      setTimeout(async () => {
        const retry = await login(email, password)
        setRetrying(false)
        retry.success ? navigate('/app/dashboard') : setError(retry.msg || 'Login failed. Check credentials.')
      }, 5000)
      return
    }

    setLoading(false)
    result.success ? navigate('/app/dashboard') : setError(result.msg || 'Invalid email or password')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-primary)', transition: 'background 0.4s ease' }}>
      
      {/* ══════ LEFT — Brand Showcase ══════ */}
      <div className="login-brand" style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '60px', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, var(--bg-primary) 0%, var(--bg-card) 100%)'
      }}>
        {/* Subtle accent glow in background */}
        <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.06), transparent 70%)' }} />
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.04), transparent 70%)' }} />

        <div style={{ position: 'relative', maxWidth: '440px', transform: mounted ? 'none' : 'translateY(20px)', opacity: mounted ? 1 : 0, transition: 'all 0.6s cubic-bezier(0.16,1,0.3,1)' }}>
          
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '40px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '22px', fontWeight: '900', color: '#fff' }}>G</span>
            </div>
            <div>
              <span style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '1.5px', color: 'var(--text-primary)' }}>GLOB ERP</span>
              <span style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: 'var(--accent)', letterSpacing: '0.5px', marginTop: '2px' }}>Fabrication & Enterprises</span>
            </div>
          </div>

          {/* Headline */}
          <h2 style={{ fontSize: '32px', fontWeight: '700', lineHeight: '1.3', color: 'var(--text-primary)', marginBottom: '12px' }}>
            GST-Compliant<br/><span style={{ color: 'var(--accent)' }}>Fabrication ERP</span>
          </h2>
          <p style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-secondary)', marginBottom: '28px' }}>
            Invoices, Quotations, Purchase Bills, GST Reports — everything in one system. Built for Indian manufacturing.
          </p>

          {/* GSTIN */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.12)' }}>
            <span style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '1px', color: 'var(--text-muted)' }}>GSTIN</span>
            <span style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--accent)' }}>27AWAPK1209R1ZC</span>
          </div>

          {/* Features */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '28px' }}>
            {['✓ GST Invoicing', '✓ Quotations', '✓ Purchase Bills', '✓ GSTR Reports', '✓ Customer DB'].map((f, i) => (
              <span key={i} style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: 'rgba(var(--accent-rgb),0.05)', color: 'var(--text-secondary)' }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ══════ RIGHT — Login Form ══════ */}
      <div className="login-form-panel" style={{
        width: '440px', minWidth: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 40px', background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: '360px', margin: '0 auto', width: '100%', transform: mounted ? 'none' : 'translateY(10px)', opacity: mounted ? 1 : 0, transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s' }}>
          
          {/* Header */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '4px' }}>GLOB ERP</p>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>Sign in</h2>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 14px', borderRadius: '8px', marginBottom: '20px',
              background: retrying ? 'rgba(var(--accent-rgb),0.08)' : 'rgba(239,68,68,0.08)',
              border: retrying ? '1px solid rgba(var(--accent-rgb),0.15)' : '1px solid rgba(239,68,68,0.15)',
              color: retrying ? 'var(--accent)' : '#f87171',
              fontSize: '13px', fontWeight: '500',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              {(loading || retrying) && <div style={{ width: '14px', height: '14px', border: '2px solid rgba(var(--accent-rgb),0.2)', borderTopColor: retrying ? 'var(--accent)' : '#f87171', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@globfabrication.com" required autoComplete="email"
                style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(var(--accent-rgb),0.4)'; e.target.style.boxShadow = '0 0 0 2px rgba(var(--accent-rgb),0.08)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border-input)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required autoComplete="current-password"
                  style={{ width: '100%', padding: '10px 14px', paddingRight: '64px', background: 'var(--bg-input)', border: '1px solid var(--border-input)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(var(--accent-rgb),0.4)'; e.target.style.boxShadow = '0 0 0 2px rgba(var(--accent-rgb),0.08)' }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-input)'; e.target.style.boxShadow = 'none' }}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', padding: '4px 10px', borderRadius: '6px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s' }}
                >{showPwd ? 'Hide' : 'Show'}</button>
              </div>
            </div>

            <button type="submit" disabled={loading || retrying}
              style={{
                width: '100%', padding: '12px', marginTop: '8px',
                background: loading || retrying ? 'rgba(var(--accent-rgb),0.12)' : 'var(--accent)',
                border: 'none', borderRadius: '8px',
                color: '#fff', fontSize: '14px', fontWeight: '600',
                cursor: loading || retrying ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s, transform 0.1s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: loading || retrying ? 'none' : '0 2px 8px rgba(var(--accent-rgb),0.2)',
              }}
              onMouseDown={e => { if (!loading && !retrying) e.currentTarget.style.transform = 'scale(0.98)' }}
              onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {(loading || retrying) && <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
              {retrying ? 'Waking server…' : loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Note */}
          <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            First visit may take ~30s — free-tier server sleeps when idle.<br/>Subsequent logins are instant.
          </p>

          {/* Footer */}
          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '10px', color: 'var(--text-muted)' }}>
            © 2024 Glob Fabrication and Enterprises · Maharashtra, India
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .login-brand { display: none !important; }
          .login-form-panel { width: 100% !important; min-width: unset !important; border-left: none !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Root App ───
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
                <Route path="quotations/:id/edit" element={<QuotationForm />} />
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
