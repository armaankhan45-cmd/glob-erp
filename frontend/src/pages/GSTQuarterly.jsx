import { useEffect, useState, useCallback } from 'react'
import api from '../api/client'
import { formatCurrency } from '../utils'
import { Download, Loader2, CalendarClock, AlertTriangle, CheckCircle2, Clock, Info, FileText, ShoppingCart } from 'lucide-react'

const STATUS = {
  upcoming:       { text: 'Upcoming',            color: '#64748b' },
  in_progress:    { text: 'Quarter running',     color: '#3b82f6' },
  filing_open:    { text: 'Filing window open',  color: '#f59e0b' },
  past_due_date:  { text: 'Due date passed',     color: '#ef4444' },
}
const daysUntil = (iso) => {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000)
}
const fmtDate = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
function Countdown({ days }) {
  if (days == null) return null
  if (days < 0) return <span style={{ color: '#ef4444' }}>{Math.abs(days)} day{Math.abs(days) === 1 ? '' : 's'} overdue</span>
  if (days === 0) return <span style={{ color: '#f59e0b' }}>due today</span>
  return <span style={{ color: days <= 7 ? '#f59e0b' : 'var(--text-secondary)' }}>{days} day{days === 1 ? '' : 's'} left</span>
}

export default function GSTQuarterly({ year }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [sel, setSel] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const load = useCallback(async () => {
    setError(false)
    try {
      const res = await api.get('/gst/quarterly', { params: { year } })
      setData(res.data)
      setSel(prev => {
        if (prev && res.data.fy === data?.fy) return prev
        // open on the quarter that matters now: filing window open > running > last with data
        const qs = res.data.quarters
        return (qs.find(q => q.status === 'filing_open') || qs.find(q => q.status === 'in_progress') || qs[qs.length - 1]).quarter
      })
    } catch { setError(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])
  useEffect(() => { setData(null); setSel(null); load() }, [year]) // eslint-disable-line react-hooks/exhaustive-deps

  const download = async () => {
    setDownloading(true)
    try {
      const res = await api.get('/export/gst-report.xlsx', { params: { fy: year }, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `GST-Report_FY${year}-${String(year + 1).slice(2)}.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Download failed') } finally { setDownloading(false) }
  }

  if (error) return <div className="card text-sm" style={{ color: '#ef4444' }}>Couldn't load the quarterly report. Try refreshing.</div>
  if (!data) return <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 border-4 rounded-full" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></div>

  const q = data.quarters.find(x => x.quarter === sel) || data.quarters[0]
  const reg = data.registration
  const heads = ['cgst', 'sgst', 'igst']

  return (
    <div className="space-y-6">
      {/* Firm strip */}
      <div className="card flex flex-wrap items-center justify-between gap-3" style={{ padding: '14px 18px' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Quarterly GST return · {data.fy}</p>
          <p className="text-sm text-white/70 mt-0.5">
            GSTIN {reg.gstin || 'not set'} · {reg.scheme} · GSTR-1 by 13th, GSTR-3B by {reg.gstr3bDay}th after each quarter
          </p>
        </div>
        <button onClick={download} disabled={downloading} className="btn-primary flex items-center gap-2 text-sm">
          {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          Excel report (month + quarter wise)
        </button>
      </div>

      {/* FY headline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Output GST (sales)" value={data.totals.outputGST} color="#3b82f6" />
        <Stat label="Input GST (ITC)" value={data.totals.inputGST} color="#f97316" />
        <Stat label="Cash GST payable" value={data.totals.payable} color="#ef4444" sub="after using available credit" />
        <Stat label="Credit carried forward" value={data.totals.closingCredit} color="#22c55e" sub="into next year" />
      </div>

      {/* Quarter cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.quarters.map(x => {
          const st = STATUS[x.status]
          const active = x.quarter === q.quarter
          return (
            <button key={x.quarter} onClick={() => setSel(x.quarter)} className="card text-left transition"
              style={{ padding: '14px 16px', borderColor: active ? 'var(--accent)' : undefined, boxShadow: active ? '0 0 0 1px var(--accent)' : undefined }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Q{x.quarter}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: st.color, background: `${st.color}1f` }}>{st.text}</span>
              </div>
              <p className="text-[11px] text-white/40 mt-0.5">{x.name.replace(/^Q\d\s*/, '').replace(/[()]/g, '')}</p>
              <p className="text-[11px] text-white/40 mt-2">GST payable</p>
              <p className="text-lg font-bold" style={{ color: x.payable.total > 0 ? '#ef4444' : 'var(--text-primary, inherit)' }}>{formatCurrency(x.payable.total)}</p>
              <p className="text-[11px] text-white/35 mt-1">Out {formatCurrency(x.output.gst)} · In {formatCurrency(x.input.gst)}</p>
            </button>
          )
        })}
      </div>

      {/* Selected quarter */}
      <div className="card space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">{q.name}</h2>
            <p className="text-xs text-white/40">{fmtDate(q.range.from)} → {fmtDate(q.range.to)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40">{q.payable.total > 0 ? 'Pay with GSTR-3B' : 'Nothing to pay in cash'}</p>
            <p className="text-2xl font-extrabold" style={{ color: q.payable.total > 0 ? '#ef4444' : '#22c55e' }}>{formatCurrency(q.payable.total)}</p>
          </div>
        </div>

        {/* Due dates */}
        <div className="grid md:grid-cols-2 gap-3">
          <Due title="GSTR-1 (sales details)" date={q.due.gstr1} days={daysUntil(q.due.gstr1)} />
          <Due title="GSTR-3B (summary + tax payment)" date={q.due.gstr3b} days={daysUntil(q.due.gstr3b)} />
        </div>

        {/* Head-wise table */}
        <div>
          <h3 className="text-sm font-bold text-white mb-2">Tax head-wise position</h3>
          <div className="overflow-x-auto">
            <table className="nebula-table w-full text-sm">
              <thead><tr><th className="text-left">Head</th><th className="text-right">Output (sales)</th><th className="text-right">Input (ITC)</th><th className="text-right">Credit brought fwd</th><th className="text-right">Cash payable</th><th className="text-right">Credit left</th></tr></thead>
              <tbody>
                {heads.map(h => (
                  <tr key={h}>
                    <td className="font-medium uppercase">{h}</td>
                    <td className="text-right">{formatCurrency(q.output[h])}</td>
                    <td className="text-right">{formatCurrency(q.input[h])}</td>
                    <td className="text-right text-white/30">—</td>
                    <td className="text-right font-semibold" style={{ color: q.payable[h] > 0 ? '#ef4444' : undefined }}>{formatCurrency(q.payable[h])}</td>
                    <td className="text-right">{formatCurrency(q.closingHeads?.[h] ?? 0)}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td>Total</td>
                  <td className="text-right">{formatCurrency(q.output.gst)}</td>
                  <td className="text-right">{formatCurrency(q.input.gst)}</td>
                  <td className="text-right">{formatCurrency(q.openingCredit || 0)}</td>
                  <td className="text-right" style={{ color: q.payable.total > 0 ? '#ef4444' : undefined }}>{formatCurrency(q.payable.total)}</td>
                  <td className="text-right">{formatCurrency(q.closingCredit)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-white/35 mt-2">Taxable sales {formatCurrency(q.output.taxable)} · {q.output.count} invoice{q.output.count === 1 ? '' : 's'}. Unused credit carries into the next quarter.</p>
        </div>

        {/* PMT-06 */}
        {q.due.pmt06?.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Monthly tax deposit (PMT-06)</h3>
            <p className="text-xs text-white/40 mb-2">Under the quarterly scheme you still deposit tax for the first two months, by the 25th of the next month. The 3rd month is paid with GSTR-3B.</p>
            <div className="overflow-x-auto">
              <table className="nebula-table w-full text-sm">
                <thead><tr><th className="text-left">Month</th><th className="text-left">Pay by</th><th className="text-right">35% fixed-sum</th><th className="text-right">Self-assessment estimate</th></tr></thead>
                <tbody>
                  {q.due.pmt06.map(p => (
                    <tr key={p.month}>
                      <td className="font-medium">{p.month}</td>
                      <td>{fmtDate(p.due)} · <span className="text-xs"><Countdown days={daysUntil(p.due)} /></span></td>
                      <td className="text-right">{formatCurrency(p.fixedSum)}</td>
                      <td className="text-right">{formatCurrency(p.selfAssessmentEstimate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-white/35 mt-2">Fixed-sum = 35% of the cash tax paid last quarter. Use whichever method you file under.</p>
          </div>
        )}

        {/* Months */}
        <div>
          <h3 className="text-sm font-bold text-white mb-2">Month-wise inside this quarter</h3>
          <div className="overflow-x-auto">
            <table className="nebula-table w-full text-sm">
              <thead><tr><th className="text-left">Month</th><th className="text-right"><FileText size={12} className="inline mr-1" />Sales</th><th className="text-right">Output GST</th><th className="text-right"><ShoppingCart size={12} className="inline mr-1" />Purchases</th><th className="text-right">Input GST</th><th className="text-right">Net</th></tr></thead>
              <tbody>
                {q.months.map(m => {
                  const salesAmt = m.sales?.total ?? 0
                  const purAmt = m.purchases?.total ?? 0
                  const net = m.outputGST - m.inputGST
                  return (
                    <tr key={m.monthKey}>
                      <td className="font-medium">{m.label}</td>
                      <td className="text-right">{formatCurrency(salesAmt)}</td>
                      <td className="text-right text-blue-400">{formatCurrency(m.outputGST)}</td>
                      <td className="text-right">{formatCurrency(purAmt)}</td>
                      <td className="text-right text-orange-400">{formatCurrency(m.inputGST)}</td>
                      <td className="text-right font-semibold" style={{ color: net > 0 ? '#ef4444' : '#22c55e' }}>{net > 0 ? '' : '−'}{formatCurrency(Math.abs(net))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 text-xs rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', color: '#d97706' }}>
        <Info size={14} className="mt-0.5 shrink-0" />
        <p>Calculated from the invoices and purchase bills recorded here. Input credit is set off as per CGST Act §49 (IGST first; CGST and SGST credit never pay each other). Please confirm figures with your CA before filing.</p>
      </div>
    </div>
  )
}

function Stat({ label, value, color, sub }) {
  return (
    <div className="gst-card" style={{ background: `${color}10`, borderLeft: `3px solid ${color}` }}>
      <p className="text-xs font-medium" style={{ color }}>{label}</p>
      <p className="text-xl font-bold text-white">{formatCurrency(value || 0)}</p>
      {sub && <p className="text-[11px] text-white/35 mt-0.5">{sub}</p>}
    </div>
  )
}
function Due({ title, date, days }) {
  const Icon = days == null ? CalendarClock : days < 0 ? AlertTriangle : days <= 7 ? Clock : CalendarClock
  const color = days != null && days < 0 ? '#ef4444' : days != null && days <= 7 ? '#f59e0b' : 'var(--text-secondary)'
  return (
    <div className="rounded-xl p-3 flex items-center gap-3" style={{ border: '1px solid var(--border, rgba(128,128,128,0.2))' }}>
      <Icon size={18} style={{ color }} />
      <div>
        <p className="text-xs text-white/40">{title}</p>
        <p className="text-sm font-semibold text-white">{fmtDate(date)} <span className="text-xs font-normal">· <Countdown days={days} /></span></p>
      </div>
    </div>
  )
}
