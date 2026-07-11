import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { Plus, Search, Eye, Edit, Trash2, Copy, FileSpreadsheet } from 'lucide-react'
import { formatDate, formatCurrency } from '../utils'

export default function Quotations() {
  const [quotations, setQuotations] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [boldOn, setBoldOn] = useState(() => localStorage.getItem('quotBold') === 'true')
  const navigate = useNavigate()

  useEffect(() => { loadQuotations() }, [])

  const loadQuotations = async () => {
    try {
      const res = await api.get('/quotations')
      setQuotations(res.data.quotations || [])
    } catch {} finally { setLoading(false) }
  }

  const toggleBold = () => { const val = !boldOn; setBoldOn(val); localStorage.setItem('quotBold', val) }

  const deleteQ = async (id) => {
    if (!confirm('Delete this quotation?')) return
    await api.delete(`/quotations/${id}`)
    loadQuotations()
  }

  const duplicate = async (q) => {
    try {
      await api.post('/quotations', {
        customer_name: q.customer_name, additional_info: q.additional_info,
        actual_notes: q.actual_notes, quotation_date: new Date().toISOString().split('T')[0],
        validity_date: null, subtotal: q.subtotal, cgst_amount: q.cgst_amount,
        sgst_amount: q.sgst_amount, igst_amount: q.igst_amount, total_amount: q.total_amount, items: []
      })
      loadQuotations()
    } catch (err) { alert('Duplicate failed') }
  }

  const filtered = search
    ? quotations.filter(q => q.quotation_number?.toLowerCase().includes(search.toLowerCase()) || q.customer_name?.toLowerCase().includes(search.toLowerCase()))
    : quotations

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" style={{ animation: 'entranceUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div>
          <h1 className="text-2xl font-bold text-white">Quotations</h1>
          <p className="text-white/35 text-sm">Manage your quotations</p>
        </div>
        <div className="flex gap-3">
          <button onClick={toggleBold} className={`px-4 py-2 rounded-xl font-medium text-sm transition-all btn-shine ${boldOn ? 'btn-primary' : 'btn-secondary'}`}>
            Bold {boldOn ? 'ON' : 'OFF'}
          </button>
          <Link to="/app/quotations/new" className="btn-primary flex items-center gap-2 btn-shine"><Plus size={18} /> New Quotation</Link>
        </div>
      </div>

      <div className="card card-premium">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-2.5 text-white/25" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations..." className="input-field pl-10" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet size={48} className="mx-auto text-white/15 mb-3" />
            <p className="text-white/25">No quotations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="nebula-table">
              <thead><tr>
                <th>Quotation #</th><th>Customer</th><th>Date</th><th className="text-right">Amount</th><th className="text-center">Status</th><th className="text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((q, i) => (
                  <tr key={q.id} className="anim-row cursor-pointer" style={{ animationDelay: `${i * 0.03}s` }} onClick={() => navigate(`/app/quotations/${q.id}`)}>
                    <td className="font-semibold accent-text">{q.quotation_number}</td>
                    <td className="text-white font-medium" style={{ fontWeight: boldOn ? 'bold' : '500' }}>{q.customer_name || 'N/A'}</td>
                    <td className="text-white/50">{formatDate(q.quotation_date)}</td>
                    <td className="text-right font-semibold text-white">{formatCurrency(q.total_amount)}</td>
                    <td className="text-center">
                      <span className={`status-badge ${q.status === 'Converted' ? 'status-paid' : q.status === 'Sent' ? 'status-sent' : 'status-draft'}`}>{q.status}</span>
                    </td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/app/quotations/${q.id}`)} className="action-icon"><Eye size={16} /></button>
                        <button onClick={() => navigate(`/app/quotations/${q.id}/edit`)} className="action-icon text-blue-400"><Edit size={16} /></button>
                        <button onClick={() => duplicate(q)} className="action-icon text-green-400"><Copy size={16} /></button>
                        <button onClick={() => deleteQ(q.id)} className="action-icon text-red-400"><Trash2 size={16} /></button>
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
