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
          <h1 className="text-2xl font-bold text-white">Purchase Bills</h1>
          <p className="text-white/40 text-sm">Track input GST from supplier bills</p>
        </div>
        <Link to="/app/purchases/new" className="btn-primary flex items-center gap-2"><Plus size={18} /> New Purchase Bill</Link>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-2.5 text-white/30" />
          <input value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value) loadPurchases() }} placeholder="Search purchases..." className="input-field pl-10" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div></div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-12"><ShoppingCart size={48} className="mx-auto text-white/20 mb-3" /><p className="text-white/30">No purchase bills yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="nebula-table">
              <thead><tr>
                <th>Bill #</th>
                <th>Supplier</th>
                <th>Date</th>
                <th className="text-right">Amount</th>
                <th className="text-center">Payment</th>
                <th className="text-right">Actions</th>
              </tr></thead>
              <tbody>
                {purchases.map((p, i) => (
                  <tr key={p.id} className="anim-row" style={{ animationDelay: `${i * 0.03}s` }}>
                    <td className="font-semibold accent-text">{p.bill_number}</td>
                    <td className="text-white">{p.supplier_name}</td>
                    <td className="text-white/50">{formatDate(p.bill_date)}</td>
                    <td className="text-right font-semibold text-white">{formatCurrency(p.total_amount)}</td>
                    <td className="text-center">
                      <span className={`status-badge ${p.payment_status === 'Paid' ? 'status-paid' : 'status-overdue'}`}>{p.payment_status}</span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/app/purchases/${p.id}`)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 transition-all duration-200 active:scale-90" title="View"><Eye size={16} /></button>
                        <button onClick={() => navigate(`/app/purchases/${p.id}/edit`)} className="p-1.5 rounded-lg text-white/40 hover:text-blue-400 hover:bg-white/5 transition-all duration-200 active:scale-90" title="Edit"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5 transition-all duration-200 active:scale-90" title="Delete"><Trash2 size={16} /></button>
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
