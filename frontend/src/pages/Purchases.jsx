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
      <div className="flex items-center justify-between" style={{ animation: 'entranceUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div>
          <h1 className="text-2xl font-bold text-white">Purchase Bills</h1>
          <p className="text-white/35 text-sm">Track input GST from suppliers</p>
        </div>
        <Link to="/app/purchases/new" className="btn-primary flex items-center gap-2 btn-shine"><Plus size={18} /> New Purchase</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 stagger">
        {[
          { label: 'Total Bills', value: purchases.length, color: '#f97316' },
          { label: 'Total Amount', value: formatCurrency(purchases.reduce((s,p) => s + (parseFloat(p.total_amount)||0), 0)), color: '#8b5cf6' },
          { label: 'Paid', value: purchases.filter(p => p.payment_status === 'Paid').length, color: '#22c55e' },
        ].map((s, i) => (
          <div key={i} className="stat-card card-premium" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="shimmer"></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{s.label}</span>
            <p className="text-xl font-extrabold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="card card-premium">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-2.5 text-white/25" />
          <input value={search} onChange={e => { setSearch(e.target.value); if (!e.target.value) loadPurchases() }} placeholder="Search purchases..." className="input-field pl-10" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div></div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-12"><ShoppingCart size={48} className="mx-auto text-white/15 mb-3" /><p className="text-white/25">No purchase bills yet</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="nebula-table">
              <thead><tr>
                <th>Bill #</th><th>Supplier</th><th>Date</th><th className="text-right">Amount</th><th className="text-center">Payment</th><th className="text-right">Actions</th>
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
                        <button onClick={() => navigate(`/app/purchases/${p.id}`)} className="action-icon"><Eye size={16} /></button>
                        <button onClick={() => navigate(`/app/purchases/${p.id}/edit`)} className="action-icon text-blue-400"><Edit size={16} /></button>
                        <button onClick={() => handleDelete(p.id)} className="action-icon text-red-400"><Trash2 size={16} /></button>
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
