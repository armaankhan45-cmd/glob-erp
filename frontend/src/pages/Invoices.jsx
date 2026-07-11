import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Download, Trash2, FileText, IndianRupee } from 'lucide-react'
import api from '../api/client'
import useCachedApi, { invalidateCache } from '../hooks/useCachedApi'

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
    try { await api.delete('/invoices/' + id); load() } catch (err) { alert('Delete failed') }
  }

  const download = async (inv, e) => {
    if (e) e.stopPropagation()
    const token = localStorage.getItem('token')
    window.open(`${api.defaults.baseURL}/invoices/${inv.id}/pdf?token=${token}`, '_blank')
  }

  const openInvoice = (inv) => navigate('/app/invoices/' + inv.id)

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

  const fmt = (n) => '₹' + Math.round(n).toLocaleString('en-IN')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ animation: 'entranceUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div>
          <h1 className="text-2xl font-bold text-white">GST Tax Invoices</h1>
          <p className="text-white/35 text-sm">Manage all your tax invoices</p>
        </div>
        <button onClick={() => navigate('/app/invoices/new')} className="btn-primary flex items-center gap-2 btn-shine">
          <Plus size={18} />Create New Invoice
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        {[
          { label: 'Total Invoices', value: stats.total, color: '#3b82f6', icon: FileText },
          { label: 'Total Amount', value: fmt(stats.totalAmount), color: '#8b5cf6', icon: IndianRupee },
          { label: 'Paid Amount', value: fmt(stats.paid), color: '#22c55e', icon: IndianRupee },
          { label: 'Outstanding', value: fmt(stats.unpaid), color: '#ef4444', icon: IndianRupee },
        ].map((s, i) => (
          <div key={i} className="stat-card card-premium" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="shimmer"></div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{s.label}</span>
              <s.icon size={16} style={{ color: s.color }} />
            </div>
            <p className="text-xl font-extrabold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="card card-premium">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoice or customer..." className="input-field pl-10" />
          </div>
          <div className="flex gap-1.5">
            {['All','Paid','Unpaid','Partial'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`chip btn-shine ${filterStatus === s ? 'active' : ''}`}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card card-premium overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-10 h-10 border-4 rounded-full mx-auto" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={48} className="mx-auto text-white/15 mb-3" />
            <h3 className="text-lg font-bold text-white/60">No Invoices Yet</h3>
            <p className="text-sm text-white/25 mt-1 mb-4">Create your first invoice</p>
            <button onClick={() => navigate('/app/invoices/new')} className="btn-primary inline-flex items-center gap-2 btn-shine"><Plus size={16} />Create First Invoice</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="nebula-table">
              <thead><tr>
                <th>Invoice No</th><th>Date</th><th>Customer</th><th className="text-right">Subtotal</th><th className="text-right">GST</th><th className="text-right">Total</th><th className="text-center">Status</th><th className="text-right">Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map((inv, i) => (
                  <tr key={inv.id} className="anim-row cursor-pointer" style={{ animationDelay: `${i * 0.03}s` }} onClick={() => openInvoice(inv)}>
                    <td className="font-semibold accent-text font-mono">{inv.invoice_number || '-'}</td>
                    <td className="text-white/50">{inv.invoice_date || '-'}</td>
                    <td className="text-white font-medium">{inv.customer_name || '-'}</td>
                    <td className="text-right text-white/60">{fmt(inv.subtotal || 0)}</td>
                    <td className="text-right accent-text">{fmt((inv.cgst_amount || 0) + (inv.sgst_amount || 0) + (inv.igst_amount || 0))}</td>
                    <td className="text-right font-bold text-white">{fmt(inv.total_amount || 0)}</td>
                    <td className="text-center">
                      <span className={`status-badge ${inv.payment_status === 'Paid' ? 'status-paid' : inv.payment_status === 'Partial' ? 'status-pending' : 'status-overdue'}`}>{inv.payment_status || 'Unpaid'}</span>
                    </td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openInvoice(inv)} className="action-icon" title="View"><Eye size={14} /></button>
                        <button onClick={(e) => download(inv, e)} className="action-icon" title="PDF"><Download size={14} /></button>
                        <button onClick={(e) => del(inv.id, inv.invoice_number, e)} className="action-icon text-red-400" title="Delete"><Trash2 size={14} /></button>
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
