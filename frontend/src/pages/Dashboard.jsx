import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { Plus, Users, CreditCard, FileText, Calculator, TrendingUp, IndianRupee, AlertCircle, UserPlus, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import GSTCalcModal from '../components/GSTCalcModal'
import BorderGlow from '../components/BorderGlow'
import SplitText from '../components/SplitText'
import AnimatedList from '../components/AnimatedList'
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
// TILT CARD — simple, no 3D transform (removed 3D tilt for stability)
// ═══════════════════════════════════════════
function TiltCard({ children, className, style }) {
  return (
    <div className={className} style={style}>
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

// Current calendar month as 'YYYY-MM', used as the dashboard's default view.
function currentMonthStr() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({})
  const [recentInvoices, setRecentInvoices] = useState([])
  const [topCustomers, setTopCustomers] = useState([])
  const [chartData, setChartData] = useState([])
  const [chartType, setChartType] = useState('bar')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // ═══ Period selector: 'month' shows one calendar month, 'all' shows everything ═══
  const [period, setPeriod] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr())
  const [periodMeta, setPeriodMeta] = useState({ periodLabel: '', isCurrentMonth: true, momGrowth: null, momCompareLabel: '' })

  useEffect(() => { loadDashboard() }, [period, selectedMonth])

  const loadDashboard = async () => {
    const isFirstLoad = Object.keys(stats).length === 0
    if (isFirstLoad) setLoading(true); else setRefreshing(true)
    try {
      const params = period === 'all' ? { period: 'all' } : { period: 'month', month: selectedMonth }
      const statsRes = await api.get('/dashboard/stats', { params })
      setStats(statsRes.data.stats || {})
      setRecentInvoices(statsRes.data.recentInvoices || [])
      // The backend already computes top customers with a single grouped query —
      // no need to loop over /customers/:id client-side like before.
      setTopCustomers(statsRes.data.topCustomers || [])
      setChartData(statsRes.data.chartData || [])
      setPeriodMeta({
        periodLabel: statsRes.data.periodLabel || '',
        isCurrentMonth: !!statsRes.data.isCurrentMonth,
        momGrowth: statsRes.data.momGrowth,
        momCompareLabel: statsRes.data.momCompareLabel || ''
      })
    } catch (err) { console.error('Dashboard error:', err) }
    finally { setLoading(false); setRefreshing(false) }
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
  const periodSub = period === 'all' ? 'All time' : periodMeta.periodLabel || 'This month'

  const metricCards = [
    { label: 'Total Revenue', value: stats.totalRevenue || 0, icon: IndianRupee, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', sub: periodSub, isCurrency: true },
    { label: 'Outstanding', value: pendingAmount || 0, icon: AlertCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', sub: `${stats.pendingInvoices || 0} unpaid invoices`, isCurrency: true },
    { label: 'GST Payable', value: netPayable || 0, icon: TrendingUp, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', sub: `${periodSub} · Output − Input`, isCurrency: true },
    { label: 'Customers', value: stats.customerCount || 0, icon: Users, color: '#4f8fff', bg: 'rgba(79,143,255,0.12)', sub: 'In your database', isCurrency: false },
  ]

  const gstPie = [
    { name: 'CGST', value: Math.max(0, stats.netPayable?.cgst || 0) },
    { name: 'SGST', value: Math.max(0, stats.netPayable?.sgst || 0) },
    { name: 'IGST', value: Math.max(0, stats.netPayable?.igst || 0) },
  ].filter(d => d.value > 0)

  const monthGrowth = periodMeta.momGrowth
  const chartHasData = chartData.some(d => (d.revenue || 0) > 0 || (d.expenses || 0) > 0)

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

  // ═══ AnimatedList item renderers ═══
  const invoiceListItem = (inv, index, isSelected) => (
    <Link to={`/app/invoices/${inv.id}`} style={{ textDecoration: 'none' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.08)' }}>
            <FileText size={16} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>{inv.invoice_number}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{inv.customer_name || 'N/A'} • {formatDate(inv.invoice_date)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{formatCurrency(inv.total_amount)}</p>
          <span className={`status-badge text-[10px] ${inv.payment_status === 'Paid' ? 'status-paid' : inv.payment_status === 'Partial' ? 'status-pending' : 'status-overdue'}`}
            style={{ padding: '2px 8px' }}>
            {inv.payment_status}
          </span>
        </div>
      </div>
    </Link>
  )

  const customerListItem = (c, index, isSelected) => (
    <Link to={`/app/customers/${c.id}`} style={{ textDecoration: 'none' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm"
            style={{ background: `${CHART_COLORS[index % CHART_COLORS.length]}18`, color: CHART_COLORS[index % CHART_COLORS.length] }}>
            #{index + 1}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>{c.name}</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.gstin ? `${c.gstin.substring(0,2)}...` : 'No GSTIN'} • {c.city || c.state || '—'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{formatCurrency(c.totalBusiness)}</p>
          <span className={`status-badge text-[10px] ${!c.state_code || c.state_code === '27' ? 'status-sent' : 'status-pending'}`}
            style={{ padding: '2px 8px' }}>
            {!c.state_code || c.state_code === '27' ? 'Intra' : 'Inter'}
          </span>
        </div>
      </div>
    </Link>
  )

  return (
    <div className="space-y-6">

      {/* ═══════════════════════════════════════════
          WELCOME BANNER — SplitText animated heading
          ═══════════════════════════════════════════ */}
      <div className="rounded-2xl p-7 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--accent-dark), var(--accent), var(--accent-light))', animation: 'entranceScale 0.7s cubic-bezier(0.16,1,0.3,1) both' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3), transparent 50%)' }}></div>
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '28px 28px' }}></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            {/* SplitText — animated letter-by-letter welcome */}
            <h1 className="text-2xl font-extrabold mb-1" style={{ letterSpacing: '-0.5px' }}>
              <SplitText
                text={`Welcome, ${user?.name || 'User'}!`}
                tag="span"
                splitType="words"
                delay={60}
                duration={0.6}
                from={{ opacity: 0, y: 15 }}
                to={{ opacity: 1, y: 0 }}
              />
              <span> 👋</span>
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>{user?.organization?.name} • GSTIN: {user?.organization?.gstin || 'N/A'}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>{today}</p>
          </div>
          {monthGrowth !== null && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)' }}>
              {monthGrowth >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
              <div>
                <p className="text-[10px] font-medium" style={{ color: 'rgba(255,255,255,0.75)' }}>vs {periodMeta.momCompareLabel || 'Last Month'}</p>
                <p className="font-extrabold text-xl">{monthGrowth >= 0 ? '+' : ''}{monthGrowth}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          QUICK ACTIONS — Staggered entrance
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
          PERIOD SELECTOR — drives stat cards + Sales Performance chart below
          ═══════════════════════════════════════════ */}
      <div className="card card-premium flex flex-wrap items-center justify-between gap-3" style={{ padding: '12px 16px' }}>
        <div className="flex items-center gap-2 text-white/40 text-xs font-semibold uppercase tracking-wider">
          <Calendar size={14} />
          Viewing
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setPeriod('month'); setSelectedMonth(currentMonthStr()) }}
            className={`chip btn-shine ${period === 'month' && periodMeta.isCurrentMonth ? 'active' : ''}`}
          >
            This Month
          </button>

          <div className="flex items-center gap-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', padding: '2px' }}>
            <button
              onClick={() => { setPeriod('month'); setSelectedMonth(m => shiftMonth(m, -1)) }}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              title="Previous month"
            >
              <ChevronLeft size={16} className="text-white/50" />
            </button>
            <input
              type="month"
              value={selectedMonth}
              max={currentMonthStr()}
              onChange={e => { if (e.target.value) { setPeriod('month'); setSelectedMonth(e.target.value) } }}
              className="bg-transparent text-sm font-semibold text-white/80 outline-none"
              style={{ colorScheme: 'dark', border: 'none', padding: '4px 6px' }}
            />
            <button
              onClick={() => { setPeriod('month'); setSelectedMonth(m => shiftMonth(m, 1)) }}
              disabled={selectedMonth >= currentMonthStr()}
              className="p-1.5 rounded-lg hover:bg-white/10 transition disabled:opacity-20 disabled:cursor-not-allowed"
              title="Next month"
            >
              <ChevronRight size={16} className="text-white/50" />
            </button>
          </div>

          <button
            onClick={() => setPeriod('all')}
            className={`chip btn-shine ${period === 'all' ? 'active' : ''}`}
          >
            All Time
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          STAT CARDS — BorderGlow premium hover effect
          ═══════════════════════════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        {metricCards.map((m, i) => (
          <BorderGlow
            key={i}
            borderRadius={16}
            glowRadius={35}
            glowIntensity={0.7}
            edgeSensitivity={40}
            animated={true}
          >
            <TiltCard className="stat-card card-premium"
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
          </BorderGlow>
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
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-white text-[15px]">Sales Performance</h3>
              <p className="text-xs text-white/25 mt-0.5">
                {period === 'all' ? 'Monthly revenue vs expenses — trailing 12 months' : `Daily revenue vs expenses — ${periodMeta.periodLabel}`}
              </p>
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
          <div className="flex items-center gap-4 mb-3 text-xs">
            <span className="flex items-center gap-1.5 text-white/50"><span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }}></span>Revenue: <b className="text-white/80">{formatCurrency(chartData.reduce((s, d) => s + (d.revenue || 0), 0))}</b></span>
            <span className="flex items-center gap-1.5 text-white/50"><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }}></span>Expenses: <b className="text-white/80">{formatCurrency(chartData.reduce((s, d) => s + (d.expenses || 0), 0))}</b></span>
          </div>
          <div className="h-64">
            {!chartHasData ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                <TrendingUp size={28} className="text-white/15" />
                <p className="text-sm text-white/30">No invoices or expenses recorded {period === 'all' ? 'in the last 12 months' : `in ${periodMeta.periodLabel}`}</p>
              </div>
            ) : <>
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} interval={period === 'month' ? Math.ceil(chartData.length / 12) - 1 : 0} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} width={70} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={fmtTooltip} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', backdropFilter: 'blur(20px)' }} />
                  <Bar dataKey="revenue" fill="var(--accent)" radius={[4,4,0,0]} name="Revenue" />
                  <Bar dataKey="expenses" fill="#ef4444" radius={[4,4,0,0]} name="Expenses" fillOpacity={0.65} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} interval={period === 'month' ? Math.ceil(chartData.length / 12) - 1 : 0} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} width={70} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={fmtTooltip} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                  <Line type="monotone" dataKey="revenue" stroke="#4f8fff" strokeWidth={2.5} name="Revenue" dot={chartData.length <= 15} />
                  <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} name="Expenses" dot={chartData.length <= 15} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
            {chartType === 'area' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.3)' }} interval={period === 'month' ? Math.ceil(chartData.length / 12) - 1 : 0} axisLine={{ stroke: 'rgba(255,255,255,0.06)' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.3)' }} width={70} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : v >= 1000 ? `₹${(v/1000).toFixed(0)}k` : `₹${v}`} axisLine={false} tickLine={false} />
                  <Tooltip formatter={fmtTooltip} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} />
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="var(--accent)" strokeWidth={2.5} fill="url(#colorRevenue)" name="Revenue" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} fill="url(#colorExpenses)" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            )}
            </>}
          </div>
        </div>

        <div className="space-y-4" style={{ animation: 'entranceUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
          {/* GST Summary */}
          <div className="card card-premium">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white text-[15px]">GST Summary</h3>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">{periodSub}</span>
            </div>
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
          RECENT INVOICES + TOP CUSTOMERS — AnimatedList
          ═══════════════════════════════════════════ */}
      <div className="grid lg:grid-cols-2 gap-6">
        <BorderGlow borderRadius={18} glowRadius={25} glowIntensity={0.5} animated={true}>
          <div className="card card-premium" style={{ animation: 'entranceUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.5s both' }}>
            <div className="shimmer"></div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white text-[15px]">Recent Invoices</h3>
              <Link to="/app/invoices" className="text-sm font-semibold accent-text btn-shine" style={{ padding: '4px 10px', borderRadius: 8 }}>View All →</Link>
            </div>
            {recentInvoices.length === 0 ? (
              <p className="text-center py-8 text-white/25">No invoices yet. Create your first invoice!</p>
            ) : (
              <div style={{ height: 320 }}>
                <AnimatedList
                  items={recentInvoices.slice(0, 6)}
                  renderItem={invoiceListItem}
                  keyExtractor={(inv) => inv.id}
                  showGradients={true}
                  enableArrowNavigation={false}
                  displayScrollbar={false}
                />
              </div>
            )}
          </div>
        </BorderGlow>

        <BorderGlow borderRadius={18} glowRadius={25} glowIntensity={0.5} animated={true}>
          <div className="card card-premium" style={{ animation: 'entranceUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.6s both' }}>
            <div className="shimmer"></div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-white text-[15px]">Top Customers</h3>
              <Link to="/app/customers" className="text-sm font-semibold accent-text btn-shine" style={{ padding: '4px 10px', borderRadius: 8 }}>View All →</Link>
            </div>
            {topCustomers.length === 0 ? (
              <p className="text-center py-8 text-white/25">No customer data yet</p>
            ) : (
              <div style={{ height: 320 }}>
                <AnimatedList
                  items={topCustomers}
                  renderItem={customerListItem}
                  keyExtractor={(c) => c.id}
                  showGradients={true}
                  enableArrowNavigation={false}
                  displayScrollbar={false}
                />
              </div>
            )}
          </div>
        </BorderGlow>
      </div>

      <GSTCalcModal />
    </div>
  )
}
