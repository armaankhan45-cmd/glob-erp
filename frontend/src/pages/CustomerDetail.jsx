import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Edit, Trash2, Phone, Mail, MapPin, Hash, Building2, User, FileText, IndianRupee } from 'lucide-react'
import { formatCurrency, formatDate, parseGSTIN } from '../utils'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [stats, setStats] = useState({})

  useEffect(() => { loadCustomer() }, [id])

  const loadCustomer = async () => {
    try {
      const res = await api.get(`/customers/${id}`)
      setCustomer(res.data.customer)
      setInvoices(res.data.invoices || [])
      setStats({ totalBusiness: res.data.totalBusiness, totalPaid: res.data.totalPaid, outstanding: res.data.outstanding })
    } catch {
      navigate('/app/customers')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this customer?')) return
    try {
      await api.delete(`/customers/${id}`)
      navigate('/app/customers')
    } catch (err) {
      alert(err.response?.data?.msg || 'Cannot delete customer with invoices')
    }
  }

  if (!customer) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div></div>

  const isIntra = !customer.state_code || customer.state_code === '27'
  const gstinInfo = customer.gstin ? parseGSTIN(customer.gstin) : null
  const paidInvoices = invoices.filter(i => i.payment_status === 'Paid')
  const unpaidInvoices = invoices.filter(i => i.payment_status !== 'Paid')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/customers')} className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white"><ArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{customer.name}</h1>
          {customer.trade_name && customer.trade_name !== customer.name && <p className="text-sm text-white/40">T/A: {customer.trade_name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isIntra ? 'text-cyan-400' : 'text-orange-400'}`}
            style={{ background: isIntra ? 'rgba(6,182,212,0.12)' : 'rgba(249,115,22,0.12)' }}>
            {isIntra ? 'Intra-State (CGST+SGST)' : `Inter-State (IGST → ${customer.state || customer.state_code})`}
          </span>
          <button onClick={handleDelete} className="btn-danger text-sm flex items-center gap-1"><Trash2 size={14} /> Delete</button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(34,197,94,0.12)' }}><IndianRupee size={20} className="text-green-400" /></div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.totalBusiness)}</p>
          <p className="text-xs text-white/40">Total Business</p>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(59,130,246,0.12)' }}><FileText size={20} className="text-blue-400" /></div>
          <p className="text-xl font-bold text-white">{invoices.length}</p>
          <p className="text-xs text-white/40">Total Invoices</p>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(34,197,94,0.12)' }}><IndianRupee size={20} className="text-green-400" /></div>
          <p className="text-xl font-bold text-green-400">{formatCurrency(stats.totalPaid)}</p>
          <p className="text-xs text-white/40">Paid</p>
        </div>
        <div className="card text-center">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2" style={{ background: 'rgba(239,68,68,0.12)' }}><IndianRupee size={20} className="text-red-400" /></div>
          <p className="text-xl font-bold text-red-400">{formatCurrency(stats.outstanding)}</p>
          <p className="text-xs text-white/40">Outstanding</p>
        </div>
      </div>

      {/* Customer Details Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="card space-y-4">
          <h3 className="font-bold text-white text-lg flex items-center gap-2"><Building2 size={18} className="accent-text" /> Business Details</h3>
          <div className="space-y-3">
            {customer.gstin && (
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Hash size={16} className="text-white/30 mt-0.5" />
                <div>
                  <p className="text-xs text-white/40">GSTIN</p>
                  <p className="font-mono text-white font-medium">{customer.gstin}</p>
                  {gstinInfo && (
                    <div className="flex gap-3 mt-1 text-xs text-white/50">
                      <span>State: {gstinInfo.state}</span>
                      <span>PAN: {gstinInfo.pan}</span>
                      <span>Type: {gstinInfo.entity_type}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {customer.business_type && (
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Building2 size={16} className="text-white/30 mt-0.5" />
                <div>
                  <p className="text-xs text-white/40">Business Type</p>
                  <p className="text-white">{customer.business_type}</p>
                </div>
              </div>
            )}
            {customer.contact_person && (
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <User size={16} className="text-white/30 mt-0.5" />
                <div>
                  <p className="text-xs text-white/40">Contact Person</p>
                  <p className="text-white">{customer.contact_person}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact Info */}
        <div className="card space-y-4">
          <h3 className="font-bold text-white text-lg flex items-center gap-2"><Phone size={18} className="accent-text" /> Contact & Address</h3>
          <div className="space-y-3">
            {customer.phone && (
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Phone size={16} className="text-white/30 mt-0.5" />
                <div>
                  <p className="text-xs text-white/40">Phone</p>
                  <p className="text-white">{customer.phone}</p>
                </div>
              </div>
            )}
            {customer.email && (
              <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Mail size={16} className="text-white/30 mt-0.5" />
                <div>
                  <p className="text-xs text-white/40">Email</p>
                  <p className="text-white">{customer.email}</p>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <MapPin size={16} className="text-white/30 mt-0.5" />
              <div>
                <p className="text-xs text-white/40">Address</p>
                <p className="text-white">{customer.address || 'N/A'}</p>
                <p className="text-white/50 text-sm">{[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}</p>
                {customer.state_code && <p className="text-xs text-white/30 mt-1">State Code: {customer.state_code}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-lg">Invoice History ({invoices.length})</h3>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', color: '#4ade80' }}>{paidInvoices.length} Paid</span>
            <span className="px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>{unpaidInvoices.length} Unpaid</span>
          </div>
        </div>
        {invoices.length === 0 ? (
          <p className="text-white/30 text-center py-8">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/5 text-left text-white/40">
                <th className="pb-2 font-medium">Invoice #</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium text-center">Status</th>
                <th className="pb-2 font-medium text-center">GST Type</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => {
                  const hasIgst = parseFloat(inv.igst_amount) > 0
                  return (
                    <tr key={inv.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-3"><Link to={`/app/invoices/${inv.id}`} className="accent-text hover:underline font-medium">{inv.invoice_number}</Link></td>
                      <td className="py-3 text-white/40">{formatDate(inv.invoice_date)}</td>
                      <td className="py-3 text-right font-medium text-white">{formatCurrency(inv.total_amount)}</td>
                      <td className="py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.payment_status === 'Paid' ? 'text-green-400' : inv.payment_status === 'Partial' ? 'text-yellow-400' : 'text-red-400'}`}
                          style={{ background: inv.payment_status === 'Paid' ? 'rgba(34,197,94,0.1)' : inv.payment_status === 'Partial' ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)' }}>
                          {inv.payment_status}
                        </span>
                      </td>
                      <td className="py-3 text-center">
                        <span className={`text-xs font-medium ${hasIgst ? 'text-orange-400' : 'text-cyan-400'}`}>
                          {hasIgst ? 'IGST' : 'CGST+SGST'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
