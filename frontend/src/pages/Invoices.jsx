import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Plus, Search, Eye, Edit, Trash2, FileText } from 'lucide-react'
import { formatCurrency, formatDate } from '../utils'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [stats, setStats] = useState({})
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadInvoices() }, [search, status])

  const loadInvoices = async () => {
    try {
      const params = {}
      if (search) params.search = search
      if (status !== 'All') params.status = status
      const res = await api.get('/invoices', { params })
      setInvoices(res.data.invoices || [])
      setStats(res.data.stats || {})
    } catch (err) {
      console.error('Load invoices error:', err)
    } finally {
      setLoading(false)
    }
  }

  const deleteInvoice = async (id) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    try {
      await api.delete(`/invoices/${id}`)
      loadInvoices()
    } catch (err) {
      alert(err.response?.data?.msg || 'Delete failed')
    }
  }

  const statCards = [
    { label: 'Total Bills', value: stats.total_bills || 0 },
    { label: 'Total Amount', value: formatCurrency(stats.total_amount) },
    { label: 'Paid', value: formatCurrency(stats.total_paid) },
    { label: 'Outstanding', value: formatCurrency(stats.outstanding) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GST Invoices</h1>
          <p className="text-gray-500 text-sm">Manage your sales invoices</p>
        </div>
        <Link to="/app/invoices/new" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> New Invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <div key={i} className="card text-center">
            <p className="text-sm text-gray-500">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="input-field pl-10" />
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input-field w-auto">
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Paid">Paid</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No invoices found</p>
            <Link to="/app/invoices/new" className="text-primary-600 text-sm hover:underline mt-2 inline-block">Create your first invoice</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Invoice #</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium text-center">Status</th>
                <th className="pb-2 font-medium text-center">Payment</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr></thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3"><Link to={`/app/invoices/${inv.id}`} className="text-primary-600 hover:underline font-medium">{inv.invoice_number}</Link></td>
                    <td className="py-3">{inv.customer_name || 'N/A'}</td>
                    <td className="py-3 text-gray-500">{formatDate(inv.invoice_date)}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(inv.total_amount)}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{inv.status}</span>
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.payment_status === 'Paid' ? 'bg-green-100 text-green-700' : inv.payment_status === 'Partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{inv.payment_status}</span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/app/invoices/${inv.id}`)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="View"><Eye size={16} className="text-gray-500" /></button>
                        <button onClick={() => navigate(`/app/invoices/${inv.id}/edit`)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit"><Edit size={16} className="text-blue-500" /></button>
                        <button onClick={() => deleteInvoice(inv.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Delete"><Trash2 size={16} className="text-red-500" /></button>
                      </div>
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
