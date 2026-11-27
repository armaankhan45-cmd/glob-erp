import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Eye, Edit, Trash2, Copy, FileSpreadsheet } from 'lucide-react'
import api from '../api/client'
import { PageHeader, StatTiles, SearchInput, Chips, DataTable, StatusBadge, EmptyBlock, num, inr, compactInr } from '../components/ui'
import { formatDate } from '../utils'

export default function Quotations() {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [dupBusy, setDupBusy] = useState(null)

  const load = async () => {
    try { const res = await api.get('/quotations'); setQuotations(res.data.quotations || []) }
    catch { setQuotations([]) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const del = async (q) => {
    if (!confirm(`Delete quotation ${q.quotation_number}?`)) return
    try { await api.delete(`/quotations/${q.id}`); load() } catch { alert('Delete failed') }
  }
  const duplicate = async (q) => {
    if (dupBusy) return
    setDupBusy(q.id)
    try { const res = await api.post(`/quotations/${q.id}/duplicate`); navigate(`/app/quotations/${res.data.quotation.id}/edit`) }
    catch (err) { alert(err.response?.data?.msg || 'Duplicate failed') } finally { setDupBusy(null) }
  }

  const statuses = useMemo(() => ['all', ...new Set(quotations.map(q => q.status || 'Draft'))], [quotations])
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase()
    return quotations.filter(q => filter === 'all' || (q.status || 'Draft') === filter)
      .filter(q => !s || q.quotation_number?.toLowerCase().includes(s) || q.customer_name?.toLowerCase().includes(s))
  }, [quotations, filter, search])
  const sum = f => rows.reduce((t, q) => t + f(q), 0)
  const converted = quotations.filter(q => q.status === 'Converted').length

  const columns = [
    { key: 'quotation_number', label: 'Quote no.', mobile: 'sub', render: q => <span className="ui-link">{q.quotation_number}</span>, sortValue: q => q.id },
    { key: 'customer_name', label: 'Customer', mobile: 'title', render: q => <b style={{ color: 'var(--text-bright)' }}>{q.customer_name || '—'}</b> },
    { key: 'quotation_date', label: 'Date', render: q => formatDate(q.quotation_date), sortValue: q => String(q.quotation_date || '') },
    { key: 'total_amount', label: 'Amount', align: 'right', mobile: 'amount', render: q => <b>{inr(q.total_amount)}</b>, sortValue: q => num(q.total_amount) },
    { key: 'status', label: 'Status', align: 'center', mobile: 'badge', render: q => <StatusBadge status={q.status || 'Draft'} /> },
    { key: 'actions', label: '', align: 'right', sortable: false, render: q => (
      <span className="inline-flex gap-1" onClick={e => e.stopPropagation()}>
        <button className="ui-icon-btn" title="View" onClick={() => navigate(`/app/quotations/${q.id}`)}><Eye size={15} /></button>
        <button className="ui-icon-btn" title="Edit" onClick={() => navigate(`/app/quotations/${q.id}/edit`)}><Edit size={15} /></button>
        <button className="ui-icon-btn" title="Duplicate" disabled={dupBusy === q.id} onClick={() => duplicate(q)}><Copy size={15} /></button>
        <button className="ui-icon-btn danger" title="Delete" onClick={() => del(q)}><Trash2 size={15} /></button>
      </span>
    ) },
  ]

  return (
    <div className="space-y-5">
      <PageHeader title="Quotations" subtitle="Estimates you can convert to invoices"
        actions={<Link to="/app/quotations/new" className="btn-primary flex items-center gap-2"><Plus size={17} />New quotation</Link>} />
      <StatTiles items={[
        { label: 'Quotations', value: rows.length },
        { label: 'Quoted value', value: compactInr(sum(q => num(q.total_amount))), title: inr(sum(q => num(q.total_amount)), 2), tone: 'info' },
        { label: 'Converted', value: converted, tone: 'pos', sub: quotations.length ? `${Math.round((converted / quotations.length) * 100)}% win rate` : '' },
        { label: 'Open', value: quotations.filter(q => !['Converted', 'Rejected'].includes(q.status)).length, tone: 'warn' },
      ]} />
      <div className="ui-toolbar">
        <SearchInput value={search} onChange={setSearch} placeholder="Search quote no. or customer" />
        <Chips value={filter} onChange={setFilter} options={statuses.map(s => ({ value: s, label: s === 'all' ? 'All' : s, count: s === 'all' ? quotations.length : quotations.filter(q => (q.status || 'Draft') === s).length }))} />
      </div>
      <DataTable columns={columns} rows={rows} loading={loading} initialSort={{ key: 'quotation_number', dir: 'desc' }}
        onRowClick={q => navigate(`/app/quotations/${q.id}`)}
        empty={<EmptyBlock icon={FileSpreadsheet} title={quotations.length ? 'No matching quotations' : 'No quotations yet'}
          action={!quotations.length && <Link to="/app/quotations/new" className="btn-primary inline-flex items-center gap-2"><Plus size={16} />New quotation</Link>} />} />
    </div>
  )
}
