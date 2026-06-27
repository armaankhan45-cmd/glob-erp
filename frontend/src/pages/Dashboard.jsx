import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { motion } from 'framer-motion'
import { Plus, Users, CreditCard, FileText, Calculator, TrendingUp, IndianRupee, AlertCircle, UserPlus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import GSTCalcModal from '../components/GSTCalcModal'
import { formatCurrency } from '../utils'

const COLORS = ['#3b82f6', '#f97316', '#ef4444', '#22c55e', '#8b5cf6', '#06b6d4', '#eab308', '#ec4899']

export default function Dashboard() {
  const { user } = useAuth()
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
    { label: 'New Invoice', path: '/app/invoices/new', icon: FileText, color: 'bg-blue-500' },
    { label: 'Add Customer', path: '/app/customers', icon: UserPlus, color: 'bg-green-500' },
    { label: 'Record Payment', path: '/app/invoices', icon: CreditCard, color: 'bg-purple-500' },
    { label: 'New Quote', path: '/app/quotations/new', icon: Plus, color: 'bg-orange-500' },
    { label: 'GST Reports', path: '/app/gst', icon: Calculator, color: 'bg-red-500' },
  ]

  const metricCards = [
    { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: IndianRupee, color: 'text-green-600 bg-green-50' },
    { label: 'Pending Invoices', value: stats.pendingInvoices || 0, icon: AlertCircle, color: 'text-orange-600 bg-orange-50' },
    { label: 'GST Payable', value: formatCurrency(stats.netPayable?.cgst + stats.netPayable?.sgst + stats.netPayable?.igst || 0), icon: TrendingUp, color: 'text-red-600 bg-red-50' },
    { label: 'Customer Count', value: stats.customerCount || 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
  ]

  // Prepare chart data
  const chartData = monthlySales.map(m => ({ ...m, revenue: m.total || m.revenue || 0 }))

  // Pie data for GST split
  const gstPie = [
    { name: 'CGST', value: Math.max(0, stats.netPayable?.cgst || 0) },
    { name: 'SGST', value: Math.max(0, stats.netPayable?.sgst || 0) },
    { name: 'IGST', value: Math.max(0, stats.netPayable?.igst || 0) },
  ].filter(d => d.value > 0)

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  const fmtTooltip = (val) => formatCurrency(val)

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Welcome, {user?.name || 'User'}!</h1>
        <p className="text-primary-100">{user?.organization?.name} • GSTIN: {user?.organization?.gstin || 'N/A'} • {today}</p>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {quickActions.map((a, i) => (
          <Link key={i} to={a.path} className="card hover:shadow-md transition-shadow text-center group">
            <div className={`w-12 h-12 ${a.color} rounded-xl flex items-center justify-center text-white mx-auto mb-2 group-hover:scale-110 transition-transform`}>
              <a.icon size={22} />
            </div>
            <p className="text-sm font-medium text-gray-700">{a.label}</p>
          </Link>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metricCards.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{m.label}</span>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.color}`}><m.icon size={20} /></div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{m.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Sales Performance (FY {new Date().getFullYear()})</h3>
            <div className="flex gap-1">
              {[['bar','Bar'],['line','Line'],['area','Area']].map(([val, label]) => (
                <button key={val} onClick={() => setChartType(val)} className={`px-2 py-1 text-xs rounded font-medium ${chartType === val ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="h-64">
            {chartType === 'bar' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={fmtTooltip} />
                  <Bar dataKey="revenue" fill="#3b82f6" radius={[4,4,0,0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartType === 'line' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={fmtTooltip} />
                  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
            {chartType === 'area' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={fmtTooltip} />
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* GST Summary */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-gray-800 mb-4">GST Summary</h3>
            <div className="space-y-3">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-sm text-blue-600 font-medium">Output GST</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(stats.outputGST?.total || 0)}</p>
              </div>
              <div className="bg-orange-50 rounded-xl p-4">
                <p className="text-sm text-orange-600 font-medium">Input GST</p>
                <p className="text-xl font-bold text-orange-700">{formatCurrency(stats.inputGST?.total || 0)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-sm text-red-600 font-medium">Net Payable</p>
                <p className="text-xl font-bold text-red-700">
                  {formatCurrency((stats.netPayable?.cgst || 0) + (stats.netPayable?.sgst || 0) + (stats.netPayable?.igst || 0))}
                </p>
              </div>
            </div>
          </div>
          {gstPie.length > 0 && (
            <div className="card">
              <h3 className="font-bold text-gray-800 mb-2">GST Split</h3>
              <div style={{ height: 120 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={gstPie} cx="50%" cy="50%" outerRadius={50} innerRadius={25} dataKey="value">
                      {gstPie.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={fmtTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-3 mt-1">
                {gstPie.map((d, i) => <span key={i} className="text-xs flex items-center gap-1"><span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i], display: 'inline-block' }}></span>{d.name}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800">Recent Invoices</h3>
          <Link to="/app/invoices" className="text-primary-600 text-sm font-medium hover:underline">View All</Link>
        </div>
        {recentInvoices.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No invoices yet. Create your first invoice!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Invoice #</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium text-right">Status</th>
              </tr></thead>
              <tbody>
                {recentInvoices.map(inv => (
                  <tr key={inv.id} className="border-b border-gray-50">
                    <td className="py-2"><Link to={`/app/invoices/${inv.id}`} className="text-primary-600 hover:underline">{inv.invoice_number}</Link></td>
                    <td className="py-2">{inv.customer_name || 'N/A'}</td>
                    <td className="py-2 text-gray-500">{inv.invoice_date}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(inv.total_amount)}</td>
                    <td className="py-2 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${inv.payment_status === 'Paid' ? 'bg-green-100 text-green-700' : inv.payment_status === 'Partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
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
