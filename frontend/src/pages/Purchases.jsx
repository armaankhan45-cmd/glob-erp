import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { ShoppingCart, Plus, Search } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)

export default function Purchases() {
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ supplierName: '', invoiceNumber: '', date: '', totalAmount: '', gstAmount: '', gstin: '' })
  const [msg, setMsg] = useState(null)

  const load = () => { setLoading(true); api.get('/purchases').then(res => { setPurchases(res.data || []); setLoading(false) }).catch(err => { setLoading(false) }) }
  useEffect(load, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    try { await api.post('/purchases', { ...form, totalAmount: Number(form.totalAmount), gstAmount: Number(form.gstAmount) }); setShowAdd(false); setForm({ supplierName: '', invoiceNumber: '', date: '', totalAmount: '', gstAmount: '', gstin: '' }); setMsg({ type: 'success', text: 'Purchase bill added!' }); load() } catch (err) { setMsg({ type: 'error', text: err.response?.data?.msg || err.message }) }
  }

  if (loading) return <div className="flex flex-col items-center justify-center h-96"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4"><div><h1 className="text-xl font-extrabold accent-text">Purchase Bills</h1><div className="gstin-badge mt-2">GSTIN: 27AWAPK1209R1ZC</div></div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Purchase Bill</button></div>
      {msg && <div className={msg.type === 'success' ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm'}>{msg.text}</div>}
      <div className="card card-premium" style={{ animation: 'entranceUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="shimmer" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-[15px]">All Purchase Bills</h3>
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input-field pl-8" style={{ width: 200 }} /></div>
        </div>
        <table>
          <thead><tr><th>Bill #</th><th>Supplier</th><th>Amount (₹)</th><th>GST (₹)</th><th>Total (₹)</th><th>GSTIN</th><th>Date</th></tr></thead>
          <tbody>
            {purchases.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-white/25">No purchase bills yet</td></tr> :
            purchases.map(p => <tr key={p.id}><td className="font-semibold accent-text">{p.invoice_number || p.invoiceNumber || p.id}</td><td>{p.supplier_name || p.supplierName || '-'}</td><td>{fmt(p.total_amount || p.totalAmount || 0)}</td><td>{fmt(p.gst_amount || p.gstAmount || 0)}</td><td className="font-bold">{fmt(p.grand_total || p.grandTotal || p.total_amount || p.totalAmount || 0)}</td><td>{p.supplier_gstin || p.gstin || '-'}</td><td>{p.date ? new Date(p.date).toLocaleDateString('en-IN') : '-'}</td></tr>)}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="max-w-lg w-full rounded-2xl p-6" style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold accent-text mb-4">Add Purchase Bill</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div><label className="text-xs font-semibold block mb-1 text-white/50">Supplier Name *</label><input className="input-field" value={form.supplierName} onChange={e => setForm({...form, supplierName: e.target.value})} required /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">Invoice Number</label><input className="input-field" value={form.invoiceNumber} onChange={e => setForm({...form, invoiceNumber: e.target.value})} /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">Date</label><input className="input-field" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">Total Amount *</label><input className="input-field" type="number" value={form.totalAmount} onChange={e => setForm({...form, totalAmount: e.target.value})} required /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">GST Amount</label><input className="input-field" type="number" value={form.gstAmount} onChange={e => setForm({...form, gstAmount: e.target.value})} /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">Supplier GSTIN</label><input className="input-field" value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} /></div>
              <div className="flex gap-2"><button type="submit" className="btn-primary">Save</button><button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
