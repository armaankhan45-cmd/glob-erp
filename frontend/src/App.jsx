import { Routes, Route, Navigate } from 'react-router-dom'
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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>
  if (!user) return <Navigate to="/login" />
  return children
}

export default function App() {
  return (
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
        <Route path="customers/:id" element={<CustomerDetail />} />
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
  )
}
