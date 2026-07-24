import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Edit, Trash2, Users, Phone, Mail, MapPin, IndianRupee, TrendingUp, UserCheck, AlertTriangle, SortAsc, SortDesc, Filter, Download } from 'lucide-react'
import api from '../api/client'
import useCachedApi, { invalidateCache } from '../hooks/useCachedApi'

export default function Customers() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [filterType, setFilterType] = useState('all')
  const navigate = useNavigate()
  const { data, loading, refetch } = useCachedApi('/customers', { maxAge: 30000 })
  const list = data && data.customers ? data.customers : []
  const load = () => { invalidateCache('/customers'); refetch() }

  const del = async (id, name, e) => {
    if (e) e.stopPropagation()
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return
    try { await api.delete('/customers/' + id); load() } catch (e) { alert('Delete failed') }
  }

  // Filter + Sort
  const filtered = list.filter(c => {
    const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || c.gstin?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    if (filterType === 'all') return matchesSearch
    if (filterType === 'active') return matchesSearch && c.invoice_count > 0
    if (filterType === 'outstanding') return matchesSearch && (c.outstanding || 0) > 0
    if (filterType === 'gst') return matchesSearch && c.gstin
    return matchesSearch
  })

  const sorted = [...filtered].sort((a, b) => {
    let valA, valB
    if (sortBy === 'name') { valA = a.name?.toLowerCase() || ''; valB = b.name?.toLowerCase() || '' }
    else if (sortBy === 'outstanding') { valA = a.outstanding || 0; valB = b.outstanding || 0 }
    else if (sortBy === 'invoices') { valA = a.invoice_count || 0; valB = b.invoice_count || 0 }
    else { valA = a.name?.toLowerCase() || ''; valB = b.name?.toLowerCase() || '' }
    if (sortDir === 'asc') return valA > valB ? 1 : -1
    return valA < valB ? 1 : -1
  })

  const totalOutstanding = list.reduce((s, c) => s + (c.outstanding || 0), 0)
  const activeCount = list.filter(c => c.invoice_count > 0).length
  const gstCount = list.filter(c => c.gstin).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3" style={{ animation: 'entranceUp 0.5s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Customers</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Manage your customer database • {list.length} total</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/app/customers/new')} className="btn-primary flex items-center gap-2 btn-shine">
            <Plus size={18} />Add Customer
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        {[
          { label: 'Total Customers', value: list.length, icon: Users, color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
          { label: 'Active Clients', value: activeCount, icon: UserCheck, color: '#4ade80', bg: 'rgba(74,222,128,0.08)' },
          { label: 'Outstanding ₹', value: '₹' + Math.round(totalOutstanding).toLocaleString('en-IN'), icon: IndianRupee, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)' },
          { label: 'GSTIN Verified', value: gstCount, icon: TrendingUp, color: '#22d3ee', bg: 'rgba(34,211,238,0.08)' },
        ].map((s, i) => (
          <div key={i} className="stat-card card-premium" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="shimmer"></div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{s.label}</span>
                <p className="text-xl font-extrabold mt-1" style={{ color: s.color }}>{s.value}</p>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.bg }}>
                <s.icon size={18} style={{ color: s.color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Filters + Sort */}
      <div className="card card-premium">
        <div className="flex flex-col gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, GSTIN, or phone..." className="input-field pl-10" />
          </div>
          {/* Filters + Sort Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Filter buttons */}
            <div className="flex gap-1">
              {[{ key: 'all', label: 'All' }, { key: 'active', label: 'Active' }, { key: 'outstanding', label: 'Outstanding' }, { key: 'gst', label: 'GSTIN' }].map(f => (
                <button key={f.key} onClick={() => setFilterType(f.key)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
                  style={filterType === f.key
                    ? { background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.25)' }
                    : { background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
                  }>
                  {f.label}
                </button>
              ))}
            </div>
            {/* Sort */}
            <div className="flex items-center gap-1 ml-auto">
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <option value="name">Name</option>
                <option value="outstanding">Outstanding</option>
                <option value="invoices">Invoices</option>
              </select>
              <button onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className="p-1.5 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                {sortDir === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Cards */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-10 h-10 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div></div>
      ) : sorted.length === 0 ? (
        <div className="card card-premium p-12 text-center">
          <Users size={48} className="mx-auto mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>No Customers Yet</h3>
          <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Add your first customer</p>
          <button onClick={() => navigate('/app/customers/new')} className="btn-primary inline-flex items-center gap-2 btn-shine"><Plus size={16} />Add Customer</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {sorted.map((c, i) => (
            <div key={c.id}
              className="card card-premium cursor-pointer group"
              style={{ animation: `entranceScale 0.4s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both` }}
              onClick={() => navigate('/app/customers/' + c.id)}>
              <div className="shimmer"></div>

              {/* Customer Avatar + Name */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold flex-shrink-0"
                  style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}>
                  {c.name?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</div>
                  {c.gstin && <div className="text-[10px] font-mono accent-text mt-0.5">{c.gstin}</div>}
                  {c.business_type && <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.business_type}</div>}
                </div>
                {(c.outstanding || 0) > 0 && (
                  <div className="flex-shrink-0">
                    <AlertTriangle size={14} style={{ color: '#fbbf24' }} />
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-1.5 mb-3">
                {c.phone && <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}><Phone size={12} />{c.phone}</div>}
                {c.email && <div className="flex items-center gap-2 text-xs truncate" style={{ color: 'var(--text-secondary)' }}><Mail size={12} />{c.email}</div>}
                {(c.city || c.state) && <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}><MapPin size={12} />{[c.city, c.state].filter(Boolean).join(', ')}</div>}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg p-2.5" style={{ background: 'rgba(var(--accent-rgb),0.05)' }}>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Invoices</div>
                  <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{c.invoice_count || 0}</div>
                </div>
                <div className="rounded-lg p-2.5" style={{ background: 'rgba(251,191,36,0.05)' }}>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Outstanding</div>
                  <div className="text-sm font-bold" style={{ color: (c.outstanding || 0) > 0 ? '#fbbf24' : 'var(--text-primary)' }}>₹{Math.round(c.outstanding || 0).toLocaleString('en-IN')}</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid var(--border-md)' }}>
                <button onClick={(e) => { e.stopPropagation(); navigate('/app/customers/' + c.id) }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ color: 'var(--accent)' }}>
                  <Eye size={12} />View
                </button>
                <button onClick={(e) => { e.stopPropagation(); navigate('/app/customers/' + c.id + '/edit') }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold transition-all" style={{ color: '#6ea8fe' }}>
                  <Edit size={12} />Edit
                </button>
                <button onClick={(e) => del(c.id, c.name, e)} className="px-2 py-1.5 rounded-lg text-xs transition-all" style={{ color: '#f87171' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
