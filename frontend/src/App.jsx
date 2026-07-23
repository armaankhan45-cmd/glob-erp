// ═══════════════════════════════════════════════════════════════════
// App.jsx — FIXED VERSION — No stuck loading overlay!
// 
// BUG THAT WAS FIXED:
// The old code had a "page-transition-overlay" that covered the entire
// app with opacity:h?0:1 where h started as false.
// h=false → opacity=1 → overlay VISIBLE → loading circle STUCK FOREVER!
// The setTimeout(()=>setIsLoaded(true),600) that should hide it
// was getting cleared by React StrictMode's double-mount cleanup.
// This overlay had z-index:100000 and pointerEvents:"all" which
// blocked ALL interaction with the app underneath it.
//
// FIX: Removed the broken overlay entirely. The app now shows content
// immediately after auth check completes. No stuck loading circle.
// ═══════════════════════════════════════════════════════════════════

import { useState, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'

// NOTE: BrowserRouter is in main.jsx, NOT here
// This prevents "cannot render Routes outside BrowserRouter" error

// ─── Lazy load pages ───
// If a page fails to load, show a fallback instead of crashing the whole app
function PageFallback({ name }) {
  return (
    <div className="p-8 text-center">
      <h2 style={{ color: '#06b6d4', fontSize: '18px' }}>{name}</h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '8px' }}>
        Page loading... if stuck, try refreshing.
      </p>
    </div>
  )
}

const Login          = lazy(() => import('./pages/Login').catch(() => ({ default: () => <PageFallback name="Login" /> })))
const Dashboard      = lazy(() => import('./pages/Dashboard').catch(() => ({ default: () => <PageFallback name="Dashboard" /> })))
const Invoices       = lazy(() => import('./pages/Invoices').catch(() => ({ default: () => <PageFallback name="Invoices" /> })))
const InvoiceDetail  = lazy(() => import('./pages/InvoiceDetail').catch(() => ({ default: () => <PageFallback name="Invoice Detail" /> })))
const Quotations     = lazy(() => import('./pages/Quotations').catch(() => ({ default: () => <PageFallback name="Quotations" /> })))
const QuotationDetail = lazy(() => import('./pages/QuotationDetail').catch(() => ({ default: () => <PageFallback name="Quotation Detail" /> })))
const Customers      = lazy(() => import('./pages/Customers').catch(() => ({ default: () => <PageFallback name="Customers" /> })))
const Purchases      = lazy(() => import('./pages/Purchases').catch(() => ({ default: () => <PageFallback name="Purchases" /> })))
const Payments       = lazy(() => import('./pages/Payments').catch(() => ({ default: () => <PageFallback name="Payments" /> })))
const Expenses       = lazy(() => import('./pages/Expenses').catch(() => ({ default: () => <PageFallback name="Expenses" /> })))
const Suppliers      = lazy(() => import('./pages/Suppliers').catch(() => ({ default: () => <PageFallback name="Suppliers" /> })))
const Inventory      = lazy(() => import('./pages/Inventory').catch(() => ({ default: () => <PageFallback name="Inventory" /> })))
const CreditNotes    = lazy(() => import('./pages/CreditNotes').catch(() => ({ default: () => <PageFallback name="Credit Notes" /> })))
const Workers        = lazy(() => import('./pages/Workers').catch(() => ({ default: () => <PageFallback name="Workers" /> })))
const Machines       = lazy(() => import('./pages/Machines').catch(() => ({ default: () => <PageFallback name="Machines" /> })))
const Production     = lazy(() => import('./pages/Production').catch(() => ({ default: () => <PageFallback name="Production" /> })))
const GSTReports     = lazy(() => import('./pages/GSTReports').catch(() => ({ default: () => <PageFallback name="GST Reports" /> })))
const Reports        = lazy(() => import('./pages/Reports').catch(() => ({ default: () => <PageFallback name="Reports" /> })))
const AIAssistant    = lazy(() => import('./pages/AIAssistant').catch(() => ({ default: () => <PageFallback name="AI Assistant" /> })))
const Settings       = lazy(() => import('./pages/Settings').catch(() => ({ default: () => <PageFallback name="Settings" /> })))

