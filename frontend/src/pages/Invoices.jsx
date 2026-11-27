import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Eye, Download, Trash2, FileText } from 'lucide-react'
import api from '../api/client'
import useCachedApi, { invalidateCache } from '../hooks/useCachedApi'
import { PageHeader, StatTiles, SearchInput, Chips, DataTable, StatusBadge, EmptyBlock, num, inr, compactInr } from '../components/ui'
import { formatDate } from '../utils'

const gstOf = (i) => num(i.cgst_amount) + num(i.sgst_amount) + num(i.igst_amount)
const today = () => new Date().toISOString().slice(0, 10)
const quarterRange = (d = new Date()) => {
  const m = d.getMonth(), y = d.getFullYear()
  const q = m >= 3 ? Math.floor((m - 3) / 3) : 3
  const startM = [3, 6, 9, 0][q], startY = q === 3 ? y : y
  const s = new Date(startY, startM, 1), e = new Date(startY, startM + 3, 0)
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return [iso(s), iso(e), `Q${q + 1}`]
}
const isOverdue = (i) => i.payment_status !== 'Paid' && i.due_date && String(i.due_date).slice(0, 10) < today()

export default function Invoices() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const { data, loading, refetch } = useCachedApi('/invoices', { maxAge: 30000 })
  const invoices = data?.invoices || []
  const [qFrom, qTo, qLabel] = quarterRange()

  const del = async (inv, e) => {
    e.stopPropagation()
    if (!confirm(`Delete invoice ${inv.invoice_number}? This cannot be undone.`)) return
    try { await api.delete('/invoices/' + inv.id); invalidateCache('/invoices'); refetch() } catch { alert('Delete failed') }
  }

  const tests = {
    all: () => true,
    unpaid: (i) => i.payment_status !== 'Paid',
    overdue: isOverdue,
    paid: (i) => i.payment_status === 'Paid',
    quarter: (i) => { const d = String(i.invoice_date || '').slice(0, 10); return d >= qFrom && d <= qTo },
  }
  const counts = useMemo(() => Object.fromEntries(Object.entries(tests).map(([k, t]) => [k, invoices.filter(t).length])), [invoices])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter(tests[filter]).filter(i => !q || i.invoice_number?.toLowerCase().includes(q) || i.customer_name?.toLowerCase().includes(q))
  }, [invoices, filter, search])

  const sum = (f, list = rows) => list.reduce((s, i) => s + f(i), 0)
  const outstanding = sum(i => (i.payment_status === 'Paid' ? 0 : num(i.total_amount) - num(i.amount_paid)))

  const columns = [
    { key: 'invoice_number', label: 'Invoice', mobile: 'sub', render: i => <span className="ui-link">{i.invoice_number || '—'}</span>, sortValue: i => i.id },
    { key: 'invoice_date', label: 'Date', render: i => formatDate(i.invoice_date), sortValue: i => String(i.invoice_date || '') },
    { key: 'customer_name', label: 'Customer', mobile: 'title', render: i => <b style={{ color: 'var(--text-bright)' }}>{i.customer_name || 'Walk-in'}</b> },
    { key: 'subtotal', label: 'Taxable', align: 'right', render: i => inr(i.subtotal), sortValue: i => num(i.subtotal) },
    { key: 'gst', label: 'GST', align: 'right', render: i => <span className="ui-muted">{inr(gstOf(i))}</span>, sortValue: gstOf },
    { key: 'total_amount', label: 'Total', align: 'right', mobile: 'amount', render: i => <b>{inr(i.total_amount)}</b>, sortValue: i => num(i.total_amount) },
    { key: 'payment_status', label: 'Status', align: 'center', mobile: 'badge', render: i => <StatusBadge status={isOverdue(i) ? 'Overdue' : i.payment_status} /> },
    { key: 'actions', label: '', align: 'right', sortable: false, render: i => (
      <span className="inline-flex gap-1" onClick={e => e.stopPropagation()}>
        <button className="ui-icon-btn" title="View" onClick={() => navigate(`/app/invoices/${i.id}`)}><Eye size={15} /></button>
        <button className="ui-icon-btn" title="Download PDF" onClick={() => navigate(`/app/invoices/${i.id}?download=pdf`)}><Download size={15} /></button>
        <button className="ui-icon-btn danger" title="Delete" onClick={(e) => del(i, e)}><Trash2 size={15} /></button>
      </span>
    ) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Invoices" subtitle="GST tax invoices"
        actions={<button onClick={() => navigate('/app/invoices/new')} className="btn-primary flex items-center gap-2"><Plus size={17} />New invoice</button>} />

      <StatTiles items={[
        { label: 'Invoices', value: rows.length, sub: filter === 'all' ? 'All time' : 'In this view' },
        { label: 'Billed', value: compactInr(sum(i => num(i.total_amount))), title: inr(sum(i => num(i.total_amount)), 2), tone: 'info', sub: `GST ${compactInr(sum(gstOf))}` },
        { label: 'Received', value: compactInr(sum(i => (i.payment_status === 'Paid' ? num(i.total_amount) : num(i.amount_paid)))), tone: 'pos' },
        { label: 'Outstanding', value: compactInr(outstanding), title: inr(outstanding, 2), tone: 'neg', sub: `${counts.overdue} overdue` },
      ]} />

      <div className="ui-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search invoice no. or customer" />
        <Chips value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All', count: counts.all },
          { value: 'unpaid', label: 'Unpaid', count: counts.unpaid },
          { value: 'overdue', label: 'Overdue', count: counts.overdue },
          { value: 'paid', label: 'Paid', count: counts.paid },
          { value: 'quarter', label: `This quarter (${qLabel})`, count: counts.quarter },
        ]} />
      </div>

      <DataTable columns={columns} rows={rows} loading={loading} initialSort={{ key: 'invoice_number', dir: 'desc' }}
        onRowClick={i => navigate(`/app/invoices/${i.id}`)}
        empty={invoices.length
          ? <EmptyBlock icon={FileText} title="No matching invoices" text="Try another filter or search." />
          : <EmptyBlock icon={FileText} title="No invoices yet" text="Create your first GST invoice." action={<button onClick={() => navigate('/app/invoices/new')} className="btn-primary inline-flex items-center gap-2"><Plus size={16} />New invoice</button>} />}
        footer={rows.length > 1 && <>
          <td colSpan={3}>{rows.length} invoices</td><td className="al-right">{inr(sum(i => num(i.subtotal)))}</td><td className="al-right">{inr(sum(gstOf))}</td><td className="al-right">{inr(sum(i => num(i.total_amount)))}</td><td colSpan={2} />
        </>} />
    </div>
  )
}
