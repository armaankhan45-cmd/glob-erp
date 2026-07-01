import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { Plus, Users, CreditCard, FileText, Calculator, TrendingUp, IndianRupee, AlertCircle, UserPlus, ArrowUpRight, ArrowDownRight, Clock, Target } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import GSTCalcModal from '../components/GSTCalcModal'
import { formatCurrency } from '../utils'

const CHART_COLORS = ['#06b6d4', '#4f8fff', '#a855f7', '#22c55e', '#ef4444', '#f59e0b', '#ec4899']

// Animated counter hook
function useAnimatedCounter(target, duration = 1500) {
  const [value, setValue] = useState(0)
  const prevTarget = useRef(0)
  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target
    const start = performance.now()
    const startVal = value
    function update(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.floor(startVal + (target - startVal) * eased))
      if (progress < 1) requestAnimationFrame(update)
    }
    requestAnimationFrame(update)
  }, [target, duration])
  return value
}

// 3D Tilt Card component
function TiltCard({ children, className, style, onMouseMove, onMouseLeave }) {
  const cardRef = useRef(null)
  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const tiltX = (y - 0.5) * 6
    const tiltY = (x - 0.5) * -6
    card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translate3d(0,-4px,0)`
    card.style.setProperty('--mx', `${x * 100}%`)
    card.style.setProperty('--my', `${y * 100}%`)
  }, [])
  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = ''
  }, [])
  return (
    <div ref={cardRef} className={className} style={{ ...style, transition: 'transform 0.15s ease-out', willChange: 'transform' }}
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
    </div>
  )
}

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
      try {
        const custRes = await api.get('/customers')
        const allCusts = custRes.data.customers || []
        const custWithBiz = await Promise.all(allCusts.slice(0, 20).map(async c => {
          try { const cRes = await api.get(`/customers/${c.id}`); return { ...c, totalBusiness: cRes.data.totalBusiness || 0 } }
          catch { return { ...c, totalBusiness: 0 } }
        }))
        setTopCustomers(custWithBiz.sort((a, b) => b.totalBusiness - a.totalBusiness).slice(0, 5))
      } catch {}
    } catch (err) { console.error('Dashboard error:', err) }
    finally { setLoading(false) }
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const quickActions = [
    { label: 'New Invoice', path: '/app/invoices/new', icon: FileText, color: '#06b6d4', bg: 'rgba(6,182,212,0.12)' },
    { label: 'Add Customer', path: '/app/customers', icon: UserPlus, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    { label: 'New Quote', path: '/app/quotations/new', icon: Plus, color: '#a855f7', bg: 'rgba(168,85,247,0.12)' },
    { label: 'GST Reports', path: '/app/gst', icon: Calculator, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { label: 'Record Purchase', path: '/app/purchases/new', icon: CreditCard, color: '#4f8fff', bg: 'rgba(79,143,255,0.12)' },
  ]

  const pendingAmount = stats.pendingAmount || 0
  const netPayable = (stats.netPayable?.cgst || 0) + (stats.netPayable?.sgst || 0) + (stats.netPayable?.igst || 0)

  const metricCards = [
    { label: 'Total Revenue', value: stats.totalRevenue || 0, icon: IndianRupee, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', sub: 'All time sales', isCurrency: true },
    { label: 'Outstanding', value: pendingAmount || 0, icon: AlertCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', sub: `${stats.pendingInvoices || 0} unpaid invoices`, isCurrency: true },
    { label: 'GST Payable', value: netPayable || 0, icon: TrendingUp, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', sub: 'Output − Input', isCurrency: true },
    { label: 'Customers', value: stats.customerCount || 0, icon: Users, color: '#4f8fff', bg: 'rgba(79,143,255,0.12)', sub: 'In your database', isCurrency: false },
  ]

  const chartData = monthlySales.map(m => ({ ...m, revenue: m.total || m.revenue || 0 }))

  const gstPie = [
    { name: 'CGST', value: Math.max(0, stats.netPayable?.cgst || 0) },
    { name: 'SGST', value: Math.max(0, stats.netPayable?.sgst || 0) },
    { name: 'IGST', value: Math.max(0, stats.netPayable?.igst || 0) },
  ].filter(d => d.value > 0)

  const thisMonth = monthlySales.length > 0 ? parseFloat(monthlySales[monthlySales.length - 1]?.total || 0) : 0
  const lastMonth = monthlySales.length > 1 ? parseFloat(monthlySales[monthlySales.length - 2]?.total || 0) : 0
  const monthGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100).toFixed(1) : null

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin h-10 w-10 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div>
    </div>
  )

  const fmtTooltip = (val) => formatCurrency(val)

  return (
    <div className="space-y-6">
      {/* Welcome Banner - Enhanced */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--accent-dark), var(--accent), var(--accent-light))' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3), transparent 50%)' }}></div>
        {/* Animated dots pattern */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Welcome, {user?.name || 'User'}! 👋</h1>
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

      {/* Quick Actions - Enhanced with action-card style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 stagger">
        {quickActions.map((a, i) => (
          <Link key={i} to={a.path} className="action-card" style={{ padding: '16px', animationDelay: `${i * 0.05}s` }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ background: a.bg, color: a.color }}>
              <a.icon size={20} />
            </div>
            <span className="text-sm font-medium text-white/70">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Metric Cards - 3D Tilt + Shimmer + Counter Animation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        {metricCards.map((m, i) => (
          <TiltCard key={i} className="stat-card" style={{ animation: `slideUp 0.5s ease-out ${i * 0.1}s both` }}>
            <div className="shimmer"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/40">{m.label}</span>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: m.bg, color: m.color }}>
                <m.icon size={20} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              {m.isCurrency ? formatCurrency(m.value) : m.value}
            </p>
            <p className="text-xs text-white/30 mt-1">{m.sub}</p>
          </TiltCard>
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
                  className={`chip ${chartType === val ? 'active' : ''}`}>
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
                  <Tooltip formatter={fmtTooltip} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', backdropFilter: 'blur(20px)' }} />
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
                  <Tooltip formatter={fmtTooltip} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
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
                  <Tooltip formatter={fmtTooltip} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
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
          {/* GST Summary - Card style */}
          <div className="card">
            <h3 className="font-bold text-white mb-4">GST Summary</h3>
            <div className="space-y-3">
              <div className="gst-card cgst" style={{ background: 'rgba(79,143,255,0.06)', border: '1px solid rgba(79,143,255,0.12)' }}>
                <p className="text-sm font-medium text-blue-400">Output GST (Sales)</p>
                <p className="text-xl font-bold text-blue-300">{formatCurrency(stats.outputGST?.total || 0)}</p>
                <div className="flex gap-3 mt-1 text-xs text-white/30">
                  <span>CGST: {formatCurrency(stats.outputGST?.cgst || 0)}</span>
                  <span>SGST: {formatCurrency(stats.outputGST?.sgst || 0)}</span>
                  <span>IGST: {formatCurrency(stats.outputGST?.igst || 0)}</span>
                </div>
              </div>
              <div className="gst-card sgst" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.12)' }}>
                <p className="text-sm font-medium text-cyan-400">Input GST (Purchases)</p>
                <p className="text-xl font-bold text-cyan-300">{formatCurrency(stats.inputGST?.total || 0)}</p>
                <div className="flex gap-3 mt-1 text-xs text-white/30">
                  <span>CGST: {formatCurrency(stats.inputGST?.cgst || 0)}</span>
                  <span>SGST: {formatCurrency(stats.inputGST?.sgst || 0)}</span>
                  <span>IGST: {formatCurrency(stats.inputGST?.igst || 0)}</span>
                </div>
              </div>
              <div className="gst-card igst" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
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
                    <Tooltip formatter={fmtTooltip} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
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
            <div className="space-y-2 stagger">
              {recentInvoices.slice(0, 6).map(inv => (
                <Link key={inv.id} to={`/app/invoices/${inv.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200 group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ background: 'rgba(var(--accent-rgb),0.1)' }}>
                      <FileText size={16} className="accent-text" />
                    </div>
                    <div>
                      <p className="font-medium text-white text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-white/40">{inv.customer_name || 'N/A'} • {formatDate(inv.invoice_date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-white text-sm">{formatCurrency(inv.total_amount)}</p>
                    <span className={`status-badge text-[10px] ${inv.payment_status === 'Paid' ? 'status-paid' : inv.payment_status === 'Partial' ? 'status-pending' : 'status-overdue'}`}
                      style={{ padding: '2px 8px' }}>
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
            <div className="space-y-2 stagger">
              {topCustomers.map((c, i) => (
                <Link key={c.id} to={`/app/customers/${c.id}`} className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200 group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm transition-transform duration-200 group-hover:scale-110"
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
                    <span className={`status-badge text-[10px] ${!c.state_code || c.state_code === '27' ? 'status-sent' : 'status-pending'}`}
                      style={{ padding: '2px 8px' }}>
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
