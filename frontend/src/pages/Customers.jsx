import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Edit, Trash2, Users, Phone, Mail, MapPin, Building2, IndianRupee, FileText } from 'lucide-react'
import api from '../api/client'
import useCachedApi, { invalidateCache } from '../hooks/useCachedApi'
import { motion, AnimatePresence } from 'framer-motion'

export default function Customers() {
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { data, loading, refetch } = useCachedApi('/customers', { maxAge: 30000 })
  const list = data && data.customers ? data.customers : []
  const load = () => { invalidateCache('/customers'); refetch() }

  const del = async (id, name, e) => {
    if (e) e.stopPropagation()
    if (!confirm(`Delete customer "${name}"? This cannot be undone.`)) return
    try {
      const r = await api.delete('/customers/' + id)
      alert(r.data.msg || 'Deleted')
      load()
    } catch (e) {
      alert(e.response?.data?.msg || 'Delete failed')
    }
  }

  const filtered = list.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.gstin?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  const totalOutstanding = list.reduce((s, c) => s + (c.outstanding || 0), 0)
  const totalCustomers = list.length
  const activeCustomers = list.filter(c => c.invoice_count > 0).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          <p className="text-slate-400 text-sm">Manage your customer database</p>
        </div>
        <button onClick={() => navigate('/app/customers/new')} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-lg hover:shadow-blue-500/40 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition">
          <Plus size={18} />Add New Customer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-4 border-l-4 border-blue-500">
          <div className="text-xs text-slate-400">Total Customers</div>
          <div className="text-2xl font-bold text-white mt-1">{totalCustomers}</div>
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 border-emerald-500">
          <div className="text-xs text-slate-400">Active Customers</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{activeCustomers}</div>
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 border-amber-500">
          <div className="text-xs text-slate-400">Total Outstanding</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">₹{Math.round(totalOutstanding).toLocaleString('en-IN')}</div>
        </div>
        <div className="glass rounded-2xl p-4 border-l-4 border-purple-500">
          <div className="text-xs text-slate-400">Avg per Customer</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">₹{totalCustomers > 0 ? Math.round(totalOutstanding / totalCustomers).toLocaleString('en-IN') : 0}</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, GSTIN, or phone number..." className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-700 text-sm" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Users size={48} className="text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-white">No Customers Yet</h3>
          <p className="text-sm text-slate-400 mt-1 mb-4">Get started by adding your first customer</p>
          <button onClick={() => navigate('/app/customers/new')} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2">
            <Plus size={16} />Add First Customer
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-2xl p-5 hover:border-blue-500/40 transition cursor-pointer group"
                onClick={() => navigate('/app/customers/' + c.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                      {c.name?.charAt(0)?.toUpperCase() || 'C'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{c.name}</div>
                      {c.gstin && <div className="text-[10px] text-blue-400 font-mono mt-0.5">{c.gstin}</div>}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 mb-3 text-xs">
                  {c.phone && <div className="flex items-center gap-2 text-slate-400"><Phone size={11} />{c.phone}</div>}
                  {c.email && <div className="flex items-center gap-2 text-slate-400 truncate"><Mail size={11} />{c.email}</div>}
                  {(c.city || c.state) && <div className="flex items-center gap-2 text-slate-400"><MapPin size={11} />{c.city || ''}{c.city && c.state ? ', ' : ''}{c.state || ''}</div>}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">Invoices</div>
                    <div className="text-sm font-bold text-white">{c.invoice_count || 0}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">Outstanding</div>
                    <div className="text-sm font-bold text-amber-400">₹{Math.round(c.outstanding || 0).toLocaleString('en-IN')}</div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-800">
                  <button onClick={(e) => { e.stopPropagation(); navigate('/app/customers/' + c.id) }} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-semibold transition">
                    <Eye size={12} />View
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); navigate('/app/customers/' + c.id + '/edit') }} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold transition">
                    <Edit size={12} />Edit
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); del(c.id, c.name, e) }} className="px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition">
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
