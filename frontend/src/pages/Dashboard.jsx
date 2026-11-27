import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { FileText, UserPlus, Plus, Calculator, CreditCard, ChevronLeft, ChevronRight, RefreshCw, Package } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import GSTCalcModal from '../components/GSTCalcModal'
import { formatCurrency, formatDate } from '../utils'

const pad = (n) => String(n).padStart(2, '0')
const currentMonthStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
const shiftMonth = (m, delta) => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 1 + delta, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` }
const fyOf = (d = new Date()) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1)
const compact = (n) => {
  const v = Math.abs(n || 0), s = n < 0 ? '−' : ''
  if (v >= 1e7) return `${s}₹${(v / 1e7).toFixed(2)} Cr`
  if (v >= 1e5) return `${s}₹${(v / 1e5).toFixed(2)} L`
  if (v >= 1e3) return `${s}₹${(v / 1e3).toFixed(1)}K`
  return `${s}₹${Math.round(v)}`
}

function Widget({ title, sub, action, className = '', children }) {
  return (
    <section className={`db-widget ${className}`}>
      {(title || action) && (
        <div className="db-widget-head">
          <div><div className="db-widget-title">{title}</div>{sub && <div className="db-widget-sub">{sub}</div>}</div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function Kpi({ label, value, color, foot, delta }) {
  return (
    <section className="db-widget db-kpi db-span-3">
      <div className="db-kpi-label"><span className="db-kpi-dot" style={{ background: color }} />{label}</div>
      <div className="db-kpi-value" title={formatCurrency(value)}>{typeof value === 'number' && label !== 'Customers' ? compact(value) : value}</div>
      <div className="db-kpi-foot">
        {delta != null && <span className={`db-delta ${delta >= 0 ? 'up' : 'down'}`}>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%</span>}
        <span>{foot}</span>
      </div>
    </section>
  )
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="db-widget" style={{ padding: '10px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 800, color: 'var(--text-bright)', marginBottom: 4 }}>{label}</div>
      {payload.map(p => <div key={p.dataKey} style={{ color: 'var(--text-secondary)' }}><span style={{ color: p.stroke, fontWeight: 800 }}>●</span> {p.name}: <b style={{ color: 'var(--text-bright)' }}>{formatCurrency(p.value)}</b></div>)}
    </div>
  )
}

const Skel = ({ h, span = 12 }) => <div className={`db-span-${span} db-skel`} style={{ height: h }} />

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [gstQ, setGstQ] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [period, setPeriod] = useState('month')
  const [month, setMonth] = useState(currentMonthStr())

  const load = async () => {
    if (data) setRefreshing(true)
    try {
      const params = period === 'all' ? { period: 'all' } : { period: 'month', month }
      const res = await api.get('/dashboard/stats', { params })
      setData(res.data || {})
    } catch (e) { console.error('Dashboard error:', e) }
    finally { setLoading(false); setRefreshing(false) }
  }
  useEffect(() => { load() }, [period, month])
  useEffect(() => { api.get('/gst/quarterly', { params: { year: fyOf() } }).then(r => setGstQ(r.data)).catch(() => setGstQ(null)) }, [])

  const s = data?.stats || {}
  const chart = data?.chartData || []
  const recent = data?.recentInvoices || []
  const top = data?.topCustomers || []
  const lowStock = data?.lowStockItems || []
  const periodLabel = period === 'all' ? 'All time' : (data?.periodLabel || 'This month')
  const gstNet = (s.netPayable?.cgst || 0) + (s.netPayable?.sgst || 0) + (s.netPayable?.igst || 0)
  const topMax = Math.max(1, ...top.map(c => Number(c.totalBusiness) || 0))
  const nowQ = useMemo(() => { const m = new Date().getMonth(); return m >= 3 ? Math.floor((m - 3) / 3) + 1 : 4 }, [])

  const aging = [
    { label: 'Current', amt: Math.max(0, (s.pendingAmount || 0) - (s.overdue30?.amount || 0)), color: 'var(--info)' },
    { label: '30–60 days', amt: Math.max(0, (s.overdue30?.amount || 0) - (s.overdue60?.amount || 0)), color: 'var(--warn)' },
    { label: '60–90 days', amt: Math.max(0, (s.overdue60?.amount || 0) - (s.overdue90?.amount || 0)), color: 'var(--neg)' },
    { label: '90+ days', amt: s.overdue90?.amount || 0, color: '#7f1d1d' },
  ]
  const agingTotal = aging.reduce((a, b) => a + b.amt, 0)

  const actions = [
    { label: 'New invoice', to: '/app/invoices/new', icon: FileText, primary: true },
    { label: 'Record purchase', to: '/app/purchases/new', icon: CreditCard },
    { label: 'New quotation', to: '/app/quotations/new', icon: Plus },
    { label: 'Add customer', to: '/app/customers/new', icon: UserPlus },
    { label: 'GST reports', to: '/app/gst', icon: Calculator },
  ]

  return (
    <div className="space-y-5">
      <GSTCalcModal />
      <div className="db-hero">
        <div>
          <div className="db-widget-sub">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          <h1>Overview</h1>
        </div>
        <div className="db-period" role="group" aria-label="Period">
          {period === 'month' && <button className="db-icon-btn" onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>}
          <button className={period === 'month' ? 'on' : ''} onClick={() => setPeriod('month')}>{period === 'month' ? (data?.periodLabel || 'This month') : 'Month'}</button>
          {period === 'month' && <button className="db-icon-btn" disabled={month >= currentMonthStr()} style={{ opacity: month >= currentMonthStr() ? .35 : 1 }} onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Next month"><ChevronRight size={16} /></button>}
          <button className={period === 'all' ? 'on' : ''} onClick={() => setPeriod('all')}>All time</button>
          <button className="db-icon-btn" onClick={load} aria-label="Refresh"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      <div className="db-actions">
        {actions.map(a => <Link key={a.label} to={a.to} className={`db-action ${a.primary ? 'primary' : ''}`}><a.icon size={15} />{a.label}</Link>)}
      </div>

      {loading ? (
        <div className="db-grid"><Skel h={120} span={3} /><Skel h={120} span={3} /><Skel h={120} span={3} /><Skel h={120} span={3} /><Skel h={320} span={8} /><Skel h={320} span={4} /></div>
      ) : (
        <div className="db-grid">
          <Kpi label="Revenue" value={s.totalRevenue || 0} color="var(--pos)" foot={data?.momGrowth != null ? `vs ${data.momCompareLabel}` : periodLabel} delta={period === 'month' ? data?.momGrowth : null} />
          <Kpi label="Receivable" value={s.pendingAmount || 0} color="var(--warn)" foot={`${s.pendingInvoices || 0} unpaid invoices`} />
          <Kpi label="Net profit" value={s.netProfit || 0} color="var(--accent)" foot={`Expenses ${compact(s.totalExpenses || 0)}`} />
          <Kpi label="GST payable" value={gstNet} color="var(--neg)" foot={`${periodLabel} · output − input`} />

          <Widget className="db-span-8" title="Cash flow" sub="Revenue vs expenses">
            {chart.some(d => d.revenue || d.expenses) ? (
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity={0.28} /><stop offset="1" stopColor="var(--accent)" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={compact} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={64} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--accent)" strokeWidth={2.5} fill="url(#gRev)" />
                    <Area type="monotone" dataKey="expenses" name="Expenses" stroke="var(--text-muted)" strokeWidth={2} strokeDasharray="5 4" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : <div className="db-empty">No sales or expenses in this period yet.</div>}
          </Widget>

          <Widget className="db-span-4" title={`GST · FY ${gstQ?.fy || ''}`} sub="Quarterly return (QRMP)" action={<Link to="/app/gst" className="db-link">Details</Link>}>
            {gstQ?.quarters?.length ? (
              <>
                <div className="db-qtrs">
                  {gstQ.quarters.map(q => (
                    <div key={q.quarter} className={`db-qtr ${q.quarter === nowQ ? 'now' : ''}`}>
                      <div className="db-qtr-label">{q.label}</div>
                      <div className="db-qtr-val">{compact(q.payable?.total || 0)}</div>
                      <div className="db-qtr-due">{q.due?.gstr3b ? `Due ${formatDate(q.due.gstr3b)}` : ''}</div>
                    </div>
                  ))}
                </div>
                <div className="db-legend">
                  <div className="db-legend-item">Output GST<b>{compact(gstQ.totals?.outputGST)}</b></div>
                  <div className="db-legend-item">Input credit<b>{compact(gstQ.totals?.inputGST)}</b></div>
                  <div className="db-legend-item">Payable<b>{compact(gstQ.totals?.payable)}</b></div>
                </div>
              </>
            ) : <div className="db-empty">Quarterly GST will appear once invoices are added.</div>}
          </Widget>

          <Widget className="db-span-6" title="Receivables ageing" sub={`${compact(s.pendingAmount || 0)} outstanding`} action={<Link to="/app/invoices" className="db-link">Collect</Link>}>
            {agingTotal > 0 ? (
              <>
                <div className="db-aging">{aging.filter(a => a.amt > 0).map(a => <span key={a.label} style={{ width: `${(a.amt / agingTotal) * 100}%`, background: a.color }} />)}</div>
                <div className="db-legend">{aging.map(a => <div key={a.label} className="db-legend-item"><span className="db-kpi-dot" style={{ background: a.color, display: 'inline-block', marginRight: 6 }} />{a.label}<b>{compact(a.amt)}</b></div>)}</div>
              </>
            ) : <div className="db-empty">Nothing outstanding. 🎉</div>}
          </Widget>

          <Widget className="db-span-6" title="Top customers" sub={periodLabel} action={<Link to="/app/customers" className="db-link">All</Link>}>
            {top.length ? top.slice(0, 5).map(c => (
              <Link key={c.id} to={`/app/customers/${c.id}`} className="db-row" style={{ display: 'block' }}>
                <div className="flex justify-between gap-3"><span className="db-row-title">{c.name}</span><span className="db-amt">{compact(c.totalBusiness)}</span></div>
                <div className="db-bar" style={{ marginTop: 6 }}><span style={{ width: `${(Number(c.totalBusiness) / topMax) * 100}%`, background: 'var(--accent)' }} /></div>
              </Link>
            )) : <div className="db-empty">No customer sales yet.</div>}
          </Widget>

          <Widget className="db-span-8" title="Recent invoices" action={<Link to="/app/invoices" className="db-link">View all</Link>}>
            {recent.length ? recent.slice(0, 6).map(inv => (
              <Link key={inv.id} to={`/app/invoices/${inv.id}`} className="db-row">
                <div className="db-row-main"><div className="db-row-title">{inv.customer_name || 'Walk-in'}</div><div className="db-row-sub">{inv.invoice_number} · {formatDate(inv.invoice_date)}</div></div>
                <div className="flex items-center gap-3"><span className={`status-badge status-${inv.payment_status || 'pending'}`}>{inv.payment_status || 'pending'}</span><span className="db-amt">{formatCurrency(inv.total_amount)}</span></div>
              </Link>
            )) : <div className="db-empty">No invoices yet. <Link to="/app/invoices/new" className="db-link">Create your first</Link></div>}
          </Widget>

          <Widget className="db-span-4" title="Low stock" sub="Below minimum quantity">
            {lowStock.length ? lowStock.slice(0, 6).map(it => (
              <div key={it.id} className="db-row">
                <div className="db-row-main flex items-center gap-2"><Package size={14} style={{ color: 'var(--neg)' }} /><span className="db-row-title">{it.item_name}</span></div>
                <span className="db-amt" style={{ color: 'var(--neg)' }}>{Number(it.quantity)} / {Number(it.min_quantity)} {it.unit || ''}</span>
              </div>
            )) : <div className="db-empty">All items are stocked.</div>}
            <div className="db-legend" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="db-legend-item">Customers<b>{s.customerCount || 0}</b></div>
              <div className="db-legend-item">Quotes<b>{s.quotationCount || 0}</b></div>
              <div className="db-legend-item">Purchases<b>{compact(s.purchaseTotal || 0)}</b></div>
            </div>
          </Widget>
        </div>
      )}
    </div>
  )
}
