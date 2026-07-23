import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { Users, Plus, Search } from 'lucide-react'

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', gstin: '', address: '', state: '', state_code: '27' })
  const [msg, setMsg] = useState(null)

  const load = () => { setLoading(true); api.get('/customers').then(res => { setCustomers(res.data || []); setLoading(false) }).catch(err => { setLoading(false) }) }
  useEffect(load, [])

  const handleAdd = async (e) => {
    e.preventDefault()
    try { await api.post('/customers', form); setShowAdd(false); setForm({ name: '', email: '', phone: '', gstin: '', address: '', state: '', state_code: '27' }); setMsg({ type: 'success', text: 'Customer added!' }); load() } catch (err) { setMsg({ type: 'error', text: err.response?.data?.msg || err.message }) }
  }

  if (loading) return <div className="flex flex-col items-center justify-center h-96"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  const filtered = customers.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.gstin?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4"><div><h1 className="text-xl font-extrabold accent-text">Customers</h1><div className="gstin-badge mt-2">GSTIN: 27AWAPK1209R1ZC</div></div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowAdd(true)}><Plus size={16} /> Add Customer</button></div>
      {msg && <div className={msg.type === 'success' ? 'text-emerald-400 text-sm' : 'text-red-400 text-sm'}>{msg.text}</div>}
      <div className="card card-premium" style={{ animation: 'entranceUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="shimmer" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-[15px]">All Customers</h3>
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="input-field pl-8" style={{ width: 200 }} /></div>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>GSTIN</th><th>State</th><th>Address</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-white/25">No customers yet</td></tr> :
            filtered.map(c => <tr key={c.id}><td className="font-semibold text-white">{c.name}</td><td>{c.email || '-'}</td><td>{c.phone || '-'}</td><td>{c.gstin || '-'}</td><td>{c.state || '-'}</td><td>{c.address || '-'}</td></tr>)}
          </tbody>
        </table>
      </div>
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center" onClick={() => setShowAdd(false)}>
          <div className="max-w-lg w-full rounded-2xl p-6" style={{ background: 'rgba(14,18,36,0.97)', border: '1px solid rgba(255,255,255,0.08)' }} onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold accent-text mb-4">Add Customer</h2>
            <form onSubmit={handleAdd} className="space-y-3">
              <div><label className="text-xs font-semibold block mb-1 text-white/50">Name *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">Email</label><input className="input-field" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">Phone</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">GSTIN</label><input className="input-field" value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">State</label><input className="input-field" value={form.state} onChange={e => setForm({...form, state: e.target.value})} /></div>
              <div><label className="text-xs font-semibold block mb-1 text-white/50">Address</label><input className="input-field" value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
              <div className="flex gap-2"><button type="submit" className="btn-primary">Save</button><button type="button" className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
