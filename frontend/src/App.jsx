import AutoHealErrorBoundary from './components/AutoHealErrorBoundary'

// Wrap your entire app content in the boundary
<AutoHealErrorBoundary>
  <AllYourAppRoutes />
</AutoHealErrorBoundary>
import { Routes, Route, Navigate } from 'react-router-dom'
import { Component } from 'react'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/Invoices'
import InvoiceNew from './pages/InvoiceNew'
import InvoiceDetail from './pages/InvoiceDetail'
import InvoiceEdit from './pages/InvoiceEdit'
import Quotations from './pages/Quotations'
import QuotationDetail from './pages/QuotationDetail'
import QuotationForm from './pages/QuotationForm'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import CustomerNew from './pages/CustomerNew'
import CustomerEdit from './pages/CustomerEdit'
import Purchases from './pages/Purchases'
import PurchaseNew from './pages/PurchaseNew'
import PurchaseDetail from './pages/PurchaseDetail'
import PurchaseEdit from './pages/PurchaseEdit'
import GSTReports from './pages/GSTReports'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import FontSettings from './pages/FontSettings'
import ExportData from './pages/ExportData'
import Diagnostics from './pages/Diagnostics'
import AIAssistant from './pages/AIAssistant'
import DeployControl from './pages/DeployControl'
import MainLayout from './layouts/MainLayout'
import LandingPage from './pages/LandingPage'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('App crashed:', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#080b14', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif' }}>
          <div style={{ maxWidth: '500px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>Something went wrong</h1>
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', padding: '12px', marginBottom: '20px', fontSize: '12px', fontFamily: 'monospace', color: '#f87171', textAlign: 'left', wordBreak: 'break-all' }}>
              {this.state.error?.message || 'Unknown error'}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => window.location.reload()} style={{ padding: '10px 24px', borderRadius: '12px', background: 'linear-gradient(135deg, #06b6d4, #22d3ee)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Reload Page</button>
              <button onClick={() => { localStorage.clear(); window.location.href = '/login' }} style={{ padding: '10px 24px', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', fontWeight: 600, cursor: 'pointer' }}>Clear & Login</button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#080b14' }}><div style={{ width: 40, height: 40, border: '3px solid rgba(6,182,212,0.2)', borderTopColor: '#06b6d4', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/app" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="dashboard" />} />
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
          <Route path="settings" element={<Settings />} />
          <Route path="font-settings" element={<FontSettings />} />
          <Route path="export" element={<ExportData />} />
          <Route path="diagnostics" element={<Diagnostics />} />
          <Route path="ai-assistant" element={<AIAssistant />} />
          <Route path="deploy" element={<DeployControl />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}
