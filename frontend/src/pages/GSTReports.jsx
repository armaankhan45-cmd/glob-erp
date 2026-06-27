import { useState, useEffect } from 'react'
import api from '../api/client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '../utils'

export default function GSTReports() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState({ gstr1: [], gstr2: [], gstr3b: {} })
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [year])

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api.get('/gst/summary', { params: { year } })
      setData(res.data)
    } catch (err) {
      console.error('GST reports error:', err)
    } finally {
      setLoading(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  // Merge monthly data for chart
  const months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
  const chartData = months.map((m, i) => {
    const monthKey = i < 9 ? `${year}-${String(i + 4).padStart(2, '0')}` : `${year + 1}-${String(i - 8).padStart(2, '0')}`
    const o = data.gstr1?.find(g => g.month === monthKey) || {}
    const inp = data.gstr2?.find(g => g.month === monthKey) || {}
    return {
      month: m,
      'Output GST': parseFloat(o.igst || 0) + parseFloat(o.cgst || 0) + parseFloat(o.sgst || 0),
      'Input GST': parseFloat(inp.igst || 0) + parseFloat(inp.cgst || 0) + parseFloat(inp.sgst || 0)
    }
  })

  const g3b = data.gstr3b || {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GST Reports</h1>
          <p className="text-gray-500 text-sm">GSTR-1, GSTR-2, GSTR-3B summaries</p>
        </div>
        <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input-field w-auto">
          {years.map(y => <option key={y} value={y}>FY {y}-{y+1}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full"></div></div>
      ) : (
        <>
          {/* GSTR-3B Summary */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="card bg-blue-50">
              <h3 className="font-bold text-blue-800 mb-2">Output GST (GSTR-1)</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>CGST</span><span className="font-medium">{formatCurrency(g3b.outputCGST)}</span></div>
                <div className="flex justify-between"><span>SGST</span><span className="font-medium">{formatCurrency(g3b.outputSGST)}</span></div>
                <div className="flex justify-between"><span>IGST</span><span className="font-medium">{formatCurrency(g3b.outputIGST)}</span></div>
              </div>
            </div>
            <div className="card bg-orange-50">
              <h3 className="font-bold text-orange-800 mb-2">Input GST (GSTR-2)</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>CGST</span><span className="font-medium">{formatCurrency(g3b.inputCGST)}</span></div>
                <div className="flex justify-between"><span>SGST</span><span className="font-medium">{formatCurrency(g3b.inputSGST)}</span></div>
                <div className="flex justify-between"><span>IGST</span><span className="font-medium">{formatCurrency(g3b.inputIGST)}</span></div>
              </div>
            </div>
            <div className="card bg-red-50">
              <h3 className="font-bold text-red-800 mb-2">Net Payable (GSTR-3B)</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span>CGST</span><span className="font-bold">{formatCurrency(g3b.netCGST)}</span></div>
                <div className="flex justify-between"><span>SGST</span><span className="font-bold">{formatCurrency(g3b.netSGST)}</span></div>
                <div className="flex justify-between"><span>IGST</span><span className="font-bold">{formatCurrency(g3b.netIGST)}</span></div>
              </div>
            </div>
          </div>

          {/* Monthly Chart */}
          <div className="card">
            <h3 className="font-bold mb-4">Monthly GST Comparison</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={val => formatCurrency(val)} />
                  <Legend />
                  <Bar dataKey="Output GST" fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="Input GST" fill="#f97316" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
