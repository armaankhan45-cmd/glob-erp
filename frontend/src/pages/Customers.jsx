import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Edit, Trash2, Users, Phone, Mail, MapPin, IndianRupee } from 'lucide-react'
import api from '../api/client'
import useCachedApi, { invalidateCache } from '../hooks/useCachedApi'

export default function Customers() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { data, loading, refetch } = useCachedApi('/customers', { maxAge: 30000 })
  const list = data && data.customers ? data.customers : []
  const load = () => { invalidateCache('/customers'); refetch() }

  const del = async (id, name, e) => {
    if (e) e.stopPropagation()
    if (!confirm(`Delete customer "${name}"?`)) return
    try { await api.delete('/customers/' + id); load() } catch (e) { alert('Delete failed') }
  }

  const filtered = list.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) || c.gstin?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
  )

  const totalOutstanding = list.reduce((s, c) => s + (c.outstanding || 0), 0)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ animation: 'entranceUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-white/35 text-sm">Manage your customer database</p>
        </div>
        <button onClick={() => navigate('/app/customers/new')} className="btn-primary flex items-center gap-2 btn-shine">
          <Plus size={18} />Add Customer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 stagger">
        {[
          { label: 'Total Customers', value: list.length, color: '#3b82f6' },
          { label: 'Active', value: list.filter(c => c.invoice_count > 0).length, color: '#22c55e' },
          { label: 'Outstanding', value: '₹' + Math.round(totalOutstanding).toLocaleString('en-IN'), color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} className="stat-card card-premium" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="shimmer"></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{s.label}</span>
            <p className="text-xl font-extrabold text-white mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card card-premium">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, GSTIN, or phone..." className="input-field pl-10" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div></div>
      ) : filtered.length === 0 ? (
        <div className="card card-premium p-12 text-center">
          <Users size={48} className="mx-auto text-white/15 mb-3" />
          <h3 className="text-lg font-bold text-white/60">No Customers Yet</h3>
          <p className="text-sm text-white/25 mt-1 mb-4">Add your first customer</p>
          <button onClick={() => navigate('/app/customers/new')} className="btn-primary inline-flex items-center gap-2 btn-shine"><Plus size={16} />Add Customer</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {filtered.map((c, i) => (
            <div key={c.id}
              className="card card-premium cursor-pointer group"
              style={{ animation: `entranceScale 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both` }}
              onClick={() => navigate('/app/customers/' + c.id)}>
              <div className="shimmer"></div>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-extrabold flex-shrink-0"
                  style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }}>
                  {c.name?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{c.name}</div>
                  {c.gstin && <div className="text-[10px] font-mono accent-text mt-0.5">{c.gstin}</div>}
                </div>
              </div>
              <div className="space-y-1 mb-3 text-xs text-white/40">
                {c.phone && <div className="flex items-center gap-2"><Phone size={10} />{c.phone}</div>}
                {c.email && <div className="flex items-center gap-2 truncate"><Mail size={10} />{c.email}</div>}
                {(c.city || c.state) && <div className="flex items-center gap-2"><MapPin size={10} />{[c.city, c.state].filter(Boolean).join(', ')}</div>}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg p-2" style={{ background: 'rgba(var(--accent-rgb),0.05)' }}>
                  <div className="text-[10px] text-white/30">Invoices</div>
                  <div className="text-sm font-bold text-white">{c.invoice_count || 0}</div>
                </div>
                <div className="rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.05)' }}>
                  <div className="text-[10px] text-white/30">Outstanding</div>
                  <div className="text-sm font-bold text-amber-400">₹{Math.round(c.outstanding || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-white/5">
                <button onClick={(e) => { e.stopPropagation(); navigate('/app/customers/' + c.id) }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold accent-text transition-all hover:bg-white/5"><Eye size={12} />View</button>
                <button onClick={(e) => { e.stopPropagation(); navigate('/app/customers/' + c.id + '/edit') }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold text-blue-400 transition-all hover:bg-white/5"><Edit size={12} />Edit</button>
                <button onClick={(e) => del(c.id, c.name, e)} className="px-2 py-1.5 rounded-lg text-xs text-red-400 transition-all hover:bg-white/5"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
