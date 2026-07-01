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

  const toggleBold = () => {
    const val = !boldOn
    setBoldOn(val)
    localStorage.setItem('quotBold', val)
  }

  const deleteQ = async (id) => {
    if (!confirm('Delete this quotation?')) return
    await api.delete(`/quotations/${id}`)
    loadQuotations()
  }

  const duplicate = async (q) => {
    try {
      await api.post('/quotations', {
        customer_name: q.customer_name,
        additional_info: q.additional_info,
        actual_notes: q.actual_notes,
        quotation_date: new Date().toISOString().split('T')[0],
        validity_date: new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
        subtotal: q.subtotal,
        cgst_amount: q.cgst_amount,
        sgst_amount: q.sgst_amount,
        igst_amount: q.igst_amount,
        total_amount: q.total_amount,
        items: []
      })
      loadQuotations()
    } catch (err) {
      alert('Duplicate failed')
    }
  }

  const filtered = search
    ? quotations.filter(q => q.quotation_number?.toLowerCase().includes(search.toLowerCase()) || q.customer_name?.toLowerCase().includes(search.toLowerCase()))
    : quotations

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Quotations</h1>
          <p className="text-white/55 text-sm">Manage your quotations</p>
        </div>
        <div className="flex gap-3">
          <button onClick={toggleBold} className={`px-4 py-2 rounded-lg font-medium text-sm ${boldOn ? 'bg-white/10 text-white border border-white/15' : 'btn-secondary'}`}>
            Bold {boldOn ? 'ON' : 'OFF'}
          </button>
          <Link to="/app/quotations/new" className="btn-primary flex items-center gap-2"><Plus size={18} /> New Quotation</Link>
        </div>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-2.5 text-white/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations..." className="input-field pl-10" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet size={48} className="mx-auto text-white/25 mb-3" />
            <p className="text-white/40">No quotations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/8 text-left text-white/55">
                <th className="pb-2 font-semibold text-xs uppercase tracking-wide">Quotation #</th>
                <th className="pb-2 font-semibold text-xs uppercase tracking-wide">Customer</th>
                <th className="pb-2 font-semibold text-xs uppercase tracking-wide">Date</th>
                <th className="pb-2 font-semibold text-xs uppercase tracking-wide text-right">Amount</th>
                <th className="pb-2 font-semibold text-xs uppercase tracking-wide text-center">Status</th>
                <th className="pb-2 font-semibold text-xs uppercase tracking-wide text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer" onClick={() => navigate(`/app/quotations/${q.id}`)}>
                    <td className="py-3 font-semibold accent-text">{q.quotation_number}</td>
                    <td className="py-3 text-white font-medium" style={{ fontWeight: boldOn ? 'bold' : '500' }}>{q.customer_name || 'N/A'}</td>
                    <td className="py-3 text-white/55">{formatDate(q.quotation_date)}</td>
                    <td className="py-3 text-right font-semibold text-white">{formatCurrency(q.total_amount)}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        q.status === 'Converted' ? 'text-green-400' : q.status === 'Sent' ? 'text-blue-400' : 'text-white/60'
                      }`} style={{ background: q.status === 'Converted' ? 'rgba(34,197,94,0.12)' : q.status === 'Sent' ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.06)' }}>
                        {q.status}
                      </span>
                    </td>
                    <td className="py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/app/quotations/${q.id}`)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5"><Eye size={16} /></button>
                        <button onClick={() => navigate(`/app/quotations/${q.id}/edit`)} className="p-1.5 rounded-lg text-white/40 hover:text-blue-400 hover:bg-white/5"><Edit size={16} /></button>
                        <button onClick={() => duplicate(q)} className="p-1.5 rounded-lg text-white/40 hover:text-green-400 hover:bg-white/5"><Copy size={16} /></button>
                        <button onClick={() => deleteQ(q.id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-white/5"><Trash2 size={16} /></button>
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
