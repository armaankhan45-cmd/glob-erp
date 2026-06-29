import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { Plus, Users, CreditCard, FileText, Calculator, TrendingUp, IndianRupee, AlertCircle, UserPlus, ArrowUpRight, ArrowDownRight, Clock, Target } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import GSTCalcModal from '../components/GSTCalcModal'
import { formatCurrency } from '../utils'

const CHART_COLORS = ['#06b6d4', '#4f8fff', '#a855f7', '#22c55e', '#ef4444', '#f59e0b', '#ec4899']

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({})
  const [recentInvoices, setRecentInvoices] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [monthlySales, setMonthlySales] = useState([])
  const [chartType, setChartType] = useState('bar')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadDashboard() }, [])

  const loadDashboard = async () => {
    try {
      const res = await api.get('/dashboard/stats')
      setStats(res.data.stats || {})
      setRecentInvoices(res.data.recentInvoices || [])
      setMonthlySales(res.data.monthlySales || [])
      // Load top customers
      try {
        const custRes = await api.get('/customers')
        const allCusts = custRes.data.customers || []
        // For each customer with invoices, calculate total business
        const custWithBiz = await Promise.all(allCusts.slice(0, 20).map(async c => {
          try {
            const cRes = await api.get(`/customers/${c.id}`)
            return { ...c, totalBusiness: cRes.data.totalBusiness || 0 }
          } catch { return { ...c, totalBusiness: 0 } }
        }))
        setTopCustomers(custWithBiz.sort((a, b) => b.totalBusiness - a.totalBusiness).slice(0, 5))
      } catch {}
    } catch (err) { console.error('Dashboard error:', err) }
    finally { setLoading(false) }
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const quickActions = [
    { label: 'New Invoice', path: '/app/invoices/new', icon: FileText, color: '#06b6d4' },
    { label: 'Add Customer', path: '/app/customers', icon: UserPlus, color: '#22c55e' },
    { label: 'New Quote', path: '/app/quotations/new', icon: Plus, color: '#a855f7' },
    { label: 'GST Reports', path: '/app/gst', icon: Calculator, color: '#f59e0b' },
    { label: 'Record Purchase', path: '/app/purchases/new', icon: CreditCard, color: '#4f8fff' },
  ]

  const pendingAmount = stats.pendingAmount || 0
  const netPayable = (stats.netPayable?.cgst || 0) + (stats.netPayable?.sgst || 0) + (stats.netPayable?.igst || 0)

  const metricCards = [
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: IndianRupee, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', sub: 'All time sales' },
    { label: 'Outstanding', value: formatCurrency(pendingAmount), icon: AlertCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', sub: `${stats.pendingInvoices || 0} unpaid invoices` },
    { label: 'GST Payable', value: formatCurrency(netPayable), icon: TrendingUp, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', sub: 'Output − Input' },
    { label: 'Customers', value: stats.customerCount || 0, icon: Users, color: '#4f8fff', bg: 'rgba(79,143,255,0.12)', sub: 'In your database' },
  ]

  const chartData = monthlySales.map(m => ({ ...m, revenue: m.total || m.revenue || 0 }))

  const gstPie = [
    { name: 'CGST', value: Math.max(0, stats.netPayable?.cgst || 0) },
    { name: 'SGST', value: Math.max(0, stats.netPayable?.sgst || 0) },
    { name: 'IGST', value: Math.max(0, stats.netPayable?.igst || 0) },
  ].filter(d => d.value > 0)

  // Monthly comparison
  const thisMonth = monthlySales.length > 0 ? parseFloat(monthlySales[monthlySales.length - 1]?.total || 0) : 0
  const lastMonth = monthlySales.length > 1 ? parseFloat(monthlySales[monthlySales.length - 2]?.total || 0) : 0
  const monthGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100).toFixed(1) : null

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div></div>

  const fmtTooltip = (val) => formatCurrency(val)

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--accent-dark), var(--accent), var(--accent-light))' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3), transparent 50%)' }}></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Welcome, {user?.name || 'User'}!</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{user?.organization?.name} • GSTIN: {user?.organization?.gstin || 'N/A'}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>{today}</p>
          </div>
          {monthGrowth !== null && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)' }}>
              {parseFloat(monthGrowth) >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
              <div>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>vs Last Month</p>
                <p className="font-bold text-lg">{parseFloat(monthGrowth) >= 0 ? '+' : ''}{monthGrowth}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {quickActions.map((a, i) => (
          <Link key={i} to={a.path} className="card text-center group" style={{ animation: `slideUp 0.5s ease-out ${i * 0.05}s both`, padding: '16px' }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mx-auto mb-2 group-hover:scale-110 transition-transform"
              style={{ background: `${a.color}20`, color: a.color }}>
              <a.icon size={22} />
            </div>
            <p className="text-sm font-medium text-white/60">{a.label}</p>
          </Link>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((m, i) => (
          <div key={i} className="card" style={{ animation: `slideUp 0.5s ease-out ${i * 0.1}s both` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/40">{m.label}</span>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: m.bg, color: m.color }}>
                <m.icon size={20} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{m.value}</p>
            <p className="text-xs text-white/30 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Main Charts + GST Summary */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-white">Sales Performance</h3>
              <p className="text-xs text-white/30">Current Financial Year</p>
            </div>
            <div className="flex gap-1">
              {[['bar','Bar'],['line','Line'],['area','Area']].map(([val, label]) => (
                <button key={val} onClick={() => setChartType(val)}
                  className="px-2 py-1 text-xs rounded font-medium transition-all"
                  style={chartType === val
                    ? { background: 'var(--accent)', color: '#fff' }
                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }
                  }>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip formatter={fmtTooltip} contentStyle={{ background: '#0c1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                  <Bar dataKey="revenue" fill="var(--accent)" radius={[4,4,0,0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip formatter={fmtTooltip} contentStyle={{ background: '#0c1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#4f8fff" strokeWidth={2} name="Revenue" dot={{ r: 4, fill: '#4f8fff' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {chartType === 'area' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} />
                  <Tooltip formatter={fmtTooltip} contentStyle={{ background: '#0c1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* GST Summary */}
          <div className="card">
            <h3 className="font-bold text-white mb-4">GST Summary</h3>
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ background: 'rgba(79,143,255,0.08)', border: '1px solid rgba(79,143,255,0.12)' }}>
                <p className="text-sm font-medium text-blue-400">Output GST (Sales)</p>
                <p className="text-xl font-bold text-blue-300">{formatCurrency(stats.outputGST?.total || 0)}</p>
                <div className="flex gap-3 mt-1 text-xs text-white/30">
                  <span>CGST: {formatCurrency(stats.outputGST?.cgst || 0)}</span>
                  <span>SGST: {formatCurrency(stats.outputGST?.sgst || 0)}</span>
                  <span>IGST: {formatCurrency(stats.outputGST?.igst || 0)}</span>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.12)' }}>
                <p className="text-sm font-medium text-cyan-400">Input GST (Purchases)</p>
                <p className="text-xl font-bold text-cyan-300">{formatCurrency(stats.inputGST?.total || 0)}</p>
                <div className="flex gap-3 mt-1 text-xs text-white/30">
                  <span>CGST: {formatCurrency(stats.inputGST?.cgst || 0)}</span>
                  <span>SGST: {formatCurrency(stats.inputGST?.sgst || 0)}</span>
                  <span>IGST: {formatCurrency(stats.inputGST?.igst || 0)}</span>
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)' }}>
                <p className="text-sm font-medium text-red-400">Net Payable</p>
                <p className="text-xl font-bold text-red-300">{formatCurrency(netPayable)}</p>
                <div className="flex gap-3 mt-1 text-xs text-white/30">
                  <span>CGST: {formatCurrency(stats.netPayable?.cgst || 0)}</span>
                  <span>SGST: {formatCurrency(stats.netPayable?.sgst || 0)}</span>
                  <span>IGST: {formatCurrency(stats.netPayable?.igst || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* GST Pie */}
          {gstPie.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-white mb-2">GST Split</h3>
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gstPie} cx="50%" cy="50%" outerRadius={50} innerRadius={25} dataKey="value">
                      {gstPie.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={fmtTooltip} contentStyle={{ background: '#0c1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-3 mt-1">
                {gstPie.map((d, i) => <span key={i} className="text-xs flex items-center gap-1 text-white/40"><span style={{ width: 8, height: 8, borderRadius: '50%', background: CHART_COLORS[i], display: 'inline-block' }}></span>{d.name}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Recent Invoices + Top Customers */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Recent Invoices</h3>
            <Link to="/app/invoices" className="text-sm font-medium accent-text">View All →</Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-center py-8 text-white/25">No invoices yet. Create your first invoice!</p>
          ) : (
            <div className="space-y-2">
              {recentInvoices.slice(0, 6).map(inv => (
                <Link key={inv.id} to={`/app/invoices/${inv.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)' }}>
                      <FileText size={16} className="accent-text" />
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-white/40">{inv.customer_name || 'N/A'} • {formatDate(inv.invoice_date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-sm">{formatCurrency(inv.total_amount)}</p>
                    <span className={`text-xs font-medium ${inv.payment_status === 'Paid' ? 'text-green-400' : inv.payment_status === 'Partial' ? 'text-yellow-400' : 'text-red-400'}`}>
                      {inv.payment_status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top Customers */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Top Customers</h3>
            <Link to="/app/customers" className="text-sm font-medium accent-text">View All →</Link>
          </div>
          {topCustomers.length === 0 ? (
            <p className="text-center py-8 text-white/25">No customer data yet</p>
          ) : (
            <div className="space-y-2">
              {topCustomers.map((c, i) => (
                <Link key={c.id} to={`/app/customers/${c.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm"
                      style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}20`, color: CHART_COLORS[i % CHART_COLORS.length] }}>
                      #{i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{c.name}</p>
                      <p className="text-xs text-white/40">{c.gstin ? `${c.gstin.substring(0,2)}...` : 'No GSTIN'} • {c.city || c.state || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-sm">{formatCurrency(c.totalBusiness)}</p>
                    <span className={`text-xs font-medium ${!c.state_code || c.state_code === '27' ? 'text-cyan-400' : 'text-orange-400'}`}>
                      {!c.state_code || c.state_code === '27' ? 'Intra' : 'Inter'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <GSTCalcModal />
    </div>
  )
}
