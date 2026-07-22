import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { Plus, Users, CreditCard, FileText, Calculator, TrendingUp, IndianRupee, AlertCircle, UserPlus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend, ComposedChart } from 'recharts'
import GSTCalcModal from '../components/GSTCalcModal'
import { formatCurrency, formatDate } from '../utils'

const CHART_COLORS = ['#06b6d4', '#4f8fff', '#a855f7', '#22c55e', '#ef4444', '#f59e0b', '#ec4899']

// ═══════════════════════════════════════════
// ANIMATED COUNTER — counts up on mount
// ═══════════════════════════════════════════
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
      const eased = 1 - Math.pow(1 - progress, 4) // quartic ease-out
      setValue(Math.floor(startVal + (target - startVal) * eased))
      if (progress < 1) requestAnimationFrame(update)
    }
    requestAnimationFrame(update)
  }, [target, duration])
  return value
}

// ═══════════════════════════════════════════
// 3D TILT CARD — premium hover effect
// ═══════════════════════════════════════════
function TiltCard({ children, className, style }) {
  const cardRef = useRef(null)
  const handleMouseMove = useCallback((e) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const tiltX = (y - 0.5) * 10
    const tiltY = (x - 0.5) * -10
    card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translate3d(0,-6px,0) scale(1.02)`
    card.style.setProperty('--mx', `${x * 100}%`)
    card.style.setProperty('--my', `${y * 100}%`)
  }, [])
  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current
    if (!card) return
    card.style.transform = ''
  }, [])
  return (
    <div ref={cardRef} className={className} style={{ ...style, transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s ease, border-color 0.3s ease', willChange: 'transform' }}
      onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════
// SKELETON LOADING — shimmer effect
// ═══════════════════════════════════════════
function SkeletonBlock({ w, h, radius = '12px', className = '' }) {
  return (
    <div className={className} style={{
      width: w, height: h, borderRadius: radius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite'
    }} />
  )
}

function SkeletonMetricCard() {
  return (
    <div className="stat-card" style={{ animation: 'entranceScale 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
      <div className="shimmer"></div>
      <div className="flex items-center justify-between mb-3">
        <SkeletonBlock w="80px" h="14px" radius="6px" />
        <SkeletonBlock w="40px" h="40px" radius="10px" />
      </div>
      <SkeletonBlock w="120px" h="28px" radius="6px" />
      <SkeletonBlock w="100px" h="12px" radius="4px" className="mt-2" />
    </div>
  )
}

function SkeletonChart() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <SkeletonBlock w="160px" h="18px" radius="6px" />
          <SkeletonBlock w="120px" h="12px" radius="4px" className="mt-2" />
        </div>
        <SkeletonBlock w="120px" h="32px" radius="8px" />
      </div>
      <div style={{ height: 256, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 10px' }}>
        {Array.from({length: 12}).map((_, i) => (
          <div key={i} style={{
            flex: 1,
            height: `${30 + Math.random() * 70}%`,
            borderRadius: '6px 6px 0 0',
            background: 'linear-gradient(180deg, rgba(var(--accent-rgb),0.15), rgba(var(--accent-rgb),0.03))',
            animation: `entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.04}s both`
          }} />
        ))}
      </div>
    </div>
  )
}

function SkeletonList() {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <SkeletonBlock w="140px" h="18px" radius="6px" />
        <SkeletonBlock w="70px" h="14px" radius="4px" />
      </div>
      <div className="space-y-3">
        {Array.from({length: 4}).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3">
              <SkeletonBlock w="36px" h="36px" radius="8px" />
              <div>
                <SkeletonBlock w="100px" h="14px" radius="4px" />
                <SkeletonBlock w="140px" h="10px" radius="3px" className="mt-1" />
              </div>
            </div>
            <div className="text-right">
              <SkeletonBlock w="80px" h="14px" radius="4px" />
              <SkeletonBlock w="50px" h="10px" radius="3px" className="mt-1" />
            </div>
          </div>
        ))}
      </div>
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
      const [statsRes, custRes] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ data: { stats: {}, recentInvoices: [], monthlySales: [] } })),
        api.get('/customers').catch(() => ({ data: { customers: [] } }))
      ])
      setStats(statsRes.data.stats || {})
      setRecentInvoices(statsRes.data.recentInvoices || [])
      setMonthlySales(statsRes.data.monthlySales || [])

      const allCusts = custRes.data.customers || []
      if (allCusts.length > 0) {
        const custDetails = await Promise.allSettled(
          allCusts.slice(0, 20).map(async c => {
            try {
              const cRes = await api.get(`/customers/${c.id}`)
              return { ...c, totalBusiness: cRes.data.totalBusiness || 0 }
            } catch { return { ...c, totalBusiness: 0 } }
          })
        )
        const successful = custDetails.filter(r => r.status === 'fulfilled').map(r => r.value)
          .sort((a, b) => b.totalBusiness - a.totalBusiness).slice(0, 5)
        setTopCustomers(successful)
      }
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

  const chartData = monthlySales.map(m => ({
    ...m,
    revenue: m.total || m.revenue || 0,
    gst: (parseFloat(m.cgst_amount || 0) || 0) + (parseFloat(m.sgst_amount || 0) || 0) + (parseFloat(m.igst_amount || 0) || 0),
    profit: (m.total || m.revenue || 0) - ((parseFloat(m.cgst_amount || 0) || 0) + (parseFloat(m.sgst_amount || 0) || 0) + (parseFloat(m.igst_amount || 0) || 0)),
  }))

  const gstPie = [
    { name: 'CGST', value: Math.max(0, stats.netPayable?.cgst || 0) },
    { name: 'SGST', value: Math.max(0, stats.netPayable?.sgst || 0) },
    { name: 'IGST', value: Math.max(0, stats.netPayable?.igst || 0) },
  ].filter(d => d.value > 0)

  const thisMonth = monthlySales.length > 0 ? parseFloat(monthlySales[monthlySales.length - 1]?.total || 0) : 0
  const lastMonth = monthlySales.length > 1 ? parseFloat(monthlySales[monthlySales.length - 2]?.total || 0) : 0
  const monthGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth * 100).toFixed(1) : null

  // ═══ SKELETON LOADING ═══
  if (loading) return (
    <div className="space-y-6">
      <div className="rounded-2xl p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--accent-dark), var(--accent), var(--accent-light))', height: 120, animation: 'entranceScale 0.6s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3), transparent 50%)' }}></div>
        <SkeletonBlock w="220px" h="28px" radius="6px" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <SkeletonBlock w="300px" h="16px" radius="4px" className="mt-3" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {Array.from({length: 5}).map((_, i) => (
          <div key={i} className="action-card" style={{ padding: '16px', animation: `entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}>
            <SkeletonBlock w="40px" h="40px" radius="8px" />
            <SkeletonBlock w="70px" h="14px" radius="4px" className="mt-2" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger">
        <SkeletonMetricCard /><SkeletonMetricCard /><SkeletonMetricCard /><SkeletonMetricCard />
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><SkeletonChart /></div>
        <div className="space-y-4">
          <div className="card">
            <SkeletonBlock w="120px" h="18px" radius="6px" className="mb-4" />
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} style={{ background: 'rgba(var(--accent-rgb),0.04)', border: '1px solid rgba(var(--accent-rgb),0.08)', borderRadius: 12, padding: 12 }}>
                  <SkeletonBlock w="120px" h="14px" radius="4px" />
                  <SkeletonBlock w="100px" h="22px" radius="4px" className="mt-2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-6"><SkeletonList /><SkeletonList /></div>
      <GSTCalcModal />
    </div>
  )

  const fmtTooltip = (val) => formatCurrency(val)

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════════
          WELCOME BANNER — Cinematic gradient with dot pattern
          ═══════════════════════════════════════════ */}
      <div className="rounded-2xl p-7 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--accent-dark), var(--accent), var(--accent-light))', animation: 'entranceScale 0.7s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3), transparent 50%)' }}></div>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '28px 28px' }}></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <h1 className="text-2xl font-extrabold mb-1" style={{ letterSpacing: '-0.5px' }}>Welcome, {user?.name || 'User'}! 👋</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{user?.organization?.name} • GSTIN: {user?.organization?.gstin || 'N/A'}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{today}</p>
          </div>
          {monthGrowth !== null && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
              {parseFloat(monthGrowth) >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
              <div>
                <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>vs Last Month</p>
                <p className="font-extrabold text-xl">{parseFloat(monthGrowth) >= 0 ? '+' : ''}{monthGrowth}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          QUICK ACTIONS — Staggered entrance + magnetic hover
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {quickActions.map((a, i) => (
          <Link key={i} to={a.path} className="action-card card-premium"
            style={{ padding: '16px', animation: `entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) ${0.08 + i * 0.06}s both` }}>
            <div className="action-icon w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
              style={{ background: a.bg, color: a.color }}>
              <a.icon size={20} />
            </div>
            <span className="text-sm font-semibold text-white/70">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* ═══════════════════════════════════════════
          STAT CARDS — 3D Tilt + Holographic + Counter
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((m, i) => (
          <TiltCard key={i} className="stat-card card-premium"
            style={{ animation: `entranceScale 0.6s cubic-bezier(0.16,1,0.3,1) ${0.15 + i * 0.1}s both` }}>
            <div className="shimmer"></div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/35">{m.label}</span>
              <div className="stat-icon w-11 h-11 rounded-xl flex items-center justify-center relative"
                style={{ background: m.bg, color: m.color }}>
                <m.icon size={20} />
                <div className="stat-pulse-ring" style={{ color: m.color }}></div>
              </div>
            </div>
            <p className="text-[26px] font-extrabold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-0.5px' }}>
              {m.isCurrency ? formatCurrency(m.value) : m.value}
            </p>
            <p className="text-[11px] text-white/25 mt-1.5">{m.sub}</p>
          </TiltCard>
        ))}
      </div>

      {/* ═══ Glow Line Separator ═══ */}
      <div className="glow-line"></div>

      {/* ═══════════════════════════════════════════
          CHARTS + GST SUMMARY
          ═══════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card card-premium" style={{ animation: 'entranceUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.4s both' }}>
          <div className="shimmer"></div>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-white text-[15px]">Sales Performance</h3>
              <p className="text-xs text-white/25 mt-0.5">Current Financial Year</p>
            </div>
            <div className="flex gap-1.5">
              {[['bar','Bar'],['line','Line'],['area','Area']].map(([val, label]) => (
                <button key={val} onClick={() => setChartType(val)}
                  className={`chip btn-shine ${chartType === val ? 'active' : ''}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <Tooltip formatter={(val, name) => formatCurrency(val)} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', backdropFilter: 'blur(20px)' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} />
                  <Bar dataKey="revenue" fill="var(--accent)" radius={[4,4,0,0]} name="Revenue" />
                  <Bar dataKey="gst" fill="#a855f7" radius={[4,4,0,0]} name="GST" opacity={0.7} />
                  <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} name="Trend" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <Tooltip formatter={(val, name) => formatCurrency(val)} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#4f8fff" strokeWidth={3} name="Revenue" dot={{ r: 5, fill: '#4f8fff', strokeWidth: 2, stroke: '#1a1a2e' }} activeDot={{ r: 7 }} />
                  <Line type="monotone" dataKey="gst" stroke="#a855f7" strokeWidth={2} name="GST" dot={{ r: 3, fill: '#a855f7' }} />
                  <Area type="monotone" dataKey="revenue" fill="rgba(79,143,255,0.08)" stroke="none" name="" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            {chartType === 'area' && (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} />
                  <Tooltip formatter={(val, name) => formatCurrency(val)} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }} />
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorGST" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={3} fill="url(#colorRevenue)" name="Revenue" />
                  <Area type="monotone" dataKey="gst" stroke="#a855f7" strokeWidth={2} fill="url(#colorGST)" name="GST" />
                  <Bar dataKey="profit" fill="#22c55e" radius={[2,2,0,0]} name="Profit" opacity={0.5} barSize={8} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="space-y-4" style={{ animation: 'entranceUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
          {/* GST Summary */}
          <div className="card card-premium">
            <h3 className="font-bold text-white mb-4 text-[15px]">GST Summary</h3>
            <div className="space-y-3">
              <div className="gst-card cgst rounded-xl p-4 relative overflow-hidden">
                <p className="text-sm font-semibold text-blue-400 mb-1">Output GST (Sales)</p>
                <p className="text-xl font-extrabold text-blue-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{formatCurrency(stats.outputGST?.total || 0)}</p>
                <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                  <span>CGST: {formatCurrency(stats.outputGST?.cgst || 0)}</span>
                  <span>SGST: {formatCurrency(stats.outputGST?.sgst || 0)}</span>
                  <span>IGST: {formatCurrency(stats.outputGST?.igst || 0)}</span>
                </div>
              </div>
              <div className="gst-card sgst rounded-xl p-4 relative overflow-hidden">
                <p className="text-sm font-semibold text-cyan-400 mb-1">Input GST (Purchases)</p>
                <p className="text-xl font-extrabold text-cyan-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{formatCurrency(stats.inputGST?.total || 0)}</p>
                <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                  <span>CGST: {formatCurrency(stats.inputGST?.cgst || 0)}</span>
                  <span>SGST: {formatCurrency(stats.inputGST?.sgst || 0)}</span>
                  <span>IGST: {formatCurrency(stats.inputGST?.igst || 0)}</span>
                </div>
              </div>
              <div className="gst-card igst rounded-xl p-4 relative overflow-hidden">
                <p className="text-sm font-semibold text-red-400 mb-1">Net Payable</p>
                <p className="text-xl font-extrabold text-red-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{formatCurrency(netPayable)}</p>
                <div className="flex gap-3 mt-2 text-[10px] text-white/30">
                  <span>CGST: {formatCurrency(stats.netPayable?.cgst || 0)}</span>
                  <span>SGST: {formatCurrency(stats.netPayable?.sgst || 0)}</span>
                  <span>IGST: {formatCurrency(stats.netPayable?.igst || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* GST Pie */}
          {gstPie.length > 0 && (
            <div className="card card-premium">
              <h3 className="font-bold text-white mb-2 text-[15px]">GST Split</h3>
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gstPie} cx="50%" cy="50%" outerRadius={50} innerRadius={25} dataKey="value" strokeWidth={0}>
                      {gstPie.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={fmtTooltip} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-3 mt-1">
                {gstPie.map((d, i) => <span key={i} className="text-xs flex items-center gap-1.5 text-white/40"><span style={{ width: 8, height: 8, borderRadius: '50%', background: CHART_COLORS[i], display: 'inline-block' }}></span>{d.name}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          RECENT INVOICES + TOP CUSTOMERS
          ═══════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card card-premium" style={{ animation: 'entranceUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
          <div className="shimmer"></div>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white text-[15px]">Recent Invoices</h3>
            <Link to="/app/invoices" className="text-sm font-semibold accent-text btn-shine" style={{ padding: '4px 10px', borderRadius: 8 }}>View All →</Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-center py-8 text-white/25">No invoices yet. Create your first invoice!</p>
          ) : (
            <div className="space-y-1.5 stagger">
              {recentInvoices.slice(0, 6).map((inv, i) => (
                <Link key={inv.id} to={`/app/invoices/${inv.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200 group"
                  style={{ animation: `entranceLeft 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110" style={{ background: 'rgba(var(--accent-rgb),0.08)' }}>
                      <FileText size={16} className="accent-text" />
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{inv.invoice_number}</p>
                      <p className="text-[11px] text-white/35">{inv.customer_name || 'N/A'} • {formatDate(inv.invoice_date)}</p>
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

        <div className="card card-premium" style={{ animation: 'entranceUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.6s both' }}>
          <div className="shimmer"></div>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white text-[15px]">Top Customers</h3>
            <Link to="/app/customers" className="text-sm font-semibold accent-text btn-shine" style={{ padding: '4px 10px', borderRadius: 8 }}>View All →</Link>
          </div>
          {topCustomers.length === 0 ? (
            <p className="text-center py-8 text-white/25">No customer data yet</p>
          ) : (
            <div className="space-y-1.5 stagger">
              {topCustomers.map((c, i) => (
                <Link key={c.id} to={`/app/customers/${c.id}`}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.03] transition-all duration-200 group"
                  style={{ animation: `entranceLeft 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 0.06}s both` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm transition-transform duration-200 group-hover:scale-110 group-hover:rotate-[-3deg]"
                      style={{ background: `${CHART_COLORS[i % CHART_COLORS.length]}18`, color: CHART_COLORS[i % CHART_COLORS.length] }}>
                      #{i + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-white text-sm">{c.name}</p>
                      <p className="text-[11px] text-white/35">{c.gstin ? `${c.gstin.substring(0,2)}...` : 'No GSTIN'} • {c.city || c.state || '—'}</p>
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
