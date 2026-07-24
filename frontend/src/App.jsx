// ═══════════════════════════════════════════════════════════════════
// App.jsx — COMPLETE: All pages + detail/edit/new routes
//
// BUILD FIX: Removed lazy imports for 8 removed sections
// (Payments, Expenses, Suppliers, Inventory, CreditNotes, Workers,
// Machines, Production) — not in sidebar, not needed.
//
// ADDED: Routes for CustomerNew, CustomerEdit, CustomerDetail,
// InvoiceNew, InvoiceEdit, QuotationForm, PurchaseNew,
// PurchaseEdit, PurchaseDetail
// ═══════════════════════════════════════════════════════════════════

import { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'

// ─── Lazy load pages ───
function PageFallback({ name }) {
  return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <h2 style={{ color: '#06b6d4', fontSize: '20px' }}>{name}</h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
        Page loading or updating. Try refreshing if stuck.
      </p>
    </div>
  )
}

const Dashboard      = lazy(() => import('./pages/Dashboard').catch(() => ({ default: () => <PageFallback name="Dashboard" /> })))
const Invoices       = lazy(() => import('./pages/Invoices').catch(() => ({ default: () => <PageFallback name="Invoices" /> })))
const InvoiceDetail  = lazy(() => import('./pages/InvoiceDetail').catch(() => ({ default: () => <PageFallback name="Invoice Detail" /> })))
const InvoiceNew     = lazy(() => import('./pages/InvoiceNew').catch(() => ({ default: () => <PageFallback name="New Invoice" /> })))
const InvoiceEdit    = lazy(() => import('./pages/InvoiceEdit').catch(() => ({ default: () => <PageFallback name="Edit Invoice" /> })))
const Quotations     = lazy(() => import('./pages/Quotations').catch(() => ({ default: () => <PageFallback name="Quotations" /> })))
const QuotationDetail = lazy(() => import('./pages/QuotationDetail').catch(() => ({ default: () => <PageFallback name="Quotation Detail" /> })))
const QuotationForm  = lazy(() => import('./pages/QuotationForm').catch(() => ({ default: () => <PageFallback name="New Quotation" /> })))
const Customers      = lazy(() => import('./pages/Customers').catch(() => ({ default: () => <PageFallback name="Customers" /> })))
const CustomerNew    = lazy(() => import('./pages/CustomerNew').catch(() => ({ default: () => <PageFallback name="New Customer" /> })))
const CustomerDetail = lazy(() => import('./pages/CustomerDetail').catch(() => ({ default: () => <PageFallback name="Customer Detail" /> })))
const CustomerEdit   = lazy(() => import('./pages/CustomerEdit').catch(() => ({ default: () => <PageFallback name="Edit Customer" /> })))
const Purchases      = lazy(() => import('./pages/Purchases').catch(() => ({ default: () => <PageFallback name="Purchases" /> })))
const PurchaseNew    = lazy(() => import('./pages/PurchaseNew').catch(() => ({ default: () => <PageFallback name="New Purchase" /> })))
const PurchaseDetail = lazy(() => import('./pages/PurchaseDetail').catch(() => ({ default: () => <PageFallback name="Purchase Detail" /> })))
const PurchaseEdit   = lazy(() => import('./pages/PurchaseEdit').catch(() => ({ default: () => <PageFallback name="Edit Purchase" /> })))
const GSTReports     = lazy(() => import('./pages/GSTReports').catch(() => ({ default: () => <PageFallback name="GST Reports" /> })))
const Reports        = lazy(() => import('./pages/Reports').catch(() => ({ default: () => <PageFallback name="Reports" /> })))
const AIAssistant    = lazy(() => import('./pages/AIAssistant').catch(() => ({ default: () => <PageFallback name="AI Assistant" /> })))
const Settings       = lazy(() => import('./pages/Settings').catch(() => ({ default: () => <PageFallback name="Settings" /> })))

// ─── Small inline loader (NOT a stuck overlay!) ───
function InlineLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', gap: '12px' }}>
      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>Loading page...</span>
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

