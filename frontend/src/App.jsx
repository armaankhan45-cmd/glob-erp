import React, { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'
import Dashboard from './pages/Dashboard'
import InvoiceDetail from './pages/InvoiceDetail'
import Settings from './pages/Settings'

function PageFallback({ name }) {
  return <div style={{ padding: 40, color: '#06b6d4', fontSize: 20 }}>{name} — page not found on GitHub yet</div>
}

const lazyPage = (name) => lazy(() => import(`./pages/${name}`).catch(() => ({ default: () => <PageFallback name={name} /> })))

const Invoices       = lazyPage('Invoices')
const Quotations     = lazyPage('Quotations')
const QuotationDetail = lazyPage('QuotationDetail')
const Customers      = lazyPage('Customers')
const Purchases      = lazyPage('Purchases')
const Payments       = lazyPage('Payments')
const Expenses       = lazyPage('Expenses')
const Suppliers      = lazyPage('Suppliers')
const Inventory      = lazyPage('Inventory')
const CreditNotes    = lazyPage('CreditNotes')
const Workers        = lazyPage('Workers')
const Machines       = lazyPage('Machines')
const Production     = lazyPage('Production')
const GSTReports     = lazyPage('GSTReports')
const Reports        = lazyPage('Reports')
const AIAssistant    = lazyPage('AIAssistant')

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

function InlineLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 12 }}>
      <div style={{ width: 24, height: 24, border: '2px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function PrivateRoute({ children }) {
  const { user, initialized } = useAuth()
  if (!initialized) return <InlineLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const currentPath = location.pathname

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#080b14' }}>
      {sidebarOpen && (
        <aside style={{ width: 260, background: 'linear-gradient(180deg, #0d1b2a, #1a1a2e)', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '20px 16px', overflowY: 'auto', flexShrink: 0, position: 'fixed', height: '100vh', zIndex: 40 }}>
          <div style={{ marginBottom: 24, padding: '0 8px' }}>
            <h2 style={{ color: '#06b6d4', fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>GLOB ERP</h2>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>Fabrication & Enterprises</p>
            <div style={{ background: '#e8ecf1', color: '#0d1b2a', border: '2px solid #0d1b2a', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, marginTop: 8, letterSpacing: 0.5, display: 'inline-block' }}>GSTIN: 27AWAPK1209R1ZC</div>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {NAV.map(item => {
              const isActive = currentPath === item.path || (item.path === '/app' && currentPath === '/app')
              return (
                <a key={item.id} href={item.path} onClick={(e) => { e.preventDefault(); navigate(item.path) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, color: isActive ? '#06b6d4' : 'rgba(255,255,255,0.6)', fontSize: 13, textDecoration: 'none', fontWeight: isActive ? 600 : 400, background: isActive ? 'rgba(6,182,212,0.08)' : 'transparent', border: isActive ? '1px solid rgba(6,182,212,0.15)' : '1px solid transparent', transition: 'all 0.2s' }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
                </a>
              )
            })}
          </nav>
          <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, #06b6d4, #4f8fff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}>{user?.name?.charAt(0)?.toUpperCase() || 'A'}</div>
              <div>
                <p style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{user?.name || 'Admin'}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>{user?.role || 'admin'}</p>
              </div>
            </div>
            <button onClick={() => { logout(); navigate('/login') }} style={{ marginTop: 12, width: '100%', padding: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: '#f87171', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Logout</button>
          </div>
        </aside>
      )}
      <main style={{ marginLeft: sidebarOpen ? 260 : 0, padding: 24, minHeight: '100vh', width: sidebarOpen ? 'calc(100% - 260px)' : '100%', overflowY: 'auto' }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ marginBottom: 16, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}>{sidebarOpen ? '← Collapse' : '→ Open sidebar'}</button>
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

function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); setMsg(''); const result = await login(email, password); setLoading(false); if (result.success) navigate('/app'); else setMsg(result.msg || 'Login failed') }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#06080f', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '40px 32px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ color: '#06b6d4', fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>GLOB ERP</h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6 }}>Fabrication & Enterprises</p>
          <div style={{ background: '#e8ecf1', color: '#0d1b2a', border: '2px solid #0d1b2a', padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, marginTop: 10, letterSpacing: 0.5, display: 'inline-block' }}>GSTIN: 27AWAPK1209R1ZC</div>
        </div>
        {msg && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', padding: 12, borderRadius: 8, color: '#f87171', fontSize: 13, marginBottom: 16 }}>{msg}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6, display: 'block' }}>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@globfabrication.com" required style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }} /></div>
          <div><label style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 6, display: 'block' }}>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' }} /></div>
          <button type="submit" disabled={loading} style={{ padding: 14, background: loading ? 'rgba(6,182,212,0.3)' : 'linear-gradient(135deg, #06b6d4, #4f8fff)', border: 'none', borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  )
}

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