// ─── Simple loading indicator (NOT a stuck overlay!) ───
// This shows INSIDE the content area, not blocking the whole screen
function InlineLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', gap: '12px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
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

// ─── Sidebar navigation ───
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
  { id: 'ai', label: 'AI Assistant', icon: '🤖', path: '/app/ai-assistant' },
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/app/settings' },
]

// ─── Main app layout (sidebar + content) ───
function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const currentPath = location.pathname

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#080b14' }}>
      {/* ─── SIDEBAR ─── */}
      {sidebarOpen && (
        <aside style={{
          width: '260px', background: 'linear-gradient(180deg, #0d1b2a, #1a1a2e)',
          borderRight: '1px solid rgba(255,255,255,0.06)', padding: '20px 16px',
          overflowY: 'auto', flexShrink: 0, position: 'fixed', height: '100vh', zIndex: 40,
        }}>
          {/* Logo */}
          <div style={{ marginBottom: '24px', padding: '0 8px' }}>
            <h2 style={{ color: '#06b6d4', fontSize: '18px', fontWeight: '700', letterSpacing: '1px' }}>GLOB ERP</h2>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>Fabrication & Enterprises</p>
            {/* GSTIN badge — light gray bg + navy border (print-safe, always visible) */}
            <div style={{
              background: '#e8ecf1', color: '#0d1b2a', border: '2px solid #0d1b2a',
              padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700',
              marginTop: '8px', letterSpacing: '0.5px', display: 'inline-block'
            }}>
              GSTIN: 27AWAPK1209R1ZC
            </div>
          </div>

          {/* Nav items */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {NAV.map(item => {
              const isActive = currentPath === item.path || (item.path === '/app' && currentPath === '/app')
              return (
                <a key={item.id} href={item.path} onClick={(e) => { e.preventDefault(); navigate(item.path) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '10px',
                    color: isActive ? '#06b6d4' : 'rgba(255,255,255,0.6)', fontSize: '13px',
                    textDecoration: 'none', fontWeight: isActive ? '600' : '400',
                    background: isActive ? 'rgba(6,182,212,0.08)' : 'transparent',
                    border: isActive ? '1px solid rgba(6,182,212,0.15)' : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}>
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  {item.label}
                </a>
              )
            })}
          </nav>

          {/* User + Logout */}
          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
            <button onClick={handleLogout} style={{
              marginTop: '12px', width: '100%', padding: '8px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: '8px', color: '#f87171', fontSize: '12px', cursor: 'pointer', fontWeight: '600',
            }}>
              Logout
            </button>
          </div>
        </aside>
      )}

      {/* ─── MAIN CONTENT (NO overlay blocking it!) ─── */}
      <main style={{
        marginLeft: sidebarOpen ? '260px' : '0',
        padding: '24px', minHeight: '100vh', width: sidebarOpen ? 'calc(100% - 260px)' : '100%',
        overflowY: 'auto', transition: 'margin-left 0.3s ease',
      }}>
        {/* Toggle sidebar button */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
          marginBottom: '16px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
          color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer',
        }}>
          {sidebarOpen ? '← Collapse sidebar' : '→ Open sidebar'}
        </button>

        {/* Page content — loads lazily, shows inline loader while loading */}
        <Suspense fallback={<InlineLoader />}>
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
            <Route path="ai-assistant" element={<AIAssistant />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

// ─── Login page ───
function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setMsg('')
    const result = await login(email, password)
    setLoading(false)
    if (result.success) {
      navigate('/app')
    } else {
      setMsg(result.msg || 'Login failed')
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#06080f', padding: '20px'
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
          {/* GSTIN badge — always visible */}
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
              style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px', display: 'block' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Enter password" required
              style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none' }} />
          </div>
          <button type="submit" disabled={loading} style={{
            padding: '14px', background: loading ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, #06b6d4, #4f8fff)',
            border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '20px' }}>
          First visit may take 30s (server waking up from sleep)
        </p>
      </div>
    </div>
  )
}

// ─── Root App ───
export default function App() {
  return (
    <AutoHealErrorBoundary>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/app/*" element={<PrivateRoute><AppLayout /></PrivateRoute>} />
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </AuthProvider>
    </AutoHealErrorBoundary>
  )
}
