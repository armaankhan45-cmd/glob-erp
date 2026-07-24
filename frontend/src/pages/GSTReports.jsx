import React, { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { formatCurrency, formatDate } from '../utils'
import { ChevronDown, ChevronRight, FileText, ShoppingCart, ArrowRight, RefreshCw } from 'lucide-react'

const COLORS = ['#3b82f6', '#f97316', '#ef4444', '#22c55e', '#8b5cf6', '#06b6d4']
const MONTH_FULL = { Apr:'April', May:'May', Jun:'June', Jul:'July', Aug:'August', Sep:'September', Oct:'October', Nov:'November', Dec:'December', Jan:'January', Feb:'February', Mar:'March' }

const darkTooltip = { background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }

export default function GSTReports() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState({ gstr1: [], gstr2: [], gstr3b: {}, monthlyPayable: [], salesTotal: 0, purchaseTotal: 0 })
  const [chartType, setChartType] = useState('bar')
  const [loading, setLoading] = useState(true)
  const [expandedMonth, setExpandedMonth] = useState(null)
  const [monthlyBills, setMonthlyBills] = useState({ invoices: [], purchases: [] })
  const [billsLoading, setBillsLoading] = useState(false)

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const res = await api.get('/gst/summary', { params: { year } })
      setData(res.data)
      const now = new Date()
      const m = now.getMonth()
      const fyMonths = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
      const currentFyMonth = fyMonths[m < 3 ? m + 9 : m - 3]
      const hasBills = (res.data.monthlyPayable || []).find(mp => mp.month === currentFyMonth)
      if (hasBills && (hasBills.invoiceCount > 0 || hasBills.billCount > 0)) {
        handleExpandMonth(currentFyMonth, hasBills.monthKey)
      }
    } catch (err) { console.error('GST reports error:', err) }
    finally { setLoading(false) }
  }, [year])

  useEffect(() => { loadData() }, [year])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => loadData(false), 30000)
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadData(false) }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', handleVisibility) }
  }, [loadData])

  const handleExpandMonth = async (monthName, monthKey) => {
    if (expandedMonth === monthName) { setExpandedMonth(null); return }
    setExpandedMonth(monthName); setBillsLoading(true)
    try {
      const res = await api.get('/gst/monthly-bills', { params: { month: monthKey } })
      setMonthlyBills({ invoices: res.data.invoices || [], purchases: res.data.purchases || [] })
    } catch { setMonthlyBills({ invoices: [], purchases: [] }) }
    finally { setBillsLoading(false) }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const g3b = data.gstr3b || {}
  const monthlyPayable = data.monthlyPayable || []
  const activeMonths = monthlyPayable.filter(m => m.sales > 0 || m.purchases > 0)

  const barData = activeMonths.map(m => ({ month: m.month, 'Output GST': m.outputGST, 'Input GST': m.inputGST, 'Carry Forward': m.carryForward, 'Net Payable': m.payable }))
  const lineData = activeMonths.map(m => ({ month: m.month, 'Sales': m.sales, 'Purchases': m.purchases }))
  const areaData = activeMonths.map(m => ({ month: m.month, 'Output GST': m.outputGST, 'Input GST': m.inputGST, 'Balance Carry Forward': m.balance }))
  const pieData = [
    { name: 'CGST Payable', value: parseFloat(g3b.netCGST) || 0 },
    { name: 'SGST Payable', value: parseFloat(g3b.netSGST) || 0 },
    { name: 'IGST Payable', value: parseFloat(g3b.netIGST) || 0 },
    { name: 'Carry Forward Credit', value: parseFloat(g3b.finalCarryForward) || 0 },
  ].filter(d => d.value > 0)

  const fmtTooltip = (val) => formatCurrency(val)
  const totalActualPayable = monthlyPayable.reduce((s, m) => s + m.payable, 0)

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">GST Reports</h1>
          <p className="text-white/40 text-sm">Monthly GST with carry-forward balance & bill details</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadData(true)} className="btn-secondary flex items-center gap-2 text-sm"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input-field w-auto">
            {years.map(y => <option key={y} value={y}>FY {y}-{String(y+1).slice(2)}</option>)}
          </select>
        </div>
      </div>

      {/* Summary Cards - Dark themed */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger">
        <div className="gst-card" style={{ background: 'rgba(59,130,246,0.06)', borderLeft: '3px solid #3b82f6' }}>
          <p className="text-xs text-blue-400 font-medium">Total Sales</p>
          <p className="text-lg font-bold text-blue-300">{formatCurrency(data.salesTotal || 0)}</p>
          <p className="text-xs text-white/30 mt-1">Output GST: {formatCurrency(g3b.outputTotal || 0)}</p>
        </div>
        <div className="gst-card" style={{ background: 'rgba(249,115,22,0.06)', borderLeft: '3px solid #f97316' }}>
          <p className="text-xs text-orange-400 font-medium">Total Purchases</p>
          <p className="text-lg font-bold text-orange-300">{formatCurrency(data.purchaseTotal || 0)}</p>
          <p className="text-xs text-white/30 mt-1">Input GST: {formatCurrency(g3b.inputTotal || 0)}</p>
        </div>
        <div className="gst-card" style={{ background: 'rgba(239,68,68,0.06)', borderLeft: '3px solid #ef4444' }}>
          <p className="text-xs text-red-400 font-medium">Total GST Payable</p>
          <p className="text-lg font-bold text-red-300">{formatCurrency(totalActualPayable)}</p>
          <p className="text-xs text-white/30 mt-1">After carry-forward</p>
        </div>
        <div className="gst-card" style={{ background: 'rgba(34,197,94,0.06)', borderLeft: '3px solid #22c55e' }}>
          <p className="text-xs text-green-400 font-medium">Carry Forward Credit</p>
          <p className="text-lg font-bold text-green-300">{formatCurrency(g3b.finalCarryForward || 0)}</p>
          <p className="text-xs text-white/30 mt-1">Goes to next FY</p>
        </div>
        <div className="gst-card" style={{ background: 'rgba(139,92,246,0.06)', borderLeft: '3px solid #8b5cf6' }}>
          <p className="text-xs text-purple-400 font-medium">Net Position</p>
          <p className={`text-lg font-bold ${g3b.outputTotal > g3b.inputTotal ? 'text-red-300' : 'text-green-300'}`}>
            {g3b.outputTotal > g3b.inputTotal ? 'PAY' : 'CREDIT'}
          </p>
          <p className="text-xs text-white/30 mt-1">{formatCurrency(Math.abs(g3b.outputTotal - g3b.inputTotal))}</p>
        </div>
      </div>

      {/* GSTR-3B Breakdown - Dark themed */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-bold text-blue-400 mb-3">Output GST (GSTR-1)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-white/60">CGST</span><span className="font-medium text-white">{formatCurrency(g3b.outputCGST)}</span></div>
            <div className="flex justify-between"><span className="text-white/60">SGST</span><span className="font-medium text-white">{formatCurrency(g3b.outputSGST)}</span></div>
            <div className="flex justify-between"><span className="text-white/60">IGST</span><span className="font-medium text-white">{formatCurrency(g3b.outputIGST)}</span></div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="pt-2" />
            <div className="flex justify-between font-bold"><span className="text-white">Total Output</span><span className="text-white">{formatCurrency(g3b.outputTotal)}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-bold text-orange-400 mb-3">Input GST (GSTR-2)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-white/60">CGST</span><span className="font-medium text-white">{formatCurrency(g3b.inputCGST)}</span></div>
            <div className="flex justify-between"><span className="text-white/60">SGST</span><span className="font-medium text-white">{formatCurrency(g3b.inputSGST)}</span></div>
            <div className="flex justify-between"><span className="text-white/60">IGST</span><span className="font-medium text-white">{formatCurrency(g3b.inputIGST)}</span></div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="pt-2" />
            <div className="flex justify-between font-bold"><span className="text-white">Total Input</span><span className="text-white">{formatCurrency(g3b.inputTotal)}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-bold text-red-400 mb-3">Net GST Position</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-white/60">CGST Net</span><span className="font-bold text-white">{formatCurrency(g3b.netCGST)}</span></div>
            <div className="flex justify-between"><span className="text-white/60">SGST Net</span><span className="font-bold text-white">{formatCurrency(g3b.netSGST)}</span></div>
            <div className="flex justify-between"><span className="text-white/60">IGST Net</span><span className="font-bold text-white">{formatCurrency(g3b.netIGST)}</span></div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} className="pt-2" />
            <div className="flex justify-between font-bold text-base">
              <span className="text-white">{g3b.outputTotal > g3b.inputTotal ? 'You Pay' : 'Your Credit'}</span>
              <span className={g3b.outputTotal > g3b.inputTotal ? 'text-red-400' : 'text-green-400'}>{formatCurrency(Math.abs(g3b.outputTotal - g3b.inputTotal))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Type Selector */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white">Monthly GST Comparison</h3>
          <div className="flex gap-1">
            {[['bar','Bar'],['line','Line'],['area','Area'],['pie','Pie']].map(([val, label]) => (
              <button key={val} onClick={() => setChartType(val)} className={`chip ${chartType === val ? 'active' : ''}`}>{label}</button>
            ))}
          </div>
        </div>
        <div className="h-80">
          {chartType === 'bar' && barData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} />
                <Tooltip formatter={fmtTooltip} contentStyle={darkTooltip} />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.6)' }} />
                <Bar dataKey="Output GST" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="Input GST" fill="#f97316" radius={[4,4,0,0]} />
                <Bar dataKey="Carry Forward" fill="#8b5cf6" radius={[4,4,0,0]} />
                <Bar dataKey="Net Payable" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {chartType === 'line' && lineData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} />
                <Tooltip formatter={fmtTooltip} contentStyle={darkTooltip} />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.6)' }} />
                <Line type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Purchases" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {chartType === 'area' && areaData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.35)' }} />
                <Tooltip formatter={fmtTooltip} contentStyle={darkTooltip} />
                <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.6)' }} />
                <Area type="monotone" dataKey="Output GST" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                <Area type="monotone" dataKey="Input GST" stroke="#f97316" fill="#f97316" fillOpacity={0.15} />
                <Area type="monotone" dataKey="Balance Carry Forward" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {chartType === 'pie' && pieData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} dataKey="value">
                  {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={fmtTooltip} contentStyle={darkTooltip} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {activeMonths.length === 0 && (
            <div className="flex items-center justify-center h-full text-white/30">No data for this financial year</div>
          )}
        </div>
      </div>

      {/* Monthly GST Payable Table */}
      <div className="card">
        <h3 className="font-bold text-white mb-1">Monthly GST with Carry-Forward Balance</h3>
        <p className="text-xs text-white/40 mb-4">
          <b className="text-white/60">Carry Forward</b> = excess input credit from previous month. <b className="text-white/60">Balance</b> = credit going to next month. Click a month to see its bills.
        </p>
        <div className="overflow-x-auto">
          <table className="nebula-table">
            <thead>
              <tr>
                <th></th>
                <th>Month</th>
                <th className="text-center">Bills</th>
                <th className="text-right">Sales</th>
                <th className="text-right">Purchases</th>
                <th className="text-right">Output GST</th>
                <th className="text-right">Input GST</th>
                <th className="text-right">Carry Fwd</th>
                <th className="text-right">Payable</th>
                <th className="text-right">Balance →</th>
              </tr>
            </thead>
            <tbody>
              {monthlyPayable.map((m, i) => {
                const isActive = m.sales > 0 || m.purchases > 0
                const isOpen = expandedMonth === m.month
                return (
                  <React.Fragment key={i}>
                    <tr className={`cursor-pointer transition-all duration-200 anim-row ${isActive ? 'hover:bg-white/[0.03]' : 'opacity-50'} ${isOpen ? 'bg-white/[0.03]' : ''}`}
                      style={{ animationDelay: `${i * 0.02}s` }}
                      onClick={() => isActive && handleExpandMonth(m.month, m.monthKey)}>
                      <td className="py-2.5 w-6">
                        {isActive ? (isOpen ? <ChevronDown size={16} className="accent-text" /> : <ChevronRight size={16} className="text-white/30" />) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="py-2.5 font-medium">
                        <span className={m.payable > 0 ? 'text-red-400' : 'text-white'}>{MONTH_FULL[m.month]}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <span className="status-badge status-sent" style={{ padding: '1px 6px', fontSize: '10px' }}>{m.invoiceCount} <FileText size={8} className="inline" /></span>
                            <span className="status-badge status-pending" style={{ padding: '1px 6px', fontSize: '10px' }}>{m.billCount} <ShoppingCart size={8} className="inline" /></span>
                          </span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="py-2.5 text-right text-white/80">{isActive ? formatCurrency(m.sales) : '—'}</td>
                      <td className="py-2.5 text-right text-white/80">{isActive ? formatCurrency(m.purchases) : '—'}</td>
                      <td className="py-2.5 text-right text-blue-400">{isActive ? formatCurrency(m.outputGST) : '—'}</td>
                      <td className="py-2.5 text-right text-orange-400">{isActive ? formatCurrency(m.inputGST) : '—'}</td>
                      <td className="py-2.5 text-right text-purple-400 font-medium">{m.carryForward > 0 ? formatCurrency(m.carryForward) : '—'}</td>
                      <td className="py-2.5 text-right font-bold">
                        {m.payable > 0 ? <span className="text-red-400">{formatCurrency(m.payable)}</span> : <span className="text-white/20">—</span>}
                      </td>
                      <td className="py-2.5 text-right font-medium">
                        {m.balance > 0 ? (
                          <span className="text-green-400 flex items-center justify-end gap-1">{formatCurrency(m.balance)} <ArrowRight size={12} /></span>
                        ) : <span className="text-white/20">—</span>}
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <div className="border-l-4 border-accent px-6 py-4" style={{ background: 'rgba(var(--accent-rgb),0.03)', borderColor: 'var(--accent)' }}>
                            {billsLoading ? (
                              <div className="flex justify-center py-4"><div className="animate-spin h-6 w-6 border-3 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}></div></div>
                            ) : (
                              <>
                                <div className="mb-4">
                                  <h4 className="font-bold text-sm text-blue-400 mb-2 flex items-center gap-2"><FileText size={14} /> Sales Invoices — {MONTH_FULL[m.month]}</h4>
                                  {monthlyBills.invoices.length === 0 ? (
                                    <p className="text-xs text-white/30 italic">No sales invoices in this month</p>
                                  ) : (
                                    <table className="w-full text-xs nebula-table">
                                      <thead><tr><th className="text-left">Invoice #</th><th className="text-left">Customer</th><th className="text-left">Date</th><th className="text-right">Taxable</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th><th className="text-right">Total</th></tr></thead>
                                      <tbody>
                                        {monthlyBills.invoices.map(inv => (
                                          <tr key={inv.id} className="anim-row"><td className="font-medium text-blue-400">{inv.invoice_number}</td><td className="text-white/70">{inv.customer_name}</td><td className="text-white/40">{formatDate(inv.invoice_date)}</td><td className="text-right text-white/70">{formatCurrency(inv.subtotal)}</td><td className="text-right text-white/70">{formatCurrency(inv.cgst_amount)}</td><td className="text-right text-white/70">{formatCurrency(inv.sgst_amount)}</td><td className="text-right text-white/70">{formatCurrency(inv.igst_amount)}</td><td className="text-right font-bold text-white">{formatCurrency(inv.total_amount)}</td></tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-orange-400 mb-2 flex items-center gap-2"><ShoppingCart size={14} /> Purchase Bills — {MONTH_FULL[m.month]}</h4>
                                  {monthlyBills.purchases.length === 0 ? (
                                    <p className="text-xs text-white/30 italic">No purchase bills in this month</p>
                                  ) : (
                                    <table className="w-full text-xs nebula-table">
                                      <thead><tr><th className="text-left">Bill #</th><th className="text-left">Supplier</th><th className="text-left">Date</th><th className="text-right">Taxable</th><th className="text-right">CGST</th><th className="text-right">SGST</th><th className="text-right">IGST</th><th className="text-right">Total</th></tr></thead>
                                      <tbody>
                                        {monthlyBills.purchases.map(pur => (
                                          <tr key={pur.id} className="anim-row"><td className="font-medium text-orange-400">{pur.bill_number}</td><td className="text-white/70">{pur.supplier_name}</td><td className="text-white/40">{formatDate(pur.bill_date)}</td><td className="text-right text-white/70">{formatCurrency(pur.subtotal)}</td><td className="text-right text-white/70">{formatCurrency(pur.cgst_amount)}</td><td className="text-right text-white/70">{formatCurrency(pur.sgst_amount)}</td><td className="text-right text-white/70">{formatCurrency(pur.igst_amount)}</td><td className="text-right font-bold text-white">{formatCurrency(pur.total_amount)}</td></tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                                <div className="mt-3 pt-3 flex items-center gap-6 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                  <span className="text-blue-400 font-bold">Output GST: {formatCurrency(m.outputGST)}</span>
                                  <span className="text-orange-400 font-bold">Input GST: {formatCurrency(m.inputGST)}</span>
                                  {m.carryForward > 0 && <span className="text-purple-400 font-bold">Carry Fwd: {formatCurrency(m.carryForward)}</span>}
                                  {m.payable > 0 && <span className="text-red-400 font-bold">PAY: {formatCurrency(m.payable)}</span>}
                                  {m.balance > 0 && <span className="text-green-400 font-bold">Credit →: {formatCurrency(m.balance)}</span>}
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
              <tr className="font-bold" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <td className="py-3"></td>
                <td className="py-3 text-white">FY TOTAL</td>
                <td className="py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-xs">
                    <span className="status-badge status-sent" style={{ padding: '1px 6px', fontSize: '10px' }}>{monthlyPayable.reduce((s,m) => s+m.invoiceCount, 0)}</span>
                    <span className="status-badge status-pending" style={{ padding: '1px 6px', fontSize: '10px' }}>{monthlyPayable.reduce((s,m) => s+m.billCount, 0)}</span>
                  </span>
                </td>
                <td className="py-3 text-right text-white">{formatCurrency(data.salesTotal)}</td>
                <td className="py-3 text-right text-white">{formatCurrency(data.purchaseTotal)}</td>
                <td className="py-3 text-right text-blue-400">{formatCurrency(g3b.outputTotal)}</td>
                <td className="py-3 text-right text-orange-400">{formatCurrency(g3b.inputTotal)}</td>
                <td className="py-3 text-right text-purple-400">—</td>
                <td className="py-3 text-right text-red-400">{formatCurrency(totalActualPayable)}</td>
                <td className="py-3 text-right text-green-400">
                  {g3b.finalCarryForward > 0 ? (
                    <span className="flex items-center justify-end gap-1">{formatCurrency(g3b.finalCarryForward)} <ArrowRight size={12} /></span>
                  ) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', color: '#fbbf24' }}>
          <p className="font-bold mb-1 text-yellow-400">How Carry-Forward Works:</p>
          <ol className="list-decimal ml-4 space-y-0.5 text-yellow-300/80">
            <li><b>Output GST</b> = Total GST collected on sales invoices for the month</li>
            <li><b>Input GST</b> = Total GST paid on purchase bills for the month</li>
            <li><b>Carry Forward</b> = Excess input credit brought from previous month</li>
            <li><b>Payable</b> = Output GST − Input GST − Carry Forward (if positive, you pay this)</li>
            <li><b>Balance →</b> = If negative after carry forward, this credit goes to next month</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
