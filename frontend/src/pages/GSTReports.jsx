import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { formatCurrency, formatDate } from '../utils'
import { ChevronDown, ChevronRight, FileText, ShoppingCart, ArrowRight } from 'lucide-react'

const COLORS = ['#3b82f6', '#f97316', '#ef4444', '#22c55e', '#8b5cf6', '#06b6d4']
const MONTH_FULL = { Apr:'April', May:'May', Jun:'June', Jul:'July', Aug:'August', Sep:'September', Oct:'October', Nov:'November', Dec:'December', Jan:'January', Feb:'February', Mar:'March' }

export default function GSTReports() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState({ gstr1: [], gstr2: [], gstr3b: {}, monthlyPayable: [], salesTotal: 0, purchaseTotal: 0 })
  const [chartType, setChartType] = useState('bar')
  const [loading, setLoading] = useState(true)
  const [expandedMonth, setExpandedMonth] = useState(null)
  const [monthlyBills, setMonthlyBills] = useState({ invoices: [], purchases: [] })
  const [billsLoading, setBillsLoading] = useState(false)

  useEffect(() => { loadData() }, [year])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/gst/summary', { params: { year } })
      setData(res.data)
      // Auto-expand current month
      const now = new Date()
      const m = now.getMonth()
      const fyMonths = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
      const currentFyMonth = fyMonths[m < 3 ? m + 9 : m - 3]
      const hasBills = (res.data.monthlyPayable || []).find(mp => mp.month === currentFyMonth)
      if (hasBills && (hasBills.invoiceCount > 0 || hasBills.billCount > 0)) {
        handleExpandMonth(currentFyMonth, hasBills.monthKey)
      }
    }
    catch (err) { console.error('GST reports error:', err) }
    finally { setLoading(false) }
  }

  const handleExpandMonth = async (monthName, monthKey) => {
    if (expandedMonth === monthName) {
      setExpandedMonth(null)
      return
    }
    setExpandedMonth(monthName)
    setBillsLoading(true)
    try {
      const res = await api.get('/gst/monthly-bills', { params: { month: monthKey } })
      setMonthlyBills({ invoices: res.data.invoices || [], purchases: res.data.purchases || [] })
    } catch {
      setMonthlyBills({ invoices: [], purchases: [] })
    } finally {
      setBillsLoading(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const g3b = data.gstr3b || {}
  const monthlyPayable = data.monthlyPayable || []

  // Chart data — only months that have data
  const activeMonths = monthlyPayable.filter(m => m.sales > 0 || m.purchases > 0)

  const barData = activeMonths.map(m => ({
    month: m.month,
    'Output GST': m.outputGST,
    'Input GST': m.inputGST,
    'Carry Forward': m.carryForward,
    'Net Payable': m.payable,
  }))

  const lineData = activeMonths.map(m => ({
    month: m.month,
    'Sales': m.sales,
    'Purchases': m.purchases,
  }))

  const areaData = activeMonths.map(m => ({
    month: m.month,
    'Output GST': m.outputGST,
    'Input GST': m.inputGST,
    'Balance Carry Forward': m.balance,
  }))

  const pieData = [
    { name: 'CGST Payable', value: parseFloat(g3b.netCGST) || 0 },
    { name: 'SGST Payable', value: parseFloat(g3b.netSGST) || 0 },
    { name: 'IGST Payable', value: parseFloat(g3b.netIGST) || 0 },
    { name: 'Carry Forward Credit', value: parseFloat(g3b.finalCarryForward) || 0 },
  ].filter(d => d.value > 0)

  const fmtTooltip = (val) => formatCurrency(val)

  // Total payable across all months (with carry-forward already factored)
  const totalActualPayable = monthlyPayable.reduce((s, m) => s + m.payable, 0)

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">GST Reports</h1>
          <p className="text-gray-500 text-sm">Monthly GST with carry-forward balance & bill details</p>
        </div>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input-field w-auto">
          {years.map(y => <option key={y} value={y}>FY {y}-{String(y+1).slice(2)}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card bg-blue-50 border-l-4 border-blue-500">
          <p className="text-xs text-blue-600 font-medium">Total Sales</p>
          <p className="text-lg font-bold text-blue-800">{formatCurrency(data.salesTotal || 0)}</p>
          <p className="text-xs text-blue-500 mt-1">Output GST: {formatCurrency(g3b.outputTotal || 0)}</p>
        </div>
        <div className="card bg-orange-50 border-l-4 border-orange-500">
          <p className="text-xs text-orange-600 font-medium">Total Purchases</p>
          <p className="text-lg font-bold text-orange-800">{formatCurrency(data.purchaseTotal || 0)}</p>
          <p className="text-xs text-orange-500 mt-1">Input GST: {formatCurrency(g3b.inputTotal || 0)}</p>
        </div>
        <div className="card bg-red-50 border-l-4 border-red-500">
          <p className="text-xs text-red-600 font-medium">Total GST Payable</p>
          <p className="text-lg font-bold text-red-800">{formatCurrency(totalActualPayable)}</p>
          <p className="text-xs text-red-500 mt-1">After carry-forward</p>
        </div>
        <div className="card bg-green-50 border-l-4 border-green-500">
          <p className="text-xs text-green-600 font-medium">Carry Forward Credit</p>
          <p className="text-lg font-bold text-green-800">{formatCurrency(g3b.finalCarryForward || 0)}</p>
          <p className="text-xs text-green-500 mt-1">Goes to next FY</p>
        </div>
        <div className="card bg-purple-50 border-l-4 border-purple-500">
          <p className="text-xs text-purple-600 font-medium">Net Position</p>
          <p className={`text-lg font-bold ${g3b.outputTotal > g3b.inputTotal ? 'text-red-800' : 'text-green-800'}`}>
            {g3b.outputTotal > g3b.inputTotal ? 'PAY' : 'CREDIT'}
          </p>
          <p className="text-xs text-purple-500 mt-1">{formatCurrency(Math.abs(g3b.outputTotal - g3b.inputTotal))}</p>
        </div>
      </div>

      {/* GSTR-3B Breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <h3 className="font-bold text-blue-800 mb-3">Output GST (GSTR-1)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>CGST</span><span className="font-medium">{formatCurrency(g3b.outputCGST)}</span></div>
            <div className="flex justify-between"><span>SGST</span><span className="font-medium">{formatCurrency(g3b.outputSGST)}</span></div>
            <div className="flex justify-between"><span>IGST</span><span className="font-medium">{formatCurrency(g3b.outputIGST)}</span></div>
            <hr/>
            <div className="flex justify-between font-bold"><span>Total Output</span><span>{formatCurrency(g3b.outputTotal)}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-bold text-orange-800 mb-3">Input GST (GSTR-2)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>CGST</span><span className="font-medium">{formatCurrency(g3b.inputCGST)}</span></div>
            <div className="flex justify-between"><span>SGST</span><span className="font-medium">{formatCurrency(g3b.inputSGST)}</span></div>
            <div className="flex justify-between"><span>IGST</span><span className="font-medium">{formatCurrency(g3b.inputIGST)}</span></div>
            <hr/>
            <div className="flex justify-between font-bold"><span>Total Input</span><span>{formatCurrency(g3b.inputTotal)}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-bold text-red-800 mb-3">Net GST Position</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>CGST Net</span><span className="font-bold">{formatCurrency(g3b.netCGST)}</span></div>
            <div className="flex justify-between"><span>SGST Net</span><span className="font-bold">{formatCurrency(g3b.netSGST)}</span></div>
            <div className="flex justify-between"><span>IGST Net</span><span className="font-bold">{formatCurrency(g3b.netIGST)}</span></div>
            <hr/>
            <div className="flex justify-between font-bold text-base">
              <span>{g3b.outputTotal > g3b.inputTotal ? 'You Pay' : 'Your Credit'}</span>
              <span className={g3b.outputTotal > g3b.inputTotal ? 'text-red-700' : 'text-green-700'}>{formatCurrency(Math.abs(g3b.outputTotal - g3b.inputTotal))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Type Selector */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Monthly GST Comparison</h3>
          <div className="flex gap-1">
            {[['bar','Bar'],['line','Line'],['area','Area'],['pie','Pie']].map(([val, label]) => (
              <button key={val} onClick={() => setChartType(val)} className={`px-3 py-1.5 text-sm rounded-lg font-medium ${chartType === val ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="h-80">
          {chartType === 'bar' && barData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={fmtTooltip} />
                <Legend />
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={fmtTooltip} />
                <Legend />
                <Line type="monotone" dataKey="Sales" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="Purchases" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {chartType === 'area' && areaData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={fmtTooltip} />
                <Legend />
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
                <Tooltip formatter={fmtTooltip} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {activeMonths.length === 0 && (
            <div className="flex items-center justify-center h-full text-gray-400">No data for this financial year</div>
          )}
        </div>
      </div>

      {/* Monthly GST Payable Table — EXPANDABLE with bill details */}
      <div className="card">
        <h3 className="font-bold mb-1">Monthly GST with Carry-Forward Balance</h3>
        <p className="text-xs text-gray-500 mb-4">
          <b>Carry Forward</b> = excess input credit from previous month. <b>Balance</b> = credit going to next month. Click a month to see its bills.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500 text-left text-xs uppercase tracking-wide">
                <th className="pb-2 font-medium"></th>
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium text-center">Bills</th>
                <th className="pb-2 font-medium text-right">Sales</th>
                <th className="pb-2 font-medium text-right">Purchases</th>
                <th className="pb-2 font-medium text-right">Output GST</th>
                <th className="pb-2 font-medium text-right">Input GST</th>
                <th className="pb-2 font-medium text-right">Carry Fwd</th>
                <th className="pb-2 font-medium text-right">Payable</th>
                <th className="pb-2 font-medium text-right">Balance →</th>
              </tr>
            </thead>
            <tbody>
              {monthlyPayable.map((m, i) => {
                const isActive = m.sales > 0 || m.purchases > 0
                const isOpen = expandedMonth === m.month
                return (
                  <React.Fragment key={i}>
                    <tr
                      className={`border-b cursor-pointer transition-colors ${isActive ? 'hover:bg-blue-50' : 'opacity-50'} ${isOpen ? 'bg-blue-50' : ''}`}
                      onClick={() => isActive && handleExpandMonth(m.month, m.monthKey)}
                    >
                      <td className="py-2.5 w-6">
                        {isActive ? (isOpen ? <ChevronDown size={16} className="text-primary-600" /> : <ChevronRight size={16} className="text-gray-400" />) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 font-medium">
                        <span className={m.payable > 0 ? 'text-red-700' : 'text-gray-900'}>{MONTH_FULL[m.month]}</span>
                      </td>
                      <td className="py-2.5 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs">
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{m.invoiceCount} <FileText size={10} className="inline" /></span>
                            <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{m.billCount} <ShoppingCart size={10} className="inline" /></span>
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 text-right">{isActive ? formatCurrency(m.sales) : '—'}</td>
                      <td className="py-2.5 text-right">{isActive ? formatCurrency(m.purchases) : '—'}</td>
                      <td className="py-2.5 text-right text-blue-600">{isActive ? formatCurrency(m.outputGST) : '—'}</td>
                      <td className="py-2.5 text-right text-orange-600">{isActive ? formatCurrency(m.inputGST) : '—'}</td>
                      <td className="py-2.5 text-right text-purple-600 font-medium">{m.carryForward > 0 ? formatCurrency(m.carryForward) : '—'}</td>
                      <td className="py-2.5 text-right font-bold">
                        {m.payable > 0 ? <span className="text-red-600">{formatCurrency(m.payable)}</span> : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 text-right font-medium">
                        {m.balance > 0 ? (
                          <span className="text-green-600 flex items-center justify-end gap-1">
                            {formatCurrency(m.balance)} <ArrowRight size={12} />
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>

                    {/* Expanded Month — Show individual bills */}
                    {isOpen && (
                      <tr>
                        <td colSpan={10} className="p-0">
                          <div className="bg-gray-50 border-l-4 border-primary-500 px-6 py-4">
                            {billsLoading ? (
                              <div className="flex justify-center py-4"><div className="animate-spin h-6 w-6 border-3 border-primary-500 border-t-transparent rounded-full"></div></div>
                            ) : (
                              <>
                                {/* Sales Invoices for this month */}
                                <div className="mb-4">
                                  <h4 className="font-bold text-sm text-blue-800 mb-2 flex items-center gap-2">
                                    <FileText size={14} /> Sales Invoices — {MONTH_FULL[m.month]}
                                  </h4>
                                  {monthlyBills.invoices.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">No sales invoices in this month</p>
                                  ) : (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b text-gray-500">
                                          <th className="pb-1.5 text-left font-medium">Invoice #</th>
                                          <th className="pb-1.5 text-left font-medium">Customer</th>
                                          <th className="pb-1.5 text-left font-medium">Date</th>
                                          <th className="pb-1.5 text-right font-medium">Taxable</th>
                                          <th className="pb-1.5 text-right font-medium">CGST</th>
                                          <th className="pb-1.5 text-right font-medium">SGST</th>
                                          <th className="pb-1.5 text-right font-medium">IGST</th>
                                          <th className="pb-1.5 text-right font-medium">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {monthlyBills.invoices.map(inv => (
                                          <tr key={inv.id} className="border-b border-gray-100 hover:bg-white">
                                            <td className="py-1.5 font-medium text-blue-700">{inv.invoice_number}</td>
                                            <td className="py-1.5">{inv.customer_name}</td>
                                            <td className="py-1.5 text-gray-500">{formatDate(inv.invoice_date)}</td>
                                            <td className="py-1.5 text-right">{formatCurrency(inv.subtotal)}</td>
                                            <td className="py-1.5 text-right">{formatCurrency(inv.cgst_amount)}</td>
                                            <td className="py-1.5 text-right">{formatCurrency(inv.sgst_amount)}</td>
                                            <td className="py-1.5 text-right">{formatCurrency(inv.igst_amount)}</td>
                                            <td className="py-1.5 text-right font-bold">{formatCurrency(inv.total_amount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>

                                {/* Purchase Bills for this month */}
                                <div>
                                  <h4 className="font-bold text-sm text-orange-800 mb-2 flex items-center gap-2">
                                    <ShoppingCart size={14} /> Purchase Bills — {MONTH_FULL[m.month]}
                                  </h4>
                                  {monthlyBills.purchases.length === 0 ? (
                                    <p className="text-xs text-gray-400 italic">No purchase bills in this month</p>
                                  ) : (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b text-gray-500">
                                          <th className="pb-1.5 text-left font-medium">Bill #</th>
                                          <th className="pb-1.5 text-left font-medium">Supplier</th>
                                          <th className="pb-1.5 text-left font-medium">Date</th>
                                          <th className="pb-1.5 text-right font-medium">Taxable</th>
                                          <th className="pb-1.5 text-right font-medium">CGST</th>
                                          <th className="pb-1.5 text-right font-medium">SGST</th>
                                          <th className="pb-1.5 text-right font-medium">IGST</th>
                                          <th className="pb-1.5 text-right font-medium">Total</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {monthlyBills.purchases.map(pur => (
                                          <tr key={pur.id} className="border-b border-gray-100 hover:bg-white">
                                            <td className="py-1.5 font-medium text-orange-700">{pur.bill_number}</td>
                                            <td className="py-1.5">{pur.supplier_name}</td>
                                            <td className="py-1.5 text-gray-500">{formatDate(pur.bill_date)}</td>
                                            <td className="py-1.5 text-right">{formatCurrency(pur.subtotal)}</td>
                                            <td className="py-1.5 text-right">{formatCurrency(pur.cgst_amount)}</td>
                                            <td className="py-1.5 text-right">{formatCurrency(pur.sgst_amount)}</td>
                                            <td className="py-1.5 text-right">{formatCurrency(pur.igst_amount)}</td>
                                            <td className="py-1.5 text-right font-bold">{formatCurrency(pur.total_amount)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>

                                {/* Month Summary */}
                                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center gap-6 text-xs">
                                  <span className="text-blue-700 font-bold">Output GST: {formatCurrency(m.outputGST)}</span>
                                  <span className="text-orange-700 font-bold">Input GST: {formatCurrency(m.inputGST)}</span>
                                  {m.carryForward > 0 && <span className="text-purple-700 font-bold">Carry Fwd: {formatCurrency(m.carryForward)}</span>}
                                  {m.payable > 0 && <span className="text-red-700 font-bold">PAY: {formatCurrency(m.payable)}</span>}
                                  {m.balance > 0 && <span className="text-green-700 font-bold">Credit →: {formatCurrency(m.balance)}</span>}
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
              {/* Totals Row */}
              <tr className="font-bold bg-gray-50">
                <td className="py-3"></td>
                <td className="py-3">FY TOTAL</td>
                <td className="py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-xs">
                    <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{monthlyPayable.reduce((s,m) => s+m.invoiceCount, 0)}</span>
                    <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">{monthlyPayable.reduce((s,m) => s+m.billCount, 0)}</span>
                  </span>
                </td>
                <td className="py-3 text-right">{formatCurrency(data.salesTotal)}</td>
                <td className="py-3 text-right">{formatCurrency(data.purchaseTotal)}</td>
                <td className="py-3 text-right text-blue-600">{formatCurrency(g3b.outputTotal)}</td>
                <td className="py-3 text-right text-orange-600">{formatCurrency(g3b.inputTotal)}</td>
                <td className="py-3 text-right text-purple-600">—</td>
                <td className="py-3 text-right text-red-700">{formatCurrency(totalActualPayable)}</td>
                <td className="py-3 text-right text-green-600">
                  {g3b.finalCarryForward > 0 ? (
                    <span className="flex items-center justify-end gap-1">{formatCurrency(g3b.finalCarryForward)} <ArrowRight size={12} /></span>
                  ) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* How carry-forward works */}
        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-xs text-yellow-800">
          <p className="font-bold mb-1">How Carry-Forward Works:</p>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li><b>Output GST</b> = Total GST collected on sales invoices for the month</li>
            <li><b>Input GST</b> = Total GST paid on purchase bills for the month</li>
            <li><b>Carry Forward</b> = Excess input credit brought from previous month</li>
            <li><b>Payable</b> = Output GST − Input GST − Carry Forward (if positive, you pay this)</li>
            <li><b>Balance →</b> = If negative after carry forward, this credit goes to next month</li>
          </ol>
          <p className="mt-2"><b>Example:</b> If June has ₹50,000 output GST and ₹60,000 input GST → Balance of ₹10,000 carries to July. If July has ₹40,000 output and ₹30,000 input, payable = 40,000 − 30,000 − 10,000 carry = ₹0. Nothing to pay!</p>
        </div>
      </div>
    </div>
  )
}
