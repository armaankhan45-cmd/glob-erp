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
        items: [] // Will need to load items separately
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
          <h1 className="text-2xl font-bold">Quotations</h1>
          <p className="text-gray-500 text-sm">Manage your quotations</p>
        </div>
        <div className="flex gap-3">
          <button onClick={toggleBold} className={`px-4 py-2 rounded-lg font-medium text-sm ${boldOn ? 'bg-gray-800 text-white' : 'btn-secondary'}`}>
            Bold {boldOn ? 'ON' : 'OFF'}
          </button>
          <Link to="/app/quotations/new" className="btn-primary flex items-center gap-2"><Plus size={18} /> New Quotation</Link>
        </div>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations..." className="input-field pl-10" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">No quotations found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Quotation #</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium text-center">Status</th>
                <th className="pb-2 font-medium text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/app/quotations/${q.id}`)}>
                    <td className="py-3 font-medium text-primary-600">{q.quotation_number}</td>
                    <td className="py-3" style={{ fontWeight: boldOn ? 'bold' : 'normal' }}>{q.customer_name || 'N/A'}</td>
                    <td className="py-3 text-gray-500">{formatDate(q.quotation_date)}</td>
                    <td className="py-3 text-right font-medium">{formatCurrency(q.total_amount)}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${q.status === 'Converted' ? 'bg-green-100 text-green-700' : q.status === 'Sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{q.status}</span>
                    </td>
                    <td className="py-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/app/quotations/${q.id}`)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Eye size={16} className="text-gray-500" /></button>
                        <button onClick={() => navigate(`/app/quotations/${q.id}/edit`)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit size={16} className="text-blue-500" /></button>
                        <button onClick={() => duplicate(q)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Copy size={16} className="text-green-500" /></button>
                        <button onClick={() => deleteQ(q.id)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Trash2 size={16} className="text-red-500" /></button>
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
