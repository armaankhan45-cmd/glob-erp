import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import api from '../api/client'
import { Plus, Users, CreditCard, FileText, Calculator, TrendingUp, IndianRupee, AlertCircle, UserPlus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import GSTCalcModal from '../components/GSTCalcModal'
import { formatCurrency } from '../utils'

const COLORS = ['accent', '#4f8fff', '#a855f7', '#22d3ee', '#8b5cf6', '#06b6d4', '#eab308', '#ec4899']

export default function Dashboard() {
  const { user } = useAuth()
  const { themeKey, themes } = useTheme()
  const accent = themes[themeKey]?.color || '#06b6d4'
  const [stats, setStats] = useState({})
  const [recentInvoices, setRecentInvoices] = useState([])
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
    } catch (err) { console.error('Dashboard error:', err) }
    finally { setLoading(false) }
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const quickActions = [
    { label: 'New Invoice', path: '/app/invoices/new', icon: FileText, color: 'background: linear-gradient(135deg, #4f8fff, #3b82f6)' },
    { label: 'Add Customer', path: '/app/customers', icon: UserPlus, color: 'background: linear-gradient(135deg, #22c55e, #16a34a)' },
    { label: 'Record Payment', path: '/app/invoices', icon: CreditCard, color: 'background: linear-gradient(135deg, #a855f7, #7c3aed)' },
    { label: 'New Quote', path: '/app/quotations/new', icon: Plus, color: 'background: linear-gradient(135deg, accent, accent + '99')' },
    { label: 'GST Reports', path: '/app/gst', icon: Calculator, color: 'background: linear-gradient(135deg, #22d3ee, #06b6d4)' },
  ]

  const metricCards = [
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: IndianRupee, gradient: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))', iconBg: 'rgba(34,197,94,0.15)', iconColor: '#22c55e' },
    { label: 'Pending Invoices', value: stats.pendingInvoices || 0, icon: AlertCircle, gradient: 'linear-gradient(135deg, accent + ','0.15), accent + ','0.05))', iconBg: 'accent + ','0.15)', iconColor: 'accent' },
    { label: 'GST Payable', value: formatCurrency(stats.netPayable?.cgst + stats.netPayable?.sgst + stats.netPayable?.igst || 0), icon: TrendingUp, gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))', iconBg: 'rgba(239,68,68,0.15)', iconColor: '#ef4444' },
    { label: 'Customer Count', value: stats.customerCount || 0, icon: Users, gradient: 'linear-gradient(135deg, rgba(79,143,255,0.15), rgba(79,143,255,0.05))', iconBg: 'rgba(79,143,255,0.15)', iconColor: '#4f8fff' },
  ]

  const chartData = monthlySales.map(m => ({ ...m, revenue: m.total || m.revenue || 0 }))

  const gstPie = [
    { name: 'CGST', value: Math.max(0, stats.netPayable?.cgst || 0) },
    { name: 'SGST', value: Math.max(0, stats.netPayable?.sgst || 0) },
    { name: 'IGST', value: Math.max(0, stats.netPayable?.igst || 0) },
  ].filter(d => d.value > 0)

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'accent', borderTopColor: 'transparent' }}></div></div>

  const fmtTooltip = (val) => formatCurrency(val)
  const chartBg = 'rgba(14,18,36,0.7)'
  const chartBorder = 'rgba(255,255,255,0.08)'

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #ef4d23, #ff6b35, #a855f7)' }}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.2), transparent 50%)'
        }}></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-1">Welcome, {user?.name || 'User'}!</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{user?.organization?.name} • GSTIN: {user?.organization?.gstin || 'N/A'} • {today}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {quickActions.map((a, i) => (
          <Link key={i} to={a.path} className="card text-center group" style={{ animation: `slideUp 0.5s ease-out ${i * 0.05}s both` }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white mx-auto mb-2 group-hover:scale-110 transition-transform"
              style={{ background: a.color }}>
              <a.icon size={22} />
            </div>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{a.label}</p>
          </Link>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((m, i) => (
          <div key={i} className="card" style={{ animation: `slideUp 0.5s ease-out ${i * 0.1}s both` }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{m.label}</span>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: m.iconBg, color: m.iconColor }}>
                <m.icon size={20} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-white">Sales Performance</h3>
            <div className="flex gap-1">
              {[['bar','Bar'],['line','Line'],['area','Area']].map(([val, label]) => (
                <button key={val} onClick={() => setChartType(val)}
                  className="px-2 py-1 text-xs rounded font-medium transition-all"
                  style={chartType === val 
                    ? { background: 'accent', color: '#fff' }
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
                  <Bar dataKey="revenue" fill="#ef4d23" radius={[4,4,0,0]} name="Revenue" />
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
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="#a855f7" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* GST Summary */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-white mb-4">GST Summary</h3>
            <div className="space-y-3">
              <div className="rounded-xl p-4" style={{ background: 'rgba(79,143,255,0.08)', border: '1px solid rgba(79,143,255,0.12)' }}>
                <p className="text-sm font-medium" style={{ color: '#4f8fff' }}>Output GST</p>
                <p className="text-xl font-bold" style={{ color: '#93bbff' }}>{formatCurrency(stats.outputGST?.total || 0)}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'accent + ','0.08)', border: '1px solid accent + ','0.12)' }}>
                <p className="text-sm font-medium" style={{ color: 'accent' }}>Input GST</p>
                <p className="text-xl font-bold" style={{ color: '#ff8c5a' }}>{formatCurrency(stats.inputGST?.total || 0)}</p>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)' }}>
                <p className="text-sm font-medium" style={{ color: '#ef4444' }}>Net Payable</p>
                <p className="text-xl font-bold" style={{ color: '#f87171' }}>
                  {formatCurrency((stats.netPayable?.cgst || 0) + (stats.netPayable?.sgst || 0) + (stats.netPayable?.igst || 0))}
                </p>
              </div>
            </div>
          </div>
          {gstPie.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-white mb-2">GST Split</h3>
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gstPie} cx="50%" cy="50%" outerRadius={50} innerRadius={25} dataKey="value">
                      {gstPie.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={fmtTooltip} contentStyle={{ background: '#0c1020', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-3 mt-1">
                {gstPie.map((d, i) => <span key={i} className="text-xs flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i], display: 'inline-block' }}></span>{d.name}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Recent Invoices</h3>
          <Link to="/app/invoices" className="text-sm font-medium" style={{ color: 'accent' }}>View All</Link>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-center py-8" style={{ color: 'rgba(255,255,255,0.25)' }}>No invoices yet. Create your first invoice!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="nebula-table">
              <thead><tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Date</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Status</th>
              </tr></thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td><Link to={`/app/invoices/${inv.id}`} style={{ color: 'accent' }}>{inv.invoice_number}</Link></td>
                    <td>{inv.customer_name || 'N/A'}</td>
                    <td style={{ color: 'rgba(255,255,255,0.35)' }}>{inv.invoice_date}</td>
                    <td className="text-right font-medium text-white">{formatCurrency(inv.total_amount)}</td>
                    <td className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={inv.payment_status === 'Paid' 
                          ? { background: 'rgba(34,197,94,0.1)', color: '#22c55e' }
                          : inv.payment_status === 'Partial'
                          ? { background: 'rgba(234,179,8,0.1)', color: '#eab308' }
                          : { background: 'rgba(239,68,68,0.1)', color: '#ef4444' }
                        }>
                        {inv.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GSTCalcModal />
    </div>
  )
}