// ─── Navigation items ───
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/app' },
  { id: 'invoices', label: 'Invoices', icon: '📄', path: '/app/invoices' },
  { id: 'quotations', label: 'Quotations', icon: '📝', path: '/app/quotations' },
  { id: 'customers', label: 'Customers', icon: '👥', path: '/app/customers' },
  { id: 'purchases', label: 'Purchase Bills', icon: '🧾', path: '/app/purchases' },
  { id: 'gst', label: 'GST Reports', icon: '🇮🇳', path: '/app/gst' },
  { id: 'reports', label: 'Reports', icon: '📈', path: '/app/reports' },
  { id: 'ai', label: 'AI Assistant', icon: '🤖', path: '/app/ai-assistant' },
  { id: 'settings', label: 'Settings', icon: '⚙️', path: '/app/settings' },
]

// ─── Main app layout ───
function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const currentPath = location.pathname

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#080b14' }}>
      {/* SIDEBAR */}
      {sidebarOpen && (
        <aside style={{
          width: '260px', background: 'linear-gradient(180deg, #0d1b2a, #1a1a2e)',
          borderRight: '1px solid rgba(255,255,255,0.06)', padding: '20px 16px',
          overflowY: 'auto', flexShrink: 0, position: 'fixed', height: '100vh', zIndex: 40,
        }}>
          <div style={{ marginBottom: '24px', padding: '0 8px' }}>
            <h2 style={{ color: '#06b6d4', fontSize: '18px', fontWeight: '700', letterSpacing: '1px' }}>GLOB ERP</h2>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>Fabrication & Enterprises</p>
            <div style={{ background: '#e8ecf1', color: '#0d1b2a', border: '2px solid #0d1b2a', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', marginTop: '8px', letterSpacing: '0.5px', display: 'inline-block' }}>
              GSTIN: 27AWAPK1209R1ZC
            </div>
          </div>
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
          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #4f8fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '14px', fontWeight: '700' }}>
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div>
                <p style={{ color: '#fff', fontSize: '13px', fontWeight: '600' }}>{user?.name || 'Admin'}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{user?.role || 'admin'}</p>
              </div>
            </div>
            <button onClick={() => { logout(); navigate('/login') }} style={{ marginTop: '12px', width: '100%', padding: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '8px', color: '#f87171', fontSize: '12px', cursor: 'pointer', fontWeight: '600' }}>
              Logout
            </button>
          </div>
        </aside>
      )}
      {/* MAIN CONTENT */}
      <main style={{ marginLeft: sidebarOpen ? '260px' : '0', padding: '24px', minHeight: '100vh', width: sidebarOpen ? 'calc(100% - 260px)' : '100%', overflowY: 'auto' }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ marginBottom: '16px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'rgba(255,255,255,0.4)', fontSize: '12px', cursor: 'pointer' }}>
          {sidebarOpen ? '← Collapse sidebar' : '→ Open sidebar'}
        </button>
        <Suspense fallback={<InlineLoader />}>
          <Routes>
            <Route path="" element={<Dashboard />} />
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
    if (result.success) navigate('/app')
    else setMsg(result.msg || 'Login failed')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06080f', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px', padding: '40px 32px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ color: '#06b6d4', fontSize: '28px', fontWeight: '700', letterSpacing: '2px' }}>GLOB ERP</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', marginTop: '6px' }}>Fabrication & Enterprises</p>
          <div style={{ background: '#e8ecf1', color: '#0d1b2a', border: '2px solid #0d1b2a', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', fontWeight: '700', marginTop: '10px', letterSpacing: '0.5px', display: 'inline-block' }}>GSTIN: 27AWAPK1209R1ZC</div>
        </div>
        {msg && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: '12px', borderRadius: '8px', color: '#f87171', fontSize: '13px', marginBottom: '16px' }}>{msg}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px', display: 'block' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@globfabrication.com" required style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none' }} />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', marginBottom: '6px', display: 'block' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', color: '#fff', fontSize: '14px', outline: 'none' }} />
          </div>
          <button type="submit" disabled={loading} style={{ padding: '14px', background: loading ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, #06b6d4, #4f8fff)', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '11px', marginTop: '20px' }}>First visit may take 30s (server waking up)</p>
      </div>
    </div>
  )
}

// ─── Root App component ───
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
