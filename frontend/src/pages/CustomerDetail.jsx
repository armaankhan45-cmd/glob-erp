import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Plus, FileText, Factory, Building2, Phone, Mail, MapPin, IndianRupee, Calendar, Eye, Download } from 'lucide-react'
import api from '../api/client'
import { motion } from 'framer-motion'

export default function CustomerDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('invoices')

  useEffect(() => { load() }, [id])

  const load = async () => {
    try {
      const r = await api.get('/customers/' + id)
      setData(r.data)
    } catch (e) {
      alert('Failed to load customer')
      navigate('/app/customers')
    } finally { setLoading(false) }
  }

  const del = async () => {
    if (!confirm(`Delete customer "${data.customer.name}"? This cannot be undone.`)) return
    try {
      await api.delete('/customers/' + id)
      navigate('/app/customers')
    } catch (e) {
      alert(e.response?.data?.msg || 'Delete failed')
    }
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  const c = data?.customer || {}
  const invoices = data?.invoices || []
  const production = data?.productionOrders || []
  // Backend returns stats as flat keys: totalBusiness, totalPaid, outstanding
  const s = {
    totalBusiness: data?.totalBusiness || data?.stats?.totalBusiness || 0,
    paidAmount: data?.totalPaid || data?.stats?.paidAmount || 0,
    outstanding: data?.outstanding || data?.stats?.outstanding || 0,
    invoiceCount: invoices.length || data?.stats?.invoiceCount || 0
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate('/app/customers')} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white">
          <ArrowLeft size={14} />
        </button>
        <span className="text-slate-500">Customers</span>
        <span className="text-slate-700">›</span>
        <span className="text-white font-semibold">{c.name}</span>
      </div>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl transform translate-x-32 -translate-y-32"></div>
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-2xl">
              <span className="text-4xl font-black bg-gradient-to-br from-blue-600 to-cyan-500 bg-clip-text text-transparent">
                {c.name?.charAt(0)?.toUpperCase() || 'C'}
              </span>
            </div>
            <div>
              <div className="text-xs text-white/70 font-semibold tracking-widest">CUSTOMER</div>
              <h1 className="text-3xl font-black text-white">{c.name}</h1>
              {c.gstin && <div className="text-sm text-white/90 font-mono mt-1">GSTIN: {c.gstin}</div>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {c.business_type && <span className="px-2.5 py-1 bg-white/20 backdrop-blur rounded-lg text-xs text-white font-semibold">{c.business_type}</span>}
                {c.city && <span className="px-2.5 py-1 bg-white/20 backdrop-blur rounded-lg text-xs text-white font-semibold">{c.city}, {c.state}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/app/customers/' + id + '/edit')} className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur text-white rounded-xl text-sm font-bold flex items-center gap-2 transition">
              <Edit size={14} />Edit
            </button>
            <button onClick={del} className="px-4 py-2 bg-red-500/30 hover:bg-red-500/50 backdrop-blur text-white rounded-xl text-sm font-bold flex items-center gap-2 transition">
              <Trash2 size={14} />Delete
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-2xl p-5 border-l-4 border-blue-500">
          <div className="text-xs text-slate-400">Total Business</div>
          <div className="text-2xl font-bold text-white mt-1">₹{Math.round(s.totalBusiness || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="glass rounded-2xl p-5 border-l-4 border-emerald-500">
          <div className="text-xs text-slate-400">Paid Amount</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">₹{Math.round(s.paidAmount || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="glass rounded-2xl p-5 border-l-4 border-amber-500">
          <div className="text-xs text-slate-400">Outstanding</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">₹{Math.round(s.outstanding || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="glass rounded-2xl p-5 border-l-4 border-purple-500">
          <div className="text-xs text-slate-400">Total Invoices</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">{s.invoiceCount || 0}</div>
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">Contact Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {c.contact_person && <div className="flex items-center gap-3"><Building2 size={16} className="text-blue-400" /><div><div className="text-xs text-slate-500">Contact Person</div><div className="text-white font-semibold">{c.contact_person}</div></div></div>}
          {c.phone && <div className="flex items-center gap-3"><Phone size={16} className="text-emerald-400" /><div><div className="text-xs text-slate-500">Phone</div><div className="text-white font-semibold">{c.phone}</div></div></div>}
          {c.email && <div className="flex items-center gap-3"><Mail size={16} className="text-purple-400" /><div><div className="text-xs text-slate-500">Email</div><div className="text-white font-semibold">{c.email}</div></div></div>}
          {c.address && <div className="flex items-start gap-3"><MapPin size={16} className="text-amber-400 mt-0.5" /><div><div className="text-xs text-slate-500">Address</div><div className="text-white font-semibold">{c.address}{c.city ? ', ' + c.city : ''}{c.state ? ', ' + c.state : ''}{c.pincode ? ' - ' + c.pincode : ''}</div></div></div>}
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex border-b border-slate-700">
          <button onClick={() => setTab('invoices')} className={"flex-1 px-5 py-3 text-sm font-bold transition " + (tab === 'invoices' ? 'bg-blue-500/20 text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-white')}>
            <FileText size={14} className="inline mr-2" />Invoices ({invoices.length})
          </button>
          <button onClick={() => setTab('production')} className={"flex-1 px-5 py-3 text-sm font-bold transition " + (tab === 'production' ? 'bg-orange-500/20 text-orange-400 border-b-2 border-orange-500' : 'text-slate-400 hover:text-white')}>
            <Factory size={14} className="inline mr-2" />Production Orders ({production.length})
          </button>
        </div>

        <div className="p-5">
          {tab === 'invoices' && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-white">All Invoices</h3>
                <button onClick={() => navigate('/app/invoices/new?customer=' + id)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Plus size={12} />New Invoice
                </button>
              </div>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No invoices yet</div>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => (
                    <div key={inv.id} onClick={() => navigate('/app/invoices/' + inv.id)} className="flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><FileText size={14} className="text-blue-400" /></div>
                        <div>
                          <div className="text-sm font-bold text-blue-400 font-mono">{inv.invoice_number}</div>
                          <div className="text-xs text-slate-400">{inv.invoice_date}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white">₹{Math.round(inv.total_amount || 0).toLocaleString('en-IN')}</div>
                        <span className={"text-xs px-2 py-0.5 rounded-full font-semibold " + (inv.payment_status === 'Paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400')}>{inv.payment_status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'production' && (
            <div>
              <h3 className="text-sm font-bold text-white mb-3">Production Orders</h3>
              {production.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No production orders</div>
              ) : (
                <div className="space-y-2">
                  {production.map(po => (
                    <div key={po.id} className="p-3 bg-slate-800/50 rounded-xl">
                      <div className="flex justify-between">
                        <div>
                          <div className="text-sm font-bold text-orange-400 font-mono">{po.order_number}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{po.job_name}</div>
                        </div>
                        <span className={"text-xs px-2 py-1 rounded-full font-semibold h-fit " + (po.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : po.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400')}>{po.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
