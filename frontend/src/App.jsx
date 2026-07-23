import React, { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'
import Dashboard from './pages/Dashboard'
import InvoiceDetail from './pages/InvoiceDetail'
import Settings from './pages/Settings'

const Invoices       = lazy(() => import('./pages/Invoices'))
const Quotations     = lazy(() => import('./pages/Quotations'))
const QuotationDetail = lazy(() => import('./pages/QuotationDetail'))
const Customers      = lazy(() => import('./pages/Customers'))
const Purchases      = lazy(() => import('./pages/Purchases'))
const GSTReports     = lazy(() => import('./pages/GSTReports'))
const Reports        = lazy(() => import('./pages/Reports'))
const AIAssistant    = lazy(() => import('./pages/AIAssistant'))

// Only the sections the user wants
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

function InlineLoader() {
  return (
    <div className="flex flex-col items-center justify-center h-96">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-white/30 mt-3">Loading...</p>
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
    <div className="min-h-screen flex" style={{ background: '#080b14' }}>
      {sidebarOpen && (
        <aside className="w-[260px] flex-shrink-0 fixed h-screen overflow-y-auto z-40" style={{ background: 'linear-gradient(180deg, #0d1b2a, #1a1a2e)', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '20px 16px' }}>
          <div className="mb-6 px-2">
            <h2 className="text-lg font-bold tracking-wide" style={{ color: '#06b6d4', letterSpacing: 1 }}>GLOB ERP</h2>
            <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.3)' }}>Fabrication & Enterprises</p>
            <div className="gstin-badge mt-2">GSTIN: 27AWAPK1209R1ZC</div>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map(item => {
              const isActive = currentPath === item.path || (item.path === '/app' && currentPath === '/app')
              return (
                <Link key={item.id} to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${isActive ? 'text-cyan-400 bg-white/5 border border-white/10' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                  <span className="text-base">{item.icon}</span>{item.label}
                </Link>
              )
            })}
          </nav>
          <div className="mt-10 pt-5 border-t border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #06b6d4, #4f8fff)' }}>{user?.name?.charAt(0)?.toUpperCase() || 'A'}</div>
              <div>
                <p className="text-sm font-semibold text-white">{user?.name || 'Admin'}</p>
                <p className="text-xs text-white/30">{user?.role || 'admin'}</p>
              </div>
            </div>
            <button onClick={() => { logout(); navigate('/login') }} className="w-full mt-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>Logout</button>
          </div>
        </aside>
      )}
      <main className="min-h-screen overflow-y-auto p-6" style={{ marginLeft: sidebarOpen ? 260 : 0, width: sidebarOpen ? 'calc(100% - 260px)' : '100%' }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="mb-4 px-3 py-2 rounded-lg text-xs cursor-pointer" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
          {sidebarOpen ? '← Collapse' : '→ Open sidebar'}
        </button>
        <Suspense fallback={<InlineLoader />}>
          <Routes>
            <Route path="" element={<Dashboard />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="quotations" element={<Quotations />} />
            <Route path="quotations/:id" element={<QuotationDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="purchases" element={<Purchases />} />
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
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#06080f' }}>
      <div className="max-w-lg w-full rounded-2xl p-8" style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{ color: '#06b6d4', letterSpacing: 2 }}>GLOB ERP</h1>
          <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Fabrication & Enterprises</p>
          <div className="gstin-badge mt-3">GSTIN: 27AWAPK1209R1ZC</div>
        </div>
        {msg && <div className="rounded-lg p-3 mb-4 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>{msg}</div>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgba(255,255,255,0.5)' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@globfabrication.com" required className="input-field" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-2 block" style={{ color: 'rgba(255,255,255,0.5)' }}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required className="input-field" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base font-bold" style={{ padding: 14, fontSize: 15 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
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
