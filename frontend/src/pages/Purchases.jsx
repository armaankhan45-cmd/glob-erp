import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Plus, Search, Eye, Edit, Trash2, ShoppingCart } from 'lucide-react'
import { formatDate, formatCurrency } from '../utils'

export default function Purchases() {
  const [purchases, setPurchases] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { loadPurchases() }, [])

  const loadPurchases = async () => {
    try {
      const res = await api.get('/purchases', { params: search ? { search } : {} })
      setPurchases(res.data.purchases || [])
    } catch {} finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this purchase bill?')) return
    await api.delete(`/purchases/${id}`)
    loadPurchases()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchase Bills</h1>
          <p className="text-gray-500 text-sm">Track input GST from supplier bills</p>
        </div>
        <Link to="/app/purchases/new" className="btn-primary flex items-center gap-2"><Plus size={18} /> New Purchase Bill</Link>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value) loadPurchases() }} placeholder="Search purchases..." className="input-field pl-10" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-12"><ShoppingCart size={48} className="mx-auto text-gray-300 mb-3" /><p className="text-gray-400">No purchase bills yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Bill #</th>
                <th className="pb-2 font-medium">Supplier</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium text-center">Payment</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr></thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 font-medium">{p.bill_number}</td>
                    <td className="py-3">{p.supplier_name}</td>
                    <td className="py-3 text-gray-500">{formatDate(p.bill_date)}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(p.total_amount)}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.payment_status === 'Paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{p.payment_status}</span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/app/purchases/${p.id}`)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="View"><Eye size={16} className="text-gray-500" /></button>
                        <button onClick={() => navigate(`/app/purchases/${p.id}/edit`)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit"><Edit size={16} className="text-blue-500" /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Delete"><Trash2 size={16} className="text-red-500" /></button>
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
