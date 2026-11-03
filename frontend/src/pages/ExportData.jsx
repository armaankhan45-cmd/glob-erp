import { useState, useEffect } from 'react'
import api from '../api/client'
import { Download, FileSpreadsheet, Loader2, Eye, TrendingUp, Hash, IndianRupee, CalendarDays, Landmark } from 'lucide-react'

const EXPORTS = [
  { key: 'invoices', label: 'Invoices (Sales)', dated: true },
  { key: 'purchases', label: 'Purchases', dated: true },
  { key: 'payments', label: 'Payments', dated: true },
  { key: 'customers', label: 'Customers', dated: false },
]
const MONTH_NAMES = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
const money = (n) => n == null ? '—' : `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const thisFy = () => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1 }
const monthKeys = (fy) => MONTH_NAMES.map((m, i) => ({ key: i < 9 ? `${fy}-${String(i + 4).padStart(2, '0')}` : `${fy + 1}-${String(i - 8).padStart(2, '0')}`, label: `${m} ${i < 9 ? fy : fy + 1}` }))
const muted = { color: 'var(--text-muted)' }

export default function ExportData() {
  const [fy, setFy] = useState(thisFy())        // number, or 'all'
  const [month, setMonth] = useState('all')     // 'all' = whole FY (month-wise sheets) or 'YYYY-MM'
  const [openKey, setOpenKey] = useState(null)
  const [preview, setPreview] = useState({})
  const [loadingPreview, setLoadingPreview] = useState(null)
  const [loadingDownload, setLoadingDownload] = useState(null)

  const params = month !== 'all' ? { month } : fy !== 'all' ? { fy } : {}
  const tag = month !== 'all' ? month : fy !== 'all' ? `FY${fy}-${String(fy + 1).slice(2)}` : 'all-time'
  const periodLabel = month !== 'all' ? monthKeys(fy === 'all' ? thisFy() : fy).find(m => m.key === month)?.label || month : fy !== 'all' ? `FY ${fy}-${String(fy + 1).slice(2)}` : 'All time'
  const qFy = fy === 'all' ? thisFy() : fy

  const fetchPreview = async (key) => {
    setLoadingPreview(key)
    try {
      const res = await api.get(`/export/${key}/preview`, { params })
      setPreview(prev => ({ ...prev, [key]: res.data }))
    } catch (err) { setPreview(prev => ({ ...prev, [key]: { error: true } })) }
    finally { setLoadingPreview(null) }
  }

  // Changing the period invalidates every cached preview
  useEffect(() => { setPreview({}); if (openKey) fetchPreview(openKey) }, [fy, month])

  const togglePreview = (key) => {
    if (openKey === key) { setOpenKey(null); return }
    setOpenKey(key)
    if (!preview[key]) fetchPreview(key)
  }

  const saveBlob = (blob, name) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => window.URL.revokeObjectURL(url), 3000)
  }
  const handleDownload = async (exp) => {
    setLoadingDownload(exp.key)
    try {
      const res = await api.get(`/export/${exp.key}.xlsx`, { params: exp.dated ? params : {}, responseType: 'blob' })
      saveBlob(new Blob([res.data]), exp.dated ? `${exp.key}-${tag}.xlsx` : `${exp.key}.xlsx`)
    } catch (err) { alert('Export failed') } finally { setLoadingDownload(null) }
  }
  const handleQuarterly = async () => {
    setLoadingDownload('quarterly')
    try {
      const res = await api.get('/export/gst-quarterly.xlsx', { params: { fy: qFy }, responseType: 'blob' })
      saveBlob(new Blob([res.data]), `gst-quarterly-FY${qFy}-${String(qFy + 1).slice(2)}.xlsx`)
    } catch (err) { alert('Export failed') } finally { setLoadingDownload(null) }
  }

  const fyOptions = Array.from({ length: 5 }, (_, i) => thisFy() - i)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Export Excel</h1>
        <p className="text-sm" style={muted}>Every report downloads month-wise — a Summary sheet with quarter totals, plus one sheet per month.</p>
      </div>

      {/* Period picker */}
      <div className="card flex flex-wrap items-center gap-3" style={{ padding: '14px 18px' }}>
        <CalendarDays size={18} style={{ color: 'var(--accent)' }} />
        <select value={fy} onChange={e => { const v = e.target.value; setFy(v === 'all' ? 'all' : parseInt(v)); setMonth('all') }} className="input-field w-auto">
          {fyOptions.map(y => <option key={y} value={y}>FY {y}-{String(y + 1).slice(2)} (Apr–Mar)</option>)}
          <option value="all">All time</option>
        </select>
        <select value={month} onChange={e => setMonth(e.target.value)} disabled={fy === 'all'} className="input-field w-auto">
          <option value="all">Whole year — month-wise sheets</option>
          {fy !== 'all' && monthKeys(fy).map(m => <option key={m.key} value={m.key}>{m.label} only</option>)}
        </select>
        <span className="text-xs ml-auto" style={muted}>Exporting: <b className="text-white">{periodLabel}</b></span>
      </div>

      {/* Quarterly GST workbook */}
      <div className="card flex flex-wrap items-center justify-between gap-3" style={{ borderLeft: '3px solid var(--accent)' }}>
        <div className="flex items-center gap-3">
          <Landmark size={24} style={{ color: 'var(--accent)' }} />
          <div>
            <p className="font-medium text-white">Quarterly GST Report — FY {qFy}-{String(qFy + 1).slice(2)}</p>
            <p className="text-sm" style={muted}>Q1–Q4 output tax, ITC, set-off, cash payable &amp; due dates · month-wise table · sales, purchase &amp; credit-note registers</p>
          </div>
        </div>
        <button onClick={handleQuarterly} disabled={loadingDownload === 'quarterly'} className="btn-primary flex items-center gap-2">
          {loadingDownload === 'quarterly' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download
        </button>
      </div>

      <div className="space-y-4">
        {EXPORTS.map(exp => {
          const data = preview[exp.key]
          const isOpen = openKey === exp.key
          return (
            <div key={exp.key} className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={24} style={{ color: 'var(--accent)' }} />
                  <div>
                    <p className="font-medium text-white">{exp.label}</p>
                    <p className="text-sm" style={muted}>{exp.dated ? `${exp.key}-${tag}.xlsx · month-wise` : 'customers.xlsx · all customers'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => togglePreview(exp.key)} className="btn-secondary flex items-center gap-2">
                    {loadingPreview === exp.key ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}{isOpen ? 'Hide' : 'Preview'}
                  </button>
                  <button onClick={() => handleDownload(exp)} disabled={loadingDownload === exp.key} className="btn-primary flex items-center gap-2">
                    {loadingDownload === exp.key ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}{loadingDownload === exp.key ? 'Exporting…' : 'Download'}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  {loadingPreview === exp.key && <p className="text-sm" style={muted}>Loading preview…</p>}
                  {data?.error && <p className="text-sm text-red-400">Couldn't load preview.</p>}
                  {data && !data.error && (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="rounded-lg p-3 flex items-center gap-2" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}><Hash size={16} style={muted} /><div><p className="text-xs" style={muted}>Records</p><p className="font-semibold text-white">{data.insights.count}</p></div></div>
                        {data.insights.total != null && <div className="rounded-lg p-3 flex items-center gap-2" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}><IndianRupee size={16} style={muted} /><div><p className="text-xs" style={muted}>Total value</p><p className="font-semibold text-white">{money(data.insights.total)}</p></div></div>}
                        {data.insights.average != null && <div className="rounded-lg p-3 flex items-center gap-2" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)' }}><TrendingUp size={16} style={muted} /><div><p className="text-xs" style={muted}>Average</p><p className="font-semibold text-white">{money(data.insights.average)}</p></div></div>}
                      </div>

                      {data.monthly?.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={muted}>Month-wise</p>
                          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
                            <table className="nebula-table min-w-full text-sm">
                              <thead><tr><th className="text-left">Month</th><th className="text-right">Records</th>{exp.key !== 'payments' ? <><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">Total</th></> : <th className="text-right">Amount</th>}</tr></thead>
                              <tbody>
                                {data.monthly.map(m => {
                                  const t = m.totals
                                  const gst = (t.cgst_amount || 0) + (t.sgst_amount || 0) + (t.igst_amount || 0)
                                  return (
                                    <tr key={m.key} style={{ opacity: m.count ? 1 : 0.4 }}>
                                      <td className="whitespace-nowrap font-medium text-white">{m.label}</td><td className="text-right">{m.count}</td>
                                      {exp.key !== 'payments' ? <><td className="text-right">{money(t.subtotal)}</td><td className="text-right">{money(gst)}</td><td className="text-right font-medium">{money(t.total_amount)}</td></> : <td className="text-right font-medium">{money(t.amount)}</td>}
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border)' }}>
                        <table className="nebula-table min-w-full text-sm">
                          <thead><tr>{data.columns.map(col => <th key={col.key} className="whitespace-nowrap text-left">{col.header}</th>)}</tr></thead>
                          <tbody>
                            {data.rows.slice(0, 50).map((row, i) => (
                              <tr key={i}>{data.columns.map(col => (
                                <td key={col.key} className="whitespace-nowrap">
                                  {col.key.match(/amount|subtotal|cgst|sgst|igst/) && row[col.key] != null ? money(row[col.key]) : col.key.match(/_date$/) && row[col.key] ? new Date(row[col.key]).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (row[col.key] ?? '—')}
                                </td>))}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {data.rows.length > 50 && <p className="text-xs mt-2" style={muted}>Showing first 50 of {data.rows.length} rows — download the file for the full set.</p>}
                      {data.rows.length === 0 && <p className="text-sm py-6 text-center" style={muted}>No records for {periodLabel}.</p>}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
