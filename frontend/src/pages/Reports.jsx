import { useState, useEffect } from 'react'
import api from '../api/client'
import { formatCurrency, formatDate } from '../utils'
import { Download, Loader2, ChevronDown, ChevronRight, CheckCircle2, CalendarClock, Info } from 'lucide-react'

const muted = { color: 'var(--text-muted)' }
const thisFy = () => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1 }
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
const fmtDue = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

// ═════════ QUARTERLY GST — the main report for a quarterly-payment business ═════════
function QuarterlyGst() {
  const [fy, setFy] = useState(thisFy())
  const [useCn, setUseCn] = useState(true)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [openQ, setOpenQ] = useState(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api.get('/reports/gst-quarterly', { params: { fy, cn: useCn ? 1 : 0 } })
      .then(r => { if (alive) { setData(r.data); const t = todayIso(); const run = (r.data.quarters || []).find(q => t >= q.startDate && t <= q.endDate); setOpenQ(run ? run.q : null) } })
      .catch(() => { if (alive) setData(null) })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [fy, useCn])

  const download = async () => {
    setDownloading(true)
    try {
      const res = await api.get('/export/gst-quarterly.xlsx', { params: { fy, cn: useCn ? 1 : 0 }, responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a'); a.href = url; a.download = `gst-quarterly-FY${fy}-${String(fy + 1).slice(2)}.xlsx`
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000)
    } catch (e) { alert('Excel download failed') } finally { setDownloading(false) }
  }

  const fyOptions = Array.from({ length: 5 }, (_, i) => thisFy() - i)
  const today = todayIso()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select value={fy} onChange={e => setFy(parseInt(e.target.value))} className="input-field w-auto">
          {fyOptions.map(y => <option key={y} value={y}>FY {y}-{String(y + 1).slice(2)}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm cursor-pointer" style={muted}>
          <input type="checkbox" checked={useCn} onChange={e => setUseCn(e.target.checked)} /> Deduct credit notes from output tax
        </label>
        <div className="flex-1" />
        <button onClick={download} disabled={downloading || !data} className="btn-primary flex items-center gap-2">
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Download Excel
        </button>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">{[0, 1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 260 }} />)}</div>
      ) : !data ? (
        <div className="card text-center py-10" style={muted}>Couldn't load the quarterly report. Please try again.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Output tax (sales)', data.totals.output.total, '#6ea8fe'],
              ['Input tax credit (purchases)', data.totals.input.total, '#fb923c'],
              ['Tax payable in cash — full year', data.totals.payable, '#f87171'],
              ['Credit carried to next year', data.totals.closingCredit, '#4ade80'],
            ].map(([label, val, color]) => (
              <div key={label} className="card" style={{ padding: 16, borderLeft: `3px solid ${color}` }}>
                <p className="text-xs" style={muted}>{label}</p>
                <p className="text-xl font-bold mt-1" style={{ color }}>{formatCurrency(val)}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {data.quarters.map(q => {
              const status = today < q.startDate ? 'upcoming' : today <= q.endDate ? 'running' : 'done'
              const pays = q.payable.total > 0
              const dueIn = daysBetween(today, q.dueDate)
              const open = openQ === q.q
              return (
                <div key={q.q} className="card" style={{ padding: 18, opacity: status === 'upcoming' ? 0.55 : 1 }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(var(--accent-rgb),.15)', color: 'var(--accent)' }}>{q.label}</span>
                    <span className="font-semibold text-white">{q.range} {q.q >= 4 ? data.fy + 1 : data.fy}</span>
                    <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border)', ...muted }}>
                      {status === 'running' ? 'Running now' : status === 'done' ? 'Completed' : 'Upcoming'}
                    </span>
                  </div>

                  <p className="text-xs" style={muted}>{status === 'running' ? 'Tax payable so far' : 'Tax payable (cash)'}</p>
                  <p className="text-3xl font-extrabold" style={{ color: pays ? '#f87171' : '#4ade80' }}>{formatCurrency(q.payable.total)}</p>
                  <p className="text-xs mt-1 flex items-center gap-1.5" style={muted}>
                    {pays ? <><CalendarClock size={13} /> Return &amp; payment due {fmtDue(q.dueDate)}
                      {status === 'done' && (dueIn >= 0 ? <b style={{ color: dueIn <= 10 ? '#fbbf24' : 'inherit' }}> · in {dueIn} day{dueIn === 1 ? '' : 's'}</b> : <b style={{ color: '#f87171' }}> · date passed</b>)}</>
                      : <><CheckCircle2 size={13} /> Nothing to pay{q.closing.total > 0 ? ` — ${formatCurrency(q.closing.total)} credit carries forward` : ''}</>}
                  </p>
                  {pays && q.closing.total > 0 && <p className="text-xs mt-0.5" style={muted}>+ {formatCurrency(q.closing.total)} credit carries forward</p>}

                  <div className="overflow-x-auto mt-4">
                    <table className="nebula-table w-full text-sm">
                      <thead><tr><th className="text-left"></th><th className="text-right">Output</th><th className="text-right">ITC</th><th className="text-right">Pay</th><th className="text-right">C/F</th></tr></thead>
                      <tbody>
                        {[['CGST', 'cgst'], ['SGST', 'sgst'], ['IGST', 'igst']].map(([lbl, k]) => (
                          <tr key={k}><td className="font-medium text-white">{lbl}</td>
                            <td className="text-right">{formatCurrency(q.output[k])}</td><td className="text-right">{formatCurrency(q.input[k])}</td>
                            <td className="text-right font-semibold" style={{ color: q.payable[k] > 0 ? '#f87171' : undefined }}>{formatCurrency(q.payable[k])}</td>
                            <td className="text-right" style={{ color: q.closing[k] > 0 ? '#4ade80' : undefined }}>{formatCurrency(q.closing[k])}</td></tr>
                        ))}
                        <tr style={{ fontWeight: 700 }}><td className="text-white">Total</td><td className="text-right">{formatCurrency(q.output.total)}</td><td className="text-right">{formatCurrency(q.input.total)}</td><td className="text-right">{formatCurrency(q.payable.total)}</td><td className="text-right">{formatCurrency(q.closing.total)}</td></tr>
                      </tbody>
                    </table>
                  </div>
                  {q.opening.total > 0 && <p className="text-xs mt-2" style={muted}>Includes {formatCurrency(q.opening.total)} credit brought forward from the previous quarter.</p>}
                  {q.creditNotes.total > 0 && <p className="text-xs mt-1" style={muted}>Output tax already reduced by {formatCurrency(q.creditNotes.total)} of credit notes.</p>}

                  <button onClick={() => setOpenQ(open ? null : q.q)} className="mt-3 flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Month-wise breakdown
                  </button>
                  {open && (
                    <div className="overflow-x-auto mt-2">
                      <table className="nebula-table w-full text-xs">
                        <thead><tr><th className="text-left">Month</th><th className="text-right">Invoices</th><th className="text-right">Taxable sales</th><th className="text-right">Output tax</th><th className="text-right">Bills</th><th className="text-right">ITC</th></tr></thead>
                        <tbody>{q.months.map(m => (
                          <tr key={m.key}><td className="font-medium text-white">{m.fullName}</td><td className="text-right">{m.output.count}</td><td className="text-right">{formatCurrency(m.output.taxable)}</td><td className="text-right">{formatCurrency(m.output.total)}</td><td className="text-right">{m.input.count}</td><td className="text-right">{formatCurrency(m.input.total)}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="card flex gap-3 text-xs" style={{ padding: 14, ...muted }}>
            <Info size={16} className="flex-shrink-0 mt-0.5" />
            <p>Tax is settled once per quarter: output tax − input tax credit (this quarter + credit brought forward). Set-off follows CGST Act §49 / Rule 88A — IGST credit is used first; CGST and SGST credits never pay each other. Return due dates shown are the standard dates for your state (the {data.dueDay}th of the month after each quarter); check the GST portal for extensions. Cancelled invoices are excluded. Always verify against your GSTR-3B before filing.</p>
          </div>
        </>
      )}
    </div>
  )
}

// ═════════ Item-wise / Customer-wise / Ageing (unchanged data, cleaner layout) ═════════
function ClassicReport({ tab }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = async () => {
    setLoading(true); setData([])
    try {
      const url = tab === 'item-wise' ? '/reports/item-wise-sales' : tab === 'customer-wise' ? '/reports/customer-wise-sales' : '/reports/ageing'
      const params = {}
      if (from) params.from = from
      if (to) params.to = to
      const res = await api.get(url, { params })
      setData(res.data.data || res.data.buckets || [])
    } catch (e) { console.error('Reports error:', e) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [tab])

  const rows = Array.isArray(data) ? data : []
  const total = rows.reduce((s, r) => s + (parseFloat(r.total_amount) || 0), 0)

  return (
    <div className="space-y-4">
      {tab !== 'ageing' && (
        <div className="flex flex-wrap gap-3 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field w-auto" />
          <span style={muted}>to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field w-auto" />
          <button onClick={load} className="btn-primary text-sm">Apply</button>
        </div>
      )}
      {loading ? <div className="skeleton" style={{ height: 260 }} /> : (
        <div className="card">
          {tab === 'ageing' ? (
            <div className="space-y-6">
              {data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length ? Object.entries(data).map(([bucket, invoices]) => (
                <div key={bucket}>
                  <h3 className="font-bold mb-2 text-white">{bucket} days <span className="text-sm font-normal" style={muted}>({invoices?.length || 0} invoices · {formatCurrency((invoices || []).reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0))})</span></h3>
                  {invoices && invoices.length > 0 ? (
                    <div className="overflow-x-auto"><table className="nebula-table w-full text-sm">
                      <thead><tr><th className="text-left">Invoice</th><th className="text-left">Customer</th><th className="text-left">Date</th><th className="text-right">Days</th><th className="text-right">Amount</th></tr></thead>
                      <tbody>{invoices.map(inv => (<tr key={inv.id}><td className="font-medium text-white">{inv.invoice_number}</td><td>{inv.customer_name}</td><td>{formatDate(inv.invoice_date)}</td><td className="text-right">{inv.days}</td><td className="text-right font-medium">{formatCurrency(inv.total_amount)}</td></tr>))}</tbody>
                    </table></div>
                  ) : <p className="text-sm" style={muted}>No invoices in this bucket</p>}
                </div>
              )) : <p className="text-center py-8" style={muted}>No outstanding invoices</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="nebula-table w-full text-sm">
                <thead><tr>{tab === 'item-wise'
                  ? <><th className="text-left">Description</th><th className="text-left">HSN</th><th className="text-right">Qty</th><th className="text-right">Amount</th></>
                  : <><th className="text-left">Customer</th><th className="text-left">GSTIN</th><th className="text-right">Invoices</th><th className="text-right">Amount</th></>}</tr></thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>{tab === 'item-wise'
                      ? <><td className="text-white">{row.description}</td><td>{row.hsn_code}</td><td className="text-right">{row.total_qty}</td><td className="text-right font-medium">{formatCurrency(row.total_amount)}</td></>
                      : <><td className="text-white">{row.customer_name || '—'}</td><td className="font-mono text-xs">{row.gstin || '-'}</td><td className="text-right">{row.invoice_count}</td><td className="text-right font-medium">{formatCurrency(row.total_amount)}</td></>}</tr>
                  ))}
                  {rows.length > 0 && <tr style={{ fontWeight: 700 }}><td colSpan={3} className="text-white">Total</td><td className="text-right">{formatCurrency(total)}</td></tr>}
                </tbody>
              </table>
              {rows.length === 0 && <p className="text-center py-8" style={muted}>No data for this period</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Reports() {
  const [tab, setTab] = useState('quarterly')
  const tabs = [
    { id: 'quarterly', label: 'Quarterly GST' },
    { id: 'item-wise', label: 'Item-wise Sales' },
    { id: 'customer-wise', label: 'Customer-wise Sales' },
    { id: 'ageing', label: 'Outstanding Ageing' },
  ]
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-sm" style={muted}>Indian financial year (April – March) · GST settled quarterly</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={`chip ${tab === t.id ? 'active' : ''}`}>{t.label}</button>)}
      </div>
      {tab === 'quarterly' ? <QuarterlyGst /> : <ClassicReport key={tab} tab={tab} />}
    </div>
  )
}
