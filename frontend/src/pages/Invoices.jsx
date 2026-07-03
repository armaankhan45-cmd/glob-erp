import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, Eye, Trash2, Search, FileText } from 'lucide-react'
import api from '../api/client'
import useCachedApi, { invalidateCache } from '../hooks/useCachedApi'
import { generateInvoicePDF } from '../utils/invoicePDF'

export default function Invoices() {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')
  const navigate = useNavigate()
  const { data, loading, refetch } = useCachedApi('/invoices', { maxAge: 30000 })
  const invoices = data && data.invoices ? data.invoices : []
  const load = () => { invalidateCache('/invoices'); refetch() }

  const del = async (id, num, e) => {
    if (e) e.stopPropagation()
    if (!confirm('Delete invoice ' + num + '?')) return
    try {
      await api.delete('/invoices/' + id)
      load()
    } catch (err) { alert('Delete failed: ' + err.message) }
  }

  const download = async (inv, e) => {
    if (e) e.stopPropagation()
    if (!inv.id || inv.id <= 0) { alert('Invalid invoice ID'); return }
    try {
      const r = await api.get('/invoices/' + inv.id)
      if (r.data.success) {
        await generateInvoicePDF(r.data.invoice, r.data.items)
      }
    } catch (e) { alert('Failed: ' + (e.response?.data?.msg || e.message)) }
  }

  const openInvoice = (inv) => {
    if (!inv.id || inv.id <= 0) { alert('Invalid invoice - cannot open'); return }
    navigate('/app/invoices/' + inv.id)
  }

  const filtered = invoices.filter(i => {
    const matchSearch = !search || i.invoice_number?.toLowerCase().includes(search.toLowerCase()) || i.customer_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'All' || i.payment_status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    total: filtered.length,
    totalAmount: filtered.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0),
    paid: filtered.filter(i => i.payment_status === 'Paid').reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0),
    unpaid: filtered.filter(i => i.payment_status !== 'Paid').reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">GST Tax Invoices</h1>
          <p className="text-slate-400 text-sm">Manage all your tax invoices</p>
        </div>
        <button onClick={() => navigate('/app/invoices/new')} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-lg text-white px-5 py-2.5 rounded-xl text-sm font-bold transition">
          <Plus size={18} />Create New Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4 border-l-4 border-blue-500">
          <div className="text-xs text-slate-400">Total Invoices</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 border-purple-500">
          <div className="text-xs text-slate-400">Total Amount</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">Rs.{Math.round(stats.totalAmount).toLocaleString('en-IN')}</div>
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 border-emerald-500">
          <div className="text-xs text-slate-400">Paid Amount</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">Rs.{Math.round(stats.paid).toLocaleString('en-IN')}</div>
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 border-red-500">
          <div className="text-xs text-slate-400">Outstanding</div>
          <div className="text-2xl font-bold text-red-400 mt-1">Rs.{Math.round(stats.unpaid).toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or customer..." className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm" />
          </div>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2.5 rounded-xl text-sm">
            <option>All</option>
            <option>Paid</option>
            <option>Unpaid</option>
            <option>Partial</option>
          </select>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-white">No Invoices Yet</h3>
            <p className="text-sm text-slate-400 mt-1 mb-4">Get started by creating your first invoice</p>
            <button onClick={() => navigate('/app/invoices/new')} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-bold inline-flex items-center gap-2">
              <Plus size={16} />Create First Invoice
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="text-left py-3 px-4 text-slate-400 text-xs font-bold uppercase">Invoice No</th>
                  <th className="text-left py-3 px-4 text-slate-400 text-xs font-bold uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-slate-400 text-xs font-bold uppercase">Customer</th>
                  <th className="text-right py-3 px-4 text-slate-400 text-xs font-bold uppercase">Subtotal</th>
                  <th className="text-right py-3 px-4 text-slate-400 text-xs font-bold uppercase">GST</th>
                  <th className="text-right py-3 px-4 text-slate-400 text-xs font-bold uppercase">Total</th>
                  <th className="text-center py-3 px-4 text-slate-400 text-xs font-bold uppercase">Status</th>
                  <th className="text-center py-3 px-4 text-slate-400 text-xs font-bold uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition cursor-pointer" onClick={() => openInvoice(inv)}>
                    <td className="py-3 px-4 text-blue-400 font-mono font-bold">{inv.invoice_number || '-'}</td>
                    <td className="py-3 px-4 text-slate-300">{inv.invoice_date || '-'}</td>
                    <td className="py-3 px-4 text-white font-semibold">{inv.customer_name || '-'}</td>
                    <td className="py-3 px-4 text-right text-slate-300">Rs.{Math.round(inv.subtotal || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right text-cyan-400">Rs.{Math.round((inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0)).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-bold">Rs.{Math.round(inv.total_amount || 0).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={"px-3 py-1 rounded-full text-xs font-bold " + (inv.payment_status === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' : inv.payment_status === 'Partial' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400')}>{inv.payment_status || 'Unpaid'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openInvoice(inv)} className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition" title="View"><Eye size={14} /></button>
                        <button onClick={(e) => download(inv, e)} className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition" title="PDF"><Download size={14} /></button>
                        <button onClick={(e) => del(inv.id, inv.invoice_number, e)} className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition" title="Delete"><Trash2 size={14} /></button>
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
