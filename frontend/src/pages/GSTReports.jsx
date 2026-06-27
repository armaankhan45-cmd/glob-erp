import { useState, useEffect } from 'react'
import api from '../api/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts'
import { formatCurrency } from '../utils'

const COLORS = ['#3b82f6', '#f97316', '#ef4444', '#22c55e', '#8b5cf6', '#06b6d4']

export default function GSTReports() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState({ gstr1: [], gstr2: [], gstr3b: {}, monthlyPayable: [], salesTotal: 0, purchaseTotal: 0 })
  const [chartType, setChartType] = useState('bar')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [year])

  const loadData = async () => {
    setLoading(true)
    try { const res = await api.get('/gst/summary', { params: { year } }); setData(res.data) }
    catch (err) { console.error('GST reports error:', err) }
    finally { setLoading(false) }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const g3b = data.gstr3b || {}
  const monthlyPayable = data.monthlyPayable || []

  // Bar chart data
  const barData = monthlyPayable.map(m => ({
    month: m.month,
    'Output GST (Sales)': m.outputGST,
    'Input GST (Purchases)': m.inputGST,
    'Net Payable': m.payable
  }))

  // Line chart data
  const lineData = monthlyPayable.map(m => ({
    month: m.month,
    'Sales': m.sales,
    'Purchases': m.purchases
  }))

  // Pie chart data
  const pieData = [
    { name: 'CGST Payable', value: g3b.netCGST || 0 },
    { name: 'SGST Payable', value: g3b.netSGST || 0 },
    { name: 'IGST Payable', value: g3b.netIGST || 0 },
    { name: 'Input Credit', value: g3b.creditBalance || 0 },
  ].filter(d => d.value > 0)

  const fmtTooltip = (val) => formatCurrency(val)

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">GST Reports</h1>
          <p className="text-gray-500 text-sm">Monthly GST payable, balance & credit calculation</p>
        </div>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input-field w-auto">
          {years.map(y => <option key={y} value={y}>FY {y}-{String(y+1).slice(2)}</option>)}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-blue-50 border-l-4 border-blue-500">
          <p className="text-sm text-blue-600 font-medium">Total Sales</p>
          <p className="text-xl font-bold text-blue-800">{formatCurrency(data.salesTotal || 0)}</p>
          <p className="text-xs text-blue-500 mt-1">Output: {formatCurrency(g3b.outputTotal || 0)}</p>
        </div>
        <div className="card bg-orange-50 border-l-4 border-orange-500">
          <p className="text-sm text-orange-600 font-medium">Total Purchases</p>
          <p className="text-xl font-bold text-orange-800">{formatCurrency(data.purchaseTotal || 0)}</p>
          <p className="text-xs text-orange-500 mt-1">Input: {formatCurrency(g3b.inputTotal || 0)}</p>
        </div>
        <div className="card bg-red-50 border-l-4 border-red-500">
          <p className="text-sm text-red-600 font-medium">GST Payable</p>
          <p className="text-xl font-bold text-red-800">{formatCurrency(g3b.netPayable || 0)}</p>
          <p className="text-xs text-red-500 mt-1">You need to pay this</p>
        </div>
        <div className="card bg-green-50 border-l-4 border-green-500">
          <p className="text-sm text-green-600 font-medium">Input Credit</p>
          <p className="text-xl font-bold text-green-800">{formatCurrency(g3b.creditBalance || 0)}</p>
          <p className="text-xs text-green-500 mt-1">Excess input GST credit</p>
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
            <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(g3b.outputTotal)}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-bold text-orange-800 mb-3">Input GST (GSTR-2)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>CGST</span><span className="font-medium">{formatCurrency(g3b.inputCGST)}</span></div>
            <div className="flex justify-between"><span>SGST</span><span className="font-medium">{formatCurrency(g3b.inputSGST)}</span></div>
            <div className="flex justify-between"><span>IGST</span><span className="font-medium">{formatCurrency(g3b.inputIGST)}</span></div>
            <hr/>
            <div className="flex justify-between font-bold"><span>Total</span><span>{formatCurrency(g3b.inputTotal)}</span></div>
          </div>
        </div>
        <div className="card">
          <h3 className="font-bold text-red-800 mb-3">Net GST Payable (GSTR-3B)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>CGST</span><span className="font-bold">{formatCurrency(g3b.netCGST)}</span></div>
            <div className="flex justify-between"><span>SGST</span><span className="font-bold">{formatCurrency(g3b.netSGST)}</span></div>
            <div className="flex justify-between"><span>IGST</span><span className="font-bold">{formatCurrency(g3b.netIGST)}</span></div>
            <hr/>
            <div className="flex justify-between font-bold text-base"><span>Total Payable</span><span className="text-red-700">{formatCurrency(g3b.netPayable)}</span></div>
          </div>
        </div>
      </div>

      {/* Chart Type Selector */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Monthly GST Comparison</h3>
          <div className="flex gap-1">
            {[['bar','Bar'],['line','Line'],['pie','Pie']].map(([val, label]) => (
              <button key={val} onClick={() => setChartType(val)} className={`px-3 py-1.5 text-sm rounded-lg font-medium ${chartType === val ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="h-80">
          {chartType === 'bar' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={fmtTooltip} />
                <Legend />
                <Bar dataKey="Output GST (Sales)" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="Input GST (Purchases)" fill="#f97316" radius={[4,4,0,0]} />
                <Bar dataKey="Net Payable" fill="#ef4444" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {chartType === 'line' && (
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
        </div>
      </div>

      {/* Monthly Payable Table */}
      <div className="card">
        <h3 className="font-bold mb-4">Monthly GST Payable Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500 text-left">
                <th className="pb-2 font-medium">Month</th>
                <th className="pb-2 font-medium text-right">Sales</th>
                <th className="pb-2 font-medium text-right">Purchases</th>
                <th className="pb-2 font-medium text-right">Output GST</th>
                <th className="pb-2 font-medium text-right">Input GST</th>
                <th className="pb-2 font-medium text-right">Net Payable</th>
                <th className="pb-2 font-medium text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {monthlyPayable.map((m, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 font-medium">{m.month}</td>
                  <td className="py-2 text-right">{formatCurrency(m.sales)}</td>
                  <td className="py-2 text-right">{formatCurrency(m.purchases)}</td>
                  <td className="py-2 text-right text-blue-600">{formatCurrency(m.outputGST)}</td>
                  <td className="py-2 text-right text-orange-600">{formatCurrency(m.inputGST)}</td>
                  <td className="py-2 text-right font-bold text-red-600">{formatCurrency(m.payable)}</td>
                  <td className="py-2 text-right text-green-600">{m.balance > 0 ? formatCurrency(m.balance) : '-'}</td>
                </tr>
              ))}
              {/* Totals */}
              <tr className="font-bold bg-gray-50">
                <td className="py-3">TOTAL</td>
                <td className="py-3 text-right">{formatCurrency(data.salesTotal)}</td>
                <td className="py-3 text-right">{formatCurrency(data.purchaseTotal)}</td>
                <td className="py-3 text-right text-blue-600">{formatCurrency(g3b.outputTotal)}</td>
                <td className="py-3 text-right text-orange-600">{formatCurrency(g3b.inputTotal)}</td>
                <td className="py-3 text-right text-red-700">{formatCurrency(g3b.netPayable)}</td>
                <td className="py-3 text-right text-green-600">{formatCurrency(g3b.creditBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          <b>Net Payable</b> = Output GST − Input GST. If positive, you pay this amount. If negative, it shows as Input Credit (you can claim it).
        </p>
      </div>
    </div>
  )
}
