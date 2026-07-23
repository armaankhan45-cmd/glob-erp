import React, { useState, useEffect } from 'react'
import api from '../api/client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp } from 'lucide-react'

const fmt = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
const COLORS = ['#06b6d4', '#4f8fff', '#10b981', '#f59e0b', '#ef4444']

export default function GSTReports() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/gst/reports').then(res => { setData(res.data); setLoading(false) }).catch(err => { setError(err.message); setLoading(false) })
  }, [])

  if (loading) return <div className="flex flex-col items-center justify-center h-96"><div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  const d = data || {}
  const gstSplit = [
    { name: 'CGST', value: Math.max(0, d.netPayable?.cgst || 0) },
    { name: 'SGST', value: Math.max(0, d.netPayable?.sgst || 0) },
    { name: 'IGST', value: Math.max(0, d.netPayable?.igst || 0) },
  ].filter(x => x.value > 0)

  return (
    <div className="space-y-6">
      <div className="mb-4"><h1 className="text-xl font-extrabold accent-text">GST Reports</h1><div className="gstin-badge mt-2">GSTIN: 27AWAPK1209R1ZC</div></div>
      {error && <div className="text-red-400 text-sm">{error}</div>}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 stagger">
        {[
          { label: 'Output CGST', value: d.outputGST?.cgst || 0, bg: 'rgba(96,165,250,0.08)', color: '#60a5fa' },
          { label: 'Output SGST', value: d.outputGST?.sgst || 0, bg: 'rgba(6,182,212,0.08)', color: '#06b6d4' },
          { label: 'Input CGST', value: d.inputGST?.cgst || 0, bg: 'rgba(96,165,250,0.08)', color: '#60a5fa' },
          { label: 'Input SGST', value: d.inputGST?.sgst || 0, bg: 'rgba(6,182,212,0.08)', color: '#06b6d4' },
          { label: 'Net GST', value: d.netPayable?.total || 0, bg: 'rgba(16,185,129,0.08)', color: '#10b981' },
        ].map((item, i) => (
          <div key={i} className="stat-card card-premium" style={{ animation: `entranceScale 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s both` }}>
            <div className="shimmer" />
            <p className="text-xs font-semibold uppercase tracking-wider text-white/35">{item.label}</p>
            <p className="text-xl font-extrabold mt-1" style={{ fontFamily: '"Space Grotesk", sans-serif', color: item.color }}>{fmt(item.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card card-premium">
          <h3 className="font-bold text-white mb-4 text-[15px]">GST Breakdown</h3>
          <div className="space-y-3">
            <div className="gst-card cgst rounded-xl p-4 relative overflow-hidden"><p className="text-sm font-semibold text-blue-400 mb-1">Output GST (Sales)</p><p className="text-xl font-extrabold text-blue-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{fmt(d.outputGST?.total || 0)}</p><div className="flex gap-3 mt-2 text-[10px] text-white/30"><span>CGST: {fmt(d.outputGST?.cgst || 0)}</span><span>SGST: {fmt(d.outputGST?.sgst || 0)}</span><span>IGST: {fmt(d.outputGST?.igst || 0)}</span></div></div>
            <div className="gst-card sgst rounded-xl p-4 relative overflow-hidden"><p className="text-sm font-semibold text-cyan-400 mb-1">Input GST (Purchases)</p><p className="text-xl font-extrabold text-cyan-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{fmt(d.inputGST?.total || 0)}</p><div className="flex gap-3 mt-2 text-[10px] text-white/30"><span>CGST: {fmt(d.inputGST?.cgst || 0)}</span><span>SGST: {fmt(d.inputGST?.sgst || 0)}</span><span>IGST: {fmt(d.inputGST?.igst || 0)}</span></div></div>
            <div className="gst-card igst rounded-xl p-4 relative overflow-hidden"><p className="text-sm font-semibold text-red-400 mb-1">Net Payable</p><p className="text-xl font-extrabold text-red-300" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{fmt(d.netPayable?.total || 0)}</p><div className="flex gap-3 mt-2 text-[10px] text-white/30"><span>CGST: {fmt(d.netPayable?.cgst || 0)}</span><span>SGST: {fmt(d.netPayable?.sgst || 0)}</span><span>IGST: {fmt(d.netPayable?.igst || 0)}</span></div></div>
          </div>
        </div>
        {gstSplit.length > 0 && (
          <div className="card card-premium">
            <h3 className="font-bold text-white mb-2 text-[15px]">GST Split</h3>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={gstSplit} cx="50%" cy="50%" outerRadius={60} innerRadius={30} dataKey="value" strokeWidth={0}>{gstSplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={fmt} contentStyle={{ background: 'rgba(12,16,32,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-3 mt-1">{gstSplit.map((x, i) => <span key={i} className="text-xs flex items-center gap-1.5 text-white/40"><span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />{x.name}</span>)}</div>
          </div>
        )}
      </div>

      <div className="card card-premium">
        <h3 className="font-bold text-white mb-2 text-[15px]">GSTR Filing Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div><p className="text-xs text-white/35">Sales Invoices (GSTR-1)</p><p className="font-extrabold text-xl text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{d.totalSalesInvoices || d.totalInvoices || 0}</p></div>
          <div><p className="text-xs text-white/35">Purchase Bills (GSTR-2)</p><p className="font-extrabold text-xl text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{d.totalPurchaseBills || 0}</p></div>
          <div><p className="text-xs text-white/35">Credit Notes</p><p className="font-extrabold text-xl text-white" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>{d.totalCreditNotes || 0}</p></div>
        </div>
      </div>
    </div>
  )
}
