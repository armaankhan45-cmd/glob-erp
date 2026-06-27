import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { ArrowLeft, Edit, Trash2 } from 'lucide-react'
import { formatCurrency, formatDate } from '../utils'

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

  if (!customer) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/customers')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <h1 className="text-2xl font-bold flex-1">{customer.name}</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card text-center"><p className="text-sm text-gray-500">Total Business</p><p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalBusiness)}</p></div>
        <div className="card text-center"><p className="text-sm text-gray-500">Paid</p><p className="text-xl font-bold text-blue-600">{formatCurrency(stats.totalPaid)}</p></div>
        <div className="card text-center"><p className="text-sm text-gray-500">Outstanding</p><p className="text-xl font-bold text-red-600">{formatCurrency(stats.outstanding)}</p></div>
      </div>

      {/* Details */}
      <div className="card">
        <h3 className="font-bold mb-3">Customer Details</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">GSTIN:</span> <span className="font-mono">{customer.gstin || 'N/A'}</span></div>
          <div><span className="text-gray-500">Phone:</span> {customer.phone || 'N/A'}</div>
          <div><span className="text-gray-500">Email:</span> {customer.email || 'N/A'}</div>
          <div><span className="text-gray-500">State:</span> {customer.state} ({customer.state_code})</div>
          <div><span className="text-gray-500">Address:</span> {customer.address}, {customer.city} - {customer.pincode}</div>
          <div><span className="text-gray-500">Business Type:</span> {customer.business_type || 'N/A'}</div>
        </div>
      </div>

      {/* Invoice History */}
      <div className="card">
        <h3 className="font-bold mb-3">Invoice History</h3>
        {invoices.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No invoices yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Invoice #</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium text-center">Status</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-gray-50">
                    <td className="py-2"><Link to={`/app/invoices/${inv.id}`} className="text-primary-600 hover:underline">{inv.invoice_number}</Link></td>
                    <td className="py-2 text-gray-500">{formatDate(inv.invoice_date)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(inv.total_amount)}</td>
                    <td className="py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.payment_status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{inv.payment_status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Link({ to, children, className }) {
  return <a href={to} className={className}>{children}</a>
}
