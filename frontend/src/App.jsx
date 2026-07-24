// ═══════════════════════════════════════════════════════════════════
// App.jsx — Uses MainLayout with Sidebar + TopBar + Theme switching
// ═══════════════════════════════════════════════════════════════════

import { useState, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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

// ─── Login page ───
function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setMsg('')
    const result = await login(email, password)
    setLoading(false)
    if (result.success) navigate('/app/dashboard')
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
            </Route>
            <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/app/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </AutoHealErrorBoundary>
  )
}
