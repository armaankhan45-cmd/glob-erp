import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { FileText, Users, TrendingUp, TrendingDown, ShoppingCart, AlertTriangle, Package } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
const COLORS = ['#06b6d4', '#4f8fff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [chartType, setChartType] = useState('bar')

  useEffect(() => {
    api.get('/dashboard/stats').then(res => { setStats(res.data); setLoading(false) }).catch(err => { setError(err.message); setLoading(false) })
  }, [])

  if (loading) return <div className="flex flex-col items-center justify-center h-96"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /><p className="text-sm text-white/30 mt-3">Loading dashboard...</p></div>
  if (error) return <div className="card"><div className="text-red-400 mb-3">{error}</div><button className="btn-secondary" onClick={() => window.location.reload()}>Retry</button></div>

  const d = stats || {}
  const revenueData = d.monthlyRevenue || []
  const recentInvoices = d.recentInvoices || []
  const topCustomers = d.topCustomers || []

  const statItems = [
    { label: 'Total Invoices', value: d.totalInvoices || 0, sub: 'This year', icon: FileText, bg: 'rgba(6,182,212,0.08)', color: '#06b6d4', isCurrency: false },
    { label: 'Total Revenue', value: d.totalRevenue || 0, sub: '₹ INR', icon: TrendingUp, bg: 'rgba(16,185,129,0.08)', color: '#10b981', isCurrency: true },
    { label: 'Total Purchases', value: d.totalPurchases || 0, sub: '₹ INR', icon: ShoppingCart, bg: 'rgba(245,158,11,0.08)', color: '#f59e0b', isCurrency: true },
    { label: 'Customers', value: d.totalCustomers || 0, sub: 'Active', icon: Users, bg: 'rgba(79,143,255,0.08)', color: '#4f8fff', isCurrency: false },
    { label: 'Quotations', value: d.totalQuotations || 0, sub: 'Sent', icon: FileText, bg: 'rgba(139,92,246,0.08)', color: '#8b5cf6', isCurrency: false },
  ]

  const actionItems = [
    { label: 'New Invoice', path: '/app/invoices', icon: FileText, bg: 'rgba(6,182,212,0.08)', color: '#06b6d4' },
    { label: 'Customers', path: '/app/customers', icon: Users, bg: 'rgba(79,143,255,0.08)', color: '#4f8fff' },
    { label: 'GST Reports', path: '/app/gst', icon: TrendingUp, bg: 'rgba(16,185,129,0.08)', color: '#10b981' },
    { label: 'Purchase Bills', path: '/app/purchases', icon: ShoppingCart, bg: 'rgba(245,158,11,0.08)', color: '#f59e0b' },
    { label: 'Reports', path: '/app/reports', icon: TrendingUp, bg: 'rgba(139,92,246,0.08)', color: '#8b5cf6' },
  ]

  const gstSplit = [
    { name: 'CGST', value: Math.max(0, (d.netPayable?.cgst || 0)) },
    { name: 'SGST', value: Math.max(0, (d.netPayable?.sgst || 0)) },
    { name: 'IGST', value: Math.max(0, (d.netPayable?.igst || 0)) },
  ].filter(x => x.value > 0)

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl p-7 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--accent-dark), var(--accent), var(--accent-light))', animation: 'entranceScale 0.7s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3), transparent 50%)' }} />
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <h1 className="text-2xl font-extrabold mb-1" style={{ letterSpacing: '-0.5px' }}>Welcome, {user?.name || 'User'}! 👋</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>GLOB FABRICATION AND ENTERPRISES • GSTIN: 27AWAPK1209R1ZC</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {actionItems.map((item, i) => (
          <Link key={i} to={item.path} className="action-card card-premium" style={{ padding: '16px', animation: `entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) ${0.08 + i * 0.06}s both` }}>
            <div className="action-icon w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0" style={{ background: item.bg, color: item.color }}>
              <item.icon size={20} />
            </div>
            <span className="text-sm font-semibold text-white/70">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger">
        {statItems.map((item, i) => (
          <div key={i} className="stat-card card-premium" style={{ animation: `entranceScale 0.6s cubic-bezier(0.16,1,0.3,1) ${0.15 + i * 0.1}s both` }}>
            <div className="shimmer" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/35">{item.label}</span>
              <div className="stat-icon w-11 h-11 rounded-xl flex items-center justify-center relative" style={{ background: item.bg, color: item.color }}>
                <item.icon size={20} />
                <div className="stat-pulse-ring" style={{ color: item.color }} />
              </div>
            </div>
            <p className="text-[26px] font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-0.5px' }}>{item.isCurrency ? fmt(item.value) : item.value}</p>
            <p className="text-[11px] text-white/25 mt-1.5">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="glow-line" />

      {/* Revenue Chart + GST Summary */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card card-premium" style={{ animation: 'entranceUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.4s both' }}>
          <div className="shimmer" />
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-white text-[15px]">Revenue vs Expenses</h3>
              <p className="text-xs text-white/25 mt-0.5">Current Financial Year</p>
            </div>
            <div className="flex gap-1.5">
              {['bar', 'line', 'area'].map(t => (
                <button key={t} onClick={() => setChartType(t)} className={`chip btn-shine ${chartType === t ? 'active' : ''}`}>{t === 'bar' ? 'Bar' : t === 'line' ? 'Line' : 'Area'}</button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip formatter={fmt} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', backdropFilter: 'blur(20px)' }} />
                  <Bar dataKey="revenue" fill="#06b6d4" radius={[6,6,0,0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[6,6,0,0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip formatter={fmt} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2.5} name="Revenue" dot={{ r: 4, fill: '#06b6d4', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" dot={{ r: 3, fill: '#ef4444' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {chartType === 'area' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip formatter={fmt} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#06b6d4" strokeWidth={2.5} fill="url(#colorRevenue)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#colorExpenses)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-3">
            <span className="text-xs flex items-center gap-2 text-white/40"><span style={{ width: 12, height: 12, borderRadius: 3, background: '#06b6d4', display: 'inline-block' }} /> Revenue</span>
            <span className="text-xs flex items-center gap-2 text-white/40"><span style={{ width: 12, height: 12, borderRadius: 3, background: '#ef4444', display: 'inline-block' }} /> Expenses</span>
          </div>
        </div>

        <div className="space-y-4" style={{ animation: 'entranceUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
          <div className="card card-premium">
            <h3 className="font-bold text-white mb-4 text-[15px]">GST Summary</h3>
            <div className="space-y-3">
              <div className="gst-card cgst rounded-xl p-4 relative overflow-hidden">
                <p className="text-sm font-semibold text-blue-400 mb-1">Output GST (Sales)</p>
                <p className="text-xl font-extrabold text-blue-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{fmt((d.outputGST?.total || 0))}</p>
                <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                  <span>CGST: {fmt((d.outputGST?.cgst || 0))}</span>
                  <span>SGST: {fmt((d.outputGST?.sgst || 0))}</span>
                  <span>IGST: {fmt((d.outputGST?.igst || 0))}</span>
                </div>
              </div>
              <div className="gst-card sgst rounded-xl p-4 relative overflow-hidden">
                <p className="text-sm font-semibold text-cyan-400 mb-1">Input GST (Purchases)</p>
                <p className="text-xl font-extrabold text-cyan-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{fmt((d.inputGST?.total || 0))}</p>
                <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                  <span>CGST: {fmt((d.inputGST?.cgst || 0))}</span>
                  <span>SGST: {fmt((d.inputGST?.sgst || 0))}</span>
                  <span>IGST: {fmt((d.inputGST?.igst || 0))}</span>
                </div>
              </div>
              <div className="gst-card igst rounded-xl p-4 relative overflow-hidden">
                <p className="text-sm font-semibold text-red-400 mb-1">Net Payable</p>
                <p className="text-xl font-extrabold text-red-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{fmt((d.netPayable?.total || 0))}</p>
                <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                  <span>CGST: {fmt((d.netPayable?.cgst || 0))}</span>
                  <span>SGST: {fmt((d.netPayable?.sgst || 0))}</span>
                  <span>IGST: {fmt((d.netPayable?.igst || 0))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Invoices + Top Customers */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card card-premium" style={{ animation: 'entranceUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
          <div className="shimmer" />
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white text-[15px]">Recent Invoices</h3>
            <Link to="/app/invoices" className="text-sm font-semibold accent-text btn-shine" style={{ padding: '4px 10px', borderRadius: 8 }}>View All →</Link>
          </div>
          {recentInvoices.length === 0 ? <p className="text-center py-8 text-white/25">No invoices yet. Create your first invoice!</p> : (
            <div className="space-y-1.5">
              {recentInvoices.slice(0, 6).map((inv, i) => (
                <Link key={inv.id} to={`/app/invoices/${inv.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200 group" style={{ animation: `entranceLeft 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ background: 'rgba(var(--accent-rgb),0.08)' }}>
                      <FileText size={16} className="accent-text" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{inv.invoice_number || inv.invoiceNumber || inv.id}</p>
                      <p className="text-[11px] text-white/35">{inv.customer_name || inv.customerName || 'N/A'} • {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '-'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-sm">{fmt(inv.total_amount || inv.totalAmount || 0)}</p>
                    <span className={`status-badge text-[10px] ${inv.payment_status === 'Paid' || inv.status === 'Paid' ? 'status-paid' : inv.payment_status === 'Partial' || inv.status === 'Partial' ? 'status-pending' : 'status-overdue'}`}>{inv.payment_status || inv.status || 'Pending'}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card card-premium" style={{ animation: 'entranceUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.6s both' }}>
          <div className="shimmer" />
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white text-[15px]">Top Customers</h3>
            <Link to="/app/customers" className="text-sm font-semibold accent-text btn-shine" style={{ padding: '4px 10px', borderRadius: 8 }}>View All →</Link>
          </div>
          {topCustomers.length === 0 ? <p className="text-center py-8 text-white/25">No customer data yet</p> : (
            <div className="space-y-1.5">
              {topCustomers.map((c, i) => (
                <Link key={c.id} to={`/app/customers`} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200 group" style={{ animation: `entranceLeft 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm transition-transform duration-200 group-hover:scale-110" style={{ background: `${COLORS[i % COLORS.length]}18`, color: COLORS[i % COLORS.length] }}>#{i + 1}</div>
                    <div>
                      <p className="font-semibold text-white text-sm">{c.name}</p>
                      <p className="text-[11px] text-white/35">{c.gstin ? `${c.gstin.substring(0, 2)}...` : 'No GSTIN'} • {c.city || c.state || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-sm">{fmt(c.totalBusiness || c.total_business || 0)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
