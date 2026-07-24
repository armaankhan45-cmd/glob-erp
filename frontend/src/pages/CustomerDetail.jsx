import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Trash2, Plus, FileText, Factory, Building2, Phone, Mail, MapPin, IndianRupee, Calendar, Eye, Download, TrendingUp, CreditCard, Receipt } from 'lucide-react'
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

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-12 h-12 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} /></div>

  const c = data?.customer || {}
  const invoices = data?.invoices || []
  const production = data?.productionOrders || []
  const s = {
    totalBusiness: data?.totalBusiness || data?.stats?.totalBusiness || 0,
    paidAmount: data?.totalPaid || data?.stats?.paidAmount || 0,
    outstanding: data?.outstanding || data?.stats?.outstanding || 0,
    invoiceCount: invoices.length || data?.stats?.invoiceCount || 0
  }

  const accentColor = 'var(--accent)'
  const accentRgb = 'var(--accent-rgb)'

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={() => navigate('/app/customers')} className="p-1.5 rounded-lg" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={14} />
        </button>
        <span style={{ color: 'var(--text-muted)' }}>Customers</span>
        <span style={{ color: 'var(--text-muted)' }}>›</span>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
      </div>

      {/* Hero Card */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl p-6" style={{ background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.15), rgba(168,85,247,0.1), rgba(var(--accent-rgb),0.08))', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full" style={{ background: 'rgba(var(--accent-rgb),0.06)', filter: 'blur(60px)', transform: 'translate(30%, -30%)' }}></div>
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'var(--bg-card)', border: '2px solid rgba(var(--accent-rgb),0.2)' }}>
              <span className="text-4xl font-black" style={{ color: 'var(--accent)' }}>
                {c.name?.charAt(0)?.toUpperCase() || 'C'}
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold tracking-widest" style={{ color: 'var(--accent)' }}>CUSTOMER</div>
              <h1 className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>{c.name}</h1>
              {c.gstin && <div className="text-sm font-mono mt-1" style={{ color: 'var(--text-secondary)' }}>GSTIN: {c.gstin}</div>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {c.business_type && <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.15)' }}>{c.business_type}</span>}
                {c.city && <span className="px-2.5 py-1 rounded-lg text-xs font-semibold" style={{ background: 'var(--bg-glass)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{c.city}, {c.state}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/app/customers/' + id + '/edit')} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <Edit size={14} />Edit
            </button>
            <button onClick={del} className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}>
              <Trash2 size={14} />Delete
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Business', value: '₹' + Math.round(s.totalBusiness || 0).toLocaleString('en-IN'), icon: TrendingUp, color: '#6ea8fe', bg: 'rgba(110,168,254,0.08)', border: 'rgba(110,168,254,0.15)' },
          { label: 'Paid Amount', value: '₹' + Math.round(s.paidAmount || 0).toLocaleString('en-IN'), icon: CreditCard, color: '#4ade80', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.15)' },
          { label: 'Outstanding', value: '₹' + Math.round(s.outstanding || 0).toLocaleString('en-IN'), icon: IndianRupee, color: '#fbbf24', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.15)' },
          { label: 'Total Invoices', value: s.invoiceCount || 0, icon: Receipt, color: '#c084fc', bg: 'rgba(192,132,252,0.08)', border: 'rgba(192,132,252,0.15)' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} className="rounded-2xl p-5" style={{ background: stat.bg, borderLeft: `4px solid ${stat.color}`, border: `1px solid ${stat.border}` }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: stat.bg }}>
                <stat.icon size={18} style={{ color: stat.color }} />
              </div>
              <div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
                <div className="text-xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Contact Details */}
      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Contact Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {c.contact_person && <div className="flex items-center gap-3"><Building2 size={16} style={{ color: '#6ea8fe' }} /><div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>Contact Person</div><div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.contact_person}</div></div></div>}
          {c.phone && <div className="flex items-center gap-3"><Phone size={16} style={{ color: '#4ade80' }} /><div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>Phone</div><div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.phone}</div></div></div>}
          {c.email && <div className="flex items-center gap-3"><Mail size={16} style={{ color: '#c084fc' }} /><div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>Email</div><div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.email}</div></div></div>}
          {c.address && <div className="flex items-start gap-3"><MapPin size={16} style={{ color: '#fbbf24', marginTop: '2px' }} /><div><div className="text-xs" style={{ color: 'var(--text-muted)' }}>Address</div><div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.address}{c.city ? ', ' + c.city : ''}{c.state ? ', ' + c.state : ''}{c.pincode ? ' - ' + c.pincode : ''}</div></div></div>}
        </div>
      </div>

      {/* Tab Section */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setTab('invoices')} className="flex-1 px-5 py-3 text-sm font-bold transition"
            style={tab === 'invoices' ? { background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', borderBottom: '2px solid var(--accent)' } : { color: 'var(--text-muted)' }}>
            <FileText size={14} className="inline mr-2" />Invoices ({invoices.length})
          </button>
          <button onClick={() => setTab('production')} className="flex-1 px-5 py-3 text-sm font-bold transition"
            style={tab === 'production' ? { background: 'rgba(251,146,60,0.1)', color: '#fb923c', borderBottom: '2px solid #fb923c' } : { color: 'var(--text-muted)' }}>
            <Factory size={14} className="inline mr-2" />Production ({production.length})
          </button>
        </div>

        <div className="p-5">
          {tab === 'invoices' && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>All Invoices</h3>
                <button onClick={() => navigate('/app/invoices/new?customer=' + id)} className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#fff' }}>
                  <Plus size={12} />New Invoice
                </button>
              </div>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No invoices yet</div>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => (
                    <div key={inv.id} onClick={() => navigate('/app/invoices/' + inv.id)} className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-md)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.1)' }}><FileText size={14} style={{ color: 'var(--accent)' }} /></div>
                        <div>
                          <div className="text-sm font-bold font-mono" style={{ color: 'var(--accent)' }}>{inv.invoice_number}</div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{inv.invoice_date}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>₹{Math.round(inv.total_amount || 0).toLocaleString('en-IN')}</div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={inv.payment_status === 'Paid' ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80' } : { background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>{inv.payment_status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'production' && (
            <div>
              <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Production Orders</h3>
              {production.length === 0 ? (
                <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No production orders</div>
              ) : (
                <div className="space-y-2">
                  {production.map(po => (
                    <div key={po.id} className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-md)' }}>
                      <div className="flex justify-between">
                        <div>
                          <div className="text-sm font-bold font-mono" style={{ color: '#fb923c' }}>{po.order_number}</div>
                          <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{po.job_name}</div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full font-semibold" style={po.status === 'Completed' ? { background: 'rgba(74,222,128,0.1)', color: '#4ade80' } : po.status === 'In Progress' ? { background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' } : { background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}>{po.status}</span>
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
