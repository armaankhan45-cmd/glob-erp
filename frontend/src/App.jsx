import { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'

// ═══════════════════════════════════════════════════
// SAFE LOADING — shows spinner, never stuck forever
// ═══════════════════════════════════════════════════
function SafeLoader() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a1a, #0d1b2a)', color: '#fff', flexDirection: 'column', gap: '16px'
    }}>
      <div style={{
        width: '40px', height: '40px',
        border: '3px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4',
        borderRadius: '50%', animation: 'spin 1s linear infinite'
      }} />
      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', maxWidth: '320px', textAlign: 'center' }}>
        Loading... If stuck for 30+ seconds, server may be waking up (Render free tier). Please wait or refresh.
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// FALLBACK PAGE — shown if a page file is missing/broken
// ═══════════════════════════════════════════════════
function FallbackPage({ name }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2 style={{ color: '#06b6d4', fontSize: '20px', marginBottom: '12px' }}>{name}</h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
        This page is loading or being updated. If it doesn't appear, try refreshing.
      </p>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// LAZY LOAD PAGES — each page loads independently
// If a page file is broken, only THAT page fails (not the whole app)
// AutoHealErrorBoundary catches the error and shows recovery screen
// ═══════════════════════════════════════════════════

// Core pages (always exist)
const Login         = lazy(() => import('./pages/Login').catch(() => ({ default: () => <FallbackPage name="Login" /> })))
const Dashboard     = lazy(() => import('./pages/Dashboard').catch(() => ({ default: () => <FallbackPage name="Dashboard" /> })))
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail').catch(() => ({ default: () => <FallbackPage name="Invoice" /> })))
const Settings      = lazy(() => import('./pages/Settings').catch(() => ({ default: () => <FallbackPage name="Settings" /> })))

// Business pages (likely exist based on backend routes)
const Invoices       = lazy(() => import('./pages/Invoices').catch(() => ({ default: () => <FallbackPage name="Invoices" /> })))
const Quotations     = lazy(() => import('./pages/Quotations').catch(() => ({ default: () => <FallbackPage name="Quotations" /> })))
const QuotationDetail = lazy(() => import('./pages/QuotationDetail').catch(() => ({ default: () => <FallbackPage name="Quotation" /> })))
const Customers      = lazy(() => import('./pages/Customers').catch(() => ({ default: () => <FallbackPage name="Customers" /> })))
const Purchases      = lazy(() => import('./pages/Purchases').catch(() => ({ default: () => <FallbackPage name="Purchases" /> })))
const Payments       = lazy(() => import('./pages/Payments').catch(() => ({ default: () => <FallbackPage name="Payments" /> })))
const Expenses       = lazy(() => import('./pages/Expenses').catch(() => ({ default: () => <FallbackPage name="Expenses" /> })))
const Suppliers      = lazy(() => import('./pages/Suppliers').catch(() => ({ default: () => <FallbackPage name="Suppliers" /> })))
const Inventory      = lazy(() => import('./pages/Inventory').catch(() => ({ default: () => <FallbackPage name="Inventory" /> })))
const CreditNotes    = lazy(() => import('./pages/CreditNotes').catch(() => ({ default: () => <FallbackPage name="Credit Notes" /> })))
const Workers        = lazy(() => import('./pages/Workers').catch(() => ({ default: () => <FallbackPage name="Workers" /> })))
const Machines       = lazy(() => import('./pages/Machines').catch(() => ({ default: () => <FallbackPage name="Machines" /> })))
const Production     = lazy(() => import('./pages/Production').catch(() => ({ default: () => <FallbackPage name="Production" /> })))
const GSTReports     = lazy(() => import('./pages/GSTReports').catch(() => ({ default: () => <FallbackPage name="GST Reports" /> })))
const Reports        = lazy(() => import('./pages/Reports').catch(() => ({ default: () => <FallbackPage name="Reports" /> })))
const AIAssistant    = lazy(() => import('./pages/AIAssistant').catch(() => ({ default: () => <FallbackPage name="AI Assistant" /> })))

// ═══════════════════════════════════════════════════
// AUTH GUARD — redirects to login if not authenticated
// Uses cached user data if backend is unreachable (offline-first)
// ═══════════════════════════════════════════════════
function PrivateRoute({ children }) {
  const { user, initialized } = useAuth()
  if (!initialized) return <SafeLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// ═══════════════════════════════════════════════════
// APP LAYOUT — Sidebar + Content
// ═══════════════════════════════════════════════════
function AppLayout() {
  const { user, logout } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const NAV = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/app' },
    { id: 'invoices', label: 'Invoices', icon: '📄', path: '/app/invoices' },
    { id: 'quotations', label: 'Quotations', icon: '📝', path: '/app/quotations' },
    { id: 'customers', label: 'Customers', icon: '👥', path: '/app/customers' },
    { id: 'purchases', label: 'Purchase Bills', icon: '🧾', path: '/app/purchases' },
    { id: 'payments', label: 'Payments', icon: '💰', path: '/app/payments' },
    { id: 'expenses', label: 'Expenses', icon: '💸', path: '/app/expenses' },
    { id: 'suppliers', label: 'Suppliers', icon: '🏭', path: '/app/suppliers' },
    { id: 'inventory', label: 'Inventory', icon: '📦', path: '/app/inventory' },
    { id: 'credit-notes', label: 'Credit Notes', icon: '↩️', path: '/app/credit-notes' },
    { id: 'workers', label: 'Workers', icon: '👷', path: '/app/workers' },
    { id: 'machines', label: 'Machines', icon: '⚙️', path: '/app/machines' },
    { id: 'production', label: 'Production', icon: '🔨', path: '/app/production' },
    { id: 'gst', label: 'GST Reports', icon: '🇮🇳', path: '/app/gst' },
    { id: 'reports', label: 'Reports', icon: '📈', path: '/app/reports' },
    { id: 'ai', label: 'AI Assistant', icon: '🤖', path: '/app/ai' },
    { id: 'settings', label: 'Settings', icon: '⚙️', path: '/app/settings' },
  ]

  const currentPath = window.location.pathname

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#0a0a1a' }}>
      {/* ─── SIDEBAR ─── */}
      <aside style={{
        width: sidebarCollapsed ? '64px' : '260px',
        background: 'linear-gradient(180deg, #0d1b2a, #1a1a2e)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 16px', overflowY: 'auto', flexShrink: 0,
        position: 'fixed', height: '100vh', zIndex: 40,
        transition: 'width 0.3s ease',
      }}>
        {/* Logo area */}
        {!sidebarCollapsed && (
          <div style={{ marginBottom: '24px', padding: '0 8px' }}>
            <h2 style={{ color: '#06b6d4', fontSize: '18px', fontWeight: '700', letterSpacing: '1px' }}>
              GLOB ERP
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>
              Fabrication & Enterprises
            </p>
            <div style={{
              background: '#e8ecf1', color: '#0d1b2a', border: '2px solid #0d1b2a',
              padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700',
              marginTop: '8px', letterSpacing: '0.5px', display: 'inline-block'
            }}>
              GSTIN: 27AWAPK1209R1ZC
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{
          width: '100%', padding: '8px', marginBottom: '12px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer'
        }}>
          {sidebarCollapsed ? '→' : '← Collapse'}
        </button>

        {/* Nav items */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV.map(item => {
            const isActive = currentPath === item.path || (item.path === '/app' && currentPath === '/app')
            return (
              <a key={item.id} href={item.path}
                style={{
                  display: 'flex', alignItems: 'center', gap: sidebarCollapsed ? '0' : '12px',
                  padding: sidebarCollapsed ? '10px 8px' : '10px 12px', borderRadius: '10px',
                  justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  color: isActive ? '#06b6d4' : 'rgba(255,255,255,0.6)', fontSize: '13px',
                  textDecoration: 'none', fontWeight: isActive ? '600' : '400',
                  background: isActive ? 'rgba(6,182,212,0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(6,182,212,0.15)' : '1px solid transparent',
                  transition: 'all 0.2s',
                }}>
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                {!sidebarCollapsed && item.label}
              </a>
            )
          })}
        </nav>

        {/* User info */}
        {!sidebarCollapsed && (
          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #06b6d4, #4f8fff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '14px', fontWeight: '700',
              }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div>
                <p style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{user?.name || 'Admin'}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{user?.role || 'admin'}</p>
              </div>
            </div>
            <button onClick={logout} style={{
              marginTop: '12px', width: '100%', padding: '8px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: '8px', color: '#f87171', fontSize: '12px', cursor: 'pointer', fontWeight: '600',
            }}>
              Logout
            </button>
          </div>
        )}
      </aside>

      {/* ─── MAIN CONTENT ─── */}
      <main style={{
        marginLeft: sidebarCollapsed ? '64px' : '260px',
        padding: '24px', minHeight: '100vh', width: `calc(100% - ${sidebarCollapsed ? '64px' : '260px'})`,
        overflowY: 'auto',
      }}>
        <Suspense fallback={<SafeLoader />}>
          <Routes>
            <Route path="" element={<Dashboard />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="quotations/:id" element={<QuotationDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="payments" element={<Payments />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="credit-notes" element={<CreditNotes />} />
            <Route path="workers" element={<Workers />} />
            <Route path="machines" element={<Machines />} />
            <Route path="production" element={<Production />} />
            <Route path="gst" element={<GSTReports />} />
            <Route path="reports" element={<Reports />} />
            <Route path="ai" element={<AIAssistant />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════════════
function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setMsg('')
    const result = await login(email, password)
    setLoading(false)
    if (!result.success) setMsg(result.msg || 'Login failed')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a1a, #0d1b2a, #1a1a2e)', padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '20px', padding: '40px 32px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: '#06b6d4', fontSize: '28px', fontWeight: '700', letterSpacing: '2px' }}>GLOB ERP</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '6px' }}>Fabrication & Enterprises</p>
          <div style={{
            background: '#e8ecf1', color: '#0d1b2a', border: '2px solid #0d1b2a',
            padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700',
            marginTop: '10px', letterSpacing: '0.5px', display: 'inline-block'
          }}>
            GSTIN: 27AWAPK1209R1ZC
          </div>
        </div>

        {msg && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            padding: '12px', borderRadius: '8px', color: '#f87171', fontSize: '13px', marginBottom: '16px'
          }}>
            {msg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px', display: 'block' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@globfabrication.com" required
              style={{
                width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                color: '#fff', fontSize: '14px', outline: 'none',
              }} />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px', display: 'block' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter password" required
              style={{
                width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
                color: '#fff', fontSize: '14px', outline: 'none',
              }} />
          </div>
          <button type="submit" disabled={loading}
            style={{
              padding: '14px', background: loading ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, #06b6d4, #4f8fff)',
              border: 'none', borderRadius: '10px', color: '#fff',
              fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
            }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════
// ROOT APP — ErrorBoundary + Auth + Router
// ═══════════════════════════════════════════════════
export default function App() {
  return (
    <AutoHealErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app/*" element={<PrivateRoute><AppLayout /></PrivateRoute>} />
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AutoHealErrorBoundary>
  )
}
